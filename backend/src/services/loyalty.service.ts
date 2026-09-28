import mongoose from "mongoose";
import { Settings } from "../models/Settings";
import { User } from "../models/User";
import { LoyaltyTransaction } from "../models/LoyaltyTransaction";
import { isOrderPaidForFinance } from "../routes/admin.routes";

export interface LoyaltyConfig {
  enabled: boolean;
  pointsEarningRate: number;
  pointsEarningSpendUnit: number;
  pointMonetaryValue: number;
  minPointsRedemption: number;
  maxPointsRedemptionPercent: number;
  pointsCombineWithCoupons: boolean;
  pointsExpirationDays: number;
  earnPointsOnShipping: boolean;
  earnPointsOnDiscountedSubtotal: boolean;
}

export interface TierConfig {
  id: string;
  name: string;
  minSpend: number;
  minOrders: number;
  rule: "spend_or_orders" | "spend_and_orders" | "spend_only" | "orders_only";
  badgeColor: string;
  perks: string[];
  extraPointsMultiplier: number;
}

const DEFAULT_LOYALTY_CONFIG: LoyaltyConfig = {
  enabled: true,
  pointsEarningRate: 1, // 1 point
  pointsEarningSpendUnit: 100, // per ₹100 spent
  pointMonetaryValue: 1, // 1 point = ₹1.00
  minPointsRedemption: 50,
  maxPointsRedemptionPercent: 50,
  pointsCombineWithCoupons: true,
  pointsExpirationDays: 180, // confirmed business rule: exactly 180 days
  earnPointsOnShipping: false,
  earnPointsOnDiscountedSubtotal: true,
};

const DEFAULT_TIERS: TierConfig[] = [
  {
    id: "tier_gold",
    name: "Param Devotee (Gold)",
    minSpend: 5000,
    minOrders: 5,
    rule: "spend_or_orders",
    badgeColor: "#d97706",
    perks: ["1.5x Loyalty Points on all orders", "Priority Order Dispatch", "Exclusive VIP Customer Support"],
    extraPointsMultiplier: 1.5,
  },
  {
    id: "tier_silver",
    name: "Priya Devotee (Silver)",
    minSpend: 2000,
    minOrders: 2,
    rule: "spend_or_orders",
    badgeColor: "#64748b",
    perks: ["1.2x Loyalty Points on all orders", "Early Access to Sacred Collections"],
    extraPointsMultiplier: 1.2,
  },
  {
    id: "tier_bronze",
    name: "Sevak (Bronze)",
    minSpend: 0,
    minOrders: 0,
    rule: "spend_or_orders",
    badgeColor: "#b45309",
    perks: ["1x Standard Points Earning on Completed Orders"],
    extraPointsMultiplier: 1.0,
  },
];

export async function getLoyaltySettings(): Promise<{ loyalty: LoyaltyConfig; tiers: TierConfig[] }> {
  try {
    const settings = await Settings.findOne({ key: "global" }).lean();
    const l = (settings as any)?.loyalty || {};
    const t = (settings as any)?.tiers || [];

    const loyalty: LoyaltyConfig = {
      enabled: l.enabled !== false,
      pointsEarningRate: typeof l.pointsEarningRate === "number" && l.pointsEarningRate > 0 ? l.pointsEarningRate : DEFAULT_LOYALTY_CONFIG.pointsEarningRate,
      pointsEarningSpendUnit: typeof l.pointsEarningSpendUnit === "number" && l.pointsEarningSpendUnit > 0 ? l.pointsEarningSpendUnit : DEFAULT_LOYALTY_CONFIG.pointsEarningSpendUnit,
      pointMonetaryValue: typeof l.pointMonetaryValue === "number" && l.pointMonetaryValue > 0 ? l.pointMonetaryValue : DEFAULT_LOYALTY_CONFIG.pointMonetaryValue,
      minPointsRedemption: typeof l.minPointsRedemption === "number" && l.minPointsRedemption >= 0 ? l.minPointsRedemption : DEFAULT_LOYALTY_CONFIG.minPointsRedemption,
      maxPointsRedemptionPercent: typeof l.maxPointsRedemptionPercent === "number" && l.maxPointsRedemptionPercent > 0 ? l.maxPointsRedemptionPercent : DEFAULT_LOYALTY_CONFIG.maxPointsRedemptionPercent,
      pointsCombineWithCoupons: l.pointsCombineWithCoupons !== false,
      pointsExpirationDays: typeof l.pointsExpirationDays === "number" && l.pointsExpirationDays > 0 ? l.pointsExpirationDays : 180,
      earnPointsOnShipping: Boolean(l.earnPointsOnShipping),
      earnPointsOnDiscountedSubtotal: l.earnPointsOnDiscountedSubtotal !== false,
    };

    const tiers: TierConfig[] = Array.isArray(t) && t.length > 0 ? t : DEFAULT_TIERS;
    return { loyalty, tiers };
  } catch {
    return { loyalty: DEFAULT_LOYALTY_CONFIG, tiers: DEFAULT_TIERS };
  }
}

