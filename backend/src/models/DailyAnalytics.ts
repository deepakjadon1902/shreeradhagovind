import { Schema, model, type Document } from "mongoose";
import { AnalyticsEvent, type IAnalyticsEvent } from "./AnalyticsEvent";
import { isOrderPaidForFinance } from "../routes/admin.routes";

export interface IDailyProductMetric {
  name: string;
  views: number;
  uniqueViews: number;
  cartAdds: number;
  unitsSold: number;
  revenue: number;
}

export interface IDailyDevices {
  mobile: number;
  desktop: number;
  tablet: number;
  unknown: number;
}

export interface IDailyAnalytics extends Document {
  date: string; // "YYYY-MM-DD", unique index
  pageViews: number;
  uniqueVisitors: number;
  productViews: number;
  uniqueProductViewers: number;
  cartAdds: number;
  uniqueCartVisitors: number;
  checkoutStarts: number;
  uniqueCheckoutVisitors: number;
  ordersPlaced: number;
  paidOrders: number;
  grossRevenue: number;
  abandonedCheckouts: number;
  recoveredCheckouts: number;
  recoveredRevenue: number;
  devices: IDailyDevices;
  sources: Map<string, number>;
  mediums: Map<string, number>;
  campaigns: Map<string, number>;
  products: Map<string, IDailyProductMetric>;
  createdAt: Date;
  updatedAt: Date;
}

const dailyProductMetricSchema = new Schema<IDailyProductMetric>(
  {
    name: { type: String, default: "" },
    views: { type: Number, default: 0 },
    uniqueViews: { type: Number, default: 0 },
    cartAdds: { type: Number, default: 0 },
    unitsSold: { type: Number, default: 0 },
    revenue: { type: Number, default: 0 },
  },
  { _id: false }
);

const dailyAnalyticsSchema = new Schema<IDailyAnalytics>(
  {
    date: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    pageViews: { type: Number, default: 0 },
    uniqueVisitors: { type: Number, default: 0 },
    productViews: { type: Number, default: 0 },
    uniqueProductViewers: { type: Number, default: 0 },
    cartAdds: { type: Number, default: 0 },
    uniqueCartVisitors: { type: Number, default: 0 },
    checkoutStarts: { type: Number, default: 0 },
    uniqueCheckoutVisitors: { type: Number, default: 0 },
    ordersPlaced: { type: Number, default: 0 },
    paidOrders: { type: Number, default: 0 },
    grossRevenue: { type: Number, default: 0 },
    abandonedCheckouts: { type: Number, default: 0 },
    recoveredCheckouts: { type: Number, default: 0 },
    recoveredRevenue: { type: Number, default: 0 },
    devices: {
      mobile: { type: Number, default: 0 },
      desktop: { type: Number, default: 0 },
      tablet: { type: Number, default: 0 },
      unknown: { type: Number, default: 0 },
    },
    sources: { type: Map, of: Number, default: () => new Map() },
    mediums: { type: Map, of: Number, default: () => new Map() },
    campaigns: { type: Map, of: Number, default: () => new Map() },
    products: { type: Map, of: dailyProductMetricSchema, default: () => new Map() },
  },
  { timestamps: true }
);

export const DailyAnalytics = model<IDailyAnalytics>("DailyAnalytics", dailyAnalyticsSchema);

/**
 * Returns YYYY-MM-DD formatted date string in Indian Standard Time (IST)
 */
export function getIstDateStr(d: Date = new Date()): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(d);
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

/**
 * Sanitizes map keys to prevent MongoDB dot-notation injection or invalid path collisions
 */
export function sanitizeKey(key?: string | null): string {
  if (!key || typeof key !== "string") return "direct";
  const cleaned = key.trim().toLowerCase().replace(/[\.\$\/\\\s]+/g, "_").slice(0, 50);
  return cleaned || "direct";
}

// In-memory daily uniqueness caches (cleared on day roll-over)
let cachedDateStr = "";
const seenVisitorsToday = new Set<string>();
const seenProductViewersToday = new Set<string>();
const seenCartVisitorsToday = new Set<string>();
const seenCheckoutVisitorsToday = new Set<string>();

