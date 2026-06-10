import { Router } from "express";
import { z } from "zod";
import { Order } from "../models/Order";
import { User } from "../models/User";
import { requireAuth, requireAdmin } from "../middleware/auth";
import { HttpError } from "../middleware/error";

const r = Router();
r.use(requireAuth, requireAdmin);

r.get("/orders", async (_req, res, next) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 }).populate("user", "name email");
    res.json({ orders });
  } catch (e) {
    next(e);
  }
});

r.patch("/orders/:id/status", async (req, res, next) => {
  try {
    const { status } = z
      .object({
        status: z.enum(["Placed", "Packed", "Shipped", "Out for delivery", "Delivered", "Cancelled"]),
      })
      .parse(req.body);
    const o = await Order.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!o) throw new HttpError(404, "Not found");
    res.json({ order: o });
  } catch (e) {
    next(e);
  }
});

r.get("/users", async (_req, res, next) => {
  try {
    const users = await User.find().select("-passwordHash").sort({ createdAt: -1 });
    res.json({ users });
  } catch (e) {
    next(e);
  }
});

r.get("/payments", async (_req, res, next) => {
  try {
    const orders = await Order.find()
      .sort({ createdAt: -1 })
      .select("total payment createdAt user")
      .populate("user", "name email");
    res.json({
      payments: orders.map((o) => ({
        id: o._id,
        user: o.user,
        amount: o.total,
        method: o.payment.method,
        status: o.payment.status,
        razorpayPaymentId: o.payment.razorpayPaymentId,
        createdAt: o.createdAt,
      })),
    });
  } catch (e) {
    next(e);
  }
});

r.get("/stats", async (_req, res, next) => {
  try {
    const [orderCount, userCount, revenueAgg] = await Promise.all([
      Order.countDocuments(),
      User.countDocuments({ role: "user" }),
      Order.aggregate([
        { $match: { "payment.status": "paid" } },
        { $group: { _id: null, total: { $sum: "$total" } } },
      ]),
    ]);
    res.json({
      orderCount,
      userCount,
      revenue: revenueAgg[0]?.total ?? 0,
    });
  } catch (e) {
    next(e);
  }
});

export default r;