export function calculateCustomerTier(
  qualifiedSpend: number,
  qualifiedOrders: number,
  tiers: TierConfig[] = DEFAULT_TIERS
): TierConfig {
  const sorted = [...tiers].sort((a, b) => (b.minSpend || 0) - (a.minSpend || 0));

  for (const tier of sorted) {
    const spendReq = tier.minSpend || 0;
    const ordersReq = tier.minOrders || 0;
    let qualifies = false;

    switch (tier.rule) {
      case "spend_and_orders":
        qualifies = qualifiedSpend >= spendReq && qualifiedOrders >= ordersReq;
        break;
      case "spend_only":
        qualifies = qualifiedSpend >= spendReq;
        break;
      case "orders_only":
        qualifies = qualifiedOrders >= ordersReq;
        break;
      case "spend_or_orders":
      default:
        qualifies = qualifiedSpend >= spendReq || qualifiedOrders >= ordersReq;
        break;
    }

    if (qualifies) {
      return tier;
    }
  }

  return tiers[tiers.length - 1] || DEFAULT_TIERS[DEFAULT_TIERS.length - 1];
}

export async function getUserLoyaltyBalance(userId: string | mongoose.Types.ObjectId): Promise<number> {
  const user = await User.findById(userId).select("loyaltyPointsBalance").lean();
  return Math.max(0, user?.loyaltyPointsBalance ?? 0);
}

export async function getLoyaltyLedger(
  userId: string | mongoose.Types.ObjectId,
  limit = 50,
  skip = 0
) {
  return LoyaltyTransaction.find({ userId })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate("referenceOrderId", "orderNo total status")
    .lean();
}

/**
 * Validates points redemption during checkout or Razorpay order creation.
 * Server-side authoritative recalculation.
 */
export async function validateAndCalculatePointsRedemption(params: {
  userId?: string | mongoose.Types.ObjectId | null;
  pointsRequested: number;
  subtotal: number;
  grossSubtotal?: number;
  hasCoupon: boolean;
}): Promise<{
  valid: boolean;
  error?: string;
  pointsRedeemed: number;
  pointsDiscount: number;
}> {
  const { userId, pointsRequested, subtotal, hasCoupon } = params;

  if (!userId || pointsRequested <= 0) {
    return { valid: true, pointsRedeemed: 0, pointsDiscount: 0 };
  }

  const { loyalty } = await getLoyaltySettings();

  if (!loyalty.enabled) {
    return { valid: false, error: "Loyalty points program is currently inactive.", pointsRedeemed: 0, pointsDiscount: 0 };
  }

  if (hasCoupon && !loyalty.pointsCombineWithCoupons) {
    return {
      valid: false,
      error: "Loyalty points cannot be combined with promotional coupons on this order.",
      pointsRedeemed: 0,
      pointsDiscount: 0,
    };
  }

  const user = await User.findById(userId).select("loyaltyPointsBalance isBlocked").lean();
  if (!user) {
    return { valid: false, error: "Customer account not found for loyalty points.", pointsRedeemed: 0, pointsDiscount: 0 };
  }
  if (user.isBlocked) {
    return { valid: false, error: "Customer account is blocked from redeeming points.", pointsRedeemed: 0, pointsDiscount: 0 };
  }

  const userBalance = Math.max(0, user.loyaltyPointsBalance ?? 0);

  if (pointsRequested > userBalance) {
    return {
      valid: false,
      error: `Requested redemption of ${pointsRequested} points exceeds your available balance of ${userBalance} points.`,
      pointsRedeemed: 0,
      pointsDiscount: 0,
    };
  }

  if (pointsRequested < loyalty.minPointsRedemption) {
    return {
      valid: false,
      error: `Minimum of ${loyalty.minPointsRedemption} loyalty points required for redemption.`,
      pointsRedeemed: 0,
      pointsDiscount: 0,
    };
  }

  const maxMonetaryDiscount = Math.round((subtotal * (loyalty.maxPointsRedemptionPercent / 100)) * 100) / 100;
  const requestedDiscount = Math.round(pointsRequested * loyalty.pointMonetaryValue * 100) / 100;

  if (requestedDiscount > maxMonetaryDiscount) {
    // Determine maximum allowed points
    const allowedPoints = Math.floor(maxMonetaryDiscount / loyalty.pointMonetaryValue);
    return {
      valid: false,
      error: `Points redemption cannot exceed ${loyalty.maxPointsRedemptionPercent}% of order value (max ₹${maxMonetaryDiscount}, or ${allowedPoints} points).`,
      pointsRedeemed: 0,
      pointsDiscount: 0,
    };
  }

  return {
    valid: true,
    pointsRedeemed: pointsRequested,
    pointsDiscount: requestedDiscount,
  };
}