function ensureCacheForDay(todayStr: string) {
  if (cachedDateStr !== todayStr) {
    seenVisitorsToday.clear();
    seenProductViewersToday.clear();
    seenCartVisitorsToday.clear();
    seenCheckoutVisitorsToday.clear();
    cachedDateStr = todayStr;
  }
}

/**
 * Resets the in-memory uniqueness sets (useful for testing post-restart behavior)
 */
export function clearDailyCachesForTesting(): void {
  seenVisitorsToday.clear();
  seenProductViewersToday.clear();
  seenCartVisitorsToday.clear();
  seenCheckoutVisitorsToday.clear();
  cachedDateStr = "";
}

/**
 * Atomically updates DailyAnalytics upon receiving a valid AnalyticsEvent
 */
export async function recordDailyEvent(event: {
  eventType: string;
  visitorId: string;
  sessionId: string;
  entityId?: string | null;
  path: string;
  device: string;
  referrer?: string;
  utm?: {
    source?: string;
    medium?: string;
    campaign?: string;
    term?: string;
    content?: string;
  };
  productName?: string;
  createdAt?: Date;
  currentEventId?: any;
}): Promise<void> {
  const eventDate = event.createdAt || new Date();
  const todayStr = getIstDateStr(eventDate);
  ensureCacheForDay(todayStr);

  const startOfDay = new Date(`${todayStr}T00:00:00.000+05:30`);

  let isUniqueVisitor = false;
  let isUniqueProductViewer = false;
  let isUniqueCartVisitor = false;
  let isUniqueCheckoutVisitor = false;

  const { eventType, visitorId, entityId, device, utm, referrer, currentEventId } = event;

  // 1. Check visitor uniqueness
  if (!seenVisitorsToday.has(visitorId)) {
    const visitorQuery: any = {
      visitorId,
      createdAt: { $gte: startOfDay },
    };
    if (currentEventId) {
      visitorQuery._id = { $ne: currentEventId };
    }
    const exists = await AnalyticsEvent.exists(visitorQuery);
    if (!exists) {
      isUniqueVisitor = true;
    }
    seenVisitorsToday.add(visitorId);
  }

  // 2. Check event-specific uniqueness
  if (eventType === "product_view" && entityId) {
    const key = `${visitorId}:${entityId}`;
    if (!seenProductViewersToday.has(key)) {
      const prodQuery: any = {
        visitorId,
        eventType: "product_view",
        entityId,
        createdAt: { $gte: startOfDay },
      };
      if (currentEventId) {
        prodQuery._id = { $ne: currentEventId };
      }
      const exists = await AnalyticsEvent.exists(prodQuery);
      if (!exists) {
        isUniqueProductViewer = true;
      }
      seenProductViewersToday.add(key);
    }
  } else if (eventType === "add_to_cart") {
    if (!seenCartVisitorsToday.has(visitorId)) {
      const cartQuery: any = {
        visitorId,
        eventType: "add_to_cart",
        createdAt: { $gte: startOfDay },
      };
      if (currentEventId) {
        cartQuery._id = { $ne: currentEventId };
      }
      const exists = await AnalyticsEvent.exists(cartQuery);
      if (!exists) {
        isUniqueCartVisitor = true;
      }
      seenCartVisitorsToday.add(visitorId);
    }
  } else if (eventType === "checkout_start") {
    if (!seenCheckoutVisitorsToday.has(visitorId)) {
      const checkoutQuery: any = {
        visitorId,
        eventType: "checkout_start",
        createdAt: { $gte: startOfDay },
      };
      if (currentEventId) {
        checkoutQuery._id = { $ne: currentEventId };
      }
      const exists = await AnalyticsEvent.exists(checkoutQuery);
      if (!exists) {
        isUniqueCheckoutVisitor = true;
      }
      seenCheckoutVisitorsToday.add(visitorId);
    }
  }

  // 3. Build atomic increments
  const inc: Record<string, number> = {};

  if (eventType === "page_view") {
    inc.pageViews = 1;
    if (isUniqueVisitor) inc.uniqueVisitors = 1;
  } else if (eventType === "product_view") {
    inc.productViews = 1;
    if (isUniqueVisitor) inc.uniqueVisitors = 1;
    if (isUniqueProductViewer) inc.uniqueProductViewers = 1;
    if (entityId) {
      inc[`products.${entityId}.views`] = 1;
      if (isUniqueProductViewer) inc[`products.${entityId}.uniqueViews`] = 1;
    }
  } else if (eventType === "add_to_cart") {
    inc.cartAdds = 1;
    if (isUniqueVisitor) inc.uniqueVisitors = 1;
    if (isUniqueCartVisitor) inc.uniqueCartVisitors = 1;
    if (entityId) {
      inc[`products.${entityId}.cartAdds`] = 1;
    }
  } else if (eventType === "checkout_start") {
    inc.checkoutStarts = 1;
    if (isUniqueVisitor) inc.uniqueVisitors = 1;
    if (isUniqueCheckoutVisitor) inc.uniqueCheckoutVisitors = 1;
  }

  // Device & Traffic Source increments (tracked only for unique visitors)
  if (isUniqueVisitor) {
    // Device counter
    if (device && ["mobile", "desktop", "tablet", "unknown"].includes(device)) {
      inc[`devices.${device}`] = 1;
    } else {
      inc[`devices.unknown`] = 1;
    }

    // Source counter
    if (utm?.source) {
      inc[`sources.${sanitizeKey(utm.source)}`] = 1;
    } else if (referrer) {
      try {
        const host = new URL(referrer).hostname.replace(/^www\./, "");
        inc[`sources.${sanitizeKey(host)}`] = 1;
      } catch {
        inc[`sources.direct`] = 1;
      }
    } else {
      inc[`sources.direct`] = 1;
    }

    // Medium counter
    if (utm?.medium) {
      inc[`mediums.${sanitizeKey(utm.medium)}`] = 1;
    }

    // Campaign counter
    if (utm?.campaign) {
      inc[`campaigns.${sanitizeKey(utm.campaign)}`] = 1;
    }
  }

  const setObj: Record<string, any> = {};
  if (entityId && event.productName) {
    setObj[`products.${entityId}.name`] = event.productName;
  }

  const updateDoc: Record<string, any> = {};
  if (Object.keys(inc).length > 0) {
    updateDoc.$inc = inc;
  }
  if (Object.keys(setObj).length > 0) {
    updateDoc.$set = setObj;
  }

  if (Object.keys(updateDoc).length > 0) {
    await DailyAnalytics.updateOne({ date: todayStr }, updateDoc, { upsert: true });
  }
}

