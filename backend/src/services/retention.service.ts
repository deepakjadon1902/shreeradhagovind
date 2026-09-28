import mongoose from "mongoose";
import { Order } from "../models/Order";
import { User } from "../models/User";
import { CouponRedemption } from "../models/CouponRedemption";
import { Review } from "../models/Review";
import { LoyaltyTransaction } from "../models/LoyaltyTransaction";
import { WalletTransaction } from "../models/WalletTransaction";
import { isOrderPaidForFinance } from "../routes/admin.routes";
import { getLoyaltySettings, calculateCustomerTier, type TierConfig } from "./loyalty.service";

export type LifecycleSegment = "New" | "Active" | "At Risk" | "Lapsed" | "Dormant";

export interface CustomerRfm {
  recencyDays: number;
  recencyScore: number; // 1 - 5
  frequencyOrders: number;
  frequencyScore: number; // 1 - 5
  monetarySpend: number;
  monetaryScore: number; // 1 - 5
  rfmScore: string;
  rfmSegment: string;
  segment?: string;
  compositeScore?: string;
}

export interface UnifiedCustomerMetrics {
  identifier: {
    userId?: string;
    email: string;
    phone?: string;
    name?: string;
    isRegistered?: boolean;
  };
  isRegistered: boolean;
  userRecord?: {
    _id: string;
    name: string;
    email: string;
    phone?: string;
    role: string;
    createdAt: Date;
    lastLoginAt?: Date | null;
    isBlocked: boolean;
  } | null;
  firstQualifiedPurchaseDate: Date | null;
  lastQualifiedPurchaseDate: Date | null;
  qualifiedOrderCount: number;
  lifetimeQualifiedRevenue: number;
  aov: number;
  isRepeatCustomer: boolean;
  daysToSecondPurchase: number | null;
  purchaseFrequencyDays: number | null;
  totalOrdersPlaced: number;
  totalCancelledOrders: number;
  couponOrdersCount: number;
  totalDiscountReceived: number;
  categoriesPurchased: string[];
  productsPurchased: Array<{ productId: string; name: string; qty: number }>;
  reviewCount: number;
  averageRatingGiven: number;
  lifecycleSegment: LifecycleSegment;
  rfm: CustomerRfm;
  tier: TierConfig & { pointsMultiplier?: number };
  metrics?: {
    totalOrders: number;
    paidOrders: number;
    totalSpend: number;
    aov: number;
    firstOrderDate: string | null;
    lastOrderDate: string | null;
    daysSinceLastOrder: number | null;
    lifecycleSegment: LifecycleSegment;
  };
  loyalty?: {
    pointsBalance: number;
    rupeeValue: number;
  };
  wallet?: {
    balance: number;
  };
  loyaltyPointsBalance: number;
  walletBalance: number;
}

/**
 * Calculates RFM scores (1 to 5) and human-readable segment.
 * Deterministic and explainable logic.
 */