/**
 * Atomically executes point redemption for an order.
 * Guaranteed concurrency safety via atomic MongoDB findOneAndUpdate with $gte guard.
 */
export async function redeemPointsForOrder(params: {
  userId: string | mongoose.Types.ObjectId;
  orderId: string | mongoose.Types.ObjectId;
  orderNo?: number | null;
  pointsToRedeem: number;
  pointsDiscount: number;
}): Promise<{ success: boolean; error?: string; balanceAfter?: number }> {
  const { userId, orderId, orderNo, pointsToRedeem, pointsDiscount } = params;

  if (pointsToRedeem <= 0) return { success: true };

  // Idempotency: check if redemption transaction already exists for this order
  const existingTx = await LoyaltyTransaction.findOne({
    referenceOrderId: orderId,
    type: "REDEEM",
  }).lean();

  if (existingTx) {
    return { success: true, balanceAfter: existingTx.balanceAfter };
  }

  // Atomic debit with balance check to prevent race condition negative balance
  const updatedUser = await User.findOneAndUpdate(
    {
      _id: userId,
      loyaltyPointsBalance: { $gte: pointsToRedeem },
    },
    {
      $inc: { loyaltyPointsBalance: -pointsToRedeem },
    },
    { new: true }
  ).select("email loyaltyPointsBalance");

  if (!updatedUser) {
    return {
      success: false,
      error: "Insufficient loyalty points balance or concurrent redemption detected.",
    };
  }

  // Append to immutable ledger
  await LoyaltyTransaction.create({
    userId,
    customerEmail: updatedUser.email,
    type: "REDEEM",
    pointsDelta: -pointsToRedeem,
    balanceAfter: updatedUser.loyaltyPointsBalance,
    referenceOrderId: orderId,
    referenceType: "order_redeemed",
    reason: `Redeemed ${pointsToRedeem} points on Order #${orderNo ?? orderId}`,
    metadata: {
      pointsDiscount,
      orderNo,
    },
  });

  return {
    success: true,
    balanceAfter: updatedUser.loyaltyPointsBalance,
  };
}

/**
 * Accrues points for an eligible qualified completed order.
 * Invariant: only paid or delivered sales earn points.
 */
