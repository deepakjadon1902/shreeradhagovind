import { Router, Request, Response, NextFunction } from "express";
import crypto from "crypto";
import Razorpay from "razorpay";
import { z } from "zod";
import { env } from "../config/env";
import { optionalAuth } from "../middleware/auth";
import { HttpError } from "../middleware/error";
import { Product } from "../models/Product";
import { Settings } from "../models/Settings";
import { Order } from "../models/Order";
import { WebhookEvent } from "../models/WebhookEvent";
import {
  sendEmail,
  sendOrderConfirmationWithInvoice,
  buildEmailOrderPayload,
  tpl,
  formatOrderNumber,
} from "../utils/email";

const r = Router();

function getRazorpayInstance(): Razorpay | null {
  const keyId = env.RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID || "";
  const keySecret = env.RAZORPAY_KEY_SECRET || process.env.RAZORPAY_KEY_SECRET || "";
  if (!keyId || !keySecret) return null;
  return new Razorpay({ key_id: keyId, key_secret: keySecret });
}

function getRazorpayKeySecret(): string {
  return env.RAZORPAY_KEY_SECRET || process.env.RAZORPAY_KEY_SECRET || "";
}

function getRazorpayKeyId(): string {
  return env.RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID || "";
}

/**
 * Validates Razorpay Webhook signature using constant-time comparison
 */
export function verifyRazorpayWebhookSignature(
  rawBody: Buffer | string,
  signature: string,
  secret: string
): boolean {
  if (!rawBody || !signature || !secret) return false;
  try {
    const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
    return (
      expected.length === signature.length &&
      crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
    );
  } catch {
    return false;
  }
}

/**
 * Extracts exact failure reason from verified Razorpay webhook payment entity.
 * Does not invent reasons; uses exact description, reason code, or source/step.
 */
export function extractRazorpayFailureReason(paymentEntity: any): string {
  if (!paymentEntity) return "Payment failed — reason not provided by payment gateway";

  const description = paymentEntity.error_description?.trim();
  const reason = paymentEntity.error_reason?.trim();
  const code = paymentEntity.error_code?.trim();
  const source = paymentEntity.error_source?.trim();
  const step = paymentEntity.error_step?.trim();

  if (description) {
    return description;
  }

  if (reason) {
    return reason.replace(/_/g, " ").replace(/^\w/, (c: string) => c.toUpperCase());
  }

  if (code) {
    return `Gateway Error: ${code}`;
  }

  if (source && step) {
    return `Payment failed at ${source} during ${step}`;
  }

  return "Payment failed — reason not provided by payment gateway";
}

/**
 * Handles verified Razorpay webhook events to synchronize order and payment status
 */
