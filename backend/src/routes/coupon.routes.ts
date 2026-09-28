import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import mongoose from "mongoose";
import { Coupon, type ICoupon } from "../models/Coupon";
import { CouponRedemption } from "../models/CouponRedemption";
import { Order } from "../models/Order";
import {
  validateAndCalculateCoupon,
  normalizeCouponCode,
} from "../services/coupon.service";
import { optionalAuth, requireAuth, requireAdmin } from "../middleware/auth";
import { HttpError } from "../middleware/error";

// ==========================================
// 1. CUSTOMER PUBLIC COUPON ROUTES
// ==========================================
const customerRouter = Router();

const validateCouponSchema = z.object({
  couponCode: z.string().min(1, "Coupon code is required"),
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        qty: z.number().int().min(1).max(20),
      })
    )
    .min(1, "Cart must contain at least 1 item"),
  paymentMethod: z.enum(["razorpay", "cod", "online"]).optional(),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
});

/**
 * POST /api/coupons/validate
 * Validates a coupon code against current cart items, live product prices, and limits.
 * Returns calculated discount, shipping, and item breakdown.
 */
customerRouter.post("/validate", optionalAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = validateCouponSchema.parse(req.body);

    const calculation = await validateAndCalculateCoupon({
      couponCode: body.couponCode,
      items: body.items,
      paymentMethod: body.paymentMethod,
      customerInfo: {
        userId: req.user?.sub,
        email: body.email,
        phone: body.phone,
      },
    });

    if (!calculation.valid) {
      return res.status(400).json({
        ok: false,
        error: calculation.error || "Coupon could not be applied.",
        grossSubtotal: calculation.grossSubtotal,
        shipping: calculation.shipping,
        total: calculation.total,
      });
    }

    res.json({
      ok: true,
      valid: true,
      coupon: {
        code: calculation.coupon!.code,
        title: calculation.coupon!.title,
        description: calculation.coupon!.description,
        discountType: calculation.coupon!.discountType,
        discountValue: calculation.coupon!.discountValue,
        maxDiscountAmount: calculation.coupon!.maxDiscountAmount,
        minOrderValue: calculation.coupon!.minOrderValue,
        allowedPaymentMethods: calculation.coupon!.allowedPaymentMethods || "both",
      },
      grossSubtotal: calculation.grossSubtotal,
      eligibleSubtotal: calculation.eligibleSubtotal,
      discount: calculation.discount,
      shipping: calculation.shipping,
      isFreeShipping: calculation.isFreeShipping,
      total: calculation.total,
    });
  } catch (err) {
    next(err);
  }
});

// ==========================================
// 2. ADMIN COUPON ROUTES
// ==========================================
export const adminCouponRouter = Router();
adminCouponRouter.use(requireAuth, requireAdmin);

const createCouponSchema = z.object({
  code: z.string().min(2, "Code must be at least 2 characters").max(30),
  title: z.string().min(2, "Title is required").max(100),
  description: z.string().max(500).optional().default(""),
  discountType: z.enum(["percentage", "flat", "free_shipping"]),
  discountValue: z.number().min(0, "Discount value must be non-negative"),
  maxDiscountAmount: z.number().min(0).nullable().optional(),
  minOrderValue: z.number().min(0).nullable().optional(),
  startDate: z.string().datetime().nullable().optional(),
  endDate: z.string().datetime().nullable().optional(),
  isActive: z.boolean().optional().default(true),
  usageLimitTotal: z.number().int().min(1).nullable().optional(),
  usageLimitPerUser: z.number().int().min(1).nullable().optional(),
  applicableProductIds: z.array(z.string()).optional().default([]),
  applicableCategoryIds: z.array(z.string()).optional().default([]),
  allowedPaymentMethods: z.enum(["both", "online", "cod"]).optional().default("both"),
});

const updateCouponSchema = createCouponSchema.partial();

/**
 * GET /api/admin/coupons
 * Lists all coupons with search, status filters, and redemption stats.
 */