export async function earnPointsForOrder(order: any): Promise<{ earned: number; transactionId?: any }> {
  if (!order) return { earned: 0 };

  const isPaid = isOrderPaidForFinance(order);
  if (!isPaid) {
    return { earned: 0 };
  }

  const userId = order.user?._id || order.user;
  if (!userId) {
    // Pure guest order without linked account cannot accrue points
    return { earned: 0 };
  }

  // Idempotency: check if EARN transaction already exists for this order
  const existing = await LoyaltyTransaction.findOne({
    referenceOrderId: order._id,
    type: "EARN",
  }).lean();

  if (existing) {
    return { earned: Math.abs(existing.pointsDelta), transactionId: existing._id };
  }

  const { loyalty, tiers } = await getLoyaltySettings();
  if (!loyalty.enabled) {
    return { earned: 0 };
  }

  // Base spend for points calculation
  let qualifyingSpend = Number(order.subtotal || 0);
  if (loyalty.earnPointsOnDiscountedSubtotal) {
    const totalDiscount = (Number(order.discount) || 0) + (Number(order.loyaltyPointsDiscount) || 0);
    qualifyingSpend = Math.max(0, qualifyingSpend - totalDiscount);
  }
  if (loyalty.earnPointsOnShipping) {
    qualifyingSpend += Number(order.shipping || 0);
  }

  if (qualifyingSpend <= 0) {
    return { earned: 0 };
  }

  // Calculate base points
  const basePoints = Math.floor((qualifyingSpend / loyalty.pointsEarningSpendUnit) * loyalty.pointsEarningRate);
  if (basePoints <= 0) {
    return { earned: 0 };
  }

  // Check user tier multiplier
  const user = await User.findById(userId).select("email loyaltyPointsBalance").lean();
  if (!user) return { earned: 0 };

  // Calculate tier from user's lifetime activity
  const { Order } = await import("../models/Order");
  const pastOrders = await Order.find({ user: userId }).select("total status payment").lean();
  const qualifiedPast = pastOrders.filter(isOrderPaidForFinance);
  const totalSpend = qualifiedPast.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
  const tier = calculateCustomerTier(totalSpend, qualifiedPast.length, tiers);

  const multiplier = tier.extraPointsMultiplier || 1;
  const finalPointsEarned = Math.round(basePoints * multiplier);

  if (finalPointsEarned <= 0) return { earned: 0 };

  const now = new Date();
  const expiresAt = new Date(now.getTime() + loyalty.pointsExpirationDays * 24 * 60 * 60 * 1000);

  // Atomically increment user balance
  const updatedUser = await User.findByIdAndUpdate(
    userId,
    { $inc: { loyaltyPointsBalance: finalPointsEarned } },
    { new: true }
  ).select("email loyaltyPointsBalance");

  if (!updatedUser) return { earned: 0 };

  // Write immutable ledger entry
  const tx = await LoyaltyTransaction.create({
    userId,
    customerEmail: updatedUser.email,
    type: "EARN",
    pointsDelta: finalPointsEarned,
    balanceAfter: updatedUser.loyaltyPointsBalance,
    referenceOrderId: order._id,
    referenceType: "order_earned",
    reason: `Earned ${finalPointsEarned} points for Order #${order.orderNo ?? order._id} (${tier.name})`,
    expiresAt,
    isExpired: false,
    metadata: {
      orderNo: order.orderNo,
      qualifyingSpend,
      basePoints,
      tier: tier.name,
      multiplier,
    },
  });

  // Record on order document if not already recorded
  if (order.loyaltyPointsEarned !== finalPointsEarned) {
    await Order.findByIdAndUpdate(order._id, { $set: { loyaltyPointsEarned: finalPointsEarned } });
  }

  return { earned: finalPointsEarned, transactionId: tx._id };
}

/**
 * Reverses loyalty points upon order cancellation or refund.
 * Invariant: Never deletes past transactions; creates atomic REVERSAL records.
 */
export async function reversePointsForOrder(order: any): Promise<{
  earnedPointsReversed: number;
  redeemedPointsRefunded: number;
}> {
  if (!order) return { earnedPointsReversed: 0, redeemedPointsRefunded: 0 };

  const userId = order.user?._id || order.user;
  if (!userId) return { earnedPointsReversed: 0, redeemedPointsRefunded: 0 };

  let earnedPointsReversed = 0;
  let redeemedPointsRefunded = 0;

  // 1. If points were earned on this order, reverse (debit) them
  const earnTx = await LoyaltyTransaction.findOne({
    referenceOrderId: order._id,
    type: "EARN",
  }).lean();

  if (earnTx) {
    const existingEarnReversal = await LoyaltyTransaction.findOne({
      referenceOrderId: order._id,
      type: "REVERSAL",
      referenceType: "order_cancelled",
      pointsDelta: { $lt: 0 },
    }).lean();

    if (!existingEarnReversal) {
      const pointsToReverse = Math.abs(earnTx.pointsDelta);
      // Debit back from user balance (floored at 0)
      const user = await User.findById(userId).select("email loyaltyPointsBalance");
      if (user) {
        const newBalance = Math.max(0, (user.loyaltyPointsBalance ?? 0) - pointsToReverse);
        user.loyaltyPointsBalance = newBalance;
        await user.save();

        await LoyaltyTransaction.create({
          userId,
          customerEmail: user.email,
          type: "REVERSAL",
          pointsDelta: -pointsToReverse,
          balanceAfter: newBalance,
          referenceOrderId: order._id,
          referenceType: "order_cancelled",
          reason: `Reversal of ${pointsToReverse} points earned on cancelled Order #${order.orderNo ?? order._id}`,
        });
        earnedPointsReversed = pointsToReverse;
      }
    }
  }

  // 2. If points were redeemed on this order, refund (credit) them back to the customer
  const redeemTx = await LoyaltyTransaction.findOne({
    referenceOrderId: order._id,
    type: "REDEEM",
  }).lean();

  if (redeemTx) {
    const existingRedeemReversal = await LoyaltyTransaction.findOne({
      referenceOrderId: order._id,
      type: "REVERSAL",
      referenceType: "order_cancelled",
      pointsDelta: { $gt: 0 },
    }).lean();

    if (!existingRedeemReversal) {
      const pointsToRefund = Math.abs(redeemTx.pointsDelta);
      const updatedUser = await User.findByIdAndUpdate(
        userId,
        { $inc: { loyaltyPointsBalance: pointsToRefund } },
        { new: true }
      ).select("email loyaltyPointsBalance");

      if (updatedUser) {
        await LoyaltyTransaction.create({
          userId,
          customerEmail: updatedUser.email,
          type: "REVERSAL",
          pointsDelta: pointsToRefund,
          balanceAfter: updatedUser.loyaltyPointsBalance,
          referenceOrderId: order._id,
          referenceType: "order_cancelled",
          reason: `Restoration of ${pointsToRefund} points redeemed on cancelled Order #${order.orderNo ?? order._id}`,
        });
        redeemedPointsRefunded = pointsToRefund;
      }
    }
  }

  return { earnedPointsReversed, redeemedPointsRefunded };
}

