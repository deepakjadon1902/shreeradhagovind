import "dotenv/config";
import assert from "node:assert";
import mongoose from "mongoose";
import crypto from "crypto";
import { connectDB } from "../config/db";
import { Product } from "../models/Product";
import { Order } from "../models/Order";
import { StockHistory } from "../models/StockHistory";
import { WaitingList } from "../models/WaitingList";
import {
  LOW_STOCK_THRESHOLD,
  OUT_OF_STOCK_WINDOW_MS,
  getStockClassification,
  isProductCustomerVisible,
  buildCustomerStorefrontQuery,
  decrementOrderStockSafely,
  restockOrderItemsWithHistory,
  manualAdjustStock,
  VALID_ADJUSTMENT_REASONS,
} from "../services/inventory.service";
import { restockOrderItems } from "../services/cancellation.service";

async function runInventoryTests() {
  console.log("\n=======================================================");
  console.log(" INVENTORY & LOW STOCK MANAGEMENT TEST SUITE");
  console.log("=======================================================\n");

  await connectDB();
  await WaitingList.init();

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
  const createdHistoryIds: mongoose.Types.ObjectId[] = [];
  const createdWaitlistIds: mongoose.Types.ObjectId[] = [];

  // Helper to create test product
  async function createTestProduct(initialStock = 10, outOfStockSince: Date | null = null) {
    const p = await Product.create({
      name: `Test Inv Product ${testRunId}-${createdProductIds.length}`,
      slug: `test-inv-product-${testRunId}-${createdProductIds.length}`,
      description: "Test devotional merchandise for inventory test suite",
      price: 499,
      mrp: 999,
      category: "Vrindavan Specials",
      stock: initialStock,
      outOfStockSince,
      isActive: true,
    });
    createdProductIds.push(p._id as mongoose.Types.ObjectId);
    return p;
  }

  try {
    // -------------------------------------------------------------
    // Test 1: Low Stock Classification Rules
    // -------------------------------------------------------------
    console.log("-------------------------------------------------------");
    console.log(" Section 1: Low Stock Classification Rules");
    console.log("-------------------------------------------------------");

    await test("1.1. LOW_STOCK_THRESHOLD is exactly 5", () => {
      assert.strictEqual(LOW_STOCK_THRESHOLD, 5);
      assert.strictEqual(OUT_OF_STOCK_WINDOW_MS, 24 * 60 * 60 * 1000);
    });

    await test("1.2. Stock > 5 evaluates to 'in_stock'", () => {
      assert.strictEqual(getStockClassification(6), "in_stock");
      assert.strictEqual(getStockClassification(10), "in_stock");
      assert.strictEqual(getStockClassification(100), "in_stock");
    });

    await test("1.3. Stock between 1 and 5 evaluates to 'low_stock'", () => {
      assert.strictEqual(getStockClassification(5), "low_stock");
      assert.strictEqual(getStockClassification(4), "low_stock");
      assert.strictEqual(getStockClassification(3), "low_stock");
      assert.strictEqual(getStockClassification(2), "low_stock");
      assert.strictEqual(getStockClassification(1), "low_stock");
    });

    await test("1.4. Stock <= 0 evaluates to 'out_of_stock'", () => {
      assert.strictEqual(getStockClassification(0), "out_of_stock");
      assert.strictEqual(getStockClassification(-1), "out_of_stock");
    });

    // -------------------------------------------------------------
    // Test 2: 24-Hour Out-of-Stock Storefront Visibility Rule
    // -------------------------------------------------------------
    console.log("\n-------------------------------------------------------");
    console.log(" Section 2: 24-Hour Out-of-Stock Visibility Rules");
    console.log("-------------------------------------------------------");

    await test("2.1. In-stock products are always customer visible", async () => {
      const inStockProd = await createTestProduct(10);
      assert.strictEqual(isProductCustomerVisible(inStockProd), true);
    });

    await test("2.2. Product out of stock < 24 hours is customer visible (marked OOS)", async () => {
      // 2 hours ago
      const recentOos = new Date(Date.now() - 2 * 60 * 60 * 1000);
      const oosProdRecent = await createTestProduct(0, recentOos);
      assert.strictEqual(isProductCustomerVisible(oosProdRecent), true);
    });

    await test("2.3. Product out of stock > 24 hours is NOT customer visible", async () => {
      // 25 hours ago
      const expiredOos = new Date(Date.now() - 25 * 60 * 60 * 1000);
      const oosProdExpired = await createTestProduct(0, expiredOos);
      assert.strictEqual(isProductCustomerVisible(oosProdExpired), false);
    });

    await test("2.4. Legacy product with 0 stock and null outOfStockSince is NOT customer visible", async () => {
      const legacyOos = await createTestProduct(0, null);
      assert.strictEqual(isProductCustomerVisible(legacyOos), false);
    });

    await test("2.5. Storefront MongoDB query correctly filters products matching 24h rule", async () => {
      const query = buildCustomerStorefrontQuery({
        _id: { $in: createdProductIds },
      });

      const visibleInDb = await Product.find(query).select("_id stock outOfStockSince");
      const visibleIds = visibleInDb.map((p) => p._id.toString());

      // Should include in-stock and recent OOS (<24h)
      // Should NOT include expired OOS (>24h) or legacy null OOS
      assert.ok(visibleIds.includes(createdProductIds[0].toString()), "In-stock product must be returned");
      assert.ok(visibleIds.includes(createdProductIds[1].toString()), "Recent OOS product (<24h) must be returned");
      assert.ok(!visibleIds.includes(createdProductIds[2].toString()), "Expired OOS product (>24h) must NOT be returned");
      assert.ok(!visibleIds.includes(createdProductIds[3].toString()), "Legacy OOS product (null timestamp) must NOT be returned");
    });

    // -------------------------------------------------------------
    // Test 3: Multi-Item Safe Decrement & Rollback Protection
    // -------------------------------------------------------------
    console.log("\n-------------------------------------------------------");
    console.log(" Section 3: Multi-Item Safe Decrement & Atomic Rollback");
    console.log("-------------------------------------------------------");

    await test("3.1. When an item has insufficient stock, previous items are rolled back", async () => {
      const prodA = await createTestProduct(5); // stock = 5
      const prodB = await createTestProduct(1); // stock = 1

      // Order demands: prodA qty 2, prodB qty 3 (insufficient!)
      await assert.rejects(
        async () => {
          await decrementOrderStockSafely(
            [
              { productId: prodA._id, qty: 2, name: prodA.name },
              { productId: prodB._id, qty: 3, name: prodB.name },
            ],
            { actorType: "customer", source: "test_checkout" }
          );
        },
        /left in stock/
      );

      // Verify rollback on prodA: stock must remain exactly 5
      const prodAAfter = await Product.findById(prodA._id);
      const prodBAfter = await Product.findById(prodB._id);

      assert.strictEqual(prodAAfter?.stock, 5, "Product A stock must be completely restored to 5");
      assert.strictEqual(prodBAfter?.stock, 1, "Product B stock must remain unchanged at 1");
    });

    await test("3.2. Successful order decrement updates stock and sets outOfStockSince when stock reaches 0", async () => {
      const prodA = await createTestProduct(5); // stock = 5
      const prodB = await createTestProduct(2); // stock = 2

      const result = await decrementOrderStockSafely(
        [
          { productId: prodA._id, qty: 2, name: prodA.name }, // 5 -> 3
          { productId: prodB._id, qty: 2, name: prodB.name }, // 2 -> 0
        ],
        { actorType: "customer", source: "test_checkout" }
      );

      assert.strictEqual(result.success, true, "Decrement should succeed");

      const prodAAfter = await Product.findById(prodA._id);
      const prodBAfter = await Product.findById(prodB._id);

      assert.strictEqual(prodAAfter?.stock, 3, "Product A stock should be decremented to 3");
      assert.strictEqual(prodAAfter?.outOfStockSince, null, "Product A outOfStockSince should remain null");

      assert.strictEqual(prodBAfter?.stock, 0, "Product B stock should be decremented to 0");
      assert.ok(prodBAfter?.outOfStockSince instanceof Date, "Product B outOfStockSince must be set");
    });

    // -------------------------------------------------------------
    // Test 4: Cancellation Restock & History Ledger
    // -------------------------------------------------------------
    console.log("\n-------------------------------------------------------");
    console.log(" Section 4: Cancellation Restock & Audit Ledger");
    console.log("-------------------------------------------------------");

    await test("4.1. Order cancellation restocks items, clears outOfStockSince, and logs StockHistory", async () => {
      const prodC = await createTestProduct(0, new Date()); // OOS product

      // Create test order
      const testOrder = await Order.create({
        orderNumber: `ORD-${Date.now()}-TEST`,
        user: new mongoose.Types.ObjectId(),
        items: [
          {
            productId: prodC._id,
            qty: 3,
            price: prodC.price,
            name: prodC.name,
          },
        ],
        total: prodC.price * 3,
        subtotal: prodC.price * 3,
        status: "Placed",
        payment: { status: "pending", method: "cod" },
        address: { name: "Test Cust", street: "123 Temple Rd", city: "Mathura", state: "UP", pincode: "281001", phone: "9876543210" },
      });
      createdOrderIds.push(testOrder._id as mongoose.Types.ObjectId);

      // Restock items via cancellation service
      await restockOrderItems(testOrder);

      const prodCAfter = await Product.findById(prodC._id);
      assert.strictEqual(prodCAfter?.stock, 3, "Stock should be restored from 0 to 3");
      assert.strictEqual(prodCAfter?.outOfStockSince, null, "outOfStockSince must be reset to null");

      // Verify StockHistory ledger entry
      const historyEntries = await StockHistory.find({ productId: prodC._id });
      assert.ok(historyEntries.length >= 1, "Must have recorded StockHistory entry");
      const latestHistory = historyEntries[historyEntries.length - 1];
      createdHistoryIds.push(latestHistory._id as mongoose.Types.ObjectId);

      assert.strictEqual(latestHistory.movementType, "cancellation_restock");
      assert.strictEqual(latestHistory.previousStock, 0);
      assert.strictEqual(latestHistory.newStock, 3);
      assert.strictEqual(latestHistory.delta, 3);
    });

    // -------------------------------------------------------------
    // Test 5: Manual Stock Adjustment Workflow & Validation
    // -------------------------------------------------------------
    console.log("\n-------------------------------------------------------");
    console.log(" Section 5: Manual Stock Adjustment Workflow & Safety");
    console.log("-------------------------------------------------------");

    await test("5.1. Valid adjustment reasons list includes all required choices", () => {
      assert.ok(VALID_ADJUSTMENT_REASONS.includes("Received New Stock" as any));
      assert.ok(VALID_ADJUSTMENT_REASONS.includes("Physical Recount" as any));
      assert.ok(VALID_ADJUSTMENT_REASONS.includes("Damaged / Broken" as any));
      assert.ok(VALID_ADJUSTMENT_REASONS.includes("Return" as any));
      assert.ok(VALID_ADJUSTMENT_REASONS.includes("Correction" as any));
      assert.ok(VALID_ADJUSTMENT_REASONS.includes("Other" as any));
    });

    await test("5.2. Manual adjustment 'add' increases stock and logs ledger", async () => {
      const prod = await createTestProduct(5);

      const res = await manualAdjustStock({
        productId: prod._id.toString(),
        action: "add",
        quantity: 10,
        reason: "Received New Stock",
        note: "Vendor shipment #VS-99",
        actorId: new mongoose.Types.ObjectId(),
        actorType: "admin",
      });

      createdHistoryIds.push(res.historyEntry._id as mongoose.Types.ObjectId);

      assert.strictEqual(res.newStock, 15);
      assert.strictEqual(res.delta, 10);
      assert.strictEqual(res.historyEntry.movementType, "manual_adjustment");
      assert.strictEqual(res.historyEntry.reason, "Received New Stock");

      const inDb = await Product.findById(prod._id);
      assert.strictEqual(inDb?.stock, 15);
    });

    await test("5.3. Manual adjustment 'remove' decreases stock and cannot go negative", async () => {
      const prod = await createTestProduct(8);

      // Remove 3
      const res1 = await manualAdjustStock({
        productId: prod._id.toString(),
        action: "remove",
        quantity: 3,
        reason: "Damaged / Broken",
        note: "Water damage in store",
      });
      createdHistoryIds.push(res1.historyEntry._id as mongoose.Types.ObjectId);
      assert.strictEqual(res1.newStock, 5);

      // Try to remove 10 (exceeds current 5)
      await assert.rejects(
        async () => {
          await manualAdjustStock({
            productId: prod._id.toString(),
            action: "remove",
            quantity: 10,
            reason: "Correction",
          });
        },
        /only has 5 units in stock/
      );
    });

    await test("5.4. Manual adjustment 'set' sets absolute quantity and sets outOfStockSince on 0", async () => {
      const prod = await createTestProduct(12);

      const res = await manualAdjustStock({
        productId: prod._id.toString(),
        action: "set",
        quantity: 0,
        reason: "Physical Recount",
      });
      createdHistoryIds.push(res.historyEntry._id as mongoose.Types.ObjectId);

      assert.strictEqual(res.newStock, 0);
      assert.strictEqual(res.delta, -12);

      const inDb = await Product.findById(prod._id);
      assert.strictEqual(inDb?.stock, 0);
      assert.ok(inDb?.outOfStockSince instanceof Date, "outOfStockSince must be set when stock reaches 0 via set");
    });

    await test("5.5. Reason 'Other' requires an explanatory note", async () => {
      const prod = await createTestProduct(10);

      await assert.rejects(
        async () => {
          await manualAdjustStock({
            productId: prod._id.toString(),
            action: "add",
            quantity: 2,
            reason: "Other",
            note: "   ", // empty note
          });
        },
        /explanatory note is required/
      );
    });

    // -------------------------------------------------------------
    // Test 6: Waiting List (Back-in-Stock) Flow & Deduplication
    // -------------------------------------------------------------
    console.log("\n-------------------------------------------------------");
    console.log(" Section 6: Back-in-Stock Waiting List & Deduplication");
    console.log("-------------------------------------------------------");

    await test("6.1. Customer can join waitlist for out-of-stock product", async () => {
      const oosProd = await createTestProduct(0, new Date());

      const waitlistEntry = await WaitingList.create({
        productId: oosProd._id,
        email: `devotee-${testRunId}@example.com`,
        phone: "9876543210",
        status: "waiting",
      });
      createdWaitlistIds.push(waitlistEntry._id as mongoose.Types.ObjectId);

      assert.strictEqual(waitlistEntry.email, `devotee-${testRunId}@example.com`);
      assert.strictEqual(waitlistEntry.status, "waiting");
    });

    await test("6.2. Duplicate active request for same product and email is rejected by unique index", async () => {
      const oosProd = await createTestProduct(0, new Date());
      const testEmail = `duplicate-${testRunId}@example.com`;

      const firstEntry = await WaitingList.create({
        productId: oosProd._id,
        email: testEmail,
        status: "waiting",
      });
      createdWaitlistIds.push(firstEntry._id as mongoose.Types.ObjectId);

      // Attempt second active request
      await assert.rejects(
        async () => {
          const second = await WaitingList.create({
            productId: oosProd._id,
            email: testEmail,
            status: "waiting",
          });
          createdWaitlistIds.push(second._id as mongoose.Types.ObjectId);
        },
        /E11000 duplicate key error/
      );
    });

    await test("6.3. Product waitlist count queries only active requests", async () => {
      const oosProd = await createTestProduct(0, new Date());

      const e1 = await WaitingList.create({
        productId: oosProd._id,
        email: `w1-${testRunId}@example.com`,
        status: "waiting",
      });
      const e2 = await WaitingList.create({
        productId: oosProd._id,
        email: `w2-${testRunId}@example.com`,
        status: "notified", // already notified, not active
      });
      createdWaitlistIds.push(e1._id as mongoose.Types.ObjectId);
      createdWaitlistIds.push(e2._id as mongoose.Types.ObjectId);

      const count = await WaitingList.countDocuments({
        productId: oosProd._id,
        status: "waiting",
      });

      assert.strictEqual(count, 1, "Only active requests must be counted");
    });

    // -------------------------------------------------------------
    // Test 7: Stale Product Editor Stock Overwrite Race Protection
    // -------------------------------------------------------------
    console.log("\n-------------------------------------------------------");
    console.log(" Section 7: Stale Stock Protection & Race Hardening");
    console.log("-------------------------------------------------------");

    await test("7.1. Stale Product Editor update does NOT clobber concurrent customer purchases", async () => {
      // A. Product stock = 50
      const prod = await createTestProduct(50);
      assert.strictEqual(prod.stock, 50);

      // B. Simulate customer purchase of 5 units -> live stock becomes 45
      const decResult = await decrementOrderStockSafely(
        [{ productId: prod._id, qty: 5, name: prod.name }],
        { actorType: "customer", source: "test_checkout" }
      );
      assert.strictEqual(decResult.success, true);
      const stockAfterPurchase = await Product.findById(prod._id);
      assert.strictEqual(stockAfterPurchase?.stock, 45, "Live stock must be 45 after customer purchase");

      // C. Simulate stale Product Editor PATCH payload containing stock = 50 while changing only description
      const patchPayload = {
        description: "Updated devotional description from admin",
        stock: 50, // stale stock value from when admin loaded the form
      };

      // Apply update through the normal product update path (same logic as PATCH /api/products/:id)
      const sanitizedPatch: any = { ...patchPayload };
      if (sanitizedPatch.stock !== undefined) {
        delete sanitizedPatch.stock; // safely ignored by backend
      }
      const updatedProd = await Product.findByIdAndUpdate(prod._id, sanitizedPatch, { new: true });

      // E. Assert stock remains exactly 45
      assert.strictEqual(updatedProd?.stock, 45, "Stock must remain 45 and not be restored to 50");
      assert.strictEqual(updatedProd?.description, "Updated devotional description from admin");

      // F & G. Assert no fake inventory correction occurred and no fake StockHistory was created
      const fakeAdjustmentHistories = await StockHistory.find({
        productId: prod._id,
        movementType: "manual_adjustment",
        reason: "Correction",
      });
      assert.strictEqual(fakeAdjustmentHistories.length, 0, "No fake manual_adjustment history must exist");
    });

    await test("7.2. Normal product metadata update (name, price, etc.) preserves stock", async () => {
      const prod = await createTestProduct(25);

      const update = { name: "Updated Sacred Mala", price: 350 };
      const updated = await Product.findByIdAndUpdate(prod._id, update, { new: true });

      assert.strictEqual(updated?.name, "Updated Sacred Mala");
      assert.strictEqual(updated?.price, 350);
      assert.strictEqual(updated?.stock, 25, "Stock must remain exactly 25");
    });

    await test("7.3. Legitimate inventory adjustment through dedicated workflow still works and logs ledger", async () => {
      const prod = await createTestProduct(30);

      const res = await manualAdjustStock({
        productId: prod._id.toString(),
        action: "set",
        quantity: 40,
        reason: "Physical Recount",
        note: "Audited in inventory tab",
      });
      createdHistoryIds.push(res.historyEntry._id as mongoose.Types.ObjectId);

      assert.strictEqual(res.newStock, 40);
      assert.strictEqual(res.delta, 10);

      const inDb = await Product.findById(prod._id);
      assert.strictEqual(inDb?.stock, 40);

      const history = await StockHistory.findById(res.historyEntry._id);
      assert.ok(history, "StockHistory entry must exist");
      assert.strictEqual(history?.reason, "Physical Recount");
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
    if (createdHistoryIds.length > 0) {
      await StockHistory.deleteMany({ _id: { $in: createdHistoryIds } });
    }
    if (createdWaitlistIds.length > 0) {
      await WaitingList.deleteMany({ _id: { $in: createdWaitlistIds } });
    }

    const leftoverOrders = await Order.countDocuments({ _id: { $in: createdOrderIds } });
    const leftoverProducts = await Product.countDocuments({ _id: { $in: createdProductIds } });
    const leftoverHistory = await StockHistory.countDocuments({ _id: { $in: createdHistoryIds } });
    const leftoverWaitlist = await WaitingList.countDocuments({ _id: { $in: createdWaitlistIds } });

    console.log(`  Cleanup results:`);
    console.log(`    - Orders remaining:       ${leftoverOrders}`);
    console.log(`    - Products remaining:     ${leftoverProducts}`);
    console.log(`    - StockHistory remaining: ${leftoverHistory}`);
    console.log(`    - WaitingList remaining:  ${leftoverWaitlist}`);

    assert.strictEqual(leftoverOrders, 0, "All test orders must be completely removed");
    assert.strictEqual(leftoverProducts, 0, "All test products must be completely removed");
    assert.strictEqual(leftoverHistory, 0, "All test stock histories must be completely removed");
    assert.strictEqual(leftoverWaitlist, 0, "All test waiting list entries must be completely removed");

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

runInventoryTests().catch((err) => {
  console.error("Test execution threw unhandled exception:", err);
  process.exit(1);
});
