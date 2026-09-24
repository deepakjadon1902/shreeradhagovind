import { env } from "../config/env";
import { CheckoutSession, type ICheckoutSession } from "../models/CheckoutSession";
import { Product } from "../models/Product";
import { SyncLock } from "../models/SyncLock";
import { sendEmail, tpl } from "../utils/email";

export const ABANDONED_CART_LOCK_KEY = "abandoned_cart_sync";
export const ABANDONED_CART_LOCK_LEASE_MS = 5 * 60 * 1000; // 5 minutes lease
export const INACTIVITY_THRESHOLD_MS = 60 * 60 * 1000; // 60 minutes minimum inactivity

let isProcessing = false;
let schedulerIntervalId: NodeJS.Timeout | null = null;

function getStoreFrontBaseUrl(): string {
  if (env.NODE_ENV === "production") {
    return "https://www.shriradhagovindstore.com";
  }
  const local = env.CORS_ORIGIN.find((o) => o.includes("localhost"));
  return local || "https://www.shriradhagovindstore.com";
}

export async function acquireAbandonedCartLock(
  processId: string,
  lockKey = ABANDONED_CART_LOCK_KEY,
  leaseMs = ABANDONED_CART_LOCK_LEASE_MS
): Promise<boolean> {
  const now = new Date();
  const expiresAt = new Date(Date.now() + leaseMs);

  try {
    const doc = await SyncLock.findById(lockKey);
    if (doc) {
      if (doc.expiresAt && doc.expiresAt.getTime() > now.getTime()) {
        return false;
      }
      const updated = await SyncLock.findOneAndUpdate(
        { _id: lockKey, expiresAt: doc.expiresAt },
        { $set: { lockedAt: now, lockedBy: processId, expiresAt } },
        { new: true }
      );
      return Boolean(updated);
    } else {
      try {
        await SyncLock.create({
          _id: lockKey,
          lockedAt: now,
          lockedBy: processId,
          expiresAt,
        });
        return true;
      } catch {
        return false;
      }
    }
  } catch {
    return false;
  }
}

export async function releaseAbandonedCartLock(
  processId: string,
  lockKey = ABANDONED_CART_LOCK_KEY
): Promise<void> {
  try {
    await SyncLock.deleteOne({ _id: lockKey, lockedBy: processId });
  } catch {
    // Ignore lock release failures
  }
}

export interface AbandonedCartProcessResult {
  totalCandidates: number;
  emailsSent: number;
  skipped: number;
  skippedLock?: boolean;
}

/**
 * Scans active checkout sessions that have been inactive for at least 60 minutes,
 * verifies cart item validity, atomically claims each session to prevent duplicate sends,
 * and sends a single devotional abandoned-cart recovery email.
 */
export async function processAbandonedCheckoutSessions(
  inactivityMs = INACTIVITY_THRESHOLD_MS
): Promise<AbandonedCartProcessResult> {
  if (isProcessing) {
    return { totalCandidates: 0, emailsSent: 0, skipped: 0, skippedLock: true };
  }

  const processId = `cart-proc-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const lockAcquired = await acquireAbandonedCartLock(processId);
  if (!lockAcquired) {
    return { totalCandidates: 0, emailsSent: 0, skipped: 0, skippedLock: true };
  }

  isProcessing = true;
  let totalCandidates = 0;
  let emailsSent = 0;
  let skipped = 0;

  try {
    const cutoff = new Date(Date.now() - inactivityMs);

    // Find candidate sessions: active, inactive >= 60 mins, never sent recovery, has email
    const candidates = await CheckoutSession.find({
      status: "active",
      lastActivityAt: { $lt: cutoff },
      recoverySentCount: 0,
      email: { $exists: true, $ne: "" },
    }).limit(50);

    totalCandidates = candidates.length;

    for (const candidate of candidates) {
      // Atomic claim using findOneAndUpdate to guarantee idempotency across processes
      const claimed = await CheckoutSession.findOneAndUpdate(
        {
          _id: candidate._id,
          status: "active",
          recoverySentCount: 0,
        },
        {
          $set: {
            status: "abandoned",
            abandonedAt: new Date(),
            recoverySentCount: 1,
            recoverySentAt: new Date(),
          },
        },
        { new: true }
      );

      if (!claimed) {
        // Race condition: another worker already claimed this session
        skipped++;
        continue;
      }

      if (!claimed.email || claimed.items.length === 0) {
        skipped++;
        continue;
      }

      // Verify that at least one item still exists and is active in database
      const productIds = claimed.items.map((i) => i.productId);
      const activeProducts = await Product.find({
        _id: { $in: productIds },
        isActive: true,
      });

      if (activeProducts.length === 0) {
        // Products no longer active, skip email
        skipped++;
        continue;
      }

      const baseUrl = getStoreFrontBaseUrl();
      const recoveryUrl = `${baseUrl.replace(/\/$/, "")}/checkout?session=${encodeURIComponent(claimed.recoveryToken)}`;

      const itemsPayload = claimed.items.map((i) => ({
        name: i.name,
        qty: i.qty,
        price: i.price,
        image: i.image,
      }));

      try {
        await sendEmail({
          to: claimed.email,
          ...tpl.abandonedCart(
            claimed.name || "Devotee",
            itemsPayload,
            recoveryUrl,
            claimed.total
          ),
        });
        emailsSent++;
      } catch (sendErr) {
        // Log error without throwing so other sessions continue processing
        // eslint-disable-next-line no-console
        console.error(`[abandonedCart] Failed to send recovery email for session ${claimed.sessionId}:`, sendErr);
        skipped++;
      }
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[abandonedCart] Error during abandoned cart processing:", err);
  } finally {
    isProcessing = false;
    await releaseAbandonedCartLock(processId);
  }

  return { totalCandidates, emailsSent, skipped };
}

/**
 * Starts the abandoned cart background recovery scheduler.
 * Runs every 15 minutes by default.
 */
export function startAbandonedCartScheduler(intervalMinutes = 15): void {
  if (schedulerIntervalId) return;

  const intervalMs = Math.max(5, intervalMinutes) * 60 * 1000;

  // eslint-disable-next-line no-console
  console.info(`[abandonedCart] Starting abandoned cart scheduler (interval: ${intervalMinutes}m).`);

  // Initial delayed execution after server boot (30 seconds) to ensure database is warm
  setTimeout(() => {
    processAbandonedCheckoutSessions().catch(() => {});
  }, 30000);

  schedulerIntervalId = setInterval(() => {
    processAbandonedCheckoutSessions().catch((err) => {
      // eslint-disable-next-line no-console
      console.error("[abandonedCart] Scheduler execution error:", err);
    });
  }, intervalMs);

  if (schedulerIntervalId.unref) {
    schedulerIntervalId.unref();
  }
}

/**
 * Stops the abandoned cart scheduler cleanly on server shutdown.
 */
export function stopAbandonedCartScheduler(): void {
  if (schedulerIntervalId) {
    clearInterval(schedulerIntervalId);
    schedulerIntervalId = null;
    // eslint-disable-next-line no-console
    console.info("[abandonedCart] Abandoned cart scheduler stopped.");
  }
}