/**
 * Manually adjusts customer loyalty points from Admin with mandatory reason.
 */
export async function adminAdjustPoints(params: {
  userId: string | mongoose.Types.ObjectId;
  pointsDelta: number;
  reason: string;
  adminEmail: string;
}): Promise<{ success: boolean; newBalance: number }> {
  const { userId, pointsDelta, reason, adminEmail } = params;

  if (pointsDelta === 0) {
    throw new Error("Points adjustment must not be zero.");
  }
  if (!reason || !reason.trim()) {
    throw new Error("A clear explanatory reason is mandatory for manual loyalty adjustments.");
  }

  const type = pointsDelta > 0 ? "ADJUSTMENT_CREDIT" : "ADJUSTMENT_DEBIT";

  // Prevent negative balance
  let updatedUser: any;
  if (pointsDelta < 0) {
    const requiredMin = Math.abs(pointsDelta);
    updatedUser = await User.findOneAndUpdate(
      { _id: userId, loyaltyPointsBalance: { $gte: requiredMin } },
      { $inc: { loyaltyPointsBalance: pointsDelta } },
      { new: true }
    ).select("email loyaltyPointsBalance");

    if (!updatedUser) {
      throw new Error(`Insufficient customer points balance to debit ${requiredMin} points.`);
    }
  } else {
    updatedUser = await User.findByIdAndUpdate(
      userId,
      { $inc: { loyaltyPointsBalance: pointsDelta } },
      { new: true }
    ).select("email loyaltyPointsBalance");
  }

  if (!updatedUser) {
    throw new Error("Customer user not found.");
  }

  await LoyaltyTransaction.create({
    userId,
    customerEmail: updatedUser.email,
    type,
    pointsDelta,
    balanceAfter: updatedUser.loyaltyPointsBalance,
    referenceType: "admin_adjustment",
    reason: reason.trim(),
    metadata: {
      adminEmail,
    },
  });

  return { success: true, newBalance: updatedUser.loyaltyPointsBalance };
}

/**
 * Periodic expiry processor for points older than 180 days.
 */
export async function expireStalePoints(): Promise<{ expiredCount: number; pointsExpired: number }> {
  const now = new Date();
  const staleEarnTxs = await LoyaltyTransaction.find({
    type: "EARN",
    expiresAt: { $lte: now },
    isExpired: { $ne: true },
  }).limit(500);

  let expiredCount = 0;
  let pointsExpired = 0;

  for (const earnTx of staleEarnTxs) {
    const user = await User.findById(earnTx.userId).select("email loyaltyPointsBalance");
    if (!user) continue;

    // Deduct available points up to original delta
    const deductible = Math.min(user.loyaltyPointsBalance, Math.abs(earnTx.pointsDelta));
    if (deductible > 0) {
      user.loyaltyPointsBalance = Math.max(0, user.loyaltyPointsBalance - deductible);
      await user.save();

      await LoyaltyTransaction.create({
        userId: user._id,
        customerEmail: user.email,
        type: "EXPIRE",
        pointsDelta: -deductible,
        balanceAfter: user.loyaltyPointsBalance,
        referenceOrderId: earnTx.referenceOrderId,
        referenceType: "expiry",
        reason: `Expired ${deductible} points after 180 days (from ${earnTx.createdAt.toLocaleDateString("en-IN")})`,
      });
      pointsExpired += deductible;
    }

    earnTx.isExpired = true;
    await earnTx.save();
    expiredCount++;
  }

  return { expiredCount, pointsExpired };
}
