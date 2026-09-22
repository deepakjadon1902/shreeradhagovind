import "dotenv/config";
import mongoose from "mongoose";
import { connectDB } from "../config/db";
import { generateLlmsTxt, generateLlmsFullTxt, SITE_URL } from "../services/llms/llmsGenerator";
import { Product } from "../models/Product";
import { Category } from "../models/Category";
import { Blog } from "../models/Blog";
import { Settings } from "../models/Settings";
import { app } from "../app";
import http from "http";

async function runLlmsTests() {
  console.log("==================================================");
  console.log("STARTING LLMS.TXT SYSTEM TEST SUITE (24 CRITERIA)");
  console.log("==================================================");

  await connectDB();
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName}${detail ? ` -> ${detail}` : ""}`);
      failed++;
    }
  }

  // Start temporary HTTP server to test real HTTP responses
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // 1. GET /llms.txt -> HTTP 200
    console.log("\n--- 1. Testing HTTP 200 Response ---");
    const resLlms = await fetch(`${baseUrl}/llms.txt`);
    assert(resLlms.status === 200, "1. GET /llms.txt returns HTTP 200", `Got ${resLlms.status}`);

    // 2. Correct Content-Type
    console.log("\n--- 2. Testing Content-Type ---");
    const contentType = resLlms.headers.get("content-type") || "";
    assert(
      contentType.includes("text/plain") && contentType.includes("utf-8"),
      "2. Content-Type is text/plain; charset=utf-8",
      `Got ${contentType}`
    );

    const llmsText = await resLlms.text();

    // 3. Valid Markdown Structure
    console.log("\n--- 3. Testing Markdown Structure ---");
    const hasH1 = /^# Shri Radha Govind Store/m.test(llmsText);
    const hasQuote = /^> Shri Radha Govind Store is a devotional/m.test(llmsText);
    const hasAbout = /^## About/m.test(llmsText);
    const hasOffer = /^## What We Offer/m.test(llmsText);
    const hasCatalogue = /^## Product Catalogue/m.test(llmsText);
    const hasPolicies = /^## Store Policies/m.test(llmsText);
    const hasSources = /^## Authoritative Sources/m.test(llmsText);
    assert(
      hasH1 && hasQuote && hasAbout && hasOffer && hasCatalogue && hasPolicies && hasSources,
      "3. Valid Markdown structure with all required core sections"
    );

    // 4. Production Domain URLs Only
    console.log("\n--- 4. Testing URL Domain Quality ---");
    const allUrls = Array.from(llmsText.matchAll(/https?:\/\/[^\s)\],]+/g)).map((m) => m[0]);
    const invalidDomainUrls = allUrls.filter((url) => !url.startsWith("https://www.shriradhagovindstore.com"));
    assert(
      invalidDomainUrls.length === 0,
      "4. All absolute URLs use production domain https://www.shriradhagovindstore.com",
      invalidDomainUrls.join(", ")
    );

    // 5. No localhost URLs
    console.log("\n--- 5. Testing for Localhost URLs ---");
    const hasLocalhost = /localhost|127\.0\.0\.1|::1/i.test(llmsText);
    assert(!hasLocalhost, "5. Zero localhost URLs found in /llms.txt");

    // 6. No API URLs
    console.log("\n--- 6. Testing for Internal API URLs ---");
    const hasApiUrl = /https?:\/\/[^\s)\],]*\/api\//i.test(llmsText);
    assert(!hasApiUrl, "6. Zero /api/ URLs exposed in /llms.txt");

    // 7. No Admin or Private Transactional URLs
    console.log("\n--- 7. Testing for Admin/Private URLs ---");
    const privateKeywords = ["/admin", "/cart", "/checkout", "/login", "/signup", "/forgot-password", "/orders", "/profile", "/wishlist", "/track"];
    const leakedPrivateUrls = allUrls.filter((url) => privateKeywords.some((kw) => url.includes(kw)));
    assert(leakedPrivateUrls.length === 0, "7. Zero admin or customer private transactional URLs", leakedPrivateUrls.join(", "));

    // 8. No Customer or Order Information
    console.log("\n--- 8. Testing for Customer/Order Leaks ---");
    const hasOrderLeak = /order#[0-9]|customer_id|customer_email|consignee/i.test(llmsText);
    assert(!hasOrderLeak, "8. Zero customer or order information present");

    // 9. No Environment Secrets
    console.log("\n--- 9. Testing for Secret Leaks ---");
    const envValues = [
      process.env.GEMINI_API_KEY,
      process.env.MONGODB_URI,
      process.env.JWT_SECRET,
      process.env.RAZORPAY_KEY_SECRET,
      process.env.RESEND_API_KEY,
    ].filter(Boolean) as string[];
    const leakedSecrets = envValues.filter((secret) => secret.length > 6 && llmsText.includes(secret));
    assert(leakedSecrets.length === 0, "9. Zero environment variables or credentials leaked");

    // 10. Active Products Included
    console.log("\n--- 10. Testing Active Products Inclusion ---");
    const activeDbProducts = await Product.find({ isActive: { $ne: false } }).lean();
    const allActiveFound = activeDbProducts.every((p) => llmsText.includes(p.name));
    assert(allActiveFound, `10. All ${activeDbProducts.length} active products included in catalogue`);

    // 11. Inactive Products Excluded
    console.log("\n--- 11. Testing Inactive Products Exclusion ---");
    const inactiveDbProducts = await Product.find({ isActive: false }).lean();
    const anyInactiveFound = inactiveDbProducts.some((p) => llmsText.includes(p.name));
    assert(!anyInactiveFound && inactiveDbProducts.length > 0, `11. Inactive products (${inactiveDbProducts.length} in DB) strictly excluded from /llms.txt`);

    // 12. Active Categories Included
    console.log("\n--- 12. Testing Active Categories Inclusion ---");
    const rootCategories = await Category.find({ isActive: { $ne: false }, parentId: null }).lean();
    const rootCatsFound = rootCategories.every((c) => llmsText.includes(c.name));
    assert(rootCatsFound, `12. Active root categories (${rootCategories.length}) included in /llms.txt`);

    // 13. Inactive Categories Excluded
    console.log("\n--- 13. Testing Inactive Categories Exclusion ---");
    const inactiveCategories = await Category.find({ isActive: false }).lean();
    const anyInactiveCatFound = inactiveCategories.some((c) => llmsText.includes(c.name));
    assert(!anyInactiveCatFound, "13. Inactive categories strictly excluded");

    // 14. Published Blogs Included in llms-full.txt
    console.log("\n--- 14. Testing Published Blogs in /llms-full.txt ---");
    const resFull = await fetch(`${baseUrl}/llms-full.txt`);
    const fullText = await resFull.text();
    const publishedBlogs = await Blog.find({ isPublished: { $ne: false } }).lean();
    const blogsFound = publishedBlogs.every((b) => fullText.includes(b.title));
    assert(blogsFound && publishedBlogs.length > 0, `14. Published blog articles (${publishedBlogs.length}) included in /llms-full.txt`);

    // 15. Draft Blogs Excluded
    console.log("\n--- 15. Testing Draft Blogs Exclusion ---");
    const draftBlogs = await Blog.find({ isPublished: false }).lean();
    const anyDraftFound = draftBlogs.some((b) => fullText.includes(b.title));
    assert(!anyDraftFound, "15. Draft blog articles strictly excluded");

    // 16. Current Public Prices Come From Real Product Source
    console.log("\n--- 16. Testing Live Price Accuracy ---");
    let pricesAccurate = true;
    for (const p of activeDbProducts.slice(0, 5)) {
      const priceStr = `₹${p.price.toLocaleString("en-IN")}`;
      if (!llmsText.includes(priceStr)) {
        pricesAccurate = false;
        console.error(`Price ${priceStr} not found for product ${p.name}`);
      }
    }
    assert(pricesAccurate, "16. Public prices in /llms.txt match live MongoDB database prices");

    // 17. Product Canonical URLs are Correct
    console.log("\n--- 17. Testing Product Canonical URLs ---");
    const productUrlsValid = activeDbProducts.every((p) => {
      const expected = `https://www.shriradhagovindstore.com/product/${p.slug}`;
      return llmsText.includes(expected);
    });
    assert(productUrlsValid, "17. Product canonical URLs use https://www.shriradhagovindstore.com/product/:slug");

    // 18. Category Canonical URLs are Correct
    console.log("\n--- 18. Testing Category Canonical URLs ---");
    const catUrlsValid = rootCategories.every((c) => {
      const expected = `https://www.shriradhagovindstore.com/shop?cat=${encodeURIComponent(c.name)}`;
      return llmsText.includes(expected);
    });
    assert(catUrlsValid, "18. Category canonical URLs use https://www.shriradhagovindstore.com/shop?cat=:category");

    // 19. /llms-full.txt Works and is Complete
    console.log("\n--- 19. Testing /llms-full.txt Completeness ---");
    assert(
      resFull.status === 200 &&
      fullText.includes("# Shri Radha Govind Store - Full Public Knowledge Base & Catalogue") &&
      fullText.includes("## Complete Active Product Catalogue") &&
      fullText.includes("## Detailed Store Policies"),
      "19. /llms-full.txt returns HTTP 200 and includes expanded catalogue & policies"
    );

    // 20. Empty Catalogue Handled Safely
    console.log("\n--- 20. Testing Empty Catalogue Handling ---");
    const originalFind = Product.find;
    (Product as any).find = () => ({
      select: () => ({
        sort: () => ({
          lean: async () => [],
        }),
      }),
    });
    try {
      const emptyMarkdown = await generateLlmsTxt({ forceFresh: true });
      assert(
        emptyMarkdown.includes("# Shri Radha Govind Store") && emptyMarkdown.includes("(0 active products)"),
        "20. Empty product catalogue handled safely without errors"
      );
    } finally {
      (Product as any).find = originalFind;
    }

    // 21. Database Failure Does Not Generate Fake Content
    console.log("\n--- 21. Testing Database Error Fallback ---");
    (Product as any).find = () => {
      throw new Error("Simulated DB Outage");
    };
    try {
      const errRes = await fetch(`${baseUrl}/llms.txt?fresh=true`);
      const errText = await errRes.text();
      assert(
        errRes.status === 500 && !errText.includes("₹") && errText.includes("Database service is currently unavailable"),
        "21. Database failure safely reports unavailable status without inventing fake products or prices"
      );
    } finally {
      (Product as any).find = originalFind;
    }

    // 22. Existing sitemap.xml Remains Functional
    console.log("\n--- 22. Testing Sitemap File Integrity ---");
    const fs = await import("fs");
    const sitemapCode = fs.readFileSync("d:/shreeradhagovind/frontend/src/routes/sitemap[.]xml.ts", "utf-8");
    const sitemapHasLlms = sitemapCode.includes("llms.txt");
    assert(!sitemapHasLlms && sitemapCode.includes("urlset"), "22. sitemap.xml remains functional and does NOT include /llms.txt");

    // 23. Existing robots.txt Remains Functional
    console.log("\n--- 23. Testing robots.txt Integrity ---");
    const robotsCode = fs.readFileSync("d:/shreeradhagovind/frontend/public/robots.txt", "utf-8");
    const allowsRoot = robotsCode.includes("Allow: /");
    const disallowsAdmin = robotsCode.includes("Disallow: /admin");
    const hasSitemap = robotsCode.includes("Sitemap: https://www.shriradhagovindstore.com/sitemap.xml");
    assert(allowsRoot && disallowsAdmin && hasSitemap, "23. robots.txt maintains Allow: /, private route Disallow, and Sitemap reference");

    // 24. Coexistence with AI Assistant Tools
    console.log("\n--- 24. Testing AI Assistant Coexistence ---");
    const { searchProducts, checkStock, getStorePolicy } = await import("../services/ai/storeTools");
    const aiSearch = await searchProducts({ query: "Tulsi", limit: 3 });
    const stockInfo = await checkStock(activeDbProducts[0].name);
    const policy = await getStorePolicy("shipping");
    assert(
      Array.isArray(aiSearch) && stockInfo !== null && Boolean(policy?.summary),
      "24. AI Shopping Assistant tools continue functioning independently with live MongoDB data"
    );

  } finally {
    server.close();
    await mongoose.disconnect();
  }

  console.log("\n==================================================");
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log("==================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runLlmsTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
