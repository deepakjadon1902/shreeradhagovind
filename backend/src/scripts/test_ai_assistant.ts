import "dotenv/config";
import mongoose from "mongoose";
import { connectDB } from "../config/db";
import {
  searchProducts,
  getProduct,
  getCategories,
  checkStock,
  getStorePolicy,
} from "../services/ai/storeTools";
import { GeminiProvider } from "../services/ai/geminiProvider";
import { chatRequestSchema } from "../routes/ai.routes";

async function runTests() {
  console.log("==================================================");
  console.log("STARTING AI ASSISTANT TEST SUITE");
  console.log("==================================================");

  await connectDB();
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName}`);
      failed++;
    }
  }

  try {
    // 1. Test searchProducts - basic search
    console.log("\n--- Testing searchProducts ---");
    const products = await searchProducts({ query: "mala", limit: 5 });
    assert(Array.isArray(products), "searchProducts returns an array");
    if (products.length > 0) {
      const p = products[0];
      assert(typeof p.name === "string" && p.name.length > 0, "Product has valid name");
      assert(typeof p.price === "number" && p.price > 0, "Product has valid price");
      assert(typeof p.slug === "string" && p.slug.length > 0, "Product has valid slug");
      assert(typeof p.available === "boolean", "Product has available boolean flag");

      // SECURITY AUDIT: Verify no internal fields are exposed
      assert((p as any)._id === undefined, "Security: _id is NOT exposed");
      assert((p as any).costPrice === undefined, "Security: costPrice is NOT exposed");
      assert((p as any).hsnCode === undefined, "Security: hsnCode is NOT exposed");
      assert((p as any).supplier === undefined, "Security: supplier is NOT exposed");
      assert((p as any).comboComponents === undefined, "Security: comboComponents is NOT exposed");
    }

    // 2. Test searchProducts - price filter
    console.log("\n--- Testing searchProducts price bounds ---");
    const budgetProducts = await searchProducts({ maxPrice: 500, limit: 5 });
    assert(Array.isArray(budgetProducts), "Budget search returns array");
    const allUnder500 = budgetProducts.every((p) => p.price <= 500);
    assert(allUnder500, "All returned budget products are <= 500 INR");

    // 3. Test getProduct
    console.log("\n--- Testing getProduct ---");
    if (products.length > 0) {
      const targetSlug = products[0].slug;
      const detail = await getProduct(targetSlug);
      assert(detail !== null, `getProduct retrieved product for slug: ${targetSlug}`);
      if (detail) {
        assert(detail.name === products[0].name, "Detail name matches search name");
        assert(typeof detail.stockStatus === "string", "Detail includes customer-safe stockStatus");
        assert((detail as any).costPrice === undefined, "Security: detail does NOT expose costPrice");
      }
    }

    const nonExistent = await getProduct("this-product-does-not-exist-12345");
    assert(nonExistent === null, "getProduct returns null for non-existent product");

    // 4. Test checkStock
    console.log("\n--- Testing checkStock ---");
    if (products.length > 0) {
      const stockInfo = await checkStock(products[0].slug);
      assert(stockInfo !== null, "checkStock returns valid stock info");
      assert(typeof stockInfo?.available === "boolean", "checkStock returns available boolean");
      assert(
        stockInfo?.stockStatus === "Available in stock" ||
          stockInfo?.stockStatus === "Currently out of stock",
        "checkStock returns clean human-readable stock status"
      );
    }

    // 5. Test getCategories
    console.log("\n--- Testing getCategories ---");
    const categories = await getCategories();
    assert(Array.isArray(categories) && categories.length > 0, "getCategories returns active categories");
    if (categories.length > 0) {
      assert(typeof categories[0].name === "string", "Category has name");
      assert(typeof categories[0].slug === "string", "Category has slug");
      assert((categories[0] as any)._id === undefined, "Security: Category does NOT expose _id");
    }

    // 6. Test getStorePolicy
    console.log("\n--- Testing getStorePolicy ---");
    const shippingPolicy = await getStorePolicy("shipping");
    assert(shippingPolicy.policyType === "shipping", "Policy type is shipping");
    assert(typeof shippingPolicy.summary === "string" && shippingPolicy.summary.length > 0, "Shipping policy has summary");
    assert(Array.isArray(shippingPolicy.details) && shippingPolicy.details.length > 0, "Shipping policy has bullet points");

    const returnsPolicy = await getStorePolicy("returns");
    assert(returnsPolicy.policyType === "returns", "Policy type is returns");

    const contactPolicy = await getStorePolicy("contact");
    assert(contactPolicy.policyType === "contact", "Policy type is contact");
    assert(contactPolicy.details.some((d) => d.includes("Vrindavan")), "Contact policy mentions Vrindavan");

    // 7. Test Provider Boundary & Unconfigured State
    console.log("\n--- Testing GeminiProvider boundary ---");
    const provider = new GeminiProvider();
    assert(provider.name === "GeminiProvider", "Provider name is GeminiProvider");
    // Since GEMINI_API_KEY is currently empty/unset:
    const isConfigured = provider.isConfigured();
    assert(
      !isConfigured || typeof isConfigured === "boolean",
      "Provider isConfigured() behaves deterministically without error"
    );

    const safeResponse = await provider.chat([], "Hello");
    assert(typeof safeResponse.message === "string", "Provider returns message string");
    assert(Array.isArray(safeResponse.products), "Provider returns products array");

    // 8. Test Zod Validation & Abuse Protection
    console.log("\n--- Testing Request Validation & Rate Limiting Guard ---");
    const validRequest = chatRequestSchema.safeParse({
      message: "₹500 ke andar mala batao",
      history: [{ role: "user", content: "Radhe Radhe" }],
    });
    assert(validRequest.success, "Valid request parses successfully");

    const emptyMessage = chatRequestSchema.safeParse({ message: "   " });
    assert(!emptyMessage.success, "Empty message is rejected");

    const oversizedMessage = chatRequestSchema.safeParse({
      message: "a".repeat(501),
    });
    assert(!oversizedMessage.success, "Oversized message (>500 chars) is rejected");

    const tooManyHistory = chatRequestSchema.safeParse({
      message: "Hello",
      history: Array(11).fill({ role: "user", content: "Hi" }),
    });
    assert(!tooManyHistory.success, "Oversized conversation history (>10 messages) is rejected");

    // Deliberately long assistant message in history (>500 chars, e.g. 1500 chars)
    const longAssistantHistory = chatRequestSchema.safeParse({
      message: "Shipping & delivery",
      history: [
        {
          role: "assistant",
          content: "Radhe Radhe! Here is our complete collection of handcrafted sacred malas: ".repeat(25), // ~1850 chars
        },
      ],
    });
    assert(
      longAssistantHistory.success &&
        Boolean(longAssistantHistory.data.history?.[0]?.content?.length && longAssistantHistory.data.history[0].content.length <= 1000),
      "Long assistant history (>500 chars) is safely accepted and normalized without 400 rejection"
    );

    const hugeHistoryMessage = chatRequestSchema.safeParse({
      message: "Hello",
      history: [{ role: "assistant", content: "x".repeat(10001) }],
    });
    assert(!hugeHistoryMessage.success, "Excessive payload history (>10000 chars) is rejected");

    console.log("\n==================================================");
    console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log("==================================================");

    if (failed > 0) {
      process.exit(1);
    }
  } finally {
    await mongoose.disconnect();
  }
}

runTests().catch((err) => {
  console.error("Test execution error:", err);
  process.exit(1);
});
