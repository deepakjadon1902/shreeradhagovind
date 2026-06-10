import { Resend } from "resend";
import { env } from "../config/env";

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

export async function sendEmail(opts: { to: string; subject: string; html: string }) {
  if (!resend) {
    // eslint-disable-next-line no-console
    console.log("[email:disabled]", opts.subject, "→", opts.to);
    return { skipped: true };
  }
  try {
    const r = await resend.emails.send({
      from: env.RESEND_FROM,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
    });
    return r;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[email:error]", e);
    return { error: String(e) };
  }
}

export const tpl = {
  welcome: (name: string) => ({
    subject: "Welcome to Shri Radha Govind Store 🙏",
    html: `<div style="font-family:system-ui;padding:20px"><h2>Radhe Radhe, ${name}!</h2><p>Your account has been created. Explore sacred essentials curated from Vrindavan.</p></div>`,
  }),
  orderPlaced: (name: string, orderId: string, total: number) => ({
    subject: `Order #${orderId.slice(-6).toUpperCase()} confirmed`,
    html: `<div style="font-family:system-ui;padding:20px"><h2>Thank you, ${name}!</h2><p>Your order <b>#${orderId}</b> for <b>₹${total}</b> has been placed and will ship soon.</p></div>`,
  }),
};
