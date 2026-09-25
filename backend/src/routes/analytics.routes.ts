import { Router, type Request, type Response, type NextFunction } from "express";
import { z } from "zod";
import mongoose from "mongoose";
import { AnalyticsEvent } from "../models/AnalyticsEvent";
import { DailyAnalytics, recordDailyEvent, getIstDateStr, sanitizeKey } from "../models/DailyAnalytics";
import { Order } from "../models/Order";
import { CheckoutSession } from "../models/CheckoutSession";
import { Product } from "../models/Product";
import { requireAuth, requireAdmin } from "../middleware/auth";
import { HttpError } from "../middleware/error";
import { isOrderPaidForFinance } from "./admin.routes";

// ==========================================
// In-Memory Rate Limiter (Public Ingestion)
// ==========================================
interface IRateLimitRecord {
  count: number;
  resetAt: number;
}
const rateLimitMap = new Map<string, IRateLimitRecord>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_EVENTS_PER_MINUTE = 120; // 120 events/minute

// Clean up stale rate limit entries every 2 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimitMap.entries()) {
    if (record.resetAt <= now) {
      rateLimitMap.delete(key);
    }
  }
}, 2 * 60 * 1000);

function checkAnalyticsRateLimit(req: Request): boolean {
  const forwarded = req.headers["x-forwarded-for"];
  const rawIp =
    (typeof forwarded === "string" ? forwarded.split(",")[0] : undefined) ||
    req.socket.remoteAddress ||
    "unknown-ip";
  const clientKey = rawIp.trim();

  const now = Date.now();
  const record = rateLimitMap.get(clientKey);

  if (!record || record.resetAt <= now) {
    rateLimitMap.set(clientKey, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (record.count >= MAX_EVENTS_PER_MINUTE) {
    return false;
  }

  record.count++;
  return true;
}

// ==========================================
// Validation Schema for Analytics Event
// ==========================================
const eventSchema = z.object({
  eventType: z.enum(["page_view", "product_view", "add_to_cart", "checkout_start"]),
  visitorId: z.string().trim().min(1).max(100),
  sessionId: z.string().trim().min(1).max(100),
  entityId: z.string().trim().max(100).nullable().optional(),
  path: z.string().trim().min(1).max(500),
  device: z.enum(["mobile", "desktop", "tablet", "unknown"]).default("unknown"),
  referrer: z.string().trim().max(1000).optional().default(""),
  utm: z
    .object({
      source: z.string().trim().max(100).optional().default(""),
      medium: z.string().trim().max(100).optional().default(""),
      campaign: z.string().trim().max(100).optional().default(""),
      term: z.string().trim().max(100).optional().default(""),
      content: z.string().trim().max(100).optional().default(""),
    })
    .optional()
    .default({}),
  metadata: z.record(z.any()).optional().default({}),
});

// PII & sensitive fields blacklist to ensure absolute privacy protection
const SENSITIVE_KEYS = new Set([
  "email",
  "phone",
  "address",
  "password",
  "token",
  "secret",
  "key",
  "auth",
  "card",
  "cvv",
  "otp",
  "pin",
  "razorpay",
]);

function sanitizeMetadata(rawMeta: Record<string, any>): Record<string, any> {
  const safe: Record<string, any> = {};
  for (const [k, v] of Object.entries(rawMeta)) {
    const lowerKey = k.toLowerCase();
    if (!SENSITIVE_KEYS.has(lowerKey) && typeof v !== "object") {
      safe[k] = v;
    }
  }
  return safe;
}

// ==========================================
// Public Router: Ingestion Endpoint
// ==========================================
const publicRouter = Router();

async function handleEventIngestion(req: Request, res: Response, next: NextFunction) {
  try {
    if (!checkAnalyticsRateLimit(req)) {
      return res.status(429).json({ ok: false, error: "Too many analytics events. Please slow down." });
    }

    const parsed = eventSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ ok: false, error: "Invalid analytics event payload", details: parsed.error.issues });
    }

    const { eventType, visitorId, sessionId, entityId, path, device, referrer, utm, metadata } = parsed.data;
    const safeMetadata = sanitizeMetadata(metadata);

    // Optional: resolve product name for product_view / add_to_cart if entityId is an ObjectId
    let productName: string | undefined;
    if (entityId && (eventType === "product_view" || eventType === "add_to_cart")) {
      if (mongoose.Types.ObjectId.isValid(entityId)) {
        try {
          const prod = await Product.findById(entityId).select("name").lean();
          if (prod) productName = (prod as any).name;
        } catch {
          // ignore lookup error
        }
      }
    }

    // 1. Create raw AnalyticsEvent (Non-blocking DB write with 90-day TTL)
    const eventDoc = new AnalyticsEvent({
      eventType,
      visitorId,
      sessionId,
      entityId: entityId || null,
      path,
      device,
      referrer: referrer || "",
      utm: utm || {},
      metadata: safeMetadata,
      createdAt: new Date(),
    });

    await eventDoc.save();

    // 2. Atomically update DailyAnalytics
    await recordDailyEvent({
      eventType,
      visitorId,
      sessionId,
      entityId: entityId || null,
      path,
      device,
      referrer: referrer || "",
      utm: utm || {},
      productName,
      createdAt: eventDoc.createdAt,
      currentEventId: eventDoc._id,
    });

    return res.status(200).json({ ok: true });
  } catch (err) {
    next(err);
  }
}