export async function processRazorpayWebhookEvent(event: any): Promise<void> {
  const eventType = event?.event;
  const payload = event?.payload;
  if (!eventType || !payload) return;

  // 1. Authoritative Payment Success: payment.captured or order.paid ONLY
  if (eventType === "payment.captured" || eventType === "order.paid") {
    const paymentEntity = payload.payment?.entity;
    const orderEntity = payload.order?.entity;

    const rzpOrderId = paymentEntity?.order_id || orderEntity?.id;
    const rzpPaymentId = paymentEntity?.id;

    if (!rzpOrderId && !rzpPaymentId) {
      console.warn("[Razorpay Webhook] Event received with no order_id or payment_id:", eventType);
      return;
    }

    const orderQuery: any = {
      $or: [
        ...(rzpOrderId ? [{ "payment.razorpayOrderId": rzpOrderId }] : []),
        ...(rzpPaymentId ? [{ "payment.razorpayPaymentId": rzpPaymentId }] : []),
      ],
    };

    const order = await Order.findOne(orderQuery).populate("user", "name email");

    if (!order) {
      console.log(
        `[Razorpay Webhook] Payment received for Razorpay Order ${rzpOrderId || "N/A"} (${rzpPaymentId || "N/A"}), but order document is not yet in database.`
      );
      return;
    }

    const wasAlreadyPaid = order.payment?.status === "paid";

    // Update payment details
    order.payment = {
      method: "razorpay",
      status: "paid",
      razorpayOrderId: rzpOrderId || order.payment?.razorpayOrderId,
      razorpayPaymentId: rzpPaymentId || order.payment?.razorpayPaymentId,
      razorpaySignature: order.payment?.razorpaySignature,
    };
    order.set("payment.failureReason", undefined);

    // Automated State Machine: Order status MUST become "Confirmed" on verified payment
    order.status = "Confirmed";

    await order.save();

    if (!wasAlreadyPaid) {
      console.log(
        `[Razorpay Webhook] Order #${order.orderNo ?? order._id} successfully marked as PAID & CONFIRMED via ${eventType} (Payment ID: ${rzpPaymentId}).`
      );

      const recipientEmail = order.customerEmail || (order.user as any)?.email;
      const recipientName = order.address?.name || (order.user as any)?.name || "Customer";

      if (recipientEmail) {
        sendOrderConfirmationWithInvoice(
          recipientEmail,
          recipientName,
          buildEmailOrderPayload(order)
        ).catch((err) => {
          console.error("[Razorpay Webhook] Failed to send order confirmation email:", err);
        });
      }
    } else {
      console.log(
        `[Razorpay Webhook] Order #${order.orderNo ?? order._id} was already marked as PAID. Webhook acknowledged idempotently.`
      );
    }
  }

  // 2. Payment Authorized (Awaiting capture; not final paid)
  else if (eventType === "payment.authorized") {
    const paymentEntity = payload.payment?.entity;
    const rzpOrderId = paymentEntity?.order_id;
    const rzpPaymentId = paymentEntity?.id;

    console.log(
      `[Razorpay Webhook] payment.authorized received for Razorpay Order ${rzpOrderId || "N/A"} (${rzpPaymentId || "N/A"}). Awaiting authoritative payment.captured.`
    );
  }

  // 3. Payment Failed
  else if (eventType === "payment.failed") {
    const paymentEntity = payload.payment?.entity;
    const rzpOrderId = paymentEntity?.order_id;
    const rzpPaymentId = paymentEntity?.id;
    const failureReason = extractRazorpayFailureReason(paymentEntity);

    if (!rzpOrderId && !rzpPaymentId) return;

    const order = await Order.findOne({
      $or: [
        ...(rzpOrderId ? [{ "payment.razorpayOrderId": rzpOrderId }] : []),
        ...(rzpPaymentId ? [{ "payment.razorpayPaymentId": rzpPaymentId }] : []),
      ],
    }).populate("user", "name email");

    // Guard: Delayed failed event must NEVER downgrade an already paid or Confirmed order
    if (order && order.payment?.status !== "paid" && order.status !== "Confirmed") {
      order.payment = {
        method: "razorpay",
        status: "failed",
        razorpayOrderId: rzpOrderId || order.payment?.razorpayOrderId,
        razorpayPaymentId: rzpPaymentId || order.payment?.razorpayPaymentId,
        failureReason,
      };

      await order.save();

      console.log(
        `[Razorpay Webhook] Order #${order.orderNo ?? order._id} marked as FAILED via ${eventType}: ${failureReason}`
      );

      const recipientEmail = order.customerEmail || (order.user as any)?.email;
      const recipientName = order.address?.name || (order.user as any)?.name || "Customer";

      if (recipientEmail) {
        sendEmail({
          to: recipientEmail,
          ...tpl.paymentFailed(
            recipientName,
            formatOrderNumber(order),
            order.total,
            failureReason
          ),
        }).catch(() => {});
      }
    } else if (order?.payment?.status === "paid" || order?.status === "Confirmed") {
      console.log(
        `[Razorpay Webhook] Ignoring delayed payment.failed event for already paid/confirmed order #${order.orderNo ?? order._id}`
      );
    }
  }
}

