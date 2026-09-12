import { Resend } from "resend";
import { env } from "../config/env";
import { Order } from "../models/Order";
import { generateInvoicePDF, type InvoiceData } from "./invoice";
import { getCourierTrackingUrl } from "./courier";

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

export type EmailAttachment = { filename: string; content: Buffer };

export type EmailOrderPayload = {
  _id: any;
  orderNo?: number | string | null;
  trackingId?: string;
  courier?: string | null;
  courierTrackingUrl?: string;
  status?: string;
  businessName?: string;
  gstin?: string;
  needsGstInvoice?: boolean;
  items: Item[];
  subtotal: number;
  shipping: number;
  total: number;
  address: Addr;
  payment: { method: string; status: string; razorpayPaymentId?: string };
  customerEmail?: string;
  createdAt?: Date | string | number;
};

export function formatOrderNumber(order: {
  orderNo?: number | string | null;
  _id?: any;
  id?: string;
}): string {
  if (order.orderNo !== undefined && order.orderNo !== null && order.orderNo !== "") {
    return String(order.orderNo).padStart(4, "0");
  }
  const idStr = String(order._id ?? order.id ?? "");
  if (idStr) {
    const hash = idStr.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
    return String(5000 + (hash % 5000)).padStart(4, "0");
  }
  return "5000";
}

export function buildEmailOrderPayload(o: any): EmailOrderPayload {
  return {
    _id: o._id,
    orderNo: o.orderNo ?? undefined,
    trackingId: o.trackingId ?? undefined,
    courier: o.courier ?? undefined,
    courierTrackingUrl: o.courierTrackingUrl ?? undefined,
    status: o.status ?? "Placed",
    businessName: o.businessName ?? undefined,
    gstin: o.gstin ?? undefined,
    needsGstInvoice: o.needsGstInvoice,
    items: o.items as any,
    subtotal: o.subtotal ?? 0,
    shipping: o.shipping ?? 0,
    total: o.total ?? 0,
    address: o.address as any,
    payment: {
      method: o.payment?.method ?? "cod",
      status: o.payment?.status ?? "pending",
      razorpayPaymentId: o.payment?.razorpayPaymentId ?? undefined,
    },
    customerEmail: o.customerEmail ?? undefined,
    createdAt: o.createdAt,
  };
}

