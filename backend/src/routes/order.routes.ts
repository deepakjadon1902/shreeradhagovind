import { Router } from "express";
import crypto from "crypto";
import { z } from "zod";
import { Order } from "../models/Order";
import { Product } from "../models/Product";
import { Settings } from "../models/Settings";
import { User } from "../models/User";
import { Counter } from "../models/Counter";
import { requireAuth } from "../middleware/auth";
import { HttpError } from "../middleware/error";
import {
  sendEmail,
  sendOrderConfirmationWithInvoice,
  tpl,
} from "../utils/email";
import { generateTrackingId } from "../utils/trackingId";
import { env } from "../config/env";

const r = Router();
const FIRST_ORDER_NO = 5000;

async function nextOrderNo() {
  const counter = await Counter.findOneAndUpdate(
    { name: "orderNo4Digit" },
    { $inc: { value: 1 } },
    { new: true },
  );
  if (counter) return counter.value;
  try {
    const latestFourDigitOrder = await Order.findOne({
      orderNo: { $gte: FIRST_ORDER_NO, $lte: 9999 },
    })
      .sort({ orderNo: -1 })
      .select("orderNo")
      .lean();
    const firstValue = Math.max(
      FIRST_ORDER_NO,
      (latestFourDigitOrder?.orderNo ?? FIRST_ORDER_NO - 1) + 1,
    );
    const created = await Counter.create({
      name: "orderNo4Digit",
      value: firstValue,
    });
    return created.value;
  } catch (error: any) {
    if (error?.code === 11000) return nextOrderNo();
    throw error;
  }
}

// ---- public tracking (no auth) ----
r.get("/track/:trackingId", async (req, res, next) => {
  try {
    const o = await Order.findOne({
      trackingId: req.params.trackingId.toUpperCase(),
    });
    if (!o) throw new HttpError(404, "No order found for this tracking ID");
    res.json({
      order: {
        trackingId: o.trackingId,
        status: o.status,
        courier: o.courier,
        courierTrackingUrl: o.courierTrackingUrl,
        createdAt: o.createdAt,
        items: o.items.map((i: any) => ({
          name: i.name,
          image: i.image,
          qty: i.qty,
          price: i.price,
        })),
        total: o.total,
        address: {
          city: o.address?.city,
          state: o.address?.state,
          pincode: o.address?.pincode,
          name: o.address?.name,
        },
        payment: { method: o.payment?.method, status: o.payment?.status },
      },
    });
  } catch (e) {
    next(e);
  }
});

r.get("/", requireAuth, async (req, res, next) => {
  try {
    const orders = await Order.find({ user: req.user!.sub }).sort({
      createdAt: -1,
    });
    res.json({ orders });
  } catch (e) {
    next(e);
  }
});

r.get("/:id", requireAuth, async (req, res, next) => {
  try {
    const o = await Order.findById(req.params.id);
    if (!o) throw new HttpError(404, "Order not found");
    if (String(o.user) !== req.user!.sub && req.user!.role !== "admin")
      throw new HttpError(403, "Forbidden");
    res.json({ order: o });
  } catch (e) {
    next(e);
  }
});

const createSchema = z.object({
  items: z
    .array(
      z.object({ productId: z.string(), qty: z.number().int().min(1).max(20) }),
    )
    .min(1),
  address: z.object({
    name: z.string().min(1),
    phone: z.string().min(5),
    line1: z.string().min(1),
    city: z.string().min(1),
    state: z.string().optional().default(""),
    pincode: z.string().min(1),
  }),
  payment: z.object({
    method: z.enum(["razorpay", "cod"]),
    razorpayOrderId: z.string().optional(),
    razorpayPaymentId: z.string().optional(),
    razorpaySignature: z.string().optional(),
    status: z.enum(["pending", "paid", "failed"]).optional(),
  }),
});

