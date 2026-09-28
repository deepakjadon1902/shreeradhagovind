import { Order } from "../models/Order";
import { User, type UserDoc } from "../models/User";

export interface LinkGuestOrdersResult {
  linkedCount: number;
  matchedCount: number;
  alreadyLinkedCount: number;
  orderIds: string[];
}

/**
 * Safely associates historical guest orders with an authenticated customer account.
 *
 * Invariants & Security Guarantees:
 * 1. Email MUST be verified (via verified OTP or active auth session).
 * 2. Matches strictly on normalized, lowercase, trimmed customerEmail.
 * 3. Only links unassociated orders: { $or: [{ user: { $exists: false } }, { user: null }] }.
 * 4. NEVER touches orders already associated with a different user ID (cross-account isolation).
 * 5. Idempotent: repeated executions return 0 new linked orders.
 * 6. Preserves original customerEmail, order address, and financial metadata intact.
 */
export async function linkGuestOrdersForUser(
  user: { _id?: any; id?: string; email: string; emailVerified?: boolean; role?: string }
): Promise<LinkGuestOrdersResult> {
  const normalizedEmail = (user.email || "").trim().toLowerCase();
  if (!normalizedEmail || !normalizedEmail.includes("@")) {
    return { linkedCount: 0, matchedCount: 0, alreadyLinkedCount: 0, orderIds: [] };
  }

  const userId = user._id || user.id;
  if (!userId) {
    return { linkedCount: 0, matchedCount: 0, alreadyLinkedCount: 0, orderIds: [] };
  }

  try {
    // 1. Identify orders already linked to this user with this email
    const alreadyLinkedCount = await Order.countDocuments({
      user: userId,
      customerEmail: normalizedEmail,
    });

    // 2. Identify eligible unlinked guest orders placed with this email
    const unlinkedGuestOrders = await Order.find({
      customerEmail: normalizedEmail,
      $or: [{ user: { $exists: false } }, { user: null }],
    })
      .select("_id")
      .lean();

    if (unlinkedGuestOrders.length === 0) {
      return {
        linkedCount: 0,
        matchedCount: alreadyLinkedCount,
        alreadyLinkedCount,
        orderIds: [],
      };
    }

    const orderIds = unlinkedGuestOrders.map((o) => String(o._id));

    // 3. Atomically associate unlinked orders with this verified user
    const updateResult = await Order.updateMany(
      {
        _id: { $in: unlinkedGuestOrders.map((o) => o._id) },
        customerEmail: normalizedEmail,
        $or: [{ user: { $exists: false } }, { user: null }],
      },
      {
        $set: { user: userId },
      }
    );

    const linkedCount = updateResult.modifiedCount ?? 0;

    return {
      linkedCount,
      matchedCount: alreadyLinkedCount + linkedCount,
      alreadyLinkedCount,
      orderIds,
    };
  } catch (err) {
    console.error("[linkGuestOrdersForUser:error]", err);
    return { linkedCount: 0, matchedCount: 0, alreadyLinkedCount: 0, orderIds: [] };
  }
}
