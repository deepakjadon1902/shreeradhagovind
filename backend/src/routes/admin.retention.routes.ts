import { Router } from "express";
import { z } from "zod";
import mongoose from "mongoose";
import { requireAuth, requireAdmin } from "../middleware/auth";
import { HttpError } from "../middleware/error";
import { Settings } from "../models/Settings";
import { User } from "../models/User";
import { Order } from "../models/Order";
import { Review } from "../models/Review";
import { Product } from "../models/Product";
import {
  getRetentionOverview,
  getRetentionCustomersList,
  getUnifiedCustomerMetrics,
} from "../services/retention.service";
import {
  getLoyaltySettings,
  adminAdjustPoints,
  getLoyaltyLedger,
} from "../services/loyalty.service";
import {
  adminAdjustWallet,
  getWalletLedger,
} from "../services/wallet.service";

const r = Router();
r.use(requireAuth, requireAdmin);

// GET /api/admin/retention/overview - Comprehensive retention dashboard overview
r.get("/overview", async (_req, res, next) => {
  try {
    const overview = await getRetentionOverview();
    res.json(overview);
  } catch (e) {
    next(e);
  }
});

// GET /api/admin/retention/customers - Paginated unified CRM customer list
r.get("/customers", async (req, res, next) => {
  try {
    const search = req.query.search ? String(req.query.search) : undefined;
    const segment = req.query.segment ? String(req.query.segment) : undefined;
    const tier = req.query.tier ? String(req.query.tier) : undefined;
    const isRegistered =
      req.query.isRegistered === "true" ? true : req.query.isRegistered === "false" ? false : undefined;
    const page = req.query.page ? Number(req.query.page) : 1;
    const limit = req.query.limit ? Number(req.query.limit) : 25;

    const result = await getRetentionCustomersList({
      search,
      segment,
      tier,
      isRegistered,
      page,
      limit,
    });
    res.json(result);
  } catch (e) {
    next(e);
  }
});

// GET /api/admin/retention/customers/:identifier - Single customer 360-degree retention detail
r.get("/customers/:identifier", async (req, res, next) => {
  try {
    const identifier = req.params.identifier;
    const isObjectId = mongoose.isValidObjectId(identifier);

    const lookup = isObjectId ? { userId: identifier } : { email: identifier };
    const metrics = await getUnifiedCustomerMetrics(lookup);

    if (!metrics) {
      throw new HttpError(404, "Customer not found");
    }

    // Also fetch customer's full order history, points ledger, and wallet ledger
    const cleanEmail = metrics.identifier.email;
    const userId = metrics.identifier.userId;

    const [orders, pointsLedger, walletLedger] = await Promise.all([
      Order.find({
        $or: [
          ...(userId ? [{ user: userId }] : []),
          ...(cleanEmail ? [{ customerEmail: cleanEmail }] : []),
        ],
      })
        .sort({ createdAt: -1 })
        .lean(),
      userId ? getLoyaltyLedger(userId, 50) : [],
      userId ? getWalletLedger(userId, 50) : [],
    ]);

    // Fetch wishlist product details if registered user has items
    let wishlistProducts: any[] = [];
    if (userId) {
      const u = await User.findById(userId).select("wishlist").lean();
      if (u?.wishlist && u.wishlist.length > 0) {
        wishlistProducts = await Product.find({ _id: { $in: u.wishlist } })
          .select("name price images category stock")
          .lean();
      }
    }

    res.json({
      metrics,
      orders: orders.map((o) => ({
        id: String(o._id),
        orderNo: o.orderNo,
        total: o.total,
        status: o.status,
        payment: o.payment,
        createdAt: o.createdAt,
        itemCount: (o.items || []).reduce((sum: number, it: any) => sum + (it.qty || 1), 0),
        discount: o.discount || 0,
        couponCode: o.couponCode || null,
        loyaltyPointsRedeemed: o.loyaltyPointsRedeemed || 0,
        loyaltyPointsDiscount: o.loyaltyPointsDiscount || 0,
      })),
      pointsLedger,
      walletLedger,
      wishlistProducts,
    });
  } catch (e) {
    next(e);
  }
});

