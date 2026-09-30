import { Router } from "express";
import { z } from "zod";
import rateLimit from "express-rate-limit";
import { optionalAuth, requireAuth } from "../middleware/auth";
import { HttpError } from "../middleware/error";
import {
  SUPPORT_CATEGORIES,
  SupportTicket,
  type SupportCategory,
} from "../models/SupportTicket";
import {
  createSupportTicket,
  addCustomerReply,
  findTicketByIdOrNo,
  sanitizeTicketForCustomer,
} from "../services/support.service";

const r = Router();

// Dedicated rate limiter: max 12 ticket creations per hour per IP
const ticketCreationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 12,
  message: { ok: false, error: "Too many tickets created. Please wait an hour before opening a new ticket." },
});

// Reply rate limiter: max 30 replies per 15 minutes per IP
const replyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { ok: false, error: "Too many messages sent. Please slow down." },
});

// FAQ Knowledge Base data structure
export const FAQ_DATA = [
  {
    category: "Order & Delivery",
    faqs: [
      {
        q: "How can I track my order?",
        a: "You can track your order at any time using our dedicated Track Order page (/track) by entering your Tracking ID or 4-digit Order Number. Real-time updates from DTDC, Delhivery, Shree Maruti, and Blue Dart are automatically synchronized.",
      },
      {
        q: "What do the order statuses mean?",
        a: "Placed: Order received. Confirmed: Payment verified. Processing: Sacred items being prepared in Vrindavan Dham. Packed: Carefully sealed in protective packaging. Shipped: Handed over to courier with tracking. Out for delivery: Driver is en route to your address. Delivered: Package safely received. Hold: Address or verification checkpoint in progress.",
      },
      {
        q: "When can I cancel my order?",
        a: "Customers can self-cancel an order directly from the Order Details page as long as the status is 'Placed' or 'Confirmed'. Once an order reaches 'Processing', cancellation is no longer possible as the items are being packed for dispatch.",
      },
      {
        q: "What happens if my order is delayed?",
        a: "Standard delivery across India takes 3 to 7 business days. Delivery may occasionally take longer during major devotional festivals (Janmashtami, Radhashtami, Kartik month) or extreme weather. If your package is delayed past 7 business days, reach out to our support team and we will follow up directly with the carrier.",
      },
    ],
  },
  {
    category: "Payment & Billing",
    faqs: [
      {
        q: "What payment methods are supported?",
        a: "We support all major Indian payment methods through Razorpay 256-bit encrypted gateway including UPI (Google Pay, PhonePe, Paytm, BHIM), Credit/Debit Cards, Net Banking, and Store Wallet. Cash on Delivery (COD) is also available for eligible pincodes across India.",
      },
      {
        q: "What happens if Razorpay payment fails?",
        a: "If money is deducted from your bank account during a failed payment, bank and NPCI protocols automatically reverse the amount back to your original source within 5 to 7 business days. You can also re-attempt payment directly from your cart or contact our support team with your transaction reference.",
      },
      {
        q: "When is my official tax invoice available?",
        a: "In compliance with GST regulations, your official computer-generated GST tax invoice becomes available for instant direct download in your customer account or order page as soon as the package is marked 'Delivered'.",
      },
      {
        q: "What happens after the 7-day direct download period expires?",
        a: "For security, direct invoice download is active for 7 days post-delivery. If you require an invoice after 7 days, simply click 'Request Tax Invoice' on your Order Details page. Our admin team will generate a secure 48-hour download link and deliver it to your registered email.",
      },
    ],
  },
  {
    category: "Returns & Refunds",
    faqs: [
      {
        q: "What is the return window?",
        a: "The return window is strictly 48 hours following courier delivery. Because devotional and sacred items require special reverence and handling, return requests submitted after 48 hours cannot be approved.",
      },
      {
        q: "Which products can be returned?",
        a: "Items that arrive broken, transit-damaged, defective, missing components, or incorrect can be returned or replaced. Sacred malas, deity poshak, and puja essentials that have been opened or used cannot be returned due to sacred sanctity.",
      },
      {
        q: "How do I request a return?",
        a: "Returns are handled exclusively through our dedicated Returns & Refund Portal. Visit your Order Details page (/orders/:id), scroll to the 'Returns & Replacement' section, select the items and quantities, and upload your description. A full unboxing video from package seal opening is compulsory.",
      },
      {
        q: "How are refunds disbursed?",
        a: "Approved refunds can be credited to your Store Wallet instantly for future purchases, or transferred via manual UPI within 1 to 3 business days. Original shipping fees are non-refundable.",
      },
    ],
  },
  {
    category: "Coupons & Loyalty",
    faqs: [
      {
        q: "How do I apply a coupon code?",
        a: "Enter your coupon code in the coupon field on the Cart or Checkout page and click 'Apply'. The discount will instantly apportion across all eligible items in your cart.",
      },
      {
        q: "Can I combine loyalty points with coupon discounts?",
        a: "Yes! Shri Radha Govind Store allows devotees to redeem their earned loyalty points alongside active promotional coupons on qualifying purchases.",
      },
      {
        q: "How long are loyalty points valid?",
        a: "Loyalty points remain valid for exactly 180 days from the date they are credited upon order delivery.",
      },
    ],
  },
  {
    category: "Account & Profile",
    faqs: [
      {
        q: "How do I access my past orders?",
        a: "Sign in with your email to view all your past purchases under 'Your Orders' in your profile. If you checked out as a guest, you can access your order through the secure link sent to your email or link your guest orders upon verifying your account email.",
      },
      {
        q: "How does Email OTP login work?",
        a: "Enter your registered email address on the login screen. We will send a secure 6-digit one-time passcode (OTP) to your inbox valid for 10 minutes. Enter the OTP to sign in without needing a password.",
      },
      {
        q: "How do I manage my Wishlist?",
        a: "Click the heart icon on any sacred item in our store to save it to your Wishlist. When signed in, your Wishlist syncs permanently across all your mobile and desktop devices.",
      },
    ],
  },
  {
    category: "Products & Sizing",
    faqs: [
      {
        q: "What does 'Low Stock' mean?",
        a: "When inventory for an artisan-crafted devotional item reaches 5 or fewer units, a 'Low Stock' badge is displayed to alert devotees before it sells out.",
      },
      {
        q: "How do I know what size poshak or shringar to order for my Deities?",
        a: "Deity poshak sizes are measured by the height of the Deity in inches or standard size numbers (0 through 6). For custom poshak advice, contact our seva team through this Help Center or WhatsApp with your Deity's height.",
      },
      {
        q: "What if an item is out of stock?",
        a: "You can click 'Notify Me When Available' on the product page to enter your email. You will receive an instant email notification the moment our Vrindavan artisans restock the item.",
      },
    ],
  },
  {
    category: "General & Seva",
    faqs: [
      {
        q: "How do I reach Shri Radha Govind Store customer support?",
        a: "You can submit a ticket right here in our Help Center, email us at support@shriradhagovindstore.com, or message/call us on WhatsApp at +91 7500533505. Our seva team is active Monday through Saturday from 10:00 AM to 7:00 PM IST.",
      },
      {
        q: "Where is the store located?",
        a: "Our physical store is located at 155, 2nd Floor, Madan Mohan Ghera, Vrindavan, Mathura, Uttar Pradesh - 281121. All items are blessed and dispatched directly from holy Sri Vrindavan Dham.",
      },
    ],
  },
];

