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
 * Direct official Delhivery Tracking API:
 * GET https://track.delhivery.com/api/v1/packages/json/?waybill={AWB}
 * Header: Authorization: Token {DELHIVERY_API_TOKEN}
 */
export async function fetchDelhiveryApi(trackingNumber: string, apiToken: string): Promise<any> {
  const cleanedAwb = trackingNumber.trim();
  if (!cleanedAwb || !apiToken) return null;

  await throttle();

  const url = `https://track.delhivery.com/api/v1/packages/json/?waybill=${encodeURIComponent(cleanedAwb)}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6000);

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Token ${apiToken.trim()}`,
        Accept: "application/json",
      },
      signal: controller.signal as any,
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      return null;
    }

    const data = await res.json();
    return data;
  } catch {
    clearTimeout(timeoutId);
    return null;
  }
}

/**
 * Normalizes official Delhivery tracking JSON response into NormalizedTrackingData.
 */
export function normalizeDelhiveryResponse(
  raw: any,
  courierName: string,
  _trackingNumber: string
): NormalizedTrackingData | null {
  if (!raw || raw.Success === false) return null;

  const shipmentData = Array.isArray(raw.ShipmentData)
    ? raw.ShipmentData[0]?.Shipment || raw.ShipmentData[0]
    : raw.Shipment;

  if (!shipmentData) return null;

  const rawScans: any[] = Array.isArray(shipmentData.Scans)
    ? shipmentData.Scans
    : Array.isArray(shipmentData.scans)
      ? shipmentData.scans
      : [];

  const checkpoints: CourierCheckpoint[] = rawScans.map((item: any) => {
    const detail = item.ScanDetail || item.scan_detail || item;
    const timeStr = detail.ScanDateTime || detail.scan_date_time || detail.time || detail.date || new Date().toISOString();
    return {
      time: typeof timeStr === "string" ? timeStr.trim() : new Date(timeStr).toISOString(),
      location: (detail.ScannedLocation || detail.scanned_location || detail.location || detail.city || "").trim(),
      description: (detail.Instructions || detail.Scan || detail.scan || detail.status || "Status update").trim(),
      status: detail.Scan || detail.status || detail.StatusCode || undefined,
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

  const statusObj = shipmentData.Status || shipmentData.status || {};
  const rawStatus = String(
    (typeof statusObj === "string" ? statusObj : statusObj.Status || statusObj.status) || ""
  ).toLowerCase().trim();

  const latestCheckpointDesc = (latestCheckpoint?.description || "").toLowerCase();
  const latestCheckpointState = String(latestCheckpoint?.status || "").toLowerCase();

  let normalizedStatus: NormalizedTrackingData["status"] = "unknown";
  let latestStatusLabel = "In Transit";

  const isException =
    rawStatus.includes("undeliver") ||
    rawStatus.includes("exception") ||
    rawStatus.includes("fail") ||
    rawStatus.includes("rto") ||
    latestCheckpointDesc.includes("undelivered") ||
    latestCheckpointDesc.includes("failed attempt") ||
    latestCheckpointDesc.includes("exception");

  const isOfd =
    rawStatus.includes("out") ||
    rawStatus.includes("out_for_delivery") ||
    rawStatus.includes("for delivery") ||
    latestCheckpointDesc.includes("out for delivery") ||
    latestCheckpointDesc.includes("for delivery") ||
    latestCheckpointDesc.includes("dispatched for delivery") ||
    latestCheckpointState.includes("out for delivery");

  const isDelivered =
    !isException &&
    !isOfd &&
    !rawStatus.includes("undeliver") &&
    !latestCheckpointDesc.includes("undeliver") &&
    (rawStatus.includes("deliver") ||
      latestCheckpointDesc.includes("delivered") ||
      latestCheckpointState.includes("delivered"));

  if (isException) {
    normalizedStatus = "exception";
    latestStatusLabel = "Delivery Exception";
  } else if (isDelivered) {
    normalizedStatus = "delivered";
    latestStatusLabel = "Delivered";
  } else if (isOfd) {
    normalizedStatus = "out_for_delivery";
    latestStatusLabel = "Out for Delivery";
  } else if (
    rawStatus.includes("transit") ||
    rawStatus.includes("manifest") ||
    rawStatus.includes("dispatch") ||
    rawStatus.includes("reached") ||
    rawStatus.includes("picked") ||
    latestCheckpointDesc.includes("transit") ||
    latestCheckpointDesc.includes("in transit") ||
    latestCheckpointDesc.includes("dispatched")
  ) {
    normalizedStatus = "in_transit";
    latestStatusLabel = "In Transit";
  } else if (
    rawStatus.includes("pending") ||
    rawStatus.includes("book") ||
    rawStatus.includes("created") ||
    !hasCarrierScans
  ) {
    normalizedStatus = "info_received";
    latestStatusLabel = "Awaiting Carrier Scan";
  } else {
    normalizedStatus = hasCarrierScans ? "in_transit" : "unknown";
    latestStatusLabel = hasCarrierScans ? "In Transit" : "Tracking Initialized";
  }

  const latestMessage =
    statusObj.Instructions ||
    statusObj.Status ||
    latestCheckpoint?.description ||
    `Shipment update from ${courierName}`;

  const currentLocation = (
    statusObj.StatusLocation ||
    statusObj.location ||
    latestCheckpoint?.location ||
    ""
  ).trim();

  const origin = (shipmentData.Origin || shipmentData.origin || null)?.trim() || null;
  const destination = (shipmentData.Destination || shipmentData.destination || null)?.trim() || null;
  const expectedDeliveryDate = shipmentData.ExpectedDeliveryDate || shipmentData.expected_delivery || null;

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
    provider: "carrier_direct",
  };
}

export class DelhiveryAdapter implements CourierAdapter {
  readonly name = "Delhivery";

  canHandle(courier: string): boolean {
    if (!courier) return false;
    const lower = courier.trim().toLowerCase();
    return lower === "delhivery" || lower.includes("delhivery");
  }

  isConfigured(): boolean {
    return Boolean(process.env.DELHIVERY_API_TOKEN && process.env.DELHIVERY_API_TOKEN.trim());
  }

  getMissingCredentialsDescription(): string {
    return "Requires DELHIVERY_API_TOKEN environment variable (Delhivery One API Token passed in Authorization: Token <TOKEN> header).";
  }

  async fetchTracking(trackingNumber: string): Promise<NormalizedTrackingData | null> {
    const token = process.env.DELHIVERY_API_TOKEN;
    if (!token || !token.trim()) return null;

    const raw = await fetchDelhiveryApi(trackingNumber, token.trim());
    if (!raw) return null;
    return normalizeDelhiveryResponse(raw, this.name, trackingNumber);
  }
}
