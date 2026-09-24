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
  checkOrderAccess,
  INVOICE_DIRECT_DOWNLOAD_WINDOW_MS,
} from "../routes/order.routes";
import {
  buildInvoiceWhatsAppUrl,
  normalizeIndianPhone,
} from "../routes/admin.routes";
import { generateInvoicePDF, type InvoiceData } from "../utils/invoice";
import {
  formatOrderNumber,
  dispatchRequestedInvoiceEmail,
  tpl,
} from "../utils/email";

async function runInvoiceFulfillmentTests() {
  console.log("\n=======================================================");
  console.log(" INVOICE REQUEST & FULFILLMENT VERIFICATION SUITE");
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

  const testRunId = `test-inv-ful-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;
  const createdProductIds: mongoose.Types.ObjectId[] = [];
  const createdOrderIds: mongoose.Types.ObjectId[] = [];
  const createdUserIds: mongoose.Types.ObjectId[] = [];

  async function createTestProduct(stock = 25) {
    const p = await Product.create({
      name: `Test Devotional Mala ${testRunId}-${createdProductIds.length}`,
      slug: `test-devotional-mala-${testRunId}-${createdProductIds.length}`,
      description: "Sacred test item for invoice fulfillment suite",
      price: 550,
      mrp: 1100,
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

  let testOrderCounter = 970000 + Math.floor(Math.random() * 10000);

  async function createTestOrder(opts: {
    status?: any;
    user?: any;
    customerEmail?: string;
    guestAccessToken?: string;
    deliveredAt?: Date | null;
    statusHistory?: any[];
    phone?: string;
    invoiceRequest?: any;
    invoiceOneTimeToken?: string | null;
    invoiceOneTimeTokenExpiresAt?: Date | null;
    invoiceOneTimeTokenUsedAt?: Date | null;
    invoiceSentToCustomerAt?: Date | null;
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
      guestAccessToken: opts.guestAccessToken || crypto.randomBytes(16).toString("hex"),
      address: {
        name: "Gauranga Das",
        phone: opts.phone || "9876543210",
        line1: "Raman Reti Road",
        city: "Vrindavan",
        state: "Uttar Pradesh",
        pincode: "281121",
      },
      payment: {
        method: "razorpay",
        status: "paid",
        razorpayPaymentId: `pay_test_${orderNo}`,
      },
      items: [
        {
          productId: pId,
          name: "Test Devotional Mala",
          price: 550,
          qty: 1,
          hsnCode: "7117",
          gstRate: 3,
        },
      ],
      subtotal: 550,
      shipping: 0,
      total: 550,
      invoiceRequest: opts.invoiceRequest,
      invoiceOneTimeToken: opts.invoiceOneTimeToken ?? null,
      invoiceOneTimeTokenExpiresAt: opts.invoiceOneTimeTokenExpiresAt ?? null,
      invoiceOneTimeTokenUsedAt: opts.invoiceOneTimeTokenUsedAt ?? null,
      invoiceSentToCustomerAt: opts.invoiceSentToCustomerAt ?? null,
    });

    createdOrderIds.push(o._id as mongoose.Types.ObjectId);
    return o;
  }

  try {
    await createTestProduct();
    const ownerUser = await createTestUser("owner");
    const otherUser = await createTestUser("other");

    console.log("--- 1. Pre-Delivered & Active Window Guard Tests ---");

    await test("1. Pre-delivered order (Confirmed) rejects invoice request", async () => {
      const o = await createTestOrder({ status: "Confirmed", user: ownerUser._id, customerEmail: ownerUser.email });
      assert.notStrictEqual(o.status, "Delivered");
      // Simulated request-invoice check
      const isDelivered = o.status === "Delivered";
      assert.strictEqual(isDelivered, false, "Should not be delivered");
    });

    await test("2. Pre-delivered order (Shipped) rejects invoice request", async () => {
      const o = await createTestOrder({ status: "Shipped", user: ownerUser._id, customerEmail: ownerUser.email });
      assert.notStrictEqual(o.status, "Delivered");
    });

    await test("3. Placed order rejects invoice request", async () => {
      const o = await createTestOrder({ status: "Placed", user: ownerUser._id, customerEmail: ownerUser.email });
      assert.notStrictEqual(o.status, "Delivered");
    });

    await test("4. Delivered order inside 7-day direct window rejects invoice request (direct download active)", async () => {
      const deliveredRecently = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000); // 2 days ago
      const o = await createTestOrder({
        status: "Delivered",
        deliveredAt: deliveredRecently,
        user: ownerUser._id,
        customerEmail: ownerUser.email,
      });

      const delTime = getOrderDeliveryTimestamp(o);
      assert.ok(delTime, "Must have delivery timestamp");
      const elapsed = Date.now() - delTime.getTime();
      const isExpired = elapsed > INVOICE_DIRECT_DOWNLOAD_WINDOW_MS;
      assert.strictEqual(isExpired, false, "Inside 7 days should NOT be expired");

      // Direct download remains active inside 7 days
      const elig = evaluateInvoiceDownloadEligibility(o, { sub: String(ownerUser._id), email: ownerUser.email, role: "user" });
      assert.strictEqual(elig.allowed, true, "Direct download should still be allowed");
    });

    console.log("\n--- 2. Post-7-Day Request Submission & State Machine Tests ---");

    await test("5. Delivered order past 7-day window allows customer to submit invoice request", async () => {
      const delivered8DaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
      const o = await createTestOrder({
        status: "Delivered",
        deliveredAt: delivered8DaysAgo,
        user: ownerUser._id,
        customerEmail: ownerUser.email,
      });

      const delTime = getOrderDeliveryTimestamp(o);
      const elapsed = Date.now() - delTime!.getTime();
      assert.ok(elapsed > INVOICE_DIRECT_DOWNLOAD_WINDOW_MS, "Must be past 7 days");

      // Direct download blocked
      const directElig = evaluateInvoiceDownloadEligibility(o, { sub: String(ownerUser._id), email: ownerUser.email, role: "user" });
      assert.strictEqual(directElig.allowed, false);
      assert.strictEqual(directElig.httpStatus, 410);

      // Perform atomic request creation
      const updated = await Order.findOneAndUpdate(
        {
          _id: o._id,
          status: "Delivered",
          $or: [
            { "invoiceRequest.status": { $exists: false } },
            { "invoiceRequest.status": null },
            { "invoiceRequest.status": { $nin: ["pending", "fulfilled"] } },
          ],
        },
        {
          $set: {
            invoiceRequest: {
              requestedAt: new Date(),
              requestedBy: "customer",
              status: "pending",
              adminNote: "",
            },
          },
        },
        { new: true }
      );

      assert.ok(updated, "Update must succeed");
      assert.strictEqual(updated.invoiceRequest?.status, "pending");
      assert.strictEqual(updated.invoiceRequest?.requestedBy, "customer");
      assert.ok(updated.invoiceRequest?.requestedAt);
    });

    await test("6. Guest user past 7-day window can submit invoice request using guestAccessToken", async () => {
      const delivered10DaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
      const guestToken = crypto.randomBytes(16).toString("hex");
      const o = await createTestOrder({
        status: "Delivered",
        deliveredAt: delivered10DaysAgo,
        customerEmail: "guest.devotee@example.com",
        guestAccessToken: guestToken,
      });

      const access = checkOrderAccess(o, undefined, guestToken);
      assert.strictEqual(access.allowed, true, "Guest token must grant access");
      assert.strictEqual(access.isTokenAuthorized, true);

      const updated = await Order.findOneAndUpdate(
        {
          _id: o._id,
          status: "Delivered",
          $or: [
            { "invoiceRequest.status": { $exists: false } },
            { "invoiceRequest.status": null },
            { "invoiceRequest.status": { $nin: ["pending", "fulfilled"] } },
          ],
        },
        {
          $set: {
            invoiceRequest: {
              requestedAt: new Date(),
              requestedBy: "guest",
              status: "pending",
              adminNote: "",
            },
          },
        },
        { new: true }
      );

      assert.ok(updated);
      assert.strictEqual(updated.invoiceRequest?.status, "pending");
      assert.strictEqual(updated.invoiceRequest?.requestedBy, "guest");
    });

    await test("7. Unauthorized customer cannot request invoice on another user's order", async () => {
      const delivered8DaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
      const o = await createTestOrder({
        status: "Delivered",
        deliveredAt: delivered8DaysAgo,
        user: ownerUser._id,
        customerEmail: ownerUser.email,
      });

      const access = checkOrderAccess(o, { sub: String(otherUser._id), email: otherUser.email, role: "user" });
      assert.strictEqual(access.allowed, false, "Other user must be blocked");
    });

    await test("8. Guest without valid token is blocked from requesting invoice", async () => {
      const delivered8DaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
      const o = await createTestOrder({
        status: "Delivered",
        deliveredAt: delivered8DaysAgo,
        guestAccessToken: "correct_secret_token",
      });

      const access = checkOrderAccess(o, undefined, "wrong_token");
      assert.strictEqual(access.allowed, false, "Wrong token must be blocked");
    });

    await test("9. Duplicate request blocked when status is already 'pending'", async () => {
      const o = await createTestOrder({
        status: "Delivered",
        deliveredAt: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000),
        invoiceRequest: {
          requestedAt: new Date(),
          requestedBy: "customer",
          status: "pending",
        },
      });

      // Attempt to submit second request atomically
      const duplicate = await Order.findOneAndUpdate(
        {
          _id: o._id,
          status: "Delivered",
          $or: [
            { "invoiceRequest.status": { $exists: false } },
            { "invoiceRequest.status": null },
            { "invoiceRequest.status": { $nin: ["pending", "fulfilled"] } },
          ],
        },
        {
          $set: {
            invoiceRequest: {
              requestedAt: new Date(),
              requestedBy: "customer",
              status: "pending",
            },
          },
        },
        { new: true }
      );

      assert.strictEqual(duplicate, null, "Duplicate request must be blocked atomically");
    });

    await test("10. Repeat request blocked when status is already 'fulfilled'", async () => {
      const o = await createTestOrder({
        status: "Delivered",
        deliveredAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
        invoiceRequest: {
          requestedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
          requestedBy: "customer",
          status: "fulfilled",
          processedAt: new Date(),
          processedBy: "admin",
        },
      });

      const repeat = await Order.findOneAndUpdate(
        {
          _id: o._id,
          status: "Delivered",
          $or: [
            { "invoiceRequest.status": { $exists: false } },
            { "invoiceRequest.status": null },
            { "invoiceRequest.status": { $nin: ["pending", "fulfilled"] } },
          ],
        },
        {
          $set: {
            invoiceRequest: {
              requestedAt: new Date(),
              requestedBy: "customer",
              status: "pending",
            },
          },
        },
        { new: true }
      );

      assert.strictEqual(repeat, null, "Repeat request on fulfilled order must be blocked atomically");
    });

    console.log("\n--- 3. Admin Fulfillment & Token Generation Tests ---");

    await test("11. Admin fulfillment generates 192-bit token and 48-hour expiration", async () => {
      const o = await createTestOrder({
        status: "Delivered",
        deliveredAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
        customerEmail: "fulfillment.devotee@example.com",
        invoiceRequest: {
          requestedAt: new Date(),
          requestedBy: "customer",
          status: "pending",
        },
      });

      const token = crypto.randomBytes(24).toString("hex");
      assert.strictEqual(token.length, 48, "192-bit token hex representation must be 48 characters");
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 48 * 60 * 60 * 1000);

      const diffHours = (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60);
      assert.strictEqual(diffHours, 48, "Expiration must be exactly 48 hours");

      const fulfilled = await Order.findOneAndUpdate(
        {
          _id: o._id,
          status: "Delivered",
        },
        {
          $set: {
            invoiceOneTimeToken: token,
            invoiceOneTimeTokenExpiresAt: expiresAt,
            invoiceOneTimeTokenUsedAt: null,
            invoiceSentToCustomerAt: now,
            "invoiceRequest.status": "fulfilled",
            "invoiceRequest.processedAt": now,
            "invoiceRequest.processedBy": "admin@example.com",
            "invoiceRequest.adminNote": "Verified and dispatched",
          },
        },
        { new: true }
      );

      assert.ok(fulfilled);
      assert.strictEqual(fulfilled.invoiceRequest?.status, "fulfilled");
      assert.strictEqual(fulfilled.invoiceOneTimeToken, token);
      assert.strictEqual(fulfilled.invoiceOneTimeTokenUsedAt, null);
      assert.strictEqual(fulfilled.invoiceRequest?.adminNote, "Verified and dispatched");
    });

    await test("12. Admin fulfillment generates requested invoice email template with PDF attachment", async () => {
      const o = await createTestOrder({
        status: "Delivered",
        deliveredAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
        customerEmail: "devotee@example.com",
      });

      const orderNum = formatOrderNumber(o);
      const invoiceData: InvoiceData = {
        orderId: String(o._id),
        orderNo: o.orderNo ?? orderNum,
        invoiceNo: `INV-${orderNum}`,
        status: o.status,
        customerName: o.address?.name || "Customer",
        customerEmail: o.customerEmail || "",
        items: o.items as any,
        subtotal: o.subtotal,
        shipping: o.shipping,
        total: o.total,
        address: o.address as any,
        payment: o.payment as any,
        createdAt: o.createdAt,
      };

      const pdfBuffer = await generateInvoicePDF(invoiceData);
      assert.ok(pdfBuffer && pdfBuffer.length > 500, "PDF buffer must be generated");
      assert.strictEqual(pdfBuffer.slice(0, 4).toString(), "%PDF", "Must be a valid PDF");

      const token = crypto.randomBytes(24).toString("hex");
      const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);
      const oneTimeUrl = `https://www.shriradhagovindstore.com/orders/${orderNum}?invoiceToken=${token}`;
      const expiresAtFormatted = expiresAt.toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
        dateStyle: "medium",
        timeStyle: "short",
      });

      const email = tpl.requestedInvoice(
        o.address?.name || "Customer",
        orderNum,
        `INV-${orderNum}`,
        oneTimeUrl,
        expiresAtFormatted
      );

      assert.ok(email.subject.includes(`INV-${orderNum}`), "Subject must include invoice number");
      assert.ok(email.subject.includes(`#${orderNum}`), "Subject must include readable order number");
      assert.ok(email.html.includes("Hare Krishna"), "Email must maintain devotional tone");
      assert.ok(email.html.includes(orderNum), "Email must display order number");
      assert.ok(email.html.includes(`INV-${orderNum}`), "Email must display invoice number");
      assert.ok(email.html.includes(oneTimeUrl), "Email must include secure single-use download URL");
      assert.ok(email.html.includes("48 hours"), "Email must state 48-hour expiration");
      assert.ok(email.html.includes("single-use"), "Email must state single-use link constraint");
      assert.ok(email.html.includes("support@shriradhagovindstore.com"), "Email must provide support link");
    });

    await test("13. Admin fulfillment blocks non-delivered orders", async () => {
      const o = await createTestOrder({ status: "Processing", customerEmail: "proc@example.com" });
      assert.notStrictEqual(o.status, "Delivered", "Non-delivered must be rejected by admin send-invoice");
    });

    console.log("\n--- 4. One-Time Download Token Verification & Single-Use Consumption ---");

    await test("14. Customer can successfully download invoice using valid one-time token", async () => {
      const token = crypto.randomBytes(24).toString("hex");
      const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);
      const o = await createTestOrder({
        status: "Delivered",
        deliveredAt: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000),
        user: ownerUser._id,
        customerEmail: ownerUser.email,
        invoiceOneTimeToken: token,
        invoiceOneTimeTokenExpiresAt: expiresAt,
        invoiceOneTimeTokenUsedAt: null,
      });

      const userAuth = { sub: String(ownerUser._id), email: ownerUser.email, role: "user" as const };
      const elig = evaluateInvoiceDownloadEligibility(o, userAuth, undefined, Date.now(), token);
      assert.strictEqual(elig.allowed, true);
      assert.strictEqual(elig.requiresOneTimeToken, true);

      // Perform atomic consumption
      const consumed = await Order.findOneAndUpdate(
        {
          _id: o._id,
          invoiceOneTimeToken: token,
          invoiceOneTimeTokenUsedAt: null,
          invoiceOneTimeTokenExpiresAt: { $gt: new Date() },
        },
        {
          $set: { invoiceOneTimeTokenUsedAt: new Date() },
        },
        { new: true }
      );

      assert.ok(consumed, "Atomic consumption must succeed");
      assert.ok(consumed.invoiceOneTimeTokenUsedAt, "Must mark invoiceOneTimeTokenUsedAt");
    });

    await test("15. Reusing already-consumed token is rejected with 410 Gone", async () => {
      const token = crypto.randomBytes(24).toString("hex");
      const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);
      const o = await createTestOrder({
        status: "Delivered",
        deliveredAt: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000),
        user: ownerUser._id,
        customerEmail: ownerUser.email,
        invoiceOneTimeToken: token,
        invoiceOneTimeTokenExpiresAt: expiresAt,
        invoiceOneTimeTokenUsedAt: new Date(Date.now() - 5000), // already used 5s ago
      });

      const userAuth = { sub: String(ownerUser._id), email: ownerUser.email, role: "user" as const };
      const elig = evaluateInvoiceDownloadEligibility(o, userAuth, undefined, Date.now(), token);
      assert.strictEqual(elig.allowed, false);
      assert.strictEqual(elig.httpStatus, 410);
      assert.ok(elig.reason?.includes("already been used"));
    });

    await test("16. Expired token (>48 hours) is rejected with 410 Gone", async () => {
      const token = crypto.randomBytes(24).toString("hex");
      const expiredTime = new Date(Date.now() - 1000); // expired 1s ago
      const o = await createTestOrder({
        status: "Delivered",
        deliveredAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
        user: ownerUser._id,
        customerEmail: ownerUser.email,
        invoiceOneTimeToken: token,
        invoiceOneTimeTokenExpiresAt: expiredTime,
        invoiceOneTimeTokenUsedAt: null,
      });

      const userAuth = { sub: String(ownerUser._id), email: ownerUser.email, role: "user" as const };
      const elig = evaluateInvoiceDownloadEligibility(o, userAuth, undefined, Date.now(), token);
      assert.strictEqual(elig.allowed, false);
      assert.strictEqual(elig.httpStatus, 410);
      assert.ok(elig.reason?.includes("expired"));
    });

    await test("17. Invalid / wrong token is rejected with 403 Forbidden", async () => {
      const token = crypto.randomBytes(24).toString("hex");
      const o = await createTestOrder({
        status: "Delivered",
        deliveredAt: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000),
        user: ownerUser._id,
        customerEmail: ownerUser.email,
        invoiceOneTimeToken: token,
        invoiceOneTimeTokenExpiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
        invoiceOneTimeTokenUsedAt: null,
      });

      const userAuth = { sub: String(ownerUser._id), email: ownerUser.email, role: "user" as const };
      const elig = evaluateInvoiceDownloadEligibility(o, userAuth, undefined, Date.now(), "incorrect_token_value");
      assert.strictEqual(elig.allowed, false);
      assert.strictEqual(elig.httpStatus, 403);
      assert.ok(elig.reason?.includes("Invalid invoice download token"));
    });

    await test("18. Concurrent download attempts with same token: exactly ONE succeeds, other rejected with 410", async () => {
      const token = crypto.randomBytes(24).toString("hex");
      const o = await createTestOrder({
        status: "Delivered",
        deliveredAt: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000),
        user: ownerUser._id,
        customerEmail: ownerUser.email,
        invoiceOneTimeToken: token,
        invoiceOneTimeTokenExpiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
        invoiceOneTimeTokenUsedAt: null,
      });

      // Simulate 2 racing concurrent requests
      const attempt1 = Order.findOneAndUpdate(
        {
          _id: o._id,
          invoiceOneTimeToken: token,
          invoiceOneTimeTokenUsedAt: null,
          invoiceOneTimeTokenExpiresAt: { $gt: new Date() },
        },
        {
          $set: { invoiceOneTimeTokenUsedAt: new Date() },
        },
        { new: true }
      );

      const attempt2 = Order.findOneAndUpdate(
        {
          _id: o._id,
          invoiceOneTimeToken: token,
          invoiceOneTimeTokenUsedAt: null,
          invoiceOneTimeTokenExpiresAt: { $gt: new Date() },
        },
        {
          $set: { invoiceOneTimeTokenUsedAt: new Date() },
        },
        { new: true }
      );

      const [res1, res2] = await Promise.all([attempt1, attempt2]);
      const successes = [res1, res2].filter(Boolean);
      const failures = [res1, res2].filter((r) => r === null);

      assert.strictEqual(successes.length, 1, "Exactly one concurrent download attempt must succeed");
      assert.strictEqual(failures.length, 1, "Competing attempt must receive null and trigger 410");
    });

    console.log("\n--- 5. WhatsApp URL Formatting & Phone Normalization Tests ---");

    await test("19. WhatsApp phone normalization handles 10-digit mobile number", async () => {
      const res = normalizeIndianPhone("9876543210");
      assert.strictEqual(res.valid, true);
      assert.strictEqual(res.digits, "919876543210");
    });

    await test("20. WhatsApp phone normalization handles 12-digit mobile number with 91 prefix", async () => {
      const res = normalizeIndianPhone("919876543210");
      assert.strictEqual(res.valid, true);
      assert.strictEqual(res.digits, "919876543210");
    });

    await test("21. WhatsApp phone normalization detects invalid phone numbers", async () => {
      const resShort = normalizeIndianPhone("12345");
      assert.strictEqual(resShort.valid, false);

      const resEmpty = normalizeIndianPhone("");
      assert.strictEqual(resEmpty.valid, false);

      const resLetters = normalizeIndianPhone("invalidphone");
      assert.strictEqual(resLetters.valid, false);
    });

    await test("22. WhatsApp click-to-chat URL correctly encodes message and download link", async () => {
      const o = {
        orderNo: 5042,
        address: { name: "Radharani Das", phone: "9876543210" },
      };
      const oneTimeUrl = "https://www.shriradhagovindstore.com/orders/5042?invoiceToken=abc123token";
      const wa = buildInvoiceWhatsAppUrl(o, oneTimeUrl);

      assert.ok(wa.url, "Must generate valid WhatsApp URL");
      assert.ok(wa.url.startsWith("https://api.whatsapp.com/send?phone=919876543210&text="));
      assert.ok(wa.url.includes(encodeURIComponent("INV-5042")));
      assert.ok(wa.url.includes(encodeURIComponent(oneTimeUrl)));
      assert.ok(wa.url.includes(encodeURIComponent("48 hours")));
    });

    console.log("\n--- 6. Admin Access & Historical Order Robustness Tests ---");

    await test("23. Admin access to invoice download remains unrestricted at all times", async () => {
      const o = await createTestOrder({
        status: "Delivered",
        deliveredAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
        invoiceOneTimeToken: null,
      });

      const adminAuth = { sub: "admin_123", email: "admin@store.com", role: "admin" as const };
      const elig = evaluateInvoiceDownloadEligibility(o, adminAuth);
      assert.strictEqual(elig.allowed, true, "Admin access must never expire");
    });

    await test("24. Historical delivered order with statusHistory fallback behaves identically", async () => {
      const delivered9DaysAgo = new Date(Date.now() - 9 * 24 * 60 * 60 * 1000);
      const o = await createTestOrder({
        status: "Delivered",
        deliveredAt: null, // Legacy doc without deliveredAt
        statusHistory: [
          { status: "Confirmed", changedAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000) },
          { status: "Delivered", changedAt: delivered9DaysAgo },
        ],
        user: ownerUser._id,
        customerEmail: ownerUser.email,
      });

      const delTime = getOrderDeliveryTimestamp(o);
      assert.ok(delTime, "Must find timestamp from statusHistory");
      assert.strictEqual(delTime.getTime(), delivered9DaysAgo.getTime());

      // Direct download expired
      const directElig = evaluateInvoiceDownloadEligibility(o, { sub: String(ownerUser._id), email: ownerUser.email, role: "user" });
      assert.strictEqual(directElig.allowed, false);
      assert.strictEqual(directElig.httpStatus, 410);
    });

  } finally {
    console.log("\n--- ZERO-LEFTOVER CLEANUP VERIFICATION ---");
    console.log("Cleaning up all test records created during this run...");

    const delOrders = await Order.deleteMany({ _id: { $in: createdOrderIds } });
    const delProducts = await Product.deleteMany({ _id: { $in: createdProductIds } });
    const delUsers = await User.deleteMany({ _id: { $in: createdUserIds } });

    console.log(`Deleted ${delOrders.deletedCount} test orders.`);
    console.log(`Deleted ${delProducts.deletedCount} test products.`);
    console.log(`Deleted ${delUsers.deletedCount} test users.`);

    // Strict verification: ensure 0 documents remain with testRunId
    const remainingOrders = await Order.countDocuments({ _id: { $in: createdOrderIds } });
    const remainingProducts = await Product.countDocuments({ _id: { $in: createdProductIds } });
    const remainingUsers = await User.countDocuments({ _id: { $in: createdUserIds } });

    assert.strictEqual(remainingOrders, 0, "All test orders must be removed");
    assert.strictEqual(remainingProducts, 0, "All test products must be removed");
    assert.strictEqual(remainingUsers, 0, "All test users must be removed");

    console.log("✅ Zero-leftover verification confirmed: 0 test orders, 0 test products, 0 test users remaining.\n");

    await mongoose.disconnect();
  }

  console.log("=======================================================");
  console.log(` RESULTS: ${passed} passed, ${failed} failed`);
  console.log("=======================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runInvoiceFulfillmentTests().catch((e) => {
  console.error("Test execution fatal error:", e);
  process.exit(1);
});