// GET /api/support/faq - Public Help Center FAQ list
r.get("/faq", (_req, res) => {
  res.json({ categories: FAQ_DATA });
});

const createTicketSchema = z.object({
  customerName: z.string().trim().min(2, "Name must be at least 2 characters").max(100),
  customerEmail: z.string().trim().email("Valid email required").toLowerCase(),
  customerPhone: z.string().trim().max(20).optional().default(""),
  orderIdOrNo: z.union([z.string(), z.number()]).optional().nullable(),
  category: z.enum(SUPPORT_CATEGORIES as unknown as [string, ...string[]]),
  subject: z.string().trim().min(3, "Subject must be at least 3 characters").max(200),
  message: z.string().trim().min(5, "Message must be at least 5 characters").max(4000),
});

// POST /api/support/tickets - Create a new support ticket (Guest or Authenticated)
r.post("/tickets", ticketCreationLimiter, optionalAuth, async (req, res, next) => {
  try {
    const parsed = createTicketSchema.parse(req.body);
    const userId = req.user?.sub || null;

    // If authenticated, prefer authenticated user's email/name if not provided
    const emailToUse = userId && req.user?.email ? req.user.email.toLowerCase().trim() : parsed.customerEmail;
    const nameToUse = parsed.customerName;

    const result = await createSupportTicket({
      userId,
      customerName: nameToUse,
      customerEmail: emailToUse,
      customerPhone: parsed.customerPhone,
      orderIdOrNo: parsed.orderIdOrNo,
      category: parsed.category as SupportCategory,
      subject: parsed.subject,
      message: parsed.message,
    });

    if (!result.success || !result.ticket) {
      throw new HttpError(400, result.error || "Failed to create support ticket");
    }

    res.status(201).json({
      ok: true,
      ticket: sanitizeTicketForCustomer(result.ticket),
      message: "Hare Krishna! Your support ticket has been registered. We aim to respond within 24 business hours.",
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/support/tickets/my - List all tickets for authenticated customer
r.get("/tickets/my", requireAuth, async (req, res, next) => {
  try {
    const userId = req.user!.sub;
    const userEmail = req.user?.email ? req.user.email.toLowerCase().trim() : "";

    const filter: any = {
      $or: [
        { userId },
        ...(userEmail ? [{ customerEmail: userEmail }] : []),
      ],
    };

    const tickets = await SupportTicket.find(filter)
      .sort({ updatedAt: -1 })
      .select("-messages.isInternal -messages.senderId -createdEmailSentAt -resolvedEmailSentAt -closedEmailSentAt");

    const sanitized = tickets.map(sanitizeTicketForCustomer);
    res.json({ ok: true, tickets: sanitized });
  } catch (err) {
    next(err);
  }
});

// GET /api/support/tickets/:ticketIdOrNo - Get single ticket by ticket number or ID
// Authenticated user checks ownership; Guest requires matching ?email= query param
r.get("/tickets/:ticketIdOrNo", optionalAuth, async (req, res, next) => {
  try {
    const ticketIdOrNo = Array.isArray(req.params.ticketIdOrNo)
      ? req.params.ticketIdOrNo[0]
      : req.params.ticketIdOrNo;
    const ticket = await findTicketByIdOrNo(ticketIdOrNo);
    if (!ticket) throw new HttpError(404, "Support ticket not found");

    const userId = req.user?.sub;
    const userEmail = req.user?.email ? req.user.email.toLowerCase().trim() : "";
    const queryEmail = typeof req.query.email === "string" ? req.query.email.toLowerCase().trim() : "";

    let isAuthorized = false;

    // 1. Authenticated customer ownership
    if (userId && ticket.userId && String(ticket.userId) === userId) {
      isAuthorized = true;
    } else if (userEmail && userEmail === ticket.customerEmail.toLowerCase().trim()) {
      isAuthorized = true;
    } else if (req.user?.role === "admin") {
      isAuthorized = true;
    }
    // 2. Guest customer verification via submitted email
    else if (queryEmail && queryEmail === ticket.customerEmail.toLowerCase().trim()) {
      isAuthorized = true;
    }

    if (!isAuthorized) {
      throw new HttpError(
        403,
        "Access denied. Please sign in or provide the email address associated with this support ticket."
      );
    }

    res.json({ ok: true, ticket: sanitizeTicketForCustomer(ticket) });
  } catch (err) {
    next(err);
  }
});

const replySchema = z.object({
  message: z.string().trim().min(2, "Reply message must be at least 2 characters").max(4000),
  email: z.string().trim().email().optional(),
});

// POST /api/support/tickets/:ticketIdOrNo/reply - Customer reply (Guest or Authenticated)
r.post("/tickets/:ticketIdOrNo/reply", replyLimiter, optionalAuth, async (req, res, next) => {
  try {
    const parsed = replySchema.parse(req.body);
    const userId = req.user?.sub;
    const userEmail = req.user?.email ? req.user.email.toLowerCase().trim() : parsed.email?.toLowerCase().trim();
    const ticketIdOrNo = Array.isArray(req.params.ticketIdOrNo)
      ? req.params.ticketIdOrNo[0]
      : req.params.ticketIdOrNo;

    const result = await addCustomerReply({
      ticketIdOrNo,
      userId,
      customerEmail: userEmail,
      message: parsed.message,
    });

    if (!result.success || !result.ticket) {
      throw new HttpError(400, result.error || "Failed to submit reply");
    }

    res.json({
      ok: true,
      ticket: sanitizeTicketForCustomer(result.ticket),
      message: "Your reply has been submitted. Our seva team will review it shortly.",
    });
  } catch (err) {
    next(err);
  }
});

export default r;