adminCouponRouter.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
    const filter = typeof req.query.filter === "string" ? req.query.filter : "all";

    const query: any = {};

    if (search) {
      query.$or = [
        { code: { $regex: search, $options: "i" } },
        { title: { $regex: search, $options: "i" } },
      ];
    }

    const now = new Date();
    if (filter === "active") {
      query.isActive = true;
      query.$and = [
        { $or: [{ startDate: null }, { startDate: { $lte: now } }] },
        { $or: [{ endDate: null }, { endDate: { $gte: now } }] },
      ];
    } else if (filter === "inactive") {
      query.isActive = false;
    } else if (filter === "expired") {
      query.endDate = { $lt: now };
    }

    const coupons = await Coupon.find(query)
      .sort({ createdAt: -1 })
      .populate("applicableProductIds", "name price image");

    // Aggregate summary stats
    const totalCoupons = await Coupon.countDocuments();
    const activeCoupons = await Coupon.countDocuments({
      isActive: true,
      $and: [
        { $or: [{ startDate: null }, { startDate: { $lte: now } }] },
        { $or: [{ endDate: null }, { endDate: { $gte: now } }] },
      ],
    });
    const totalRedemptions = await CouponRedemption.countDocuments({ status: "active" });

    res.json({
      coupons,
      stats: {
        totalCoupons,
        activeCoupons,
        totalRedemptions,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/admin/coupons/:id
 * Fetches single coupon details and its recent redemptions.
 */
adminCouponRouter.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const coupon = await Coupon.findById(req.params.id).populate(
      "applicableProductIds",
      "name price image"
    );
    if (!coupon) throw new HttpError(404, "Coupon not found");

    const redemptions = await CouponRedemption.find({ couponId: coupon._id })
      .sort({ createdAt: -1 })
      .limit(50);

    res.json({ coupon, redemptions });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/admin/coupons
 * Creates a new coupon.
 */
adminCouponRouter.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = createCouponSchema.parse(req.body);
    const normalizedCode = normalizeCouponCode(data.code);

    const existing = await Coupon.findOne({ code: normalizedCode });
    if (existing) {
      throw new HttpError(409, `A coupon with code "${normalizedCode}" already exists.`);
    }

    if (data.startDate && data.endDate && new Date(data.startDate) > new Date(data.endDate)) {
      throw new HttpError(400, "Start date cannot be after end date.");
    }

    const validProductIds = (data.applicableProductIds || [])
      .filter((id) => mongoose.Types.ObjectId.isValid(id))
      .map((id) => new mongoose.Types.ObjectId(id));

    const coupon = await Coupon.create({
      ...data,
      code: normalizedCode,
      applicableProductIds: validProductIds,
      startDate: data.startDate ? new Date(data.startDate) : null,
      endDate: data.endDate ? new Date(data.endDate) : null,
      createdBy: req.user?.sub ? new mongoose.Types.ObjectId(req.user.sub) : null,
    });

    res.status(201).json({ coupon });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/admin/coupons/:id
 * Updates an existing coupon.
 */
adminCouponRouter.patch("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = updateCouponSchema.parse(req.body);
    const coupon = await Coupon.findById(req.params.id);
    if (!coupon) throw new HttpError(404, "Coupon not found");

    if (data.code) {
      const normalizedCode = normalizeCouponCode(data.code);
      if (normalizedCode !== coupon.code) {
        const existing = await Coupon.findOne({
          code: normalizedCode,
          _id: { $ne: coupon._id },
        });
        if (existing) {
          throw new HttpError(409, `A coupon with code "${normalizedCode}" already exists.`);
        }
        coupon.code = normalizedCode;
      }
    }

    if (data.title !== undefined) coupon.title = data.title;
    if (data.description !== undefined) coupon.description = data.description;
    if (data.discountType !== undefined) coupon.discountType = data.discountType;
    if (data.discountValue !== undefined) coupon.discountValue = data.discountValue;
    if (data.maxDiscountAmount !== undefined) coupon.maxDiscountAmount = data.maxDiscountAmount;
    if (data.minOrderValue !== undefined) coupon.minOrderValue = data.minOrderValue;
    if (data.startDate !== undefined)
      coupon.startDate = data.startDate ? new Date(data.startDate) : null;
    if (data.endDate !== undefined)
      coupon.endDate = data.endDate ? new Date(data.endDate) : null;
    if (data.isActive !== undefined) coupon.isActive = data.isActive;
    if (data.usageLimitTotal !== undefined) coupon.usageLimitTotal = data.usageLimitTotal;
    if (data.usageLimitPerUser !== undefined) coupon.usageLimitPerUser = data.usageLimitPerUser;
    if (data.allowedPaymentMethods !== undefined)
      coupon.allowedPaymentMethods = data.allowedPaymentMethods;

    if (data.applicableProductIds !== undefined) {
      coupon.applicableProductIds = data.applicableProductIds
        .filter((id) => mongoose.Types.ObjectId.isValid(id))
        .map((id) => new mongoose.Types.ObjectId(id));
    }
    if (data.applicableCategoryIds !== undefined) {
      coupon.applicableCategoryIds = data.applicableCategoryIds;
    }

    if (coupon.startDate && coupon.endDate && coupon.startDate > coupon.endDate) {
      throw new HttpError(400, "Start date cannot be after end date.");
    }

    await coupon.save();
    res.json({ coupon });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/admin/coupons/:id/toggle
 * Toggles coupon active/inactive status.
 */
adminCouponRouter.patch("/:id/toggle", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const coupon = await Coupon.findById(req.params.id);
    if (!coupon) throw new HttpError(404, "Coupon not found");

    coupon.isActive = !coupon.isActive;
    await coupon.save();

    res.json({ coupon, message: `Coupon is now ${coupon.isActive ? "active" : "inactive"}.` });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/admin/coupons/:id
 * Safe deletion: If redemptions exist, archives/deactivates the coupon to preserve order history.
 * If zero redemptions, permanently deletes the document.
 */
adminCouponRouter.delete("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const coupon = await Coupon.findById(req.params.id);
    if (!coupon) throw new HttpError(404, "Coupon not found");

    const redemptionCount = await CouponRedemption.countDocuments({ couponId: coupon._id });
    const orderCount = await Order.countDocuments({
      $or: [{ couponId: coupon._id }, { couponCode: coupon.code }],
    });

    if (redemptionCount > 0 || coupon.usedCount > 0 || orderCount > 0) {
      coupon.isActive = false;
      await coupon.save();
      return res.json({
        ok: true,
        archived: true,
        message: `Coupon has historical redemptions or associated orders (${redemptionCount + orderCount} records) and was deactivated instead of deleted to protect order history.`,
      });
    }

    await Coupon.findByIdAndDelete(coupon._id);
    res.json({ ok: true, deleted: true, message: "Coupon deleted successfully." });
  } catch (err) {
    next(err);
  }
});

export default customerRouter;
