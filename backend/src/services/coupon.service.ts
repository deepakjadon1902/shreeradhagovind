import mongoose, { Types } from "mongoose";
import { Coupon, type ICoupon } from "../models/Coupon";
import { CouponRedemption } from "../models/CouponRedemption";
import { Product } from "../models/Product";
import { Settings } from "../models/Settings";
import { HttpError } from "../middleware/error";

export function normalizeCouponCode(code?: string): string {
  return (code || "").trim().toUpperCase();
}

export function normalizeEmail(email?: string): string {
  return (email || "").trim().toLowerCase();
}

export function normalizePhone(phone?: string): string {
  return (phone || "").replace(/\D/g, "").slice(-10);
}

export interface CouponItemInput {
  productId: string | Types.ObjectId;
  qty: number;
}

export interface CouponCustomerInfo {
  userId?: string | Types.ObjectId | null;
  email?: string;
  phone?: string;
}

export interface LineItemBreakdown {
  productId: string;
  name: string;
  image: string;
  price: number;
  qty: number;
  lineGross: number;
  isEligible: boolean;
  allocatedDiscount: number;
  discountedLineTotal: number;
  hsnCode: string;
  gstRate: number;
  gstInclusive: boolean;
  taxableAmount: number;
  gstAmount: number;
  comboComponents?: any[];
}

export interface CouponCalculationResult {
  valid: boolean;
  error?: string;
  coupon?: ICoupon;
  grossSubtotal: number;
  eligibleSubtotal: number;
  discount: number;
  shipping: number;
  isFreeShipping: boolean;
  freeShipping: boolean;
  total: number;
  itemBreakdown: LineItemBreakdown[];
  lineItemDiscounts: Map<string, number>;
}

/**
 * Validates a coupon and recalculates all pricing, discount, shipping,
 * and line-item GST apportionment from live database records.
 * Single source of truth for both payment and order placement.
 */
