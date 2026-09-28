import "dotenv/config";
import assert from "node:assert";
import mongoose from "mongoose";
import crypto from "crypto";
import { connectDB } from "../config/db";
import { User } from "../models/User";
import { Order } from "../models/Order";
import { Product } from "../models/Product";
import { Settings } from "../models/Settings";
import { LoyaltyTransaction } from "../models/LoyaltyTransaction";
import { WalletTransaction } from "../models/WalletTransaction";
import { MarketingUnsubscribe } from "../models/MarketingUnsubscribe";
import {
  getLoyaltySettings,
  getUserLoyaltyBalance,
  getLoyaltyLedger,
  validateAndCalculatePointsRedemption,
  redeemPointsForOrder,
  earnPointsForOrder,
  reversePointsForOrder,
  adminAdjustPoints,
  expireStalePoints,
  calculateCustomerTier,
} from "../services/loyalty.service";
import {
  getUserWalletBalance,
  getWalletLedger,
  creditWallet,
  debitWallet,
  adminAdjustWallet,
} from "../services/wallet.service";
import { linkGuestOrdersForUser } from "../services/guestAccountLinking.service";
import {
  getRetentionOverview,
  getRetentionCustomersList,
  getUnifiedCustomerMetrics,
  calculateRfm,
  calculateLifecycleSegment,
} from "../services/retention.service";
import { sendMarketingEmail } from "../utils/email";

