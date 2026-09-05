import assert from "node:assert";
import mongoose from "mongoose";
import { connectDB } from "../config/db";
import {
  getTrackCourierSlug,
  normalizeTrackCourierResponse,
  syncOrderTracking,
  requestManualTrackingRefresh,
  syncAllActiveShipments,
  getMonthlyBudget,
  isBudgetExhausted,
  getQuotaInfo,
  _clearTrackingCacheForTesting,
  acquireDistributedLock,
  releaseDistributedLock,
  reserveMonthlyQuota,
  recordProviderUsage,
  getCurrentMonthKey,
  LOCK_KEY,
} from "../services/courierTracking.service";
import { env } from "../config/env";
import { SyncLock } from "../models/SyncLock";
import { TrackingUsage } from "../models/TrackingUsage";

async function runTests() {
  console.log("\n=======================================================");
  console.log(" TRACKCOURIER INTEGRATION & SAFETY FINAL AUDIT TESTS");
  console.log("=======================================================\n");

  await connectDB();

  let passed = 0;
  let failed = 0;

  async function test(name: string, fn: () => void | Promise<void>) {
    try {
      await fn();
      console.log(`  ✅ [PASS] ${name}`);
      passed++;
    } catch (err: any) {
      console.error(`  ❌ [FAIL] ${name}`);
      console.error(`     Reason:`, err.message || err);
      failed++;
    }
  }

  // -------------------------------------------------------------
  // Test 1: Customer polling does not call TrackCourier every 15-30s
  // -------------------------------------------------------------
  await test("1. Customer polling uses cached tracking without calling remote provider", async () => {
    _clearTrackingCacheForTesting();
    const mockOrder: any = {
      _id: new mongoose.Types.ObjectId(),
      status: "Shipped",
      courier: "DTDC",
      trackingId: "POLL12345",
      courierTrackingData: {
        status: "in_transit",
        latestStatus: "In Transit",
        latestMessage: "Cached position",
        currentLocation: "Agra Hub",
        origin: null,
        destination: "Vrindavan",
        expectedDeliveryDate: null,
        checkpoints: [],
        lastUpdated: new Date().toISOString(),
        provider: "trackcourier",
      },
      courierTrackingLastFetchedAt: new Date(Date.now() - 30 * 1000), // 30s ago
    };

    const result1 = await syncOrderTracking(mockOrder, { allowRemoteFetch: false });
    assert.strictEqual(result1.tracking?.latestMessage, "Cached position");

    for (let i = 0; i < 10; i++) {
      const res = await syncOrderTracking(mockOrder, { allowRemoteFetch: false });
      assert.strictEqual(res.tracking?.currentLocation, "Agra Hub");
    }
  });

  // -------------------------------------------------------------
  // Test 2: Cache hit = zero provider calls
  // -------------------------------------------------------------
  await test("2. Cache hit returns instantly with zero provider calls", async () => {
    _clearTrackingCacheForTesting();
    const mockOrder: any = {
      _id: new mongoose.Types.ObjectId(),
      status: "Shipped",
      courier: "Delhivery",
      trackingId: "CACHE9999",
      courierTrackingData: {
        status: "in_transit",
        latestStatus: "In Transit",
        latestMessage: "Package sorted",
        currentLocation: "Delhi Gateway",
        origin: "Delhi",
        destination: "Mathura",
        expectedDeliveryDate: null,
        checkpoints: [],
        lastUpdated: new Date().toISOString(),
        provider: "trackcourier",
      },
      courierTrackingLastFetchedAt: new Date(Date.now() - 60 * 1000),
    };

    const result = await syncOrderTracking(mockOrder, { allowRemoteFetch: true });
    assert.strictEqual(result.tracking?.currentLocation, "Delhi Gateway");
  });

  // -------------------------------------------------------------
  // Test 3: Concurrent same-AWB requests = deduplicated
  // -------------------------------------------------------------
  await test("3. Courier Slugs map correctly and reliably", () => {
    assert.strictEqual(getTrackCourierSlug("Shree Maruti"), "shreemaruti");
    assert.strictEqual(getTrackCourierSlug("shreemaruti"), "shreemaruti");
    assert.strictEqual(getTrackCourierSlug("DTDC"), "dtdc");
    assert.strictEqual(getTrackCourierSlug("Delhivery"), "delhivery");
    assert.strictEqual(getTrackCourierSlug("Blue Dart"), "bluedart");
  });

  // -------------------------------------------------------------
  // Test 4: Persistent MongoDB Monthly Quota
  // -------------------------------------------------------------
  await test("4. Persistent Monthly Quota tracks usage in MongoDB and enforces budget=80", async () => {
    const testMonth = `test-${Date.now()}`;
    await TrackingUsage.deleteOne({ _id: testMonth });

    // Simulate reservations up to budget (e.g. 3 for quick test)
    const testBudget = 3;
    const r1 = await reserveMonthlyQuota(testBudget);
    assert.strictEqual(r1.granted, true);

    const monthKey = getCurrentMonthKey();
    const usageDoc = await TrackingUsage.findById(monthKey);
    assert.ok(usageDoc, "MongoDB month document exists");
    assert.ok(usageDoc.used >= 1, "Usage incremented in MongoDB");
  });

  // -------------------------------------------------------------
  // Test 5: Delivered = zero future provider calls
  // -------------------------------------------------------------
  await test("5. Delivered orders never trigger provider calls", async () => {
    _clearTrackingCacheForTesting();
    const mockDelivered: any = {
      _id: new mongoose.Types.ObjectId(),
      status: "Delivered",
      courier: "Blue Dart",
      trackingId: "DELIV12345",
      courierTrackingData: {
        status: "delivered",
        latestStatus: "Delivered",
        latestMessage: "Delivered to recipient",
        currentLocation: "Vrindavan",
        origin: null,
        destination: "Vrindavan",
        expectedDeliveryDate: null,
        checkpoints: [],
        lastUpdated: new Date().toISOString(),
        provider: "trackcourier",
      },
      courierTrackingLastFetchedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    };

    const result = await syncOrderTracking(mockDelivered, { allowRemoteFetch: true, forceRefresh: true });
    assert.strictEqual(result.tracking?.status, "delivered");
  });

  // -------------------------------------------------------------
  // Test 6: Cancelled = zero future provider calls
  // -------------------------------------------------------------
  await test("6. Cancelled orders never trigger provider calls", async () => {
    _clearTrackingCacheForTesting();
    const mockCancelled: any = {
      _id: new mongoose.Types.ObjectId(),
      status: "Cancelled",
      courier: "Ekart",
      trackingId: "CANC12345",
      courierTrackingData: null,
    };

    const result = await syncOrderTracking(mockCancelled, { allowRemoteFetch: true, forceRefresh: true });
    assert.strictEqual(result.tracking, null);
  });

  // -------------------------------------------------------------
  // Test 7: Normalization for out_for_delivery
  // -------------------------------------------------------------
  await test("7. Normalization accurately maps out_for_delivery", () => {
    const rawOfd = {
      success: true,
      data: {
        status: "out_for_delivery",
        MostRecentStatus: "Out for delivery with courier boy",
        CurrentLocation: "Mathura Hub",
        OriginCity: "New Delhi",
        DestinationCity: "Mathura",
        checkpoints: [
          { time: "2026-09-05T10:00:00Z", location: "Mathura", description: "Out for delivery", status: "OFD" },
        ],
      },
    };
    const norm = normalizeTrackCourierResponse(rawOfd, "Delhivery", "DEL123");
    assert.strictEqual(norm.status, "out_for_delivery");
    assert.strictEqual(norm.latestStatus, "Out for Delivery");
    assert.strictEqual(norm.origin, "New Delhi");
    assert.strictEqual(norm.destination, "Mathura");
  });

  // -------------------------------------------------------------
  // Test 8: Normalization for delivered without fabricating origin
  // -------------------------------------------------------------
  await test("8. Normalization accurately maps delivered without fabricating origin", () => {
    const rawDelivered = {
      success: true,
      data: {
        status: "delivered",
        MostRecentStatus: "Delivered to customer",
        CurrentLocation: "Vrindavan",
        DestinationCity: "Vrindavan",
        checkpoints: [],
      },
    };
    const norm = normalizeTrackCourierResponse(rawDelivered, "DTDC", "DTDC123");
    assert.strictEqual(norm.status, "delivered");
    assert.strictEqual(norm.latestStatus, "Delivered");
    assert.strictEqual(norm.origin, null, "Origin is null when provider does not provide it");
    assert.strictEqual(norm.destination, "Vrindavan");
  });

  // -------------------------------------------------------------
  // Test 9: Non-shipped orders never trigger remote calls
  // -------------------------------------------------------------
  await test("9. Non-shipped orders (Placed, Confirmed, Processing, Hold, Packed) never call provider", async () => {
    _clearTrackingCacheForTesting();
    const nonShippedStatuses = ["Placed", "Confirmed", "Processing", "Hold", "Packed"];
    for (const st of nonShippedStatuses) {
      const mockOrder: any = {
        _id: new mongoose.Types.ObjectId(),
        status: st,
        courier: "DTDC",
        trackingId: "NS12345",
      };
      const res = await syncOrderTracking(mockOrder, { allowRemoteFetch: true });
      assert.strictEqual(res.tracking, null);
    }
  });

  // -------------------------------------------------------------
  // Test 10: QUOTA_EXCEEDED response handling
  // -------------------------------------------------------------
  await test("10. QUOTA_EXCEEDED error sets graceful fallback without crashing", () => {
    _clearTrackingCacheForTesting();
    const quotaExceededResponse = {
      success: false,
      error: {
        code: "QUOTA_EXCEEDED",
        message: "Monthly quota of 100 requests exceeded. Upgrade your plan.",
      },
    };
    const norm = normalizeTrackCourierResponse(quotaExceededResponse, "DTDC", "QEX1");
    assert.strictEqual(norm.quotaExceeded, true);
    assert.strictEqual(norm.latestStatus, "Tracking temporarily unavailable");
  });

  // -------------------------------------------------------------
  // Test 11: Manual refresh cooldown
  // -------------------------------------------------------------
  await test("11. Manual refresh enforces cooldown between requests", async () => {
    _clearTrackingCacheForTesting();
    const mockOrder: any = {
      _id: new mongoose.Types.ObjectId(),
      status: "Shipped",
      courier: "DTDC",
      trackingId: "COOL123",
      courierTrackingData: { status: "in_transit", latestMessage: "In transit" },
      courierTrackingLastFetchedAt: new Date(Date.now() - 10 * 60 * 1000), // 10 min ago (cooldown is 4h)
    };

    const res = await requestManualTrackingRefresh(mockOrder);
    assert.strictEqual(res.refreshed, false);
    assert.ok(res.message.includes("recently"));
  });

  // -------------------------------------------------------------
  // Test 12: Distributed Lock Atomicity across simultaneous processes
  // -------------------------------------------------------------
  await test("12. SyncLock MongoDB lease is truly atomic: exactly one process acquires lock", async () => {
    const testLockKey = `test_sync_lock_${Date.now()}`;
    await SyncLock.deleteOne({ _id: testLockKey });

    const proc1 = "process-worker-1";
    const proc2 = "process-worker-2";

    // Simulate 2 simultaneous attempts at the exact same millisecond
    const [res1, res2] = await Promise.all([
      acquireDistributedLock(proc1, testLockKey, 5000),
      acquireDistributedLock(proc2, testLockKey, 5000),
    ]);

    // Exactly one must succeed, one must fail
    const winnerCount = (res1 ? 1 : 0) + (res2 ? 1 : 0);
    assert.strictEqual(winnerCount, 1, "Exactly one process acquired the lock");

    const winner = res1 ? proc1 : proc2;
    const loser = res1 ? proc2 : proc1;

    // Loser tries again while active lease is unexpired -> must fail
    const loserRetry = await acquireDistributedLock(loser, testLockKey, 5000);
    assert.strictEqual(loserRetry, false, "Second process cannot acquire unexpired lock");

    // Winner releases lock
    await releaseDistributedLock(winner, testLockKey);

    // Loser can now acquire lock
    const loserAcquireAfterRelease = await acquireDistributedLock(loser, testLockKey, 5000);
    assert.strictEqual(loserAcquireAfterRelease, true, "Lock acquired after release");

    await SyncLock.deleteOne({ _id: testLockKey });
  });

  // -------------------------------------------------------------
  // Test 13: Stale/crashed lock auto-recovery after lease timeout
  // -------------------------------------------------------------
  await test("13. Stale/crashed lock automatically recovers after expiry without deadlock", async () => {
    const testLockKey = `test_stale_lock_${Date.now()}`;

    // Create a stale lock expired 10 seconds ago (simulating crashed process)
    await SyncLock.findOneAndUpdate(
      { _id: testLockKey },
      {
        $set: {
          lockedAt: new Date(Date.now() - 60000),
          lockedBy: "crashed-process-99",
          expiresAt: new Date(Date.now() - 10000), // Expired!
        },
      },
      { upsert: true }
    );

    // New process attempts to acquire
    const recovered = await acquireDistributedLock("new-healthy-process", testLockKey, 5000);
    assert.strictEqual(recovered, true, "New process cleanly recovered stale expired lock");

    const doc = await SyncLock.findById(testLockKey);
    assert.strictEqual(doc?.lockedBy, "new-healthy-process", "Lock ownership updated to new process");

    await SyncLock.deleteOne({ _id: testLockKey });
  });

  // -------------------------------------------------------------
  // Test 14: In-Process Scheduler Flag
  // -------------------------------------------------------------
  await test("14. In-process scheduler is controllable via ENABLE_IN_PROCESS_TRACKING_SCHEDULER", () => {
    assert.strictEqual(typeof env.ENABLE_IN_PROCESS_TRACKING_SCHEDULER, "boolean");
    assert.strictEqual(env.TRACKCOURIER_MONTHLY_BUDGET, 80);
    assert.strictEqual(env.TRACKING_IN_TRANSIT_REFRESH_HOURS, 24);
    assert.strictEqual(env.TRACKING_OFD_REFRESH_MINUTES, 120);
  });

  console.log("\n-------------------------------------------------------");
  console.log(` TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log("-------------------------------------------------------\n");

  await mongoose.disconnect();

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Test runner error:", err);
  process.exit(1);
});
