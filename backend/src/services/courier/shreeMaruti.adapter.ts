import fetch from "node-fetch";
import { CourierAdapter, CourierCheckpoint, NormalizedTrackingData } from "./types";

let lastCallTime = 0;
async function throttle(): Promise<void> {
  const now = Date.now();
  const diff = now - lastCallTime;
  if (diff < 500) {
    await new Promise((resolve) => setTimeout(resolve, 500 - diff));
  }
  lastCallTime = Date.now();
}

/**
 * Direct query to Shree Maruti official tracking endpoint (apis.delcaper.com).
 */
export async function fetchShreeMarutiApi(trackingNumber: string): Promise<any> {
  const cleanedAwb = trackingNumber.trim();
  if (!cleanedAwb) return null;

  await throttle();

  const url = `https://apis.delcaper.com/tracking/v2/${encodeURIComponent(cleanedAwb)}`;

  for (let attempt = 0; attempt < 2; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    try {
      const res = await fetch(url, {
        method: "GET",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "application/json",
          Referer: "https://www.shreemaruti.com/",
        },
        signal: controller.signal as any,
      });
      clearTimeout(timeoutId);

      if (res.status === 429) {
        if (attempt === 0) {
          await new Promise((resolve) => setTimeout(resolve, 2500));
          continue;
        }
        return null;
      }

      if (!res.ok) {
        return null;
      }

      const data = await res.json();
      return data;
    } catch {
      clearTimeout(timeoutId);
      if (attempt === 0) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        continue;
      }
      return null;
    }
  }
  return null;
}

/**
 * Normalizes official Shree Maruti / Delcaper tracking payload into NormalizedTrackingData.
 */
export function normalizeShreeMarutiResponse(
  raw: any,
  courierName: string,
  _trackingNumber: string
): NormalizedTrackingData | null {
  if (!raw || (!raw.statuses && !raw.orderInformation)) {
    return null;
  }

  const orderInfo = raw.orderInformation || {};
  const rawStatuses: any[] = Array.isArray(raw.statuses) ? raw.statuses : [];

  const checkpoints: CourierCheckpoint[] = rawStatuses.map((s: any) => {
    let timeStr = "";
    if (s.statusTimestamp) {
      timeStr = new Date(s.statusTimestamp).toISOString();
    } else if (s.createdAt) {
      timeStr = new Date(s.createdAt).toISOString();
    } else {
      timeStr = new Date().toISOString();
    }

    return {
      time: timeStr,
      location: (s.location || "").trim(),
      description: (s.subcategory || s.category || s.status || "Status update").trim(),
      status: s.status || s.category || undefined,
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

  const newestStatusObj = rawStatuses.length > 0 ? rawStatuses[0] : null;
  const rawCategory = String(newestStatusObj?.category || "").toUpperCase().trim();
  const rawStatus = String(newestStatusObj?.status || "").toLowerCase().trim();

  let normalizedStatus: NormalizedTrackingData["status"] = "unknown";
  let latestStatusLabel = "In Transit";

  if (rawCategory === "DELIVERED" || rawStatus === "delivered" || rawStatus.includes("deliver")) {
    normalizedStatus = "delivered";
    latestStatusLabel = "Delivered";
  } else if (
    rawCategory === "OUT_FOR_DELIVERY" ||
    rawStatus === "out_for_delivery" ||
    rawStatus.includes("out")
  ) {
    normalizedStatus = "out_for_delivery";
    latestStatusLabel = "Out for Delivery";
  } else if (
    rawCategory === "IN_TRANSIT" ||
    rawStatus.includes("scan") ||
    rawStatus.includes("transit") ||
    rawStatus.includes("hub") ||
    rawStatus.includes("dispatch")
  ) {
    normalizedStatus = "in_transit";
    latestStatusLabel = "In Transit";
  } else if (
    rawCategory === "EXCEPTION" ||
    rawStatus.includes("exception") ||
    rawStatus.includes("fail") ||
    rawStatus.includes("undeliver") ||
    rawStatus.includes("rto")
  ) {
    normalizedStatus = "exception";
    latestStatusLabel = "Delivery Exception";
  } else if (
    rawCategory === "ORDER_CONFIRMED" ||
    rawCategory === "READY_FOR_DISPATCH" ||
    !hasCarrierScans
  ) {
    normalizedStatus = "info_received";
    latestStatusLabel = "Awaiting Carrier Scan";
  } else {
    normalizedStatus = hasCarrierScans ? "in_transit" : "unknown";
    latestStatusLabel = hasCarrierScans ? "In Transit" : "Tracking Initialized";
  }

  const latestMessage =
    newestStatusObj?.subcategory ||
    newestStatusObj?.category ||
    latestCheckpoint?.description ||
    `Shipment update from ${courierName}`;

  const currentLocation = (newestStatusObj?.location || latestCheckpoint?.location || "").trim();

  const srcLoc = orderInfo.sourceLocation;
  const origin = srcLoc
    ? [srcLoc.city, srcLoc.state].filter(Boolean).join(", ") || null
    : null;

  const destLoc = orderInfo.destinationLocation;
  const destination = destLoc
    ? [destLoc.city, destLoc.state].filter(Boolean).join(", ") || null
    : null;

  return {
    status: normalizedStatus,
    latestStatus: latestStatusLabel,
    latestMessage,
    currentLocation,
    origin,
    destination,
    expectedDeliveryDate: null,
    checkpoints,
    lastUpdated: new Date().toISOString(),
    lastCarrierScanAt,
    hasCarrierScans,
    provider: "carrier_direct",
  };
}

export class ShreeMarutiAdapter implements CourierAdapter {
  readonly name = "Shree Maruti";

  canHandle(courier: string): boolean {
    if (!courier) return false;
    const lower = courier.trim().toLowerCase();
    return (
      lower === "shree maruti" ||
      lower === "shree murti" ||
      lower === "shreemaruti" ||
      lower.includes("maruti") ||
      lower.includes("murti")
    );
  }

  isConfigured(): boolean {
    return true; // Direct official public tracking endpoint
  }

  getMissingCredentialsDescription(): string {
    return "None (public endpoint).";
  }

  async fetchTracking(trackingNumber: string): Promise<NormalizedTrackingData | null> {
    const raw = await fetchShreeMarutiApi(trackingNumber);
    if (!raw) return null;
    return normalizeShreeMarutiResponse(raw, this.name, trackingNumber);
  }
}
