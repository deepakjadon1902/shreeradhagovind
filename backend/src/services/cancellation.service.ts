import { Order } from "../models/Order";
import { Product } from "../models/Product";
import { dispatchOrderCancelledEmailOnce } from "../utils/email";

export const CANCELLABLE_STATUSES_CUSTOMER = ["Placed", "Confirmed"] as const;
export const CANCELLABLE_STATUSES_ADMIN = ["Placed", "Confirmed", "Processing", "Hold", "Packed"] as const;

export interface RestockResult {
  restockedCount: number;
  itemsRestocked: number;
  errors?: string[];
}

export interface RestockOrderItem {
  productId?: any;
  qty: number;
  name?: string | null;
}

/**
 * Reusable helper for atomically restoring product stock from an order.
 * - Restores every product quantity using atomic MongoDB $inc operations.
 * - Aggregates quantities per productId in case the same item appears multiple times.
 * - Tolerates missing/deleted products without aborting remaining stock updates.
 * - Invariant: Must only be invoked once per order cancellation (enforced via atomic isRestocked lock).
 */
export async function restockOrderItems(order: {
  _id?: any;
  orderNo?: any;
  items?: Array<RestockOrderItem> | any;
}): Promise<RestockResult> {
  if (!order || !Array.isArray(order.items) || order.items.length === 0) {
    return { restockedCount: 0, itemsRestocked: 0 };
  }

  // Aggregate quantities by productId
  const qtyMap = new Map<string, { qty: number; name?: string }>();
  for (const item of order.items) {
    if (!item.productId || typeof item.qty !== "number" || item.qty <= 0) continue;
    const pid = String(item.productId);
    const existing = qtyMap.get(pid);
    qtyMap.set(pid, {
      qty: (existing?.qty || 0) + item.qty,
      name: item.name || existing?.name,
    });
  }

  if (qtyMap.size === 0) {
    return { restockedCount: 0, itemsRestocked: 0 };
  }

  const bulkOps = Array.from(qtyMap.entries()).map(([productId, entry]) => ({
    updateOne: {
      filter: { _id: productId },
      update: { $inc: { stock: entry.qty } },
    },
  }));

  try {
    const res = await Product.bulkWrite(bulkOps, { ordered: false });
    const orderIdentifier = order.orderNo ? `#${order.orderNo}` : String(order._id);
    console.log(
      `[restockOrderItems] Successfully restored stock for Order ${orderIdentifier}: ${res.modifiedCount} product(s) updated across ${qtyMap.size} unique item(s).`
    );
    return {
      restockedCount: res.modifiedCount,
      itemsRestocked: qtyMap.size,
    };
  } catch (err: any) {
    console.error(`[restockOrderItems] Partial error during Product.bulkWrite:`, err);
    return {
      restockedCount: err?.result?.nModified ?? 0,
      itemsRestocked: qtyMap.size,
      errors: [err?.message || String(err)],
    };
  }
}

export interface CancelOrderParams {
  orderId: any;
  cancellableStatuses: readonly string[];
  cancelledBy: "customer" | "admin" | "system";
  cancellationReason: string;
  note?: string;
  sendNotificationEmail?: boolean;
}

export interface CancelOrderResult {
  success: boolean;
  order?: any;
  alreadyCancelled?: boolean;
  statusNotCancellable?: boolean;
  currentStatus?: string;
  error?: string;
}

/**
 * Atomically transitions an order to "Cancelled", restores stock exactly once,
 * persists audit trail in statusHistory, and dispatches the cancellation email.
 *
 * Concurrency Safety Invariant:
 * ONE successful atomic transition = ONE stock restoration.
 * Any simultaneous or repeated requests fail the atomic query and perform zero additional restocking.
 */
export async function cancelOrderAtomically(params: CancelOrderParams): Promise<CancelOrderResult> {
  const {
    orderId,
    cancellableStatuses,
    cancelledBy,
    cancellationReason,
    note,
    sendNotificationEmail = true,
  } = params;

  const now = new Date();
  const cleanReason = (cancellationReason || "").trim() || "Requested by customer";
  const historyNote = (note || cleanReason).trim();

  // ATOMIC CHECK AND UPDATE:
  // Query must match the order, status must be in cancellableStatuses,
  // and isRestocked must NOT be true.
  const updatedOrder = await Order.findOneAndUpdate(
    {
      _id: orderId,
      status: { $in: cancellableStatuses as string[] },
      isRestocked: { $ne: true },
    },
    {
      $set: {
        status: "Cancelled",
        cancellationReason: cleanReason,
        cancelledBy,
        cancelledAt: now,
        isRestocked: true,
        restockedAt: now,
      },
      $push: {
        statusHistory: {
          status: "Cancelled",
          changedAt: now,
          changedBy: cancelledBy,
          note: historyNote,
        },
      },
    },
    { new: true }
  ).populate("user", "name email");

  if (!updatedOrder) {
    // Determine why the atomic update did not match
    const existing = await Order.findById(orderId).select("status isRestocked cancellationReason").lean();
    if (!existing) {
      return { success: false, error: "Order not found" };
    }
    if (existing.status === "Cancelled" || existing.isRestocked) {
      return {
        success: false,
        alreadyCancelled: true,
        currentStatus: "Cancelled",
        error: "This order has already been cancelled.",
      };
    }
    return {
      success: false,
      statusNotCancellable: true,
      currentStatus: existing.status,
      error: `Order cannot be cancelled because it is currently "${existing.status}".`,
    };
  }

  // Sole winner of atomic transition performs stock restoration
  await restockOrderItems(updatedOrder);

  // Send cancellation email safely and idempotently
  if (sendNotificationEmail) {
    const recipientEmail = updatedOrder.customerEmail || (updatedOrder.user as any)?.email;
    const recipientName = updatedOrder.address?.name || (updatedOrder.user as any)?.name || "Customer";

    if (recipientEmail) {
      dispatchOrderCancelledEmailOnce(
        updatedOrder,
        recipientEmail,
        recipientName,
        cleanReason
      ).catch((err) => {
        console.error(`[cancelOrderAtomically] Failed to dispatch cancellation email:`, err);
      });
    }
  }

  return {
    success: true,
    order: updatedOrder,
  };
}
