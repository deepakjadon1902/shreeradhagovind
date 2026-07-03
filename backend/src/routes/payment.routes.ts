import { Router } from "express";
import crypto from "crypto";
import Razorpay from "razorpay";
import { z } from "zod";
import { env } from "../config/env";
import { requireAuth } from "../middleware/auth";
import { HttpError } from "../middleware/error";
import { Product } from "../models/Product";
import { Settings } from "../models/Settings";

const r = Router();

const rzp =
  env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET
    ? new Razorpay({ key_id: env.RAZORPAY_KEY_ID, key_secret: env.RAZORPAY_KEY_SECRET })
    : null;

r.post("/razorpay/order", requireAuth, async (req, res, next) => {
  try {
    if (!rzp) throw new HttpError(400, "Razorpay not configured");
    const { items } = z.object({
      items: z.array(z.object({ productId: z.string().min(1), qty: z.number().int().min(1).max(20) })).min(1),
    }).parse(req.body);
    const products = await Product.find({ _id: { $in: items.map((item) => item.productId) }, isActive: true });
    if (products.length !== new Set(items.map((item) => item.productId)).size) {
      throw new HttpError(400, "One or more products are unavailable");
    }
    const subtotal = items.reduce((sum, item) => {
      const product = products.find((candidate) => String(candidate._id) === item.productId);
      if (!product) throw new HttpError(400, "Invalid product in cart");
      if ((product.stock ?? 0) < item.qty) throw new HttpError(400, `${product.name} has insufficient stock`);
      return sum + product.price * item.qty;
    }, 0);
    const settings = (await Settings.findOne({ key: "global" })) ?? (await Settings.create({ key: "global" }));
    const amount = subtotal + (subtotal >= settings.freeShipThreshold ? 0 : settings.shippingFee);
    const order = await rzp.orders.create({
      amount: Math.round(amount * 100), // paise
      currency: "INR",
      receipt: `rcpt_${Date.now()}`,
      notes: { userId: req.user!.sub, source: "shri-radha-govind-store" },
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
    const ok = expected.length === signature.length && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
    if (!ok) throw new HttpError(400, "Signature mismatch");
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

export default r;
