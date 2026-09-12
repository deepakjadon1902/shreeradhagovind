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
 * Direct official Blue Dart Tracking API call.
 * Uses official Blue Dart API Gateway (or RoutingServlet).
 */
export async function fetchBlueDartApi(
  trackingNumber: string,
  credentials: { loginId?: string; licKey?: string; apiKey?: string }
): Promise<any> {
  const cleanedAwb = trackingNumber.trim();
  if (!cleanedAwb) return null;

  await throttle();

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6000);

  try {
    let url: string;
    const headers: Record<string, string> = { Accept: "application/json" };

    if (credentials.apiKey) {
      url = `https://apigateway.bluedart.com/in/transportation/tracking/v1?numbers=${encodeURIComponent(cleanedAwb)}`;
      headers["JWT-Token"] = credentials.apiKey.trim();
    } else if (credentials.loginId && credentials.licKey) {
      url = `https://api.bluedart.com/servlet/RoutingServlet?handler=tnt&action=custawbquery&awb=awb&numbers=${encodeURIComponent(
        cleanedAwb
      )}&format=json&loginid=${encodeURIComponent(credentials.loginId.trim())}&lickey=${encodeURIComponent(
        credentials.licKey.trim()
      )}&verno=1.3`;
    } else {
      return null;
    }

    const res = await fetch(url, {
      method: "GET",
      headers,
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
 * Normalizes official Blue Dart tracking response into NormalizedTrackingData.
 */
export function normalizeBlueDartResponse(
  raw: any,
  courierName: string,
  _trackingNumber: string
): NormalizedTrackingData | null {
  if (!raw) return null;

  const data = raw?.ShipmentData || raw?.Shipment || raw?.data || raw;
  const shipment = Array.isArray(data) ? data[0] : data;
  if (!shipment) return null;

  const rawScans: any[] = Array.isArray(shipment.Scans)
    ? shipment.Scans
    : Array.isArray(shipment.scans)
      ? shipment.scans
      : Array.isArray(shipment.ScanDetail)
        ? shipment.ScanDetail
        : [];

  const checkpoints: CourierCheckpoint[] = rawScans.map((scan: any) => {
    let timeStr = "";
    if (scan.ScanDate && scan.ScanTime) {
      timeStr = `${scan.ScanDate} ${scan.ScanTime}`.trim();
    } else if (scan.ScanDate) {
      timeStr = String(scan.ScanDate).trim();
    } else {
      timeStr = scan.time || scan.date || scan.ScanDateTime || new Date().toISOString();
    }

    return {
      time: timeStr,
      location: (scan.ScannedLocation || scan.Location || scan.location || scan.city || "").trim(),
      description: (scan.Scan || scan.Status || scan.status || scan.Activity || scan.description || "Status update").trim(),
      status: scan.Status || scan.Scan || scan.status || undefined,
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

  const rawStatus = String(
    shipment.Status ||
    shipment.status ||
    shipment.StatusType ||
    latestCheckpoint?.description ||
    ""
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
    latestCheckpointDesc.includes("failed") ||
    latestCheckpointDesc.includes("exception");

  const isOfd =
    rawStatus.includes("out") ||
    rawStatus.includes("out_for_delivery") ||
    rawStatus.includes("for delivery") ||
    latestCheckpointDesc.includes("out for delivery") ||
    latestCheckpointDesc.includes("for delivery") ||
    latestCheckpointState.includes("out for delivery") ||
    latestCheckpointState.includes("out_for_delivery");

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
    rawStatus.includes("arrived") ||
    rawStatus.includes("picked") ||
    latestCheckpointDesc.includes("transit") ||
    latestCheckpointDesc.includes("in transit")
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
    latestCheckpoint?.description ||
    shipment.Status ||
    shipment.status ||
    `Shipment update from ${courierName}`;

  const currentLocation = (
    shipment.CurrentLocation ||
    shipment.location ||
    latestCheckpoint?.location ||
    ""
  ).trim();

  const origin = (shipment.Origin || shipment.origin || shipment.from || null)?.trim() || null;
  const destination = (shipment.Destination || shipment.destination || shipment.to || null)?.trim() || null;
  const expectedDeliveryDate = shipment.ExpectedDeliveryDate || shipment.expected_delivery || null;

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

export class BlueDartAdapter implements CourierAdapter {
  readonly name = "Blue Dart";

  canHandle(courier: string): boolean {
    if (!courier) return false;
    const lower = courier.trim().toLowerCase();
    return (
      lower === "blue dart" ||
      lower === "bluedart" ||
      lower.includes("bluedart") ||
      lower.includes("blue dart")
    );
  }

  isConfigured(): boolean {
    return Boolean(
      process.env.BLUEDART_API_KEY?.trim() ||
      (process.env.BLUEDART_LOGIN_ID?.trim() && process.env.BLUEDART_LIC_KEY?.trim())
    );
  }

  getMissingCredentialsDescription(): string {
    return "Requires BLUEDART_LOGIN_ID and BLUEDART_LIC_KEY (or BLUEDART_API_KEY) environment variables.";
  }

  async fetchTracking(trackingNumber: string): Promise<NormalizedTrackingData | null> {
    if (!this.isConfigured()) return null;

    const credentials = {
      apiKey: process.env.BLUEDART_API_KEY,
      loginId: process.env.BLUEDART_LOGIN_ID,
      licKey: process.env.BLUEDART_LIC_KEY,
    };

    const raw = await fetchBlueDartApi(trackingNumber, credentials);
    if (!raw) return null;
    return normalizeBlueDartResponse(raw, this.name, trackingNumber);
  }
}