r.post("/", requireAuth, async (req, res, next) => {
  try {
    const body = createSchema.parse(req.body);

    // Razorpay signature verification (server-side) when method = razorpay
    if (body.payment.method === "razorpay") {
      const { razorpayOrderId, razorpayPaymentId, razorpaySignature } =
        body.payment;
      if (!env.RAZORPAY_KEY_SECRET)
        throw new HttpError(503, "Online payments are temporarily unavailable");
      if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
        throw new HttpError(
          400,
          "Complete Razorpay payment verification is required",
        );
      }
      {
        const expected = crypto
          .createHmac("sha256", env.RAZORPAY_KEY_SECRET)
          .update(`${razorpayOrderId}|${razorpayPaymentId}`)
          .digest("hex");
        const ok =
          expected.length === razorpaySignature.length &&
          crypto.timingSafeEqual(
            Buffer.from(expected),
            Buffer.from(razorpaySignature),
          );
        if (!ok) {
          const user = await User.findById(req.user!.sub);
          if (user?.email)
            sendEmail({
              to: user.email,
              ...tpl.paymentFailed(
                user.name,
                razorpayOrderId.slice(-6).toUpperCase(),
                0,
                "Signature mismatch",
              ),
            }).catch(() => {});
          throw new HttpError(
            400,
            "Payment signature verification failed; order cancelled",
          );
        }
      }
    }

    const requested = mergeItems(body.items);
    const products = await Product.find({
      _id: { $in: requested.map((i) => i.productId) },
      isActive: true,
    });
    if (products.length !== requested.length)
      throw new HttpError(400, "One or more products are unavailable");
    const items = requested.map((i) => {
      const p = products.find((p) => String(p._id) === i.productId)!;
      if ((p.stock ?? 0) < i.qty)
        throw new HttpError(
          400,
          `${p.name} has only ${p.stock ?? 0} left in stock`,
        );
      return {
        productId: p._id,
        name: p.name,
        image: p.image,
        price: p.price,
        qty: i.qty,
      };
    });
    const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
    const settings =
      (await Settings.findOne({ key: "global" })) ??
      (await Settings.create({ key: "global" }));
    if (body.payment.method === "cod" && !settings.codEnabled) {
      throw new HttpError(
        400,
        "Cash on Delivery is currently disabled by the store admin",
      );
    }
    const shipping =
      subtotal >= settings.freeShipThreshold ? 0 : settings.shippingFee;
    const total = subtotal + shipping;

    // unique tracking id
    let trackingId = generateTrackingId();
    for (let i = 0; i < 5 && (await Order.exists({ trackingId })); i++)
      trackingId = generateTrackingId();

    const stockUpdate = await Product.bulkWrite(
      items.map((item) => ({
        updateOne: {
          filter: {
            _id: item.productId,
            isActive: true,
            stock: { $gte: item.qty },
          },
          update: { $inc: { stock: -item.qty } },
        },
      })),
    );
    if (stockUpdate.modifiedCount !== items.length) {
      throw new HttpError(
        409,
        "Some items just went out of stock. Please review your cart.",
      );
    }

    const order = await Order.create({
      user: req.user!.sub,
      orderNo: await nextOrderNo(),
      trackingId,
      items,
      subtotal,
      shipping,
      total,
      courier: body.payment.method === "cod" ? "DTDC" : null,
      address: body.address,
      payment: {
        method: body.payment.method,
        status: body.payment.method === "razorpay" ? "paid" : "pending",
        razorpayOrderId: body.payment.razorpayOrderId,
        razorpayPaymentId: body.payment.razorpayPaymentId,
        razorpaySignature: body.payment.razorpaySignature,
      },
      status: "Placed",
    });

    const user = await User.findById(req.user!.sub);
    const payment = order.payment;
    if (
      user?.email &&
      (payment?.status === "paid" || payment?.method === "cod")
    ) {
      sendOrderConfirmationWithInvoice(user.email, user.name, {
        _id: order._id,
        trackingId: order.trackingId ?? undefined,
        courier: order.courier ?? undefined,
        courierTrackingUrl: order.courierTrackingUrl ?? undefined,
        status: order.status,
        items,
        subtotal,
        shipping,
        total,
        address: body.address,
        payment: {
          method: payment.method!,
          status: payment.status!,
          razorpayPaymentId: payment.razorpayPaymentId ?? undefined,
        },
        createdAt: order.createdAt,
      }).catch(() => {});
    } else if (user?.email) {
      sendEmail({
        to: user.email,
        ...tpl.orderPlaced(user.name, String(order._id), total),
      }).catch(() => {});
    }

    res.status(201).json({ order });
  } catch (e) {
    next(e);
  }
});

