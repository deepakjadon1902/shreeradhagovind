import fetch from "node-fetch";
import { env } from "../config/env";
import { Order } from "../models/Order";
import "../models/User";
import { SyncLock } from "../models/SyncLock";
import { TrackingUsage } from "../models/TrackingUsage";
import {
  sendOrderStatusUpdate,
  dispatchOrderDeliveredEmailOnce,
  buildEmailOrderPayload,
} from "../utils/email";
import {
  getDirectCourierAdapter,
  getAllDirectCourierAdapters,
  fetchShreeMarutiApi,
  normalizeShreeMarutiResponse,
  fetchDelhiveryApi,
  normalizeDelhiveryResponse,
  fetchBlueDartApi,
  normalizeBlueDartResponse,
  fetchDtdcShipsyApi,
  normalizeDtdcShipsyResponse,
} from "./courier/registry";

export {
  getDirectCourierAdapter,
  getAllDirectCourierAdapters,
  fetchShreeMarutiApi,
  normalizeShreeMarutiResponse,
  fetchDelhiveryApi,
  normalizeDelhiveryResponse,
  fetchBlueDartApi,
  normalizeBlueDartResponse,
  fetchDtdcShipsyApi,
  normalizeDtdcShipsyResponse,
};

export interface CourierCheckpoint {
  time: string;
  location: string;
  description: string;
  status?: string;
}

export interface NormalizedTrackingData {
  status:
    | "info_received"
    | "in_transit"
    | "out_for_delivery"
    | "delivered"
    | "exception"
    | "undelivered"
    | "unknown";
  latestStatus: string;
  latestMessage: string;
  currentLocation: string;
  origin: string | null;
  destination: string | null;
  expectedDeliveryDate: string | null;
  checkpoints: CourierCheckpoint[];
  lastUpdated: string;
  lastCarrierScanAt?: string | null;
  hasCarrierScans?: boolean;
  provider: "trackcourier" | "carrier_direct";
  quotaExceeded?: boolean;
}

const COURIER_SLUG_MAP: Record<string, string> = {
  "shree maruti": "shreemaruti",
  "shree murti": "shreemaruti",
  shreemaruti: "shreemaruti",
  dtdc: "dtdc",
  delhivery: "delhivery",
  bluedart: "bluedart",
  "blue dart": "bluedart",
  ekart: "ekart",
  "ekart logistics": "ekart",
  "india post": "indiapost",
  indiapost: "indiapost",
};

export function getTrackCourierSlug(courier?: string | null): string | null {
  if (!courier) return null;
  const normalized = courier.trim().toLowerCase();
  if (COURIER_SLUG_MAP[normalized]) return COURIER_SLUG_MAP[normalized];
  if (normalized.includes("maruti") || normalized.includes("murti")) return "shreemaruti";
  if (normalized.includes("dtdc")) return "dtdc";
  if (normalized.includes("delhivery")) return "delhivery";
  if (normalized.includes("bluedart") || normalized.includes("blue dart")) return "bluedart";
  if (normalized.includes("ekart")) return "ekart";
  if (normalized.includes("india post") || normalized.includes("indiapost")) return "indiapost";
  if (normalized.includes("shadowfax")) return "shadowfax";
  if (normalized.includes("xpressbees")) return "xpressbees";
  if (normalized.includes("ecom express") || normalized.includes("ecomexpress")) return "ecomexpress";
  if (normalized.includes("trackon")) return "trackon";
  if (normalized.includes("gati")) return "gati";
  if (normalized.includes("safexpress")) return "safexpress";
  if (normalized.includes("professional")) return "professional";
  return null;
}

// ---------------------------------------------------------------------------
// Persistent Quota & Budget Management (MongoDB Backed)
// ---------------------------------------------------------------------------
let quotaUsed = 0;
let quotaTotal = 100;
let quotaExhausted = false;

export function getMonthlyBudget(): number {
  return env.TRACKCOURIER_MONTHLY_BUDGET || 80;
}

export function getCurrentMonthKey(): string {
  return new Date().toISOString().slice(0, 7); // e.g. "2026-09"
}

export function isBudgetExhausted(): boolean {
  if (quotaExhausted) return true;
  return quotaUsed >= getMonthlyBudget();
}

/**
 * Atomically reserves 1 request in MongoDB for the current calendar month
 * if used < budget. Returns granted: false if monthly budget is exhausted.
 */