publicRouter.post("/events", handleEventIngestion);
publicRouter.post("/event", handleEventIngestion);

// ==========================================
// Date Range Resolution Helper
// ==========================================
export function parseAnalyticsDateRange(
  range?: string,
  customFrom?: string,
  customTo?: string
): {
  startDateStr: string;
  endDateStr: string;
  startUtc: Date;
  endUtc: Date;
} {
  const now = new Date();
  const todayStr = getIstDateStr(now);

  let startDateStr = todayStr;
  let endDateStr = todayStr;

  const r = (range || "7d").toLowerCase();

  if (r === "today") {
    startDateStr = todayStr;
    endDateStr = todayStr;
  } else if (r === "7d") {
    const d = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
    startDateStr = getIstDateStr(d);
    endDateStr = todayStr;
  } else if (r === "30d") {
    const d = new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000);
    startDateStr = getIstDateStr(d);
    endDateStr = todayStr;
  } else if (r === "this_month") {
    const [year, month] = todayStr.split("-");
    startDateStr = `${year}-${month}-01`;
    endDateStr = todayStr;
  } else if (r === "last_month") {
    const curYear = parseInt(todayStr.slice(0, 4), 10);
    const curMonth = parseInt(todayStr.slice(5, 7), 10);
    const prevYear = curMonth === 1 ? curYear - 1 : curYear;
    const prevMonth = curMonth === 1 ? 12 : curMonth - 1;
    const prevMonthStr = String(prevMonth).padStart(2, "0");
    const lastDay = new Date(prevYear, prevMonth, 0).getDate();
    startDateStr = `${prevYear}-${prevMonthStr}-01`;
    endDateStr = `${prevYear}-${prevMonthStr}-${String(lastDay).padStart(2, "0")}`;
  } else if (r === "custom" && customFrom && customTo) {
    startDateStr = customFrom.trim();
    endDateStr = customTo.trim();
  }

  // Exact start and end bounds in IST (+05:30)
  const startUtc = new Date(`${startDateStr}T00:00:00.000+05:30`);
  const endUtc = new Date(`${endDateStr}T23:59:59.999+05:30`);

  return { startDateStr, endDateStr, startUtc, endUtc };
}

// ==========================================
// Admin Router: Analytics Endpoints
// ==========================================
export const adminAnalyticsRoutes = Router();
adminAnalyticsRoutes.use(requireAuth, requireAdmin);

/**
 * Resolves the traffic channel/source of an order based on UTM or referrer
 */
export function resolveOrderSource(order: any): string {
  if (order.analytics?.utm?.source) {
    return sanitizeKey(order.analytics.utm.source);
  }
  if (order.analytics?.referrer) {
    try {
      const host = new URL(order.analytics.referrer).hostname.replace(/^www\./, "");
      return sanitizeKey(host);
    } catch {
      return "direct";
    }
  }
  return "direct";
}

