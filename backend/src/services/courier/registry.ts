import { CourierAdapter } from "./types";
import { ShreeMarutiAdapter } from "./shreeMaruti.adapter";
import { DelhiveryAdapter } from "./delhivery.adapter";
import { BlueDartAdapter } from "./blueDart.adapter";
import { DtdcShipsyAdapter } from "./dtdcShipsy.adapter";

export * from "./types";
export * from "./shreeMaruti.adapter";
export * from "./delhivery.adapter";
export * from "./blueDart.adapter";
export * from "./dtdcShipsy.adapter";

const DIRECT_ADAPTERS: CourierAdapter[] = [
  new ShreeMarutiAdapter(),
  new DelhiveryAdapter(),
  new BlueDartAdapter(),
  new DtdcShipsyAdapter(),
];

/**
 * Returns the matching direct courier adapter for the given courier name, or null if no direct adapter exists.
 */
export function getDirectCourierAdapter(courier?: string | null): CourierAdapter | null {
  if (!courier) return null;
  const match = DIRECT_ADAPTERS.find((adapter) => adapter.canHandle(courier));
  return match || null;
}

/**
 * Returns all registered direct courier adapters.
 */
export function getAllDirectCourierAdapters(): CourierAdapter[] {
  return [...DIRECT_ADAPTERS];
}