// Frontend reports a payment failure (Razorpay modal closed / failed)
r.post("/payment-failed", requireAuth, async (req, res, next) => {
  try {
    const {
      razorpayOrderId,
      amount,
      reason,
      items: requestedItems,
      address,
    } = z
      .object({
        razorpayOrderId: z.string().optional().default("N/A"),
        amount: z.number().optional().default(0),
        reason: z.string().optional().default("Payment was not completed"),
        items: z
          .array(
            z.object({
              productId: z.string(),
              qty: z.number().int().min(1).max(20),
            }),
          )
          .optional()
          .default([]),
        address: z
          .object({
            name: z.string().optional().default(""),
            phone: z.string().optional().default(""),
            line1: z.string().optional().default(""),
            city: z.string().optional().default(""),
            state: z.string().optional().default(""),
            pincode: z.string().optional().default(""),
          })
          .optional(),
      })
      .parse(req.body);

    let order =
      razorpayOrderId !== "N/A"
        ? await Order.findOne({ "payment.razorpayOrderId": razorpayOrderId })
        : null;

    if (!order && requestedItems.length > 0 && address) {
      const mergedItems = mergeItems(requestedItems);
      const products = await Product.find({
        _id: { $in: mergedItems.map((i) => i.productId) },
        isActive: true,
      });
      const items = mergedItems.flatMap((i) => {
        const p = products.find(
          (candidate) => String(candidate._id) === i.productId,
        );
        return p
          ? [
              {
                productId: p._id,
                name: p.name,
                image: p.image,
                price: p.price,
                qty: i.qty,
              },
            ]
          : [];
      });
      const subtotal = items.reduce(
        (s: number, i: any) => s + i.price * i.qty,
        0,
      );
      const settings =
        (await Settings.findOne({ key: "global" })) ??
        (await Settings.create({ key: "global" }));
      const shipping =
        subtotal >= settings.freeShipThreshold ? 0 : settings.shippingFee;
      const total = amount || subtotal + shipping;

      let trackingId = generateTrackingId();
      for (let i = 0; i < 5 && (await Order.exists({ trackingId })); i++)
        trackingId = generateTrackingId();

      order = await Order.create({
        user: req.user!.sub,
        orderNo: await nextOrderNo(),
        trackingId,
        items,
        subtotal,
        shipping,
        total,
        address,
        payment: {
          method: "razorpay",
          status: "failed",
          razorpayOrderId,
          failureReason: reason,
        },
        status: "Cancelled",
      });
    } else if (order) {
      order.payment!.status = "failed";
      order.payment!.failureReason = reason;
      order.status = "Cancelled";
      await order.save();
    }

    const user = await User.findById(req.user!.sub);
    if (user?.email) {
      await sendEmail({
        to: user.email,
        ...tpl.paymentFailed(
          user.name,
          razorpayOrderId.slice(-6).toUpperCase(),
          amount,
          reason,
        ),
      });
    }
    res.json({ ok: true, order });
  } catch (e) {
    next(e);
  }
});

function mergeItems(items: { productId: string; qty: number }[]) {
  const byProduct = new Map<string, number>();
  for (const item of items) {
    const qty = (byProduct.get(item.productId) ?? 0) + item.qty;
    if (qty > 20)
      throw new HttpError(400, "Maximum 20 quantity allowed for one product");
    byProduct.set(item.productId, qty);
  }
  return Array.from(byProduct.entries()).map(([productId, qty]) => ({
    productId,
    qty,
  }));
}

export default r;
