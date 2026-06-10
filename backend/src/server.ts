import "dotenv/config";
import { app } from "./app";
import { connectDB } from "./config/db";
import { env } from "./config/env";
import { ensureBootstrapAdmin } from "./utils/bootstrap";

async function main() {
  await connectDB();
  await ensureBootstrapAdmin();
  app.listen(env.PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`[api] listening on http://localhost:${env.PORT}`);
  });
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("Fatal startup error:", err);
  process.exit(1);
});
