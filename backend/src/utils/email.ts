import { Resend } from "resend";
import { env } from "../config/env";
import { generateInvoicePDF, type InvoiceData } from "./invoice";

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

export type EmailAttachment = { filename: string; content: Buffer };

export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  attachments?: EmailAttachment[];
}) {
  if (!resend) {
    // eslint-disable-next-line no-console
    console.log("[email:disabled]", opts.subject, "→", opts.to, opts.attachments?.length ? `(+${opts.attachments.length} attachment)` : "");
    return { skipped: true };
  }
  try {
    return await resend.emails.send({
      from: env.RESEND_FROM,
      to: opts.to,
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

/**
 * Sends an order-confirmation email with a PDF invoice attached.
 * Always use this helper for successful orders so the invoice is generated once.
 */
export async function sendOrderConfirmationWithInvoice(
  to: string,
  name: string,
  order: Parameters<typeof tpl.orderConfirmed>[1] & { customerEmail?: string; createdAt?: Date | string | number }
) {
  const built = tpl.orderConfirmed(name, order);
  let attachments: EmailAttachment[] | undefined;
  try {
    const invoiceData: InvoiceData = {
      orderId: String(order._id),
      trackingId: order.trackingId,
      courier: order.courier ?? null,
      customerName: name,
      customerEmail: to,
      items: order.items,
      subtotal: order.subtotal,
      shipping: order.shipping,
      total: order.total,
      address: order.address,
      payment: order.payment,
      createdAt: order.createdAt,
    };
    const pdf = await generateInvoicePDF(invoiceData);
    const fname = `Invoice-${order.trackingId ?? String(order._id).slice(-8).toUpperCase()}.pdf`;
    attachments = [{ filename: fname, content: pdf }];
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[invoice:error]", e);
  }
  return sendEmail({ to, subject: built.subject, html: built.html, attachments });
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
    <div style="padding:16px 24px;background:#fafaf8;color:#888;font-size:11px;text-align:center">
      © ${new Date().getFullYear()} ${BRAND}. Radhe Radhe 🙏
    </div>
  </div>
</div>`;

type Item = { name?: string; price?: number; qty: number };
type Addr = { name?: string; phone?: string; line1?: string; city?: string; state?: string; pincode?: string };

const rupee = (n: number) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

const invoiceTable = (items: Item[], subtotal: number, shipping: number, total: number) => `
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
      ${items.map((i) => `
        <tr style="border-top:1px solid #eee">
          <td style="padding:10px 12px">${i.name ?? "Item"}</td>
          <td style="padding:10px 12px;text-align:center">${i.qty}</td>
          <td style="padding:10px 12px;text-align:right">${rupee(i.price ?? 0)}</td>
          <td style="padding:10px 12px;text-align:right">${rupee((i.price ?? 0) * i.qty)}</td>
        </tr>`).join("")}
    </tbody>
    <tfoot>
      <tr><td colspan="3" style="padding:8px 12px;text-align:right">Subtotal</td><td style="padding:8px 12px;text-align:right">${rupee(subtotal)}</td></tr>
      <tr><td colspan="3" style="padding:8px 12px;text-align:right">Shipping</td><td style="padding:8px 12px;text-align:right">${shipping === 0 ? "FREE" : rupee(shipping)}</td></tr>
      <tr style="background:#f4f4f1;font-weight:700">
        <td colspan="3" style="padding:10px 12px;text-align:right">Total Paid</td>
        <td style="padding:10px 12px;text-align:right;color:${ACCENT}">${rupee(total)}</td>
      </tr>
    </tfoot>
  </table>`;

const addrBlock = (a: Addr) => `
  <div style="margin-top:14px;font-size:13px;line-height:1.5;color:#444">
    <b>${a.name ?? ""}</b><br/>
    ${a.line1 ?? ""}, ${a.city ?? ""} ${a.state ?? ""} ${a.pincode ?? ""}<br/>
    📞 ${a.phone ?? "-"}
  </div>`;

export const tpl = {
  welcome: (name: string) => ({
    subject: `Welcome to ${BRAND} 🙏`,
    html: shell(`<h2 style="margin:0 0 8px">Radhe Radhe, ${name}!</h2>
      <p>Your devotee account is ready. Explore sacred essentials curated from Vrindavan.</p>`),
  }),

  passwordResetOtp: (name: string, otp: string) => ({
    subject: `Password reset OTP · ${BRAND}`,
    html: shell(`<h2 style="margin:0 0 8px">Radhe Radhe, ${name}</h2>
      <p>Use this OTP to reset your password. It expires in 10 minutes.</p>
      <div style="margin:18px 0;padding:14px 18px;background:#f0fdfa;border:1px solid #ccfbf1;border-radius:10px;font-size:28px;font-weight:700;letter-spacing:6px;color:${ACCENT};text-align:center">${otp}</div>
      <p style="font-size:13px;color:#777">If you did not request this, you can ignore this email.</p>`),
  }),

  orderConfirmed: (
    name: string,
    order: {
      _id: any;
      trackingId?: string;
      courier?: string | null;
      items: Item[];
      subtotal: number;
      shipping: number;
      total: number;
      address: Addr;
      payment: { method: string; status: string; razorpayPaymentId?: string };
    }
  ) => ({
    subject: `Order confirmed · #${order.trackingId ?? String(order._id).slice(-6).toUpperCase()}`,
    html: shell(`
      <h2 style="margin:0 0 6px">Thank you, ${name}! 🌸</h2>
      <p style="margin:0 0 4px;color:#555">Your order has been received and confirmed.</p>
      <div style="margin:16px 0;padding:14px 16px;background:#f0fdfa;border:1px solid #ccfbf1;border-radius:10px">
        <div style="font-size:12px;color:#0f766e;letter-spacing:.1em;text-transform:uppercase">Tracking ID</div>
        <div style="font-size:22px;font-weight:700;color:#0f766e">${order.trackingId ?? "-"}</div>
        <div style="margin-top:6px;font-size:13px;color:#555">Courier: <b>${order.courier ?? "To be assigned"}</b></div>
        <a href="https://shriradhagovindstore.com/track?id=${encodeURIComponent(order.trackingId ?? "")}"
          style="display:inline-block;margin-top:10px;background:${ACCENT};color:#fff;padding:8px 14px;border-radius:999px;text-decoration:none;font-size:13px">
          Track your order
        </a>
      </div>
      <h3 style="margin:18px 0 4px">Invoice</h3>
      <div style="font-size:12px;color:#888">Order ID: ${String(order._id)} · Payment: ${order.payment.method.toUpperCase()} · ${order.payment.status.toUpperCase()}${order.payment.razorpayPaymentId ? ` · Txn ${order.payment.razorpayPaymentId}` : ""}</div>
      ${invoiceTable(order.items, order.subtotal, order.shipping, order.total)}
      <h3 style="margin:20px 0 4px">Shipping to</h3>
      ${addrBlock(order.address)}
    `),
  }),

  paymentFailed: (name: string, ref: string, amount: number, reason: string) => ({
    subject: `Payment failed · order auto-cancelled`,
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
    url?: string
  ) => ({
    subject: `Order #${ref} · ${status}`,
    html: shell(`
      <h2 style="margin:0 0 6px">Update on your order</h2>
      <p>Hi ${name}, your order <b>#${ref}</b> is now <b style="color:${ACCENT}">${status}</b>.</p>
      ${trackingId ? `<div style="margin-top:14px;padding:12px 14px;background:#f0fdfa;border:1px solid #ccfbf1;border-radius:10px">
        <div style="font-size:12px;color:${ACCENT};letter-spacing:.1em;text-transform:uppercase">Tracking</div>
        <div style="font-size:18px;font-weight:700">${trackingId}</div>
        <div style="margin-top:4px;font-size:13px">Courier: <b>${courier ?? "—"}</b></div>
        ${url ? `<a href="${url}" style="font-size:13px;color:${ACCENT}">Track on courier site →</a>` : ""}
      </div>` : ""}
      <a href="https://shriradhagovindstore.com/track${trackingId ? `?id=${encodeURIComponent(trackingId)}` : ""}" style="display:inline-block;margin-top:14px;background:${ACCENT};color:#fff;padding:10px 16px;border-radius:999px;text-decoration:none;font-size:13px">View order</a>
    `),
  }),

  // legacy alias kept for other call sites
  orderPlaced: (name: string, orderId: string, total: number) => ({
    subject: `Order #${orderId.slice(-6).toUpperCase()} received`,
    html: shell(`<h2>Thank you, ${name}!</h2><p>Your order <b>#${orderId}</b> for <b>${rupee(total)}</b> has been received.</p>`),
  }),
};
