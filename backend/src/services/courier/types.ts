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
  error?: string;
}

export interface CourierAdapter {
  readonly name: string;
  canHandle(courier: string): boolean;
  isConfigured(): boolean;
  getMissingCredentialsDescription(): string;
  fetchTracking(trackingNumber: string): Promise<NormalizedTrackingData | null>;
}
