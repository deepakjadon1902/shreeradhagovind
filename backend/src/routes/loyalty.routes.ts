import { Router } from "express";
import { requireAuth, optionalAuth } from "../middleware/auth";
import { HttpError } from "../middleware/error";
import { Order } from "../models/Order";
import { User } from "../models/User";
import { isOrderPaidForFinance } from "./admin.routes";
import {
  getLoyaltySettings,
  getUserLoyaltyBalance,
  getLoyaltyLedger,
  calculateCustomerTier,
} from "../services/loyalty.service";

const r = Router();

// GET /api/loyalty/settings - Public loyalty config for storefront & checkout display
r.get("/settings", async (_req, res, next) => {
  try {
    const { loyalty, tiers } = await getLoyaltySettings();
    res.json({
      enabled: loyalty.enabled,
      pointMonetaryValue: loyalty.pointMonetaryValue,
      pointsEarningRate: loyalty.pointsEarningRate,
      pointsEarningSpendUnit: loyalty.pointsEarningSpendUnit,
      minPointsRedemption: loyalty.minPointsRedemption,
      maxPointsRedemptionPercent: loyalty.maxPointsRedemptionPercent,
      pointsCombineWithCoupons: loyalty.pointsCombineWithCoupons,
      pointsExpirationDays: loyalty.pointsExpirationDays,
      tiers,
    });
  } catch (e) {
    next(e);
  }
});

// GET /api/loyalty/me - Customer loyalty dashboard data
r.get("/me", requireAuth, async (req, res, next) => {
  try {
    const userId = req.user!.sub;
    const user = await User.findById(userId).select("name email loyaltyPointsBalance").lean();
    if (!user) throw new HttpError(404, "Customer not found");

    const [balance, ledger, { loyalty, tiers }, userOrders] = await Promise.all([
      getUserLoyaltyBalance(userId),
      getLoyaltyLedger(userId, 50),
      getLoyaltySettings(),
      Order.find({ user: userId }).select("total status payment").lean(),
    ]);

    const qualified = userOrders.filter(isOrderPaidForFinance);
    const qualifiedSpend = qualified.reduce((s, o) => s + (Number(o.total) || 0), 0);
    const tier = calculateCustomerTier(qualifiedSpend, qualified.length, tiers);

    res.json({
      pointsBalance: balance,
      monetaryValue: Math.round(balance * loyalty.pointMonetaryValue * 100) / 100,
      tier,
      config: {
        enabled: loyalty.enabled,
        minPointsRedemption: loyalty.minPointsRedemption,
        maxPointsRedemptionPercent: loyalty.maxPointsRedemptionPercent,
        pointMonetaryValue: loyalty.pointMonetaryValue,
      },
      qualifiedSpend,
      qualifiedOrdersCount: qualified.length,
      ledger: ledger.map((tx: any) => ({
        id: String(tx._id),
        type: tx.type,
        pointsDelta: tx.pointsDelta,
        balanceAfter: tx.balanceAfter,
        referenceType: tx.referenceType,
        reason: tx.reason,
        expiresAt: tx.expiresAt,
        createdAt: tx.createdAt,
        orderNo: tx.referenceOrderId?.orderNo,
      })),
    });
  } catch (e) {
    next(e);
  }
});

export default r;