export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  bcc?: string[];
  attachments?: EmailAttachment[];
}) {
  if (!resend) {
    // eslint-disable-next-line no-console
    console.log("[email:disabled]", opts.subject, "->", opts.to, opts.bcc ? `(bcc: ${opts.bcc.join(",")})` : "", opts.attachments?.length ? `(+${opts.attachments.length} attachment)` : "");
    return { skipped: true };
  }
  try {
    return await resend.emails.send({
      from: env.RESEND_FROM,
      to: opts.to,
      bcc: opts.bcc,
      subject: opts.subject,
      html: opts.html,
      attachments: opts.attachments?.map((a) => ({ filename: a.filename, content: a.content })),
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[email:error]", e);
    return { error: String(e) };
  }
}

const SUPPORT_EMAIL_BCC = ["support@shriradhagovindstore.com"];

/**
 * Sends an order-confirmation email with a PDF invoice attached.
 * Always use this helper for successful orders so the invoice is generated once.
 */
export async function sendOrderConfirmationWithInvoice(
  to: string,
  name: string,
  order: EmailOrderPayload
) {
  const orderNum = formatOrderNumber(order);
  const built = tpl.orderConfirmed(name, order);
  let attachments: EmailAttachment[] | undefined;
  try {
    const invoiceData: InvoiceData = {
      orderId: String(order._id),
      orderNo: order.orderNo ?? orderNum,
      invoiceNo: `INV-${orderNum}`,
      trackingId: order.trackingId,
      courier: order.courier ?? null,
      status: order.status,
      customerName: name,
      customerEmail: to,
      businessName: order.businessName,
      gstin: order.gstin,
      needsGstInvoice: order.needsGstInvoice,
      items: order.items,
      subtotal: order.subtotal,
      shipping: order.shipping,
      total: order.total,
      address: order.address,
      payment: order.payment,
      createdAt: order.createdAt,
    };
    const pdf = await generateInvoicePDF(invoiceData);
    const fname = `Invoice-${orderNum}.pdf`;
    attachments = [{ filename: fname, content: pdf }];
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[invoice:error]", e);
  }
  return exports.sendEmail({
    to,
    bcc: SUPPORT_EMAIL_BCC,
    subject: built.subject,
    html: built.html,
    attachments,
  });
}

/**
 * Safely and idempotently dispatches the order confirmation email with invoice PDF.
 * Strict rules enforced:
 * 1. Check order.invoiceSentAt. If already sent, do NOT generate or send another invoice.
 * 2. Atomic lock via invoiceLockUntil prevents duplicate concurrent sends (e.g. concurrent webhooks or status changes).
 * 3. Generate invoice PDF.
 * 4. Send invoice email.
 * 5. ONLY AFTER the email sending operation succeeds: persist invoiceSentAt and clear the lock.
 * 6. If invoice generation or email fails: invoiceSentAt MUST remain null/unset, lock is cleared, allowing legitimate retries.
 */
export async function dispatchOrderInvoiceEmailOnce(
  orderId: any,
  to: string,
  name: string,
  order: EmailOrderPayload
): Promise<{ success: boolean; reason?: string; skipped?: boolean }> {
  if (!orderId || !to) return { success: false, reason: "missing_recipient_or_order_id" };

  const now = new Date();
  const lockExpiry = new Date(now.getTime() + 60 * 1000); // 60-second atomic lock window

  // Atomic check and lock: order must NOT have invoiceSentAt set, and must NOT have an active lock
  const lockedOrder = await Order.findOneAndUpdate(
    {
      _id: orderId,
      invoiceSentAt: null,
      $or: [
        { invoiceLockUntil: null },
        { invoiceLockUntil: { $lt: now } },
      ],
    },
    {
      $set: { invoiceLockUntil: lockExpiry },
    },
    { new: true }
  );

  if (!lockedOrder) {
    // Either already sent (invoiceSentAt is not null) or another worker is actively sending right now
    return { success: false, reason: "already_sent_or_in_progress", skipped: true };
  }

  try {
    const orderNum = formatOrderNumber(order);
    const invoiceData: InvoiceData = {
      orderId: String(order._id),
      orderNo: order.orderNo ?? orderNum,
      invoiceNo: `INV-${orderNum}`,
      trackingId: order.trackingId,
      courier: order.courier ?? null,
      status: order.status,
      customerName: name,
      customerEmail: to,
      businessName: order.businessName,
      gstin: order.gstin,
      needsGstInvoice: order.needsGstInvoice,
      items: order.items,
      subtotal: order.subtotal,
      shipping: order.shipping,
      total: order.total,
      address: order.address,
      payment: order.payment,
      createdAt: order.createdAt,
    };

    const pdf = await generateInvoicePDF(invoiceData);
    const fname = `Invoice-${orderNum}.pdf`;
    const attachments: EmailAttachment[] = [{ filename: fname, content: pdf }];

    const built = tpl.orderConfirmed(name, order);
    const sendResult = await exports.sendEmail({
      to,
      bcc: SUPPORT_EMAIL_BCC,
      subject: built.subject,
      html: built.html,
      attachments,
    });

    if (sendResult && (sendResult as any).error) {
      throw new Error(`Email provider error: ${JSON.stringify((sendResult as any).error)}`);
    }

    // ONLY AFTER the email sending operation succeeds: persist invoiceSentAt and release lock
    const sentDate = new Date();
    await Order.findByIdAndUpdate(orderId, {
      $set: {
        invoiceSentAt: sentDate,
        invoiceLockUntil: null,
      },
    });

    return { success: true };
  } catch (err: any) {
    console.error("[dispatchOrderInvoiceEmailOnce] Failed to generate/send invoice email:", err);
    // Release the lock so a legitimate retry remains possible. invoiceSentAt MUST remain null/unset!
    await Order.findByIdAndUpdate(orderId, {
      $set: { invoiceLockUntil: null },
    }).catch(() => {});
    return { success: false, reason: err?.message || String(err) };
  }
}

/**
 * Sends a status update email WITHOUT invoice attachment.
 * Per business rules:
 * - Routine intermediate status updates (Processing, Hold, Packed, Shipped, Out for delivery, etc.)
 *   are sent to the customer ONLY with NO support BCC.
 * - Delivered notifications must be dispatched via dispatchOrderDeliveredEmailOnce to guarantee
 *   exactly ONE email with support BCC and prevent duplicate notifications on subsequent edits.
 */
export async function sendOrderStatusUpdate(
  to: string,
  name: string,
  order: EmailOrderPayload & { status: string },
  options?: { includeSupportBcc?: boolean }
) {
  const orderNum = formatOrderNumber(order);
  const built = tpl.statusUpdate(
    name,
    orderNum,
    order.status,
    order.trackingId,
    order.courier,
    order.courierTrackingUrl,
    order,
  );
  return exports.sendEmail({
    to,
    bcc: options?.includeSupportBcc ? SUPPORT_EMAIL_BCC : undefined,
    subject: built.subject,
    html: built.html,
  });
}

/**
 * Safely and idempotently dispatches the Delivered order email.
 * Strict rules enforced:
 * 1. Check order.deliveredSentAt. If already sent, do NOT send another email.
 * 2. Atomic lock via deliveredLockUntil prevents duplicate concurrent sends (e.g. concurrent webhook/admin/carrier sync).
 * 3. Sends email to customer with SUPPORT_EMAIL_BCC attached (so support receives exactly ONE Delivered email).
 * 4. ONLY AFTER the email sending operation succeeds: persist deliveredSentAt and clear the lock.
 * 5. If email provider fails: deliveredSentAt MUST remain null/unset, lock is cleared, allowing legitimate retries.
 */
export async function dispatchOrderDeliveredEmailOnce(
  orderId: any,
  to: string,
  name: string,
  order: EmailOrderPayload & { status: string }
): Promise<{ success: boolean; reason?: string; skipped?: boolean }> {
  if (!orderId || !to) return { success: false, reason: "missing_recipient_or_order_id" };

  const now = new Date();
  const lockExpiry = new Date(now.getTime() + 60 * 1000); // 60-second atomic lock window

  // Atomic check and lock: order must NOT have deliveredSentAt set, and must NOT have an active lock
  const lockedOrder = await Order.findOneAndUpdate(
    {
      _id: orderId,
      deliveredSentAt: null,
      $or: [
        { deliveredLockUntil: null },
        { deliveredLockUntil: { $lt: now } },
      ],
    },
    {
      $set: { deliveredLockUntil: lockExpiry },
    },
    { new: true }
  );

  if (!lockedOrder) {
    // Either already sent (deliveredSentAt is not null) or another worker is actively sending right now
    return { success: false, reason: "already_sent_or_in_progress", skipped: true };
  }

  try {
    const sendResult = await sendOrderStatusUpdate(to, name, order, { includeSupportBcc: true });

    if (sendResult && (sendResult as any).error) {
      throw new Error(`Email provider error: ${JSON.stringify((sendResult as any).error)}`);
    }

    // ONLY AFTER the email sending operation succeeds: persist deliveredSentAt and release lock
    const sentDate = new Date();
    await Order.findByIdAndUpdate(orderId, {
      $set: {
        deliveredSentAt: sentDate,
        deliveredLockUntil: null,
      },
    });

    return { success: true };
  } catch (err: any) {
    console.error("[dispatchOrderDeliveredEmailOnce] Failed to send delivered email:", err);
    // Release the lock so a legitimate retry remains possible. deliveredSentAt MUST remain null/unset!
    await Order.findByIdAndUpdate(orderId, {
      $set: { deliveredLockUntil: null },
    }).catch(() => {});
    return { success: false, reason: err?.message || String(err) };
  }
}

export async function sendOrderStatusUpdateWithInvoice(
  to: string,
  name: string,
  order: EmailOrderPayload & { status: string }
) {
  const orderNum = formatOrderNumber(order);
  const built = tpl.statusUpdate(
    name,
    orderNum,
    order.status,
    order.trackingId,
    order.courier,
    order.courierTrackingUrl,
    order,
  );
  let attachments: EmailAttachment[] | undefined;
  try {
    const invoiceData: InvoiceData = {
      orderId: String(order._id),
      orderNo: order.orderNo ?? orderNum,
      invoiceNo: `INV-${orderNum}`,
      trackingId: order.trackingId,
      courier: order.courier ?? null,
      status: order.status,
      customerName: name,
      customerEmail: to,
      businessName: order.businessName,
      gstin: order.gstin,
      needsGstInvoice: order.needsGstInvoice,
      items: order.items,
      subtotal: order.subtotal,
      shipping: order.shipping,
      total: order.total,
      address: order.address,
      payment: order.payment,
      createdAt: order.createdAt,
    };
    const pdf = await generateInvoicePDF(invoiceData);
    const fname = `Invoice-${orderNum}.pdf`;
    attachments = [{ filename: fname, content: pdf }];
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[invoice:error]", e);
  }
  return exports.sendEmail({
    to,
    bcc: SUPPORT_EMAIL_BCC,
    subject: built.subject,
    html: built.html,
    attachments,
  });
}

const BRAND = "Shri Radha Govind Store";
const ACCENT = "#0f766e";

const shell = (inner: string) => `
<div style="font-family:system-ui,Segoe UI,Arial,sans-serif;background:#f7f7f5;padding:24px;color:#1c1c1c">
  <div style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #ececec">
    <div style="background:${ACCENT};color:#fff;padding:18px 24px">
      <div style="font-size:18px;font-weight:600;letter-spacing:0.3px">${BRAND}</div>
      <div style="opacity:.85;font-size:12px">Made with love from Vrindavan</div>
    </div>
    <div style="padding:24px">${inner}</div>
    <div style="border-top:1px solid #ececec;padding:18px 24px;background:#fafaf8;color:#666;font-size:12px;line-height:1.6;text-align:center">
      <p style="margin:0 0 6px;color:#888;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px">
        Please do not reply to this email.
      </p>
      <p style="margin:0 0 4px;color:#555">
        For any queries, please contact us at
        <a href="mailto:support@shriradhagovindstore.com" style="color:${ACCENT};font-weight:600;text-decoration:none">support@shriradhagovindstore.com</a>
      </p>
      <p style="margin:0 0 10px;color:#555">
        For assistance, call or WhatsApp us at
        <a href="tel:+917500533505" style="color:${ACCENT};font-weight:600;text-decoration:none">7500533505</a>
        (<a href="https://wa.me/917500533505" style="color:${ACCENT};font-weight:600;text-decoration:none">WhatsApp</a>)
      </p>
      <div style="border-top:1px solid #f0f0ee;padding-top:10px;color:#999;font-size:11px">
        © ${new Date().getFullYear()} ${BRAND} · Made with love from Vrindavan · Radhe Radhe
      </div>
    </div>
  </div>
</div>`;

type Item = { name?: string; price?: number; qty: number };
type Addr = {
  name?: string;
  phone?: string;
  alternatePhone?: string;
  line1?: string;
  line2?: string;
  postOffice?: string;
  city?: string;
  state?: string;
  pincode?: string;
};

const rupee = (n?: number) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

const invoiceTable = (items?: Item[], subtotal?: number, shipping?: number, total?: number) => `
  <table style="width:100%;border-collapse:collapse;margin-top:12px;font-size:14px">
    <thead>
      <tr style="background:#f4f4f1;text-align:left">
        <th style="padding:10px 12px">Item</th>
        <th style="padding:10px 12px;text-align:center">Qty</th>
        <th style="padding:10px 12px;text-align:right">Price</th>
        <th style="padding:10px 12px;text-align:right">Amount</th>
      </tr>
    </thead>
    <tbody>
      ${(items || []).map((i) => `
        <tr style="border-top:1px solid #eee">
          <td style="padding:10px 12px">${i.name ?? "Item"}</td>
          <td style="padding:10px 12px;text-align:center">${i.qty}</td>
          <td style="padding:10px 12px;text-align:right">${rupee(i.price ?? 0)}</td>
          <td style="padding:10px 12px;text-align:right">${rupee((i.price ?? 0) * (i.qty || 1))}</td>
        </tr>`).join("")}
    </tbody>
    <tfoot>
      <tr><td colspan="3" style="padding:8px 12px;text-align:right">Subtotal</td><td style="padding:8px 12px;text-align:right">${rupee(subtotal || 0)}</td></tr>
      <tr><td colspan="3" style="padding:8px 12px;text-align:right">Shipping</td><td style="padding:8px 12px;text-align:right">${!shipping || shipping === 0 ? "FREE" : rupee(shipping)}</td></tr>
      <tr style="background:#f4f4f1;font-weight:700">
        <td colspan="3" style="padding:10px 12px;text-align:right">Total Paid</td>
        <td style="padding:10px 12px;text-align:right;color:${ACCENT}">${rupee(total || 0)}</td>
      </tr>
    </tfoot>
  </table>`;

const customerBlock = (name: string, email?: string, a?: Addr, businessName?: string, gstin?: string) => `
  <div style="margin-top:16px;padding:14px 16px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;font-size:13px;line-height:1.6;color:#374151">
    <div style="font-weight:700;color:#111827;font-size:14px;margin-bottom:6px">Customer & Delivery Details</div>
    <div><b>${a?.name || name}</b></div>
    ${businessName ? `<div style="margin-top:2px"><b>Business:</b> ${businessName}</div>` : ""}
    ${gstin ? `<div style="margin-top:2px"><b>Customer GSTIN:</b> ${gstin}</div>` : ""}
    ${email ? `<div>Email: <a href="mailto:${email}" style="color:${ACCENT};text-decoration:none">${email}</a></div>` : ""}
    ${a?.phone ? `<div>Phone: <a href="tel:${a.phone}" style="color:${ACCENT};text-decoration:none">${a.phone}</a></div>` : ""}
    ${a?.alternatePhone ? `<div>Alt Phone: <a href="tel:${a.alternatePhone}" style="color:${ACCENT};text-decoration:none">${a.alternatePhone}</a></div>` : ""}
    ${a?.line1 || a?.line2 || a?.postOffice || a?.city || a?.state || a?.pincode ? `
      <div style="margin-top:8px;padding-top:8px;border-top:1px solid #e5e7eb;color:#4b5563">
        <div style="font-weight:600;font-size:12px;color:#6b7280;text-transform:uppercase;margin-bottom:2px">Delivery Address</div>
        ${a.line1 ? `<div>${a.line1}</div>` : ""}
        ${a.line2 ? `<div>${a.line2}</div>` : ""}
        ${a.postOffice ? `<div>PO: ${a.postOffice}</div>` : ""}
        <div>${[a.city, a.state, a.pincode].filter(Boolean).join(", ")}</div>
      </div>
    ` : ""}
  </div>`;

export const tpl = {
  welcome: (name: string) => ({
    subject: `Welcome to ${BRAND}`,
    html: shell(`<h2 style="margin:0 0 8px">Radhe Radhe, ${name}!</h2>
      <p>Your devotee account is ready. Explore sacred essentials curated from Vrindavan.</p>`),
  }),

  loginOtp: (name: string, otp: string) => ({
    subject: `Your Login OTP - ${BRAND}`,
    html: shell(`<h2 style="margin:0 0 8px">Radhe Radhe, ${name || "Devotee"}</h2>
      <p>Use this secure 6-digit OTP to sign in to your Shri Radha Govind Store account. It is valid for 10 minutes.</p>
      <div style="margin:18px 0;padding:14px 18px;background:#f0fdfa;border:1px solid #ccfbf1;border-radius:10px;font-size:28px;font-weight:700;letter-spacing:6px;color:${ACCENT};text-align:center">${otp}</div>
      <p style="font-size:13px;color:#777">If you did not request this OTP, you can safely ignore this email.</p>`),
  }),

  passwordResetOtp: (name: string, otp: string) => ({
    subject: `Password reset OTP - ${BRAND}`,
    html: shell(`<h2 style="margin:0 0 8px">Radhe Radhe, ${name}</h2>
      <p>Use this OTP to reset your password. It expires in 10 minutes.</p>
      <div style="margin:18px 0;padding:14px 18px;background:#f0fdfa;border:1px solid #ccfbf1;border-radius:10px;font-size:28px;font-weight:700;letter-spacing:6px;color:${ACCENT};text-align:center">${otp}</div>
      <p style="font-size:13px;color:#777">If you did not request this, you can ignore this email.</p>`),
  }),

  orderConfirmed: (
    name: string,
    order: EmailOrderPayload
  ) => {
    const orderNum = formatOrderNumber(order);
    const trackingUrl = order.courierTrackingUrl || getCourierTrackingUrl(order.courier, order.trackingId);
    const hasTracking = !!(order.trackingId && order.trackingId.trim());

    return {
      subject: `Order confirmed - #${orderNum}`,
      html: shell(`
        <h2 style="margin:0 0 6px">Thank you, ${name}! 🌸</h2>
        <p style="margin:0 0 4px;color:#555">Your order <b>#${orderNum}</b> has been received and confirmed.</p>

        <div style="margin:16px 0;padding:14px 16px;background:#f0fdfa;border:1px solid #ccfbf1;border-radius:10px">
          ${hasTracking ? `
            <div style="font-size:12px;color:#0f766e;letter-spacing:.1em;text-transform:uppercase">Tracking ID (AWB)</div>
            <div style="font-size:22px;font-weight:700;color:#0f766e">${order.trackingId}</div>
            <div style="margin-top:6px;font-size:13px;color:#555">Order Number: <b>#${orderNum}</b></div>
            <div style="margin-top:4px;font-size:13px;color:#555">Status: <b style="color:${ACCENT}">${order.status ?? "Confirmed"}</b></div>
            <div style="margin-top:4px;font-size:13px;color:#555">Courier: <b>${order.courier ?? "To be assigned"}</b></div>
            ${trackingUrl ? `<div style="margin-top:8px"><a href="${trackingUrl}" style="display:inline-block;background:${ACCENT};color:#fff;padding:8px 16px;border-radius:999px;text-decoration:none;font-size:13px;font-weight:500">Track with ${order.courier || "Courier"}</a></div>` : ""}
          ` : `
            <div style="font-size:12px;color:#0f766e;letter-spacing:.1em;text-transform:uppercase">Order Details</div>
            <div style="font-size:20px;font-weight:700;color:#0f766e">Order #${orderNum}</div>
            <div style="margin-top:6px;font-size:13px;color:#555">Status: <b style="color:${ACCENT}">${order.status ?? "Confirmed"}</b></div>
            ${order.courier ? `<div style="margin-top:4px;font-size:13px;color:#555">Courier: <b>${order.courier}</b></div>` : ""}
            <div style="margin-top:4px;font-size:13px;color:#777">Tracking ID: <i>Will be assigned once shipped</i></div>
            <div style="margin-top:10px">
              <a href="https://www.shriradhagovindstore.com/track?id=${encodeURIComponent(orderNum)}"
                style="display:inline-block;background:${ACCENT};color:#fff;padding:8px 16px;border-radius:999px;text-decoration:none;font-size:13px;font-weight:500">
                View order status
              </a>
            </div>
          `}
        </div>

        <h3 style="margin:18px 0 4px">Invoice & Order Details</h3>
        <div style="font-size:12px;color:#888">Order ID: #${orderNum}${hasTracking ? ` | Tracking ID: ${order.trackingId}` : ""} | Payment: ${order.payment.method.toUpperCase()} | ${order.payment.status.toUpperCase()}${order.payment.razorpayPaymentId ? ` | Txn ${order.payment.razorpayPaymentId}` : ""}</div>
        ${invoiceTable(order.items, order.subtotal, order.shipping, order.total)}

        ${customerBlock(name, order.customerEmail, order.address, order.businessName, order.gstin)}
      `),
    };
  },

  paymentFailed: (name: string, ref: string, amount: number, reason: string) => ({
    subject: `Payment failed for Order #${ref} - order auto-cancelled`,
    html: shell(`
      <h2 style="margin:0 0 8px">Sorry, ${name} 😔</h2>
      <p>Your payment of <b>${rupee(amount)}</b> for order <b>#${ref}</b> could not be verified, so we have automatically cancelled the order.</p>
      <p style="font-size:13px;color:#888">Reason: ${reason}</p>
      <p>No amount has been debited; if your bank shows a hold, it will reverse within 5–7 business days.</p>
      <a href="https://shriradhagovindstore.com/cart" style="display:inline-block;margin-top:10px;background:${ACCENT};color:#fff;padding:10px 16px;border-radius:999px;text-decoration:none;font-size:13px">Try again</a>
    `),
  }),

  orderCancelled: (name: string, ref: string, reason: string) => ({
    subject: `Order #${ref} cancelled`,
    html: shell(`<h2>Hi ${name},</h2><p>Your order <b>#${ref}</b> has been cancelled.</p><p style="color:#888;font-size:13px">${reason}</p>`),
  }),

  statusUpdate: (
    name: string,
    ref: string,
    status: string,
    trackingId?: string,
    courier?: string | null,
    url?: string,
    order?: EmailOrderPayload
  ) => {
    const orderNum = order ? formatOrderNumber(order) : ref;
    const effectiveTrackingId = trackingId ?? order?.trackingId;
    const effectiveCourier = courier ?? order?.courier;
    const trackingUrl = url || order?.courierTrackingUrl || getCourierTrackingUrl(effectiveCourier, effectiveTrackingId);
    const hasTracking = !!(effectiveTrackingId && effectiveTrackingId.trim());

    return {
      subject: `Order #${orderNum} - ${status}`,
      html: shell(`
        <h2 style="margin:0 0 6px">Update on your order</h2>
        <p>Hi ${name}, your order <b>#${orderNum}</b> is now <b style="color:${ACCENT}">${status}</b>.</p>

        <div style="margin:14px 0;padding:14px 16px;background:#f0fdfa;border:1px solid #ccfbf1;border-radius:10px">
          ${hasTracking ? `
            <div style="font-size:12px;color:${ACCENT};letter-spacing:.1em;text-transform:uppercase">Tracking ID (AWB)</div>
            <div style="font-size:20px;font-weight:700;color:${ACCENT}">${effectiveTrackingId}</div>
            <div style="margin-top:6px;font-size:13px;color:#555">Order Number: <b>#${orderNum}</b></div>
            <div style="margin-top:4px;font-size:13px;color:#555">Status: <b style="color:${ACCENT}">${status}</b></div>
            <div style="margin-top:4px;font-size:13px;color:#555">Courier: <b>${effectiveCourier ?? "To be assigned"}</b></div>
            ${trackingUrl ? `<div style="margin-top:8px"><a href="${trackingUrl}" style="display:inline-block;background:${ACCENT};color:#fff;padding:8px 16px;border-radius:999px;text-decoration:none;font-size:13px;font-weight:500">Track with ${effectiveCourier || "Courier"}</a></div>` : ""}
          ` : `
            <div style="font-size:12px;color:${ACCENT};letter-spacing:.1em;text-transform:uppercase">Order Details</div>
            <div style="font-size:20px;font-weight:700;color:${ACCENT}">Order #${orderNum}</div>
            <div style="margin-top:6px;font-size:13px;color:#555">Status: <b style="color:${ACCENT}">${status}</b></div>
            ${effectiveCourier ? `<div style="margin-top:4px;font-size:13px;color:#555">Courier: <b>${effectiveCourier}</b></div>` : ""}
            <div style="margin-top:4px;font-size:13px;color:#777">Tracking ID: <i>Will be assigned once shipped</i></div>
            <div style="margin-top:10px">
              <a href="https://www.shriradhagovindstore.com/track?id=${encodeURIComponent(orderNum)}"
                style="display:inline-block;background:${ACCENT};color:#fff;padding:8px 16px;border-radius:999px;text-decoration:none;font-size:13px;font-weight:500">
                View order status
              </a>
            </div>
          `}
        </div>

        ${order ? `
          <h3 style="margin:18px 0 4px">Order details</h3>
          <div style="font-size:12px;color:#888">Order ID: #${orderNum}${hasTracking ? ` | Tracking ID: ${effectiveTrackingId}` : ""}${order.payment ? ` | Payment: ${(order.payment.method || "ONLINE").toUpperCase()} | ${(order.payment.status || "PAID").toUpperCase()}` : ""}</div>
          ${invoiceTable(order.items, order.subtotal, order.shipping, order.total)}
          ${customerBlock(name, order.customerEmail, order.address, order?.businessName, order?.gstin)}
        ` : ""}
      `),
    };
  },

  // legacy alias kept for other call sites
  orderPlaced: (name: string, orderId: string, total: number) => ({
    subject: `Order #${orderId} received`,
    html: shell(`<h2>Thank you, ${name}!</h2><p>Your order <b>#${orderId}</b> for <b>${rupee(total)}</b> has been received.</p>`),
  }),
};
