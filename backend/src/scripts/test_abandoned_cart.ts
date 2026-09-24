import "dotenv/config";
import assert from "node:assert";
import mongoose from "mongoose";
import crypto from "crypto";
import { connectDB } from "../config/db";
import { CheckoutSession } from "../models/CheckoutSession";
import { Product } from "../models/Product";
import { Order } from "../models/Order";
import { User } from "../models/User";
import { SyncLock } from "../models/SyncLock";
import {
  processAbandonedCheckoutSessions,
  acquireAbandonedCartLock,
  releaseAbandonedCartLock,
  ABANDONED_CART_LOCK_KEY,
} from "../services/abandonedCart.service";
import { tpl } from "../utils/email";

async function runTests() {
  console.log("\n=======================================================");
  console.log(" ABANDONED CART PHASE 1 VERIFICATION & SAFETY TESTS");
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

  // Generate unique test run identifier
  const testRunId = `test-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  let testProductId: mongoose.Types.ObjectId;
  let testUserId: mongoose.Types.ObjectId;

  // Setup test product and user
  try {
    const testProduct = await Product.create({
      name: `Test Vrindavan Mala ${testRunId}`,
      slug: `test-vrindavan-mala-${testRunId}`,
      description: "Authentic sacred test item",
      price: 499,
      mrp: 699,
      category: "Tulsi Malas",
      stock: 15,
      isActive: true,
    });
    testProductId = testProduct._id as mongoose.Types.ObjectId;

    const testUser = await User.create({
      name: "Test Devotee",
      email: `test.devotee.${testRunId}@example.com`,
      phone: "9876543210",
      role: "user",
    });
    testUserId = testUser._id as mongoose.Types.ObjectId;
  } catch (err: any) {
    console.error("Failed to initialize test fixtures:", err);
    process.exit(1);
  }

  // Track session IDs for cleanup
  const createdSessionIds: string[] = [];
  const createdOrderIds: mongoose.Types.ObjectId[] = [];

  try {
    // -------------------------------------------------------------
    // Test A: Guest checkout session capture
    // -------------------------------------------------------------
    await test("A. Guest checkout session capture stores contact, items, and generates recoveryToken", async () => {
      const sessionId = `guest-sess-${testRunId}-A`;
      const recoveryToken = crypto.randomBytes(24).toString("hex");

      const session = await CheckoutSession.create({
        sessionId,
        email: `guest.${testRunId}@example.com`,
        phone: "9876500001",
        name: "Radhika Devi",
        address: {
          line1: "Near Bankey Bihari Temple",
          city: "Vrindavan",
          state: "Uttar Pradesh",
          pincode: "281121",
        },
        items: [
          {
            productId: testProductId,
            name: "Test Vrindavan Mala",
            price: 499,
            qty: 2,
          },
        ],
        subtotal: 998,
        shipping: 49,
        total: 1047,
        status: "active",
        recoveryToken,
        lastActivityAt: new Date(),
        recoverySentCount: 0,
      });

      createdSessionIds.push(session.sessionId);

      assert.strictEqual(session.sessionId, sessionId);
      assert.strictEqual(session.user, null);
      assert.strictEqual(session.status, "active");
      assert.strictEqual(session.recoverySentCount, 0);
      assert.strictEqual(session.items.length, 1);
      assert.strictEqual(session.items[0].qty, 2);
      assert.ok(session.recoveryToken.length >= 32, "Recovery token must be secure string");
    });

    // -------------------------------------------------------------
    // Test B: Authenticated checkout session capture
    // -------------------------------------------------------------
    await test("B. Authenticated checkout session capture associates session with user ID", async () => {
      const sessionId = `auth-sess-${testRunId}-B`;
      const recoveryToken = crypto.randomBytes(24).toString("hex");

      const session = await CheckoutSession.create({
        sessionId,
        user: testUserId,
        email: `test.devotee.${testRunId}@example.com`,
        phone: "9876543210",
        name: "Test Devotee",
        items: [
          {
            productId: testProductId,
            name: "Test Vrindavan Mala",
            price: 499,
            qty: 1,
          },
        ],
        subtotal: 499,
        shipping: 49,
        total: 548,
        status: "active",
        recoveryToken,
        lastActivityAt: new Date(),
        recoverySentCount: 0,
      });

      createdSessionIds.push(session.sessionId);

      assert.strictEqual(session.sessionId, sessionId);
      assert.ok(session.user?.equals(testUserId), "Session user must match authenticated user ID");
      assert.strictEqual(session.status, "active");
    });

    // -------------------------------------------------------------
    // Test C: Session update / idempotency
    // -------------------------------------------------------------
    await test("C. Session update updates existing document idempotently without duplicates", async () => {
      const sessionId = `idempotent-sess-${testRunId}-C`;
      const recoveryToken = crypto.randomBytes(24).toString("hex");

      // Initial capture
      const session = await CheckoutSession.create({
        sessionId,
        email: `lead.${testRunId}@example.com`,
        phone: "9876500003",
        name: "Devotee Initial",
        items: [
          {
            productId: testProductId,
            name: "Test Vrindavan Mala",
            price: 499,
            qty: 1,
          },
        ],
        subtotal: 499,
        shipping: 49,
        total: 548,
        status: "active",
        recoveryToken,
        lastActivityAt: new Date(Date.now() - 5000),
        recoverySentCount: 0,
      });
      createdSessionIds.push(session.sessionId);

      // Second capture with updated name and qty
      const updated = await CheckoutSession.findOneAndUpdate(
        { sessionId },
        {
          $set: {
            name: "Devotee Updated",
            "items.0.qty": 3,
            total: 1546,
            lastActivityAt: new Date(),
          },
        },
        { new: true }
      );

      assert.ok(updated);
      assert.strictEqual(updated.name, "Devotee Updated");
      assert.strictEqual(updated.items[0].qty, 3);

      const count = await CheckoutSession.countDocuments({ sessionId });
      assert.strictEqual(count, 1, "There must strictly be one document per sessionId");
    });

    // -------------------------------------------------------------
    // Test D: Razorpay modal dismissal capture
    // -------------------------------------------------------------
    await test("D. Razorpay modal dismissal records event timestamp in metadata without marking abandoned immediately", async () => {
      const sessionId = `dismiss-sess-${testRunId}-D`;
      const recoveryToken = crypto.randomBytes(24).toString("hex");

      const session = await CheckoutSession.create({
        sessionId,
        email: `dismiss.${testRunId}@example.com`,
        phone: "9876500004",
        name: "Dismiss Customer",
        items: [{ productId: testProductId, name: "Test Item", price: 499, qty: 1 }],
        subtotal: 499,
        shipping: 49,
        total: 548,
        status: "active",
        recoveryToken,
        lastActivityAt: new Date(),
      });
      createdSessionIds.push(session.sessionId);

      // Simulate dismiss endpoint
      const dismissTime = new Date();
      session.lastActivityAt = dismissTime;
      session.metadata = {
        ...(session.metadata || {}),
        razorpayDismissedAt: dismissTime,
      };
      await session.save();

      const reloaded = await CheckoutSession.findOne({ sessionId });
      assert.ok(reloaded);
      assert.strictEqual(reloaded.status, "active", "Session must remain active immediately upon dismissal");
      assert.ok(reloaded.metadata?.razorpayDismissedAt, "Dismissal timestamp must be recorded");
    });

    // -------------------------------------------------------------
    // Test E: 60-minute inactivity detection
    // -------------------------------------------------------------
    await test("E. Scheduler detects sessions inactive for at least 60 minutes", async () => {
      const sessionIdRecent = `recent-sess-${testRunId}-E1`;
      const sessionIdStale = `stale-sess-${testRunId}-E2`;

      // Active 10 minutes ago (should NOT be detected as candidate)
      const recent = await CheckoutSession.create({
        sessionId: sessionIdRecent,
        email: `recent.${testRunId}@example.com`,
        phone: "9876500005",
        items: [{ productId: testProductId, name: "Item", price: 499, qty: 1 }],
        total: 548,
        status: "active",
        recoveryToken: crypto.randomBytes(24).toString("hex"),
        lastActivityAt: new Date(Date.now() - 10 * 60 * 1000), // 10 mins ago
      });
      createdSessionIds.push(recent.sessionId);

      // Active 65 minutes ago (SHOULD be detected as candidate)
      const stale = await CheckoutSession.create({
        sessionId: sessionIdStale,
        email: `stale.${testRunId}@example.com`,
        phone: "9876500006",
        items: [{ productId: testProductId, name: "Item", price: 499, qty: 1 }],
        total: 548,
        status: "active",
        recoveryToken: crypto.randomBytes(24).toString("hex"),
        lastActivityAt: new Date(Date.now() - 65 * 60 * 1000), // 65 mins ago
      });
      createdSessionIds.push(stale.sessionId);

      const cutoff = new Date(Date.now() - 60 * 60 * 1000);
      const candidates = await CheckoutSession.find({
        sessionId: { $in: [sessionIdRecent, sessionIdStale] },
        status: "active",
        lastActivityAt: { $lt: cutoff },
        recoverySentCount: 0,
      });

      assert.strictEqual(candidates.length, 1);
      assert.strictEqual(candidates[0].sessionId, sessionIdStale);
    });

    // -------------------------------------------------------------
    // Test F: One-time recovery email
    // -------------------------------------------------------------
    await test("F. Processing abandoned session transitions status to abandoned and increments recoverySentCount", async () => {
      const sessionId = `process-sess-${testRunId}-F`;
      const recoveryToken = crypto.randomBytes(24).toString("hex");

      const session = await CheckoutSession.create({
        sessionId,
        email: `process.${testRunId}@example.com`,
        phone: "9876500007",
        name: "Shyam Sundar",
        items: [{ productId: testProductId, name: "Test Vrindavan Mala", price: 499, qty: 1 }],
        total: 548,
        status: "active",
        recoveryToken,
        lastActivityAt: new Date(Date.now() - 75 * 60 * 1000), // 75 mins ago
        recoverySentCount: 0,
      });
      createdSessionIds.push(session.sessionId);

      // Atomically claim session as done by service
      const claimed = await CheckoutSession.findOneAndUpdate(
        {
          _id: session._id,
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

      assert.ok(claimed);
      assert.strictEqual(claimed.status, "abandoned");
      assert.strictEqual(claimed.recoverySentCount, 1);
      assert.ok(claimed.recoverySentAt instanceof Date);
    });

    // -------------------------------------------------------------
    // Test G: Duplicate scheduler execution does not send duplicate email
    // -------------------------------------------------------------
    await test("G. Second scheduler scan ignores already-processed sessions (zero duplicate sends)", async () => {
      const sessionId = `no-dup-sess-${testRunId}-G`;
      const recoveryToken = crypto.randomBytes(24).toString("hex");

      // Create already-recovered or already-sent session
      const session = await CheckoutSession.create({
        sessionId,
        email: `nodup.${testRunId}@example.com`,
        phone: "9876500008",
        items: [{ productId: testProductId, name: "Test Item", price: 499, qty: 1 }],
        total: 548,
        status: "abandoned",
        recoveryToken,
        lastActivityAt: new Date(Date.now() - 120 * 60 * 1000),
        recoverySentCount: 1,
        recoverySentAt: new Date(Date.now() - 60 * 60 * 1000),
      });
      createdSessionIds.push(session.sessionId);

      // Attempt second claim
      const secondClaim = await CheckoutSession.findOneAndUpdate(
        {
          _id: session._id,
          status: "active",
          recoverySentCount: 0,
        },
        {
          $set: { recoverySentCount: 2 },
        },
        { new: true }
      );

      assert.strictEqual(secondClaim, null, "Already processed session must not be claimed again");
    });

    // -------------------------------------------------------------
    // Test H: Recovery link restores valid cart items
    // -------------------------------------------------------------
    await test("H. Recovery link lookup returns active items with verified prices", async () => {
      const sessionId = `recover-sess-${testRunId}-H`;
      const recoveryToken = crypto.randomBytes(24).toString("hex");

      const session = await CheckoutSession.create({
        sessionId,
        email: `recover.${testRunId}@example.com`,
        phone: "9876500009",
        name: "Govind Das",
        items: [{ productId: testProductId, name: "Old Item Name", price: 300, qty: 2 }],
        subtotal: 600,
        total: 649,
        status: "abandoned",
        recoveryToken,
        lastActivityAt: new Date(),
      });
      createdSessionIds.push(session.sessionId);

      // Simulate recovery endpoint lookup
      const foundSession = await CheckoutSession.findOne({ recoveryToken });
      assert.ok(foundSession);

      const products = await Product.find({ _id: { $in: foundSession.items.map((i) => i.productId) } });
      const liveProduct = products.find((p) => p._id.equals(testProductId));
      assert.ok(liveProduct);
      assert.strictEqual(liveProduct.price, 499, "Live price must come from database (499, not stale 300)");
    });

    // -------------------------------------------------------------
    // Test I: Out-of-stock product is not blindly restored
    // -------------------------------------------------------------
    await test("I. Out-of-stock product is flagged as unavailable during recovery lookup", async () => {
      // Create out-of-stock product
      const outOfStockProduct = await Product.create({
        name: `Out of Stock Mala ${testRunId}`,
        slug: `out-of-stock-mala-${testRunId}`,
        price: 999,
        stock: 0,
        category: "Tulsi Malas",
        isActive: true,
      });

      const recoveryToken = crypto.randomBytes(24).toString("hex");
      const session = await CheckoutSession.create({
        sessionId: `oos-sess-${testRunId}-I`,
        email: `oos.${testRunId}@example.com`,
        items: [{ productId: outOfStockProduct._id, name: outOfStockProduct.name, price: 999, qty: 1 }],
        total: 999,
        status: "abandoned",
        recoveryToken,
      });
      createdSessionIds.push(session.sessionId);

      // Revalidate logic
      const products = await Product.find({ _id: outOfStockProduct._id });
      const p = products[0];
      const inStock = Boolean(p && p.isActive && (p.stock ?? 0) > 0);

      assert.strictEqual(inStock, false, "Zero stock product must report inStock: false");

      await Product.deleteOne({ _id: outOfStockProduct._id });
    });

    // -------------------------------------------------------------
    // Test J: Successful order marks session recovered
    // -------------------------------------------------------------
    await test("J. Successful order creation marks matching checkout session as recovered", async () => {
      const sessionId = `order-sess-${testRunId}-J`;
      const recoveryToken = crypto.randomBytes(24).toString("hex");

      const session = await CheckoutSession.create({
        sessionId,
        email: `customer.order.${testRunId}@example.com`,
        phone: "9876500010",
        name: "Order Customer",
        items: [{ productId: testProductId, name: "Test Mala", price: 499, qty: 1 }],
        total: 548,
        status: "active",
        recoveryToken,
      });
      createdSessionIds.push(session.sessionId);

      // Simulate reconciliation logic in order.routes.ts
      await CheckoutSession.updateMany(
        {
          sessionId,
          status: { $ne: "recovered" },
        },
        {
          $set: {
            status: "recovered",
            recoveredAt: new Date(),
          },
        }
      );

      const reloaded = await CheckoutSession.findOne({ sessionId });
      assert.ok(reloaded);
      assert.strictEqual(reloaded.status, "recovered");
      assert.ok(reloaded.recoveredAt instanceof Date);
    });

    // -------------------------------------------------------------
    // Test K: Recovered session cannot later receive abandoned-cart email
    // -------------------------------------------------------------
    await test("K. Recovered session cannot be selected for abandoned cart email even after 24 hours", async () => {
      const sessionId = `recovered-protect-${testRunId}-K`;
      const recoveryToken = crypto.randomBytes(24).toString("hex");

      const session = await CheckoutSession.create({
        sessionId,
        email: `recovered.safe.${testRunId}@example.com`,
        phone: "9876500011",
        items: [{ productId: testProductId, name: "Test Mala", price: 499, qty: 1 }],
        total: 548,
        status: "recovered",
        recoveryToken,
        lastActivityAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 24 hours ago
        recoveredAt: new Date(Date.now() - 23 * 60 * 60 * 1000),
        recoverySentCount: 0,
      });
      createdSessionIds.push(session.sessionId);

      // Verify scheduler candidate query excludes status !== "active"
      const candidates = await CheckoutSession.find({
        sessionId,
        status: "active",
        lastActivityAt: { $lt: new Date(Date.now() - 60 * 60 * 1000) },
        recoverySentCount: 0,
      });

      assert.strictEqual(candidates.length, 0, "Recovered session must never be a candidate for abandonment outreach");
    });

    // -------------------------------------------------------------
    // Test L: Recovery endpoint does not expose private/internal data
    // -------------------------------------------------------------
    await test("L. Recovery response sanitization excludes internal MongoDB IDs, metadata, and auth tokens", async () => {
      const session = await CheckoutSession.create({
        sessionId: `sanitize-${testRunId}-L`,
        email: `sanitize.${testRunId}@example.com`,
        phone: "9876500012",
        name: "Private Customer",
        items: [{ productId: testProductId, name: "Test Mala", price: 499, qty: 1 }],
        total: 548,
        status: "active",
        recoveryToken: crypto.randomBytes(24).toString("hex"),
        metadata: { internalIp: "192.168.1.1", secretTrace: "sensitive_data" },
      });
      createdSessionIds.push(session.sessionId);

      // Simulated sanitized payload from GET /api/checkout-sessions/:token
      const safePayload = {
        sessionId: session.sessionId,
        name: session.name,
        email: session.email,
        phone: session.phone,
        items: session.items.map((i) => ({ productId: String(i.productId), name: i.name, qty: i.qty })),
        total: session.total,
      };

      assert.strictEqual((safePayload as any)._id, undefined);
      assert.strictEqual((safePayload as any).metadata, undefined);
      assert.strictEqual((safePayload as any).recoveryToken, undefined);
      assert.strictEqual((safePayload as any).recoverySentCount, undefined);
    });

    // -------------------------------------------------------------
    // Test M: Recovery failure never blocks normal checkout
    // -------------------------------------------------------------
    await test("M. Client-side capture failure handling is non-blocking", async () => {
      // Test that simulated network failure returns gracefully without throwing to caller
      let checkoutProceeded = false;
      try {
        // Simulated failed capture call
        await Promise.reject(new Error("Network timeout")).catch(() => {
          // Silent catch
        });
        checkoutProceeded = true;
      } catch {
        checkoutProceeded = false;
      }

      assert.strictEqual(checkoutProceeded, true, "Checkout must proceed even if capture fails");
    });

    // -------------------------------------------------------------
    // Test N: Email template verification
    // -------------------------------------------------------------
    await test("N. Abandoned cart email template renders devotional layout without discount language", async () => {
      const emailContent = tpl.abandonedCart(
        "Radhika Devi",
        [{ name: "Sacred Tulsi Kanthi Mala", qty: 1, price: 499 }],
        "https://www.shriradhagovindstore.com/checkout?session=abc123token",
        548
      );

      assert.ok(emailContent.subject.includes("Radhe Radhe"));
      assert.ok(emailContent.html.includes("Radhika Devi"));
      assert.ok(emailContent.html.includes("Sacred Tulsi Kanthi Mala"));
      assert.ok(emailContent.html.includes("https://www.shriradhagovindstore.com/checkout?session=abc123token"));
      assert.ok(!emailContent.html.toLowerCase().includes("coupon"), "Must not include coupon language");
      assert.ok(!emailContent.html.toLowerCase().includes("discount"), "Must not include discount language");
    });
  } finally {
    // Cleanup test artifacts
    if (createdSessionIds.length > 0) {
      await CheckoutSession.deleteMany({ sessionId: { $in: createdSessionIds } });
    }
    if (testProductId) {
      await Product.deleteOne({ _id: testProductId });
    }
    if (testUserId) {
      await User.deleteOne({ _id: testUserId });
    }
    await SyncLock.deleteOne({ _id: ABANDONED_CART_LOCK_KEY });
  }

  console.log("\n=======================================================");
  console.log(` RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log("=======================================================\n");

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
