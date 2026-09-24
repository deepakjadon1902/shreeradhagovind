import "dotenv/config";
import assert from "node:assert";
import mongoose from "mongoose";
import crypto from "crypto";
import { connectDB } from "../config/db";
import { Product } from "../models/Product";
import { Order } from "../models/Order";
import { User } from "../models/User";
import {
  evaluateInvoiceDownloadEligibility,
  getOrderDeliveryTimestamp,
  INVOICE_DIRECT_DOWNLOAD_WINDOW_MS,
} from "../routes/order.routes";
import { generateInvoicePDF, type InvoiceData } from "../utils/invoice";
import { formatOrderNumber } from "../utils/email";

async function runInvoicePhase1Tests() {
  console.log("\n=======================================================");
  console.log(" PHASE 1 INVOICE AVAILABILITY & ELIGIBILITY VERIFICATION");
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

  const testRunId = `test-inv-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;
  const createdProductIds: mongoose.Types.ObjectId[] = [];
  const createdOrderIds: mongoose.Types.ObjectId[] = [];
  const createdUserIds: mongoose.Types.ObjectId[] = [];

  async function createTestProduct(stock = 25) {
    const p = await Product.create({
      name: `Test Devotional Mala ${testRunId}-${createdProductIds.length}`,
      slug: `test-devotional-mala-${testRunId}-${createdProductIds.length}`,
      description: "Sacred test item for invoice audit",
      price: 499,
      mrp: 999,
      category: "Tulsi Malas",
      stock,
      isActive: true,
      hsnCode: "7117",
      gstRate: 3,
    });
    createdProductIds.push(p._id as mongoose.Types.ObjectId);
    return p;
  }

  async function createTestUser(emailPrefix = "user") {
    const u = await User.create({
      name: `Devotee ${emailPrefix}`,
      email: `${emailPrefix}.${testRunId}@example.com`,
      phone: "9876543210",
      role: "user",
    });
    createdUserIds.push(u._id as mongoose.Types.ObjectId);
    return u;
  }

  let testOrderCounter = 960000 + Math.floor(Math.random() * 10000);

  async function createTestOrder(opts: {
    status?: any;
    user?: any;
    customerEmail?: string;
    guestAccessToken?: string;
    deliveredAt?: Date | null;
    statusHistory?: any[];
  }) {
    const pId = createdProductIds[0] || (await createTestProduct())._id;
    const orderNo = testOrderCounter++;

    const o = await Order.create({
      user: opts.user,
      customerEmail: opts.customerEmail || "devotee@example.com",
      orderNo,
      trackingId: `TEST-AWB-${orderNo}`,
      courier: "DTDC",
      status: opts.status || "Placed",
      deliveredAt: opts.deliveredAt ?? null,
      statusHistory: opts.statusHistory || [
        {
          status: opts.status || "Placed",
          changedAt: new Date(),
          changedBy: "test",
          note: "Initial test status",
        },
      ],
      items: [
        {
          productId: pId,
          name: "Original 108 Beads Tulsi Japa Mala",
          qty: 1,
          price: 499,
          hsnCode: "7117",
          gstRate: 3,
          gstInclusive: true,
          taxableAmount: 484.47,
          gstAmount: 14.53,
        },
      ],
      subtotal: 499,
      shipping: 0,
      total: 499,
      address: {
        name: "Devotee Raman",
        phone: "9876543210",
        line1: "Near Bankey Bihari Temple",
        city: "Vrindavan",
        state: "Uttar Pradesh",
        pincode: "281121",
      },
      payment: {
        method: "razorpay",
        status: "paid",
        razorpayPaymentId: `pay_test_${Date.now()}`,
      },
      guestAccessToken: opts.guestAccessToken,
    });

    createdOrderIds.push(o._id as mongoose.Types.ObjectId);
    return o;
  }

  try {
    const prod = await createTestProduct(50);
    const userA = await createTestUser("customerA");
    const userB = await createTestUser("customerB");
    const adminUser = { sub: "admin-123", email: "admin@shriradhagovindstore.com", role: "admin" as const };
    const authA = { sub: String(userA._id), email: userA.email, role: "user" as const };
    const authB = { sub: String(userB._id), email: userB.email, role: "user" as const };

    // -------------------------------------------------------------
    // Test 1: Placed -> invoice blocked
    // -------------------------------------------------------------
    await test("1. Placed -> invoice blocked", async () => {
      const order = await createTestOrder({ status: "Placed", user: userA._id });
      const eligibility = evaluateInvoiceDownloadEligibility(order, authA);

      assert.strictEqual(eligibility.allowed, false);
      assert.strictEqual(eligibility.httpStatus, 400);
      assert.ok(eligibility.reason?.includes("Placed"));
    });

    // -------------------------------------------------------------
    // Test 2: Confirmed -> invoice allowed
    // -------------------------------------------------------------
    await test("2. Confirmed -> invoice allowed", async () => {
      const order = await createTestOrder({ status: "Confirmed", user: userA._id });
      const eligibility = evaluateInvoiceDownloadEligibility(order, authA);

      assert.strictEqual(eligibility.allowed, true);
    });

    // -------------------------------------------------------------
    // Test 3: Processing -> invoice allowed
    // -------------------------------------------------------------
    await test("3. Processing -> invoice allowed", async () => {
      const order = await createTestOrder({ status: "Processing", user: userA._id });
      const eligibility = evaluateInvoiceDownloadEligibility(order, authA);

      assert.strictEqual(eligibility.allowed, true);
    });

    // -------------------------------------------------------------
    // Test 4: Hold -> invoice allowed
    // -------------------------------------------------------------
    await test("4. Hold -> invoice allowed", async () => {
      const order = await createTestOrder({ status: "Hold", user: userA._id });
      const eligibility = evaluateInvoiceDownloadEligibility(order, authA);

      assert.strictEqual(eligibility.allowed, true);
    });

    // -------------------------------------------------------------
    // Test 5: Packed -> invoice allowed
    // -------------------------------------------------------------
    await test("5. Packed -> invoice allowed", async () => {
      const order = await createTestOrder({ status: "Packed", user: userA._id });
      const eligibility = evaluateInvoiceDownloadEligibility(order, authA);

      assert.strictEqual(eligibility.allowed, true);
    });

    // -------------------------------------------------------------
    // Test 6: Shipped -> invoice allowed
    // -------------------------------------------------------------
    await test("6. Shipped -> invoice allowed", async () => {
      const order = await createTestOrder({ status: "Shipped", user: userA._id });
      const eligibility = evaluateInvoiceDownloadEligibility(order, authA);

      assert.strictEqual(eligibility.allowed, true);
    });

    // -------------------------------------------------------------
    // Test 7: Out for delivery -> invoice allowed
    // -------------------------------------------------------------
    await test("7. Out for delivery -> invoice allowed", async () => {
      const order = await createTestOrder({ status: "Out for delivery", user: userA._id });
      const eligibility = evaluateInvoiceDownloadEligibility(order, authA);

      assert.strictEqual(eligibility.allowed, true);
    });

    // -------------------------------------------------------------
    // Test 8: Delivered exactly 7 days -> invoice allowed
    // -------------------------------------------------------------
    await test("8. Delivered exactly 7 days -> invoice allowed", async () => {
      const now = Date.now();
      const sevenDaysAgo = new Date(now - INVOICE_DIRECT_DOWNLOAD_WINDOW_MS);

      const order = await createTestOrder({
        status: "Delivered",
        user: userA._id,
        deliveredAt: sevenDaysAgo,
      });

      // Exactly 7 days (elapsed === INVOICE_DIRECT_DOWNLOAD_WINDOW_MS)
      const eligibility = evaluateInvoiceDownloadEligibility(order, authA, undefined, now);

      assert.strictEqual(eligibility.allowed, true, "At exactly 7.000 days, download must be allowed");
    });

    // -------------------------------------------------------------
    // Test 9: Delivered 7 days + 1ms -> invoice blocked
    // -------------------------------------------------------------
    await test("9. Delivered 7 days + 1ms -> invoice blocked", async () => {
      const now = Date.now();
      // Delivered 7 days and 1 millisecond ago
      const sevenDaysAndOneMsAgo = new Date(now - INVOICE_DIRECT_DOWNLOAD_WINDOW_MS - 1);

      const order = await createTestOrder({
        status: "Delivered",
        user: userA._id,
        deliveredAt: sevenDaysAndOneMsAgo,
      });

      const eligibility = evaluateInvoiceDownloadEligibility(order, authA, undefined, now);

      assert.strictEqual(eligibility.allowed, false, "At 7 days + 1ms, download must be blocked");
      assert.strictEqual(eligibility.httpStatus, 410);
      assert.strictEqual(eligibility.isDeliveredExpired, true);
      assert.ok(eligibility.reason?.includes("expired"));
    });

    // -------------------------------------------------------------
    // Test 10: Historical Delivered order using statusHistory timestamp -> correct behavior
    // -------------------------------------------------------------
    await test("10. Historical Delivered order using statusHistory timestamp -> correct behavior", async () => {
      const now = Date.now();
      const threeDaysAgo = new Date(now - 3 * 24 * 60 * 60 * 1000);
      const tenDaysAgo = new Date(now - 10 * 24 * 60 * 60 * 1000);

      // Subtest 10A: Historical delivered 3 days ago (deliveredAt is null, statusHistory has Delivered)
      const orderRecent = await createTestOrder({
        status: "Delivered",
        user: userA._id,
        deliveredAt: null,
        statusHistory: [
          { status: "Placed", changedAt: new Date(now - 5 * 24 * 60 * 60 * 1000) },
          { status: "Delivered", changedAt: threeDaysAgo },
        ],
      });

      const recentTime = getOrderDeliveryTimestamp(orderRecent);
      assert.strictEqual(recentTime?.getTime(), threeDaysAgo.getTime());
      const elRecent = evaluateInvoiceDownloadEligibility(orderRecent, authA, undefined, now);
      assert.strictEqual(elRecent.allowed, true, "Historical order delivered 3 days ago must be allowed");

      // Subtest 10B: Historical delivered 10 days ago (deliveredAt is null, statusHistory has Delivered)
      const orderOld = await createTestOrder({
        status: "Delivered",
        user: userA._id,
        deliveredAt: null,
        statusHistory: [
          { status: "Placed", changedAt: new Date(now - 12 * 24 * 60 * 60 * 1000) },
          { status: "Delivered", changedAt: tenDaysAgo },
        ],
      });

      const oldTime = getOrderDeliveryTimestamp(orderOld);
      assert.strictEqual(oldTime?.getTime(), tenDaysAgo.getTime());
      const elOld = evaluateInvoiceDownloadEligibility(orderOld, authA, undefined, now);
      assert.strictEqual(elOld.allowed, false, "Historical order delivered 10 days ago must be blocked");
      assert.strictEqual(elOld.httpStatus, 410);
    });

    // -------------------------------------------------------------
    // Test 11: Existing customer authorization remains enforced
    // -------------------------------------------------------------
    await test("11. Existing customer authorization remains enforced", async () => {
      const order = await createTestOrder({ status: "Confirmed", user: userA._id });

      // User B attempts to access User A's confirmed order
      const unauthorized = evaluateInvoiceDownloadEligibility(order, authB);
      assert.strictEqual(unauthorized.allowed, false);
      assert.strictEqual(unauthorized.httpStatus, 403);

      // Unauthenticated caller attempts to access User A's confirmed order
      const unauthenticated = evaluateInvoiceDownloadEligibility(order, undefined);
      assert.strictEqual(unauthenticated.allowed, false);
      assert.strictEqual(unauthenticated.httpStatus, 403);
    });

    // -------------------------------------------------------------
    // Test 12: Guest token authorization remains enforced
    // -------------------------------------------------------------
    await test("12. Guest token authorization remains enforced", async () => {
      const secretGuestToken = `guest_sec_${Date.now()}`;
      const guestOrder = await createTestOrder({
        status: "Confirmed",
        user: undefined,
        guestAccessToken: secretGuestToken,
      });

      // No token -> 403
      const noToken = evaluateInvoiceDownloadEligibility(guestOrder, undefined, undefined);
      assert.strictEqual(noToken.allowed, false);
      assert.strictEqual(noToken.httpStatus, 403);

      // Wrong token -> 403
      const badToken = evaluateInvoiceDownloadEligibility(guestOrder, undefined, "wrong-token-abc");
      assert.strictEqual(badToken.allowed, false);
      assert.strictEqual(badToken.httpStatus, 403);

      // Valid token -> allowed
      const validToken = evaluateInvoiceDownloadEligibility(guestOrder, undefined, secretGuestToken);
      assert.strictEqual(validToken.allowed, true);
    });

    // -------------------------------------------------------------
    // Test 13: Admin invoice access remains available
    // -------------------------------------------------------------
    await test("13. Admin invoice access remains available", async () => {
      // Admin on Placed order
      const placedOrder = await createTestOrder({ status: "Placed", user: userA._id });
      const adminPlaced = evaluateInvoiceDownloadEligibility(placedOrder, adminUser);
      assert.strictEqual(adminPlaced.allowed, true, "Admin can download invoice on Placed orders");

      // Admin on Delivered order expired 30 days ago
      const expiredDelivered = await createTestOrder({
        status: "Delivered",
        user: userA._id,
        deliveredAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      });
      const adminExpired = evaluateInvoiceDownloadEligibility(expiredDelivered, adminUser);
      assert.strictEqual(adminExpired.allowed, true, "Admin can download invoice on expired Delivered orders");
    });

    // -------------------------------------------------------------
    // Test 14: PDF generation succeeds for confirmed order
    // -------------------------------------------------------------
    await test("14. PDF generation succeeds for confirmed order", async () => {
      const order = await createTestOrder({ status: "Confirmed", user: userA._id });
      const orderNum = formatOrderNumber(order);

      const invoiceData: InvoiceData = {
        orderId: String(order._id),
        orderNo: order.orderNo ?? orderNum,
        invoiceNo: `INV-${orderNum}`,
        trackingId: order.trackingId ?? undefined,
        courier: order.courier ?? null,
        status: order.status,
        customerName: order.address?.name || "Customer",
        customerEmail: order.customerEmail ?? undefined,
        items: order.items as any,
        subtotal: order.subtotal,
        shipping: order.shipping,
        total: order.total,
        address: order.address as any,
        payment: {
          method: "razorpay",
          status: "paid",
        },
        createdAt: order.createdAt,
      };

      const pdf = await generateInvoicePDF(invoiceData);
      assert.ok(Buffer.isBuffer(pdf));
      assert.ok(pdf.length > 5000, "PDF buffer must contain binary document content");
    });
  } finally {
    // -------------------------------------------------------------
    // ZERO-LEFTOVER CLEANUP
    // -------------------------------------------------------------
    console.log("\n-------------------------------------------------------");
    console.log(" EXECUTING ZERO-LEFTOVER CLEANUP OF TEST DOCUMENTS");
    console.log("-------------------------------------------------------");

    if (createdOrderIds.length > 0) {
      await Order.deleteMany({ _id: { $in: createdOrderIds } });
    }
    if (createdProductIds.length > 0) {
      await Product.deleteMany({ _id: { $in: createdProductIds } });
    }
    if (createdUserIds.length > 0) {
      await User.deleteMany({ _id: { $in: createdUserIds } });
    }

    const remainingOrders = await Order.countDocuments({ _id: { $in: createdOrderIds } });
    const remainingProducts = await Product.countDocuments({ _id: { $in: createdProductIds } });
    const remainingUsers = await User.countDocuments({ _id: { $in: createdUserIds } });

    console.log(`  Cleanup results:`);
    console.log(`    - Orders remaining:   ${remainingOrders}`);
    console.log(`    - Products remaining: ${remainingProducts}`);
    console.log(`    - Users remaining:    ${remainingUsers}`);

    assert.strictEqual(remainingOrders, 0, "All test orders must be removed");
    assert.strictEqual(remainingProducts, 0, "All test products must be removed");
    assert.strictEqual(remainingUsers, 0, "All test users must be removed");
    console.log("  ✅ Zero leftover test data verified in MongoDB.\n");

    await mongoose.disconnect();
  }

  console.log("=======================================================");
  console.log(` TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log("=======================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runInvoicePhase1Tests().catch((err) => {
  console.error("Fatal test runner error:", err);
  process.exit(1);
});