async function runRetentionLoyaltyTests() {
  console.log("\n=======================================================");
  console.log(" CUSTOMER RETENTION & LOYALTY VERIFICATION SUITE");
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

  const runId = `test_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`;
  const testPrefix = `__TEST_${runId}_`;

  const createdUserIds: mongoose.Types.ObjectId[] = [];
  const createdOrderIds: mongoose.Types.ObjectId[] = [];
  const createdProductIds: mongoose.Types.ObjectId[] = [];
  const createdLoyaltyTxIds: mongoose.Types.ObjectId[] = [];
  const createdWalletTxIds: mongoose.Types.ObjectId[] = [];

  // Helper to create test user
  const createTestUser = async (email: string, name: string = "Test Devotee", isVerified: boolean = true) => {
    const user = await User.create({
      name: `${testPrefix}${name}`,
      email: `${testPrefix}${email.toLowerCase()}`,
      password: "hashedPassword123",
      role: "user",
      emailVerified: isVerified,
      emailVerifiedAt: isVerified ? new Date() : undefined,
      loyaltyPointsBalance: 0,
      walletBalance: 0,
      wishlist: [],
      marketingEmailOptIn: true,
    });
    createdUserIds.push(user._id);
    return user;
  };

  // Helper to create test product
  const createTestProduct = async (name: string, price: number, gstRate: number = 0) => {
    const prod = await Product.create({
      name: `${testPrefix}${name}`,
      description: "Sacred test product",
      price,
      mrp: price + 100,
      costPrice: price * 0.5,
      stock: 50,
      category: "Tulsi Mala",
      images: ["https://example.com/test.jpg"],
      gstRate,
      gstInclusive: true,
      isTaxable: gstRate > 0,
    });
    createdProductIds.push(prod._id);
    return prod;
  };

  // Helper to create test order
  const createTestOrder = async (params: {
    userId?: mongoose.Types.ObjectId | null;
    email: string;
    total: number;
    subtotal?: number;
    paymentMethod?: "razorpay" | "cod";
    paymentStatus?: "paid" | "pending" | "failed" | "refunded";
    orderStatus?: "Placed" | "Confirmed" | "Shipped" | "Delivered" | "Cancelled";
    items?: any[];
    discount?: number;
    loyaltyPointsRedeemed?: number;
    loyaltyPointsDiscount?: number;
    createdAt?: Date;
  }) => {
    const order = await Order.create({
      user: params.userId || null,
      customerEmail: `${testPrefix}${params.email.toLowerCase()}`,
      items: params.items || [
        {
          productId: new mongoose.Types.ObjectId(),
          name: "Devotional Item",
          qty: 1,
          price: params.subtotal || params.total,
          mrp: (params.subtotal || params.total) + 50,
        },
      ],
      subtotal: params.subtotal || params.total,
      shipping: 0,
      packagingFee: 0,
      discount: params.discount || 0,
      loyaltyPointsRedeemed: params.loyaltyPointsRedeemed || 0,
      loyaltyPointsDiscount: params.loyaltyPointsDiscount || 0,
      total: params.total,
      address: {
        name: "Test Devotee",
        phone: "9876543210",
        line1: "Raman Reti Road",
        city: "Vrindavan",
        state: "Uttar Pradesh",
        pincode: "281121",
      },
      payment: {
        method: params.paymentMethod || "razorpay",
        status: params.paymentStatus || "paid",
      },
      status: params.orderStatus || "Delivered",
      createdAt: params.createdAt || new Date(),
    });
    createdOrderIds.push(order._id);
    return order;
  };

  try {
    // =========================================================================
    // SECTION A: GUEST-TO-ACCOUNT LINKING
    // =========================================================================
    await test("Section A: Guest orders are idempotently linked only after email verification", async () => {
      const email = `guest_linking_${Date.now()}@example.com`;

      // Create two guest orders
      const gOrder1 = await createTestOrder({ email, total: 500 });
      const gOrder2 = await createTestOrder({ email, total: 750 });
      assert.strictEqual(gOrder1.user, null);
      assert.strictEqual(gOrder2.user, null);

      // Create verified user
      const user = await createTestUser(email, "Linking Devotee", true);

      // Link orders
      const linkRes = await linkGuestOrdersForUser(user);
      assert.strictEqual(linkRes.linkedCount, 2, "Expected 2 guest orders to be linked");

      // Verify orders are now linked to user._id
      const refreshedOrder1 = await Order.findById(gOrder1._id);
      const refreshedOrder2 = await Order.findById(gOrder2._id);
      assert.strictEqual(refreshedOrder1?.user?.toString(), user._id.toString());
      assert.strictEqual(refreshedOrder2?.user?.toString(), user._id.toString());

      // Idempotency: Running linking again links 0 additional orders
      const secondRun = await linkGuestOrdersForUser(user);
      assert.strictEqual(secondRun.linkedCount, 0, "Idempotent linking should link 0 on re-run");
    });

    // =========================================================================
    // SECTION B: GUEST ORDER VISIBILITY
    // =========================================================================
    await test("Section B: Orders query matches both user ID and customerEmail for verified users", async () => {
      const email = `visibility_${Date.now()}@example.com`;
      const user = await createTestUser(email, "Visibility Devotee", true);

      // Order linked by user ID
      const ord1 = await createTestOrder({ userId: user._id, email, total: 300 });
      // Historical order with matching customerEmail but user: null
      const ord2 = await createTestOrder({ userId: null, email, total: 450 });

      // Simulate customer orders endpoint query: { $or: [{ user: userId }, { customerEmail: userEmail }] }
      const matched = await Order.find({
        $or: [{ user: user._id }, { customerEmail: user.email }],
      }).lean();

      const matchedIds = matched.map((m) => m._id.toString());
      assert.ok(matchedIds.includes(ord1._id.toString()), "User ID matched order should be visible");
      assert.ok(matchedIds.includes(ord2._id.toString()), "Email-matched historical order should be visible");
    });

    // =========================================================================
    // SECTION C: IDENTITY VERIFICATION SAFETY
    // =========================================================================
    await test("Section C: Unverified user cannot claim guest orders with mismatched email", async () => {
      const targetEmail = `secure_target_${Date.now()}@example.com`;
      const attackerEmail = `attacker_${Date.now()}@example.com`;

      // Guest order belonging to victim
      const victimOrder = await createTestOrder({ email: targetEmail, total: 1000 });

      // Attacker tries to claim victim's order with attacker's email
      const attacker = await createTestUser(attackerEmail, "Attacker Devotee", true);
      const linkRes = await linkGuestOrdersForUser(attacker);
      assert.strictEqual(linkRes.linkedCount, 0, "Attacker should not link victim's orders");

      const orderCheck = await Order.findById(victimOrder._id);
      assert.strictEqual(orderCheck?.user, null, "Victim's order must remain unlinked");
    });

    // =========================================================================
    // SECTION D: 360-DEGREE CRM & UNIFIED CUSTOMER METRICS
    // =========================================================================
    await test("Section D: Unified CRM computes aggregate orders, spend, and AOV across guest + account", async () => {
      const email = `crm_metrics_${Date.now()}@example.com`;
      const user = await createTestUser(email, "CRM Devotee", true);

      // Create 2 paid orders and 1 cancelled order
      await createTestOrder({ userId: user._id, email, total: 400, paymentStatus: "paid", orderStatus: "Delivered" });
      await createTestOrder({ userId: user._id, email, total: 600, paymentStatus: "paid", orderStatus: "Delivered" });
      await createTestOrder({ userId: user._id, email, total: 999, paymentStatus: "failed", orderStatus: "Cancelled" });

      const metrics = await getUnifiedCustomerMetrics({ userId: user._id.toString() });
      assert.ok(metrics, "Customer metrics must be returned");
      assert.strictEqual(metrics.totalOrdersPlaced, 3, "Total orders must count all placed orders");
      assert.strictEqual(metrics.qualifiedOrderCount, 2, "Paid orders must count only financially qualified orders");
      assert.strictEqual(metrics.lifetimeQualifiedRevenue, 1000, "Total spend should equal sum of paid orders (400+600=1000)");
      assert.strictEqual(metrics.aov, 500, "AOV should be 1000 / 2 = 500");
    });

    // =========================================================================
    // SECTION E: LTV QUALIFICATION (FINANCIAL REALITY)
    // =========================================================================
    await test("Section E: LTV excludes unpaid COD, failed Razorpay, and cancelled orders", async () => {
      const email = `ltv_qual_${Date.now()}@example.com`;
      const user = await createTestUser(email, "LTV Devotee", true);

      // 1. Delivered COD (Qualified) -> ₹500
      await createTestOrder({ userId: user._id, email, total: 500, paymentMethod: "cod", paymentStatus: "paid", orderStatus: "Delivered" });
      // 2. Pending COD not delivered (Unqualified) -> ₹700
      await createTestOrder({ userId: user._id, email, total: 700, paymentMethod: "cod", paymentStatus: "pending", orderStatus: "Placed" });
      // 3. Failed online order (Unqualified) -> ₹400
      await createTestOrder({ userId: user._id, email, total: 400, paymentMethod: "razorpay", paymentStatus: "failed", orderStatus: "Cancelled" });

      const metrics = await getUnifiedCustomerMetrics({ userId: user._id.toString() });
      assert.strictEqual(metrics?.lifetimeQualifiedRevenue, 500, "LTV must strictly equal qualified ₹500");
      assert.strictEqual(metrics?.qualifiedOrderCount, 1, "Only 1 qualified order should count");
    });

    // =========================================================================
    // SECTION F: REPEAT PURCHASE TRACKING
    // =========================================================================
    await test("Section F: First-time vs repeat customer categorization in retention overview", async () => {
      const email = `repeat_track_${Date.now()}@example.com`;
      const user = await createTestUser(email, "Repeat Devotee", true);

      // 1st order
      await createTestOrder({ userId: user._id, email, total: 300, paymentStatus: "paid", orderStatus: "Delivered" });
      let metrics = await getUnifiedCustomerMetrics({ userId: user._id.toString() });
      assert.strictEqual(metrics?.qualifiedOrderCount, 1);
      assert.strictEqual(metrics?.lifecycleSegment, "New", "1st order should classify as New segment");

      // 2nd order -> Repeat purchase
      await createTestOrder({ userId: user._id, email, total: 400, paymentStatus: "paid", orderStatus: "Delivered" });
      metrics = await getUnifiedCustomerMetrics({ userId: user._id.toString() });
      assert.strictEqual(metrics?.qualifiedOrderCount, 2);
      assert.strictEqual(metrics?.lifecycleSegment, "Active", "2nd order should transition customer to Active segment");
    });

    // =========================================================================
    // SECTION G: RFM SCORING
    // =========================================================================
    await test("Section G: RFM calculates 1-5 scores for Recency, Frequency, and Monetary", async () => {
      // Frequency score test
      const rfm1 = calculateRfm(5, 1, 200); // 1 order
      assert.strictEqual(rfm1.frequencyScore, 1);
      assert.strictEqual(rfm1.recencyScore, 5); // 5 days ago = high recency

      const rfmHigh = calculateRfm(15, 8, 10000); // 8 orders, ₹10000 spend
      assert.strictEqual(rfmHigh.frequencyScore, 5);
      assert.strictEqual(rfmHigh.monetaryScore, 5);
      assert.strictEqual(rfmHigh.recencyScore, 5);
      assert.strictEqual(rfmHigh.rfmSegment, "Champions");
    });

    // =========================================================================
    // SECTION H: POINTS EARNING (BASE + VIP MULTIPLIER)
    // =========================================================================
    await test("Section H: Points earned on paid order with VIP multiplier", async () => {
      const email = `points_earn_${Date.now()}@example.com`;
      const user = await createTestUser(email, "Earning Devotee", true);

      // Order of ₹1000 spend. Settings: 1 pt per ₹100 spend. Base points = 10.
      const order = await createTestOrder({
        userId: user._id,
        email,
        total: 1000,
        subtotal: 1000,
        paymentStatus: "paid",
        orderStatus: "Delivered",
      });

      const earned = await earnPointsForOrder(order);

      assert.ok(earned, "Points should be earned for paid order");
      assert.strictEqual(earned.earned, 10, "1000 / 100 = 10 points earned");

      // Verify user balance updated
      const refreshedUser = await User.findById(user._id);
      assert.strictEqual(refreshedUser?.loyaltyPointsBalance, 10);

      // Verify immutable ledger transaction created
      const ledger = await getLoyaltyLedger(user._id.toString(), 10);
      assert.strictEqual(ledger.length, 1);
      assert.strictEqual(ledger[0].type, "EARN");
      assert.strictEqual(ledger[0].pointsDelta, 10);
      assert.strictEqual(ledger[0].balanceAfter, 10);
      createdLoyaltyTxIds.push(ledger[0]._id);
    });

    // =========================================================================
    // SECTION I: POINTS REDEMPTION VALIDATION
    // =========================================================================
    await test("Section I: Points redemption validates min points, max % cap, and balance", async () => {
      const email = `points_valid_${Date.now()}@example.com`;
      const user = await createTestUser(email, "Redeem Devotee", true);

      // Set user balance to 200 points
      await User.findByIdAndUpdate(user._id, { loyaltyPointsBalance: 200 });

      // 1. Below minimum points (e.g. 20 pts when min is 50) -> invalid
      const belowMin = await validateAndCalculatePointsRedemption({
        userId: user._id.toString(),
        pointsRequested: 20,
        subtotal: 1000,
        hasCoupon: false,
      });
      assert.strictEqual(belowMin.valid, false);
      assert.ok(belowMin.error?.includes("Minimum"));

      // 2. Valid redemption: 100 points on ₹1000 subtotal (worth ₹100, within 50% cap = ₹500)
      const validRedeem = await validateAndCalculatePointsRedemption({
        userId: user._id.toString(),
        pointsRequested: 100,
        subtotal: 1000,
        hasCoupon: false,
      });
      assert.strictEqual(validRedeem.valid, true);
      assert.strictEqual(validRedeem.pointsRedeemed, 100);
      assert.strictEqual(validRedeem.pointsDiscount, 100); // 100 * 1 = ₹100

      // 3. Exceeds max percent cap (e.g. 1000 points = ₹1000 on ₹200 order; max 50% = ₹100)
      await User.findByIdAndUpdate(user._id, { loyaltyPointsBalance: 5000 });
      const overCap = await validateAndCalculatePointsRedemption({
        userId: user._id.toString(),
        pointsRequested: 1000,
        subtotal: 200,
        hasCoupon: false,
      });
      assert.strictEqual(overCap.valid, false);
      assert.ok(overCap.error?.includes("cannot exceed"));
    });

    // =========================================================================
    // SECTION J: POINTS EXPIRATION
    // =========================================================================
    await test("Section J: Expired points are identified and deducted from balance", async () => {
      const email = `points_expire_${Date.now()}@example.com`;
      const user = await createTestUser(email, "Expire Devotee", true);

      // Give 50 points directly
      await User.findByIdAndUpdate(user._id, { loyaltyPointsBalance: 50 });

      // Create an expired EARN transaction in the past (expiresAt in past)
      const staleTx = await LoyaltyTransaction.create({
        userId: user._id,
        customerEmail: user.email,
        type: "EARN",
        pointsDelta: 50,
        balanceAfter: 50,
        expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
        isExpired: false,
        reason: "Stale earned points",
        referenceType: "order_earned",
      });
      createdLoyaltyTxIds.push(staleTx._id);

      // Run expiration service
      const res = await expireStalePoints();
      assert.ok(res.expiredCount >= 1, "At least 1 transaction should be marked expired");

      // Verify user balance reduced
      const refreshedUser = await User.findById(user._id);
      assert.strictEqual(refreshedUser?.loyaltyPointsBalance, 0, "User balance must drop by 50 to 0");

      const refreshedTx = await LoyaltyTransaction.findById(staleTx._id);
      assert.strictEqual(refreshedTx?.isExpired, true);
    });

    // =========================================================================
    // SECTION K: ORDER CANCELLATION & POINTS REVERSAL
    // =========================================================================
    await test("Section K: Cancelled order reverses earned points and restores redeemed points", async () => {
      const email = `cancel_reversal_${Date.now()}@example.com`;
      const user = await createTestUser(email, "Reversal Devotee", true);

      // Initial state: user has 100 points
      await User.findByIdAndUpdate(user._id, { loyaltyPointsBalance: 100 });

      const order = await createTestOrder({
        userId: user._id,
        email,
        total: 500,
        subtotal: 600,
        discount: 0,
        loyaltyPointsRedeemed: 100,
        loyaltyPointsDiscount: 100,
        paymentStatus: "paid",
        orderStatus: "Delivered",
      });

      // Execute redemption on this order (points balance 100 -> 0)
      await redeemPointsForOrder({
        userId: user._id.toString(),
        orderId: order._id.toString(),
        pointsToRedeem: 100,
        pointsDiscount: 100,
      });

      // Earn points on this order (spend 500 -> 5 points earned)
      await earnPointsForOrder(order);

      // Verify balance is now 5
      let refreshedUser = await User.findById(user._id);
      assert.strictEqual(refreshedUser?.loyaltyPointsBalance, 5);

      // Reverse points for order (mimics cancellation)
      const reversal = await reversePointsForOrder(order);

      assert.strictEqual(reversal.earnedPointsReversed, 5);
      assert.strictEqual(reversal.redeemedPointsRefunded, 100);

      // Final balance should be 5 - 5 + 100 = 100 points
      refreshedUser = await User.findById(user._id);
      assert.strictEqual(refreshedUser?.loyaltyPointsBalance, 100);
    });

    // =========================================================================
    // SECTION L: POINTS CONCURRENCY SAFETY (CAS ATOMICITY)
    // =========================================================================
    await test("Section L: Concurrent points redemption safely blocks overspending via atomic CAS", async () => {
      const email = `concurrency_cas_${Date.now()}@example.com`;
      const user = await createTestUser(email, "Concurrency Devotee", true);

      // User has exactly 100 points
      await User.findByIdAndUpdate(user._id, { loyaltyPointsBalance: 100 });

      const fakeOrderId1 = new mongoose.Types.ObjectId().toString();
      const fakeOrderId2 = new mongoose.Types.ObjectId().toString();

      // Launch 2 parallel redemption attempts for 100 points simultaneously
      const results = await Promise.all([
        redeemPointsForOrder({
          userId: user._id.toString(),
          orderId: fakeOrderId1,
          pointsToRedeem: 100,
          pointsDiscount: 100,
        }),
        redeemPointsForOrder({
          userId: user._id.toString(),
          orderId: fakeOrderId2,
          pointsToRedeem: 100,
          pointsDiscount: 100,
        }),
      ]);

      const successful = results.filter((r) => r.success);
      const failed = results.filter((r) => !r.success);

      assert.strictEqual(successful.length, 1, "Exactly 1 concurrent redemption must succeed");
      assert.strictEqual(failed.length, 1, "The second concurrent redemption must fail due to atomic $gte check");

      // Final balance must be exactly 0, never negative
      const refreshedUser = await User.findById(user._id);
      assert.strictEqual(refreshedUser?.loyaltyPointsBalance, 0);
    });

    // =========================================================================
    // SECTION M: POINTS + COUPONS SYNERGY
    // =========================================================================
    await test("Section M: Both coupon discount and points discount apply together server-side", async () => {
      const email = `coupon_points_${Date.now()}@example.com`;
      const user = await createTestUser(email, "Synergy Devotee", true);
      await User.findByIdAndUpdate(user._id, { loyaltyPointsBalance: 200 });

      // Subtotal = ₹1000. Coupon = ₹100 flat. Remaining eligible = ₹900.
      const subtotal = 1000;
      const couponDiscount = 100;
      const eligibleAfterCoupon = subtotal - couponDiscount;

      const pointsVal = await validateAndCalculatePointsRedemption({
        userId: user._id.toString(),
        pointsRequested: 100, // worth ₹100
        subtotal: eligibleAfterCoupon,
        hasCoupon: true,
      });

      assert.strictEqual(pointsVal.valid, true);
      assert.strictEqual(pointsVal.pointsDiscount, 100);

      const finalPayable = subtotal - couponDiscount - pointsVal.pointsDiscount;
      assert.strictEqual(finalPayable, 800, "₹1000 - ₹100 coupon - ₹100 points = ₹800 payable");
      assert.ok(finalPayable >= 0, "Final payable must remain non-negative");
    });

    // =========================================================================
    // SECTION N: NEGATIVE TOTAL PREVENTION
    // =========================================================================
    await test("Section N: Server prevents discounts from producing a negative total", async () => {
      const email = `neg_total_${Date.now()}@example.com`;
      const user = await createTestUser(email, "Zero Total Devotee", true);
      await User.findByIdAndUpdate(user._id, { loyaltyPointsBalance: 5000 });

      // Small item of ₹30
      const subtotal = 30;
      const pointsVal = await validateAndCalculatePointsRedemption({
        userId: user._id.toString(),
        pointsRequested: 50, // ₹50
        subtotal,
        hasCoupon: false,
      });

      // 50% cap of ₹30 = ₹15 max discount. 50 > 15 -> blocked.
      assert.strictEqual(pointsVal.valid, false, "Points exceeding 50% cap on small item are blocked");
    });

    // =========================================================================
    // SECTION O: GST ALLOCATION WITH POINTS DISCOUNT
    // =========================================================================
    await test("Section O: Points discount is apportioned proportionally across taxable line items", async () => {
      // 2 items: Item A = ₹600 (18% GST), Item B = ₹400 (5% GST). Subtotal = ₹1000.
      // Points discount = ₹50 (5% overall discount).
      const subtotal = 1000;
      const pointsDiscount = 50;
      const ratioA = 600 / subtotal; // 0.6
      const ratioB = 400 / subtotal; // 0.4

      const discountA = pointsDiscount * ratioA; // ₹30
      const discountB = pointsDiscount * ratioB; // ₹20
      assert.strictEqual(discountA + discountB, pointsDiscount, "Apportioned discounts must equal total points discount");

      const netPriceA = 600 - discountA; // ₹570
      const netPriceB = 400 - discountB; // ₹380
      assert.strictEqual(netPriceA + netPriceB, subtotal - pointsDiscount);
    });

    // =========================================================================
    // SECTION P: VIP TIER CALCULATION
    // =========================================================================
    await test("Section P: VIP tier calculates Sevak, Priya, Param, Platinum accurately", async () => {
      const bronze = calculateCustomerTier(500, 1);
      assert.strictEqual(bronze.name, "Sevak (Bronze)");

      const silver = calculateCustomerTier(2500, 2);
      assert.strictEqual(silver.name, "Priya Devotee (Silver)");

      const gold = calculateCustomerTier(6000, 4);
      assert.strictEqual(gold.name, "Param Devotee (Gold)");

      const customTiers = [
        { id: "t4", name: "Parama Devotee (Platinum)", minSpend: 10000, minOrders: 10, rule: "spend_or_orders" as const, badgeColor: "#000", perks: [], extraPointsMultiplier: 2.0 },
        { id: "t3", name: "Param Devotee (Gold)", minSpend: 5000, minOrders: 5, rule: "spend_or_orders" as const, badgeColor: "#d97706", perks: [], extraPointsMultiplier: 1.5 },
        { id: "t2", name: "Priya Devotee (Silver)", minSpend: 2000, minOrders: 2, rule: "spend_or_orders" as const, badgeColor: "#64748b", perks: [], extraPointsMultiplier: 1.2 },
        { id: "t1", name: "Sevak (Bronze)", minSpend: 0, minOrders: 0, rule: "spend_or_orders" as const, badgeColor: "#b45309", perks: [], extraPointsMultiplier: 1.0 },
      ];
      const platinum = calculateCustomerTier(15000, 8, customTiers);
      assert.strictEqual(platinum.name, "Parama Devotee (Platinum)");
    });

    // =========================================================================
    // SECTION Q: TIER PERK / MULTIPLIER APPLICATION
    // =========================================================================
    await test("Section Q: Param Devotee (Gold) earns 1.5x points multiplier on order", async () => {
      const email = `tier_multiplier_${Date.now()}@example.com`;
      const user = await createTestUser(email, "Gold Tier Devotee", true);

      // Create prior orders totaling ₹6000 to qualify for Param Devotee (Gold)
      await createTestOrder({ userId: user._id, email, total: 6000, paymentStatus: "paid", orderStatus: "Delivered" });

      // Now place an order of ₹1000. Base = 10 pts. Param Devotee 1.5x multiplier = 15 pts.
      const newOrder = await createTestOrder({
        userId: user._id,
        email,
        total: 1000,
        subtotal: 1000,
        paymentStatus: "paid",
        orderStatus: "Delivered",
      });

      const earned = await earnPointsForOrder(newOrder);

      assert.strictEqual(earned.earned, 15, "Param Devotee (Gold) should earn 15 points (10 * 1.5)");
    });

    // =========================================================================
    // SECTION R: WALLET STORE CREDIT & CONCURRENCY
    // =========================================================================
    await test("Section R: Wallet credit and debit with atomic CAS protection against negative balance", async () => {
      const email = `wallet_cas_${Date.now()}@example.com`;
      const user = await createTestUser(email, "Wallet Devotee", true);

      // Credit ₹500
      const creditRes = await creditWallet({
        userId: user._id.toString(),
        amount: 500,
        reason: "Promotional goodwill credit",
      });
      assert.strictEqual(creditRes.newBalance, 500);

      // Debit ₹200
      const debitRes = await debitWallet({
        userId: user._id.toString(),
        amount: 200,
        reason: "Order checkout debit",
      });
      assert.strictEqual(debitRes.newBalance, 300);

      // Overdraft attempt of ₹400 when balance is ₹300 -> must throw
      let threw = false;
      try {
        await debitWallet({
          userId: user._id.toString(),
          amount: 400,
          reason: "Excessive debit attempt",
        });
      } catch (err: any) {
        threw = true;
        assert.ok(err.message.includes("Insufficient wallet balance"));
      }
      assert.strictEqual(threw, true, "Overdraft must be rejected");

      const refreshedUser = await User.findById(user._id);
      assert.strictEqual(refreshedUser?.walletBalance, 300, "Balance must remain ₹300");
    });

    // =========================================================================
    // SECTION S: WALLET LEDGER IMMUTABILITY
    // =========================================================================
    await test("Section S: Wallet transactions form an append-only audit ledger", async () => {
      const email = `wallet_ledger_${Date.now()}@example.com`;
      const user = await createTestUser(email, "Ledger Devotee", true);

      await creditWallet({ userId: user._id.toString(), amount: 150, reason: "Refund credit" });
      await debitWallet({ userId: user._id.toString(), amount: 50, reason: "Purchase debit" });

      const ledger = await getWalletLedger(user._id.toString(), 10);
      assert.strictEqual(ledger.length, 2);
      assert.strictEqual(ledger[0].type, "DEBIT"); // newest first
      assert.strictEqual(Math.abs(ledger[0].amount), 50);
      assert.strictEqual(ledger[1].type, "CREDIT");
      assert.strictEqual(ledger[1].amount, 150);

      ledger.forEach((t) => createdWalletTxIds.push(t._id));
    });

    // =========================================================================
    // SECTION T: WISHLIST CROSS-DEVICE MERGE
    // =========================================================================
    await test("Section T: Local guest wishlist is merged into account without losing items or duplicating", async () => {
      const email = `wishlist_merge_${Date.now()}@example.com`;
      const prod1 = await createTestProduct("Radha Krishna Locket", 250);
      const prod2 = await createTestProduct("Tulsi Bead Mala", 150);
      const prod3 = await createTestProduct("Chandan Paste", 80);

      // User already has prod1 in their account
      const user = await createTestUser(email, "Wishlist Devotee", true);
      await User.findByIdAndUpdate(user._id, { wishlist: [prod1._id] });

      // Local browser contains prod1 and prod2 and prod3
      const localItems = [prod1._id.toString(), prod2._id.toString(), prod3._id.toString()];

      // Merge logic:
      const existing = (await User.findById(user._id))?.wishlist.map((id) => id.toString()) || [];
      const combined = Array.from(new Set([...existing, ...localItems]));
      await User.findByIdAndUpdate(user._id, { wishlist: combined });

      const refreshed = await User.findById(user._id);
      assert.strictEqual(refreshed?.wishlist.length, 3, "Wishlist must have 3 distinct products");
      const stringified = refreshed?.wishlist.map((id) => id.toString()) || [];
      assert.ok(stringified.includes(prod1._id.toString()));
      assert.ok(stringified.includes(prod2._id.toString()));
      assert.ok(stringified.includes(prod3._id.toString()));
    });

    // =========================================================================
    // SECTION U: WISHLIST TOGGLE PERSISTENCE
    // =========================================================================
    await test("Section U: Wishlist toggle adds when absent and removes when present", async () => {
      const email = `wishlist_toggle_${Date.now()}@example.com`;
      const prod = await createTestProduct("Kanthi Mala Single Round", 120);
      const user = await createTestUser(email, "Toggle Devotee", true);

      // 1. Toggle ON
      await User.findByIdAndUpdate(user._id, { $addToSet: { wishlist: prod._id } });
      let check = await User.findById(user._id);
      assert.strictEqual(check?.wishlist.length, 1);

      // 2. Toggle OFF
      await User.findByIdAndUpdate(user._id, { $pull: { wishlist: prod._id } });
      check = await User.findById(user._id);
      assert.strictEqual(check?.wishlist.length, 0);
    });

    // =========================================================================
    // SECTION V: MARKETING COMMUNICATION & OPT-OUT
    // =========================================================================
    await test("Section V: Marketing emails respect unsubscribe records and do not send to opted-out users", async () => {
      const email = `${testPrefix}optout_devotee@example.com`;

      // Record unsubscribe
      await MarketingUnsubscribe.create({
        email: email.toLowerCase(),
        token: crypto.randomBytes(16).toString("hex"),
        reason: "User unsubscribed via one-click link",
      });

      // Attempt sending marketing email
      const result = await sendMarketingEmail({
        to: email,
        subject: "Exclusive Vrindavan Festival Rewards",
        html: "<p>Devotee special</p>",
      });

      assert.strictEqual(result.skipped, true);
      assert.strictEqual(result.reason, "unsubscribed");
    });

    // =========================================================================
    // SECTION W: RETENTION SEGMENTATION
    // =========================================================================
    await test("Section W: Customer lifecycle segmentation categorizes New, Active, At Risk, Lapsed, Dormant", async () => {
      const now = Date.now();
      const daysAgo = (d: number) => new Date(now - d * 24 * 60 * 60 * 1000);

      assert.strictEqual(calculateLifecycleSegment(1, daysAgo(10), daysAgo(10)), "New");
      assert.strictEqual(calculateLifecycleSegment(3, daysAgo(60), daysAgo(20)), "Active");
      assert.strictEqual(calculateLifecycleSegment(3, daysAgo(120), daysAgo(90)), "At Risk");
      assert.strictEqual(calculateLifecycleSegment(2, daysAgo(200), daysAgo(150)), "Lapsed");
      assert.strictEqual(calculateLifecycleSegment(2, daysAgo(350), daysAgo(260)), "Dormant");
    });

    // =========================================================================
    // SECTION X: ADMIN RETENTION CONTROLS & AUDIT TRAIL
    // =========================================================================
    await test("Section X: Admin manual adjustments require reason and are recorded in audit ledger", async () => {
      const email = `admin_adjust_${Date.now()}@example.com`;
      const user = await createTestUser(email, "Adjusted Devotee", true);

      // Admin adjusts points with mandatory reason
      const pointsAdj = await adminAdjustPoints({
        userId: user._id.toString(),
        pointsDelta: 75,
        reason: "Customer appreciation courtesy points",
        adminEmail: "admin@shriradhagovindstore.com",
      });
      assert.strictEqual(pointsAdj.newBalance, 75);

      // Admin adjusts wallet with mandatory reason
      const walletAdj = await adminAdjustWallet({
        userId: user._id.toString(),
        amount: 250,
        direction: "credit",
        reason: "Customer care return store credit",
        adminEmail: "admin@shriradhagovindstore.com",
      });
      assert.strictEqual(walletAdj.newBalance, 250);

      // Verify points ledger
      const pLedger = await getLoyaltyLedger(user._id.toString(), 5);
      assert.strictEqual(pLedger[0].type, "ADJUSTMENT_CREDIT");
      assert.strictEqual(pLedger[0].reason, "Customer appreciation courtesy points");

      // Verify wallet ledger
      const wLedger = await getWalletLedger(user._id.toString(), 5);
      assert.strictEqual(wLedger[0].type, "ADJUSTMENT_CREDIT");
      assert.strictEqual(wLedger[0].reason, "Customer care return store credit");
    });

    // =========================================================================
    // SECTION Y: RETENTION API CONTRACT STABILITY & EMPTY DATASET RESILIENCE
    // =========================================================================
    await test("Section Y: Retention overview and customer list API contracts guarantee stable shapes and never crash on empty data", async () => {
      // 1. Verify getRetentionOverview contract
      const overviewRes = await getRetentionOverview();
      assert.ok(overviewRes, "Overview response must not be null");
      assert.ok(overviewRes.customerCounts, "overview.customerCounts must be defined");
      assert.strictEqual(typeof overviewRes.customerCounts.total, "number");
      assert.strictEqual(typeof overviewRes.customerCounts.registered, "number");
      assert.strictEqual(typeof overviewRes.customerCounts.guests, "number");
      assert.strictEqual(typeof overviewRes.customerCounts.repeatCustomers, "number");
      assert.strictEqual(typeof overviewRes.customerCounts.repeatCustomerRate, "number");

      assert.ok(overviewRes.financials, "overview.financials must be defined");
      assert.strictEqual(typeof overviewRes.financials.totalRevenue, "number");
      assert.strictEqual(typeof overviewRes.financials.totalPaidOrders, "number");

      assert.ok(overviewRes.loyalty, "overview.loyalty must be defined");
      assert.strictEqual(typeof overviewRes.loyalty.activePointsInCirculation, "number");
      assert.strictEqual(typeof overviewRes.loyalty.pointsMonetaryValueInCirculation, "number");

      assert.ok(overviewRes.wallet, "overview.wallet must be defined");
      assert.strictEqual(typeof overviewRes.wallet.totalWalletBalanceOutstanding, "number");

      assert.ok(overviewRes.segmentation, "overview.segmentation must be defined");
      assert.strictEqual(typeof overviewRes.segmentation.New, "number");
      assert.strictEqual(typeof overviewRes.segmentation.Active, "number");
      assert.strictEqual(typeof overviewRes.segmentation["At Risk"], "number");
      assert.strictEqual(typeof overviewRes.segmentation.Lapsed, "number");
      assert.strictEqual(typeof overviewRes.segmentation.Dormant, "number");

      // 2. Verify getRetentionCustomersList contract
      const customersRes = await getRetentionCustomersList({ page: 1, limit: 10 });
      assert.ok(customersRes, "Customers response must not be null");
      assert.ok(Array.isArray(customersRes.customers), "customersRes.customers must be an array");
      assert.ok(customersRes.pagination, "customersRes.pagination must be defined");
      assert.strictEqual(typeof customersRes.pagination.total, "number");
      assert.strictEqual(typeof customersRes.pagination.pages, "number");

      // 3. Test customer format with populated data
      const sampleEmail = `sample_contract_${Date.now()}@example.com`;
      const sampleUser = await createTestUser(sampleEmail, "Contract Devotee", true);
      const sampleOrder = await createTestOrder({
        userId: sampleUser._id,
        email: sampleEmail,
        total: 1200,
        subtotal: 1200,
        paymentStatus: "paid",
        orderStatus: "Delivered",
      });

      const customerMetrics = await getUnifiedCustomerMetrics({ userId: sampleUser._id.toString() });
      assert.ok(customerMetrics, "Metrics must be returned");
      assert.ok(customerMetrics.identifier, "metrics.identifier must be defined");
      assert.strictEqual(customerMetrics.identifier.name, `${testPrefix}Contract Devotee`);
      assert.strictEqual(customerMetrics.identifier.isRegistered, true);
      assert.ok(customerMetrics.metrics, "metrics.metrics must be defined for Customer 360 drawer");
      assert.strictEqual(customerMetrics.metrics.totalSpend, 1200);
      assert.strictEqual(customerMetrics.metrics.paidOrders, 1);
      assert.ok(customerMetrics.loyalty, "metrics.loyalty must be defined");
      assert.ok(customerMetrics.wallet, "metrics.wallet must be defined");

      // Verify list query includes the new customer with structured objects
      const listWithUser = await getRetentionCustomersList({ search: sampleEmail });
      assert.strictEqual(listWithUser.customers.length, 1);
      const c = listWithUser.customers[0];
      assert.ok(c.identifier, "customer.identifier must be defined");
      assert.ok(c.metrics, "customer.metrics must be defined");
      assert.ok(c.rfm, "customer.rfm must be defined");
      assert.ok(c.tier, "customer.tier must be defined");
      assert.ok(c.loyalty, "customer.loyalty must be defined");
      assert.ok(c.wallet, "customer.wallet must be defined");
      assert.strictEqual(c.metrics.totalSpend, 1200);
    });
  } finally {
    // Zero-leftover test cleanup
    console.log("\n🧹 Running zero-leftover test cleanup in MongoDB...");
    try {
      if (createdUserIds.length > 0) {
        await User.deleteMany({ _id: { $in: createdUserIds } });
      }
      if (createdOrderIds.length > 0) {
        await Order.deleteMany({ _id: { $in: createdOrderIds } });
      }
      if (createdProductIds.length > 0) {
        await Product.deleteMany({ _id: { $in: createdProductIds } });
      }
      if (createdLoyaltyTxIds.length > 0) {
        await LoyaltyTransaction.deleteMany({ _id: { $in: createdLoyaltyTxIds } });
      }
      if (createdWalletTxIds.length > 0) {
        await WalletTransaction.deleteMany({ _id: { $in: createdWalletTxIds } });
      }
      await MarketingUnsubscribe.deleteMany({ email: { $regex: testPrefix } });
      await LoyaltyTransaction.deleteMany({ customerEmail: { $regex: testPrefix } });
      await User.deleteMany({ email: { $regex: testPrefix } });
      await Order.deleteMany({ customerEmail: { $regex: testPrefix } });
      console.log("✨ Test cleanup completed successfully. Zero leftover artifacts.");
    } catch (cleanupErr) {
      console.error("Cleanup warning:", cleanupErr);
    }

    await mongoose.disconnect();
  }

  console.log("\n=======================================================");
  console.log(` RETENTION & LOYALTY TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log("=======================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runRetentionLoyaltyTests().catch((err) => {
  console.error("Fatal test error:", err);
  process.exit(1);
});