export async function validateAndCalculateCoupon(params: {
  couponCode?: string;
  code?: string;
  items: CouponItemInput[];
  paymentMethod?: "razorpay" | "cod" | string;
  customerInfo?: CouponCustomerInfo;
  customerEmail?: string;
  customerPhone?: string;
  userId?: string;
  customSettings?: { freeShipThreshold: number; shippingFee: number };
}): Promise<CouponCalculationResult> {
  const couponCode = params.couponCode || params.code;
  const customerInfo = params.customerInfo || {
    email: params.customerEmail,
    phone: params.customerPhone,
    userId: params.userId,
  };
  const { items, paymentMethod, customSettings } = params;

  const toResult = (res: {
    valid: boolean;
    error?: string;
    coupon?: ICoupon;
    grossSubtotal: number;
    eligibleSubtotal: number;
    discount: number;
    shipping: number;
    isFreeShipping: boolean;
    total: number;
    itemBreakdown: LineItemBreakdown[];
  }): CouponCalculationResult => ({
    ...res,
    freeShipping: res.isFreeShipping,
    lineItemDiscounts: new Map(res.itemBreakdown.map((i) => [i.productId, i.allocatedDiscount])),
  });

  // 1. Fetch store global settings
  let freeShipThreshold = 999;
  let shippingFee = 49;
  if (customSettings) {
    freeShipThreshold = customSettings.freeShipThreshold;
    shippingFee = customSettings.shippingFee;
  } else {
    const settings =
      (await Settings.findOne({ key: "global" })) ??
      (await Settings.create({ key: "global" }));
    freeShipThreshold = settings.freeShipThreshold ?? 999;
    shippingFee = settings.shippingFee ?? 49;
  }

  // 2. Fetch live products from DB
  const validProductIds = items
    .map((i) => String(i.productId))
    .filter((id) => mongoose.Types.ObjectId.isValid(id));

  if (validProductIds.length !== items.length) {
    return toResult({
      valid: false,
      error: "One or more product IDs in your cart are invalid.",
      grossSubtotal: 0,
      eligibleSubtotal: 0,
      discount: 0,
      shipping: shippingFee,
      isFreeShipping: false,
      total: shippingFee,
      itemBreakdown: [],
    });
  }

  const products = await Product.find({
    _id: { $in: validProductIds },
    isActive: { $ne: false },
  });

  if (products.length !== validProductIds.length) {
    return toResult({
      valid: false,
      error: "One or more products in your cart are inactive or unavailable.",
      grossSubtotal: 0,
      eligibleSubtotal: 0,
      discount: 0,
      shipping: shippingFee,
      isFreeShipping: false,
      total: shippingFee,
      itemBreakdown: [],
    });
  }

  // Map products for fast lookup
  const productMap = new Map(products.map((p) => [String(p._id), p]));

  // Calculate gross subtotal
  let grossSubtotal = 0;
  for (const item of items) {
    const p = productMap.get(String(item.productId))!;
    grossSubtotal += p.price * item.qty;
  }
  grossSubtotal = Math.round(grossSubtotal * 100) / 100;

  const normalizedCode = normalizeCouponCode(couponCode);

  // If no coupon was provided, return standard pricing calculation
  if (!normalizedCode) {
    const shipping = grossSubtotal >= freeShipThreshold ? 0 : shippingFee;
    const total = Math.round((grossSubtotal + shipping) * 100) / 100;

    const itemBreakdown: LineItemBreakdown[] = items.map((item) => {
      const p = productMap.get(String(item.productId))!;
      const lineGross = p.price * item.qty;
      const gstRate = Number(p.gstRate ?? 0);
      const gstInclusive = p.gstInclusive !== false;

      let taxableAmount = lineGross;
      let gstAmount = 0;
      if (gstRate > 0) {
        if (gstInclusive) {
          taxableAmount = Math.round((lineGross / (1 + gstRate / 100)) * 100) / 100;
          gstAmount = Math.round((lineGross - taxableAmount) * 100) / 100;
        } else {
          taxableAmount = lineGross;
          gstAmount = Math.round((lineGross * (gstRate / 100)) * 100) / 100;
        }
      }

      // Combo component handling
      let comboSnapshot: any[] | undefined = undefined;
      if (Array.isArray(p.comboComponents) && p.comboComponents.length > 0) {
        const totalBaseValue = p.comboComponents.reduce(
          (sum: number, c: any) => sum + (Number(c.baseValue) || 0) * (Number(c.qty) || 1),
          0
        );
        comboSnapshot = p.comboComponents.map((c: any) => {
          const cQty = (Number(c.qty) || 1) * item.qty;
          const cRate = Number(c.gstRate) || 0;
          const cInclusive = c.gstInclusive !== false;
          const compBase = (Number(c.baseValue) || 0) * (Number(c.qty) || 1);
          const ratio = totalBaseValue > 0 ? compBase / totalBaseValue : 1 / p.comboComponents.length;
          const allocatedPrice = Math.round(lineGross * ratio * 100) / 100;

          let compTaxable = allocatedPrice;
          let compGst = 0;
          if (cRate > 0) {
            if (cInclusive) {
              compTaxable = Math.round((allocatedPrice / (1 + cRate / 100)) * 100) / 100;
              compGst = Math.round((allocatedPrice - compTaxable) * 100) / 100;
            } else {
              compTaxable = allocatedPrice;
              compGst = Math.round((allocatedPrice * (cRate / 100)) * 100) / 100;
            }
          }
          return {
            name: c.name,
            qty: cQty,
            hsnCode: c.hsnCode || "",
            gstRate: cRate,
            gstInclusive: cInclusive,
            costPrice: typeof c.costPrice === "number" && c.costPrice > 0 ? Number(c.costPrice) : undefined,
            baseValue: Number(c.baseValue) || 0,
            allocatedPrice,
            taxableAmount: compTaxable,
            gstAmount: compGst,
          };
        });
        taxableAmount = Math.round(comboSnapshot.reduce((s, c) => s + c.taxableAmount, 0) * 100) / 100;
        gstAmount = Math.round(comboSnapshot.reduce((s, c) => s + c.gstAmount, 0) * 100) / 100;
      }

      return {
        productId: String(p._id),
        name: p.name,
        image: p.image || "",
        price: p.price,
        qty: item.qty,
        lineGross,
        isEligible: false,
        allocatedDiscount: 0,
        discountedLineTotal: lineGross,
        hsnCode: p.hsnCode || "",
        gstRate,
        gstInclusive,
        taxableAmount,
        gstAmount,
        comboComponents: comboSnapshot,
      };
    });

    return toResult({
      valid: true,
      grossSubtotal,
      eligibleSubtotal: 0,
      discount: 0,
      shipping,
      isFreeShipping: false,
      total,
      itemBreakdown,
    });
  }

  // 3. Find coupon by code
  const coupon = await Coupon.findOne({ code: normalizedCode });
  if (!coupon) {
    return toResult({
      valid: false,
      error: `Coupon code "${normalizedCode}" is invalid.`,
      grossSubtotal,
      eligibleSubtotal: 0,
      discount: 0,
      shipping: grossSubtotal >= freeShipThreshold ? 0 : shippingFee,
      isFreeShipping: false,
      total: Math.round((grossSubtotal + (grossSubtotal >= freeShipThreshold ? 0 : shippingFee)) * 100) / 100,
      itemBreakdown: [],
    });
  }

  // 4. Validate coupon active status
  if (!coupon.isActive) {
    return toResult({
      valid: false,
      error: `Coupon "${coupon.code}" is currently disabled.`,
      coupon,
      grossSubtotal,
      eligibleSubtotal: 0,
      discount: 0,
      shipping: grossSubtotal >= freeShipThreshold ? 0 : shippingFee,
      isFreeShipping: false,
      total: Math.round((grossSubtotal + (grossSubtotal >= freeShipThreshold ? 0 : shippingFee)) * 100) / 100,
      itemBreakdown: [],
    });
  }

  // 5. Validate dates
  const now = new Date();
  if (coupon.startDate && now < coupon.startDate) {
    return toResult({
      valid: false,
      error: `Coupon "${coupon.code}" is not yet active. It begins on ${coupon.startDate.toLocaleDateString("en-IN")}.`,
      coupon,
      grossSubtotal,
      eligibleSubtotal: 0,
      discount: 0,
      shipping: grossSubtotal >= freeShipThreshold ? 0 : shippingFee,
      isFreeShipping: false,
      total: Math.round((grossSubtotal + (grossSubtotal >= freeShipThreshold ? 0 : shippingFee)) * 100) / 100,
      itemBreakdown: [],
    });
  }

  const expiry = coupon.endDate || coupon.expiryDate;
  if (expiry && now > expiry) {
    return toResult({
      valid: false,
      error: `Coupon "${coupon.code}" expired on ${expiry.toLocaleDateString("en-IN")}.`,
      coupon,
      grossSubtotal,
      eligibleSubtotal: 0,
      discount: 0,
      shipping: grossSubtotal >= freeShipThreshold ? 0 : shippingFee,
      isFreeShipping: false,
      total: Math.round((grossSubtotal + (grossSubtotal >= freeShipThreshold ? 0 : shippingFee)) * 100) / 100,
      itemBreakdown: [],
    });
  }

  // 6. Validate global usage limit
  if (
    typeof coupon.usageLimitTotal === "number" &&
    coupon.usageLimitTotal > 0 &&
    coupon.usedCount >= coupon.usageLimitTotal
  ) {
    return toResult({
      valid: false,
      error: `Coupon "${coupon.code}" has reached its maximum usage limit.`,
      coupon,
      grossSubtotal,
      eligibleSubtotal: 0,
      discount: 0,
      shipping: grossSubtotal >= freeShipThreshold ? 0 : shippingFee,
      isFreeShipping: false,
      total: Math.round((grossSubtotal + (grossSubtotal >= freeShipThreshold ? 0 : shippingFee)) * 100) / 100,
      itemBreakdown: [],
    });
  }

  // 7. Validate per-customer usage limit
  if (
    typeof coupon.usageLimitPerUser === "number" &&
    coupon.usageLimitPerUser > 0 &&
    customerInfo
  ) {
    const normEmail = normalizeEmail(customerInfo.email);
    const normPhone = normalizePhone(customerInfo.phone);
    const userOr: any[] = [];

    if (customerInfo.userId && mongoose.Types.ObjectId.isValid(customerInfo.userId)) {
      userOr.push({ userId: customerInfo.userId });
    }
    if (normEmail) {
      userOr.push({ customerEmail: normEmail });
    }
    if (normPhone) {
      userOr.push({ customerPhone: normPhone });
    }

    if (userOr.length > 0) {
      const existingUserUses = await CouponRedemption.countDocuments({
        couponId: coupon._id,
        status: "active",
        $or: userOr,
      });

      if (existingUserUses >= coupon.usageLimitPerUser) {
        return toResult({
          valid: false,
          error: `You have already used coupon "${coupon.code}" the maximum allowed number of times (${coupon.usageLimitPerUser}).`,
          coupon,
          grossSubtotal,
          eligibleSubtotal: 0,
          discount: 0,
          shipping: grossSubtotal >= freeShipThreshold ? 0 : shippingFee,
          isFreeShipping: false,
          total: Math.round((grossSubtotal + (grossSubtotal >= freeShipThreshold ? 0 : shippingFee)) * 100) / 100,
          itemBreakdown: [],
        });
      }
    }
  }

  // 8. Validate allowed payment method
  const allowedMethod: "both" | "online" | "cod" = coupon.allowedPaymentMethods || "both";
  if (paymentMethod) {
    const isOnline = paymentMethod === "razorpay" || paymentMethod === "online";
    const isCod = paymentMethod === "cod";

    if (allowedMethod === "online" && isCod) {
      return toResult({
        valid: false,
        error: `Coupon "${coupon.code}" is valid only for online prepaid orders.`,
        coupon,
        grossSubtotal,
        eligibleSubtotal: 0,
        discount: 0,
        shipping: grossSubtotal >= freeShipThreshold ? 0 : shippingFee,
        isFreeShipping: false,
        total: Math.round((grossSubtotal + (grossSubtotal >= freeShipThreshold ? 0 : shippingFee)) * 100) / 100,
        itemBreakdown: [],
      });
    }

    if (allowedMethod === "cod" && isOnline) {
      return toResult({
        valid: false,
        error: `Coupon "${coupon.code}" is valid only for Cash on Delivery (COD) orders.`,
        coupon,
        grossSubtotal,
        eligibleSubtotal: 0,
        discount: 0,
        shipping: grossSubtotal >= freeShipThreshold ? 0 : shippingFee,
        isFreeShipping: false,
        total: Math.round((grossSubtotal + (grossSubtotal >= freeShipThreshold ? 0 : shippingFee)) * 100) / 100,
        itemBreakdown: [],
      });
    }
  }

  // 9. Determine product & category targeting
  // Rule:
  // - If neither applicableProductIds nor applicableCategoryIds are configured: ALL products are eligible.
  // - If either or both are configured: an item is eligible if its ID matches applicableProductIds OR its category matches applicableCategoryIds.
  const hasTargeting =
    (coupon.applicableProductIds && coupon.applicableProductIds.length > 0) ||
    (coupon.applicableCategoryIds && coupon.applicableCategoryIds.length > 0);

  const targetedProductIds = new Set(
    (coupon.applicableProductIds || []).map((id) => String(id))
  );
  const targetedCategories = new Set(
    (coupon.applicableCategoryIds || []).map((cat) => cat.toLowerCase().trim())
  );

  let eligibleSubtotal = 0;
  const eligibleItemIndices: number[] = [];

  const tempBreakdown = items.map((item, idx) => {
    const p = productMap.get(String(item.productId))!;
    const lineGross = p.price * item.qty;

    let isEligible = true;
    if (hasTargeting) {
      const pid = String(p._id);
      const cat = (p.category || "").toLowerCase().trim();
      const productMatched = targetedProductIds.has(pid);
      const categoryMatched = targetedCategories.has(cat);
      isEligible = productMatched || categoryMatched;
    }

    if (isEligible) {
      eligibleSubtotal += lineGross;
      eligibleItemIndices.push(idx);
    }

    return {
      product: p,
      item,
      lineGross,
      isEligible,
    };
  });

  eligibleSubtotal = Math.round(eligibleSubtotal * 100) / 100;

  if (eligibleSubtotal === 0) {
    return toResult({
      valid: false,
      error: `None of the items in your cart are eligible for coupon "${coupon.code}".`,
      coupon,
      grossSubtotal,
      eligibleSubtotal: 0,
      discount: 0,
      shipping: grossSubtotal >= freeShipThreshold ? 0 : shippingFee,
      isFreeShipping: false,
      total: Math.round((grossSubtotal + (grossSubtotal >= freeShipThreshold ? 0 : shippingFee)) * 100) / 100,
      itemBreakdown: [],
    });
  }

  // 10. Check minimum order value on eligible items
  if (
    typeof coupon.minOrderValue === "number" &&
    coupon.minOrderValue > 0 &&
    eligibleSubtotal < coupon.minOrderValue
  ) {
    return toResult({
      valid: false,
      error: `Eligible cart subtotal (₹${eligibleSubtotal}) is below the minimum order value of ₹${coupon.minOrderValue} required for coupon "${coupon.code}".`,
      coupon,
      grossSubtotal,
      eligibleSubtotal,
      discount: 0,
      shipping: grossSubtotal >= freeShipThreshold ? 0 : shippingFee,
      isFreeShipping: false,
      total: Math.round((grossSubtotal + (grossSubtotal >= freeShipThreshold ? 0 : shippingFee)) * 100) / 100,
      itemBreakdown: [],
    });
  }

  // 11. Calculate discount
  let rawDiscount = 0;
  let isFreeShipping = false;

  if (coupon.discountType === "percentage") {
    rawDiscount = Math.round(eligibleSubtotal * (coupon.discountValue / 100) * 100) / 100;
    if (
      typeof coupon.maxDiscountAmount === "number" &&
      coupon.maxDiscountAmount > 0 &&
      rawDiscount > coupon.maxDiscountAmount
    ) {
      rawDiscount = coupon.maxDiscountAmount;
    }
  } else if (coupon.discountType === "flat") {
    rawDiscount = coupon.discountValue;
  } else if (coupon.discountType === "free_shipping") {
    rawDiscount = 0;
    isFreeShipping = true;
  }

  // Cap discount so it cannot exceed eligible subtotal
  const discount = Math.max(0, Math.min(rawDiscount, eligibleSubtotal));

  // 12. Evaluate shipping
  let shipping = 0;
  if (isFreeShipping) {
    shipping = 0;
  } else {
    // Free shipping threshold is strictly evaluated against GROSS subtotal before discount
    shipping = grossSubtotal >= freeShipThreshold ? 0 : shippingFee;
  }

  // 13. Final total
  const total = Math.max(0, Math.round((grossSubtotal - discount + shipping) * 100) / 100);

  // 14. Apportion discount across eligible line items and recompute GST
  let accumulatedDiscount = 0;
  const itemBreakdown: LineItemBreakdown[] = tempBreakdown.map((tb, idx) => {
    const { product: p, item, lineGross, isEligible } = tb;

    let allocatedDiscount = 0;
    if (isEligible && discount > 0 && eligibleSubtotal > 0) {
      const isLastEligible = idx === eligibleItemIndices[eligibleItemIndices.length - 1];
      if (isLastEligible) {
        allocatedDiscount = Math.round((discount - accumulatedDiscount) * 100) / 100;
      } else {
        const ratio = lineGross / eligibleSubtotal;
        allocatedDiscount = Math.round(discount * ratio * 100) / 100;
        accumulatedDiscount += allocatedDiscount;
      }
    }

    const discountedLineTotal = Math.max(0, Math.round((lineGross - allocatedDiscount) * 100) / 100);
    const gstRate = Number(p.gstRate ?? 0);
    const gstInclusive = p.gstInclusive !== false;

    let taxableAmount = discountedLineTotal;
    let gstAmount = 0;
    if (gstRate > 0) {
      if (gstInclusive) {
        taxableAmount = Math.round((discountedLineTotal / (1 + gstRate / 100)) * 100) / 100;
        gstAmount = Math.round((discountedLineTotal - taxableAmount) * 100) / 100;
      } else {
        taxableAmount = discountedLineTotal;
        gstAmount = Math.round((discountedLineTotal * (gstRate / 100)) * 100) / 100;
      }
    }

    // Combo component handling with apportioned discount
    let comboSnapshot: any[] | undefined = undefined;
    if (Array.isArray(p.comboComponents) && p.comboComponents.length > 0) {
      const totalBaseValue = p.comboComponents.reduce(
        (sum: number, c: any) => sum + (Number(c.baseValue) || 0) * (Number(c.qty) || 1),
        0
      );
      comboSnapshot = p.comboComponents.map((c: any) => {
        const cQty = (Number(c.qty) || 1) * item.qty;
        const cRate = Number(c.gstRate) || 0;
        const cInclusive = c.gstInclusive !== false;
        const compBase = (Number(c.baseValue) || 0) * (Number(c.qty) || 1);
        const ratio = totalBaseValue > 0 ? compBase / totalBaseValue : 1 / p.comboComponents.length;
        const allocatedPrice = Math.round(discountedLineTotal * ratio * 100) / 100;

        let compTaxable = allocatedPrice;
        let compGst = 0;
        if (cRate > 0) {
          if (cInclusive) {
            compTaxable = Math.round((allocatedPrice / (1 + cRate / 100)) * 100) / 100;
            compGst = Math.round((allocatedPrice - compTaxable) * 100) / 100;
          } else {
            compTaxable = allocatedPrice;
            compGst = Math.round((allocatedPrice * (cRate / 100)) * 100) / 100;
          }
        }
        return {
          name: c.name,
          qty: cQty,
          hsnCode: c.hsnCode || "",
          gstRate: cRate,
          gstInclusive: cInclusive,
          costPrice: typeof c.costPrice === "number" && c.costPrice > 0 ? Number(c.costPrice) : undefined,
          baseValue: Number(c.baseValue) || 0,
          allocatedPrice,
          taxableAmount: compTaxable,
          gstAmount: compGst,
        };
      });
      taxableAmount = Math.round(comboSnapshot.reduce((s, c) => s + c.taxableAmount, 0) * 100) / 100;
      gstAmount = Math.round(comboSnapshot.reduce((s, c) => s + c.gstAmount, 0) * 100) / 100;
    }

    return {
      productId: String(p._id),
      name: p.name,
      image: p.image || "",
      price: p.price,
      qty: item.qty,
      lineGross,
      isEligible,
      allocatedDiscount,
      discountedLineTotal,
      hsnCode: p.hsnCode || "",
      gstRate,
      gstInclusive,
      taxableAmount,
      gstAmount,
      comboComponents: comboSnapshot,
    };
  });

  return toResult({
    valid: true,
    coupon,
    grossSubtotal,
    eligibleSubtotal,
    discount,
    shipping,
    isFreeShipping,
    total,
    itemBreakdown,
  });
}

