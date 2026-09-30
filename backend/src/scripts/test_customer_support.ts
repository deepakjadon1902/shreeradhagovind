import "dotenv/config";
import assert from "node:assert";
import mongoose from "mongoose";
import crypto from "crypto";
import { connectDB } from "../config/db";
import { Product } from "../models/Product";
import { Order } from "../models/Order";
import { User } from "../models/User";
import { Settings } from "../models/Settings";
import { Counter } from "../models/Counter";
import {
  SupportTicket,
  SUPPORT_CATEGORIES,
  SUPPORT_STATUSES,
  SUPPORT_PRIORITIES,
  type SupportCategory,
  type SupportStatus,
  type SupportPriority,
} from "../models/SupportTicket";
import {
  generateNextTicketNo,
  createSupportTicket,
  findTicketByIdOrNo,
  addAdminReply,
  addCustomerReply,
  addAdminInternalNote,
  updateTicketStatus,
  updateTicketPriority,
  autoCloseResolvedTickets,
  sanitizeTicketForCustomer,
  sanitizeText,
} from "../services/support.service";
import { getUnifiedCustomerMetrics } from "../services/retention.service";
import { FAQ_DATA } from "../routes/support.routes";
import {
  dispatchTicketCreatedEmail,
  dispatchTicketAdminReplyEmail,
  dispatchTicketResolvedEmail,
  dispatchTicketClosedEmail,
  dispatchTicketReopenedEmail,
  tpl,
} from "../utils/email";

