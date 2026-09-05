import { Router } from "express";
import { z } from "zod";
import { Order } from "../models/Order";
import { User } from "../models/User";
import { requireAuth, requireAdmin } from "../middleware/auth";
import { HttpError } from "../middleware/error";
import {
  sendEmail,
  sendOrderConfirmationWithInvoice,
  sendOrderStatusUpdateWithInvoice,
  tpl,
  formatOrderNumber,
} from "../utils/email";
import { generateInvoicePDF, type InvoiceData } from "../utils/invoice";
import { getCourierTrackingUrl } from "../utils/courier";
import {
  syncOrderTracking,
  requestManualTrackingRefresh,
  getQuotaInfo,
} from "../services/courierTracking.service";

const r = Router();
r.use(requireAuth, requireAdmin);

r.get("/orders", async (_req, res, next) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 }).populate("user", "name email");
    res.json({ orders });
  } catch (e) {
    next(e);
  }
});

// Legacy: status-only update
r.patch("/orders/:id/status", async (req, res, next) => {
  try {
    const { status } = z
      .object({
        status: z.enum(["Placed", "Confirmed", "Processing", "Packed", "Shipped", "Out for delivery", "Delivered", "Cancelled"]),
      })
      .parse(req.body);
    const o = await Order.findByIdAndUpdate(req.params.id, { status }, { new: true }).populate("user", "name email");
    if (!o) throw new HttpError(404, "Not found");
    const u: any = o.user;
    if (u?.email) {
      sendOrderStatusUpdateWithInvoice(u.email, u.name, buildEmailOrder(o)).catch(() => {});
    }
    res.json({ order: o });
  } catch (e) {
    next(e);
  }
});

// Combined update: status / courier / tracking id / courier URL
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  Placed: ["Confirmed", "Cancelled"],
  Confirmed: ["Processing", "Cancelled"],
  Processing: ["Hold", "Packed", "Cancelled"],
  Hold: ["Processing", "Cancelled"],
  Packed: ["Shipped", "Cancelled"],
  Shipped: ["Out for delivery", "Delivered"],
  "Out for delivery": ["Delivered"],
  Delivered: [],
  Cancelled: [],
};