export async function reserveMonthlyQuota(budget = getMonthlyBudget()): Promise<{
  granted: boolean;
  currentUsed: number;
  monthKey: string;
}> {
  const monthKey = getCurrentMonthKey();
  const now = new Date();

  try {
    const updated = await TrackingUsage.findOneAndUpdate(
      {
        _id: monthKey,
        used: { $lt: budget },
      },
      {
        $inc: { used: 1 },
        $set: { budget, updatedAt: now },
      },
      { new: true }
    );

    if (updated) {
      quotaUsed = updated.used;
      if (quotaUsed >= budget) quotaExhausted = true;
      return { granted: true, currentUsed: updated.used, monthKey };
    }

    const existing = await TrackingUsage.findById(monthKey);
    if (existing) {
      quotaUsed = existing.used;
      quotaExhausted = true;
      return { granted: false, currentUsed: existing.used, monthKey };
    }

    // Month document not created yet — create initial record
    try {
      const created = await TrackingUsage.create({
        _id: monthKey,
        used: 1,
        budget,
        updatedAt: now,
      });
      quotaUsed = created.used;
      return { granted: true, currentUsed: created.used, monthKey };
    } catch {
      // Collision on insert: retry once
      return reserveMonthlyQuota(budget);
    }
  } catch {
    // Fallback to in-memory check if DB is unavailable
    if (isBudgetExhausted()) {
      return { granted: false, currentUsed: getMonthlyBudget(), monthKey };
    }
    quotaUsed += 1;
    return { granted: true, currentUsed: quotaUsed, monthKey };
  }
}

/**
 * Persists provider usage figures returned by TrackCourier.
 */
export async function recordProviderUsage(
  monthKey: string,
  usageData: { used?: number; quota?: number; remaining?: number }
): Promise<void> {
  if (!usageData) return;
  try {
    if (typeof usageData.used === "number") {
      quotaUsed = usageData.used;
    }
    if (typeof usageData.quota === "number") {
      quotaTotal = usageData.quota;
    }
    if (quotaUsed >= getMonthlyBudget()) {
      quotaExhausted = true;
    }

    const update: any = {
      $set: {
        providerUsage: usageData,
        updatedAt: new Date(),
      },
    };
    if (typeof usageData.used === "number") {
      update.$max = { used: usageData.used };
    }

    await TrackingUsage.updateOne({ _id: monthKey }, update);
  } catch (err) {
    console.error("[courierTracking] Failed to record provider usage:", err);
  }
}

// ---------------------------------------------------------------------------
// Configurable TTLs
// ---------------------------------------------------------------------------
export function getInTransitTtlMs(): number {
  const hours = env.TRACKING_IN_TRANSIT_REFRESH_HOURS || 24;
  return hours * 60 * 60 * 1000;
}

export function getOfdTtlMs(): number {
  const minutes = env.TRACKING_OFD_REFRESH_MINUTES || 120;
  return minutes * 60 * 1000;
}

export function getCacheTtlForStatus(orderStatus: string): number {
  if (orderStatus === "Out for delivery") return getOfdTtlMs();
  return getInTransitTtlMs();
}

// In-memory cache: key = "slug:AWB"
const memoryCache = new Map<string, { data: NormalizedTrackingData; fetchedAt: number }>();

// In-flight request deduplication: concurrent requests for same AWB share one promise
const inFlightRequests = new Map<string, Promise<NormalizedTrackingData | null>>();

// Rate limiter: enforce at least 500ms spacing between outbound requests (≤2 req/sec)
let lastOutboundCallTime = 0;
async function throttleOutboundRequest(): Promise<void> {
  const now = Date.now();
  const diff = now - lastOutboundCallTime;
  if (diff < 500) {
    await new Promise((resolve) => setTimeout(resolve, 500 - diff));
  }
  lastOutboundCallTime = Date.now();
}

/**
 * Normalizes TrackCourier.io API response into our internal consistent tracking structure.
 * Never fabricates origin — returns null when provider does not supply it.
 */