/**
 * GET /api/admin/analytics/overview
 * Returns top-line conversion KPIs, funnel summary, and order metrics
 */
adminAnalyticsRoutes.get("/overview", async (req, res, next) => {
  try {
    const { range, from, to } = req.query;
    const { startDateStr, endDateStr, startUtc, endUtc } = parseAnalyticsDateRange(
      range as string,
      from as string,
      to as string
    );

    // 1. Fetch DailyAnalytics records for range
    const dailyRecords = await DailyAnalytics.find({
      date: { $gte: startDateStr, $lte: endDateStr },
    }).lean();

    let pageViews = 0;
    let uniqueVisitors = 0;
    let productViews = 0;
    let uniqueProductViewers = 0;
    let cartAdds = 0;
    let uniqueCartVisitors = 0;
    let checkoutStarts = 0;
    let uniqueCheckoutVisitors = 0;

    for (const d of dailyRecords) {
      pageViews += d.pageViews || 0;
      uniqueVisitors += d.uniqueVisitors || 0;
      productViews += d.productViews || 0;
      uniqueProductViewers += d.uniqueProductViewers || 0;
      cartAdds += d.cartAdds || 0;
      uniqueCartVisitors += d.uniqueCartVisitors || 0;
      checkoutStarts += d.checkoutStarts || 0;
      uniqueCheckoutVisitors += d.uniqueCheckoutVisitors || 0;
    }

    // 2. Fetch authoritative Order data for the same period
    const orders = await Order.find({
      createdAt: { $gte: startUtc, $lte: endUtc },
    }).lean();

    const ordersPlaced = orders.length;
    let paidOrders = 0;
    let grossRevenue = 0;

    for (const o of orders) {
      if (isOrderPaidForFinance(o)) {
        paidOrders++;
        grossRevenue += Number(o.total) || 0;
      }
    }
    grossRevenue = Math.round(grossRevenue * 100) / 100;
    const aov = paidOrders > 0 ? Math.round((grossRevenue / paidOrders) * 100) / 100 : 0;

    // 3. Fetch CheckoutSession metrics
    const sessions = await CheckoutSession.find({
      createdAt: { $gte: startUtc, $lte: endUtc },
    }).lean();

    let activeCheckouts = 0;
    let abandonedCheckouts = 0;
    let recoveredCheckouts = 0;
    let recoveredRevenue = 0;
    let recoveryEmailsSent = 0;
    let recoveredWithEmail = 0;

    for (const s of sessions) {
      if (s.status === "active") activeCheckouts++;
      else if (s.status === "abandoned") abandonedCheckouts++;
      else if (s.status === "recovered") {
        recoveredCheckouts++;
        recoveredRevenue += Number(s.total) || 0;
        if ((s.recoverySentCount || 0) > 0) recoveredWithEmail++;
      }
      recoveryEmailsSent += s.recoverySentCount || 0;
    }
    recoveredRevenue = Math.round(recoveredRevenue * 100) / 100;

    // 4. Calculate Mathematical Conversion Rates
    const totalCaptured = sessions.length;
    const capturedAbandonmentRate =
      abandonedCheckouts + recoveredCheckouts > 0
        ? Math.round((abandonedCheckouts / (abandonedCheckouts + recoveredCheckouts)) * 10000) / 100
        : null;

    const recoveryRate =
      recoveryEmailsSent > 0
        ? Math.round((recoveredWithEmail / recoveryEmailsSent) * 10000) / 100
        : null;

    const visitorToPurchaseRate =
      uniqueVisitors > 0
        ? Math.min(100, Math.round((paidOrders / uniqueVisitors) * 10000) / 100)
        : null;

    const productViewToCartRate =
      uniqueProductViewers > 0
        ? Math.min(100, Math.round((uniqueCartVisitors / uniqueProductViewers) * 10000) / 100)
        : productViews > 0
        ? Math.min(100, Math.round((cartAdds / productViews) * 10000) / 100)
        : null;

    const checkoutToPurchaseRate =
      uniqueCheckoutVisitors > 0
        ? Math.min(100, Math.round((paidOrders / uniqueCheckoutVisitors) * 10000) / 100)
        : checkoutStarts > 0
        ? Math.min(100, Math.round((paidOrders / checkoutStarts) * 10000) / 100)
        : null;

    res.json({
      range: { startDateStr, endDateStr },
      kpis: {
        uniqueVisitors,
        pageViews,
        productViews,
        uniqueProductViewers,
        cartAdds,
        uniqueCartVisitors,
        checkoutStarts,
        uniqueCheckoutVisitors,
        ordersPlaced,
        paidOrders,
        grossRevenue,
        aov,
        conversionRates: {
          visitorToPurchaseRate,
          productViewToCartRate,
          checkoutToPurchaseRate,
        },
      },
      abandonedCart: {
        totalCaptured,
        activeCheckouts,
        abandonedCheckouts,
        recoveredCheckouts,
        capturedAbandonmentRate,
        recoveryEmailsSent,
        recoveryRate,
        recoveredRevenue,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/admin/analytics/funnel
 * Returns step-by-step conversion funnel with drop-off percentages
 */
adminAnalyticsRoutes.get("/funnel", async (req, res, next) => {
  try {
    const { range, from, to } = req.query;
    const { startDateStr, endDateStr, startUtc, endUtc } = parseAnalyticsDateRange(
      range as string,
      from as string,
      to as string
    );

    const dailyRecords = await DailyAnalytics.find({
      date: { $gte: startDateStr, $lte: endDateStr },
    }).lean();

    let uniqueVisitors = 0;
    let uniqueProductViewers = 0;
    let uniqueCartVisitors = 0;
    let uniqueCheckoutVisitors = 0;

    let rawPageViews = 0;
    let rawProductViews = 0;
    let rawCartAdds = 0;
    let rawCheckoutStarts = 0;

    for (const d of dailyRecords) {
      uniqueVisitors += d.uniqueVisitors || 0;
      uniqueProductViewers += d.uniqueProductViewers || 0;
      uniqueCartVisitors += d.uniqueCartVisitors || 0;
      uniqueCheckoutVisitors += d.uniqueCheckoutVisitors || 0;

      rawPageViews += d.pageViews || 0;
      rawProductViews += d.productViews || 0;
      rawCartAdds += d.cartAdds || 0;
      rawCheckoutStarts += d.checkoutStarts || 0;
    }

    // Authoritative paid orders
    const orders = await Order.find({
      createdAt: { $gte: startUtc, $lte: endUtc },
    }).lean();

    let paidOrders = 0;
    for (const o of orders) {
      if (isOrderPaidForFinance(o)) paidOrders++;
    }

    const dropoffs = {
      visitorToProductView:
        uniqueVisitors > 0
          ? Math.max(0, Math.round(((uniqueVisitors - uniqueProductViewers) / uniqueVisitors) * 10000) / 100)
          : null,
      productViewToCart:
        uniqueProductViewers > 0
          ? Math.max(0, Math.round(((uniqueProductViewers - uniqueCartVisitors) / uniqueProductViewers) * 10000) / 100)
          : null,
      cartToCheckout:
        uniqueCartVisitors > 0
          ? Math.max(0, Math.round(((uniqueCartVisitors - uniqueCheckoutVisitors) / uniqueCartVisitors) * 10000) / 100)
          : null,
      checkoutToPaid:
        uniqueCheckoutVisitors > 0
          ? Math.max(0, Math.round(((uniqueCheckoutVisitors - paidOrders) / uniqueCheckoutVisitors) * 10000) / 100)
          : null,
    };

    res.json({
      range: { startDateStr, endDateStr },
      stages: [
        { key: "visitors", label: "Unique Visitors", count: uniqueVisitors },
        { key: "product_viewers", label: "Product Viewers", count: uniqueProductViewers },
        { key: "cart_visitors", label: "Cart Visitors", count: uniqueCartVisitors },
        { key: "checkout_visitors", label: "Checkout Visitors", count: uniqueCheckoutVisitors },
        { key: "paid_orders", label: "Completed Orders", count: paidOrders },
      ],
      rawTotals: {
        pageViews: rawPageViews,
        productViews: rawProductViews,
        cartAdds: rawCartAdds,
        checkoutStarts: rawCheckoutStarts,
      },
      dropoffs,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/admin/analytics/trends
 * Returns daily timeseries of visitors, views, cart adds, orders, and revenue
 */
adminAnalyticsRoutes.get("/trends", async (req, res, next) => {
  try {
    const { range, from, to } = req.query;
    const { startDateStr, endDateStr, startUtc, endUtc } = parseAnalyticsDateRange(
      range as string,
      from as string,
      to as string
    );

    const dailyRecords = await DailyAnalytics.find({
      date: { $gte: startDateStr, $lte: endDateStr },
    })
      .sort({ date: 1 })
      .lean();

    // Map daily records by date
    const dailyMap = new Map<string, any>();
    for (const d of dailyRecords) {
      dailyMap.set(d.date, d);
    }

    // Authoritative orders grouped by IST day
    const orders = await Order.find({
      createdAt: { $gte: startUtc, $lte: endUtc },
    }).lean();

    const orderDayMap = new Map<string, { orders: number; revenue: number }>();
    for (const o of orders) {
      if (isOrderPaidForFinance(o)) {
        const dayStr = getIstDateStr(new Date(o.createdAt));
        const curr = orderDayMap.get(dayStr) || { orders: 0, revenue: 0 };
        curr.orders++;
        curr.revenue += Number(o.total) || 0;
        orderDayMap.set(dayStr, curr);
      }
    }

    // Generate full contiguous calendar dates
    const results: any[] = [];
    const currDate = new Date(`${startDateStr}T00:00:00.000+05:30`);
    const endDate = new Date(`${endDateStr}T00:00:00.000+05:30`);

    while (currDate <= endDate) {
      const dayStr = getIstDateStr(currDate);
      const d = dailyMap.get(dayStr) || {};
      const ord = orderDayMap.get(dayStr) || { orders: 0, revenue: 0 };

      results.push({
        date: dayStr,
        visitors: d.uniqueVisitors || 0,
        pageViews: d.pageViews || 0,
        productViews: d.productViews || 0,
        cartAdds: d.cartAdds || 0,
        checkoutStarts: d.checkoutStarts || 0,
        orders: ord.orders,
        revenue: Math.round(ord.revenue * 100) / 100,
      });

      currDate.setDate(currDate.getDate() + 1);
    }

    res.json({ range: { startDateStr, endDateStr }, trends: results });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/admin/analytics/products
 * Returns product performance combining views, cart adds, units sold, purchasing orders, and conversion
 */
adminAnalyticsRoutes.get("/products", async (req, res, next) => {
  try {
    const { range, from, to } = req.query;
    const { startDateStr, endDateStr, startUtc, endUtc } = parseAnalyticsDateRange(
      range as string,
      from as string,
      to as string
    );

    const dailyRecords = await DailyAnalytics.find({
      date: { $gte: startDateStr, $lte: endDateStr },
    }).lean();

    // Aggregate daily product telemetry (views, uniqueViews, cartAdds)
    const productStats = new Map<
      string,
      {
        views: number;
        uniqueViews: number;
        cartAdds: number;
        unitsSold: number;
        purchasingOrders: number;
        revenue: number;
        name: string;
      }
    >();

    for (const d of dailyRecords) {
      if (d.products) {
        const prodEntries = d.products instanceof Map ? Array.from(d.products.entries()) : Object.entries(d.products);
        for (const [productId, stat] of prodEntries) {
          const s = stat as any;
          const curr = productStats.get(productId) || {
            views: 0,
            uniqueViews: 0,
            cartAdds: 0,
            unitsSold: 0,
            purchasingOrders: 0,
            revenue: 0,
            name: s.name || "",
          };
          curr.views += s.views || 0;
          curr.uniqueViews += s.uniqueViews || 0;
          curr.cartAdds += s.cartAdds || 0;
          if (s.name && !curr.name) curr.name = s.name;
          productStats.set(productId, curr);
        }
      }
    }

    // Authoritative paid orders in date range
    const orders = await Order.find({
      createdAt: { $gte: startUtc, $lte: endUtc },
    }).lean();

    for (const o of orders) {
      if (isOrderPaidForFinance(o)) {
        const seenInOrder = new Set<string>();
        for (const item of o.items || []) {
          const pId = String(item.productId || (item as any)._id || "");
          if (!pId) continue;
          const curr = productStats.get(pId) || {
            views: 0,
            uniqueViews: 0,
            cartAdds: 0,
            unitsSold: 0,
            purchasingOrders: 0,
            revenue: 0,
            name: (item as any).name || "Product",
          };
          curr.unitsSold += Number(item.qty) || 1;
          curr.revenue += (Number(item.price) || 0) * (Number(item.qty) || 1);
          if (!seenInOrder.has(pId)) {
            curr.purchasingOrders += 1;
            seenInOrder.add(pId);
          }
          if ((item as any).name && !curr.name) curr.name = (item as any).name;
          productStats.set(pId, curr);
        }
      }
    }

    // Populate catalog product details
    const productIds = Array.from(productStats.keys()).filter((id) => mongoose.Types.ObjectId.isValid(id));
    const catalogProducts = await Product.find({ _id: { $in: productIds } })
      .select("name image price stock category")
      .lean();

    const catalogMap = new Map(catalogProducts.map((p) => [String(p._id), p]));

    const list = Array.from(productStats.entries()).map(([id, stats]) => {
      const cat = catalogMap.get(id);
      const name = cat?.name || stats.name || "Unknown Product";
      const image = cat?.image || "";
      const price = cat?.price ?? 0;
      const stock = cat?.stock ?? 0;
      const category = cat?.category ?? "";

      const denominator = stats.uniqueViews > 0 ? stats.uniqueViews : stats.views;
      const viewToCartRate =
        denominator > 0 ? Math.min(100, Math.round((stats.cartAdds / denominator) * 10000) / 100) : null;
      const conversionRate =
        denominator > 0 ? Math.min(100, Math.round((stats.purchasingOrders / denominator) * 10000) / 100) : null;

      return {
        productId: id,
        name,
        image,
        category,
        price,
        stock,
        views: stats.views,
        uniqueViews: stats.uniqueViews,
        cartAdds: stats.cartAdds,
        unitsSold: stats.unitsSold,
        purchasingOrders: stats.purchasingOrders,
        revenue: Math.round(stats.revenue * 100) / 100,
        viewToCartRate,
        conversionRate,
      };
    });

    list.sort((a, b) => b.unitsSold - a.unitsSold || b.views - a.views);

    res.json({ range: { startDateStr, endDateStr }, products: list });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/admin/analytics/sources
 * Returns traffic source breakdown (sources, mediums, campaigns) with order attribution
 */
adminAnalyticsRoutes.get("/sources", async (req, res, next) => {
  try {
    const { range, from, to } = req.query;
    const { startDateStr, endDateStr, startUtc, endUtc } = parseAnalyticsDateRange(
      range as string,
      from as string,
      to as string
    );

    const dailyRecords = await DailyAnalytics.find({
      date: { $gte: startDateStr, $lte: endDateStr },
    }).lean();

    const sourceMap = new Map<string, number>();
    const mediumMap = new Map<string, number>();
    const campaignMap = new Map<string, number>();

    let totalSourceVisitors = 0;

    for (const d of dailyRecords) {
      if (d.sources) {
        const entries = d.sources instanceof Map ? Array.from(d.sources.entries()) : Object.entries(d.sources);
        for (const [k, v] of entries) {
          const cnt = Number(v) || 0;
          sourceMap.set(k, (sourceMap.get(k) || 0) + cnt);
          totalSourceVisitors += cnt;
        }
      }
      if (d.mediums) {
        const entries = d.mediums instanceof Map ? Array.from(d.mediums.entries()) : Object.entries(d.mediums);
        for (const [k, v] of entries) {
          mediumMap.set(k, (mediumMap.get(k) || 0) + (Number(v) || 0));
        }
      }
      if (d.campaigns) {
        const entries = d.campaigns instanceof Map ? Array.from(d.campaigns.entries()) : Object.entries(d.campaigns);
        for (const [k, v] of entries) {
          campaignMap.set(k, (campaignMap.get(k) || 0) + (Number(v) || 0));
        }
      }
    }

    // Attribute paid orders to traffic sources
    const orders = await Order.find({
      createdAt: { $gte: startUtc, $lte: endUtc },
    }).lean();

    const orderCountMap = new Map<string, number>();
    const orderRevenueMap = new Map<string, number>();

    for (const o of orders) {
      if (isOrderPaidForFinance(o)) {
        const src = resolveOrderSource(o);
        orderCountMap.set(src, (orderCountMap.get(src) || 0) + 1);
        orderRevenueMap.set(src, (orderRevenueMap.get(src) || 0) + (Number(o.total) || 0));
      }
    }

    const allSourceKeys = new Set<string>([...sourceMap.keys(), ...orderCountMap.keys()]);
    const sourcesList = Array.from(allSourceKeys)
      .map((name) => {
        const visitors = sourceMap.get(name) || 0;
        const ordersCount = orderCountMap.get(name) || 0;
        const revenue = Math.round((orderRevenueMap.get(name) || 0) * 100) / 100;
        const conversionRate =
          visitors > 0 ? Math.min(100, Math.round((ordersCount / visitors) * 10000) / 100) : null;
        const percentage =
          totalSourceVisitors > 0 ? Math.round((visitors / totalSourceVisitors) * 10000) / 100 : 0;

        return {
          name,
          count: visitors,
          visitors,
          orders: ordersCount,
          revenue,
          conversionRate,
          percentage,
        };
      })
      .sort((a, b) => b.orders - a.orders || b.visitors - a.visitors);

    const formatList = (m: Map<string, number>) =>
      Array.from(m.entries())
        .map(([name, count]) => ({
          name,
          count,
          percentage: totalSourceVisitors > 0 ? Math.round((count / totalSourceVisitors) * 10000) / 100 : 0,
        }))
        .sort((a, b) => b.count - a.count);

    res.json({
      range: { startDateStr, endDateStr },
      sources: sourcesList,
      mediums: formatList(mediumMap),
      campaigns: formatList(campaignMap),
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/admin/analytics/devices
 * Returns device classification breakdown (mobile, desktop, tablet, unknown) with order attribution
 */
adminAnalyticsRoutes.get("/devices", async (req, res, next) => {
  try {
    const { range, from, to } = req.query;
    const { startDateStr, endDateStr, startUtc, endUtc } = parseAnalyticsDateRange(
      range as string,
      from as string,
      to as string
    );

    const dailyRecords = await DailyAnalytics.find({
      date: { $gte: startDateStr, $lte: endDateStr },
    }).lean();

    const counts = {
      mobile: 0,
      desktop: 0,
      tablet: 0,
      unknown: 0,
    };

    for (const d of dailyRecords) {
      if (d.devices) {
        counts.mobile += d.devices.mobile || 0;
        counts.desktop += d.devices.desktop || 0;
        counts.tablet += d.devices.tablet || 0;
        counts.unknown += d.devices.unknown || 0;
      }
    }

    const total = counts.mobile + counts.desktop + counts.tablet + counts.unknown;

    // Attribute paid orders to device categories
    const orders = await Order.find({
      createdAt: { $gte: startUtc, $lte: endUtc },
    }).lean();

    const deviceOrders: Record<string, number> = { mobile: 0, desktop: 0, tablet: 0, unknown: 0 };
    const deviceRevenue: Record<string, number> = { mobile: 0, desktop: 0, tablet: 0, unknown: 0 };

    for (const o of orders) {
      if (isOrderPaidForFinance(o)) {
        const rawDev = o.analytics?.device;
        const devKey =
          rawDev && ["mobile", "desktop", "tablet", "unknown"].includes(rawDev) ? rawDev : "unknown";
        deviceOrders[devKey] = (deviceOrders[devKey] || 0) + 1;
        deviceRevenue[devKey] = (deviceRevenue[devKey] || 0) + (Number(o.total) || 0);
      }
    }

    const deviceCategories: { key: "mobile" | "desktop" | "tablet" | "unknown"; label: string }[] = [
      { key: "mobile", label: "Mobile" },
      { key: "desktop", label: "Desktop" },
      { key: "tablet", label: "Tablet" },
    ];
    if (counts.unknown > 0 || deviceOrders.unknown > 0) {
      deviceCategories.push({ key: "unknown", label: "Other / Unknown" });
    }

    const devices = deviceCategories.map(({ key, label }) => {
      const visitors = counts[key] || 0;
      const ordersCount = deviceOrders[key] || 0;
      const revenue = Math.round((deviceRevenue[key] || 0) * 100) / 100;
      const conversionRate =
        visitors > 0 ? Math.min(100, Math.round((ordersCount / visitors) * 10000) / 100) : null;
      const percentage = total > 0 ? Math.round((visitors / total) * 10000) / 100 : 0;

      return {
        device: key,
        label,
        count: visitors,
        visitors,
        orders: ordersCount,
        revenue,
        conversionRate,
        percentage,
      };
    });

    res.json({
      range: { startDateStr, endDateStr },
      total,
      devices,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/admin/analytics/abandoned
 * Detailed captured abandoned checkout metrics and recovery stats
 */
adminAnalyticsRoutes.get("/abandoned", async (req, res, next) => {
  try {
    const { range, from, to } = req.query;
    const { startDateStr, endDateStr, startUtc, endUtc } = parseAnalyticsDateRange(
      range as string,
      from as string,
      to as string
    );

    const sessions = await CheckoutSession.find({
      createdAt: { $gte: startUtc, $lte: endUtc },
    })
      .sort({ createdAt: -1 })
      .lean();

    let activeCount = 0;
    let abandonedCount = 0;
    let recoveredCount = 0;
    let cancelledCount = 0;
    let abandonedTotal = 0;
    let recoveredTotal = 0;
    let totalRecoveryEmails = 0;
    let recoveredWithEmail = 0;
    let modalDismissedCount = 0;

    for (const s of sessions) {
      if (s.status === "active") activeCount++;
      else if (s.status === "abandoned") {
        abandonedCount++;
        abandonedTotal += Number(s.total) || 0;
      } else if (s.status === "recovered") {
        recoveredCount++;
        recoveredTotal += Number(s.total) || 0;
        if ((s.recoverySentCount || 0) > 0) recoveredWithEmail++;
      } else if (s.status === "cancelled") {
        cancelledCount++;
      }

      totalRecoveryEmails += s.recoverySentCount || 0;
      if (s.metadata?.razorpayDismissedAt) {
        modalDismissedCount++;
      }
    }

    const totalCaptured = sessions.length;
    const capturedAbandonmentRate =
      abandonedCount + recoveredCount > 0
        ? Math.round((abandonedCount / (abandonedCount + recoveredCount)) * 10000) / 100
        : null;

    const emailRecoveryRate =
      totalRecoveryEmails > 0
        ? Math.round((recoveredWithEmail / totalRecoveryEmails) * 10000) / 100
        : null;

    res.json({
      range: { startDateStr, endDateStr },
      totalCaptured,
      activeCount,
      abandonedCount,
      recoveredCount,
      cancelledCount,
      abandonedTotal: Math.round(abandonedTotal * 100) / 100,
      recoveredTotal: Math.round(recoveredTotal * 100) / 100,
      capturedAbandonmentRate,
      totalRecoveryEmails,
      emailRecoveryRate,
      modalDismissedCount,
      recentAbandoned: sessions
        .filter((s) => s.status === "abandoned")
        .slice(0, 10)
        .map((s) => ({
          sessionId: s.sessionId,
          name: s.name || "Guest",
          itemsCount: s.items?.length || 0,
          total: s.total,
          abandonedAt: s.abandonedAt || s.lastActivityAt,
          recoverySentCount: s.recoverySentCount || 0,
          razorpayDismissed: Boolean(s.metadata?.razorpayDismissedAt),
        })),
    });
  } catch (err) {
    next(err);
  }
});

export default publicRouter;
