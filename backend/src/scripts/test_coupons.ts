import "dotenv/config";
import assert from "node:assert";
import mongoose from "mongoose";
import crypto from "crypto";
import { connectDB } from "../config/db";
import { Coupon, ICoupon } from "../models/Coupon";
import { CouponRedemption } from "../models/CouponRedemption";
import { Order } from "../models/Order";
import { Product } from "../models/Product";
import { CheckoutSession } from "../models/CheckoutSession";
import { DailyAnalytics, recordDailyOrder, getIstDateStr } from "../models/DailyAnalytics";
import {
  validateAndCalculateCoupon,
  reserveCouponUsage,
  restoreCouponRedemption,
} from "../services/coupon.service";
import { cancelOrderAtomically } from "../services/cancellation.service";
import { generateInvoicePDF } from "../utils/invoice";

async function runCouponTests() {
  console.log("\n=======================================================");
  console.log(" COUPONS & PROMOTIONS COMPREHENSIVE VERIFICATION SUITE");
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

  const createdCouponIds: mongoose.Types.ObjectId[] = [];
  const createdOrderIds: mongoose.Types.ObjectId[] = [];
  const createdProductIds: mongoose.Types.ObjectId[] = [];
  const createdSessionIds: string[] = [];

  // Helper to create test products
  const createTestProduct = async (name: string, price: number, gstRate: number = 0, category: string = "Tulsi Mala") => {
    const prod = await Product.create({
      name: `${testPrefix}${name}`,
      description: "Test Product",
      price,
      mrp: price + 50,
      costPrice: price * 0.5,
      stock: 100,
      images: ["https://example.com/test.jpg"],
      category,
      hsnCode: "7117",
      gstRate,
      status: "active",
      tags: ["test"],
    });
    createdProductIds.push(prod._id);
    return prod;
  };

  try {
    // -----------------------------------------------------------------
    // TEST A: Percentage discount with no cap
    // -----------------------------------------------------------------
    await test("Test A: Percentage discount with no cap (10% on ₹1,000 = ₹100 discount)", async () => {
      const prod = await createTestProduct("A_Prod", 500);
      const coupon = await Coupon.create({
        code: `${testPrefix}PERC10`,
        discountType: "percentage",
        discountValue: 10,
        minOrderValue: 0,
        isActive: true,
      });
      createdCouponIds.push(coupon._id);

      const res = await validateAndCalculateCoupon({
        code: coupon.code,
        items: [{ productId: prod._id.toString(), qty: 2 }], // 500 * 2 = 1000
      });

      assert.strictEqual(res.valid, true);
      assert.strictEqual(res.discount, 100);
      assert.strictEqual(res.freeShipping, false);
      assert.strictEqual(res.lineItemDiscounts.get(prod._id.toString()), 100);
    });

    // -----------------------------------------------------------------
    // TEST B: Percentage discount with cap
    // -----------------------------------------------------------------
    await test("Test B: Percentage discount with cap (20% on ₹1,000 with ₹150 cap = ₹150)", async () => {
      const prod = await createTestProduct("B_Prod", 500);
      const coupon = await Coupon.create({
        code: `${testPrefix}PERC20_CAP`,
        discountType: "percentage",
        discountValue: 20, // 20% of 1000 = 200
        maxDiscountAmount: 150, // Capped at 150
        minOrderValue: 0,
        isActive: true,
      });
      createdCouponIds.push(coupon._id);

      const res = await validateAndCalculateCoupon({
        code: coupon.code,
        items: [{ productId: prod._id.toString(), qty: 2 }],
      });

      assert.strictEqual(res.valid, true);
      assert.strictEqual(res.discount, 150);
      assert.strictEqual(res.lineItemDiscounts.get(prod._id.toString()), 150);
    });

    // -----------------------------------------------------------------
    // TEST C: Flat discount
    // -----------------------------------------------------------------
    await test("Test C: Flat discount (₹150 flat on ₹1,000 = ₹150; capped at subtotal if higher)", async () => {
      const prod = await createTestProduct("C_Prod", 500);
      const coupon = await Coupon.create({
        code: `${testPrefix}FLAT150`,
        discountType: "flat",
        discountValue: 150,
        minOrderValue: 0,
        isActive: true,
      });
      createdCouponIds.push(coupon._id);

      const res = await validateAndCalculateCoupon({
        code: coupon.code,
        items: [{ productId: prod._id.toString(), qty: 2 }],
      });

      assert.strictEqual(res.valid, true);
      assert.strictEqual(res.discount, 150);

      // Edge case: flat discount exceeds cart subtotal
      const couponBig = await Coupon.create({
        code: `${testPrefix}FLAT2000`,
        discountType: "flat",
        discountValue: 2000,
        minOrderValue: 0,
        isActive: true,
      });
      createdCouponIds.push(couponBig._id);

      const resBig = await validateAndCalculateCoupon({
        code: couponBig.code,
        items: [{ productId: prod._id.toString(), qty: 1 }], // subtotal = 500
      });
      assert.strictEqual(resBig.valid, true);
      assert.strictEqual(resBig.discount, 500, "Discount must never exceed eligible subtotal");
    });

    // -----------------------------------------------------------------
    // TEST D: Free shipping coupon
    // -----------------------------------------------------------------
    await test("Test D: Free shipping coupon grants freeShipping=true regardless of subtotal", async () => {
      const prod = await createTestProduct("D_Prod", 150); // Under standard ₹299 threshold
      const coupon = await Coupon.create({
        code: `${testPrefix}FREESHIP`,
        discountType: "free_shipping",
        discountValue: 0,
        minOrderValue: 0,
        isActive: true,
      });
      createdCouponIds.push(coupon._id);

      const res = await validateAndCalculateCoupon({
        code: coupon.code,
        items: [{ productId: prod._id.toString(), qty: 1 }], // Subtotal 150
      });

      assert.strictEqual(res.valid, true);
      assert.strictEqual(res.discount, 0);
      assert.strictEqual(res.freeShipping, true);
    });

    // -----------------------------------------------------------------
    // TEST E: Minimum order value met vs unmet
    // -----------------------------------------------------------------
    await test("Test E: Minimum order value (MOV) requirement met vs unmet", async () => {
      const prod = await createTestProduct("E_Prod", 200);
      const coupon = await Coupon.create({
        code: `${testPrefix}MOV500`,
        discountType: "flat",
        discountValue: 50,
        minOrderValue: 500,
        isActive: true,
      });
      createdCouponIds.push(coupon._id);

      // Unmet: 200 * 2 = 400 < 500
      const resUnmet = await validateAndCalculateCoupon({
        code: coupon.code,
        items: [{ productId: prod._id.toString(), qty: 2 }],
      });
      assert.strictEqual(resUnmet.valid, false);
      assert.ok(resUnmet.error?.toLowerCase().includes("minimum order value"));

      // Met: 200 * 3 = 600 >= 500
      const resMet = await validateAndCalculateCoupon({
        code: coupon.code,
        items: [{ productId: prod._id.toString(), qty: 3 }],
      });
      assert.strictEqual(resMet.valid, true);
      assert.strictEqual(resMet.discount, 50);
    });

    // -----------------------------------------------------------------
    // TEST F: Gross subtotal used for free shipping threshold vs coupon discount
    // -----------------------------------------------------------------
    await test("Test F: Gross subtotal preserves free shipping threshold even when coupon reduces net below ₹299", async () => {
      const prod = await createTestProduct("F_Prod", 350); // Gross ₹350 >= ₹299 standard threshold
      const coupon = await Coupon.create({
        code: `${testPrefix}FLAT100`,
        discountType: "flat",
        discountValue: 100, // Net becomes 350 - 100 = 250
        minOrderValue: 0,
        isActive: true,
      });
      createdCouponIds.push(coupon._id);

      const res = await validateAndCalculateCoupon({
        code: coupon.code,
        items: [{ productId: prod._id.toString(), qty: 1 }],
      });

      assert.strictEqual(res.valid, true);
      assert.strictEqual(res.grossSubtotal, 350);
      assert.strictEqual(res.discount, 100);

      // Standard free shipping threshold is ₹299. Gross 350 >= 299 => shipping is 0
      const shippingFee = 60;
      const freeShipThreshold = 299;
      const finalShipping = res.freeShipping || res.grossSubtotal >= freeShipThreshold ? 0 : shippingFee;
      assert.strictEqual(finalShipping, 0, "Shipping must remain free because gross subtotal was ₹350");
      const finalPayable = Math.max(0, res.grossSubtotal - res.discount + finalShipping);
      assert.strictEqual(finalPayable, 250);
    });

    // -----------------------------------------------------------------
    // TEST G: Line-item eligibility: applicable product IDs
    // -----------------------------------------------------------------
    await test("Test G: Applicable product IDs restrict discount to targeted products only", async () => {
      const prodA = await createTestProduct("G_Targeted", 400);
      const prodB = await createTestProduct("G_Ineligible", 600);

      const coupon = await Coupon.create({
        code: `${testPrefix}PROD_TARGET`,
        discountType: "percentage",
        discountValue: 10,
        applicableProductIds: [prodA._id],
        minOrderValue: 0,
        isActive: true,
      });
      createdCouponIds.push(coupon._id);

      const res = await validateAndCalculateCoupon({
        code: coupon.code,
        items: [
          { productId: prodA._id.toString(), qty: 1 },
          { productId: prodB._id.toString(), qty: 1 },
        ],
      });

      assert.strictEqual(res.valid, true);
      assert.strictEqual(res.eligibleSubtotal, 400);
      assert.strictEqual(res.discount, 40); // 10% of 400
      assert.strictEqual(res.lineItemDiscounts.get(prodA._id.toString()), 40);
      assert.strictEqual(res.lineItemDiscounts.get(prodB._id.toString()), 0);
    });

    // -----------------------------------------------------------------
    // TEST H: Line-item eligibility: applicable category IDs
    // -----------------------------------------------------------------
    await test("Test H: Applicable category IDs restrict discount to targeted categories only", async () => {
      const catTulsi = "Tulsi Mala";
      const catDress = "Deity Dress";
      const prodTulsi = await createTestProduct("H_Tulsi", 500, 0, catTulsi);
      const prodDress = await createTestProduct("H_Dress", 500, 0, catDress);

      const coupon = await Coupon.create({
        code: `${testPrefix}CAT_TARGET`,
        discountType: "percentage",
        discountValue: 20,
        applicableCategoryIds: [catTulsi],
        minOrderValue: 0,
        isActive: true,
      });
      createdCouponIds.push(coupon._id);

      const res = await validateAndCalculateCoupon({
        code: coupon.code,
        items: [
          { productId: prodTulsi._id.toString(), qty: 1 },
          { productId: prodDress._id.toString(), qty: 1 },
        ],
      });

      assert.strictEqual(res.valid, true);
      assert.strictEqual(res.eligibleSubtotal, 500);
      assert.strictEqual(res.discount, 100); // 20% of 500
      assert.strictEqual(res.lineItemDiscounts.get(prodTulsi._id.toString()), 100);
      assert.strictEqual(res.lineItemDiscounts.get(prodDress._id.toString()), 0);
    });

    // -----------------------------------------------------------------
    // TEST I: Mixed cart: only eligible items get discounted
    // -----------------------------------------------------------------
    await test("Test I: Mixed cart eligibility where non-matching items are skipped", async () => {
      const prod1 = await createTestProduct("I_Prod1", 300, 0, "Idols");
      const prod2 = await createTestProduct("I_Prod2", 200, 0, "Books");

      const coupon = await Coupon.create({
        code: `${testPrefix}MIXED`,
        discountType: "flat",
        discountValue: 100,
        applicableCategoryIds: ["Idols"],
        minOrderValue: 0,
        isActive: true,
      });
      createdCouponIds.push(coupon._id);

      const res = await validateAndCalculateCoupon({
        code: coupon.code,
        items: [
          { productId: prod1._id.toString(), qty: 1 },
          { productId: prod2._id.toString(), qty: 1 },
        ],
      });

      assert.strictEqual(res.valid, true);
      assert.strictEqual(res.eligibleSubtotal, 300);
      assert.strictEqual(res.discount, 100);
      assert.strictEqual(res.lineItemDiscounts.get(prod1._id.toString()), 100);
      assert.strictEqual(res.lineItemDiscounts.get(prod2._id.toString()), 0);
    });

    // -----------------------------------------------------------------
    // TEST J: Discount apportionment across eligible items
    // -----------------------------------------------------------------
    await test("Test J: Proportionate discount apportionment across multiple eligible items", async () => {
      const prodA = await createTestProduct("J_ProdA", 300);
      const prodB = await createTestProduct("J_ProdB", 600);

      const coupon = await Coupon.create({
        code: `${testPrefix}APPORTION`,
        discountType: "flat",
        discountValue: 90,
        minOrderValue: 0,
        isActive: true,
      });
      createdCouponIds.push(coupon._id);

      const res = await validateAndCalculateCoupon({
        code: coupon.code,
        items: [
          { productId: prodA._id.toString(), qty: 1 }, // 300
          { productId: prodB._id.toString(), qty: 1 }, // 600
        ],
      });

      assert.strictEqual(res.valid, true);
      assert.strictEqual(res.discount, 90);
      const discA = res.lineItemDiscounts.get(prodA._id.toString()) || 0;
      const discB = res.lineItemDiscounts.get(prodB._id.toString()) || 0;
      // 300/900 * 90 = 30; 600/900 * 90 = 60
      assert.strictEqual(discA, 30);
      assert.strictEqual(discB, 60);
      assert.strictEqual(discA + discB, 90);
    });

    // -----------------------------------------------------------------
    // TEST K: GST apportionment: taxable value and tax sum correctly
    // -----------------------------------------------------------------
    await test("Test K: GST apportionment reconciles taxableAmount + gstAmount = discounted gross", async () => {
      // 18% GST product priced at ₹118 gross (inclusive of 18% tax)
      const prod = await createTestProduct("K_GSTProd", 118, 18);
      const coupon = await Coupon.create({
        code: `${testPrefix}GST_DISC`,
        discountType: "flat",
        discountValue: 18,
        minOrderValue: 0,
        isActive: true,
      });
      createdCouponIds.push(coupon._id);

      const res = await validateAndCalculateCoupon({
        code: coupon.code,
        items: [{ productId: prod._id.toString(), qty: 1 }],
      });

      assert.strictEqual(res.valid, true);
      assert.strictEqual(res.discount, 18);

      // Verify line item calculation
      const lineDisc = res.lineItemDiscounts.get(prod._id.toString()) || 0;
      const lineGross = 118 - lineDisc; // 100
      const rate = 18;
      const taxableAmount = Math.round((lineGross / (1 + rate / 100)) * 100) / 100;
      const gstAmount = Math.round((lineGross - taxableAmount) * 100) / 100;

      assert.strictEqual(taxableAmount, 84.75);
      assert.strictEqual(gstAmount, 15.25);
      assert.strictEqual(Math.round((taxableAmount + gstAmount) * 100) / 100, 100);
    });

    // -----------------------------------------------------------------
    // TEST L: Single coupon per order rule
    // -----------------------------------------------------------------
    await test("Test L: Engine validates exactly one coupon at a time", async () => {
      const prod = await createTestProduct("L_Prod", 500);
      const coupon = await Coupon.create({
        code: `${testPrefix}SINGLE`,
        discountType: "flat",
        discountValue: 50,
        minOrderValue: 0,
        isActive: true,
      });
      createdCouponIds.push(coupon._id);

      const res = await validateAndCalculateCoupon({
        code: coupon.code,
        items: [{ productId: prod._id.toString(), qty: 1 }],
      });
      assert.strictEqual(res.valid, true);
      assert.strictEqual(res.coupon?.code, coupon.code);
    });

    // -----------------------------------------------------------------
    // TEST M: Invalid / nonexistent coupon code
    // -----------------------------------------------------------------
    await test("Test M: Nonexistent coupon code returns clear error", async () => {
      const prod = await createTestProduct("M_Prod", 500);
      const res = await validateAndCalculateCoupon({
        code: "NONEXISTENT_CODE_XYZ_999",
        items: [{ productId: prod._id.toString(), qty: 1 }],
      });
      assert.strictEqual(res.valid, false);
      assert.ok(res.error?.toLowerCase().includes("invalid"));
    });

    // -----------------------------------------------------------------
    // TEST N: Inactive coupon code
    // -----------------------------------------------------------------
    await test("Test N: Inactive coupon code is rejected", async () => {
      const prod = await createTestProduct("N_Prod", 500);
      const coupon = await Coupon.create({
        code: `${testPrefix}INACTIVE`,
        discountType: "percentage",
        discountValue: 10,
        minOrderValue: 0,
        isActive: false, // Inactive
      });
      createdCouponIds.push(coupon._id);

      const res = await validateAndCalculateCoupon({
        code: coupon.code,
        items: [{ productId: prod._id.toString(), qty: 1 }],
      });
      assert.strictEqual(res.valid, false);
      assert.ok(res.error?.toLowerCase().includes("disabled") || res.error?.toLowerCase().includes("inactive"));
    });

    // -----------------------------------------------------------------
    // TEST O: Expired coupon code
    // -----------------------------------------------------------------
    await test("Test O: Expired coupon code is rejected", async () => {
      const prod = await createTestProduct("O_Prod", 500);
      const coupon = await Coupon.create({
        code: `${testPrefix}EXPIRED`,
        discountType: "percentage",
        discountValue: 10,
        minOrderValue: 0,
        isActive: true,
        expiryDate: new Date(Date.now() - 24 * 60 * 60 * 1000), // Yesterday
      });
      createdCouponIds.push(coupon._id);

      const res = await validateAndCalculateCoupon({
        code: coupon.code,
        items: [{ productId: prod._id.toString(), qty: 1 }],
      });
      assert.strictEqual(res.valid, false);
      assert.ok(res.error?.toLowerCase().includes("expired"));
    });

    // -----------------------------------------------------------------
    // TEST P: Future coupon code (not yet started)
    // -----------------------------------------------------------------
    await test("Test P: Future coupon code is rejected before start date", async () => {
      const prod = await createTestProduct("P_Prod", 500);
      const coupon = await Coupon.create({
        code: `${testPrefix}FUTURE`,
        discountType: "percentage",
        discountValue: 10,
        minOrderValue: 0,
        isActive: true,
        startDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
      });
      createdCouponIds.push(coupon._id);

      const res = await validateAndCalculateCoupon({
        code: coupon.code,
        items: [{ productId: prod._id.toString(), qty: 1 }],
      });
      assert.strictEqual(res.valid, false);
      assert.ok(res.error?.toLowerCase().includes("not yet active") || res.error?.toLowerCase().includes("not active"));
    });

    // -----------------------------------------------------------------
    // TEST Q: Total usage limit enforcement (first-come)
    // -----------------------------------------------------------------
    await test("Test Q: Total usage limit reached blocks subsequent applications", async () => {
      const prod = await createTestProduct("Q_Prod", 500);
      const coupon = await Coupon.create({
        code: `${testPrefix}MAXUSES`,
        discountType: "flat",
        discountValue: 50,
        minOrderValue: 0,
        usageLimitTotal: 2,
        usedCount: 2, // Reached limit
        isActive: true,
      });
      createdCouponIds.push(coupon._id);

      const res = await validateAndCalculateCoupon({
        code: coupon.code,
        items: [{ productId: prod._id.toString(), qty: 1 }],
      });
      assert.strictEqual(res.valid, false);
      assert.ok(res.error?.toLowerCase().includes("usage limit"));
    });

    // -----------------------------------------------------------------
    // TEST R: Per-user usage limit enforcement
    // -----------------------------------------------------------------
    await test("Test R: Per-user usage limit blocks repeat redemptions by user", async () => {
      const prod = await createTestProduct("R_Prod", 500);
      const coupon = await Coupon.create({
        code: `${testPrefix}PERUSER`,
        discountType: "flat",
        discountValue: 50,
        minOrderValue: 0,
        usageLimitPerUser: 1,
        isActive: true,
      });
      createdCouponIds.push(coupon._id);

      const testUserEmail = `devotee_${runId}@example.com`;

      // Pre-record 1 redemption
      const dummyOrder = await Order.create({
        total: 450,
        subtotal: 500,
        shipping: 0,
        discount: 50,
        couponCode: coupon.code,
        couponId: coupon._id,
        items: [{ productId: prod._id, qty: 1, price: 500 }],
        payment: { method: "cod", status: "pending" },
        status: "Placed",
        address: { name: "Test User", phone: "9876543210", email: testUserEmail, line1: "Test Line", city: "Mathura", state: "Uttar Pradesh", pincode: "281001" },
      });
      createdOrderIds.push(dummyOrder._id);

      await CouponRedemption.create({
        couponId: coupon._id,
        couponCode: coupon.code,
        orderId: dummyOrder._id,
        customerEmail: testUserEmail,
        discountAmount: 50,
        status: "active",
      });

      // Same email should be blocked
      const resBlocked = await validateAndCalculateCoupon({
        code: coupon.code,
        items: [{ productId: prod._id.toString(), qty: 1 }],
        customerEmail: testUserEmail,
      });
      assert.strictEqual(resBlocked.valid, false);
      assert.ok(resBlocked.error?.toLowerCase().includes("already used") || resBlocked.error?.toLowerCase().includes("maximum allowed"));

      // Different email should succeed
      const resAllowed = await validateAndCalculateCoupon({
        code: coupon.code,
        items: [{ productId: prod._id.toString(), qty: 1 }],
        customerEmail: "another_devotee@example.com",
      });
      assert.strictEqual(resAllowed.valid, true);
    });

    // -----------------------------------------------------------------
    // TEST S: Guest checkout per-user limit enforcement (by email / phone)
    // -----------------------------------------------------------------
    await test("Test S: Guest checkout per-user limit enforced by phone number", async () => {
      const prod = await createTestProduct("S_Prod", 500);
      const coupon = await Coupon.create({
        code: `${testPrefix}PHONE_LIMIT`,
        discountType: "flat",
        discountValue: 50,
        minOrderValue: 0,
        usageLimitPerUser: 1,
        isActive: true,
      });
      createdCouponIds.push(coupon._id);

      const testPhone = "7500533505";
      const dummyOrder = await Order.create({
        total: 450,
        subtotal: 500,
        shipping: 0,
        discount: 50,
        couponCode: coupon.code,
        couponId: coupon._id,
        items: [{ productId: prod._id, qty: 1, price: 500 }],
        payment: { method: "cod", status: "pending" },
        status: "Placed",
        address: { name: "Guest User", phone: testPhone, line1: "Test Line", city: "Vrindavan", state: "Uttar Pradesh", pincode: "281121" },
      });
      createdOrderIds.push(dummyOrder._id);

      await CouponRedemption.create({
        couponId: coupon._id,
        couponCode: coupon.code,
        orderId: dummyOrder._id,
        customerPhone: testPhone,
        discountAmount: 50,
        status: "active",
      });

      const resBlocked = await validateAndCalculateCoupon({
        code: coupon.code,
        items: [{ productId: prod._id.toString(), qty: 1 }],
        customerPhone: testPhone,
      });
      assert.strictEqual(resBlocked.valid, false);
      assert.ok(resBlocked.error?.toLowerCase().includes("already used") || resBlocked.error?.toLowerCase().includes("maximum allowed"));
    });

    // -----------------------------------------------------------------
    // TEST T: Concurrent usage race condition test
    // -----------------------------------------------------------------
    await test("Test T: Atomic concurrency race condition: exactly 1 wins on limit=1", async () => {
      const coupon = await Coupon.create({
        code: `${testPrefix}RACE`,
        discountType: "flat",
        discountValue: 100,
        usageLimitTotal: 1,
        usedCount: 0,
        isActive: true,
      });
      createdCouponIds.push(coupon._id);

      // Create 5 dummy orders
      const dummyOrders = await Promise.all(
        [1, 2, 3, 4, 5].map((i) =>
          Order.create({
            total: 400,
            subtotal: 500,
            shipping: 0,
            items: [],
            payment: { method: "cod", status: "pending" },
            status: "Placed",
            address: { name: `Racer ${i}`, phone: `987654321${i}`, line1: "Test", city: "Vrindavan", state: "Uttar Pradesh", pincode: "281121" },
          })
        )
      );
      dummyOrders.forEach((o) => createdOrderIds.push(o._id));

      // Attempt 5 concurrent reserves
      const results = await Promise.allSettled(
        dummyOrders.map((o, idx) =>
          reserveCouponUsage({
            couponId: coupon._id,
            coupon,
            orderId: o._id,
            discountAmount: 100,
            customerEmail: `racer${idx}@example.com`,
          })
        )
      );

      const successes = results.filter((r) => r.status === "fulfilled" && (r as any).value?.success);
      const rejections = results.filter((r) => r.status === "rejected" || !(r as any).value?.success);

      assert.strictEqual(successes.length, 1, "Exactly 1 order must claim the single remaining usage");
      assert.strictEqual(rejections.length, 4, "Remaining 4 concurrent attempts must fail atomically");

      const refreshed = await Coupon.findById(coupon._id);
      assert.strictEqual(refreshed?.usedCount, 1, "Coupon usedCount must be exactly 1");
    });

    // -----------------------------------------------------------------
    // TEST U: Order placement with coupon snapshot persistence
    // -----------------------------------------------------------------
    await test("Test U: Order stores coupon snapshot (code, type, value, discount) and line item discountAmount", async () => {
      const prod = await createTestProduct("U_Prod", 500);
      const coupon = await Coupon.create({
        code: `${testPrefix}SNAPSHOT`,
        discountType: "percentage",
        discountValue: 15,
        minOrderValue: 0,
        isActive: true,
      });
      createdCouponIds.push(coupon._id);

      const val = await validateAndCalculateCoupon({
        code: coupon.code,
        items: [{ productId: prod._id.toString(), qty: 2 }], // 1000 -> 15% = 150
      });

      assert.strictEqual(val.valid, true);

      const order = await Order.create({
        total: 850,
        subtotal: 1000,
        shipping: 0,
        discount: val.discount,
        couponCode: val.coupon?.code,
        couponId: val.coupon?.id,
        couponDiscountType: val.coupon?.discountType,
        couponDiscountValue: val.coupon?.discountValue,
        items: [
          {
            productId: prod._id,
            qty: 2,
            price: 500,
            discountAmount: val.lineItemDiscounts?.get(prod._id.toString()) || 0,
          },
        ],
        payment: { method: "cod", status: "pending" },
        status: "Placed",
        address: { name: "Snapshot Devotee", phone: "9876543210", line1: "Test", city: "Vrindavan", state: "Uttar Pradesh", pincode: "281121" },
      });
      createdOrderIds.push(order._id);

      const saved = await Order.findById(order._id);
      assert.strictEqual(saved?.couponCode, `${testPrefix}SNAPSHOT`.toUpperCase());
      assert.strictEqual(saved?.discount, 150);
      assert.strictEqual(saved?.couponDiscountType, "percentage");
      assert.strictEqual(saved?.couponDiscountValue, 15);
      assert.strictEqual(saved?.items[0]?.discountAmount, 150);
    });

    // -----------------------------------------------------------------
    // TEST V: Order cancellation restores coupon usage exactly once
    // -----------------------------------------------------------------
    await test("Test V: Order cancellation restores coupon usage and marks redemption restored", async () => {
      const prod = await createTestProduct("V_Prod", 500);
      const coupon = await Coupon.create({
        code: `${testPrefix}RESTORE`,
        discountType: "flat",
        discountValue: 100,
        usageLimitTotal: 10,
        usedCount: 5,
        isActive: true,
      });
      createdCouponIds.push(coupon._id);

      const order = await Order.create({
        total: 400,
        subtotal: 500,
        shipping: 0,
        discount: 100,
        couponCode: coupon.code,
        couponId: coupon._id,
        items: [{ productId: prod._id, qty: 1, price: 500, discountAmount: 100 }],
        payment: { method: "cod", status: "pending" },
        status: "Placed",
        address: { name: "Cancel Devotee", phone: "9876543210", email: `cancel_${runId}@example.com`, line1: "Test", city: "Vrindavan", state: "Uttar Pradesh", pincode: "281121" },
      });
      createdOrderIds.push(order._id);

      const redemption = await CouponRedemption.create({
        couponId: coupon._id,
        couponCode: coupon.code,
        orderId: order._id,
        customerEmail: `cancel_${runId}@example.com`,
        discountAmount: 100,
        status: "active",
      });

      // Cancel order atomically
      const cancelRes = await cancelOrderAtomically({
        orderId: order._id.toString(),
        cancelledBy: "customer",
        cancellationReason: "Customer changed mind",
      });

      assert.strictEqual(cancelRes.success, true);
      assert.strictEqual(cancelRes.order.status, "Cancelled");

      // Verify coupon usedCount was decremented
      const refreshedCoupon = await Coupon.findById(coupon._id);
      assert.strictEqual(refreshedCoupon?.usedCount, 4, "usedCount should be decremented from 5 to 4");

      // Verify redemption status is "restored"
      const refreshedRedemption = await CouponRedemption.findById(redemption._id);
      assert.strictEqual(refreshedRedemption?.status, "restored");
    });

    // -----------------------------------------------------------------
    // TEST W: Repeat cancellation does not duplicate restoration
    // -----------------------------------------------------------------
    await test("Test W: Duplicate restoration attempt is idempotent and does not restore again", async () => {
      const coupon = await Coupon.create({
        code: `${testPrefix}NOREPEAT`,
        discountType: "flat",
        discountValue: 50,
        usageLimitTotal: 10,
        usedCount: 3,
        isActive: true,
      });
      createdCouponIds.push(coupon._id);

      const dummyOrderId = new mongoose.Types.ObjectId();
      createdOrderIds.push(dummyOrderId);

      await CouponRedemption.create({
        couponId: coupon._id,
        couponCode: coupon.code,
        orderId: dummyOrderId,
        status: "active",
        discountAmount: 50,
      });

      // First restore
      const res1 = await restoreCouponRedemption(dummyOrderId);
      assert.strictEqual(res1, true);

      // Verify usedCount
      let c = await Coupon.findById(coupon._id);
      assert.strictEqual(c?.usedCount, 2);

      // Second restore attempt
      const res2 = await restoreCouponRedemption(dummyOrderId);
      assert.strictEqual(res2, false, "Second restore attempt must be rejected");

      // Verify usedCount unchanged
      c = await Coupon.findById(coupon._id);
      assert.strictEqual(c?.usedCount, 2, "usedCount must not decrement again");
    });

    // -----------------------------------------------------------------
    // TEST X: Invoice rendering with discount and coupon fields
    // -----------------------------------------------------------------
    await test("Test X: PDF Invoice renders discount row and coupon code without errors", async () => {
      const prod = await createTestProduct("X_Prod", 500, 18);
      const invoiceData = {
        orderId: "5099",
        orderDate: new Date(),
        customerName: "Radha Devotee",
        customerPhone: "9876543210",
        customerEmail: "radha@example.com",
        shippingAddress: {
          line1: "Near ISKCON Temple",
          city: "Vrindavan",
          state: "Uttar Pradesh",
          pincode: "281121",
        },
        items: [
          {
            name: "Pure Sacred Idol",
            hsnCode: "7117",
            qty: 1,
            unitPrice: 500,
            grossAmount: 450, // Discounted gross
            taxableAmount: 381.36,
            gstRate: 18,
            cgstAmount: 34.32,
            sgstAmount: 34.32,
            igstAmount: 0,
            totalAmount: 450,
          },
        ],
        subtotal: 500,
        shipping: 0,
        discount: 50,
        couponCode: "FESTIVE50",
        total: 450,
        paymentMethod: "Online (Razorpay)",
        paymentStatus: "PAID",
      };

      const buffer = await generateInvoicePDF(invoiceData as any);
      assert.ok(buffer && buffer.length > 500, "Invoice PDF buffer must be non-empty");
      // Check PDF header
      assert.strictEqual(buffer.slice(0, 4).toString(), "%PDF");
    });

    // -----------------------------------------------------------------
    // TEST Y: Abandoned-cart capture and recovery with coupon
    // -----------------------------------------------------------------
    await test("Test Y: CheckoutSession captures coupon and validates on recovery", async () => {
      const prod = await createTestProduct("Y_Prod", 600);
      const coupon = await Coupon.create({
        code: `${testPrefix}CART_REC`,
        discountType: "flat",
        discountValue: 100,
        minOrderValue: 0,
        isActive: true,
      });
      createdCouponIds.push(coupon._id);

      const sessionToken = `token_${runId}`;
      const session = await CheckoutSession.create({
        sessionId: `sess_${runId}`,
        recoveryToken: sessionToken,
        email: `cart_${runId}@example.com`,
        phone: "9876543210",
        items: [{ productId: prod._id, name: prod.name, price: prod.price, qty: 1 }],
        couponCode: coupon.code,
        discount: 100,
        subtotal: 600,
        shipping: 0,
        total: 500,
        recoveryStatus: "pending",
      });
      createdSessionIds.push(session.sessionId);

      const savedSession = await CheckoutSession.findOne({ recoveryToken: sessionToken });
      assert.strictEqual(savedSession?.couponCode, coupon.code);
      assert.strictEqual(savedSession?.discount, 100);

      // Verify coupon remains valid on recovery
      const val = await validateAndCalculateCoupon({
        code: savedSession!.couponCode!,
        items: [{ productId: prod._id.toString(), qty: 1 }],
      });
      assert.strictEqual(val.valid, true);
      assert.strictEqual(val.discount, 100);
    });

    // -----------------------------------------------------------------
    // TEST Z: Analytics tracking: couponRedemptions and couponDiscountTotal
    // -----------------------------------------------------------------
    await test("Test Z: DailyAnalytics records couponRedemptions and couponDiscountTotal", async () => {
      const testDate = new Date();
      const dateStr = getIstDateStr(testDate);

      // Record an order with coupon discount of 150
      await recordDailyOrder({
        createdAt: testDate,
        total: 850,
        payment: { method: "razorpay", status: "paid" },
        discount: 150,
        items: [],
      });

      const daily = await DailyAnalytics.findOne({ date: dateStr });
      assert.ok(daily, "DailyAnalytics record must exist");
      assert.ok((daily.couponRedemptions || 0) >= 1, "couponRedemptions must be incremented");
      assert.ok((daily.couponDiscountTotal || 0) >= 150, "couponDiscountTotal must track discount amount");
    });

    // -----------------------------------------------------------------
    // TEST AA: Client cannot manipulate discount (server authority)
    // -----------------------------------------------------------------
    await test("Test AA: Server recomputes discount strictly from DB product prices and coupon rule", async () => {
      const prod = await createTestProduct("AA_Prod", 500);
      const coupon = await Coupon.create({
        code: `${testPrefix}STRICT`,
        discountType: "percentage",
        discountValue: 10, // 10%
        minOrderValue: 0,
        isActive: true,
      });
      createdCouponIds.push(coupon._id);

      // Client sends item with real productId. Server fetches live price (500) and computes 10% = 50.
      const res = await validateAndCalculateCoupon({
        code: coupon.code,
        items: [{ productId: prod._id.toString(), qty: 1 }],
      });

      assert.strictEqual(res.discount, 50, "Server must compute discount strictly from DB product price");
      assert.notStrictEqual(res.discount, 400, "Client cannot force an arbitrary discount");
    });

    // -----------------------------------------------------------------
    // TEST AB: Zero-coupon orders behave identically to before
    // -----------------------------------------------------------------
    await test("Test AB: Orders without coupon produce 0 discount and standard shipping logic", async () => {
      const prod = await createTestProduct("AB_Prod", 250);

      // Subtotal 250 < 299 threshold -> standard shipping applies
      const grossSubtotal = prod.price * 1;
      const freeShipThreshold = 299;
      const shippingFee = 60;
      const shipping = grossSubtotal >= freeShipThreshold ? 0 : shippingFee;
      const total = grossSubtotal + shipping;

      assert.strictEqual(grossSubtotal, 250);
      assert.strictEqual(shipping, 60);
      assert.strictEqual(total, 310);

      const order = await Order.create({
        total,
        subtotal: grossSubtotal,
        shipping,
        discount: 0,
        items: [{ productId: prod._id, qty: 1, price: 250, discountAmount: 0 }],
        payment: { method: "cod", status: "pending" },
        status: "Placed",
        address: { name: "Zero Coupon Devotee", phone: "9876543210", line1: "Test", city: "Vrindavan", state: "Uttar Pradesh", pincode: "281121" },
      });
      createdOrderIds.push(order._id);

      const saved = await Order.findById(order._id);
      assert.strictEqual(saved?.discount, 0);
      assert.ok(!saved?.couponCode);
      assert.strictEqual(saved?.total, 310);
      assert.strictEqual(saved?.items[0]?.discountAmount, 0);
    });

    // -----------------------------------------------------------------
    // TEST AC: Online-only coupon + Razorpay => allowed
    // -----------------------------------------------------------------
    await test("Test AC: Online-only coupon + Razorpay => allowed", async () => {
      const prod = await createTestProduct("AC_Prod", 500);
      const coupon = await Coupon.create({
        code: `${testPrefix}ONLINE_ONLY`,
        discountType: "percentage",
        discountValue: 10,
        allowedPaymentMethods: "online",
        isActive: true,
      });
      createdCouponIds.push(coupon._id);

      const res = await validateAndCalculateCoupon({
        code: coupon.code,
        items: [{ productId: prod._id.toString(), qty: 1 }],
        paymentMethod: "razorpay",
      });

      assert.strictEqual(res.valid, true, "Online-only coupon must be allowed for razorpay");
      assert.strictEqual(res.discount, 50);
    });

    // -----------------------------------------------------------------
    // TEST AD: Online-only coupon + COD => rejected
    // -----------------------------------------------------------------
    await test("Test AD: Online-only coupon + COD => rejected", async () => {
      const prod = await createTestProduct("AD_Prod", 500);
      const coupon = await Coupon.create({
        code: `${testPrefix}ONLINE_NOCOD`,
        discountType: "percentage",
        discountValue: 10,
        allowedPaymentMethods: "online",
        isActive: true,
      });
      createdCouponIds.push(coupon._id);

      const res = await validateAndCalculateCoupon({
        code: coupon.code,
        items: [{ productId: prod._id.toString(), qty: 1 }],
        paymentMethod: "cod",
      });

      assert.strictEqual(res.valid, false, "Online-only coupon must be rejected for COD");
      assert.strictEqual(res.discount, 0);
      assert.ok(res.error?.includes("online prepaid"), "Error message should mention online prepaid requirement");
    });

    // -----------------------------------------------------------------
    // TEST AE: COD-only coupon + COD => allowed
    // -----------------------------------------------------------------
    await test("Test AE: COD-only coupon + COD => allowed", async () => {
      const prod = await createTestProduct("AE_Prod", 500);
      const coupon = await Coupon.create({
        code: `${testPrefix}COD_ONLY`,
        discountType: "percentage",
        discountValue: 10,
        allowedPaymentMethods: "cod",
        isActive: true,
      });
      createdCouponIds.push(coupon._id);

      const res = await validateAndCalculateCoupon({
        code: coupon.code,
        items: [{ productId: prod._id.toString(), qty: 1 }],
        paymentMethod: "cod",
      });

      assert.strictEqual(res.valid, true, "COD-only coupon must be allowed for COD");
      assert.strictEqual(res.discount, 50);
    });

    // -----------------------------------------------------------------
    // TEST AF: COD-only coupon + Razorpay => rejected
    // -----------------------------------------------------------------
    await test("Test AF: COD-only coupon + Razorpay => rejected", async () => {
      const prod = await createTestProduct("AF_Prod", 500);
      const coupon = await Coupon.create({
        code: `${testPrefix}COD_NORZP`,
        discountType: "percentage",
        discountValue: 10,
        allowedPaymentMethods: "cod",
        isActive: true,
      });
      createdCouponIds.push(coupon._id);

      const res = await validateAndCalculateCoupon({
        code: coupon.code,
        items: [{ productId: prod._id.toString(), qty: 1 }],
        paymentMethod: "razorpay",
      });

      assert.strictEqual(res.valid, false, "COD-only coupon must be rejected for Razorpay");
      assert.strictEqual(res.discount, 0);
      assert.ok(res.error?.includes("Cash on Delivery (COD)"), "Error message should mention COD requirement");
    });

    // -----------------------------------------------------------------
    // TEST AG: Both => allowed for both Razorpay and COD
    // -----------------------------------------------------------------
    await test("Test AG: Both => allowed for both Razorpay and COD", async () => {
      const prod = await createTestProduct("AG_Prod", 500);
      const coupon = await Coupon.create({
        code: `${testPrefix}BOTH_OK`,
        discountType: "percentage",
        discountValue: 10,
        allowedPaymentMethods: "both",
        isActive: true,
      });
      createdCouponIds.push(coupon._id);

      const resRzp = await validateAndCalculateCoupon({
        code: coupon.code,
        items: [{ productId: prod._id.toString(), qty: 1 }],
        paymentMethod: "razorpay",
      });
      assert.strictEqual(resRzp.valid, true, "allowedPaymentMethods=both must work for Razorpay");
      assert.strictEqual(resRzp.discount, 50);

      const resCod = await validateAndCalculateCoupon({
        code: coupon.code,
        items: [{ productId: prod._id.toString(), qty: 1 }],
        paymentMethod: "cod",
      });
      assert.strictEqual(resCod.valid, true, "allowedPaymentMethods=both must work for COD");
      assert.strictEqual(resCod.discount, 50);
    });

    // -----------------------------------------------------------------
    // TEST AH: Existing coupon with no payment-method field remains compatible as BOTH
    // -----------------------------------------------------------------
    await test("Test AH: Existing coupon with no payment-method field remains compatible as BOTH", async () => {
      const prod = await createTestProduct("AH_Prod", 500);
      // Simulate raw legacy document where allowedPaymentMethods was not set or unset
      const coupon = await Coupon.create({
        code: `${testPrefix}LEGACY_COMPAT`,
        discountType: "flat",
        discountValue: 50,
        isActive: true,
      });
      // Explicitly unset in MongoDB to simulate older pre-existing coupon documents
      await Coupon.collection.updateOne(
        { _id: coupon._id },
        { $unset: { allowedPaymentMethods: "" } }
      );
      createdCouponIds.push(coupon._id);

      // Should work for razorpay
      const resRzp = await validateAndCalculateCoupon({
        code: coupon.code,
        items: [{ productId: prod._id.toString(), qty: 1 }],
        paymentMethod: "razorpay",
      });
      assert.strictEqual(resRzp.valid, true, "Legacy coupon without allowedPaymentMethods must work for Razorpay");
      assert.strictEqual(resRzp.discount, 50);

      // Should work for cod
      const resCod = await validateAndCalculateCoupon({
        code: coupon.code,
        items: [{ productId: prod._id.toString(), qty: 1 }],
        paymentMethod: "cod",
      });
      assert.strictEqual(resCod.valid, true, "Legacy coupon without allowedPaymentMethods must work for COD");
      assert.strictEqual(resCod.discount, 50);
    });

    // -----------------------------------------------------------------
    // TEST AI: Coupon Deletion Safety: Historical coupons protected from hard deletion
    // -----------------------------------------------------------------
    await test("Test AI: Historical coupon deletion safety: coupons with redemptions are blocked from destructive deletion", async () => {
      const prod = await createTestProduct("AI_Prod", 500);
      const coupon = await Coupon.create({
        code: `${testPrefix}SAFE_DEL`,
        discountType: "percentage",
        discountValue: 15,
        isActive: true,
        usedCount: 1,
      });
      createdCouponIds.push(coupon._id);

      const order = await Order.create({
        total: 425,
        subtotal: 500,
        shipping: 0,
        discount: 75,
        couponCode: coupon.code,
        couponId: coupon._id,
        items: [{ productId: prod._id, qty: 1, price: 500, discountAmount: 75 }],
        payment: { method: "razorpay", status: "paid" },
        status: "Placed",
        address: { name: "Safe Delete Devotee", phone: "9876543210", line1: "Test", city: "Vrindavan", state: "Uttar Pradesh", pincode: "281121" },
      });
      createdOrderIds.push(order._id);

      const redemption = await CouponRedemption.create({
        couponId: coupon._id,
        couponCode: coupon.code,
        orderId: order._id,
        discountAmount: 75,
        status: "active",
      });

      // Simulate admin safe delete logic
      const targetCoupon = await Coupon.findById(coupon._id);
      assert.ok(targetCoupon, "Target coupon must exist");

      const redemptionCount = await CouponRedemption.countDocuments({ couponId: targetCoupon._id });
      const orderCount = await Order.countDocuments({
        $or: [{ couponId: targetCoupon._id }, { couponCode: targetCoupon.code }],
      });

      assert.ok(redemptionCount > 0, "Redemption records exist");
      assert.ok(orderCount > 0, "Referenced order exists");

      // Attempting deletion on historical coupon must NOT delete document from DB
      if (redemptionCount > 0 || targetCoupon.usedCount > 0 || orderCount > 0) {
        targetCoupon.isActive = false;
        await targetCoupon.save();
      } else {
        await Coupon.findByIdAndDelete(targetCoupon._id);
      }

      // Verify coupon document still exists in MongoDB and was deactivated
      const stillExistingCoupon = await Coupon.findById(coupon._id);
      assert.ok(stillExistingCoupon, "Historical coupon must NOT be hard deleted from database");
      assert.strictEqual(stillExistingCoupon?.isActive, false, "Historical coupon must be deactivated");

      // Verify redemption and order snapshots remain intact
      const stillExistingRedemption = await CouponRedemption.findById(redemption._id);
      assert.ok(stillExistingRedemption, "CouponRedemption record must be preserved");
      const stillExistingOrder = await Order.findById(order._id);
      assert.strictEqual(stillExistingOrder?.couponCode, coupon.code, "Order coupon snapshot must be preserved");
    });

  } finally {
    // -----------------------------------------------------------------
    // STRICT 100% CLEANUP GUARANTEE
    // -----------------------------------------------------------------
    console.log("\n--- Cleaning up all test data from MongoDB Atlas ---");

    if (createdCouponIds.length > 0) {
      const cRes = await Coupon.deleteMany({ _id: { $in: createdCouponIds } });
      console.log(`  Cleaned up ${cRes.deletedCount} test coupons.`);
    }

    if (createdOrderIds.length > 0) {
      await CouponRedemption.deleteMany({ orderId: { $in: createdOrderIds } });
      const oRes = await Order.deleteMany({ _id: { $in: createdOrderIds } });
      console.log(`  Cleaned up ${oRes.deletedCount} test orders and associated redemptions.`);
    }

    if (createdProductIds.length > 0) {
      const pRes = await Product.deleteMany({ _id: { $in: createdProductIds } });
      console.log(`  Cleaned up ${pRes.deletedCount} test products.`);
    }

    if (createdSessionIds.length > 0) {
      const sRes = await CheckoutSession.deleteMany({ sessionId: { $in: createdSessionIds } });
      console.log(`  Cleaned up ${sRes.deletedCount} test checkout sessions.`);
    }

    // Verify zero leftover test records
    const leftoverCoupons = await Coupon.countDocuments({ code: { $regex: `^${testPrefix}` } });
    const leftoverProducts = await Product.countDocuments({ name: { $regex: `^${testPrefix}` } });
    assert.strictEqual(leftoverCoupons, 0, "All test coupons must be deleted");
    assert.strictEqual(leftoverProducts, 0, "All test products must be deleted");
    console.log("  ✅ Zero leftover test records confirmed in database.\n");
  }

  console.log("=======================================================");
  console.log(` SUITE SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log("=======================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runCouponTests()
  .then(() => {
    mongoose.connection.close();
    process.exit(0);
  })
  .catch((err) => {
    console.error("Test suite fatal error:", err);
    mongoose.connection.close();
    process.exit(1);
  });