r.post("/razorpay/order", optionalAuth, async (req, res, next) => {
  try {
    const rzp = getRazorpayInstance();
    const keyId = getRazorpayKeyId();
    if (!rzp || !keyId) throw new HttpError(400, "Razorpay not configured on server");

    const { items } = z
      .object({
        items: z
          .array(
            z.object({
              productId: z.string().min(1),
              qty: z.number().int().min(1).max(20),
            })
          )
          .min(1),
      })
      .parse(req.body);

    const products = await Product.find({
      _id: { $in: items.map((item) => item.productId) },
      isActive: true,
    });

    if (products.length !== new Set(items.map((item) => item.productId)).size) {
      throw new HttpError(400, "One or more products are unavailable");
    }

    const subtotal = items.reduce((sum, item) => {
      const product = products.find((candidate) => String(candidate._id) === item.productId);
      if (!product) throw new HttpError(400, "Invalid product in cart");
      if ((product.stock ?? 0) < item.qty) {
        throw new HttpError(400, `${product.name} has insufficient stock`);
      }
      return sum + product.price * item.qty;
    }, 0);

    const settings =
      (await Settings.findOne({ key: "global" })) ?? (await Settings.create({ key: "global" }));
    const amount = subtotal + (subtotal >= settings.freeShipThreshold ? 0 : settings.shippingFee);

    const order = await rzp.orders.create({
      amount: Math.round(amount * 100), // paise
      currency: "INR",
      receipt: `rcpt_${Date.now()}`,
      notes: {
        userId: req.user?.sub || "guest",
        source: "shri-radha-govind-store",
      },
    });

    res.json({ order, keyId });
  } catch (e) {
    next(e);
  }
});

r.post("/razorpay/verify", optionalAuth, async (req, res, next) => {
  try {
    const keySecret = getRazorpayKeySecret();
    if (!keySecret) throw new HttpError(400, "Razorpay not configured on server");
    const { order_id, payment_id, signature } = z
      .object({ order_id: z.string(), payment_id: z.string(), signature: z.string() })
      .parse(req.body);

    const expected = crypto
      .createHmac("sha256", keySecret)
      .update(`${order_id}|${payment_id}`)
      .digest("hex");

    const ok =
      expected.length === signature.length &&
      crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));

    if (!ok) throw new HttpError(400, "Signature mismatch");
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

const webhookHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const signature = req.headers["x-razorpay-signature"] as string | undefined;
    const webhookSecret = env.RAZORPAY_WEBHOOK_SECRET || env.RAZORPAY_KEY_SECRET;

    if (!webhookSecret) {
      console.warn("[Razorpay Webhook] Webhook secret is not configured in environment.");
      return res.status(503).json({ error: "Webhook secret not configured on server" });
    }

    if (!signature) {
      console.warn("[Razorpay Webhook] Missing x-razorpay-signature header.");
      return res.status(400).json({ error: "Missing x-razorpay-signature header" });
    }

    const rawBody = (req as any).rawBody
      ? (req as any).rawBody
      : Buffer.from(JSON.stringify(req.body || {}));

    const isValid = verifyRazorpayWebhookSignature(rawBody, signature, webhookSecret);

    if (!isValid) {
      console.warn("[Razorpay Webhook] Invalid webhook signature detected.");
      return res.status(400).json({ error: "Invalid signature" });
    }

    // Event-Level Idempotency Check
    const eventId =
      (req.headers["x-razorpay-event-id"] as string) ||
      req.body?.event_id ||
      req.body?.id ||
      undefined;
    const eventType = req.body?.event || "unknown";

    if (eventId) {
      // Check if event was already processed
      const existing = await WebhookEvent.findOne({ eventId });
      if (existing) {
        console.log(`[Razorpay Webhook] Duplicate webhook event ${eventId} (${eventType}) ignored.`);
        return res.status(200).json({ status: "ok", duplicate: true });
      }

      // Record event ID atomically in MongoDB
      try {
        await WebhookEvent.create({
          eventId,
          eventType,
          razorpayOrderId:
            req.body?.payload?.payment?.entity?.order_id || req.body?.payload?.order?.entity?.id,
          razorpayPaymentId: req.body?.payload?.payment?.entity?.id,
          processedAt: new Date(),
        });
      } catch (err: any) {
        if (err?.code === 11000) {
          console.log(`[Razorpay Webhook] Concurrent duplicate webhook event ${eventId} ignored.`);
          return res.status(200).json({ status: "ok", duplicate: true });
        }
        console.error("[Razorpay Webhook] Error recording webhook event idempotency record:", err);
      }
    }

    // Process event before returning response
    await processRazorpayWebhookEvent(req.body);

    res.status(200).json({ status: "ok" });
  } catch (e) {
    next(e);
  }
};

r.post("/razorpay/webhook", webhookHandler);
r.post("/webhook", webhookHandler);

export default r;