export function calculateRfm(recencyDays: number, qualifiedOrders: number, qualifiedSpend: number): CustomerRfm {
  // 1. Recency Score (lower days = higher score)
  let recencyScore = 1;
  if (recencyDays <= 30) recencyScore = 5;
  else if (recencyDays <= 60) recencyScore = 4;
  else if (recencyDays <= 120) recencyScore = 3;
  else if (recencyDays <= 240) recencyScore = 2;
  else recencyScore = 1;

  // 2. Frequency Score
  let frequencyScore = 1;
  if (qualifiedOrders >= 8) frequencyScore = 5;
  else if (qualifiedOrders >= 5) frequencyScore = 4;
  else if (qualifiedOrders >= 3) frequencyScore = 3;
  else if (qualifiedOrders >= 2) frequencyScore = 2;
  else frequencyScore = 1;

  // 3. Monetary Score (Spend in INR)
  let monetaryScore = 1;
  if (qualifiedSpend >= 10000) monetaryScore = 5;
  else if (qualifiedSpend >= 5000) monetaryScore = 4;
  else if (qualifiedSpend >= 2500) monetaryScore = 3;
  else if (qualifiedSpend >= 1000) monetaryScore = 2;
  else monetaryScore = 1;

  const rfmScore = `${recencyScore}${frequencyScore}${monetaryScore}`;

  // 4. Segment categorization
  let rfmSegment = "Recent Customers";
  if (recencyScore >= 4 && frequencyScore >= 4 && monetaryScore >= 4) {
    rfmSegment = "Champions";
  } else if (frequencyScore >= 3 && monetaryScore >= 3 && recencyScore >= 3) {
    rfmSegment = "Loyal Customers";
  } else if (recencyScore >= 4 && frequencyScore <= 2) {
    rfmSegment = "New / Promising";
  } else if (recencyScore >= 3 && frequencyScore >= 2) {
    rfmSegment = "Potential Loyalists";
  } else if (recencyScore === 2 && frequencyScore >= 2) {
    rfmSegment = "Needs Attention";
  } else if (recencyScore === 2 && frequencyScore <= 2) {
    rfmSegment = "About to Sleep";
  } else if (recencyScore === 1 && frequencyScore >= 3) {
    rfmSegment = "At Risk";
  } else if (recencyScore === 1 && frequencyScore <= 2) {
    rfmSegment = "Hibernating / Lost";
  }

  return {
    recencyDays,
    recencyScore,
    frequencyOrders: qualifiedOrders,
    frequencyScore,
    monetarySpend: qualifiedSpend,
    monetaryScore,
    rfmScore,
    rfmSegment,
  };
}

/**
 * Calculates customer lifecycle segment.
 */
export function calculateLifecycleSegment(
  qualifiedOrders: number,
  firstPurchase: Date | null,
  lastPurchase: Date | null
): LifecycleSegment {
  if (qualifiedOrders === 0 || !lastPurchase) {
    return "Dormant";
  }

  const now = Date.now();
  const daysSinceLast = Math.max(0, Math.floor((now - lastPurchase.getTime()) / (1000 * 60 * 60 * 24)));
  const daysSinceFirst = firstPurchase ? Math.max(0, Math.floor((now - firstPurchase.getTime()) / (1000 * 60 * 60 * 24))) : daysSinceLast;

  if (qualifiedOrders === 1 && daysSinceFirst <= 30) {
    return "New";
  }
  if (daysSinceLast <= 60) {
    return "Active";
  }
  if (daysSinceLast <= 120) {
    return "At Risk";
  }
  if (daysSinceLast <= 240) {
    return "Lapsed";
  }
  return "Dormant";
}

/**
 * Derives comprehensive unified customer metrics for a given user ID or customer email.
 * Unifies orders across both registered account and historical guest checkouts.
 */
