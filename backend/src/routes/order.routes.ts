import { Router } from "express";
import { z } from "zod";
import { Order } from "../models/Order";
import { Product } from "../models/Product";
import { Settings } from "../models/Settings";
import { User } from "../models/User";
import { requireAuth } from "../middleware/auth";
import { HttpError } from "../middleware/error";
import { sendEmail, tpl } from "../utils/email";

const r = Router();

r.get("/", requireAuth, async (req, res, next) => {
  try {
    const orders = await Order.find({ user: req.user!.sub }).sort({ createdAt: -1 });
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
  items: z.array(z.object({ productId: z.string(), qty: z.number().min(1) })).min(1),
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
    const products = await Product.find({ _id: { $in: body.items.map((i) => i.productId) } });
    if (products.length !== body.items.length) throw new HttpError(400, "Invalid product in cart");
    const items = body.items.map((i) => {
      const p = products.find((p) => String(p._id) === i.productId)!;
      return { productId: p._id, name: p.name, image: p.image, price: p.price, qty: i.qty };
    });
    const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
    const settings =
      (await Settings.findOne({ key: "global" })) ?? (await Settings.create({ key: "global" }));
    const shipping = subtotal >= settings.freeShipThreshold ? 0 : settings.shippingFee;
    const total = subtotal + shipping;

    const order = await Order.create({
      user: req.user!.sub,
      items,
      subtotal,
      shipping,
      total,
      address: body.address,
      payment: {
        method: body.payment.method,
        status: body.payment.status ?? (body.payment.method === "razorpay" ? "paid" : "pending"),
        razorpayOrderId: body.payment.razorpayOrderId,
        razorpayPaymentId: body.payment.razorpayPaymentId,
        razorpaySignature: body.payment.razorpaySignature,
      },
      status: "Placed",
    });

    const user = await User.findById(req.user!.sub);
    if (user?.email) sendEmail({ to: user.email, ...tpl.orderPlaced(user.name, String(order._id), total) }).catch(() => {});

    res.status(201).json({ order });
  } catch (e) {
    next(e);
  }
});

export default r;
