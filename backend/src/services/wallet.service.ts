import mongoose from "mongoose";
import { User } from "../models/User";
import { WalletTransaction } from "../models/WalletTransaction";

export async function getUserWalletBalance(userId: string | mongoose.Types.ObjectId): Promise<number> {
  const user = await User.findById(userId).select("walletBalance").lean();
  return Math.max(0, user?.walletBalance ?? 0);
}

export async function getWalletLedger(
  userId: string | mongoose.Types.ObjectId,
  limit = 50,
  skip = 0
) {
  return WalletTransaction.find({ userId })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate("referenceOrderId", "orderNo total status")
    .lean();
}

/**
 * Credits customer wallet atomically and creates immutable transaction record.
 */
export async function creditWallet(params: {
  userId: string | mongoose.Types.ObjectId;
  amount: number;
  reason: string;
  referenceOrderId?: string | mongoose.Types.ObjectId | null;
  adminActor?: string | null;
  metadata?: any;
}): Promise<{ success: boolean; newBalance: number }> {
  const { userId, amount, reason, referenceOrderId, adminActor, metadata } = params;

  if (typeof amount !== "number" || amount <= 0 || isNaN(amount)) {
    throw new Error("Wallet credit amount must be a positive number.");
  }
  if (!reason || !reason.trim()) {
    throw new Error("A clear explanatory reason is required for wallet credit.");
  }

  const cleanAmount = Math.round(amount * 100) / 100;

  const updatedUser = await User.findByIdAndUpdate(
    userId,
    { $inc: { walletBalance: cleanAmount } },
    { new: true }
  ).select("walletBalance");

  if (!updatedUser) {
    throw new Error("Customer user not found.");
  }

  await WalletTransaction.create({
    userId,
    type: "CREDIT",
    amount: cleanAmount,
    balanceAfter: updatedUser.walletBalance,
    referenceOrderId: referenceOrderId || undefined,
    reason: reason.trim(),
    adminActor: adminActor || undefined,
    metadata,
  });

  return { success: true, newBalance: updatedUser.walletBalance };
}

/**
 * Debits customer wallet atomically with $gte guard to prevent race condition negative balances.
 */
export async function debitWallet(params: {
  userId: string | mongoose.Types.ObjectId;
  amount: number;
  reason: string;
  referenceOrderId?: string | mongoose.Types.ObjectId | null;
  adminActor?: string | null;
  metadata?: any;
}): Promise<{ success: boolean; newBalance: number }> {
  const { userId, amount, reason, referenceOrderId, adminActor, metadata } = params;

  if (typeof amount !== "number" || amount <= 0 || isNaN(amount)) {
    throw new Error("Wallet debit amount must be a positive number.");
  }
  if (!reason || !reason.trim()) {
    throw new Error("A clear explanatory reason is required for wallet debit.");
  }

  const cleanAmount = Math.round(amount * 100) / 100;

  // Atomic check and debit to ensure balance cannot go negative under concurrent requests
  const updatedUser = await User.findOneAndUpdate(
    {
      _id: userId,
      walletBalance: { $gte: cleanAmount },
    },
    {
      $inc: { walletBalance: -cleanAmount },
    },
    { new: true }
  ).select("walletBalance");

  if (!updatedUser) {
    throw new Error(`Insufficient wallet balance or concurrent transaction detected. Cannot debit ₹${cleanAmount}.`);
  }

  await WalletTransaction.create({
    userId,
    type: "DEBIT",
    amount: -cleanAmount,
    balanceAfter: updatedUser.walletBalance,
    referenceOrderId: referenceOrderId || undefined,
    reason: reason.trim(),
    adminActor: adminActor || undefined,
    metadata,
  });

  return { success: true, newBalance: updatedUser.walletBalance };
}

/**
 * Admin manual wallet adjustment with mandatory reason and actor logging.
 */
export async function adminAdjustWallet(params: {
  userId: string | mongoose.Types.ObjectId;
  amount: number;
  direction: "credit" | "debit";
  reason: string;
  adminEmail: string;
}): Promise<{ success: boolean; newBalance: number }> {
  const { userId, amount, direction, reason, adminEmail } = params;

  if (typeof amount !== "number" || amount <= 0 || isNaN(amount)) {
    throw new Error("Adjustment amount must be a positive number.");
  }
  if (!reason || !reason.trim()) {
    throw new Error("A mandatory explanatory note is required for manual wallet adjustments.");
  }

  const cleanAmount = Math.round(amount * 100) / 100;

  if (direction === "credit") {
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $inc: { walletBalance: cleanAmount } },
      { new: true }
    ).select("walletBalance");

    if (!updatedUser) throw new Error("Customer user not found.");

    await WalletTransaction.create({
      userId,
      type: "ADJUSTMENT_CREDIT",
      amount: cleanAmount,
      balanceAfter: updatedUser.walletBalance,
      reason: reason.trim(),
      adminActor: adminEmail,
    });

    return { success: true, newBalance: updatedUser.walletBalance };
  } else {
    const updatedUser = await User.findOneAndUpdate(
      {
        _id: userId,
        walletBalance: { $gte: cleanAmount },
      },
      {
        $inc: { walletBalance: -cleanAmount },
      },
      { new: true }
    ).select("walletBalance");

    if (!updatedUser) {
      throw new Error(`Cannot debit ₹${cleanAmount}: Customer current wallet balance is insufficient.`);
    }

    await WalletTransaction.create({
      userId,
      type: "ADJUSTMENT_DEBIT",
      amount: -cleanAmount,
      balanceAfter: updatedUser.walletBalance,
      reason: reason.trim(),
      adminActor: adminEmail,
    });

    return { success: true, newBalance: updatedUser.walletBalance };
  }
}