export async function getUnifiedCustomerMetrics(lookup: {
  userId?: string | mongoose.Types.ObjectId;
  email?: string;
}): Promise<UnifiedCustomerMetrics | null> {
  let user: any = null;
  if (lookup.userId && mongoose.isValidObjectId(lookup.userId)) {
    user = await User.findById(lookup.userId).lean();
  }

  const cleanEmail = (lookup.email || user?.email || "").trim().toLowerCase();
  if (!cleanEmail && !user) return null;

  if (!user && cleanEmail) {
    user = await User.findOne({ email: cleanEmail }).lean();
  }

  // Find all orders associated with this customer
  const orderQuery: any = {
    $or: [
      ...(user ? [{ user: user._id }] : []),
      ...(cleanEmail ? [{ customerEmail: cleanEmail }] : []),
    ],
  };

  const rawOrders = await Order.find(orderQuery).sort({ createdAt: 1 }).lean();

  const totalOrdersPlaced = rawOrders.length;
  const cancelledOrders = rawOrders.filter((o) => o.status === "Cancelled");
  const totalCancelledOrders = cancelledOrders.length;

  // Filter qualified revenue orders using the exact store financial rule
  const qualifiedOrders = rawOrders.filter(isOrderPaidForFinance);
  const qualifiedOrderCount = qualifiedOrders.length;
  const lifetimeQualifiedRevenue = Math.round(
    qualifiedOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0) * 100
  ) / 100;
  const aov = qualifiedOrderCount > 0 ? Math.round((lifetimeQualifiedRevenue / qualifiedOrderCount) * 100) / 100 : 0;

  const firstQualifiedPurchaseDate = qualifiedOrders[0] ? new Date(qualifiedOrders[0].createdAt) : null;
  const lastQualifiedPurchaseDate = qualifiedOrders[qualifiedOrders.length - 1]
    ? new Date(qualifiedOrders[qualifiedOrders.length - 1].createdAt)
    : null;

  const isRepeatCustomer = qualifiedOrderCount >= 2;

  let daysToSecondPurchase: number | null = null;
  if (qualifiedOrders.length >= 2) {
    const t1 = new Date(qualifiedOrders[0].createdAt).getTime();
    const t2 = new Date(qualifiedOrders[1].createdAt).getTime();
    daysToSecondPurchase = Math.max(0, Math.floor((t2 - t1) / (1000 * 60 * 60 * 24)));
  }

  let purchaseFrequencyDays: number | null = null;
  if (qualifiedOrders.length >= 2 && firstQualifiedPurchaseDate && lastQualifiedPurchaseDate) {
    const totalSpanDays = Math.floor(
      (lastQualifiedPurchaseDate.getTime() - firstQualifiedPurchaseDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    purchaseFrequencyDays = Math.round((totalSpanDays / (qualifiedOrders.length - 1)) * 10) / 10;
  }

  // Coupon statistics
  const couponOrdersCount = rawOrders.filter((o) => Boolean(o.couponCode || o.couponId)).length;
  const totalDiscountReceived = Math.round(
    rawOrders.reduce((sum, o) => sum + (Number(o.discount) || 0), 0) * 100
  ) / 100;

  // Category and Product affinities
  const catSet = new Set<string>();
  const productMap = new Map<string, { productId: string; name: string; qty: number }>();

  for (const o of qualifiedOrders) {
    for (const item of o.items || []) {
      const pid = String(item.productId);
      const existing = productMap.get(pid);
      productMap.set(pid, {
        productId: pid,
        name: item.name || "Item",
        qty: (existing?.qty || 0) + (Number(item.qty) || 1),
      });
    }
  }

  const { Product } = await import("../models/Product");
  if (productMap.size > 0) {
    const prods = await Product.find({ _id: { $in: Array.from(productMap.keys()) } })
      .select("category")
      .lean();
    for (const p of prods) {
      if (p.category) catSet.add(p.category);
    }
  }

  // Review activity
  const reviews = await Review.find({
    $or: [
      ...(user ? [{ user: user._id }] : []),
      ...(cleanEmail ? [{ customerEmail: cleanEmail }] : []),
    ],
  }).lean();
  const reviewCount = reviews.length;
  const averageRatingGiven =
    reviewCount > 0 ? Math.round((reviews.reduce((s, r) => s + (r.rating || 5), 0) / reviewCount) * 10) / 10 : 0;

  // Recency in days
  const now = Date.now();
  const recencyDays = lastQualifiedPurchaseDate
    ? Math.max(0, Math.floor((now - lastQualifiedPurchaseDate.getTime()) / (1000 * 60 * 60 * 24)))
    : 999;

  const rfm = calculateRfm(recencyDays, qualifiedOrderCount, lifetimeQualifiedRevenue);
  const lifecycleSegment = calculateLifecycleSegment(
    qualifiedOrderCount,
    firstQualifiedPurchaseDate,
    lastQualifiedPurchaseDate
  );

  const { tiers } = await getLoyaltySettings();
  const tier = calculateCustomerTier(lifetimeQualifiedRevenue, qualifiedOrderCount, tiers);

  // Latest customer name and phone
  const latestOrder = rawOrders[rawOrders.length - 1];
  const customerName = user?.name || latestOrder?.address?.name || cleanEmail.split("@")[0] || "Customer";
  const customerPhone = user?.phone || latestOrder?.address?.phone || "";

  return {
    identifier: {
      userId: user?._id ? String(user._id) : undefined,
      email: cleanEmail,
      phone: customerPhone,
      name: customerName,
      isRegistered: Boolean(user),
    },
    isRegistered: Boolean(user),
    userRecord: user
      ? {
          _id: String(user._id),
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
          createdAt: user.createdAt,
          lastLoginAt: user.lastLoginAt,
          isBlocked: Boolean(user.isBlocked),
        }
      : null,
    firstQualifiedPurchaseDate,
    lastQualifiedPurchaseDate,
    qualifiedOrderCount,
    lifetimeQualifiedRevenue,
    aov,
    isRepeatCustomer,
    daysToSecondPurchase,
    purchaseFrequencyDays,
    totalOrdersPlaced,
    totalCancelledOrders,
    couponOrdersCount,
    totalDiscountReceived,
    categoriesPurchased: Array.from(catSet),
    productsPurchased: Array.from(productMap.values()).sort((a, b) => b.qty - a.qty),
    reviewCount,
    averageRatingGiven,
    lifecycleSegment,
    rfm: {
      ...rfm,
      segment: rfm.rfmSegment,
      compositeScore: rfm.rfmScore,
    },
    tier: {
      ...tier,
      pointsMultiplier: tier.extraPointsMultiplier || 1,
    },
    metrics: {
      totalOrders: totalOrdersPlaced,
      paidOrders: qualifiedOrderCount,
      totalSpend: lifetimeQualifiedRevenue,
      aov,
      firstOrderDate: firstQualifiedPurchaseDate ? firstQualifiedPurchaseDate.toISOString() : null,
      lastOrderDate: lastQualifiedPurchaseDate ? lastQualifiedPurchaseDate.toISOString() : null,
      daysSinceLastOrder: recencyDays === 999 ? null : recencyDays,
      lifecycleSegment,
    },
    loyalty: {
      pointsBalance: Math.max(0, user?.loyaltyPointsBalance ?? 0),
      rupeeValue: Math.max(0, user?.loyaltyPointsBalance ?? 0),
    },
    wallet: {
      balance: Math.max(0, user?.walletBalance ?? 0),
    },
    loyaltyPointsBalance: Math.max(0, user?.loyaltyPointsBalance ?? 0),
    walletBalance: Math.max(0, user?.walletBalance ?? 0),
  };
}

/**
 * Returns overall store retention statistics and segment distributions.
 */
export async function getRetentionOverview() {
  const [allOrders, registeredUsers, loyaltyStats, walletStats] = await Promise.all([
    Order.find().select("user customerEmail total status payment createdAt discount couponCode items").lean(),
    User.find({ role: "user" }).select("name email phone createdAt lastLoginAt loyaltyPointsBalance walletBalance").lean(),
    LoyaltyTransaction.aggregate([
      {
        $group: {
          _id: "$type",
          totalPoints: { $sum: { $abs: "$pointsDelta" } },
          count: { $sum: 1 },
        },
      },
    ]),
    WalletTransaction.aggregate([
      {
        $group: {
          _id: "$type",
          totalAmount: { $sum: { $abs: "$amount" } },
          count: { $sum: 1 },
        },
      },
    ]),
  ]);

  const { loyalty, tiers } = await getLoyaltySettings();

  // Aggregate orders by normalized customerEmail
  const emailMap = new Map<string, any[]>();
  for (const o of allOrders) {
    const email = (o.customerEmail || "").trim().toLowerCase();
    if (!email) continue;
    const list = emailMap.get(email) || [];
    list.push(o);
    emailMap.set(email, list);
  }

  // Count unique customer identities
  const totalCustomersCount = emailMap.size;
  const registeredCount = registeredUsers.length;
  const guestCount = Math.max(0, totalCustomersCount - registeredCount);

  let totalQualifiedRevenue = 0;
  let totalQualifiedOrdersCount = 0;
  let repeatCustomersCount = 0;
  let firstTimeCustomersCount = 0;

  const segmentCounts: Record<LifecycleSegment, number> = {
    New: 0,
    Active: 0,
    "At Risk": 0,
    Lapsed: 0,
    Dormant: 0,
  };

  const tierCounts: Record<string, number> = {};
  for (const t of tiers) {
    tierCounts[t.name] = 0;
  }

  for (const [_, orders] of emailMap.entries()) {
    const qualified = orders.filter(isOrderPaidForFinance);
    const qCount = qualified.length;
    const qRevenue = qualified.reduce((s, o) => s + (Number(o.total) || 0), 0);

    totalQualifiedRevenue += qRevenue;
    totalQualifiedOrdersCount += qCount;

    if (qCount >= 2) {
      repeatCustomersCount++;
    } else if (qCount === 1) {
      firstTimeCustomersCount++;
    }

    const firstDate = qualified[0] ? new Date(qualified[0].createdAt) : null;
    const lastDate = qualified[qualified.length - 1] ? new Date(qualified[qualified.length - 1].createdAt) : null;
    const segment = calculateLifecycleSegment(qCount, firstDate, lastDate);
    segmentCounts[segment]++;

    const customerTier = calculateCustomerTier(qRevenue, qCount, tiers);
    tierCounts[customerTier.name] = (tierCounts[customerTier.name] || 0) + 1;
  }

  const customersWithOrders = firstTimeCustomersCount + repeatCustomersCount;
  const repeatPurchaseRate =
    customersWithOrders > 0 ? Math.round((repeatCustomersCount / customersWithOrders) * 100 * 10) / 10 : 0;
  const aov =
    totalQualifiedOrdersCount > 0 ? Math.round((totalQualifiedRevenue / totalQualifiedOrdersCount) * 100) / 100 : 0;
  const ltv = totalCustomersCount > 0 ? Math.round((totalQualifiedRevenue / totalCustomersCount) * 100) / 100 : 0;

  // Parse loyalty points summary
  const loyaltyPointsMap = new Map(loyaltyStats.map((s) => [s._id, s.totalPoints]));
  const pointsIssued = loyaltyPointsMap.get("EARN") || 0;
  const pointsRedeemed = loyaltyPointsMap.get("REDEEM") || 0;
  const pointsExpired = loyaltyPointsMap.get("EXPIRE") || 0;
  const activePointsBalance = registeredUsers.reduce((sum, u) => sum + (Number(u.loyaltyPointsBalance) || 0), 0);

  // Parse wallet summary
  const walletMap = new Map(walletStats.map((s) => [s._id, s.totalAmount]));
  const walletCredits = (walletMap.get("CREDIT") || 0) + (walletMap.get("ADJUSTMENT_CREDIT") || 0);
  const walletDebits = (walletMap.get("DEBIT") || 0) + (walletMap.get("ADJUSTMENT_DEBIT") || 0);
  const activeWalletBalance = registeredUsers.reduce((sum, u) => sum + (Number(u.walletBalance) || 0), 0);

  const totalPointsCirculation = activePointsBalance;
  const pointsMonetaryValueInCirculation = Math.round(activePointsBalance * loyalty.pointMonetaryValue * 100) / 100;
  const totalDiscountProvided = Math.round(pointsRedeemed * loyalty.pointMonetaryValue * 100) / 100;

  return {
    customerCounts: {
      total: totalCustomersCount,
      registered: registeredCount,
      guests: guestCount,
      repeatCustomers: repeatCustomersCount,
      repeatCustomerRate: repeatPurchaseRate,
    },
    financials: {
      totalRevenue: Math.round(totalQualifiedRevenue * 100) / 100,
      totalPaidOrders: totalQualifiedOrdersCount,
      averageOrderValue: aov,
      averageCustomerLifetimeValue: ltv,
    },
    loyalty: {
      enabled: loyalty.enabled,
      totalPointsIssued: pointsIssued,
      totalPointsRedeemed: pointsRedeemed,
      activePointsInCirculation: totalPointsCirculation,
      totalDiscountProvided,
      pointsMonetaryValueInCirculation,
      pointsExpired,
      redemptionRate: pointsIssued > 0 ? Math.round((pointsRedeemed / pointsIssued) * 100 * 10) / 10 : 0,
      // Backward compatibility aliases
      pointsIssued,
      pointsRedeemed,
      activePointsBalance,
    },
    wallet: {
      totalCredits: Math.round(walletCredits * 100) / 100,
      totalDebits: Math.round(walletDebits * 100) / 100,
      activeWalletBalance: Math.round(activeWalletBalance * 100) / 100,
      totalWalletBalanceOutstanding: Math.round(activeWalletBalance * 100) / 100,
    },
    segmentation: segmentCounts,
    segmentDistribution: segmentCounts,
    tierDistribution: tierCounts,
    tiersConfig: tiers,
    kpis: {
      totalCustomers: totalCustomersCount,
      registeredCustomers: registeredCount,
      guestCustomers: guestCount,
      customersWithOrders,
      firstTimeCustomers: firstTimeCustomersCount,
      repeatCustomers: repeatCustomersCount,
      repeatPurchaseRate,
      aov,
      ltv,
      totalQualifiedRevenue: Math.round(totalQualifiedRevenue * 100) / 100,
      totalQualifiedOrders: totalQualifiedOrdersCount,
    },
  };
}

/**
 * Returns paginated, searchable, filterable unified customer CRM list for Admin.
 */
export async function getRetentionCustomersList(params: {
  search?: string;
  segment?: string;
  tier?: string;
  isRegistered?: boolean;
  page?: number;
  limit?: number;
}) {
  const page = Math.max(1, params.page || 1);
  const limit = Math.max(1, Math.min(100, params.limit || 25));

  const [allOrders, registeredUsers] = await Promise.all([
    Order.find().select("user customerEmail total status payment createdAt address discount couponCode items").lean(),
    User.find({ role: "user" }).select("name email phone createdAt lastLoginAt loyaltyPointsBalance walletBalance isBlocked").lean(),
  ]);

  const { loyalty, tiers } = await getLoyaltySettings();

  const userByEmail = new Map(registeredUsers.map((u) => [u.email.toLowerCase().trim(), u]));
  const emailMap = new Map<string, any[]>();

  for (const o of allOrders) {
    const email = (o.customerEmail || "").trim().toLowerCase();
    if (!email) continue;
    const list = emailMap.get(email) || [];
    list.push(o);
    emailMap.set(email, list);
  }

  // Also include registered users who have not placed orders yet
  for (const u of registeredUsers) {
    const email = u.email.toLowerCase().trim();
    if (!emailMap.has(email)) {
      emailMap.set(email, []);
    }
  }

  let customers: any[] = [];
  const searchLower = (params.search || "").trim().toLowerCase();

  for (const [email, orders] of emailMap.entries()) {
    const u = userByEmail.get(email);
    const qualified = orders.filter(isOrderPaidForFinance);
    const qCount = qualified.length;
    const qRevenue = Math.round(qualified.reduce((s, o) => s + (Number(o.total) || 0), 0) * 100) / 100;
    const aov = qCount > 0 ? Math.round((qRevenue / qCount) * 100) / 100 : 0;

    const firstDate = qualified[0] ? new Date(qualified[0].createdAt) : null;
    const lastDate = qualified[qualified.length - 1] ? new Date(qualified[qualified.length - 1].createdAt) : null;

    const segment = calculateLifecycleSegment(qCount, firstDate, lastDate);
    const customerTier = calculateCustomerTier(qRevenue, qCount, tiers);

    const now = Date.now();
    const recencyDays = lastDate ? Math.max(0, Math.floor((now - lastDate.getTime()) / (1000 * 60 * 60 * 24))) : 999;
    const rfm = calculateRfm(recencyDays, qCount, qRevenue);

    const latestOrder = orders[orders.length - 1];
    const name = u?.name || latestOrder?.address?.name || email.split("@")[0];
    const phone = u?.phone || latestOrder?.address?.phone || "";

    // Filters
    if (params.segment && params.segment.toLowerCase() !== "all" && segment.toLowerCase() !== params.segment.toLowerCase()) {
      continue;
    }
    if (params.tier && params.tier.toLowerCase() !== "all" && customerTier.name.toLowerCase() !== params.tier.toLowerCase()) {
      continue;
    }
    if (typeof params.isRegistered === "boolean" && Boolean(u) !== params.isRegistered) {
      continue;
    }
    if (searchLower) {
      const matchName = name.toLowerCase().includes(searchLower);
      const matchEmail = email.toLowerCase().includes(searchLower);
      const matchPhone = phone.includes(searchLower);
      if (!matchName && !matchEmail && !matchPhone) continue;
    }

    const daysSinceLastOrder = lastDate ? Math.max(0, Math.floor((now - lastDate.getTime()) / (1000 * 60 * 60 * 24))) : null;
    const pointsBal = Math.max(0, u?.loyaltyPointsBalance ?? 0);
    const walletBal = Math.max(0, u?.walletBalance ?? 0);

    customers.push({
      identifier: {
        userId: u ? String(u._id) : null,
        email,
        phone: phone || null,
        name,
        isRegistered: Boolean(u),
      },
      metrics: {
        totalOrders: orders.length,
        paidOrders: qCount,
        totalSpend: qRevenue,
        aov,
        firstOrderDate: firstDate ? firstDate.toISOString() : null,
        lastOrderDate: lastDate ? lastDate.toISOString() : null,
        daysSinceLastOrder,
      },
      rfm: {
        recencyScore: rfm.recencyScore,
        frequencyScore: rfm.frequencyScore,
        monetaryScore: rfm.monetaryScore,
        compositeScore: rfm.rfmScore,
        segment: rfm.rfmSegment,
      },
      tier: {
        id: customerTier.id,
        name: customerTier.name,
        badgeColor: customerTier.badgeColor,
        pointsMultiplier: customerTier.extraPointsMultiplier || 1,
        perks: customerTier.perks || [],
      },
      loyalty: {
        pointsBalance: pointsBal,
        rupeeValue: Math.round(pointsBal * (loyalty?.pointMonetaryValue || 1) * 100) / 100,
      },
      wallet: {
        balance: walletBal,
      },
      // Backward compatibility aliases
      email,
      name,
      phone,
      isRegistered: Boolean(u),
      userId: u ? String(u._id) : null,
      isBlocked: Boolean(u?.isBlocked),
      createdAt: u?.createdAt || orders[0]?.createdAt || new Date(),
      lastLoginAt: u?.lastLoginAt || null,
      firstPurchaseDate: firstDate,
      lastPurchaseDate: lastDate,
      qualifiedOrdersCount: qCount,
      totalOrdersCount: orders.length,
      lifetimeRevenue: qRevenue,
      aov,
      lifecycleSegment: segment,
      loyaltyPointsBalance: pointsBal,
      walletBalance: walletBal,
    });
  }

  // Sort: highest lifetime revenue first by default
  customers.sort((a, b) => b.lifetimeRevenue - a.lifetimeRevenue || b.qualifiedOrdersCount - a.qualifiedOrdersCount);

  const total = customers.length;
  const paginated = customers.slice((page - 1) * limit, page * limit);

  return {
    customers: paginated,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit) || 1,
    },
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit) || 1,
  };
}
