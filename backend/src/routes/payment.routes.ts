import { Router } from "express";
import crypto from "crypto";
import Razorpay from "razorpay";
import { z } from "zod";
import { env } from "../config/env";
import { requireAuth } from "../middleware/auth";
import { HttpError } from "../middleware/error";

const r = Router();

const rzp =
  env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET
    ? new Razorpay({ key_id: env.RAZORPAY_KEY_ID, key_secret: env.RAZORPAY_KEY_SECRET })
    : null;

r.post("/razorpay/order", requireAuth, async (req, res, next) => {
  try {
    if (!rzp) throw new HttpError(400, "Razorpay not configured");
    const { amount } = z.object({ amount: z.number().min(1) }).parse(req.body);
    const order = await rzp.orders.create({
      amount: Math.round(amount * 100), // paise
      currency: "INR",
      receipt: `rcpt_${Date.now()}`,
    });
    res.json({ order, keyId: env.RAZORPAY_KEY_ID });
  } catch (e) {
    next(e);
  }
});

r.post("/razorpay/verify", requireAuth, async (req, res, next) => {
  try {
    if (!env.RAZORPAY_KEY_SECRET) throw new HttpError(400, "Razorpay not configured");
    const { order_id, payment_id, signature } = z
      .object({ order_id: z.string(), payment_id: z.string(), signature: z.string() })
      .parse(req.body);
    const expected = crypto
      .createHmac("sha256", env.RAZORPAY_KEY_SECRET)
      .update(`${order_id}|${payment_id}`)
      .digest("hex");
    const ok = crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
    if (!ok) throw new HttpError(400, "Signature mismatch");
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

export default r;