r.patch("/orders/:id", async (req, res, next) => {
  try {
    const data = z
      .object({
        status: z
          .enum([
            "Placed",
            "Confirmed",
            "Processing",
            "Hold",
            "Packed",
            "Shipped",
            "Out for delivery",
            "Delivered",
            "Cancelled",
          ])
          .optional(),
        holdReason: z.string().optional(),
        note: z.string().optional(),
        courier: z
          .enum([
            "Ekart",
            "DTDC",
            "Shree Maruti",
            "Shree Murti",
            "India Post",
            "Delhivery",
            "Bluedart",
          ])
          .nullable()
          .optional(),
        trackingId: z.string().min(3).max(40).optional(),
        courierTrackingUrl: z.string().url().or(z.literal("")).optional(),
      })
      .parse(req.body);

    const existing = await Order.findById(req.params.id);
    if (!existing) throw new HttpError(404, "Not found");

    const update: any = {};

    if (data.status !== undefined && data.status !== existing.status) {
      const allowed = ALLOWED_TRANSITIONS[existing.status] || [];
      if (!allowed.includes(data.status)) {
        throw new HttpError(
          400,
          `Invalid status transition: Cannot change order from "${existing.status}" to "${data.status}".`
        );
      }

      if (data.status === "Hold") {
        const cleanHoldReason = (data.holdReason || "").trim();
        if (!cleanHoldReason) {
          throw new HttpError(400, "A hold reason is mandatory when placing an order on hold.");
        }
        update.holdReason = cleanHoldReason;
        update.holdAt = new Date();
      } else if (existing.status === "Hold" && data.status === "Processing") {
        update.holdReason = "";
      }

      update.status = data.status;
      update.$push = {
        statusHistory: {
          status: data.status,
          changedAt: new Date(),
          changedBy: "admin",
          note: data.note?.trim() || "",
          holdReason: data.status === "Hold" ? (data.holdReason || "").trim() : "",
        },
      };
    }

    const requestedCourier = data.courier === "Shree Murti" ? "Shree Maruti" : data.courier;
    if (existing.payment?.method === "cod" && requestedCourier && requestedCourier !== "DTDC") {
      throw new HttpError(400, "COD orders can only be shipped with DTDC");
    }
    if (data.courier !== undefined) update.courier = requestedCourier;
    if (data.trackingId !== undefined) update.trackingId = data.trackingId.toUpperCase();

    const effectiveCourier = data.courier !== undefined ? requestedCourier : existing.courier;
    const effectiveTrackingId =
      data.trackingId !== undefined ? data.trackingId.toUpperCase() : existing.trackingId;

    if (data.courierTrackingUrl !== undefined && data.courierTrackingUrl !== "") {
      update.courierTrackingUrl = data.courierTrackingUrl;
    } else if (effectiveCourier && effectiveTrackingId) {
      update.courierTrackingUrl = getCourierTrackingUrl(effectiveCourier, effectiveTrackingId);
    } else if (data.courierTrackingUrl === "") {
      update.courierTrackingUrl = "";
    }

    const o = await Order.findByIdAndUpdate(req.params.id, update, { new: true }).populate(
      "user",
      "name email"
    );
    if (!o) throw new HttpError(404, "Not found");
    const u: any = o.user;

    const statusChanged = data.status !== undefined && data.status !== existing.status;
    const trackingChanged =
      data.trackingId !== undefined && data.trackingId.toUpperCase() !== (existing.trackingId || "");
    const courierChanged = data.courier !== undefined && requestedCourier !== existing.courier;

    const recipientEmail = o.customerEmail || u?.email;
    const recipientName = o.address?.name || u?.name || "Customer";

    // Send notification email only on genuine status change or when tracking is newly assigned to Shipped order
    if (
      recipientEmail &&
      (statusChanged || (existing.status === "Shipped" && (trackingChanged || courierChanged)))
    ) {
      sendOrderStatusUpdateWithInvoice(recipientEmail, recipientName, buildEmailOrder(o)).catch(() => {});
    }

    // Trigger background courier tracking sync if shipped with trackingId
    if (
      o.courier &&
      o.trackingId &&
      (o.status === "Shipped" || o.status === "Out for delivery" || o.status === "Delivered")
    ) {
      syncOrderTracking(o).catch(() => {});
    }

    res.json({ order: o });
  } catch (e) {
    next(e);
  }
});

// Manual payment verification endpoint disabled (automated by server and webhooks)
r.patch("/orders/:id/payment", async (_req, _res, next) => {
  next(
    new HttpError(
      400,
      "Manual payment status modifications are disabled. Payment status is automatically managed by Razorpay webhooks."
    )
  );
});

r.get("/users", async (_req, res, next) => {
  try {
    const users = await User.find().select("-passwordHash").sort({ createdAt: -1 }).lean();
    // attach order stats per user
    const ids = users.map((u) => u._id);
    const stats = await Order.aggregate([
      { $match: { user: { $in: ids } } },
      { $group: { _id: "$user", orders: { $sum: 1 }, spent: { $sum: "$total" } } },
    ]);
    const map = new Map(stats.map((s: any) => [String(s._id), s]));
    res.json({
      users: users.map((u) => {
        const s = map.get(String(u._id));
        return { ...u, ordersCount: s?.orders ?? 0, totalSpent: s?.spent ?? 0 };
      }),
    });
  } catch (e) {
    next(e);
  }
});

r.patch("/users/:id/status", async (req, res, next) => {
  try {
    const { isBlocked } = z.object({ isBlocked: z.boolean() }).parse(req.body);
    const u = await User.findByIdAndUpdate(req.params.id, { isBlocked }, { new: true }).select("-passwordHash");
    if (!u) throw new HttpError(404, "User not found");
    res.json({ user: u });
  } catch (e) {
    next(e);
  }
});

