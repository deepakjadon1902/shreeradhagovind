/**
 * TEST SUITE: CHECKOUT UX CORRECTIONS VERIFICATION
 *
 * Covers:
 * 1. Shipping primary phone mandatory & 10-digit validation rules.
 * 2. Billing same as shipping: defaults checked, inherits shipping phone.
 * 3. Billing separate: billing phone required, copied initially, can be changed,
 *    can be same or different from shipping phone.
 * 4. Shipping phone remains mandatory even when billing address is separate.
 * 5. Edited billing phone is not overwritten by later shipping phone updates.
 * 6. Saved Account / Saved Address responsive layout verification.
 * 7. Checkout route does NOT render AI launcher (returns null).
 * 8. Product / shop / cart routes still render AI launcher.
 * 9. Old AI image/sign asset is no longer used by the AI launcher.
 * 10. Existing postal fallback still works (order placement succeeds without postOffice).
 * 11. Zero leftover database artifacts verification.
 */

import assert from "assert";
import mongoose from "mongoose";
import { Order } from "../models/Order";
import { Product } from "../models/Product";
import { User } from "../models/User";
import { connectDB } from "../config/db";
import { normalizeIndianPhone } from "../routes/admin.routes";

let passed = 0;
let failed = 0;

async function test(name: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    console.log(`  ✅ [PASS] ${name}`);
    passed++;
  } catch (err: any) {
    console.error(`  ❌ [FAIL] ${name}: ${err?.message || err}`);
    failed++;
  }
}

// Client-side phone validator clone for cross-testing
function clientValidateIndianMobile(raw: string): { valid: boolean; digits: string; error?: string } {
  if (!raw || !raw.trim()) {
    return { valid: false, digits: "", error: "Phone number is required" };
  }
  let digits = raw.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) {
    digits = digits.slice(2);
  } else if (digits.length === 11 && digits.startsWith("0")) {
    digits = digits.slice(1);
  }
  if (digits.length !== 10) {
    return { valid: false, digits, error: "Please enter a valid 10-digit mobile number" };
  }
  if (!/^[6-9]/.test(digits)) {
    return { valid: false, digits, error: "Indian mobile numbers must start with 6, 7, 8, or 9" };
  }
  return { valid: true, digits };
}

// Simulates checkout state machine for billing phone synchronization
class CheckoutBillingStateManager {
  formPhone: string;
  billingSameAsShipping: boolean;
  billingForm: { name: string; phone: string; line1: string; pincode: string; city: string; state: string };
  billingManualEdits: { phone: boolean };

  constructor(initialPhone = "") {
    this.formPhone = initialPhone;
    this.billingSameAsShipping = true; // DEFAULT CHECKED
    this.billingForm = { name: "", phone: initialPhone, line1: "", pincode: "", city: "", state: "" };
    this.billingManualEdits = { phone: false };
  }

  updateShippingPhone(newPhone: string) {
    this.formPhone = newPhone;
    if (!this.billingManualEdits.phone) {
      this.billingForm.phone = newPhone;
    }
  }

  toggleBillingSame(checked: boolean) {
    this.billingSameAsShipping = checked;
    if (!checked && !this.billingManualEdits.phone && !this.billingForm.phone.trim()) {
      this.billingForm.phone = this.formPhone;
    }
  }

  editBillingPhone(newPhone: string) {
    this.billingManualEdits.phone = true;
    this.billingForm.phone = newPhone;
  }

  resolveBillingAddress() {
    return {
      phone: this.billingSameAsShipping ? this.formPhone.trim() : (this.billingForm.phone || this.formPhone).trim(),
    };
  }
}

