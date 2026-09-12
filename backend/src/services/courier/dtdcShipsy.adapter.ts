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
 * Direct official DTDC (Shipsy) Tracking API:
 * GET https://app.shipsy.in/api/customer/integration/consignment/track?reference_number={reference_number}
 * Header: api-key: {DTDC_API_KEY}
 */
export async function fetchDtdcShipsyApi(referenceNumber: string, apiKey: string): Promise<any> {
  const cleanedRef = referenceNumber.trim();
  if (!cleanedRef || !apiKey) return null;

  await throttle();

  const url = `https://app.shipsy.in/api/customer/integration/consignment/track?reference_number=${encodeURIComponent(cleanedRef)}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6000);

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "api-key": apiKey.trim(),
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
 * Normalizes official DTDC / Shipsy consignment tracking response into NormalizedTrackingData.
 */
export function normalizeDtdcShipsyResponse(
  raw: any,
  courierName: string,
  _trackingNumber: string
): NormalizedTrackingData | null {
  if (!raw) return null;

  // If Shipsy returned error structure
  if (raw.error || raw.success === false || (typeof raw.statusCode === "number" && raw.statusCode >= 400)) {
    return null;
  }

  // Payload can be structured as { data: [...] }, { data: { ... } }, { consignment: ... }, or direct object
  const consignment = Array.isArray(raw.data)
    ? raw.data[0]
    : raw.data || raw.consignment || raw.response || raw;

  if (!consignment || typeof consignment !== "object") {
    return null;
  }

  // If neither reference_number nor events nor status are present, not a valid consignment response
  if (!consignment.reference_number && !consignment.events && !consignment.status) {
    return null;
  }

  const rawEvents: any[] = Array.isArray(consignment.events)
    ? consignment.events
    : Array.isArray(consignment.scans)
    ? consignment.scans
    : [];

  const checkpoints: CourierCheckpoint[] = rawEvents.map((item: any) => {
    const timeStr = item.event_time || item.event_date || item.time || item.date || item.ScanDateTime || new Date().toISOString();
    const location = (item.hub_name || item.hub_code || item.location || item.city || item.ScannedLocation || "").trim();
    const description = (item.customer_update || item.event_description || item.status || item.description || item.failure_reason || "Status update").trim();
    return {
      time: typeof timeStr === "string" ? timeStr.trim() : new Date(timeStr).toISOString(),
      location,
      description,
      status: item.status || item.action || item.StatusCode || undefined,
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

  const rawStatus = String(consignment.status || "").toLowerCase().trim();
  const rawCustomerUpdate = String(consignment.customer_update || "").toLowerCase().trim();
  const rawFailureReason = String(consignment.failure_reason || "").toLowerCase().trim();
  const latestCheckpointDesc = (latestCheckpoint?.description || "").toLowerCase();
  const latestCheckpointState = String(latestCheckpoint?.status || "").toLowerCase();

  let normalizedStatus: NormalizedTrackingData["status"] = "unknown";
  let latestStatusLabel = "In Transit";

  const isException =
    Boolean(consignment.failure_reason) ||
    rawStatus.includes("undeliver") ||
    rawStatus.includes("exception") ||
    rawStatus.includes("fail") ||
    rawStatus.includes("rto") ||
    rawStatus.includes("damage") ||
    rawCustomerUpdate.includes("failed attempt") ||
    rawCustomerUpdate.includes("undelivered") ||
    rawFailureReason.length > 0 ||
    latestCheckpointDesc.includes("undelivered") ||
    latestCheckpointDesc.includes("failed attempt") ||
    latestCheckpointDesc.includes("exception");

  const isOfd =
    rawStatus.includes("out") ||
    rawStatus.includes("out_for_delivery") ||
    rawStatus.includes("out for delivery") ||
    rawCustomerUpdate.includes("out for delivery") ||
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
      rawCustomerUpdate.includes("delivered") ||
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
    rawStatus.includes("arrived") ||
    rawStatus.includes("picked") ||
    latestCheckpointDesc.includes("transit") ||
    latestCheckpointDesc.includes("in transit") ||
    latestCheckpointDesc.includes("dispatched") ||
    latestCheckpointDesc.includes("arrived")
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
    consignment.customer_update ||
    consignment.failure_reason ||
    consignment.status ||
    latestCheckpoint?.description ||
    `Shipment update from ${courierName}`;

  const currentLocation = (
    consignment.hub_name ||
    consignment.hub_code ||
    latestCheckpoint?.location ||
    ""
  ).trim();

  const origin = (consignment.origin || consignment.source || null)?.trim() || null;
  const destination = (consignment.destination || consignment.dest || null)?.trim() || null;
  const expectedDeliveryDate = consignment.expected_delivery_date || consignment.edd || null;

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

export class DtdcShipsyAdapter implements CourierAdapter {
  readonly name = "DTDC";

  canHandle(courier: string): boolean {
    if (!courier) return false;
    const lower = courier.trim().toLowerCase();
    return lower === "dtdc" || lower.includes("dtdc");
  }

  isConfigured(): boolean {
    return Boolean(process.env.DTDC_API_KEY && process.env.DTDC_API_KEY.trim());
  }

  getMissingCredentialsDescription(): string {
    return "Requires DTDC_API_KEY environment variable (DTDC Shipsy API Key passed in api-key: <KEY> header).";
  }

  async fetchTracking(trackingNumber: string): Promise<NormalizedTrackingData | null> {
    const apiKey = process.env.DTDC_API_KEY;
    if (!apiKey || !apiKey.trim()) return null;

    const raw = await fetchDtdcShipsyApi(trackingNumber, apiKey.trim());
    if (!raw) return null;
    return normalizeDtdcShipsyResponse(raw, this.name, trackingNumber);
  }
}
