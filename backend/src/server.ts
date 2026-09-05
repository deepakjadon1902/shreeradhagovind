import "dotenv/config";
import { app } from "./app";
import { connectDB } from "./config/db";
import { env } from "./config/env";
import { ensureBootstrapAdmin } from "./utils/bootstrap";
import {
  startCourierTrackingScheduler,
  stopCourierTrackingScheduler,
} from "./services/courierTracking.service";

async function main() {
  await connectDB();
  await ensureBootstrapAdmin();

  // Start in-process courier tracking sync scheduler if enabled (primary production method is Render Cron 'npm run sync:couriers')
  if (env.ENABLE_IN_PROCESS_TRACKING_SCHEDULER) {
    startCourierTrackingScheduler();
  } else {
    // eslint-disable-next-line no-console
    console.log("[api] In-process tracking scheduler disabled (using external/Render Cron for tracking sync).");
  }

  const server = app.listen(env.PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`[api] listening on http://localhost:${env.PORT}`);
  });

  const shutdown = () => {
    // eslint-disable-next-line no-console
    console.log("[api] Shutting down gracefully...");
    stopCourierTrackingScheduler();
    server.close(() => {
      // eslint-disable-next-line no-console
      console.log("[api] Server closed.");
      process.exit(0);
    });
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("Fatal startup error:", err);
  process.exit(1);
});