/**
 * Concurrency-safe coupon usage reservation.
 * Atomically checks and increments usedCount on Coupon, verifies per-user limits,
 * and records a CouponRedemption document.
 */
export async function reserveCouponUsage(params: {
  couponId?: Types.ObjectId | string;
  coupon?: ICoupon;
  orderId: Types.ObjectId | string;
  orderNo?: number;
  customerInfo?: CouponCustomerInfo;
  customerEmail?: string;
  customerPhone?: string;
  userId?: string;
  discountAmount: number;
}): Promise<{ success: boolean; coupon: ICoupon }> {
  const couponId = params.couponId || params.coupon?._id;
  const customerInfo = params.customerInfo || {
    email: params.customerEmail,
    phone: params.customerPhone,
    userId: params.userId,
  };
  const { orderId, orderNo, discountAmount } = params;

  // 1. Atomic global increment if usageLimitTotal is configured
  const coupon = await Coupon.findOneAndUpdate(
    {
      _id: couponId,
      isActive: true,
      $or: [
        { usageLimitTotal: null },
        { usageLimitTotal: { $exists: false } },
        { $expr: { $lt: ["$usedCount", "$usageLimitTotal"] } },
      ],
    },
    { $inc: { usedCount: 1 } },
    { new: true }
  );

  if (!coupon) {
    throw new HttpError(400, "Coupon usage limit has been reached by another order.");
  }

  // 2. Check per-customer limit if configured
  if (coupon.usageLimitPerUser && customerInfo) {
    const normEmail = normalizeEmail(customerInfo.email);
    const normPhone = normalizePhone(customerInfo.phone);
    const userOr: any[] = [];

    if (customerInfo.userId && mongoose.Types.ObjectId.isValid(customerInfo.userId)) {
      userOr.push({ userId: customerInfo.userId });
    }
    if (normEmail) {
      userOr.push({ customerEmail: normEmail });
    }
    if (normPhone) {
      userOr.push({ customerPhone: normPhone });
    }

    if (userOr.length > 0) {
      const activeUserRedemptions = await CouponRedemption.countDocuments({
        couponId: coupon._id,
        status: "active",
        $or: userOr,
      });

      // Note: activeUserRedemptions does not include the one we are about to create.
      if (activeUserRedemptions >= coupon.usageLimitPerUser) {
        // Rollback global increment
        await Coupon.findByIdAndUpdate(coupon._id, { $inc: { usedCount: -1 } });
        throw new HttpError(
          400,
          `You have already reached the maximum usage limit (${coupon.usageLimitPerUser}) for coupon ${coupon.code}.`
        );
      }
    }
  }

  // 3. Create redemption record
  try {
    await CouponRedemption.create({
      couponId: coupon._id,
      couponCode: coupon.code,
      orderId,
      orderNo,
      userId: customerInfo?.userId || null,
      customerEmail: normalizeEmail(customerInfo?.email),
      customerPhone: normalizePhone(customerInfo?.phone),
      discountAmount,
      status: "active",
    });
    return { success: true, coupon };
  } catch (redemptionErr: any) {
    // Rollback global increment on failure
    await Coupon.findByIdAndUpdate(coupon._id, { $inc: { usedCount: -1 } });
    throw redemptionErr;
  }
}