// ---- live order fetch + derived courier events (polled by admin) ----
r.get("/orders/:id", async (req, res, next) => {
  try {
    let o = await Order.findById(req.params.id).populate("user", "name email");
    if (!o) throw new HttpError(404, "Not found");

    let trackingData = null;
    if (o.courier && o.trackingId) {
      const synced = await syncOrderTracking(o);
      if (synced.order) o = synced.order;
      trackingData = synced.tracking;
    }

    res.json({ order: o, tracking: trackingData, events: deriveEvents(o) });
  } catch (e) {
    next(e);
  }
});

// Admin manual tracking refresh (cooldown & budget protected)
r.post("/orders/:id/refresh-tracking", async (req, res, next) => {
  try {
    const o = await Order.findById(req.params.id);
    if (!o) throw new HttpError(404, "Order not found");
    const result = await requestManualTrackingRefresh(o);
    res.json(result);
  } catch (e) {
    next(e);
  }
});

// Admin quota & tracking config diagnostics
r.get("/tracking/quota", async (_req, res) => {
  res.json({ quota: getQuotaInfo() });
});

// Download / Stream Invoice PDF for Admin
r.get("/orders/:id/invoice", async (req, res, next) => {
  try {
    const o = await Order.findById(req.params.id).populate("user", "name email");
    if (!o) throw new HttpError(404, "Order not found");

    const u: any = o.user;
    const customerName = o.address?.name || u?.name || "Customer";
    const customerEmail = o.customerEmail || u?.email || "";
    const orderNum = formatOrderNumber(o);

    const invoiceData: InvoiceData = {
      orderId: String(o._id),
      orderNo: o.orderNo ?? orderNum,
      invoiceNo: `INV-${orderNum}`,
      trackingId: o.trackingId ?? undefined,
      courier: o.courier ?? null,
      status: o.status,
      customerName,
      customerEmail,
      businessName: o.businessName,
      gstin: o.gstin,
      needsGstInvoice: o.needsGstInvoice,
      items: o.items as any,
      subtotal: o.subtotal,
      shipping: o.shipping,
      total: o.total,
      address: o.address as any,
      payment: {
        method: o.payment?.method ?? "cod",
        status: o.payment?.status ?? "pending",
        razorpayPaymentId: o.payment?.razorpayPaymentId ?? undefined,
      },
      createdAt: o.createdAt,
    };

    const pdfBuffer = await generateInvoicePDF(invoiceData);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="Invoice-${orderNum}.pdf"`);
    res.send(pdfBuffer);
  } catch (e) {
    next(e);
  }
});

function buildEmailOrder(o: any) {
  return {
    _id: o._id,
    orderNo: o.orderNo ?? undefined,
    trackingId: o.trackingId ?? undefined,
    courier: o.courier ?? undefined,
    courierTrackingUrl: o.courierTrackingUrl ?? undefined,
    status: o.status ?? "Placed",
    businessName: o.businessName ?? undefined,
    gstin: o.gstin ?? undefined,
    needsGstInvoice: o.needsGstInvoice,
    items: o.items as any,
    subtotal: o.subtotal ?? 0,
    shipping: o.shipping ?? 0,
    total: o.total ?? 0,
    address: o.address as any,
    payment: {
      method: o.payment?.method ?? "cod",
      status: o.payment?.status ?? "pending",
      razorpayPaymentId: o.payment?.razorpayPaymentId ?? undefined,
    },
    createdAt: o.createdAt,
  };
}

function deriveEvents(o: any) {
  if (Array.isArray(o.statusHistory) && o.statusHistory.length > 0) {
    return o.statusHistory.map((h: any) => {
      const at = h.changedAt instanceof Date ? h.changedAt : new Date(h.changedAt || o.createdAt);
      let description = h.note || `Order status updated to ${h.status}.`;
      if (h.status === "Hold" && (h.holdReason || o.holdReason)) {
        description = `Order placed on Hold: ${h.holdReason || o.holdReason}`;
      }
      return {
        at: at.toISOString(),
        label: h.status,
        description,
        changedBy: h.changedBy,
        holdReason: h.holdReason,
      };
    });
  }

  const placedAt = o.createdAt instanceof Date ? o.createdAt : new Date(o.createdAt);
  const updatedAt = o.updatedAt instanceof Date ? o.updatedAt : new Date(o.updatedAt ?? placedAt);
  const courier = o.courier ?? "Courier partner";
  const city = o.address?.city ?? "destination";
  const order = [
    "Placed",
    "Confirmed",
    "Processing",
    "Packed",
    "Shipped",
    "Out for delivery",
    "Delivered",
  ];
  const idx =
    o.status === "Cancelled" || o.status === "Hold" ? -1 : Math.max(0, order.indexOf(o.status));
  const evts: { at: Date; label: string; description: string }[] = [];

  if (o.status === "Cancelled") {
    evts.push({
      at: updatedAt,
      label: "Cancelled",
      description: "Order was cancelled. Customer was notified by email.",
    });
  } else if (o.status === "Hold") {
    evts.push({
      at: placedAt,
      label: "Placed",
      description: `Order placed successfully (#${formatOrderNumber(o)}).`,
    });
    evts.push({
      at: updatedAt,
      label: "Hold",
      description: o.holdReason
        ? `Order on temporary hold: ${o.holdReason}`
        : "Order placed on temporary hold.",
    });
  } else {
    if (idx >= 0)
      evts.push({
        at: placedAt,
        label: "Placed",
        description: `Order placed successfully (#${formatOrderNumber(o)}).`,
      });
    if (idx >= 1)
      evts.push({
        at: updatedAt,
        label: "Confirmed",
        description: "Order confirmed. Customer notified.",
      });
    if (idx >= 2)
      evts.push({
        at: updatedAt,
        label: "Processing",
        description: "Order is being processed and prepared for packing.",
      });
    if (idx >= 3)
      evts.push({
        at: updatedAt,
        label: "Packed",
        description: `Items packed at warehouse. Handed over to ${courier}.`,
      });
    if (idx >= 4)
      evts.push({
        at: updatedAt,
        label: "Shipped",
        description: `Shipped via ${courier}. In transit to ${city}.`,
      });
    if (idx >= 5)
      evts.push({
        at: updatedAt,
        label: "Out for delivery",
        description: `${courier} agent is out for delivery in ${city}.`,
      });
    if (idx >= 6)
      evts.push({
        at: updatedAt,
        label: "Delivered",
        description: `Delivered by ${courier} to ${city}.`,
      });
  }
  return evts.map((e) => ({
    at: e.at.toISOString(),
    label: e.label,
    description: e.description,
  }));
}