// GET /api/admin/retention/settings - Configurable loyalty and tiers settings
r.get("/settings", async (_req, res, next) => {
  try {
    const settings = await getLoyaltySettings();
    res.json(settings);
  } catch (e) {
    next(e);
  }
});

// PATCH /api/admin/retention/settings - Update loyalty parameters and VIP tiers
r.patch("/settings", async (req, res, next) => {
  try {
    const body = z
      .object({
        loyalty: z
          .object({
            enabled: z.boolean().optional(),
            pointsEarningRate: z.number().min(0.1).max(100).optional(),
            pointsEarningSpendUnit: z.number().min(1).max(10000).optional(),
            pointMonetaryValue: z.number().min(0.01).max(1000).optional(),
            minPointsRedemption: z.number().min(0).max(10000).optional(),
            maxPointsRedemptionPercent: z.number().min(1).max(100).optional(),
            pointsCombineWithCoupons: z.boolean().optional(),
            pointsExpirationDays: z.number().int().min(1).max(1000).optional(),
            earnPointsOnShipping: z.boolean().optional(),
            earnPointsOnDiscountedSubtotal: z.boolean().optional(),
          })
          .optional(),
        tiers: z
          .array(
            z.object({
              id: z.string().min(1),
              name: z.string().min(1),
              minSpend: z.number().min(0),
              minOrders: z.number().min(0),
              rule: z.enum(["spend_or_orders", "spend_and_orders", "spend_only", "orders_only"]),
              badgeColor: z.string().optional(),
              perks: z.array(z.string()).optional(),
              extraPointsMultiplier: z.number().min(1).max(10).optional(),
            })
          )
          .optional(),
      })
      .parse(req.body);

    const updateOps: any = {};
    if (body.loyalty) {
      for (const [k, v] of Object.entries(body.loyalty)) {
        updateOps[`loyalty.${k}`] = v;
      }
    }
    if (body.tiers) {
      updateOps.tiers = body.tiers;
    }

    const updated = await Settings.findOneAndUpdate(
      { key: "global" },
      { $set: updateOps },
      { new: true, upsert: true }
    ).lean();

    res.json({
      ok: true,
      message: "Retention & Loyalty configuration saved successfully.",
      settings: {
        loyalty: (updated as any).loyalty,
        tiers: (updated as any).tiers,
      },
    });
  } catch (e) {
    next(e);
  }
});

// POST /api/admin/retention/loyalty/adjust - Admin manual point adjustment with mandatory reason
r.post("/loyalty/adjust", async (req, res, next) => {
  try {
    const { userId, pointsDelta, reason } = z
      .object({
        userId: z.string().min(1),
        pointsDelta: z.number().int().refine((val) => val !== 0, "Adjustment cannot be 0"),
        reason: z.string().trim().min(3, "Reason must be at least 3 characters"),
      })
      .parse(req.body);

    const adminEmail = (req.user as any)?.email || "admin";
    const result = await adminAdjustPoints({
      userId,
      pointsDelta,
      reason,
      adminEmail,
    });

    res.json({ ok: true, ...result });
  } catch (e) {
    next(e);
  }
});

// POST /api/admin/retention/wallet/adjust - Admin manual wallet adjustment with mandatory reason
r.post("/wallet/adjust", async (req, res, next) => {
  try {
    const { userId, amount, direction, reason } = z
      .object({
        userId: z.string().min(1),
        amount: z.number().min(0.01),
        direction: z.enum(["credit", "debit"]),
        reason: z.string().trim().min(3, "Reason must be at least 3 characters"),
      })
      .parse(req.body);

    const adminEmail = (req.user as any)?.email || "admin";
    const result = await adminAdjustWallet({
      userId,
      amount,
      direction,
      reason,
      adminEmail,
    });

    res.json({ ok: true, ...result });
  } catch (e) {
    next(e);
  }
});

export default r;