/**
 * Atomically updates DailyAnalytics with authoritative order and revenue metrics
 */
export async function recordDailyOrder(order: any): Promise<void> {
  if (!order) return;
  const orderDate = order.createdAt ? new Date(order.createdAt) : new Date();
  const todayStr = getIstDateStr(orderDate);

  const isPaid = isOrderPaidForFinance(order);
  const inc: Record<string, number> = {
    ordersPlaced: 1,
  };

  if (isPaid) {
    inc.paidOrders = 1;
    inc.grossRevenue = Math.round((Number(order.total) || 0) * 100) / 100;
  }

  // Track product units and revenue
  const items = Array.isArray(order.items) ? order.items : [];
  for (const item of items) {
    const productId = String(item.productId || item._id || "");
    if (!productId) continue;

    const qty = Number(item.qty) || 1;
    inc[`products.${productId}.unitsSold`] = (inc[`products.${productId}.unitsSold`] || 0) + qty;
    if (isPaid) {
      const price = Number(item.price) || 0;
      inc[`products.${productId}.revenue`] =
        (inc[`products.${productId}.revenue`] || 0) + Math.round(price * qty * 100) / 100;
    }
  }

  await DailyAnalytics.updateOne({ date: todayStr }, { $inc: inc }, { upsert: true });
}