r.get("/payments", async (_req, res, next) => {
  try {
    const orders = await Order.find()
      .sort({ createdAt: -1 })
      .select("orderNo total payment createdAt user trackingId address")
      .populate("user", "name email");
    res.json({
      payments: orders.map((o) => ({
        id: o._id,
        orderNo: o.orderNo,
        trackingId: o.trackingId,
        user: o.user,
        customerName: o.address?.name || (o.user as any)?.name || "Customer",
        amount: o.total,
        method: o.payment?.method,
        status: o.payment?.status,
        razorpayOrderId: o.payment?.razorpayOrderId,
        razorpayPaymentId: o.payment?.razorpayPaymentId,
        failureReason: o.payment?.failureReason,
        createdAt: o.createdAt,
      })),
    });
  } catch (e) {
    next(e);
  }
});

r.get("/stats", async (_req, res, next) => {
  try {
    const [orderCount, userCount, revenueAgg] = await Promise.all([
      Order.countDocuments(),
      User.countDocuments({ role: "user" }),
      Order.aggregate([
        { $match: { "payment.status": "paid" } },
        { $group: { _id: null, total: { $sum: "$total" } } },
      ]),
    ]);
    res.json({ orderCount, userCount, revenue: revenueAgg[0]?.total ?? 0 });
  } catch (e) {
    next(e);
  }
});

export default r;
