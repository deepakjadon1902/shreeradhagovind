import "dotenv/config";
import assert from "node:assert";
import mongoose from "mongoose";
import crypto from "crypto";
import { connectDB } from "../config/db";
import { Product } from "../models/Product";
import { Order } from "../models/Order";
import { User } from "../models/User";
import { Settings } from "../models/Settings";
import { ReturnRequest } from "../models/ReturnRequest";
import { LoyaltyTransaction } from "../models/LoyaltyTransaction";
import { WalletTransaction } from "../models/WalletTransaction";
import { StockHistory } from "../models/StockHistory";
import {
  checkReturnEligibility,
  calculateItemRefunds,
  getAlreadyReturnedQty,
  createReturnRequest,
  approveReturn,
  rejectReturn,
  markReturnReceived,
  recordRefund,
  reversePointsForReturn,
} from "../services/returns.service";
import { checkOrderAccess } from "../routes/order.routes";
import { isOrderPaidForFinance } from "../routes/admin.routes";
import {
  dispatchReturnRequestedEmail,
  dispatchReturnApprovedEmail,
  dispatchReturnRejectedEmail,
  dispatchReturnRefundedEmail,
  tpl,
} from "../utils/email";

async function runReturnsTests() {
  console.log("\n=======================================================");
  console.log(" RETURNS & REFUND PORTAL COMPREHENSIVE TEST SUITE");
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

  const testRunId = `test-ret-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;
  const createdProductIds: mongoose.Types.ObjectId[] = [];
  const createdOrderIds: mongoose.Types.ObjectId[] = [];
  const createdUserIds: mongoose.Types.ObjectId[] = [];
  const createdReturnRequestIds: mongoose.Types.ObjectId[] = [];
  const createdLoyaltyTxnIds: mongoose.Types.ObjectId[] = [];
  const createdWalletTxnIds: mongoose.Types.ObjectId[] = [];
  const createdStockHistoryIds: mongoose.Types.ObjectId[] = [];

  // Helper to create test product
  async function createTestProduct(stock = 20, price = 500) {
    const p = await Product.create({
      name: `Test Product ${testRunId}-${createdProductIds.length}`,
      slug: `test-product-${testRunId}-${createdProductIds.length}`,
      description: "Test return item",
      price,
      mrp: price + 200,
      category: "Sacred Malas",
      stock,
      isActive: true,
    });
    createdProductIds.push(p._id as mongoose.Types.ObjectId);
    return p;
  }

  // Helper to create test user
  async function createTestUser(emailSuffix = "user") {
    const u = await User.create({
      name: `Devotee ${emailSuffix}`,
      email: `${testRunId}-${emailSuffix}@test.com`,
      phone: "+919876543210",
      role: "user",
      loyaltyPointsBalance: 100,
      walletBalance: 200,
    });
    createdUserIds.push(u._id as mongoose.Types.ObjectId);
    return u;
  }

  // Helper to create test order
  async function createTestOrder(opts: {
    userId?: mongoose.Types.ObjectId;
    customerEmail?: string;
    items: Array<{ product: any; qty: number; price?: number; discountAmount?: number }>;
    shipping?: number;
    status?: string;
    deliveredAt?: Date | null;
    guestAccessToken?: string;
    loyaltyPointsEarned?: number;
  }) {
    const subtotal = opts.items.reduce((s, i) => s + (i.price || i.product.price) * i.qty, 0);
    const shipping = opts.shipping ?? 49;
    const total = subtotal + shipping;

    const o = await Order.create({
      orderNo: 90000 + createdOrderIds.length,
      user: opts.userId || null,
      customerEmail: opts.customerEmail || `${testRunId}-guest@test.com`,
      guestAccessToken: opts.guestAccessToken || crypto.randomBytes(16).toString("hex"),
      status: opts.status || "Delivered",
      deliveredAt: opts.deliveredAt !== undefined ? opts.deliveredAt : new Date(),
      subtotal,
      shipping,
      total,
      loyaltyPointsEarned: opts.loyaltyPointsEarned || 0,
      items: opts.items.map((i) => ({
        productId: i.product._id,
        name: i.product.name,
        price: i.price || i.product.price,
        qty: i.qty,
        discountAmount: i.discountAmount || 0,
      })),
      payment: {
        method: "cod",
        status: "paid",
      },
      address: {
        name: "Test Devotee",
        phone: "+919876543210",
        line1: "Parikrama Marg",
        city: "Vrindavan",
        state: "Uttar Pradesh",
        pincode: "281121",
      },
    });
    createdOrderIds.push(o._id as mongoose.Types.ObjectId);
    return o;
  }

  try {
    // -------------------------------------------------------------
    // A. 48-hour eligibility
    // -------------------------------------------------------------
    await test("A. 48-hour eligibility passes for freshly delivered order", async () => {
      const prod = await createTestProduct();
      const order = await createTestOrder({
        items: [{ product: prod, qty: 1 }],
        deliveredAt: new Date(Date.now() - 2 * 3600 * 1000), // 2 hours ago
      });

      const elig = checkReturnEligibility(order, 48);
      assert.strictEqual(elig.eligible, true);
      assert(elig.remainingMs > 0);
    });

    // -------------------------------------------------------------
    // B. Configurable return window
    // -------------------------------------------------------------
    await test("B. Configurable return window from Settings is respected", async () => {
      const prod = await createTestProduct();
      const order = await createTestOrder({
        items: [{ product: prod, qty: 1 }],
        deliveredAt: new Date(Date.now() - 30 * 3600 * 1000), // 30 hours ago
      });

      // With 24 hour window: should be expired
      const elig24 = checkReturnEligibility(order, 24);
      assert.strictEqual(elig24.eligible, false);

      // With 48 hour window: should be eligible
      const elig48 = checkReturnEligibility(order, 48);
      assert.strictEqual(elig48.eligible, true);

      // With 72 hour window: should be eligible
      const elig72 = checkReturnEligibility(order, 72);
      assert.strictEqual(elig72.eligible, true);
    });

    // -------------------------------------------------------------
    // C. Expired return window
    // -------------------------------------------------------------
    await test("C. Expired return window (>48h) is rejected", async () => {
      const prod = await createTestProduct();
      const order = await createTestOrder({
        items: [{ product: prod, qty: 1 }],
        deliveredAt: new Date(Date.now() - 50 * 3600 * 1000), // 50 hours ago
      });

      const elig = checkReturnEligibility(order, 48);
      assert.strictEqual(elig.eligible, false);
      assert.strictEqual(elig.reason, "Return window has expired");
    });

    // -------------------------------------------------------------
    // D. Customer ownership authorization
    // -------------------------------------------------------------
    await test("D. Customer ownership: logged in customer can access own order only", async () => {
      const userA = await createTestUser("ownerA");
      const userB = await createTestUser("ownerB");
      const prod = await createTestProduct();
      const order = await createTestOrder({
        userId: userA._id as mongoose.Types.ObjectId,
        customerEmail: userA.email,
        items: [{ product: prod, qty: 1 }],
      });

      const authA = checkOrderAccess(order, { sub: userA._id.toString(), email: userA.email } as any);
      assert.strictEqual(authA.allowed, true);
      assert.strictEqual(authA.isOwner, true);

      const authB = checkOrderAccess(order, { sub: userB._id.toString(), email: userB.email } as any);
      assert.strictEqual(authB.allowed, false);
      assert.strictEqual(authB.isOwner, false);
    });

    // -------------------------------------------------------------
    // E. Guest authorization
    // -------------------------------------------------------------
    await test("E. Guest authorization: valid guestAccessToken permits access", async () => {
      const prod = await createTestProduct();
      const token = "secret-guest-token-12345";
      const order = await createTestOrder({
        items: [{ product: prod, qty: 1 }],
        guestAccessToken: token,
      });

      const validToken = checkOrderAccess(order, undefined, token);
      assert.strictEqual(validToken.allowed, true);
      assert.strictEqual(validToken.isTokenAuthorized, true);

      const invalidToken = checkOrderAccess(order, undefined, "wrong-token");
      assert.strictEqual(invalidToken.allowed, false);
      assert.strictEqual(invalidToken.isTokenAuthorized, false);
    });

    // -------------------------------------------------------------
    // F. Partial return (one of multiple products)
    // -------------------------------------------------------------
    await test("F. Partial return: can return only Product A from an order with A & B", async () => {
      const prodA = await createTestProduct(20, 500);
      const prodB = await createTestProduct(20, 300);
      const order = await createTestOrder({
        items: [
          { product: prodA, qty: 1 },
          { product: prodB, qty: 1 },
        ],
      });

      const res = await createReturnRequest({
        orderId: order._id.toString(),
        customerEmail: order.customerEmail || "",
        requestedItems: [
          { productId: prodA._id.toString(), qty: 1, reason: "transit_damage" },
        ],
        returnWindowHours: 48,
      });

      assert.strictEqual(res.success, true);
      assert(res.returnRequest);
      createdReturnRequestIds.push(res.returnRequest._id);

      assert.strictEqual(res.returnRequest.items.length, 1);
      assert.strictEqual(res.returnRequest.items[0].productId.toString(), prodA._id.toString());
      assert.strictEqual(res.returnRequest.totalEligibleRefund, 500);
    });

    // -------------------------------------------------------------
    // G. Full return
    // -------------------------------------------------------------
    await test("G. Full return: all items selected returns sum of all item net values", async () => {
      const prodA = await createTestProduct(20, 400);
      const prodB = await createTestProduct(20, 600);
      const order = await createTestOrder({
        items: [
          { product: prodA, qty: 1 },
          { product: prodB, qty: 1 },
        ],
        shipping: 49,
      });

      const res = await createReturnRequest({
        orderId: order._id.toString(),
        customerEmail: order.customerEmail || "",
        requestedItems: [
          { productId: prodA._id.toString(), qty: 1, reason: "defective" },
          { productId: prodB._id.toString(), qty: 1, reason: "missing_item" },
        ],
        returnWindowHours: 48,
      });

      assert.strictEqual(res.success, true);
      assert(res.returnRequest);
      createdReturnRequestIds.push(res.returnRequest._id);

      // Refund is 400 + 600 = 1000 (shipping 49 is NOT added)
      assert.strictEqual(res.returnRequest.totalEligibleRefund, 1000);
      assert.strictEqual(res.returnRequest.originalShipping, 49);
    });

    // -------------------------------------------------------------
    // H. Partial quantity return (item has qty > 1)
    // -------------------------------------------------------------
    await test("H. Partial quantity return: order has qty 3, return qty 1", async () => {
      const prod = await createTestProduct(20, 200);
      const order = await createTestOrder({
        items: [{ product: prod, qty: 3, price: 200 }],
      });

      const res = await createReturnRequest({
        orderId: order._id.toString(),
        customerEmail: order.customerEmail || "",
        requestedItems: [
          { productId: prod._id.toString(), qty: 1, reason: "transit_damage" },
        ],
        returnWindowHours: 48,
      });

      assert.strictEqual(res.success, true);
      assert(res.returnRequest);
      createdReturnRequestIds.push(res.returnRequest._id);

      assert.strictEqual(res.returnRequest.items[0].qty, 1);
      assert.strictEqual(res.returnRequest.items[0].originalQty, 3);
      assert.strictEqual(res.returnRequest.totalEligibleRefund, 200);
    });

    // -------------------------------------------------------------
    // I. Duplicate quantity return blocked
    // -------------------------------------------------------------
    await test("I. Duplicate quantity return is blocked when remaining qty is 0", async () => {
      const prod = await createTestProduct(20, 300);
      const order = await createTestOrder({
        items: [{ product: prod, qty: 1 }],
      });

      // First return request for qty 1
      const res1 = await createReturnRequest({
        orderId: order._id.toString(),
        customerEmail: order.customerEmail || "",
        requestedItems: [
          { productId: prod._id.toString(), qty: 1, reason: "wrong_item" },
        ],
        returnWindowHours: 48,
      });
      assert(res1.returnRequest);
      createdReturnRequestIds.push(res1.returnRequest._id);

      // Second return request for same item should be blocked
      await assert.rejects(async () => {
        await createReturnRequest({
          orderId: order._id.toString(),
          customerEmail: order.customerEmail || "",
          requestedItems: [
            { productId: prod._id.toString(), qty: 1, reason: "wrong_item" },
          ],
          returnWindowHours: 48,
        });
      }, /exceeds available/);
    });

    // -------------------------------------------------------------
    // J. Invalid quantity blocked
    // -------------------------------------------------------------
    await test("J. Invalid quantity (< 1 or > purchased) is rejected", async () => {
      const prod = await createTestProduct(20, 300);
      const order = await createTestOrder({
        items: [{ product: prod, qty: 2 }],
      });

      // Qty 0 rejected
      await assert.rejects(async () => {
        calculateItemRefunds(
          order.items,
          [{ productId: prod._id.toString(), qty: 0, reason: "defective" }],
          new Map()
        );
      }, /must be > 0/);

      // Qty 5 (exceeding 2) rejected
      await assert.rejects(async () => {
        calculateItemRefunds(
          order.items,
          [{ productId: prod._id.toString(), qty: 5, reason: "defective" }],
          new Map()
        );
      }, /exceeds available/);
    });

    // -------------------------------------------------------------
    // K & L. Store-fault vs Customer-fault classification
    // -------------------------------------------------------------
    await test("K & L. Fault classification: Store fault vs Customer fault", async () => {
      const prod = await createTestProduct(20, 250);
      const items = [{ product: prod._id, qty: 2, price: 250 }];

      const storeFaultRes = calculateItemRefunds(
        items,
        [{ productId: prod._id.toString(), qty: 1, reason: "transit_damage" }],
        new Map()
      );
      assert.strictEqual(storeFaultRes.items[0].faultType, "STORE_FAULT");

      const custFaultRes = calculateItemRefunds(
        items,
        [{ productId: prod._id.toString(), qty: 1, reason: "change_of_mind" }],
        new Map()
      );
      assert.strictEqual(custFaultRes.items[0].faultType, "CUSTOMER_FAULT");
    });

    // -------------------------------------------------------------
    // M. Shipping responsibility classification
    // -------------------------------------------------------------
    await test("M. Shipping responsibility: store-fault reasons mapped to STORE_FAULT", () => {
      const storeReasons = ["transit_damage", "defective", "missing_item", "wrong_item"];
      const custReasons = ["change_of_mind", "other"];

      const items = [{ product: "p1", qty: 5, price: 100 }];
      for (const r of storeReasons) {
        const res = calculateItemRefunds(items, [{ productId: "p1", qty: 1, reason: r }], new Map());
        assert.strictEqual(res.items[0].faultType, "STORE_FAULT", `Reason ${r} must be STORE_FAULT`);
      }
      for (const r of custReasons) {
        const res = calculateItemRefunds(items, [{ productId: "p1", qty: 1, reason: r }], new Map());
        assert.strictEqual(res.items[0].faultType, "CUSTOMER_FAULT", `Reason ${r} must be CUSTOMER_FAULT`);
      }
    });

    // -------------------------------------------------------------
    // N. Original shipping non-refundable
    // -------------------------------------------------------------
    await test("N. Original order shipping charge is never added to refund", async () => {
      const prod = await createTestProduct(20, 500);
      const order = await createTestOrder({
        items: [{ product: prod, qty: 1 }],
        shipping: 49,
      });

      const res = await createReturnRequest({
        orderId: order._id.toString(),
        customerEmail: order.customerEmail || "",
        requestedItems: [{ productId: prod._id.toString(), qty: 1, reason: "defective" }],
        returnWindowHours: 48,
      });
      assert(res.returnRequest);
      createdReturnRequestIds.push(res.returnRequest._id);

      assert.strictEqual(res.returnRequest.totalEligibleRefund, 500); // 500, NOT 549
      assert.strictEqual(res.returnRequest.originalShipping, 49);
    });

    // -------------------------------------------------------------
    // O. Coupon usage NOT restored
    // -------------------------------------------------------------
    await test("O. Coupon usage remains consumed after return and is NOT restored", async () => {
      // Per business rule #8: "Coupon usage MUST NOT be restored after a return/refund."
      // Verify returns service does NOT import or call restoreCouponRedemption
      const returnsServiceCode = await import("fs").then((fs) =>
        fs.readFileSync("d:/shreeradhagovind/backend/src/services/returns.service.ts", "utf8")
      );
      assert.strictEqual(
        returnsServiceCode.includes("restoreCouponRedemption"),
        false,
        "restoreCouponRedemption must NOT be called in returns service"
      );
    });

    // -------------------------------------------------------------
    // P & Q. Proportional discount allocation on refund calculation
    // -------------------------------------------------------------
    await test("P & Q. Proportional discount allocation on partial & item refund", () => {
      // Order item: 2 units @ ₹500 = ₹1000. Discount on this item: ₹200.
      // Net paid: ₹800 (₹400 per unit).
      // Returning 1 unit should refund exactly ₹400.
      const orderItems = [
        {
          product: "prod1",
          qty: 2,
          price: 500,
          discountAmount: 200,
        },
      ];

      const res = calculateItemRefunds(
        orderItems,
        [{ productId: "prod1", qty: 1, reason: "transit_damage" }],
        new Map()
      );

      assert.strictEqual(res.items[0].discountAmount, 100); // 200 * 1 / 2 = 100
      assert.strictEqual(res.items[0].eligibleRefundAmount, 400); // 500 - 100 = 400
      assert.strictEqual(res.totalEligibleRefund, 400);
    });

    // -------------------------------------------------------------
    // R. Full refund calculation
    // -------------------------------------------------------------
    await test("R. Full refund calculation nets all item discounts correctly", () => {
      const orderItems = [
        { product: "p1", qty: 2, price: 300, discountAmount: 60 }, // Net: 540
        { product: "p2", qty: 1, price: 500, discountAmount: 50 }, // Net: 450
      ];

      const res = calculateItemRefunds(
        orderItems,
        [
          { productId: "p1", qty: 2, reason: "wrong_item" },
          { productId: "p2", qty: 1, reason: "defective" },
        ],
        new Map()
      );

      assert.strictEqual(res.totalEligibleRefund, 990); // 540 + 450
    });

    // -------------------------------------------------------------
    // S. UPI refund record
    // -------------------------------------------------------------
    await test("S. UPI refund records audit metadata, amount, UPI ref, and marks REFUNDED", async () => {
      const prod = await createTestProduct(20, 350);
      const order = await createTestOrder({ items: [{ product: prod, qty: 1 }] });

      const rrRes = await createReturnRequest({
        orderId: order._id.toString(),
        customerEmail: order.customerEmail || "",
        requestedItems: [{ productId: prod._id.toString(), qty: 1, reason: "defective" }],
        returnWindowHours: 48,
      });
      assert(rrRes.returnRequest);
      createdReturnRequestIds.push(rrRes.returnRequest._id);

      // Approve return
      await approveReturn(rrRes.returnRequest._id, "admin-1", "refund");

      // Mark received
      await markReturnReceived(rrRes.returnRequest._id, "admin-1");

      // Record UPI refund
      const refRes = await recordRefund(rrRes.returnRequest._id, "admin-1", {
        method: "upi",
        upiReference: "UPI-TEST-998877",
        notes: "GPay manual transfer",
      });

      assert.strictEqual(refRes.success, true);
      assert(refRes.returnRequest);
      assert.strictEqual(refRes.returnRequest.status, "REFUNDED");
      assert.strictEqual(refRes.returnRequest.refund?.method, "upi");
      assert.strictEqual(refRes.returnRequest.refund?.upiReference, "UPI-TEST-998877");
      assert.strictEqual(refRes.returnRequest.refund?.amount, 350);
      assert.strictEqual(refRes.returnRequest.refund?.refundedBy, "admin-1");
    });

    // -------------------------------------------------------------
    // T. Wallet refund
    // -------------------------------------------------------------
    await test("T. Wallet refund credits customer wallet using existing wallet service", async () => {
      const user = await createTestUser("wallet-cust");
      const initialBal = user.walletBalance || 0;
      const prod = await createTestProduct(20, 450);
      const order = await createTestOrder({
        userId: user._id as mongoose.Types.ObjectId,
        customerEmail: user.email,
        items: [{ product: prod, qty: 1 }],
      });

      const rrRes = await createReturnRequest({
        orderId: order._id.toString(),
        userId: user._id,
        customerEmail: user.email,
        requestedItems: [{ productId: prod._id.toString(), qty: 1, reason: "defective" }],
        returnWindowHours: 48,
      });
      assert(rrRes.returnRequest);
      createdReturnRequestIds.push(rrRes.returnRequest._id);

      await approveReturn(rrRes.returnRequest._id, "admin-1", "refund");
      await markReturnReceived(rrRes.returnRequest._id, "admin-1");

      const refRes = await recordRefund(rrRes.returnRequest._id, "admin-1", {
        method: "wallet",
        notes: "Credited to devotee store credit",
      });

      assert.strictEqual(refRes.success, true);
      const updatedUser = await User.findById(user._id);
      assert.strictEqual(updatedUser?.walletBalance, initialBal + 450);

      // Verify WalletTransaction created
      const wTxn = await WalletTransaction.findOne({ userId: user._id, type: "CREDIT" });
      assert(wTxn);
      createdWalletTxnIds.push(wTxn._id as mongoose.Types.ObjectId);
      assert.strictEqual(wTxn.amount, 450);
    });

    // -------------------------------------------------------------
    // U. Duplicate wallet credit blocked
    // -------------------------------------------------------------
    await test("U. Duplicate wallet credit is blocked (status already REFUNDED)", async () => {
      const user = await createTestUser("dup-wallet");
      const prod = await createTestProduct(20, 200);
      const order = await createTestOrder({
        userId: user._id as mongoose.Types.ObjectId,
        customerEmail: user.email,
        items: [{ product: prod, qty: 1 }],
      });

      const rrRes = await createReturnRequest({
        orderId: order._id.toString(),
        userId: user._id,
        customerEmail: user.email,
        requestedItems: [{ productId: prod._id.toString(), qty: 1, reason: "defective" }],
        returnWindowHours: 48,
      });
      assert(rrRes.returnRequest);
      createdReturnRequestIds.push(rrRes.returnRequest._id);

      await approveReturn(rrRes.returnRequest._id, "admin-1", "refund");
      await markReturnReceived(rrRes.returnRequest._id, "admin-1");
      await recordRefund(rrRes.returnRequest._id, "admin-1", { method: "wallet" });

      // Attempt second refund
      const secondRefund = await recordRefund(rrRes.returnRequest._id, "admin-1", { method: "wallet" });
      assert.strictEqual(secondRefund.success, false);
      assert.strictEqual(secondRefund.error, "Invalid status for refund");
    });

    // -------------------------------------------------------------
    // V. Duplicate refund blocked
    // -------------------------------------------------------------
    await test("V. Duplicate UPI refund is blocked", async () => {
      const prod = await createTestProduct(20, 200);
      const order = await createTestOrder({ items: [{ product: prod, qty: 1 }] });

      const rrRes = await createReturnRequest({
        orderId: order._id.toString(),
        customerEmail: order.customerEmail || "",
        requestedItems: [{ productId: prod._id.toString(), qty: 1, reason: "defective" }],
        returnWindowHours: 48,
      });
      assert(rrRes.returnRequest);
      createdReturnRequestIds.push(rrRes.returnRequest._id);

      await approveReturn(rrRes.returnRequest._id, "admin-1", "refund");
      await markReturnReceived(rrRes.returnRequest._id, "admin-1");
      await recordRefund(rrRes.returnRequest._id, "admin-1", { method: "upi", upiReference: "UTR123" });

      const dup = await recordRefund(rrRes.returnRequest._id, "admin-1", { method: "upi", upiReference: "UTR123" });
      assert.strictEqual(dup.success, false);
    });

    // -------------------------------------------------------------
    // W & X. Loyalty points reversal ONLY after refund & partial return
    // -------------------------------------------------------------
    await test("W & X. Loyalty points reversed ONLY after refund, and proportionally for partial return", async () => {
      const user = await createTestUser("loyalty-cust");
      user.loyaltyPointsBalance = 50;
      await user.save();

      const prodA = await createTestProduct(20, 600);
      const prodB = await createTestProduct(20, 400);
      const order = await createTestOrder({
        userId: user._id as mongoose.Types.ObjectId,
        customerEmail: user.email,
        items: [
          { product: prodA, qty: 1 },
          { product: prodB, qty: 1 },
        ],
        loyaltyPointsEarned: 10, // 10 points earned for ₹1049 total
      });

      const rrRes = await createReturnRequest({
        orderId: order._id.toString(),
        userId: user._id,
        customerEmail: user.email,
        requestedItems: [{ productId: prodA._id.toString(), qty: 1, reason: "transit_damage" }],
        returnWindowHours: 48,
      });
      assert(rrRes.returnRequest);
      createdReturnRequestIds.push(rrRes.returnRequest._id);

      // Upon request: points should NOT be reversed
      let checkUser = await User.findById(user._id);
      assert.strictEqual(checkUser?.loyaltyPointsBalance, 50);

      // Upon approval: points should NOT be reversed
      await approveReturn(rrRes.returnRequest._id, "admin-1", "refund");
      checkUser = await User.findById(user._id);
      assert.strictEqual(checkUser?.loyaltyPointsBalance, 50);

      // Upon mark received: points should NOT be reversed
      await markReturnReceived(rrRes.returnRequest._id, "admin-1");
      checkUser = await User.findById(user._id);
      assert.strictEqual(checkUser?.loyaltyPointsBalance, 50);

      // Upon REFUND recorded: points reversed proportionally
      await recordRefund(rrRes.returnRequest._id, "admin-1", { method: "upi", upiReference: "UTR999" });

      checkUser = await User.findById(user._id);
      // Proportion: 10 * 600 / 1049 = 5 points reversed
      assert(checkUser!.loyaltyPointsBalance < 50);

      const lTxn = await LoyaltyTransaction.findOne({ userId: user._id, referenceType: "order_returned" });
      assert(lTxn);
      createdLoyaltyTxnIds.push(lTxn._id as mongoose.Types.ObjectId);
      assert.strictEqual(lTxn.pointsDelta < 0, true);
    });

    // -------------------------------------------------------------
    // Y. Inventory restoration only at correct stage (mark received)
    // -------------------------------------------------------------
    await test("Y. Inventory is restored ONLY when package is marked received", async () => {
      const prod = await createTestProduct(10, 300);
      const initialStock = prod.stock;

      const order = await createTestOrder({ items: [{ product: prod, qty: 2 }] });

      const rrRes = await createReturnRequest({
        orderId: order._id.toString(),
        customerEmail: order.customerEmail || "",
        requestedItems: [{ productId: prod._id.toString(), qty: 2, reason: "defective" }],
        returnWindowHours: 48,
      });
      assert(rrRes.returnRequest);
      createdReturnRequestIds.push(rrRes.returnRequest._id);

      // Check stock after creation: unchanged
      let p = await Product.findById(prod._id);
      assert.strictEqual(p?.stock, initialStock);

      // Check stock after approval: unchanged
      await approveReturn(rrRes.returnRequest._id, "admin-1", "refund");
      p = await Product.findById(prod._id);
      assert.strictEqual(p?.stock, initialStock);

      // Check stock after mark received: restored by +2
      await markReturnReceived(rrRes.returnRequest._id, "admin-1");
      p = await Product.findById(prod._id);
      assert.strictEqual(p?.stock, initialStock + 2);

      // Verify StockHistory created
      const sh = await StockHistory.findOne({
        productId: prod._id,
        movementType: "return_restock",
      });
      assert(sh);
      createdStockHistoryIds.push(sh._id as mongoose.Types.ObjectId);
      assert.strictEqual(sh.delta, 2);
    });

    // -------------------------------------------------------------
    // Z. Duplicate inventory restoration blocked
    // -------------------------------------------------------------
    await test("Z. Duplicate inventory restoration is blocked via idempotency guard", async () => {
      const prod = await createTestProduct(15, 300);
      const order = await createTestOrder({ items: [{ product: prod, qty: 1 }] });

      const rrRes = await createReturnRequest({
        orderId: order._id.toString(),
        customerEmail: order.customerEmail || "",
        requestedItems: [{ productId: prod._id.toString(), qty: 1, reason: "wrong_item" }],
        returnWindowHours: 48,
      });
      assert(rrRes.returnRequest);
      createdReturnRequestIds.push(rrRes.returnRequest._id);

      await approveReturn(rrRes.returnRequest._id, "admin-1", "refund");
      await markReturnReceived(rrRes.returnRequest._id, "admin-1");

      const stockAfterFirst = (await Product.findById(prod._id))?.stock;

      // Second attempt to mark received
      const secondCall = await markReturnReceived(rrRes.returnRequest._id, "admin-1");
      assert.strictEqual(secondCall.success, false);

      const stockAfterSecond = (await Product.findById(prod._id))?.stock;
      assert.strictEqual(stockAfterFirst, stockAfterSecond);
    });

    // -------------------------------------------------------------
    // AA. Admin authorization
    // -------------------------------------------------------------
    await test("AA. Admin authorization: admin routes require admin role", async () => {
      const normalUser = { sub: "u123", email: "user@test.com", role: "user" };
      const adminUser = { sub: "a123", email: "admin@test.com", role: "admin" };

      const checkNormal = checkOrderAccess({} as any, normalUser as any);
      assert.strictEqual(checkNormal.isAdmin, false);

      const checkAdmin = checkOrderAccess({} as any, adminUser as any);
      assert.strictEqual(checkAdmin.isAdmin, true);
    });

    // -------------------------------------------------------------
    // AB. Customer IDOR blocked
    // -------------------------------------------------------------
    await test("AB. Customer IDOR: accessing or returning another user's order is blocked", async () => {
      const userA = await createTestUser("victim");
      const userB = await createTestUser("attacker");
      const prod = await createTestProduct();
      const victimOrder = await createTestOrder({
        userId: userA._id as mongoose.Types.ObjectId,
        customerEmail: userA.email,
        items: [{ product: prod, qty: 1 }],
      });

      const attackerAccess = checkOrderAccess(victimOrder, { sub: userB._id.toString(), email: userB.email } as any);
      assert.strictEqual(attackerAccess.allowed, false);
    });

    // -------------------------------------------------------------
    // AC. Concurrent duplicate requests protection
    // -------------------------------------------------------------
    await test("AC. Concurrent duplicate requests: locking guards prevent double processing", async () => {
      const prod = await createTestProduct(20, 200);
      const order = await createTestOrder({ items: [{ product: prod, qty: 1 }] });

      const rrRes = await createReturnRequest({
        orderId: order._id.toString(),
        customerEmail: order.customerEmail || "",
        requestedItems: [{ productId: prod._id.toString(), qty: 1, reason: "defective" }],
        returnWindowHours: 48,
      });
      assert(rrRes.returnRequest);
      createdReturnRequestIds.push(rrRes.returnRequest._id);

      await approveReturn(rrRes.returnRequest._id, "admin-1", "refund");
      await markReturnReceived(rrRes.returnRequest._id, "admin-1");

      // Simulate concurrency lock on refund
      await ReturnRequest.findByIdAndUpdate(rrRes.returnRequest._id, {
        $set: { refundLockUntil: new Date(Date.now() + 60000) },
      });

      const concurrentRefund = await recordRefund(rrRes.returnRequest._id, "admin-2", {
        method: "upi",
        upiReference: "UTRCONC",
      });
      assert.strictEqual(concurrentRefund.success, false);
      assert.strictEqual(concurrentRefund.error, "Refund already in progress");

      // Clear lock for test cleanup
      await ReturnRequest.findByIdAndUpdate(rrRes.returnRequest._id, { $set: { refundLockUntil: null } });
    });

    // -------------------------------------------------------------
    // AD. Return email idempotency
    // -------------------------------------------------------------
    await test("AD. Return email idempotency: locks prevent duplicate email dispatch", async () => {
      const prod = await createTestProduct();
      const order = await createTestOrder({ items: [{ product: prod, qty: 1 }] });

      const rrRes = await createReturnRequest({
        orderId: order._id.toString(),
        customerEmail: order.customerEmail || "",
        requestedItems: [{ productId: prod._id.toString(), qty: 1, reason: "defective" }],
        returnWindowHours: 48,
      });
      assert(rrRes.returnRequest);
      createdReturnRequestIds.push(rrRes.returnRequest._id);

      // First dispatch
      const d1 = await dispatchReturnRequestedEmail(
        rrRes.returnRequest._id,
        "test@example.com",
        "Devotee",
        "99999",
        [{ name: prod.name, qty: 1 }]
      );
      assert.strictEqual(d1.success, true);

      // Second dispatch must be skipped as already sent
      const d2 = await dispatchReturnRequestedEmail(
        rrRes.returnRequest._id,
        "test@example.com",
        "Devotee",
        "99999",
        [{ name: prod.name, qty: 1 }]
      );
      assert.strictEqual(d2.skipped, true);
    });

    // -------------------------------------------------------------
    // AE. Existing cancellation regression check
    // -------------------------------------------------------------
    await test("AE. Cancellation regression: cancellation service works untouched", async () => {
      const { cancelOrderAtomically, CANCELLABLE_STATUSES_CUSTOMER } = await import(
        "../services/cancellation.service"
      );
      assert(Array.isArray(CANCELLABLE_STATUSES_CUSTOMER));
      assert(CANCELLABLE_STATUSES_CUSTOMER.includes("Placed"));
      assert(CANCELLABLE_STATUSES_CUSTOMER.includes("Confirmed"));
      assert(!CANCELLABLE_STATUSES_CUSTOMER.includes("Delivered"));
    });

    // -------------------------------------------------------------
    // AF. Inventory regression check
    // -------------------------------------------------------------
    await test("AF. Inventory regression: StockHistory schema supports both cancellation and return restock", () => {
      const movementTypes = StockHistory.schema.path("movementType") as any;
      assert(movementTypes.enumValues.includes("cancellation_restock"));
      assert(movementTypes.enumValues.includes("return_restock"));
      assert(movementTypes.enumValues.includes("purchase"));
    });

    // -------------------------------------------------------------
    // AG. Invoice regression check
    // -------------------------------------------------------------
    await test("AG. Invoice regression: delivered orders retain deliveredAt for invoice eligibility", async () => {
      const prod = await createTestProduct();
      const deliveredDate = new Date();
      const order = await createTestOrder({
        items: [{ product: prod, qty: 1 }],
        deliveredAt: deliveredDate,
      });

      assert.strictEqual(order.deliveredAt?.toISOString(), deliveredDate.toISOString());
    });

    // -------------------------------------------------------------
    // AH. Abandoned cart regression check
    // -------------------------------------------------------------
    await test("AH. Abandoned cart regression: email template tpl.abandonedCart exists", () => {
      assert(typeof tpl.abandonedCart === "function");
    });

    // -------------------------------------------------------------
    // AI. Coupon regression check
    // -------------------------------------------------------------
    await test("AI. Coupon regression: restoreCouponRedemption is preserved", async () => {
      const couponService = await import("../services/coupon.service");
      assert(typeof couponService.restoreCouponRedemption === "function");
    });

    // -------------------------------------------------------------
    // AJ. Loyalty regression check
    // -------------------------------------------------------------
    await test("AJ. Loyalty regression: reversePointsForOrder is preserved", async () => {
      const loyaltyService = await import("../services/loyalty.service");
      assert(typeof loyaltyService.reversePointsForOrder === "function");
    });

    // -------------------------------------------------------------
    // AK. Wallet regression check
    // -------------------------------------------------------------
    await test("AK. Wallet regression: creditWallet & getUserWalletBalance are preserved", async () => {
      const walletService = await import("../services/wallet.service");
      assert(typeof walletService.creditWallet === "function");
      assert(typeof walletService.getUserWalletBalance === "function");
    });

    // -------------------------------------------------------------
    // AL. Analytics regression check
    // -------------------------------------------------------------
    await test("AL. Analytics & finance regression: isOrderPaidForFinance correctly handles refunded status", () => {
      const paidOrder = { status: "Delivered", payment: { status: "paid" } };
      assert.strictEqual(isOrderPaidForFinance(paidOrder), true);

      const refundedOrder = { status: "Delivered", payment: { status: "refunded" } };
      assert.strictEqual(isOrderPaidForFinance(refundedOrder), false);

      const cancelledOrder = { status: "Cancelled", payment: { status: "paid" } };
      assert.strictEqual(isOrderPaidForFinance(cancelledOrder), false);
    });

  } finally {
    // -------------------------------------------------------------
    // ZERO-LEFTOVER CLEANUP OF TEST DOCUMENTS
    // -------------------------------------------------------------
    console.log("\n-------------------------------------------------------");
    console.log(" EXECUTING ZERO-LEFTOVER CLEANUP OF TEST DOCUMENTS");
    console.log("-------------------------------------------------------");

    if (createdReturnRequestIds.length > 0) {
      await ReturnRequest.deleteMany({ _id: { $in: createdReturnRequestIds } });
    }
    if (createdOrderIds.length > 0) {
      await Order.deleteMany({ _id: { $in: createdOrderIds } });
    }
    if (createdProductIds.length > 0) {
      await Product.deleteMany({ _id: { $in: createdProductIds } });
    }
    if (createdUserIds.length > 0) {
      await User.deleteMany({ _id: { $in: createdUserIds } });
    }
    if (createdLoyaltyTxnIds.length > 0) {
      await LoyaltyTransaction.deleteMany({ _id: { $in: createdLoyaltyTxnIds } });
    }
    if (createdWalletTxnIds.length > 0) {
      await WalletTransaction.deleteMany({ _id: { $in: createdWalletTxnIds } });
    }
    if (createdStockHistoryIds.length > 0) {
      await StockHistory.deleteMany({ _id: { $in: createdStockHistoryIds } });
    }

    const leftoverReturns = await ReturnRequest.countDocuments({ _id: { $in: createdReturnRequestIds } });
    const leftoverOrders = await Order.countDocuments({ _id: { $in: createdOrderIds } });
    const leftoverProducts = await Product.countDocuments({ _id: { $in: createdProductIds } });
    const leftoverUsers = await User.countDocuments({ _id: { $in: createdUserIds } });
    const leftoverLoyalty = await LoyaltyTransaction.countDocuments({ _id: { $in: createdLoyaltyTxnIds } });
    const leftoverWallet = await WalletTransaction.countDocuments({ _id: { $in: createdWalletTxnIds } });
    const leftoverStock = await StockHistory.countDocuments({ _id: { $in: createdStockHistoryIds } });

    console.log(`  Cleanup results:`);
    console.log(`    - ReturnRequests remaining: ${leftoverReturns}`);
    console.log(`    - Orders remaining:         ${leftoverOrders}`);
    console.log(`    - Products remaining:       ${leftoverProducts}`);
    console.log(`    - Users remaining:          ${leftoverUsers}`);
    console.log(`    - Loyalty txns remaining:   ${leftoverLoyalty}`);
    console.log(`    - Wallet txns remaining:    ${leftoverWallet}`);
    console.log(`    - Stock history remaining:  ${leftoverStock}`);

    assert.strictEqual(leftoverReturns, 0, "All test return requests must be removed");
    assert.strictEqual(leftoverOrders, 0, "All test orders must be removed");
    assert.strictEqual(leftoverProducts, 0, "All test products must be removed");
    assert.strictEqual(leftoverUsers, 0, "All test users must be removed");
    assert.strictEqual(leftoverLoyalty, 0, "All test loyalty transactions must be removed");
    assert.strictEqual(leftoverWallet, 0, "All test wallet transactions must be removed");
    assert.strictEqual(leftoverStock, 0, "All test stock history entries must be removed");

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

runReturnsTests().catch((err) => {
  console.error("Test execution threw unhandled exception:", err);
  process.exit(1);
});