export function normalizeTrackCourierResponse(
  raw: any,
  courierName: string,
  _trackingNumber: string
): NormalizedTrackingData {
  if (raw?.usage) {
    quotaUsed = raw.usage.used ?? quotaUsed;
    quotaTotal = raw.usage.quota ?? quotaTotal;
    if (quotaUsed >= getMonthlyBudget()) {
      quotaExhausted = true;
      console.warn(`[courierTracking] Monthly provider budget (${getMonthlyBudget()}) reached.`);
    }
  }

  if (raw?.error?.code === "QUOTA_EXCEEDED") {
    quotaExhausted = true;
    console.warn("[courierTracking] QUOTA_EXCEEDED received from provider.");
    return {
      status: "unknown",
      latestStatus: "Tracking temporarily unavailable",
      latestMessage: "Shipment tracking is temporarily unavailable. Please check back later.",
      currentLocation: "",
      origin: null,
      destination: null,
      expectedDeliveryDate: null,
      checkpoints: [],
      lastUpdated: new Date().toISOString(),
      provider: "trackcourier",
      quotaExceeded: true,
    };
  }

  const data = raw?.data || raw || {};
  const rawStatus = String(
    data.ShipmentState ||
    data.MostRecentStatus ||
    data.status ||
    ""
  ).toLowerCase().trim();

  // Check if provider explicitly indicates no shipment record or empty table
  const noRecord = Boolean(
    data.CourierHasNoRecordOfShipment === true ||
    data.isEmptyTable === true ||
    (data.Result === "failure" && (!data.Checkpoints || data.Checkpoints.length === 0))
  );

  const rawCheckpoints: any[] = Array.isArray(data.Checkpoints)
    ? data.Checkpoints
    : Array.isArray(data.checkpoints)
      ? data.checkpoints
      : Array.isArray(data.scans)
        ? data.scans
        : [];

  // Filter out notice/informational messages that are not physical carrier scans
  const validRawCheckpoints = rawCheckpoints.filter((cp) => {
    const act = String(cp.Activity || cp.description || cp.message || "").toLowerCase();
    if (
      act.includes("no information present") ||
      act.includes("bookmark the page") ||
      act.includes("check the results on") ||
      act.includes("awaiting results")
    ) {
      return false;
    }
    return true;
  });

  const checkpoints: CourierCheckpoint[] = validRawCheckpoints.map((cp) => {
    let timeStr = "";
    if (cp.Date && cp.Time) {
      timeStr = `${cp.Date} ${cp.Time}`.trim();
    } else if (cp.Date) {
      timeStr = String(cp.Date).trim();
    } else {
      timeStr = cp.time || cp.date || cp.timestamp || new Date().toISOString();
    }

    return {
      time: timeStr,
      location: (cp.Location || cp.location || cp.city || "").trim(),
      description: (cp.Activity || cp.description || cp.status || cp.message || "Status update").trim(),
      status: cp.CheckpointState || cp.status || undefined,
    };
  });

  // Sort checkpoints chronologically (oldest first, latest last)
  checkpoints.sort((a, b) => {
    const tA = new Date(a.time).getTime();
    const tB = new Date(b.time).getTime();
    if (isNaN(tA) || isNaN(tB)) return 0;
    return tA - tB;
  });

  const hasCarrierScans = checkpoints.length > 0;
  const latestCheckpoint = hasCarrierScans ? checkpoints[checkpoints.length - 1] : null;
  const lastCarrierScanAt = latestCheckpoint ? latestCheckpoint.time : null;

  const latestCheckpointDesc = (latestCheckpoint?.description || "").toLowerCase();
  const latestCheckpointState = String(latestCheckpoint?.status || "").toLowerCase();

  let normalizedStatus: NormalizedTrackingData["status"] = "unknown";
  let latestStatusLabel = "In Transit";

  if (!raw || raw.success === false || raw.notFound) {
    normalizedStatus = "unknown";
    latestStatusLabel = "Tracking Initialized";
  } else if (
    noRecord ||
    (!hasCarrierScans &&
      (rawStatus.includes("pending") ||
        rawStatus.includes("book") ||
        rawStatus.includes("manifest") ||
        rawStatus.includes("info") ||
        rawStatus.includes("created") ||
        !rawStatus))
  ) {
    normalizedStatus = "info_received";
    latestStatusLabel = "Awaiting Carrier Scan";
  } else if (
    (rawStatus.includes("deliver") && !rawStatus.includes("out")) ||
    latestCheckpointDesc.includes("delivered") ||
    latestCheckpointState === "delivered"
  ) {
    normalizedStatus = "delivered";
    latestStatusLabel = "Delivered";
  } else if (
    rawStatus.includes("out") ||
    rawStatus.includes("out_for_delivery") ||
    latestCheckpointDesc.includes("out for delivery") ||
    latestCheckpointState === "out_for_delivery"
  ) {
    normalizedStatus = "out_for_delivery";
    latestStatusLabel = "Out for Delivery";
  } else if (
    rawStatus.includes("transit") ||
    rawStatus.includes("pickup") ||
    rawStatus.includes("picked") ||
    rawStatus.includes("reach") ||
    rawStatus.includes("dispatch") ||
    latestCheckpointDesc.includes("transit") ||
    latestCheckpointDesc.includes("in transit")
  ) {
    normalizedStatus = "in_transit";
    latestStatusLabel = "In Transit";
  } else if (
    rawStatus.includes("exception") ||
    rawStatus.includes("undeliver") ||
    rawStatus.includes("fail") ||
    rawStatus.includes("rto") ||
    latestCheckpointDesc.includes("exception") ||
    latestCheckpointDesc.includes("undelivered") ||
    latestCheckpointDesc.includes("failed")
  ) {
    normalizedStatus = "exception";
    latestStatusLabel = "Delivery Exception";
  } else if (
    rawStatus.includes("info") ||
    rawStatus.includes("manifest") ||
    rawStatus.includes("book") ||
    rawStatus.includes("created") ||
    rawStatus.includes("pending")
  ) {
    normalizedStatus = "info_received";
    latestStatusLabel = "Awaiting Carrier Scan";
  } else {
    normalizedStatus = hasCarrierScans ? "in_transit" : "unknown";
    latestStatusLabel = data.MostRecentStatus || (hasCarrierScans ? "In Transit" : "Awaiting Carrier Scan");
  }

  const latestMessage = !hasCarrierScans
    ? `Consignment booked with ${courierName}. Awaiting initial scan from carrier sorting facility.`
    : latestCheckpoint?.description ||
      data.MostRecentStatus ||
      data.latest_status ||
      data.status_description ||
      `Shipment update from ${courierName}`;

  // Only report a current location if the carrier has actually reported one; do not fabricate
  const currentLocation = hasCarrierScans
    ? (latestCheckpoint?.location || data.CurrentLocation || data.current_location || "").trim()
    : "";

  const origin = (data.OriginCity || data.origin || data.from || null)?.trim() || null;
  const destination = (data.DestinationCity || data.destination || data.to || null)?.trim() || null;
  const expectedDeliveryDate = data.ExpectedDeliveryDate || data.expected_delivery || null;

  return {
    status: normalizedStatus,
    latestStatus: latestStatusLabel,
    latestMessage,
    currentLocation,
    origin,
    destination,
    expectedDeliveryDate,
    checkpoints,
    lastUpdated: new Date().toISOString(),
    lastCarrierScanAt,
    hasCarrierScans,
    provider: "trackcourier",
  };
}

