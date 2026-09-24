import "dotenv/config";
import assert from "node:assert";
import mongoose from "mongoose";
import crypto from "crypto";
import { connectDB } from "../config/db";
import { Product } from "../models/Product";
import { Order } from "../models/Order";
import { User } from "../models/User";
import {
  cancelOrderAtomically,
  restockOrderItems,
  CANCELLABLE_STATUSES_CUSTOMER,
  CANCELLABLE_STATUSES_ADMIN,
} from "../services/cancellation.service";
import { isOrderPaidForFinance } from "../routes/admin.routes";
import { checkOrderAccess } from "../routes/order.routes";
import { tpl, formatOrderNumber } from "../utils/email";
import { verifyRazorpayWebhookSignature } from "../routes/payment.routes";
import { getCourierTrackingUrl } from "../utils/courier";

async function runPhase1Tests() {
  console.log("\n=======================================================");
  console.log(" PHASE 1 CANCELLATION & STOCK RESTORATION VERIFICATION");
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

  const testRunId = `test-cancel-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;
  const createdProductIds: mongoose.Types.ObjectId[] = [];
  const createdOrderIds: mongoose.Types.ObjectId[] = [];
  const createdUserIds: mongoose.Types.ObjectId[] = [];

  // Helper to create test product
  async function createTestProduct(initialStock = 20) {
    const p = await Product.create({
      name: `Test Devotional Product ${testRunId}-${createdProductIds.length}`,
      slug: `test-devotional-product-${testRunId}-${createdProductIds.length}`,
      description: "Sacred test item for cancellation audit",
      price: 299,
      mrp: 499,
      category: "Tulsi Malas",
      stock: initialStock,
      isActive: true,
    });
    createdProductIds.push(p._id as mongoose.Types.ObjectId);
    return p;
  }

  // Helper to create test user
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

  let testOrderCounter = 950000 + Math.floor(Math.random() * 10000);

  // Helper to create test order
  async function createTestOrder(opts: {
    status?: any;
    user?: any;
    customerEmail?: string;
    guestAccessToken?: string;
    items?: Array<{ productId: any; qty: number; name?: string; price?: number }>;
    paymentMethod?: "razorpay" | "cod";
    paymentStatus?: "pending" | "paid" | "failed";
  }) {
    const items = opts.items || [
      {
        productId: createdProductIds[0],
        name: "Test Devotional Product",
        qty: 1,
        price: 299,
      },
    ];
    const subtotal = items.reduce((sum, it) => sum + (it.price || 299) * it.qty, 0);
    const orderNo = testOrderCounter++;

    const o = await Order.create({
      user: opts.user,
      customerEmail: opts.customerEmail || `customer.${testRunId}@example.com`,
      orderNo,
      items,
      subtotal,
      shipping: 0,
      total: subtotal,
      payment: {
        method: opts.paymentMethod || "razorpay",
        status: opts.paymentStatus || "paid",
        razorpayPaymentId: `pay_test_${Date.now()}`,
      },
      status: opts.status || "Placed",
      guestAccessToken: opts.guestAccessToken,
      address: {
        name: "Test Devotee",
        phone: "9876543210",
        line1: "Raman Reti",
        city: "Vrindavan",
        state: "Uttar Pradesh",
        pincode: "281121",
      },
    });
    createdOrderIds.push(o._id as mongoose.Types.ObjectId);
    return o;
  }

  try {
    const userA = await createTestUser("devoteeA");
    const userB = await createTestUser("devoteeB");
    const testProd = await createTestProduct(50);

    // -------------------------------------------------------------
    // Test A: Customer can cancel Placed order
    // -------------------------------------------------------------
    await test("A. Customer can cancel Placed order", async () => {
      const order = await createTestOrder({ status: "Placed", user: userA._id });
      const result = await cancelOrderAtomically({
        orderId: order._id,
        cancellableStatuses: CANCELLABLE_STATUSES_CUSTOMER,
        cancelledBy: "customer",
        cancellationReason: "Changed my mind",
        sendNotificationEmail: false,
      });

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.order.status, "Cancelled");
      assert.strictEqual(result.order.cancelledBy, "customer");
      assert.strictEqual(result.order.cancellationReason, "Changed my mind");
      assert.strictEqual(result.order.isRestocked, true);
    });

    // -------------------------------------------------------------
    // Test B: Customer can cancel Confirmed order
    // -------------------------------------------------------------
    await test("B. Customer can cancel Confirmed order", async () => {
      const order = await createTestOrder({ status: "Confirmed", user: userA._id });
      const result = await cancelOrderAtomically({
        orderId: order._id,
        cancellableStatuses: CANCELLABLE_STATUSES_CUSTOMER,
        cancelledBy: "customer",
        cancellationReason: "Ordered by mistake",
        sendNotificationEmail: false,
      });

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.order.status, "Cancelled");
    });

    // -------------------------------------------------------------
    // Test C: Customer cannot cancel Processing order
    // -------------------------------------------------------------
    await test("C. Customer cannot cancel Processing order", async () => {
      const order = await createTestOrder({ status: "Processing", user: userA._id });
      const result = await cancelOrderAtomically({
        orderId: order._id,
        cancellableStatuses: CANCELLABLE_STATUSES_CUSTOMER,
        cancelledBy: "customer",
        cancellationReason: "Need to change the order",
        sendNotificationEmail: false,
      });

      assert.strictEqual(result.success, false);
      assert.strictEqual(result.statusNotCancellable, true);
      assert.strictEqual(result.currentStatus, "Processing");
    });

    // -------------------------------------------------------------
    // Test D: Customer cannot cancel Hold order
    // -------------------------------------------------------------
    await test("D. Customer cannot cancel Hold order", async () => {
      const order = await createTestOrder({ status: "Hold", user: userA._id });
      const result = await cancelOrderAtomically({
        orderId: order._id,
        cancellableStatuses: CANCELLABLE_STATUSES_CUSTOMER,
        cancelledBy: "customer",
        cancellationReason: "Delivery time is not suitable",
        sendNotificationEmail: false,
      });

      assert.strictEqual(result.success, false);
      assert.strictEqual(result.statusNotCancellable, true);
      assert.strictEqual(result.currentStatus, "Hold");
    });

    // -------------------------------------------------------------
    // Test E: Customer cannot cancel Packed order
    // -------------------------------------------------------------
    await test("E. Customer cannot cancel Packed order", async () => {
      const order = await createTestOrder({ status: "Packed", user: userA._id });
      const result = await cancelOrderAtomically({
        orderId: order._id,
        cancellableStatuses: CANCELLABLE_STATUSES_CUSTOMER,
        cancelledBy: "customer",
        cancellationReason: "Changed mind",
        sendNotificationEmail: false,
      });

      assert.strictEqual(result.success, false);
      assert.strictEqual(result.statusNotCancellable, true);
      assert.strictEqual(result.currentStatus, "Packed");
    });

    // -------------------------------------------------------------
    // Test F: Customer cannot cancel Shipped order
    // -------------------------------------------------------------
    await test("F. Customer cannot cancel Shipped order", async () => {
      const order = await createTestOrder({ status: "Shipped", user: userA._id });
      const result = await cancelOrderAtomically({
        orderId: order._id,
        cancellableStatuses: CANCELLABLE_STATUSES_CUSTOMER,
        cancelledBy: "customer",
        cancellationReason: "Changed mind",
        sendNotificationEmail: false,
      });

      assert.strictEqual(result.success, false);
      assert.strictEqual(result.statusNotCancellable, true);
      assert.strictEqual(result.currentStatus, "Shipped");
    });

    // -------------------------------------------------------------
    // Test G: Customer cannot cancel Delivered order
    // -------------------------------------------------------------
    await test("G. Customer cannot cancel Delivered order", async () => {
      const order = await createTestOrder({ status: "Delivered", user: userA._id });
      const result = await cancelOrderAtomically({
        orderId: order._id,
        cancellableStatuses: CANCELLABLE_STATUSES_CUSTOMER,
        cancelledBy: "customer",
        cancellationReason: "Changed mind",
        sendNotificationEmail: false,
      });

      assert.strictEqual(result.success, false);
      assert.strictEqual(result.statusNotCancellable, true);
      assert.strictEqual(result.currentStatus, "Delivered");
    });

    // -------------------------------------------------------------
    // Test H: Customer cannot cancel another customer's order
    // -------------------------------------------------------------
    await test("H. Customer cannot cancel another customer's order", async () => {
      const order = await createTestOrder({ status: "Placed", user: userA._id });
      // Caller is userB attempting to access userA's order
      const access = checkOrderAccess(order, { sub: String(userB._id), email: userB.email, role: "user" });

      assert.strictEqual(access.allowed, false);
      assert.strictEqual(access.isOwner, false);
    });

    // -------------------------------------------------------------
    // Test I: Guest cancellation respects guest access token
    // -------------------------------------------------------------
    await test("I. Guest cancellation respects guest access token", async () => {
      const secretToken = `guest-token-${Date.now()}`;
      const guestOrder = await createTestOrder({
        status: "Placed",
        user: undefined,
        guestAccessToken: secretToken,
      });

      // 1. Without token: access forbidden
      const noTokenAccess = checkOrderAccess(guestOrder, undefined, undefined);
      assert.strictEqual(noTokenAccess.allowed, false);

      // 2. With invalid token: access forbidden
      const badTokenAccess = checkOrderAccess(guestOrder, undefined, "wrong-token-xyz");
      assert.strictEqual(badTokenAccess.allowed, false);

      // 3. With valid token: access granted
      const validTokenAccess = checkOrderAccess(guestOrder, undefined, secretToken);
      assert.strictEqual(validTokenAccess.allowed, true);
      assert.strictEqual(validTokenAccess.isTokenAuthorized, true);
    });

    // -------------------------------------------------------------
    // Test J: Cancellation restores exact stock quantity
    // -------------------------------------------------------------
    await test("J. Cancellation restores exact stock quantity", async () => {
      const prodJ = await createTestProduct(30);
      // Simulate checkout decrement: 30 - 5 = 25
      await Product.findByIdAndUpdate(prodJ._id, { $inc: { stock: -5 } });
      const order = await createTestOrder({
        status: "Confirmed",
        items: [{ productId: prodJ._id, qty: 5, price: 299 }],
      });

      // Verify stock before cancellation
      const beforeCancel = await Product.findById(prodJ._id);
      assert.strictEqual(beforeCancel?.stock, 25);

      // Cancel order
      const result = await cancelOrderAtomically({
        orderId: order._id,
        cancellableStatuses: CANCELLABLE_STATUSES_CUSTOMER,
        cancelledBy: "customer",
        cancellationReason: "Stock test",
        sendNotificationEmail: false,
      });

      assert.strictEqual(result.success, true);

      // Verify stock restored back to 30
      const afterCancel = await Product.findById(prodJ._id);
      assert.strictEqual(afterCancel?.stock, 30);
    });

    // -------------------------------------------------------------
    // Test K: Concurrent/double cancellation restores stock only once
    // -------------------------------------------------------------
    await test("K. Concurrent/double cancellation restores stock only once", async () => {
      const prodK = await createTestProduct(50);
      // Simulate checkout decrement: 50 - 8 = 42
      await Product.findByIdAndUpdate(prodK._id, { $inc: { stock: -8 } });
      const order = await createTestOrder({
        status: "Placed",
        items: [{ productId: prodK._id, qty: 8, price: 299 }],
      });

      // Fire 10 simultaneous cancellation requests
      const results = await Promise.all(
        Array.from({ length: 10 }).map((_, i) =>
          cancelOrderAtomically({
            orderId: order._id,
            cancellableStatuses: CANCELLABLE_STATUSES_CUSTOMER,
            cancelledBy: "customer",
            cancellationReason: `Concurrent attempt ${i + 1}`,
            sendNotificationEmail: false,
          })
        )
      );

      const successful = results.filter((r) => r.success);
      const rejected = results.filter((r) => !r.success);

      assert.strictEqual(successful.length, 1, "Exactly one concurrent cancellation must succeed");
      assert.strictEqual(rejected.length, 9, "All 9 competing attempts must be rejected");

      // Verify stock is restored by 8 exactly once (42 + 8 = 50, NOT 42 + 80 = 122)
      const finalProd = await Product.findById(prodK._id);
      assert.strictEqual(finalProd?.stock, 50, "Stock must be 50, demonstrating zero duplicate restocking");
    });

    // -------------------------------------------------------------
    // Test L: Admin cancellation restores stock across Confirmed/Processing/Hold/Packed
    // -------------------------------------------------------------
    await test("L. Admin cancellation restores stock across Confirmed/Processing/Hold/Packed and requires reason", async () => {
      // 1. Confirmed
      const prodConfirmed = await createTestProduct(20);
      await Product.findByIdAndUpdate(prodConfirmed._id, { $inc: { stock: -2 } });
      const orderConfirmed = await createTestOrder({
        status: "Confirmed",
        items: [{ productId: prodConfirmed._id, qty: 2, price: 299 }],
      });
      const resConfirmed = await cancelOrderAtomically({
        orderId: orderConfirmed._id,
        cancellableStatuses: CANCELLABLE_STATUSES_ADMIN,
        cancelledBy: "admin",
        cancellationReason: "Customer requested cancel via phone",
        sendNotificationEmail: false,
      });
      assert.strictEqual(resConfirmed.success, true);
      const stockConfirmed = await Product.findById(prodConfirmed._id);
      assert.strictEqual(stockConfirmed?.stock, 20);

      // 2. Processing
      const prodProcessing = await createTestProduct(20);
      await Product.findByIdAndUpdate(prodProcessing._id, { $inc: { stock: -3 } });
      const orderProcessing = await createTestOrder({
        status: "Processing",
        items: [{ productId: prodProcessing._id, qty: 3, price: 299 }],
      });
      const resProcessing = await cancelOrderAtomically({
        orderId: orderProcessing._id,
        cancellableStatuses: CANCELLABLE_STATUSES_ADMIN,
        cancelledBy: "admin",
        cancellationReason: "Out of raw devotional materials",
        sendNotificationEmail: false,
      });
      assert.strictEqual(resProcessing.success, true);
      const stockProcessing = await Product.findById(prodProcessing._id);
      assert.strictEqual(stockProcessing?.stock, 20);

      // 3. Hold
      const prodHold = await createTestProduct(20);
      await Product.findByIdAndUpdate(prodHold._id, { $inc: { stock: -4 } });
      const orderHold = await createTestOrder({
        status: "Hold",
        items: [{ productId: prodHold._id, qty: 4, price: 299 }],
      });
      const resHold = await cancelOrderAtomically({
        orderId: orderHold._id,
        cancellableStatuses: CANCELLABLE_STATUSES_ADMIN,
        cancelledBy: "admin",
        cancellationReason: "Address unserviceable after hold verification",
        sendNotificationEmail: false,
      });
      assert.strictEqual(resHold.success, true);
      const stockHold = await Product.findById(prodHold._id);
      assert.strictEqual(stockHold?.stock, 20);

      // 4. Packed
      const prodPacked = await createTestProduct(20);
      await Product.findByIdAndUpdate(prodPacked._id, { $inc: { stock: -5 } });
      const orderPacked = await createTestOrder({
        status: "Packed",
        items: [{ productId: prodPacked._id, qty: 5, price: 299 }],
      });
      const resPacked = await cancelOrderAtomically({
        orderId: orderPacked._id,
        cancellableStatuses: CANCELLABLE_STATUSES_ADMIN,
        cancelledBy: "admin",
        cancellationReason: "Item damaged in packaging stage",
        sendNotificationEmail: false,
      });
      assert.strictEqual(resPacked.success, true);
      const stockPacked = await Product.findById(prodPacked._id);
      assert.strictEqual(stockPacked?.stock, 20);
    });

    // -------------------------------------------------------------
    // Test M: Admin repeated cancellation does not restore stock twice
    // -------------------------------------------------------------
    await test("M. Admin repeated cancellation does not restore stock twice", async () => {
      const prodM = await createTestProduct(25);
      await Product.findByIdAndUpdate(prodM._id, { $inc: { stock: -5 } }); // stock = 20
      const order = await createTestOrder({
        status: "Confirmed",
        items: [{ productId: prodM._id, qty: 5, price: 299 }],
      });

      // First cancel
      const res1 = await cancelOrderAtomically({
        orderId: order._id,
        cancellableStatuses: CANCELLABLE_STATUSES_ADMIN,
        cancelledBy: "admin",
        cancellationReason: "First cancel",
        sendNotificationEmail: false,
      });
      assert.strictEqual(res1.success, true);

      // Repeat cancel on same order
      const res2 = await cancelOrderAtomically({
        orderId: order._id,
        cancellableStatuses: CANCELLABLE_STATUSES_ADMIN,
        cancelledBy: "admin",
        cancellationReason: "Second cancel attempt",
        sendNotificationEmail: false,
      });
      assert.strictEqual(res2.success, false);
      assert.strictEqual(res2.alreadyCancelled, true);

      // Stock must remain 25, not 30
      const finalProdM = await Product.findById(prodM._id);
      assert.strictEqual(finalProdM?.stock, 25);
    });

    // -------------------------------------------------------------
    // Test N: Cancellation metadata is persisted
    // -------------------------------------------------------------
    await test("N. Cancellation metadata is persisted", async () => {
      const order = await createTestOrder({ status: "Placed" });
      await cancelOrderAtomically({
        orderId: order._id,
        cancellableStatuses: CANCELLABLE_STATUSES_CUSTOMER,
        cancelledBy: "customer",
        cancellationReason: "Delivery time is not suitable",
        sendNotificationEmail: false,
      });

      const reloaded = await Order.findById(order._id);
      assert.strictEqual(reloaded?.status, "Cancelled");
      assert.strictEqual(reloaded?.cancellationReason, "Delivery time is not suitable");
      assert.strictEqual(reloaded?.cancelledBy, "customer");
      assert.ok(reloaded?.cancelledAt instanceof Date);
      assert.strictEqual(reloaded?.isRestocked, true);
      assert.ok(reloaded?.restockedAt instanceof Date);
    });

    // -------------------------------------------------------------
    // Test O: statusHistory records cancellation
    // -------------------------------------------------------------
    await test("O. statusHistory records cancellation", async () => {
      const order = await createTestOrder({ status: "Confirmed" });
      await cancelOrderAtomically({
        orderId: order._id,
        cancellableStatuses: CANCELLABLE_STATUSES_CUSTOMER,
        cancelledBy: "customer",
        cancellationReason: "Need to change the order",
        note: "Customer requested change via web portal",
        sendNotificationEmail: false,
      });

      const reloaded = await Order.findById(order._id);
      const history = reloaded?.statusHistory || [];
      const cancelEntry = history[history.length - 1];

      assert.ok(cancelEntry);
      assert.strictEqual(cancelEntry.status, "Cancelled");
      assert.strictEqual(cancelEntry.changedBy, "customer");
      assert.strictEqual(cancelEntry.note, "Customer requested change via web portal");
      assert.ok(cancelEntry.changedAt instanceof Date);
    });

    // -------------------------------------------------------------
    // Test P: Cancellation email uses Order Number
    // -------------------------------------------------------------
    await test("P. Cancellation email uses Order Number", async () => {
      const order = await createTestOrder({ status: "Placed" });
      const orderNum = formatOrderNumber(order);
      const email = tpl.orderCancelled("Radhika Devi", orderNum, "Changed my mind");

      assert.ok(email.subject.includes(`#${orderNum}`), "Subject must include readable order number");
      assert.ok(!email.subject.includes(String(order._id)), "Subject must NOT use MongoDB ObjectId");
      assert.ok(email.html.includes("Hare Krishna"), "Email must maintain devotional tone");
      assert.ok(email.html.includes(`Order Number: <b>#${orderNum}</b>`));
      assert.ok(email.html.includes("Changed my mind"), "Email must include cancellation reason");
      assert.ok(email.html.includes("support@shriradhagovindstore.com"));
    });

    // -------------------------------------------------------------
    // Test Q: Existing finance filtering remains correct
    // -------------------------------------------------------------
    await test("Q. Existing finance filtering remains correct", async () => {
      const order = await createTestOrder({
        status: "Placed",
        paymentMethod: "razorpay",
        paymentStatus: "paid",
      });

      // Before cancellation, paid order is counted for finance
      assert.strictEqual(isOrderPaidForFinance(order.toObject()), true);

      // Cancel order
      await cancelOrderAtomically({
        orderId: order._id,
        cancellableStatuses: CANCELLABLE_STATUSES_CUSTOMER,
        cancelledBy: "customer",
        cancellationReason: "Finance test",
        sendNotificationEmail: false,
      });

      const cancelledDoc = await Order.findById(order._id);
      // Cancelled orders are strictly excluded from finance analytics
      assert.strictEqual(
        isOrderPaidForFinance(cancelledDoc?.toObject()),
        false,
        "isOrderPaidForFinance must return false for Cancelled orders"
      );
    });

    // -------------------------------------------------------------
    // Test R: Existing payment status is not changed to refunded
    // -------------------------------------------------------------
    await test("R. Existing payment status is not changed to refunded", async () => {
      const order = await createTestOrder({
        status: "Confirmed",
        paymentMethod: "razorpay",
        paymentStatus: "paid",
      });

      assert.strictEqual(order.payment?.status, "paid");

      await cancelOrderAtomically({
        orderId: order._id,
        cancellableStatuses: CANCELLABLE_STATUSES_CUSTOMER,
        cancelledBy: "customer",
        cancellationReason: "Payment safety test",
        sendNotificationEmail: false,
      });

      const reloaded = await Order.findById(order._id);
      assert.strictEqual(reloaded?.status, "Cancelled");
      assert.strictEqual(
        reloaded?.payment?.status,
        "paid",
        "Phase 1 rule: payment.status must remain 'paid' and NOT be changed to 'refunded'"
      );
    });

    // -------------------------------------------------------------
    // Test S: Existing Razorpay payment/webhook tests still pass
    // -------------------------------------------------------------
    await test("S. Existing Razorpay payment/webhook tests still pass", async () => {
      const secret = "test_webhook_secret_key_12345";
      const payload = JSON.stringify({ event: "payment.captured", id: "evt_123" });
      const crypto = await import("crypto");
      const validSig = crypto.createHmac("sha256", secret).update(Buffer.from(payload)).digest("hex");

      const isValid = verifyRazorpayWebhookSignature(Buffer.from(payload), validSig, secret);
      assert.strictEqual(isValid, true, "Valid webhook signature must verify correctly");

      const isInvalid = verifyRazorpayWebhookSignature(Buffer.from(payload), "invalid_sig", secret);
      assert.strictEqual(isInvalid, false, "Invalid webhook signature must fail verification");
    });

    // -------------------------------------------------------------
    // Test T: Existing courier/order regression tests still pass
    // -------------------------------------------------------------
    await test("T. Existing courier/order regression tests still pass", async () => {
      const dtdcUrl = getCourierTrackingUrl("DTDC", "D12345678");
      assert.ok(dtdcUrl.includes("D12345678"));

      const delhiveryUrl = getCourierTrackingUrl("Delhivery", "DEL123456");
      assert.ok(delhiveryUrl.includes("DEL123456"));
    });
  } finally {
    // -------------------------------------------------------------
    // Strict Cleanup: Ensure ZERO leftover test data in MongoDB
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

    const leftoverOrders = await Order.countDocuments({ _id: { $in: createdOrderIds } });
    const leftoverProducts = await Product.countDocuments({ _id: { $in: createdProductIds } });
    const leftoverUsers = await User.countDocuments({ _id: { $in: createdUserIds } });

    console.log(`  Cleanup results:`);
    console.log(`    - Orders remaining:   ${leftoverOrders}`);
    console.log(`    - Products remaining: ${leftoverProducts}`);
    console.log(`    - Users remaining:    ${leftoverUsers}`);

    assert.strictEqual(leftoverOrders, 0, "All test orders must be completely removed");
    assert.strictEqual(leftoverProducts, 0, "All test products must be completely removed");
    assert.strictEqual(leftoverUsers, 0, "All test users must be completely removed");

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

runPhase1Tests().catch((err) => {
  console.error("Test execution threw unhandled exception:", err);
  process.exit(1);
});
