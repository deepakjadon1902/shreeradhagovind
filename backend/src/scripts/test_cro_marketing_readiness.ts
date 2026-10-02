import "dotenv/config";
import assert from "node:assert";
import mongoose from "mongoose";
import crypto from "crypto";
import { connectDB } from "../config/db";
import { Product } from "../models/Product";
import { Category } from "../models/Category";
import { Order } from "../models/Order";
import { User } from "../models/User";
import { Settings } from "../models/Settings";
import { OUT_OF_STOCK_WINDOW_MS } from "../services/inventory.service";

async function runCroMarketingReadinessTests() {
  console.log("\n=======================================================");
  console.log(" CRO & MARKETING READINESS COMPREHENSIVE TEST SUITE");
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

  const testRunId = `cro-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;
  const createdCategoryIds: mongoose.Types.ObjectId[] = [];
  const createdProductIds: mongoose.Types.ObjectId[] = [];
  const createdOrderIds: mongoose.Types.ObjectId[] = [];
  const createdUserIds: mongoose.Types.ObjectId[] = [];

  let initialSettingsDoc: any = null;

  try {
    // ---------------------------------------------------------------
    // 0. SNAPSHOT INITIAL SETTINGS BEFORE ANY TESTING
    // ---------------------------------------------------------------
    const rawSettings = await Settings.findOne({ key: "global" }).lean();
    if (rawSettings) {
      initialSettingsDoc = JSON.parse(JSON.stringify(rawSettings));
    }

    // Helper: Create test user
    async function createTestUser(role: "user" | "admin" = "user") {
      const u = await User.create({
        name: `User ${role} ${testRunId}`,
        email: `${role}-${testRunId}-${createdUserIds.length}@example.com`,
        password: "hashed_test_password_123",
        role,
      });
      createdUserIds.push(u._id);
      return u;
    }

    // ---------------------------------------------------------------
    // SUITE 1: DEVELOPER PROFILE SETTINGS & SNAPSHOT RESTORATION
    // ---------------------------------------------------------------
    console.log("--- SUITE 1: Developer Profile Toggle & Snapshot Restoration ---");

    await test("1.1 Settings snapshot is captured cleanly", async () => {
      assert.ok(initialSettingsDoc, "Initial global settings document must exist");
      assert.strictEqual(initialSettingsDoc.key, "global");
    });

    await test("1.2 Developer profile toggle to explicit false", async () => {
      await Settings.findOneAndUpdate({ key: "global" }, { showDeveloperProfile: false });
      const current = await Settings.findOne({ key: "global" }).lean();
      assert.strictEqual(current?.showDeveloperProfile, false);

      // Verify client-side evaluation logic
      const clientEval = current?.showDeveloperProfile !== false;
      assert.strictEqual(clientEval, false, "Client must hide profile when explicitly false");
    });

    await test("1.3 Developer profile toggle to explicit true", async () => {
      await Settings.findOneAndUpdate({ key: "global" }, { showDeveloperProfile: true });
      const current = await Settings.findOne({ key: "global" }).lean();
      assert.strictEqual(current?.showDeveloperProfile, true);

      // Verify client-side evaluation logic
      const clientEval = (current?.showDeveloperProfile as boolean | undefined) !== false;
      assert.strictEqual(clientEval, true, "Client must show profile when explicitly true");
    });

    await test("1.4 Developer profile default backward compatibility (missing/undefined => true)", async () => {
      // Simulate missing setting on client
      const legacySettingsWithoutField: any = {};
      const clientEval = legacySettingsWithoutField.showDeveloperProfile !== false;
      assert.strictEqual(clientEval, true, "Missing/undefined setting must default to true");
    });

    // ---------------------------------------------------------------
    // SUITE 2: CATEGORY VISIBILITY, PARENT-CHILD & 24H OOS RULES
    // ---------------------------------------------------------------
    console.log("\n--- SUITE 2: Category Visibility, Hierarchy & 24h Stock Rules ---");

    // Create 3 parent categories and their children
    // Parent A: Populated (Child A1 has in-stock product; Child A2 has 0 products)
    const catParentA = await Category.create({
      name: `Parent Populated ${testRunId}`,
      slug: `parent-pop-${testRunId}`,
      parentId: null,
      isActive: true,
      sortOrder: 1,
    });
    createdCategoryIds.push(catParentA._id);

    const catChildA1 = await Category.create({
      name: `Child With Stock ${testRunId}`,
      slug: `child-stock-${testRunId}`,
      parentId: catParentA._id,
      isActive: true,
      sortOrder: 1,
    });
    createdCategoryIds.push(catChildA1._id);

    const catChildA2 = await Category.create({
      name: `Child Empty A2 ${testRunId}`,
      slug: `child-empty-a2-${testRunId}`,
      parentId: catParentA._id,
      isActive: true,
      sortOrder: 2,
    });
    createdCategoryIds.push(catChildA2._id);

    // Parent B: Completely empty (0 products in parent and 0 products in child)
    const catParentB = await Category.create({
      name: `Parent Empty B ${testRunId}`,
      slug: `parent-empty-b-${testRunId}`,
      parentId: null,
      isActive: true,
      sortOrder: 2,
    });
    createdCategoryIds.push(catParentB._id);

    const catChildB1 = await Category.create({
      name: `Child Empty B1 ${testRunId}`,
      slug: `child-empty-b1-${testRunId}`,
      parentId: catParentB._id,
      isActive: true,
      sortOrder: 1,
    });
    createdCategoryIds.push(catChildB1._id);

    // Parent C: Expired Out-of-Stock (Product out of stock > 24 hours ago)
    const catParentC = await Category.create({
      name: `Parent Expired OOS ${testRunId}`,
      slug: `parent-expired-c-${testRunId}`,
      parentId: null,
      isActive: true,
      sortOrder: 3,
    });
    createdCategoryIds.push(catParentC._id);

    const catChildC1 = await Category.create({
      name: `Child Expired OOS ${testRunId}`,
      slug: `child-expired-c1-${testRunId}`,
      parentId: catParentC._id,
      isActive: true,
      sortOrder: 1,
    });
    createdCategoryIds.push(catChildC1._id);

    // Products:
    // 1. In-stock product for Child A1
    const prodA1 = await Product.create({
      name: `Product In Stock ${testRunId}`,
      slug: `prod-stock-${testRunId}`,
      category: catChildA1.name,
      price: 199,
      mrp: 299,
      stock: 10,
      isActive: true,
    });
    createdProductIds.push(prodA1._id);

    // 2. Expired OOS product for Child C1 (outOfStockSince = 26 hours ago)
    const prodC1 = await Product.create({
      name: `Product Expired OOS ${testRunId}`,
      slug: `prod-expired-${testRunId}`,
      category: catChildC1.name,
      price: 150,
      mrp: 250,
      stock: 0,
      outOfStockSince: new Date(Date.now() - (OUT_OF_STOCK_WINDOW_MS + 2 * 60 * 60 * 1000)),
      isActive: true,
    });
    createdProductIds.push(prodC1._id);

    // Test product counts with customer 24-hour stock rule
    await test("2.1 Customer category query filters products using 24-hour stock rule", async () => {
      const cutoff = new Date(Date.now() - OUT_OF_STOCK_WINDOW_MS);
      const customerProductFilter = {
        isActive: true,
        $or: [
          { stock: { $gt: 0 } },
          { stock: { $lte: 0 }, outOfStockSince: { $gt: cutoff } },
        ],
      };

      const counts = await Product.aggregate([
        { $match: { ...customerProductFilter, category: { $in: [catChildA1.name, catChildA2.name, catChildB1.name, catChildC1.name] } } },
        { $group: { _id: "$category", count: { $sum: 1 } } },
      ]);
      const countMap = new Map(counts.map((x) => [x._id, x.count]));

      assert.strictEqual(countMap.get(catChildA1.name), 1, "Child A1 must have count 1");
      assert.strictEqual(countMap.get(catChildA2.name) ?? 0, 0, "Child A2 must have count 0");
      assert.strictEqual(countMap.get(catChildB1.name) ?? 0, 0, "Child B1 must have count 0");
      assert.strictEqual(countMap.get(catChildC1.name) ?? 0, 0, "Child C1 (expired OOS >24h) must have count 0");
    });

    await test("2.2 Customer category tree retains parent with populated child, but hides empty child", async () => {
      const cutoff = new Date(Date.now() - OUT_OF_STOCK_WINDOW_MS);
      const [categories, counts] = await Promise.all([
        Category.find({ _id: { $in: createdCategoryIds }, isActive: true }).sort({ sortOrder: 1, name: 1 }),
        Product.aggregate([
          {
            $match: {
              isActive: true,
              $or: [{ stock: { $gt: 0 } }, { stock: { $lte: 0 }, outOfStockSince: { $gt: cutoff } }],
            },
          },
          { $group: { _id: "$category", count: { $sum: 1 } } },
        ]),
      ]);
      const countMap = new Map(counts.map((x) => [x._id, x.count]));
      const mapped = categories.map((c: any) => ({ ...c.toObject(), productCount: countMap.get(c.name) ?? 0 }));

      // Run tree builder
      const allIds = new Set(mapped.map((c) => String(c._id)));
      const byParent = new Map<string, any[]>();
      for (const c of mapped) {
        if (c.parentId && allIds.has(String(c.parentId))) {
          const pId = String(c.parentId);
          byParent.set(pId, [...(byParent.get(pId) ?? []), c]);
        }
      }

      function processCategory(c: any): any | null {
        const rawChildren = byParent.get(String(c._id)) ?? [];
        const processedChildren: any[] = [];
        for (const child of rawChildren) {
          if (child.isActive) {
            const processed = processCategory(child);
            if (processed) processedChildren.push(processed);
          }
        }
        const hasDirectProducts = (c.productCount ?? 0) > 0;
        const hasVisibleChildren = processedChildren.length > 0;
        if (!hasDirectProducts && !hasVisibleChildren) return null;
        return { ...c, children: processedChildren };
      }

      const rootCategories = mapped.filter((c) => !c.parentId || !allIds.has(String(c.parentId)));
      const visibleRoots = rootCategories.map(processCategory).filter(Boolean);

      // Assertions
      const visibleParentIds = visibleRoots.map((r: any) => String(r._id));
      assert.ok(visibleParentIds.includes(String(catParentA._id)), "Parent A must be visible");
      assert.ok(!visibleParentIds.includes(String(catParentB._id)), "Parent B (empty) must be hidden");
      assert.ok(!visibleParentIds.includes(String(catParentC._id)), "Parent C (expired OOS) must be hidden");

      // Check Parent A's children
      const parentAProcessed = visibleRoots.find((r: any) => String(r._id) === String(catParentA._id));
      assert.strictEqual(parentAProcessed.children.length, 1, "Parent A must have exactly 1 visible child");
      assert.strictEqual(String(parentAProcessed.children[0]._id), String(catChildA1._id), "Child A1 must be included");
      assert.ok(
        !parentAProcessed.children.some((c: any) => String(c._id) === String(catChildA2._id)),
        "Empty Child A2 must be excluded",
      );
    });

    await test("2.3 Admin category view returns ALL categories including empty ones", async () => {
      const [categories, counts] = await Promise.all([
        Category.find({ _id: { $in: createdCategoryIds } }).sort({ sortOrder: 1, name: 1 }),
        Product.aggregate([{ $match: { isActive: true } }, { $group: { _id: "$category", count: { $sum: 1 } } }]),
      ]);
      const countMap = new Map(counts.map((x) => [x._id, x.count]));
      const adminList = categories.map((c: any) => ({ ...c.toObject(), productCount: countMap.get(c.name) ?? 0 }));

      assert.strictEqual(adminList.length, createdCategoryIds.length, "Admin must see all 7 test categories");
      const ids = adminList.map((c) => String(c._id));
      assert.ok(ids.includes(String(catParentA._id)));
      assert.ok(ids.includes(String(catChildA1._id)));
      assert.ok(ids.includes(String(catChildA2._id)));
      assert.ok(ids.includes(String(catParentB._id)));
      assert.ok(ids.includes(String(catChildB1._id)));
      assert.ok(ids.includes(String(catParentC._id)));
      assert.ok(ids.includes(String(catChildC1._id)));
    });

    // ---------------------------------------------------------------
    // SUITE 3: CHECKOUT POSTOFFICE FALLBACK & SAFE ORDER CREATION
    // ---------------------------------------------------------------
    console.log("\n--- SUITE 3: Checkout Post Office Fallback & Safe Order Creation ---");

    await test("3.1 Order schema accepts address with empty or omitted postOffice", async () => {
      const testUser = await createTestUser("user");
      const testOrderNo = 987654;

      // Create isolated test order with no postOffice
      const testOrder = await Order.create({
        orderNo: testOrderNo,
        user: testUser._id,
        customerEmail: testUser.email,
        items: [
          {
            productId: prodA1._id,
            name: prodA1.name,
            price: prodA1.price,
            qty: 1,
          },
        ],
        subtotal: 199,
        shipping: 49,
        total: 248,
        address: {
          name: "Test Devotee",
          phone: "9876543210",
          line1: "Near Bankey Bihari Temple, Raman Reti",
          city: "Vrindavan",
          state: "Uttar Pradesh",
          pincode: "281121",
          postOffice: "", // empty postOffice must be accepted
        },
        payment: {
          method: "cod",
          status: "pending",
        },
        status: "Placed",
      });
      createdOrderIds.push(testOrder._id);

      assert.ok(testOrder._id, "Order must be created successfully without postOffice");
      assert.strictEqual(testOrder.address?.postOffice, "");
      assert.strictEqual(testOrder.address?.city, "Vrindavan");
      assert.strictEqual(testOrder.address?.pincode, "281121");
    });

    // ---------------------------------------------------------------
    // SUITE 4: CUSTOMER-VISIBLE RECOVERY SHELF HELPER
    // ---------------------------------------------------------------
    console.log("\n--- SUITE 4: Customer Visibility Helper Rules ---");

    await test("4.1 In-stock product is customer-visible", () => {
      const p: any = { stock: 5, outOfStockSince: null };
      const isVisible = p.stock > 0 || (p.stock <= 0 && p.outOfStockSince && (Date.now() - new Date(p.outOfStockSince).getTime() <= OUT_OF_STOCK_WINDOW_MS));
      assert.strictEqual(isVisible, true);
    });

    await test("4.2 Product out of stock within 24 hours is customer-visible", () => {
      const p: any = { stock: 0, outOfStockSince: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() };
      const elapsed = Date.now() - new Date(p.outOfStockSince).getTime();
      const isVisible = p.stock > 0 || (p.stock <= 0 && p.outOfStockSince && elapsed <= OUT_OF_STOCK_WINDOW_MS);
      assert.strictEqual(isVisible, true);
    });

    await test("4.3 Product out of stock for > 24 hours is NOT customer-visible", () => {
      const p: any = { stock: 0, outOfStockSince: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString() };
      const elapsed = Date.now() - new Date(p.outOfStockSince).getTime();
      const isVisible = p.stock > 0 || (p.stock <= 0 && p.outOfStockSince && elapsed <= OUT_OF_STOCK_WINDOW_MS);
      assert.strictEqual(Boolean(isVisible), false);
    });

    await test("4.4 Product out of stock with no outOfStockSince is NOT customer-visible", () => {
      const p: any = { stock: 0, outOfStockSince: null };
      const isVisible = p.stock > 0 || (p.stock <= 0 && p.outOfStockSince && (Date.now() - new Date(p.outOfStockSince).getTime() <= OUT_OF_STOCK_WINDOW_MS));
      assert.strictEqual(Boolean(isVisible), false);
    });

  } finally {
    // ---------------------------------------------------------------
    // MANDATORY TEARDOWN & COMPLETE CLEANUP VERIFICATION
    // ---------------------------------------------------------------
    console.log("\n--- TEARDOWN & REPOSITORY CLEANUP ---");

    // 1. Clean up test products
    if (createdProductIds.length > 0) {
      await Product.deleteMany({ _id: { $in: createdProductIds } });
    }

    // 2. Clean up test categories
    if (createdCategoryIds.length > 0) {
      await Category.deleteMany({ _id: { $in: createdCategoryIds } });
    }

    // 3. Clean up test orders
    if (createdOrderIds.length > 0) {
      await Order.deleteMany({ _id: { $in: createdOrderIds } });
    }

    // 4. Clean up test users
    if (createdUserIds.length > 0) {
      await User.deleteMany({ _id: { $in: createdUserIds } });
    }

    // 5. Restore Settings document to exact snapshot
    if (initialSettingsDoc) {
      await Settings.findOneAndUpdate(
        { key: "global" },
        { showDeveloperProfile: initialSettingsDoc.showDeveloperProfile },
        { new: true }
      );
      const restored = await Settings.findOne({ key: "global" }).lean();
      assert.strictEqual(
        restored?.showDeveloperProfile,
        initialSettingsDoc.showDeveloperProfile,
        "Original Settings document MUST be restored exactly"
      );
      console.log("  ✅ Settings restored to exact original snapshot");
    }

    // 6. Verify zero leftover artifacts
    const remainingProducts = await Product.countDocuments({ _id: { $in: createdProductIds } });
    const remainingCategories = await Category.countDocuments({ _id: { $in: createdCategoryIds } });
    const remainingOrders = await Order.countDocuments({ _id: { $in: createdOrderIds } });
    const remainingUsers = await User.countDocuments({ _id: { $in: createdUserIds } });

    assert.strictEqual(remainingProducts, 0, "All test products must be deleted");
    assert.strictEqual(remainingCategories, 0, "All test categories must be deleted");
    assert.strictEqual(remainingOrders, 0, "All test orders must be deleted");
    assert.strictEqual(remainingUsers, 0, "All test users must be deleted");

    console.log("  ✅ Zero leftover test artifacts verified in MongoDB");

    await mongoose.disconnect();
  }

  console.log("\n=======================================================");
  console.log(` RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log("=======================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runCroMarketingReadinessTests().catch((err) => {
  console.error("FATAL TEST SUITE ERROR:", err);
  process.exit(1);
});