async function runCustomerSupportTests() {
  console.log("\n=======================================================");
  console.log(" CUSTOMER SUPPORT & HELP CENTER COMPREHENSIVE TEST SUITE");
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

  const testRunId = `test-sup-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;
  const createdTicketIds: mongoose.Types.ObjectId[] = [];
  const createdOrderIds: mongoose.Types.ObjectId[] = [];
  const createdUserIds: mongoose.Types.ObjectId[] = [];
  const createdProductIds: mongoose.Types.ObjectId[] = [];

  let initialCounterDoc: any = null;

  try {
    // Record initial counter state for safe restoration
    initialCounterDoc = await Counter.findOne({ name: "support_ticket_no" }).lean();

    // Helper to create test product
    async function createTestProduct() {
      const p = await Product.create({
        name: `Test Poshak ${testRunId}-${createdProductIds.length}`,
        slug: `test-poshak-${testRunId}-${createdProductIds.length}`,
        category: "Laddu Gopal Poshak",
        price: 350,
        mrp: 450,
        stock: 25,
        rating: 5,
        reviews: 1,
        featuredDeal: false,
        image: "https://example.com/poshak.jpg",
        images: ["https://example.com/poshak.jpg"],
        hsnCode: "6204",
        gstRate: 5,
        gstInclusive: true,
      });
      createdProductIds.push(p._id);
      return p;
    }

    // Helper to create test user
    async function createTestUser(emailPrefix = "user") {
      const u = await User.create({
        name: `Devotee ${testRunId}`,
        email: `${emailPrefix}-${testRunId}@example.com`,
        password: "hashed_test_password_123",
        role: "user",
        phone: "+919876543210",
        loyaltyPointsBalance: 150,
        walletBalance: 200,
      });
      createdUserIds.push(u._id);
      return u;
    }

    // Helper to create test order
    async function createTestOrder(user: any, orderNo: number) {
      const p = await createTestProduct();
      const o = await Order.create({
        orderNo,
        user: user?._id || null,
        customerEmail: user?.email || `guest-${testRunId}@example.com`,
        status: "Delivered",
        deliveredAt: new Date(Date.now() - 24 * 3600 * 1000),
        items: [
          {
            product: p._id,
            productId: p._id,
            name: p.name,
            image: p.image,
            price: 350,
            qty: 1,
          },
        ],
        subtotal: 350,
        shipping: 0,
        total: 350,
        payment: {
          method: "razorpay",
          status: "paid",
          paidAt: new Date(),
        },
        address: {
          name: user?.name || "Test Devotee",
          line1: "155 Raman Reti",
          city: "Vrindavan",
          state: "Uttar Pradesh",
          pincode: "281121",
          phone: "+919876543210",
        },
      });
      createdOrderIds.push(o._id);
      return o;
    }

    // SECTION A: Free Shipping Policy & Fallback Verification
    console.log("\n--- SECTION A: Shipping Threshold Consistency (₹299) ---");

    await test("A1. Settings model default freeShipThreshold is 299", async () => {
      const settingsSchema: any = Settings.schema.obj;
      assert.strictEqual(
        settingsSchema.freeShipThreshold?.default,
        299,
        "freeShipThreshold default must be 299"
      );
      assert.ok(
        settingsSchema.announcement?.default?.includes("₹299"),
        "announcement default must state ₹299"
      );
    });

    // SECTION B: SupportTicket Schema & Enums Verification
    console.log("\n--- SECTION B: SupportTicket Schema & Model ---");

    await test("B1. Support categories contains exactly the 7 expected categories", () => {
      assert.strictEqual(SUPPORT_CATEGORIES.length, 7);
      assert.ok(SUPPORT_CATEGORIES.includes("Order Status & Delivery"));
      assert.ok(SUPPORT_CATEGORIES.includes("Product Inquiry & Poshak Sizing"));
      assert.ok(SUPPORT_CATEGORIES.includes("Payment & Billing"));
      assert.ok(SUPPORT_CATEGORIES.includes("Cancellation & Modification"));
      assert.ok(SUPPORT_CATEGORIES.includes("Returns & Replacements"));
      assert.ok(SUPPORT_CATEGORIES.includes("Loyalty & Coupons"));
      assert.ok(SUPPORT_CATEGORIES.includes("General & Seva Query"));
    });

    await test("B2. Support statuses contains the 5 expected lifecycle statuses", () => {
      assert.strictEqual(SUPPORT_STATUSES.length, 5);
      assert.ok(SUPPORT_STATUSES.includes("OPEN"));
      assert.ok(SUPPORT_STATUSES.includes("IN_PROGRESS"));
      assert.ok(SUPPORT_STATUSES.includes("WAITING_FOR_CUSTOMER"));
      assert.ok(SUPPORT_STATUSES.includes("RESOLVED"));
      assert.ok(SUPPORT_STATUSES.includes("CLOSED"));
    });

    await test("B3. Support priorities contains the 4 expected priorities", () => {
      assert.strictEqual(SUPPORT_PRIORITIES.length, 4);
      assert.ok(SUPPORT_PRIORITIES.includes("LOW"));
      assert.ok(SUPPORT_PRIORITIES.includes("MEDIUM"));
      assert.ok(SUPPORT_PRIORITIES.includes("HIGH"));
      assert.ok(SUPPORT_PRIORITIES.includes("URGENT"));
    });

    await test("B4. SupportTicket indexes include ticketNo and compound queries", async () => {
      const indexes = SupportTicket.schema.indexes();
      const hasTicketNo = indexes.some((idx: any) => idx[0]?.ticketNo === 1);
      const hasCustomerEmailStatus = indexes.some(
        (idx: any) => idx[0]?.customerEmail === 1 && idx[0]?.status === 1
      );
      const hasUserIdStatus = indexes.some(
        (idx: any) => idx[0]?.userId === 1 && idx[0]?.status === 1
      );
      const hasOrderId = indexes.some((idx: any) => idx[0]?.orderId === 1);

      assert.ok(hasTicketNo, "Index on ticketNo must exist");
      assert.ok(hasCustomerEmailStatus, "Compound index on customerEmail + status must exist");
      assert.ok(hasUserIdStatus, "Compound index on userId + status must exist");
      assert.ok(hasOrderId, "Index on orderId must exist");
    });

    // SECTION C: Sequential Numbering Generator
    console.log("\n--- SECTION C: Sequential Ticket Numbering ---");

    await test("C1. generateNextTicketNo produces SRGS-10000+ format sequentially", async () => {
      const no1 = await generateNextTicketNo();
      const no2 = await generateNextTicketNo();
      assert.ok(/^SRGS-\d{5,}$/.test(no1), `Ticket format invalid: ${no1}`);
      assert.ok(/^SRGS-\d{5,}$/.test(no2), `Ticket format invalid: ${no2}`);
      const num1 = parseInt(no1.replace("SRGS-", ""), 10);
      const num2 = parseInt(no2.replace("SRGS-", ""), 10);
      assert.strictEqual(num2, num1 + 1, "Next ticket number must increment sequentially");
    });

    // SECTION D: Ticket Creation (User & Guest)
    console.log("\n--- SECTION D: Ticket Creation ---");

    const testUser = await createTestUser("ticket-owner");

    let userTicket: any = null;
    await test("D1. Authenticated user can open a support ticket", async () => {
      const res = await createSupportTicket({
        userId: String(testUser._id),
        customerName: testUser.name,
        customerEmail: testUser.email,
        customerPhone: testUser.phone,
        category: "Order Status & Delivery",
        subject: "Delivery inquiry for sacred Tulsi mala",
        message: "Hare Krishna, please check courier delivery estimate.",
      });

      assert.strictEqual(res.success, true, res.error);
      assert.ok(res.ticket, "Ticket must be created");
      userTicket = res.ticket;
      createdTicketIds.push(userTicket._id);

      assert.strictEqual(String(userTicket.userId), String(testUser._id));
      assert.strictEqual(userTicket.customerEmail, testUser.email.toLowerCase());
      assert.strictEqual(userTicket.status, "OPEN");
      assert.strictEqual(userTicket.priority, "MEDIUM");
      assert.strictEqual(userTicket.messages.length, 1);
      assert.strictEqual(userTicket.messages[0].senderType, "customer");
      assert.strictEqual(userTicket.messages[0].isInternal, false);
    });

    let guestTicket: any = null;
    await test("D2. Guest customer can open a support ticket without userId", async () => {
      const guestEmail = `guest-devotee-${testRunId}@example.com`;
      const res = await createSupportTicket({
        userId: null,
        customerName: "Guest Devotee",
        customerEmail: guestEmail,
        category: "Product Inquiry & Poshak Sizing",
        subject: "Inquiry about Radha Rani poshak sizing",
        message: "Please tell me the size for 3 inch deity.",
      });

      assert.strictEqual(res.success, true, res.error);
      assert.ok(res.ticket);
      guestTicket = res.ticket;
      createdTicketIds.push(guestTicket._id);

      assert.strictEqual(guestTicket.userId, null);
      assert.strictEqual(guestTicket.customerEmail, guestEmail.toLowerCase());
      assert.strictEqual(guestTicket.status, "OPEN");
    });

    await test("D3. Ticket creation validates category enum", async () => {
      const res = await createSupportTicket({
        customerName: "Devotee",
        customerEmail: "invalid@example.com",
        category: "NON_EXISTENT_CATEGORY" as any,
        subject: "Subject",
        message: "Message",
      });

      assert.strictEqual(res.success, false);
      assert.ok(res.error?.includes("Invalid support category"));
    });

    // SECTION E: Order Linking & Ownership Validation
    console.log("\n--- SECTION E: Order Linking & Ownership ---");

    const order1001 = await createTestOrder(testUser, 98001);
    const otherUser = await createTestUser("other-user");
    const order1002 = await createTestOrder(otherUser, 98002);

    await test("E1. User linking their own order succeeds", async () => {
      const res = await createSupportTicket({
        userId: String(testUser._id),
        customerName: testUser.name,
        customerEmail: testUser.email,
        orderIdOrNo: 98001,
        category: "Order Status & Delivery",
        subject: "Where is order 98001?",
        message: "Need courier tracking details please.",
      });

      assert.strictEqual(res.success, true, res.error);
      assert.ok(res.ticket);
      createdTicketIds.push(res.ticket._id);
      assert.strictEqual(String(res.ticket.orderId), String(order1001._id));
      assert.strictEqual(res.ticket.orderNo, 98001);
    });

    await test("E2. Linking an order belonging to another customer is rejected", async () => {
      const res = await createSupportTicket({
        userId: String(testUser._id),
        customerName: testUser.name,
        customerEmail: testUser.email,
        orderIdOrNo: 98002, // Owned by otherUser
        category: "Order Status & Delivery",
        subject: "Trying to link someone else's order",
        message: "Suspicious attempt",
      });

      assert.strictEqual(res.success, false);
      assert.ok(
        res.error?.toLowerCase().includes("authorized") ||
          res.error?.toLowerCase().includes("access denied") ||
          res.error?.toLowerCase().includes("does not belong"),
        `Error was: ${res.error}`
      );
    });

    await test("E3. Linking a non-existent order is rejected", async () => {
      const res = await createSupportTicket({
        userId: String(testUser._id),
        customerName: testUser.name,
        customerEmail: testUser.email,
        orderIdOrNo: 999999999,
        category: "Order Status & Delivery",
        subject: "Non existent order",
        message: "Testing",
      });

      assert.strictEqual(res.success, false);
      assert.ok(res.error?.toLowerCase().includes("found"));
    });

    // SECTION F: Ticket Lookup by Ticket Number or ObjectId
    console.log("\n--- SECTION F: Ticket Lookup (ID & No) ---");

    await test("F1. findTicketByIdOrNo works with exact ticketNo and case-insensitive", async () => {
      const found = await findTicketByIdOrNo(userTicket.ticketNo.toLowerCase());
      assert.ok(found);
      assert.strictEqual(String(found._id), String(userTicket._id));
    });

    await test("F2. findTicketByIdOrNo works with MongoDB ObjectId", async () => {
      const found = await findTicketByIdOrNo(String(userTicket._id));
      assert.ok(found);
      assert.strictEqual(found.ticketNo, userTicket.ticketNo);
    });

    // SECTION G: Admin Reply & Status Transitions
    console.log("\n--- SECTION G: Admin Reply Flow ---");

    await test("G1. Admin can reply to ticket and update status to WAITING_FOR_CUSTOMER", async () => {
      const res = await addAdminReply({
        ticketIdOrNo: userTicket.ticketNo,
        adminEmail: "admin@shriradhagovindstore.com",
        adminName: "Seva Lead",
        message: "Hare Krishna! Your courier is dispatched via DTDC AWB #12345.",
        newStatus: "WAITING_FOR_CUSTOMER",
      });

      assert.strictEqual(res.success, true, res.error);
      assert.ok(res.ticket);
      assert.strictEqual(res.ticket.status, "WAITING_FOR_CUSTOMER");
      assert.strictEqual(res.ticket.messages.length, 2);
      const lastMsg = res.ticket.messages[res.ticket.messages.length - 1];
      assert.strictEqual(lastMsg.senderType, "admin");
      assert.strictEqual(lastMsg.senderName, "Seva Lead");
      assert.strictEqual(lastMsg.isInternal, false);
      assert.ok(res.ticket.lastAdminReplyAt);
    });

    // SECTION H: Customer Reply & Status Automatic Transition
    console.log("\n--- SECTION H: Customer Reply Flow ---");

    await test("H1. Customer reply to WAITING_FOR_CUSTOMER changes status to IN_PROGRESS", async () => {
      const res = await addCustomerReply({
        ticketIdOrNo: userTicket.ticketNo,
        userId: String(testUser._id),
        message: "Thank you! Could you please also confirm expected delivery date?",
      });

      assert.strictEqual(res.success, true, res.error);
      assert.ok(res.ticket);
      assert.strictEqual(res.ticket.status, "IN_PROGRESS");
      assert.strictEqual(res.ticket.messages.length, 3);
      const lastMsg = res.ticket.messages[res.ticket.messages.length - 1];
      assert.strictEqual(lastMsg.senderType, "customer");
      assert.ok(res.ticket.lastCustomerReplyAt);
    });

    // SECTION I: Internal Notes & Sanitization
    console.log("\n--- SECTION I: Internal Notes & Customer Sanitization ---");

    await test("I1. Admin can add internal note marked isInternal: true", async () => {
      const res = await addAdminInternalNote({
        ticketIdOrNo: userTicket.ticketNo,
        adminEmail: "manager@shriradhagovindstore.com",
        adminName: "Store Manager",
        note: "Internal note: Verified with DTDC dispatch manager, expected delivery tomorrow.",
      });

      assert.strictEqual(res.success, true, res.error);
      assert.ok(res.ticket);
      const noteMsg = res.ticket.messages[res.ticket.messages.length - 1];
      assert.strictEqual(noteMsg.isInternal, true);
      assert.strictEqual(noteMsg.senderType, "admin");
    });

    await test("I2. sanitizeTicketForCustomer completely strips internal notes and sensitive fields", async () => {
      const fullTicket = await SupportTicket.findById(userTicket._id).lean();
      const sanitized = sanitizeTicketForCustomer(fullTicket);

      assert.ok(sanitized, "Sanitized ticket must exist");
      const hasInternal = sanitized.messages.some((m: any) => m.isInternal === true);
      assert.strictEqual(hasInternal, false, "Internal notes MUST NEVER be present in customer view");

      assert.strictEqual(
        (sanitized as any).createdEmailSentAt,
        undefined,
        "Email lock timestamps must be stripped"
      );
      assert.strictEqual(
        (sanitized as any).resolvedEmailSentAt,
        undefined,
        "Email lock timestamps must be stripped"
      );
    });

    // SECTION J: Ticket Resolution & Customer Reopen Flow
    console.log("\n--- SECTION J: Resolution & Customer Reopen ---");

    await test("J1. Setting status to RESOLVED sets resolvedAt and 72h autoCloseAt", async () => {
      const res = await updateTicketStatus(
        userTicket.ticketNo,
        "RESOLVED",
        { email: "admin@shriradhagovindstore.com", name: "Admin" }
      );

      assert.strictEqual(res.success, true, res.error);
      assert.ok(res.ticket);
      assert.strictEqual(res.ticket.status, "RESOLVED");
      assert.ok(res.ticket.resolvedAt);
      assert.ok(res.ticket.autoCloseAt);

      const resolvedMs = new Date(res.ticket.resolvedAt).getTime();
      const autoCloseMs = new Date(res.ticket.autoCloseAt).getTime();
      const diffHours = (autoCloseMs - resolvedMs) / (1000 * 3600);
      assert.strictEqual(Math.round(diffHours), 72, "autoCloseAt must be exactly 72 hours from resolvedAt");
    });

    await test("J2. Customer reply to RESOLVED ticket automatically reopens it", async () => {
      const res = await addCustomerReply({
        ticketIdOrNo: userTicket.ticketNo,
        userId: String(testUser._id),
        message: "Hare Krishna, the package has not arrived yet. Please re-check.",
      });

      assert.strictEqual(res.success, true, res.error);
      assert.ok(res.ticket);
      assert.strictEqual(res.ticket.status, "IN_PROGRESS", "Ticket must reopen to IN_PROGRESS");
      assert.strictEqual(res.ticket.reopenCount, 1, "reopenCount must increment to 1");
      assert.strictEqual(res.ticket.autoCloseAt, null, "autoCloseAt must be reset to null");
    });

    // SECTION K: Closed Ticket Rejection
    console.log("\n--- SECTION K: Closed Ticket Protection ---");

    await test("K1. Setting status to CLOSED prevents any further customer replies", async () => {
      await updateTicketStatus(
        userTicket.ticketNo,
        "CLOSED",
        { email: "admin@shriradhagovindstore.com", name: "Admin" }
      );

      const replyRes = await addCustomerReply({
        ticketIdOrNo: userTicket.ticketNo,
        userId: String(testUser._id),
        message: "Can I still reply to this closed ticket?",
      });

      assert.strictEqual(replyRes.success, false);
      assert.ok(
        replyRes.error?.toLowerCase().includes("closed"),
        `Error was: ${replyRes.error}`
      );
    });

    // SECTION L: 72-Hour Auto-Close Routine & CAS Concurrency Safety
    console.log("\n--- SECTION L: Auto-Close Routine & Concurrency ---");

    await test("L1. autoCloseResolvedTickets atomically closes tickets past 72h autoCloseAt", async () => {
      const pastResolvedTicket = await SupportTicket.create({
        ticketNo: `SRGS-TEST-AC-${Date.now()}`,
        userId: testUser._id,
        customerName: "Devotee Past",
        customerEmail: testUser.email,
        category: "Order Status & Delivery",
        subject: "Past ticket to test auto-close",
        status: "RESOLVED",
        resolvedAt: new Date(Date.now() - 80 * 3600 * 1000), // 80h ago
        autoCloseAt: new Date(Date.now() - 8 * 3600 * 1000), // 8h ago (past deadline)
        messages: [
          {
            senderType: "customer",
            senderName: "Devotee Past",
            message: "Initial query",
            createdAt: new Date(Date.now() - 85 * 3600 * 1000),
          },
        ],
      });
      createdTicketIds.push(pastResolvedTicket._id);

      const autoCloseRes = await autoCloseResolvedTickets();
      assert.ok(
        autoCloseRes.closedCount >= 1,
        `Expected at least 1 ticket auto-closed, got ${autoCloseRes.closedCount}`
      );

      const refreshed = await SupportTicket.findById(pastResolvedTicket._id);
      assert.ok(refreshed);
      assert.strictEqual(refreshed.status, "CLOSED");
      assert.ok(refreshed.closedAt);

      // Verify system notification message was added
      const lastMsg = refreshed.messages[refreshed.messages.length - 1];
      assert.strictEqual(lastMsg.senderType, "system");
      assert.ok(lastMsg.message.includes("automatically closed after 72 hours"));
    });

    await test("L2. autoCloseResolvedTickets does NOT close tickets whose autoCloseAt is in future", async () => {
      const futureTicket = await SupportTicket.create({
        ticketNo: `SRGS-TEST-FUTURE-${Date.now()}`,
        userId: testUser._id,
        customerName: "Devotee Future",
        customerEmail: testUser.email,
        category: "General & Seva Query",
        subject: "Ticket resolved recently",
        status: "RESOLVED",
        resolvedAt: new Date(),
        autoCloseAt: new Date(Date.now() + 70 * 3600 * 1000), // 70h in future
        messages: [{ senderType: "customer", senderName: "Devotee Future", message: "Query" }],
      });
      createdTicketIds.push(futureTicket._id);

      await autoCloseResolvedTickets();

      const refreshed = await SupportTicket.findById(futureTicket._id);
      assert.ok(refreshed);
      assert.strictEqual(refreshed.status, "RESOLVED", "Future ticket must remain RESOLVED");
    });

    // SECTION M: Guest Authorization & IDOR Protection
    console.log("\n--- SECTION M: Guest Authorization & IDOR Protection ---");

    await test("M1. Customer reply with mismatched guest email is rejected", async () => {
      const res = await addCustomerReply({
        ticketIdOrNo: guestTicket.ticketNo,
        customerEmail: "attacker@malicious.com",
        message: "Attempting to reply to another customer's guest ticket",
      });

      assert.strictEqual(res.success, false);
      assert.ok(
        res.error?.toLowerCase().includes("unauthorized") ||
          res.error?.toLowerCase().includes("access denied") ||
          res.error?.toLowerCase().includes("email"),
        `Error was: ${res.error}`
      );
    });

    await test("M2. Customer reply with matching guest email succeeds", async () => {
      const res = await addCustomerReply({
        ticketIdOrNo: guestTicket.ticketNo,
        customerEmail: guestTicket.customerEmail,
        message: "Devotee reply to guest ticket",
      });

      assert.strictEqual(res.success, true, res.error);
      assert.ok(res.ticket);
      assert.strictEqual(res.ticket.messages.length, 2);
    });

    // SECTION N: Priority Updates
    console.log("\n--- SECTION N: Priority Management ---");

    await test("N1. Admin can escalate ticket priority to URGENT", async () => {
      const res = await updateTicketPriority(
        userTicket.ticketNo,
        "URGENT"
      );

      assert.strictEqual(res.success, true, res.error);
      assert.ok(res.ticket);
      assert.strictEqual(res.ticket.priority, "URGENT");
    });

    // SECTION O: Text Sanitization Utility
    console.log("\n--- SECTION O: Text Sanitization ---");

    await test("O1. sanitizeText removes null bytes and ASCII control characters", () => {
      const dirty = "Hare Krishna\x00\x08 Devotee\x1F 🙏";
      const clean = sanitizeText(dirty);
      assert.strictEqual(clean, "Hare Krishna Devotee 🙏");
    });

    // SECTION P: FAQ Data & Knowledge Base
    console.log("\n--- SECTION P: FAQ Knowledge Base ---");

    await test("P1. FAQ_DATA contains categorized FAQs covering all main services", () => {
      assert.ok(Array.isArray(FAQ_DATA) && FAQ_DATA.length >= 5);
      for (const group of FAQ_DATA) {
        assert.ok(group.category, "Category name must exist");
        assert.ok(Array.isArray(group.faqs) && group.faqs.length > 0, "FAQs array must not be empty");
        for (const faq of group.faqs) {
          assert.ok(faq.q && faq.q.length > 5, "Question must be present");
          assert.ok(faq.a && faq.a.length > 10, "Answer must be present");
        }
      }
    });

    // SECTION Q: Email Notification Templates & Dispatchers
    console.log("\n--- SECTION Q: Email Templates & Idempotency ---");

    await test("Q1. All 6 email templates generate valid subjects and HTML with shell", () => {
      const c = tpl.ticketCreated("Radhika", "SRGS-10001", "Where is my parcel?", "Order Status & Delivery");
      assert.ok(c.subject.includes("SRGS-10001"));
      assert.ok(c.html.includes("Hare Krishna, Radhika"));

      const r = tpl.ticketAdminReply("Radhika", "SRGS-10001", "Order Status & Delivery", "Dispatched today");
      assert.ok(r.subject.includes("SRGS-10001"));
      assert.ok(r.html.includes("Dispatched today"));

      const w = tpl.ticketWaitingForCustomer("Radhika", "SRGS-10001", "Order Status & Delivery", "Please confirm address");
      assert.ok(w.subject.includes("Action Required"));

      const res = tpl.ticketResolved("Radhika", "SRGS-10001", "Order Status & Delivery");
      assert.ok(res.subject.includes("Resolved"));
      assert.ok(res.html.includes("72 hours"));

      const cl = tpl.ticketClosed("Radhika", "SRGS-10001", "Order Status & Delivery");
      assert.ok(cl.subject.includes("Closed"));

      const ro = tpl.ticketReopened("Radhika", "SRGS-10001", "Order Status & Delivery");
      assert.ok(ro.subject.includes("Reopened"));
    });

    await test("Q2. Email dispatcher idempotency: duplicate dispatch skips on second attempt", async () => {
      const mockTicket = await SupportTicket.create({
        ticketNo: `SRGS-IDEMP-${Date.now()}`,
        customerName: "Idemp Test",
        customerEmail: "idemp@example.com",
        category: "Order Status & Delivery",
        subject: "Idempotency test",
        status: "OPEN",
        createdEmailSentAt: new Date(), // Already marked sent
        messages: [{ senderType: "customer", senderName: "Idemp Test", message: "Msg" }],
      });
      createdTicketIds.push(mockTicket._id);

      const dispatchResult = await dispatchTicketCreatedEmail(
        mockTicket._id,
        "idemp@example.com",
        "Idemp Test",
        mockTicket.ticketNo,
        "Idempotency test",
        "Order Status & Delivery"
      );

      assert.strictEqual(dispatchResult.success, false);
      assert.strictEqual(dispatchResult.skipped, true);
      assert.strictEqual(dispatchResult.reason, "already_sent");
    });

    // SECTION R: Customer Retention & Unified Metrics Integration
    console.log("\n--- SECTION R: Customer Retention & Metrics Integration ---");

    await test("R1. getUnifiedCustomerMetrics includes support metrics for customer", async () => {
      const metrics = await getUnifiedCustomerMetrics({ userId: testUser._id });
      assert.ok(metrics, "Metrics should be returned for user");
      assert.ok(typeof metrics.supportTicketCount === "number", "supportTicketCount must be a number");
      assert.ok(metrics.supportTicketCount >= 1, "Must count user's support tickets");
      assert.ok(typeof metrics.openSupportTickets === "number", "openSupportTickets must be a number");
      assert.ok(metrics.lastSupportTicketAt !== null, "lastSupportTicketAt must be a Date");
    });

  } finally {
    // SECTION Z: Zero Leftover Test Data Cleanup & Verification
    console.log("\n--- SECTION Z: Database Rollback & Cleanup ---");

    try {
      if (createdTicketIds.length > 0) {
        const res = await SupportTicket.deleteMany({ _id: { $in: createdTicketIds } });
        console.log(`  🧹 Deleted ${res.deletedCount} test SupportTickets`);
      }

      if (createdOrderIds.length > 0) {
        const res = await Order.deleteMany({ _id: { $in: createdOrderIds } });
        console.log(`  🧹 Deleted ${res.deletedCount} test Orders`);
      }

      if (createdUserIds.length > 0) {
        const res = await User.deleteMany({ _id: { $in: createdUserIds } });
        console.log(`  🧹 Deleted ${res.deletedCount} test Users`);
      }

      if (createdProductIds.length > 0) {
        const res = await Product.deleteMany({ _id: { $in: createdProductIds } });
        console.log(`  🧹 Deleted ${res.deletedCount} test Products`);
      }

      // Restore counter state if recorded
      if (initialCounterDoc) {
        await Counter.updateOne(
          { name: "support_ticket_no" },
          { $set: { value: initialCounterDoc.value } }
        );
        console.log(`  🧹 Restored support_ticket_no counter to ${initialCounterDoc.value}`);
      } else {
        await Counter.deleteOne({ name: "support_ticket_no" });
        console.log("  🧹 Cleaned test support_ticket_no counter");
      }

      // Verify zero leftover test records
      const remainingTickets = await SupportTicket.countDocuments({
        _id: { $in: createdTicketIds },
      });
      const remainingOrders = await Order.countDocuments({
        _id: { $in: createdOrderIds },
      });
      const remainingUsers = await User.countDocuments({
        _id: { $in: createdUserIds },
      });
      const remainingProducts = await Product.countDocuments({
        _id: { $in: createdProductIds },
      });

      assert.strictEqual(remainingTickets, 0, "All test tickets must be cleaned");
      assert.strictEqual(remainingOrders, 0, "All test orders must be cleaned");
      assert.strictEqual(remainingUsers, 0, "All test users must be cleaned");
      assert.strictEqual(remainingProducts, 0, "All test products must be cleaned");
      console.log("  ✅ Zero leftover test data verified in MongoDB Atlas!");
    } catch (cleanupErr: any) {
      console.error("  ❌ Cleanup error:", cleanupErr.message || cleanupErr);
    } finally {
      await mongoose.disconnect();
    }
  }

  console.log("\n=======================================================");
  console.log(` SUPPORT TEST SUITE COMPLETE: ${passed} PASSED, ${failed} FAILED`);
  console.log("=======================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runCustomerSupportTests().catch((err) => {
  console.error("FATAL ERROR IN TEST SUITE:", err);
  process.exit(1);
});