/**
 * Performs authenticated, rate-limited request to TrackCourier.io v1 API.
 * Never logs or exposes the API key.
 * Respects monthly safety budget.
 */
export async function fetchTrackCourierApi(
  courierSlug: string,
  trackingNumber: string
): Promise<any> {
  const apiKey = (env.TRACKCOURIER_API_KEY || "").trim();
  if (!apiKey) {
    return null;
  }

  // Atomically check & reserve persistent monthly quota in MongoDB
  const reservation = await reserveMonthlyQuota(getMonthlyBudget());
  if (!reservation.granted) {
    console.warn(`[courierTracking] Persistent monthly provider budget (${getMonthlyBudget()}) reached. Skipping remote call.`);
    return { success: false, error: { code: "QUOTA_EXCEEDED", message: "Monthly budget reached." } };
  }

  await throttleOutboundRequest();

  const url = `https://api.trackcourier.io/v1/track?courier=${encodeURIComponent(
    courierSlug
  )}&tracking_number=${encodeURIComponent(trackingNumber)}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6000);

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "X-API-Key": apiKey,
        Accept: "application/json",
      },
      signal: controller.signal as any,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      if (res.status === 402 || res.status === 429) {
        quotaExhausted = true;
        console.warn(`[courierTracking] HTTP ${res.status} from provider — quota exhausted.`);
        return { success: false, error: { code: "QUOTA_EXCEEDED", message: "Monthly quota exhausted." } };
      }
      if (res.status === 404 || res.status === 400) {
        return { success: false, notFound: true };
      }
      return null;
    }

    const json: any = await res.json();

    if (json?.error?.code === "QUOTA_EXCEEDED") {
      quotaExhausted = true;
      console.warn("[courierTracking] QUOTA_EXCEEDED in response body.");
      return json;
    }

    if (json?.usage) {
      await recordProviderUsage(reservation.monthKey, json.usage);
    }

    return json;
  } catch {
    clearTimeout(timeoutId);
    return null;
  }
}

/**
 * Retrieves tracking data for an order.
 *
 * Polling Safety & Cache Isolation:
 * - Customer GET endpoints call this with default options (allowRemoteFetch = false or checking strict TTL).
 * - Terminal orders (Delivered, Cancelled) NEVER make remote provider calls.
 * - Non-shipped orders (Placed, Confirmed, Processing, Hold, Packed) NEVER make remote provider calls.
 * - Remote provider calls happen only when allowRemoteFetch = true (from background sync or explicit manual refresh).
 */
export async function syncOrderTracking<T = any>(
  orderOrId: T,
  options?: { allowRemoteFetch?: boolean; forceRefresh?: boolean }
): Promise<{ order: T; tracking: NormalizedTrackingData | null }> {
  let order: any =
    typeof orderOrId === "string" ? await Order.findById(orderOrId).populate("user", "name email") : orderOrId;

  if (!order) {
    return { order: null as any, tracking: null };
  }

  const courier = order.courier;
  const trackingId = order.trackingId;

  if (!courier || !trackingId || !courier.trim() || !trackingId.trim()) {
    return { order, tracking: order.courierTrackingData || null };
  }

  const courierSlug = getTrackCourierSlug(courier);
  if (!courierSlug) {
    return { order, tracking: order.courierTrackingData || null };
  }

  const cacheKey = `${courierSlug}:${trackingId.trim().toUpperCase()}`;
  const now = Date.now();

  // 1. Terminal states: NEVER call provider again — always serve cached data
  if (order.status === "Delivered" || order.status === "Cancelled") {
    if (order.courierTrackingData) {
      return { order, tracking: order.courierTrackingData };
    }
    const mem = memoryCache.get(cacheKey);
    if (mem) {
      return { order, tracking: mem.data };
    }
    return { order, tracking: null };
  }

  // 2. Non-shipped states (Placed, Confirmed, Processing, Hold, Packed): NEVER call provider
  if (
    order.status !== "Shipped" &&
    order.status !== "Out for delivery"
  ) {
    return { order, tracking: order.courierTrackingData || null };
  }

  const cacheTtl = options?.forceRefresh ? 0 : getCacheTtlForStatus(order.status);

  // 3. Check in-memory cache
  const memCached = memoryCache.get(cacheKey);
  if (!options?.forceRefresh && memCached && now - memCached.fetchedAt < cacheTtl) {
    return { order, tracking: memCached.data };
  }

  // 4. Check DB persisted cache
  if (
    !options?.forceRefresh &&
    order.courierTrackingData &&
    order.courierTrackingLastFetchedAt &&
    now - new Date(order.courierTrackingLastFetchedAt).getTime() < cacheTtl
  ) {
    memoryCache.set(cacheKey, {
      data: order.courierTrackingData,
      fetchedAt: new Date(order.courierTrackingLastFetchedAt).getTime(),
    });
    return { order, tracking: order.courierTrackingData };
  }

  const directAdapter = getDirectCourierAdapter(courier);
  const isDirectActive = Boolean(directAdapter && directAdapter.isConfigured());

  // 5. Remote fetch authorization:
  // - If caller explicitly disallowed remote fetch ({ allowRemoteFetch: false }), strictly serve cached data
  if (options?.allowRemoteFetch === false && !options?.forceRefresh) {
    return { order, tracking: order.courierTrackingData || memCached?.data || null };
  }

  // - When allowRemoteFetch is not explicitly false:
  //   * Allow if forceRefresh or allowRemoteFetch is true
  //   * Allow if direct carrier adapter is active (no third-party budget, throttled + in-flight deduped)
  //   * Allow if order has NO cached tracking data yet (initial sync for shipped order)
  const isCacheMissing = !order.courierTrackingData && !memCached;
  const isPermittedFetch =
    options?.allowRemoteFetch === true ||
    options?.forceRefresh === true ||
    isDirectActive ||
    isCacheMissing;

  if (!isPermittedFetch) {
    return { order, tracking: order.courierTrackingData || memCached?.data || null };
  }

  // 6. Check budget before proceeding to remote call (skip budget check if direct carrier adapter handles the request)
  if (!isDirectActive && isBudgetExhausted()) {
    return { order, tracking: order.courierTrackingData || memCached?.data || null };
  }

  // 7. In-flight deduplication: concurrent requests for same AWB share one outbound HTTP call
  let fetchPromise = inFlightRequests.get(cacheKey);
  if (!fetchPromise) {
    fetchPromise = (async () => {
      try {
        let normalized: NormalizedTrackingData | null = null;

        // 1. Query direct carrier adapter if configured (Shree Maruti, Delhivery, Blue Dart)
        if (directAdapter && directAdapter.isConfigured()) {
          normalized = await directAdapter.fetchTracking(trackingId.trim());
        }

        // 2. If not handled by direct adapter (or if not configured), query TrackCourier
        if (!normalized) {
          if (isBudgetExhausted()) {
            return order.courierTrackingData || memCached?.data || null;
          }

          const raw = await fetchTrackCourierApi(courierSlug, trackingId.trim());

          if (raw?.error?.code === "QUOTA_EXCEEDED") {
            return order.courierTrackingData || memCached?.data || null;
          }

          if (!raw || raw.notFound || raw.success === false) {
            return order.courierTrackingData || memCached?.data || null;
          }

          normalized = normalizeTrackCourierResponse(raw, courier, trackingId.trim());

          if (normalized.quotaExceeded) {
            return order.courierTrackingData || memCached?.data || null;
          }
        }

        return normalized;
      } catch {
        return order.courierTrackingData || memCached?.data || null;
      } finally {
        inFlightRequests.delete(cacheKey);
      }
    })();

    inFlightRequests.set(cacheKey, fetchPromise);
  }

  const trackingResult = await fetchPromise;

  if (trackingResult && !trackingResult.quotaExceeded) {
    memoryCache.set(cacheKey, { data: trackingResult, fetchedAt: now });

    // Evaluate state machine transitions
    let statusChanged = false;
    let newStatus: string | null = null;
    let transitionNote = "";

    // 1. pending / info_received / no carrier scan: keep store status Shipped (no state change)
    // 2. in_transit: keep store status Shipped (no state change)
    // 3. exception / undelivered: preserve safe store status, do NOT mark Delivered; exception details saved in courierTrackingData
    // 4. out_for_delivery: only allowed from "Shipped" (never downgrade from "Delivered")
    if (trackingResult.status === "out_for_delivery") {
      if (order.status === "Shipped") {
        newStatus = "Out for delivery";
        transitionNote = trackingResult.latestMessage || "Package is out for delivery with courier";
      }
    }
    // 5. delivered: allowed from "Shipped" or "Out for delivery" (never downgrade)
    else if (trackingResult.status === "delivered") {
      if (order.status === "Shipped" || order.status === "Out for delivery") {
        newStatus = "Delivered";
        transitionNote = trackingResult.latestMessage || "Package successfully delivered by courier";
      }
    }

    const updates: any = {
      courierTrackingData: trackingResult,
      courierTrackingLastFetchedAt: new Date(now),
    };

    // Duplicate sync must not create duplicate statusHistory records:
    // Only push if newStatus is valid, different from current order.status,
    // and not already recorded in statusHistory for this status by courier_sync
    const lastHistory =
      Array.isArray(order.statusHistory) && order.statusHistory.length > 0
        ? order.statusHistory[order.statusHistory.length - 1]
        : null;
    const isDuplicate =
      lastHistory?.status === newStatus && lastHistory?.changedBy === "courier_sync";

    if (newStatus && newStatus !== order.status && !isDuplicate) {
      statusChanged = true;
      updates.status = newStatus;
      updates.$push = {
        statusHistory: {
          status: newStatus,
          changedAt: new Date(),
          changedBy: "courier_sync",
          note: transitionNote,
          holdReason: "",
        },
      };
    }

    const updatedDoc = await Order.findByIdAndUpdate(order._id, updates, {
      new: true,
    }).populate("user", "name email");

    if (updatedDoc) {
      order = updatedDoc;

      if (statusChanged && newStatus) {
        const recipientEmail = order.customerEmail || (order.user as any)?.email;
        const recipientName = order.address?.name || (order.user as any)?.name || "Customer";
        if (recipientEmail) {
          if (newStatus === "Delivered") {
            dispatchOrderDeliveredEmailOnce(
              order._id,
              recipientEmail,
              recipientName,
              buildEmailOrderPayload(order) as any
            ).catch((err) => {
              console.error("[courierTracking] Failed to send delivered status update email:", err);
            });
          } else {
            sendOrderStatusUpdate(
              recipientEmail,
              recipientName,
              buildEmailOrderPayload(order) as any
            ).catch((err) => {
              console.error("[courierTracking] Failed to send status update email:", err);
            });
          }
        }
      }
    }
  }

  return { order, tracking: trackingResult || order.courierTrackingData || null };
}

/**
 * Handles explicit customer/admin manual tracking refresh request with quota & cooldown protection.
 */
export async function requestManualTrackingRefresh(
  orderIdOrDoc: any
): Promise<{
  success: boolean;
  message: string;
  tracking?: NormalizedTrackingData | null;
  refreshed?: boolean;
}> {
  let order: any =
    typeof orderIdOrDoc === "string"
      ? await Order.findById(orderIdOrDoc)
      : orderIdOrDoc;

  if (!order) {
    return { success: false, message: "Order not found." };
  }

  if (order.status === "Delivered" || order.status === "Cancelled") {
    return {
      success: true,
      refreshed: false,
      message: "Order has reached final status.",
      tracking: order.courierTrackingData || null,
    };
  }

  if (isBudgetExhausted()) {
    return {
      success: true,
      refreshed: false,
      message: "Tracking was updated recently. Please check again later.",
      tracking: order.courierTrackingData || null,
    };
  }

  const now = Date.now();
  const lastFetched = order.courierTrackingLastFetchedAt
    ? new Date(order.courierTrackingLastFetchedAt).getTime()
    : 0;

  // Minimum cooldown between manual refreshes: 4 hours for in-transit, 30 min for OFD
  const cooldownMs = order.status === "Out for delivery" ? 30 * 60 * 1000 : 4 * 60 * 60 * 1000;
  if (now - lastFetched < cooldownMs) {
    return {
      success: true,
      refreshed: false,
      message: "Tracking was updated recently. Please check again later.",
      tracking: order.courierTrackingData || null,
    };
  }

  const synced = await syncOrderTracking(order, {
    allowRemoteFetch: true,
    forceRefresh: true,
  });

  return {
    success: true,
    refreshed: true,
    message: "Tracking updated successfully.",
    tracking: synced.tracking,
  };
}

// ---------------------------------------------------------------------------
// Background Sync Engine (Deployment-Safe with Distributed Lock)
// ---------------------------------------------------------------------------
export const LOCK_KEY = "courier_tracking_sync";
export const LOCK_LEASE_MS = 10 * 60 * 1000; // 10 minutes lease timeout

let isSyncRunning = false;

export async function acquireDistributedLock(
  processId: string,
  lockKey = LOCK_KEY,
  leaseMs = LOCK_LEASE_MS
): Promise<boolean> {
  const now = new Date();
  const expiresAt = new Date(Date.now() + leaseMs);

  try {
    const doc = await SyncLock.findById(lockKey);
    if (doc) {
      if (doc.expiresAt && doc.expiresAt.getTime() > now.getTime()) {
        // Lock currently held and active
        return false;
      }
      // Lock expired, take over
      const updated = await SyncLock.findOneAndUpdate(
        { _id: lockKey, expiresAt: doc.expiresAt },
        { $set: { lockedAt: now, lockedBy: processId, expiresAt } },
        { new: true }
      );
      return Boolean(updated);
    } else {
      // Create new lock
      try {
        await SyncLock.create({
          _id: lockKey,
          lockedAt: now,
          lockedBy: processId,
          expiresAt,
        });
        return true;
      } catch {
        // Race condition: another process created it concurrently
        return false;
      }
    }
  } catch {
    return false;
  }
}

export async function releaseDistributedLock(
  processId: string,
  lockKey = LOCK_KEY
): Promise<void> {
  try {
    await SyncLock.deleteOne({ _id: lockKey, lockedBy: processId });
  } catch {
    // ignore
  }
}

/**
 * Scans all active shipments (Shipped, Out for delivery) and refreshes any whose TTL has expired,
 * respecting the monthly budget limit. Protected by distributed lock against multi-process collision.
 */
export async function syncAllActiveShipments(): Promise<{
  totalActive: number;
  refreshed: number;
  transitions: number;
  skippedBudget: boolean;
  skippedLock?: boolean;
}> {
  if (isSyncRunning) {
    return { totalActive: 0, refreshed: 0, transitions: 0, skippedBudget: false, skippedLock: true };
  }

  const processId = `${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const lockAcquired = await acquireDistributedLock(processId);
  if (!lockAcquired) {
    console.info("[courierTracking] Background sync skipped: another process holds the active distributed lock.");
    return { totalActive: 0, refreshed: 0, transitions: 0, skippedBudget: false, skippedLock: true };
  }

  if (isBudgetExhausted()) {
    console.info(`[courierTracking] TrackCourier monthly budget (${getMonthlyBudget()}) reached. Direct carrier shipments will still sync.`);
  }

  isSyncRunning = true;
  let refreshed = 0;
  let transitions = 0;
  let totalActive = 0;

  try {
    const activeOrders = await Order.find({
      status: { $in: ["Shipped", "Out for delivery"] },
      courier: { $ne: null, $nin: ["", " "] },
      trackingId: { $ne: null, $nin: ["", " "] },
    }).populate("user", "name email");

    totalActive = activeOrders.length;
    const now = Date.now();

    for (const order of activeOrders) {
      const directAdapter = getDirectCourierAdapter(order.courier);
      const isDirect = Boolean(directAdapter && directAdapter.isConfigured());

      if (!isDirect && isBudgetExhausted()) {
        continue;
      }

      // Guard: skip orders missing courier or trackingId
      if (!order.courier || !order.courier.trim() || !order.trackingId || !order.trackingId.trim()) {
        continue;
      }

      // Guard: terminal orders stop polling
      if (order.status === "Delivered" || order.status === "Cancelled") {
        continue;
      }

      const ttl = getCacheTtlForStatus(order.status);
      const lastFetched = order.courierTrackingLastFetchedAt
        ? new Date(order.courierTrackingLastFetchedAt).getTime()
        : 0;

      // Skip if still within cache TTL
      if (now - lastFetched < ttl) {
        continue;
      }

      const prevStatus = order.status;
      const synced = await syncOrderTracking(order, { allowRemoteFetch: true });
      refreshed++;

      if (synced.order && synced.order.status !== prevStatus) {
        transitions++;
      }
    }

    if (refreshed > 0 || transitions > 0) {
      console.info(
        `[courierTracking] Background sync completed: ${totalActive} active shipments checked, ${refreshed} refreshed from provider, ${transitions} status transitions.`
      );
    }
  } catch (err) {
    console.error("[courierTracking] Error during background sync run:", err);
  } finally {
    isSyncRunning = false;
    await releaseDistributedLock(processId);
  }

  return { totalActive, refreshed, transitions, skippedBudget: false };
}

// ---------------------------------------------------------------------------
// Scheduler Management
// ---------------------------------------------------------------------------
let schedulerIntervalId: NodeJS.Timeout | null = null;

/**
 * Starts the background sync scheduler in a safe, controlled manner.
 */
export function startCourierTrackingScheduler(): void {
  if (schedulerIntervalId) return;

  const intervalMinutes = env.TRACKING_SYNC_INTERVAL_MINUTES || 60;
  const intervalMs = Math.max(10, intervalMinutes) * 60 * 1000;

  console.info(
    `[courierTracking] Starting background sync scheduler (interval: ${intervalMinutes}m, budget: ${getMonthlyBudget()} req/mo).`
  );

  // Initial delayed run after startup (15 seconds) to allow DB to stabilize
  setTimeout(() => {
    syncAllActiveShipments().catch(() => {});
  }, 15000);

  schedulerIntervalId = setInterval(() => {
    syncAllActiveShipments().catch((err) => {
      console.error("[courierTracking] Scheduler execution error:", err);
    });
  }, intervalMs);

  if (schedulerIntervalId.unref) {
    schedulerIntervalId.unref();
  }
}

/**
 * Stops the background sync scheduler cleanly.
 */
export function stopCourierTrackingScheduler(): void {
  if (schedulerIntervalId) {
    clearInterval(schedulerIntervalId);
    schedulerIntervalId = null;
    console.info("[courierTracking] Background sync scheduler stopped.");
  }
}

/**
 * Diagnostic info for admin dashboard.
 */
export function getQuotaInfo(): {
  used: number;
  total: number;
  budget: number;
  exhausted: boolean;
  inTransitTtlHours: number;
  ofdTtlMinutes: number;
} {
  return {
    used: quotaUsed,
    total: quotaTotal,
    budget: getMonthlyBudget(),
    exhausted: isBudgetExhausted(),
    inTransitTtlHours: env.TRACKING_IN_TRANSIT_REFRESH_HOURS || 24,
    ofdTtlMinutes: env.TRACKING_OFD_REFRESH_MINUTES || 120,
  };
}

/**
 * Clear in-memory tracking cache & reset quota variables for tests.
 */
export function _clearTrackingCacheForTesting(): void {
  memoryCache.clear();
  inFlightRequests.clear();
  quotaUsed = 0;
  quotaTotal = 100;
  quotaExhausted = false;
  isSyncRunning = false;
}