/**
 * Safely rolls back a coupon reservation if order placement fails after reservation.
 */
export async function rollbackCouponUsage(
  couponId: Types.ObjectId | string,
  orderId: Types.ObjectId | string
): Promise<void> {
  try {
    const deleted = await CouponRedemption.findOneAndDelete({ orderId });
    if (deleted) {
      await Coupon.findByIdAndUpdate(couponId, { $inc: { usedCount: -1 } });
    }
  } catch (err) {
    console.error("[rollbackCouponUsage] Error rolling back coupon usage:", err);
  }
}

/**
 * Idempotently restores coupon usage when an order is cancelled.
 * Safe against repeated calls: only restores if an active redemption exists for orderId.
 */
export async function restoreCouponRedemption(
  orderId: Types.ObjectId | string
): Promise<boolean> {
  try {
    const redemption = await CouponRedemption.findOneAndUpdate(
      { orderId, status: "active" },
      { $set: { status: "restored", restoredAt: new Date() } },
      { new: true }
    );

    if (redemption) {
      await Coupon.findByIdAndUpdate(redemption.couponId, {
        $inc: { usedCount: -1 },
      });
      console.log(
        `[restoreCouponRedemption] Successfully restored coupon "${redemption.couponCode}" usage for Order ${orderId}.`
      );
      return true;
    }
    return false;
  } catch (err) {
    console.error("[restoreCouponRedemption] Error restoring coupon usage:", err);
    return false;
  }
}
