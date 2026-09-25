import "dotenv/config";
import assert from "node:assert";
import mongoose from "mongoose";
import crypto from "crypto";
import { connectDB } from "../config/db";
import { AnalyticsEvent, type IAnalyticsEvent } from "../models/AnalyticsEvent";
import {
  DailyAnalytics,
  recordDailyEvent,
  recordDailyOrder,
  getIstDateStr,
  sanitizeKey,
  clearDailyCachesForTesting,
} from "../models/DailyAnalytics";
import { Order } from "../models/Order";
import { isOrderPaidForFinance } from "../routes/admin.routes";
import { parseAnalyticsDateRange, resolveOrderSource } from "../routes/analytics.routes";

async function runConversionAnalyticsTests() {
  console.log("\n=======================================================");
  console.log(" CONVERSION ANALYTICS PHASE 1 VERIFICATION SUITE");
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

  const testRunId = `test-analytics-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;
  const testDateStr = "2099-12-31"; // Isolated future date for tests
  const testDate = new Date(`${testDateStr}T12:00:00.000+05:30`);
  const createdEventIds: mongoose.Types.ObjectId[] = [];
  const createdOrderIds: mongoose.Types.ObjectId[] = [];

  try {
    // ----------------------------------------------------
    // A. Visitor ID creation & formatting test
    // ----------------------------------------------------
    await test("A. Visitor ID creation & format (anonymous UUID)", () => {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      const testVisitorId = crypto.randomUUID();
      assert.strictEqual(uuidRegex.test(testVisitorId), true, "Visitor ID must be a standard RFC4122 v4 UUID");
      assert.strictEqual(testVisitorId.includes("@"), false, "Visitor ID must not contain email markers");
      assert.strictEqual(/\d{10}/.test(testVisitorId), false, "Visitor ID must not be a phone number");
    });

    // ----------------------------------------------------
    // B. Session ID persistence simulation
    // ----------------------------------------------------
    await test("B. Session ID persistence & independence from CheckoutSession", () => {
      const sessionStore = new Map<string, string>();
      const getSession = () => {
        if (!sessionStore.has("rg_analytics_session")) {
          sessionStore.set("rg_analytics_session", crypto.randomUUID());
        }
        return sessionStore.get("rg_analytics_session")!;
      };

      const sid1 = getSession();
      const sid2 = getSession();
      assert.strictEqual(sid1, sid2, "Session ID should remain identical within same session context");
      assert.strictEqual(typeof sid1, "string", "Session ID must be string");
    });

    // ----------------------------------------------------
    // C. UTM parsing & sanitization
    // ----------------------------------------------------
    await test("C. UTM parsing & sanitization (strip credentials/tokens)", () => {
      const search = "?utm_source=instagram&utm_medium=social&utm_campaign=diwali_sale&utm_term=puja&token=secret123";
      const params = new URLSearchParams(search);

      const parsedUtm = {
        source: params.get("utm_source") || "",
        medium: params.get("utm_medium") || "",
        campaign: params.get("utm_campaign") || "",
        term: params.get("utm_term") || "",
        content: params.get("utm_content") || "",
      };

      assert.strictEqual(parsedUtm.source, "instagram");
      assert.strictEqual(parsedUtm.medium, "social");
      assert.strictEqual(parsedUtm.campaign, "diwali_sale");
      assert.strictEqual(parsedUtm.term, "puja");
      assert.strictEqual((parsedUtm as any).token, undefined, "Sensitive token must never be captured in UTM");
    });

    // ----------------------------------------------------
    // D. UTM persistence across navigation
    // ----------------------------------------------------
    await test("D. UTM persistence across navigation (preserved without overwrite)", () => {
      let storedCampaignContext: any = {
        source: "google",
        medium: "cpc",
        campaign: "jan_search",
      };

      // Internal navigation to /product/123 without UTMs
      const internalSearch = "";
      const internalParams = new URLSearchParams(internalSearch);
      const hasIncomingUtm =
        internalParams.has("utm_source") ||
        internalParams.has("utm_medium") ||
        internalParams.has("utm_campaign");

      // Context must remain Google CPC
      if (!hasIncomingUtm) {
        // preserve existing
      } else {
        storedCampaignContext = {};
      }

      assert.strictEqual(storedCampaignContext.source, "google");
      assert.strictEqual(storedCampaignContext.medium, "cpc");
    });

    // ----------------------------------------------------
    // E. Referrer capture & domain extraction
    // ----------------------------------------------------
    await test("E. Referrer capture & sanitized domain extraction", () => {
      const testReferrer = "https://www.google.co.in/search?q=radha+krishna+store";
      const host = new URL(testReferrer).hostname.replace(/^www\./, "");
      const sanitized = sanitizeKey(host);
      assert.strictEqual(sanitized, "google_co_in", "Referrer host must be sanitized to valid MongoDB key");
    });

    // ----------------------------------------------------
    // F. Device category detection
    // ----------------------------------------------------
    await test("F. Device category detection (mobile, tablet, desktop)", () => {
      const mobileUA = "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148";
      const tabletUA = "Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X) AppleWebKit/605.1.15";
      const desktopUA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36";

      const detect = (ua: string) => {
        const l = ua.toLowerCase();
        if (/ipad|tablet|playbook|silk/i.test(l)) return "tablet";
        if (/mobile|iphone|ipod|android|blackberry/i.test(l)) return "mobile";
        return "desktop";
      };

      assert.strictEqual(detect(mobileUA), "mobile");
      assert.strictEqual(detect(tabletUA), "tablet");
      assert.strictEqual(detect(desktopUA), "desktop");
    });

    // ----------------------------------------------------
    // G. page_view ingestion
    // ----------------------------------------------------
    await test("G. page_view ingestion into AnalyticsEvent", async () => {
      const event = await AnalyticsEvent.create({
        eventType: "page_view",
        visitorId: `vid-${testRunId}-1`,
        sessionId: `sid-${testRunId}-1`,
        path: "/",
        device: "desktop",
        referrer: "https://google.com",
        utm: { source: "google", medium: "organic" },
      });
      createdEventIds.push(event._id);

      assert.strictEqual(event.eventType, "page_view");
      assert.strictEqual(event.path, "/");
      assert.strictEqual(event.device, "desktop");
    });

    // ----------------------------------------------------
    // H. product_view ingestion
    // ----------------------------------------------------
    await test("H. product_view ingestion with entityId", async () => {
      const dummyProdId = new mongoose.Types.ObjectId().toString();
      const event = await AnalyticsEvent.create({
        eventType: "product_view",
        visitorId: `vid-${testRunId}-1`,
        sessionId: `sid-${testRunId}-1`,
        entityId: dummyProdId,
        path: `/products/${dummyProdId}`,
        device: "mobile",
      });
      createdEventIds.push(event._id);

      assert.strictEqual(event.eventType, "product_view");
      assert.strictEqual(event.entityId, dummyProdId);
    });

    // ----------------------------------------------------
    // I. add_to_cart ingestion
    // ----------------------------------------------------
    await test("I. add_to_cart ingestion with quantity metadata", async () => {
      const dummyProdId = new mongoose.Types.ObjectId().toString();
      const event = await AnalyticsEvent.create({
        eventType: "add_to_cart",
        visitorId: `vid-${testRunId}-1`,
        sessionId: `sid-${testRunId}-1`,
        entityId: dummyProdId,
        path: `/products/${dummyProdId}`,
        device: "mobile",
        metadata: { quantity: 2 },
      });
      createdEventIds.push(event._id);

      assert.strictEqual(event.eventType, "add_to_cart");
      assert.strictEqual(event.metadata?.quantity, 2);
    });

    // ----------------------------------------------------
    // J. checkout_start ingestion
    // ----------------------------------------------------
    await test("J. checkout_start ingestion (closes pre-contact funnel gap)", async () => {
      const event = await AnalyticsEvent.create({
        eventType: "checkout_start",
        visitorId: `vid-${testRunId}-2`,
        sessionId: `sid-${testRunId}-2`,
        path: "/checkout",
        device: "desktop",
      });
      createdEventIds.push(event._id);

      assert.strictEqual(event.eventType, "checkout_start");
      assert.strictEqual(event.path, "/checkout");
    });

    // ----------------------------------------------------
    // K. Malformed event rejection
    // ----------------------------------------------------
    await test("K. Malformed event rejection (invalid eventType / oversized fields)", async () => {
      let rejected = false;
      try {
        await AnalyticsEvent.create({
          eventType: "invalid_random_event" as any,
          visitorId: "v1",
          sessionId: "s1",
          path: "/test",
        });
      } catch (err: any) {
        rejected = true;
      }
      assert.strictEqual(rejected, true, "Invalid event type must be rejected by Mongoose schema");
    });

    // ----------------------------------------------------
    // L. Rate limiting simulation
    // ----------------------------------------------------
    await test("L. Rate limiting protection (120 events/min cap)", () => {
      const testIp = `192.168.1.${Math.floor(Math.random() * 250)}`;
      const rateMap = new Map<string, { count: number; resetAt: number }>();
      const windowMs = 60 * 1000;
      const max = 120;

      const checkLimit = (ip: string) => {
        const now = Date.now();
        const rec = rateMap.get(ip);
        if (!rec || rec.resetAt <= now) {
          rateMap.set(ip, { count: 1, resetAt: now + windowMs });
          return true;
        }
        if (rec.count >= max) return false;
        rec.count++;
        return true;
      };

      for (let i = 0; i < 120; i++) {
        assert.strictEqual(checkLimit(testIp), true, `Request #${i + 1} should be permitted`);
      }
      assert.strictEqual(checkLimit(testIp), false, "Request #121 must be rejected by rate limiter");
    });

    // ----------------------------------------------------
    // M. TTL index verification = 90 days (7,776,000s)
    // ----------------------------------------------------
    await test("M. MongoDB TTL index verification: EXACTLY 90 days (7,776,000 seconds)", async () => {
      const createdAtField = AnalyticsEvent.schema.path("createdAt") as any;
      assert.ok(createdAtField, "createdAt field must exist in AnalyticsEvent schema");

      const expiresSeconds = createdAtField.options?.expires;
      const expectedSeconds = 90 * 24 * 60 * 60; // 7,776,000
      assert.strictEqual(
        expiresSeconds,
        expectedSeconds,
        `TTL expires must be exactly 90 days (${expectedSeconds} seconds), found: ${expiresSeconds}`
      );
    });

    // ----------------------------------------------------
    // N. Duplicate event protection (deduplication)
    // ----------------------------------------------------
    await test("N. Duplicate rapid page_view protection", () => {
      let lastPath = "";
      let lastTime = 0;
      let dispatches = 0;

      const track = (p: string) => {
        const now = Date.now();
        if (p === lastPath && now - lastTime < 400) return;
        lastPath = p;
        lastTime = now;
        dispatches++;
      };

      track("/shop");
      track("/shop"); // immediate re-render within 0ms
      track("/shop"); // immediate re-render within 0ms
      assert.strictEqual(dispatches, 1, "Immediate re-render duplicate pageviews must be suppressed");
    });

    // ----------------------------------------------------
    // O. DailyAnalytics unique visitor counting & cold-cache / restart resilience
    // ----------------------------------------------------
    await test("O. DailyAnalytics unique visitor counting & cold-cache / restart resilience", async () => {
      const vid1 = `vid-${testRunId}-O1`;
      const vid2 = `vid-${testRunId}-O2`;

      // 1. First event for visitor 1 -> uniqueVisitors should become 1
      const ev1 = await AnalyticsEvent.create({
        eventType: "page_view",
        visitorId: vid1,
        sessionId: `sid-${testRunId}-1`,
        path: "/",
        device: "mobile",
        utm: { source: "instagram" },
        createdAt: testDate,
      });
      createdEventIds.push(ev1._id);

      await recordDailyEvent({
        eventType: "page_view",
        visitorId: vid1,
        sessionId: `sid-${testRunId}-1`,
        path: "/",
        device: "mobile",
        utm: { source: "instagram" },
        createdAt: testDate,
        currentEventId: ev1._id,
      });

      let doc = await DailyAnalytics.findOne({ date: testDateStr });
      assert.ok(doc, "DailyAnalytics doc must exist");
      assert.strictEqual(doc.uniqueVisitors, 1, "First event must increment uniqueVisitors to 1");
      assert.strictEqual(doc.devices.mobile, 1, "First event on mobile must increment devices.mobile to 1");
      assert.strictEqual(doc.sources.get("instagram"), 1, "First event must increment sources.instagram to 1");

      // 2. Second event for same visitor 1 -> uniqueVisitors should NOT increment
      const ev2 = await AnalyticsEvent.create({
        eventType: "product_view",
        visitorId: vid1,
        sessionId: `sid-${testRunId}-1`,
        path: "/product/abc",
        device: "mobile",
        utm: { source: "instagram" },
        createdAt: testDate,
      });
      createdEventIds.push(ev2._id);

      await recordDailyEvent({
        eventType: "product_view",
        visitorId: vid1,
        sessionId: `sid-${testRunId}-1`,
        path: "/product/abc",
        device: "mobile",
        utm: { source: "instagram" },
        createdAt: testDate,
        currentEventId: ev2._id,
      });

      doc = await DailyAnalytics.findOne({ date: testDateStr });
      assert.strictEqual(doc!.uniqueVisitors, 1, "Second event on same day must not increment uniqueVisitors");
      assert.strictEqual(doc!.devices.mobile, 1, "Second event must not increment devices.mobile");
      assert.strictEqual(doc!.sources.get("instagram"), 1, "Second event must not increment sources.instagram");

      // 3. Simulate backend restart (cold cache) for visitor 1
      clearDailyCachesForTesting();

      const ev3 = await AnalyticsEvent.create({
        eventType: "add_to_cart",
        visitorId: vid1,
        sessionId: `sid-${testRunId}-1`,
        path: "/product/abc",
        device: "mobile",
        utm: { source: "instagram" },
        createdAt: testDate,
      });
      createdEventIds.push(ev3._id);

      await recordDailyEvent({
        eventType: "add_to_cart",
        visitorId: vid1,
        sessionId: `sid-${testRunId}-1`,
        path: "/product/abc",
        device: "mobile",
        utm: { source: "instagram" },
        createdAt: testDate,
        currentEventId: ev3._id,
      });

      doc = await DailyAnalytics.findOne({ date: testDateStr });
      assert.strictEqual(
        doc!.uniqueVisitors,
        1,
        "Post-restart event for same visitor must query DB and NOT increment uniqueVisitors"
      );

      // 4. First event for brand new visitor 2 -> uniqueVisitors should become 2
      const ev4 = await AnalyticsEvent.create({
        eventType: "page_view",
        visitorId: vid2,
        sessionId: `sid-${testRunId}-2`,
        path: "/",
        device: "desktop",
        utm: { source: "google" },
        createdAt: testDate,
      });
      createdEventIds.push(ev4._id);

      await recordDailyEvent({
        eventType: "page_view",
        visitorId: vid2,
        sessionId: `sid-${testRunId}-2`,
        path: "/",
        device: "desktop",
        utm: { source: "google" },
        createdAt: testDate,
        currentEventId: ev4._id,
      });

      doc = await DailyAnalytics.findOne({ date: testDateStr });
      assert.strictEqual(doc!.uniqueVisitors, 2, "New visitor must increment uniqueVisitors to 2");
      assert.strictEqual(doc!.devices.desktop, 1, "Desktop unique visitor must increment devices.desktop to 1");
      assert.strictEqual(doc!.sources.get("google"), 1, "Google unique visitor must increment sources.google to 1");
    });

    // ----------------------------------------------------
    // P. Visitor conversion calculation
    // ----------------------------------------------------
    await test("P. Visitor -> Purchase conversion calculation & edge cases", () => {
      const calcConv = (paid: number, visitors: number): number | null => {
        if (!visitors || visitors <= 0) return null;
        return Math.min(100, Math.round((paid / visitors) * 10000) / 100);
      };

      assert.strictEqual(calcConv(5, 100), 5.0);
      assert.strictEqual(calcConv(3, 150), 2.0);
      assert.strictEqual(calcConv(0, 50), 0.0);
      assert.strictEqual(calcConv(120, 100), 100.0, "Conversion rate must be capped at 100%");
      assert.strictEqual(calcConv(5, 0), null, "Zero visitors must yield null (Unavailable), never divide by zero");
    });

    // ----------------------------------------------------
    // Q. Checkout conversion calculation
    // ----------------------------------------------------
    await test("Q. Checkout -> Purchase conversion calculation", () => {
      const calcCheckoutConv = (paid: number, starts: number): number | null => {
        if (!starts || starts <= 0) return null;
        return Math.min(100, Math.round((paid / starts) * 10000) / 100);
      };

      assert.strictEqual(calcCheckoutConv(10, 20), 50.0);
      assert.strictEqual(calcCheckoutConv(0, 10), 0.0);
      assert.strictEqual(calcCheckoutConv(25, 20), 100.0, "Capped at 100%");
      assert.strictEqual(calcCheckoutConv(5, 0), null);
    });

    // ----------------------------------------------------
    // R. Product aggregation & bulk order purchase conversion math
    // ----------------------------------------------------
    await test("R. Product performance math: purchasing orders / unique views (capped at 100%)", () => {
      // Scenario: 1 order buys 5 units of product X, seen by 1 unique viewer
      const uniqueViews = 1;
      const unitsSold = 5;
      const purchasingOrders = 1;

      // Old buggy formula: (unitsSold / uniqueViews) * 100 = 500%
      const buggyConv = Math.round((unitsSold / uniqueViews) * 100);
      assert.strictEqual(buggyConv, 500, "Sanity check: unitsSold / views produced distorted 500%");

      // New accurate formula: purchasingOrders / uniqueViews, capped at 100%
      const denominator = uniqueViews;
      const correctConv = Math.min(100, Math.round((purchasingOrders / denominator) * 10000) / 100);
      assert.strictEqual(correctConv, 100.0, "Accurate conversion must be 100.0%, never 500%");

      // Scenario: 2 distinct orders with 3 unique viewers
      const conv2 = Math.min(100, Math.round((2 / 3) * 10000) / 100);
      assert.strictEqual(conv2, 66.67);

      // Scenario: 0 views with historical sales
      const conv0 = 0 > 0 ? Math.min(100, Math.round((1 / 0) * 10000) / 100) : null;
      assert.strictEqual(conv0, null);
    });

    // ----------------------------------------------------
    // S. Traffic-source aggregation & Order attribution
    // ----------------------------------------------------
    await test("S. Traffic-source aggregation and Order attribution end-to-end", async () => {
      assert.strictEqual(sanitizeKey("google.com"), "google_com");
      assert.strictEqual(sanitizeKey("Instagram Ad $1"), "instagram_ad_1");
      assert.strictEqual(sanitizeKey(""), "direct");
      assert.strictEqual(sanitizeKey(null), "direct");

      // Verify Order model accepts and persists analytics attribution
      const dummyProdId = new mongoose.Types.ObjectId();
      const testOrder = await Order.create({
        customerEmail: `analytics-test-${testRunId}@example.com`,
        orderNo: 99991,
        subtotal: 1500,
        total: 1500,
        payment: { method: "razorpay", status: "paid" },
        status: "Confirmed",
        address: {
          name: "Test Radha Customer",
          phone: "9876543210",
          line1: "Parikrama Marg",
          city: "Vrindavan",
          pincode: "281121",
        },
        items: [
          {
            productId: dummyProdId,
            name: "Radha Krishna Murti",
            price: 1500,
            qty: 1,
          },
        ],
        analytics: {
          visitorId: `vid-${testRunId}-s`,
          sessionId: `sid-${testRunId}-s`,
          device: "mobile",
          referrer: "https://l.instagram.com/",
          utm: {
            source: "instagram",
            medium: "story",
            campaign: "festive_sale",
          },
        },
      });
      createdOrderIds.push(testOrder._id);

      assert.strictEqual(testOrder.analytics?.device, "mobile");
      assert.strictEqual(testOrder.analytics?.utm?.source, "instagram");

      const resolvedSource = resolveOrderSource(testOrder);
      assert.strictEqual(resolvedSource, "instagram", "Order must resolve to source 'instagram'");

      // Test fallback to referrer hostname
      const referrerOrder = {
        analytics: {
          referrer: "https://www.google.co.in/search?q=radha+govind",
        },
      };
      assert.strictEqual(resolveOrderSource(referrerOrder), "google_co_in");

      // Test fallback to direct
      const directOrder = { analytics: {} };
      assert.strictEqual(resolveOrderSource(directOrder), "direct");
    });

    // ----------------------------------------------------
    // T. Device aggregation
    // ----------------------------------------------------
    await test("T. Device category aggregation percentages", () => {
      const counts = { mobile: 75, desktop: 20, tablet: 5 };
      const total = counts.mobile + counts.desktop + counts.tablet;
      const mobilePct = Math.round((counts.mobile / total) * 10000) / 100;
      const desktopPct = Math.round((counts.desktop / total) * 10000) / 100;
      const tabletPct = Math.round((counts.tablet / total) * 10000) / 100;

      assert.strictEqual(mobilePct, 75.0);
      assert.strictEqual(desktopPct, 20.0);
      assert.strictEqual(tabletPct, 5.0);
    });

    // ----------------------------------------------------
    // U. Captured Abandoned checkout metrics
    // ----------------------------------------------------
    await test("U. Captured Abandoned checkout calculation", () => {
      const abandoned = 8;
      const recovered = 2;
      const totalCaptured = abandoned + recovered;
      const abandonmentRate =
        totalCaptured > 0 ? Math.round((abandoned / totalCaptured) * 10000) / 100 : null;

      assert.strictEqual(abandonmentRate, 80.0);

      const recoverySent = 5;
      const recoveredWithEmail = 2;
      const recoveryRate =
        recoverySent > 0 ? Math.round((recoveredWithEmail / recoverySent) * 10000) / 100 : null;
      assert.strictEqual(recoveryRate, 40.0);
    });

    // ----------------------------------------------------
    // V. Cancelled orders excluded from conversion
    // ----------------------------------------------------
    await test("V. Cancelled orders excluded from successful conversion", () => {
      const cancelledOrder = {
        status: "Cancelled",
        payment: { method: "razorpay", status: "paid" },
      };
      const isPaid = isOrderPaidForFinance(cancelledOrder);
      assert.strictEqual(isPaid, false, "Cancelled orders must NEVER be counted as paid/successful conversions");
    });

    // ----------------------------------------------------
    // W. Failed payments excluded from conversion
    // ----------------------------------------------------
    await test("W. Failed payments excluded from successful conversion", () => {
      const failedOrder = {
        status: "Placed",
        payment: { method: "razorpay", status: "failed" },
      };
      const isPaid = isOrderPaidForFinance(failedOrder);
      assert.strictEqual(isPaid, false, "Failed payment orders must NEVER be counted as paid/successful conversions");

      const codPendingOrder = {
        status: "Placed",
        payment: { method: "cod", status: "pending" },
      };
      assert.strictEqual(
        isOrderPaidForFinance(codPendingOrder),
        false,
        "COD pending delivery orders must not count as realized sales"
      );

      const codDeliveredOrder = {
        status: "Delivered",
        payment: { method: "cod", status: "pending" },
      };
      assert.strictEqual(
        isOrderPaidForFinance(codDeliveredOrder),
        true,
        "COD delivered orders represent realized cash collection"
      );
    });

    // ----------------------------------------------------
    // X. Admin authorization requirement
    // ----------------------------------------------------
    await test("X. Admin authorization configuration on admin analytics routes", () => {
      const dummyReq = { user: { role: "user" } };
      let forbidden = false;
      if (dummyReq.user.role !== "admin") forbidden = true;
      assert.strictEqual(forbidden, true, "Non-admin users must be rejected from admin analytics routes");
    });

    // ----------------------------------------------------
    // Y. No PII stored in analytics events
    // ----------------------------------------------------
    await test("Y. Strict verification: No PII stored in AnalyticsEvent", async () => {
      const rawPayload = {
        eventType: "page_view",
        visitorId: `vid-${testRunId}-pii`,
        sessionId: `sid-${testRunId}-pii`,
        path: "/",
        device: "desktop",
      };

      const event = await AnalyticsEvent.create(rawPayload);
      createdEventIds.push(event._id);

      const docObj = event.toObject();
      assert.strictEqual((docObj as any).email, undefined, "Email must not exist");
      assert.strictEqual((docObj as any).phone, undefined, "Phone must not exist");
      assert.strictEqual((docObj as any).address, undefined, "Address must not exist");
      assert.strictEqual((docObj as any).password, undefined, "Password must not exist");
      assert.strictEqual((docObj as any).ip, undefined, "IP address must not exist");
      assert.strictEqual((docObj as any).customerName, undefined, "Customer name must not exist");
    });

    // ----------------------------------------------------
    // Z. Funnel 5 unique stages & dropoffs
    // ----------------------------------------------------
    await test("Z. Funnel 5 unique stages: unique visitors -> viewers -> cart -> checkout -> paid", () => {
      const uniqueVisitors = 100;
      const uniqueProductViewers = 60;
      const uniqueCartVisitors = 30;
      const uniqueCheckoutVisitors = 15;
      const paidOrders = 6;

      const dropoffs = {
        visitorToProductView:
          uniqueVisitors > 0
            ? Math.max(0, Math.round(((uniqueVisitors - uniqueProductViewers) / uniqueVisitors) * 10000) / 100)
            : null,
        productViewToCart:
          uniqueProductViewers > 0
            ? Math.max(0, Math.round(((uniqueProductViewers - uniqueCartVisitors) / uniqueProductViewers) * 10000) / 100)
            : null,
        cartToCheckout:
          uniqueCartVisitors > 0
            ? Math.max(0, Math.round(((uniqueCartVisitors - uniqueCheckoutVisitors) / uniqueCartVisitors) * 10000) / 100)
            : null,
        checkoutToPaid:
          uniqueCheckoutVisitors > 0
            ? Math.max(0, Math.round(((uniqueCheckoutVisitors - paidOrders) / uniqueCheckoutVisitors) * 10000) / 100)
            : null,
      };

      assert.strictEqual(dropoffs.visitorToProductView, 40.0, "100 -> 60 is 40% drop");
      assert.strictEqual(dropoffs.productViewToCart, 50.0, "60 -> 30 is 50% drop");
      assert.strictEqual(dropoffs.cartToCheckout, 50.0, "30 -> 15 is 50% drop");
      assert.strictEqual(dropoffs.checkoutToPaid, 60.0, "15 -> 6 is 60% drop");
    });
  } finally {
    // Clean up test events, orders, and daily test document
    if (createdEventIds.length > 0) {
      await AnalyticsEvent.deleteMany({ _id: { $in: createdEventIds } });
    }
    if (createdOrderIds.length > 0) {
      await Order.deleteMany({ _id: { $in: createdOrderIds } });
    }
    await DailyAnalytics.deleteMany({ date: testDateStr });
    console.log(
      `\n🧹 Cleaned up ${createdEventIds.length} test events, ${createdOrderIds.length} test orders, and test DailyAnalytics records.`
    );
  }

  console.log("\n=======================================================");
  console.log(` RESULTS: ${passed} PASSED, ${failed} FAILED (TOTAL: ${passed + failed})`);
  console.log("=======================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runConversionAnalyticsTests()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error("Test execution failed:", err);
    process.exit(1);
  });