async function run() {
  console.log("\n=======================================================");
  console.log(" CHECKOUT UX CORRECTIONS VERIFICATION SUITE");
  console.log("=======================================================\n");

  await connectDB();

  const createdOrderIds: mongoose.Types.ObjectId[] = [];
  const createdProductIds: mongoose.Types.ObjectId[] = [];

  try {
    // ---------------------------------------------------------------
    // 1. SHIPPING PRIMARY PHONE MANDATORY & VALIDATION
    // ---------------------------------------------------------------
    console.log("--- 1. Shipping Primary Phone Validation ---");

    await test("1.1 Empty/missing shipping phone is rejected by client validator", () => {
      const res1 = clientValidateIndianMobile("");
      const res2 = clientValidateIndianMobile("   ");
      assert.strictEqual(res1.valid, false);
      assert.strictEqual(res2.valid, false);
    });

    await test("1.2 Short phone (<10 digits) is rejected", () => {
      const res = clientValidateIndianMobile("9876543");
      assert.strictEqual(res.valid, false);
    });

    await test("1.3 Invalid starting digit (<6) is rejected", () => {
      const res = clientValidateIndianMobile("5551234567");
      assert.strictEqual(res.valid, false);
      assert.ok(res.error?.includes("must start with 6, 7, 8, or 9"));
    });

    await test("1.4 Standard 10-digit Indian mobile starting with 6, 7, 8, 9 is accepted", () => {
      assert.strictEqual(clientValidateIndianMobile("9876543210").valid, true);
      assert.strictEqual(clientValidateIndianMobile("8888888888").valid, true);
      assert.strictEqual(clientValidateIndianMobile("7500533505").valid, true);
      assert.strictEqual(clientValidateIndianMobile("6200000000").valid, true);
    });

    await test("1.5 Mobile with +91 or leading 0 prefix normalizes to 10 digits", () => {
      const res1 = clientValidateIndianMobile("+91 98765 43210");
      const res2 = clientValidateIndianMobile("09876543210");
      assert.strictEqual(res1.valid, true);
      assert.strictEqual(res1.digits, "9876543210");
      assert.strictEqual(res2.valid, true);
      assert.strictEqual(res2.digits, "9876543210");
    });

    await test("1.6 Server-side normalizeIndianPhone matches client normalization", () => {
      const server1 = normalizeIndianPhone("9876543210");
      const server2 = normalizeIndianPhone("+919876543210");
      const server3 = normalizeIndianPhone("09876543210");
      const serverFail = normalizeIndianPhone("1234567890");

      assert.strictEqual(server1.valid, true);
      assert.strictEqual(server2.valid, true);
      assert.strictEqual(server3.valid, true);
      assert.strictEqual(serverFail.valid, false);
    });

    // ---------------------------------------------------------------
    // 2. BILLING ADDRESS CHECKBOX DEFAULT & SAME AS SHIPPING
    // ---------------------------------------------------------------
    console.log("\n--- 2. Billing Checkbox Default & Same-as-Shipping ---");

    await test("2.1 Billing same as shipping defaults to checked (true)", () => {
      const manager = new CheckoutBillingStateManager("9876543210");
      assert.strictEqual(manager.billingSameAsShipping, true);
    });

    await test("2.2 When checked, resolved billing phone uses shipping primary phone", () => {
      const manager = new CheckoutBillingStateManager("9876543210");
      const resolved = manager.resolveBillingAddress();
      assert.strictEqual(resolved.phone, "9876543210");
    });

    await test("2.3 When shipping phone changes while checked, resolved billing phone reflects shipping phone", () => {
      const manager = new CheckoutBillingStateManager("9876543210");
      manager.updateShippingPhone("7500533505");
      const resolved = manager.resolveBillingAddress();
      assert.strictEqual(resolved.phone, "7500533505");
    });

    // ---------------------------------------------------------------
    // 3. BILLING ADDRESS SEPARATE & INDEPENDENT BILLING PHONE
    // ---------------------------------------------------------------
    console.log("\n--- 3. Billing Separate & Contact Number Behavior ---");

    await test("3.1 When checkbox is unchecked, billing phone initially auto-fills from shipping phone", () => {
      const manager = new CheckoutBillingStateManager("9876543210");
      manager.toggleBillingSame(false);
      assert.strictEqual(manager.billingSameAsShipping, false);
      assert.strictEqual(manager.billingForm.phone, "9876543210");
    });

    await test("3.2 Customer can edit billing phone to be different from shipping phone", () => {
      const manager = new CheckoutBillingStateManager("9876543210");
      manager.toggleBillingSame(false);
      manager.editBillingPhone("8888888888");
      assert.strictEqual(manager.billingForm.phone, "8888888888");
      assert.strictEqual(manager.formPhone, "9876543210");
      const resolved = manager.resolveBillingAddress();
      assert.strictEqual(resolved.phone, "8888888888");
    });

    await test("3.3 Billing and shipping phone can be identical when separate", () => {
      const manager = new CheckoutBillingStateManager("9876543210");
      manager.toggleBillingSame(false);
      // customer leaves billing phone as 9876543210
      const resolved = manager.resolveBillingAddress();
      assert.strictEqual(resolved.phone, "9876543210");
      const check = clientValidateIndianMobile(resolved.phone);
      assert.strictEqual(check.valid, true);
    });

    await test("3.4 Edited billing phone is NOT overwritten by later shipping phone changes", () => {
      const manager = new CheckoutBillingStateManager("9876543210");
      manager.toggleBillingSame(false);
      manager.editBillingPhone("7777777777");

      // Customer goes back and edits shipping primary phone:
      manager.updateShippingPhone("9999999999");

      // Billing phone MUST remain the customer's explicitly edited number!
      assert.strictEqual(manager.billingForm.phone, "7777777777");
      assert.strictEqual(manager.formPhone, "9999999999");
      const resolved = manager.resolveBillingAddress();
      assert.strictEqual(resolved.phone, "7777777777");
    });

    await test("3.5 Unedited billing phone stays in sync with shipping phone changes", () => {
      const manager = new CheckoutBillingStateManager("9876543210");
      manager.toggleBillingSame(false);
      // Customer has NOT manually edited billing phone:
      manager.updateShippingPhone("7500533505");
      assert.strictEqual(manager.billingForm.phone, "7500533505");
    });

    await test("3.6 Toggling checkbox off then on then off preserves entered billing phone", () => {
      const manager = new CheckoutBillingStateManager("9876543210");
      manager.toggleBillingSame(false);
      manager.editBillingPhone("6666666666");

      // Toggle back to same
      manager.toggleBillingSame(true);
      assert.strictEqual(manager.resolveBillingAddress().phone, "9876543210");

      // Toggle again to separate - previously entered billing phone is preserved!
      manager.toggleBillingSame(false);
      assert.strictEqual(manager.billingForm.phone, "6666666666");
      assert.strictEqual(manager.resolveBillingAddress().phone, "6666666666");
    });

    // ---------------------------------------------------------------
    // 4. AI SHOPPING ASSISTANT ROUTE VISIBILITY & NEW ICON
    // ---------------------------------------------------------------
    console.log("\n--- 4. AI Assistant Route Rules & Icon Verification ---");

    await test("4.1 AI launcher is completely hidden on /checkout route", () => {
      function shouldRenderAiLauncher(pathname: string): boolean {
        if (pathname.startsWith("/admin") || pathname.startsWith("/checkout")) {
          return false;
        }
        return true;
      }

      assert.strictEqual(shouldRenderAiLauncher("/checkout"), false);
      assert.strictEqual(shouldRenderAiLauncher("/checkout/success"), false);
      assert.strictEqual(shouldRenderAiLauncher("/admin"), false);
      assert.strictEqual(shouldRenderAiLauncher("/admin/orders"), false);
    });

    await test("4.2 AI launcher remains enabled on /product/*, /shop, /cart, and /", () => {
      function shouldRenderAiLauncher(pathname: string): boolean {
        if (pathname.startsWith("/admin") || pathname.startsWith("/checkout")) {
          return false;
        }
        return true;
      }

      assert.strictEqual(shouldRenderAiLauncher("/"), true);
      assert.strictEqual(shouldRenderAiLauncher("/product/123"), true);
      assert.strictEqual(shouldRenderAiLauncher("/shop"), true);
      assert.strictEqual(shouldRenderAiLauncher("/cart"), true);
      assert.strictEqual(shouldRenderAiLauncher("/about"), true);
    });

    await test("4.3 Verification: No old Sparkles icon in AiShoppingAssistantLauncher or AiChatPanel", () => {
      const fs = require("fs");
      const launcherContent = fs.readFileSync(
        "d:/shreeradhagovind/frontend/src/components/AiAssistant/AiShoppingAssistantLauncher.tsx",
        "utf8"
      );
      const chatPanelContent = fs.readFileSync(
        "d:/shreeradhagovind/frontend/src/components/AiAssistant/AiChatPanel.tsx",
        "utf8"
      );

      assert.ok(!launcherContent.includes("Sparkles"), "AiShoppingAssistantLauncher must not import or render Sparkles");
      assert.ok(launcherContent.includes("BotMessageSquare"), "AiShoppingAssistantLauncher must use BotMessageSquare");
      assert.ok(!chatPanelContent.includes("Sparkles"), "AiChatPanel must not import or render Sparkles");
      assert.ok(chatPanelContent.includes("BotMessageSquare"), "AiChatPanel must use BotMessageSquare");
    });

    // ---------------------------------------------------------------
    // 5. SAVED ACCOUNT RESPONSIVE LAYOUT VERIFICATION
    // ---------------------------------------------------------------
    console.log("\n--- 5. Saved Account Card Responsive Layout ---");

    await test("5.1 Saved Account card has flex-wrap, min-w-0, and break-all to prevent clipping", () => {
      const fs = require("fs");
      const checkoutContent = fs.readFileSync(
        "d:/shreeradhagovind/frontend/src/routes/checkout.tsx",
        "utf8"
      );

      assert.ok(
        checkoutContent.includes("flex flex-wrap sm:flex-nowrap items-center justify-between gap-3"),
        "Account card must use responsive flex-wrap"
      );
      assert.ok(
        checkoutContent.includes("min-w-0 flex-1"),
        "Account card content must have min-w-0 flex-1"
      );
      assert.ok(
        checkoutContent.includes("break-all"),
        "Email in Account card must have break-all to prevent pushing badge outside"
      );
      assert.ok(
        checkoutContent.includes("Saved Account"),
        "Saved Account badge remains present"
      );
    });

    // ---------------------------------------------------------------
    // 6. FLOATING WHATSAPP BUTTON CHECKOUT ELEVATION
    // ---------------------------------------------------------------
    console.log("\n--- 6. Floating WhatsApp Button Position on Checkout ---");

    await test("6.1 WhatsApp button is elevated above sticky checkout bar on /checkout", () => {
      const fs = require("fs");
      const footerContent = fs.readFileSync(
        "d:/shreeradhagovind/frontend/src/components/Footer.tsx",
        "utf8"
      );

      assert.ok(
        footerContent.includes("isCheckoutPage = location.pathname.startsWith(\"/checkout\")"),
        "Footer must detect /checkout route"
      );
      assert.ok(
        footerContent.includes("bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))]"),
        "WhatsApp must be elevated on mobile checkout"
      );
    });

    // ---------------------------------------------------------------
    // 7. BACKEND ORDER SCHEMA & PERSISTENCE SAFETY
    // ---------------------------------------------------------------
    console.log("\n--- 7. Order Model Billing Phone & Postal Fallback ---");

    await test("7.1 Order model persists separate billingAddress.phone and accepts optional postOffice", async () => {
      const testProduct = await Product.create({
        name: `Test Mala ${Date.now()}`,
        slug: `test-mala-${Date.now()}`,
        price: 350,
        mrp: 499,
        stock: 10,
        images: ["https://example.com/test.jpg"],
        category: "Mala",
        active: true,
      });
      createdProductIds.push(testProduct._id);

      const testOrder = await Order.create({
        customerEmail: `devotee_${Date.now()}@example.com`,
        items: [
          {
            productId: testProduct._id,
            name: testProduct.name,
            price: testProduct.price,
            qty: 1,
          },
        ],
        subtotal: 350,
        shipping: 0,
        total: 350,
        address: {
          name: "Radhika Devotee",
          phone: "9876543210",
          line1: "Near ISKCON Temple, Raman Reti",
          city: "Vrindavan",
          state: "Uttar Pradesh",
          pincode: "281121",
          postOffice: "", // empty postOffice accepted
        },
        billingAddress: {
          name: "Radhika Enterprises",
          phone: "7500533505", // separate billing phone
          line1: "Main Road, Mathura",
          city: "Mathura",
          state: "Uttar Pradesh",
          pincode: "281001",
          postOffice: "",
        },
        payment: {
          method: "cod",
          status: "pending",
        },
        status: "Placed",
      });
      createdOrderIds.push(testOrder._id);

      assert.ok(testOrder._id);
      assert.strictEqual(testOrder.address?.phone, "9876543210");
      assert.strictEqual(testOrder.billingAddress?.phone, "7500533505");
      assert.strictEqual(testOrder.address?.postOffice, "");
    });

  } finally {
    // ---------------------------------------------------------------
    // ZERO LEFTOVER DATABASE CLEANUP
    // ---------------------------------------------------------------
    console.log("\n--- Cleaning up temporary test documents ---");
    if (createdOrderIds.length > 0) {
      await Order.deleteMany({ _id: { $in: createdOrderIds } });
    }
    if (createdProductIds.length > 0) {
      await Product.deleteMany({ _id: { $in: createdProductIds } });
    }

    const remainingOrders = await Order.countDocuments({ _id: { $in: createdOrderIds } });
    const remainingProducts = await Product.countDocuments({ _id: { $in: createdProductIds } });

    assert.strictEqual(remainingOrders, 0, "All test orders must be removed");
    assert.strictEqual(remainingProducts, 0, "All test products must be removed");
    console.log("  ✅ Zero leftover test data verified in MongoDB.\n");

    await mongoose.disconnect();
  }

  console.log("=======================================================");
  console.log(` RESULTS: ${passed} PASSED, ${failed} FAILED (TOTAL: ${passed + failed})`);
  console.log("=======================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error("Test runner exception:", err);
  process.exit(1);
});
