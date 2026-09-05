import "dotenv/config";
import mongoose from "mongoose";
import { connectDB } from "../config/db";
import { syncAllActiveShipments } from "../services/courierTracking.service";

async function run() {
  console.log("[syncTracking] Connecting to database...");
  await connectDB();
  console.log("[syncTracking] Running automatic shipment synchronization...");
  const result = await syncAllActiveShipments();
  console.log("[syncTracking] Result:", JSON.stringify(result, null, 2));
  await mongoose.disconnect();
  console.log("[syncTracking] Finished.");
  process.exit(0);
}

run().catch((err) => {
  console.error("[syncTracking] Error:", err);
  process.exit(1);
});
