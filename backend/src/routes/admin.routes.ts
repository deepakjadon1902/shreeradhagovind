import { Router } from "express";
import { z } from "zod";
import { Order } from "../models/Order";
import { User } from "../models/User";
import { requireAuth, requireAdmin } from "../middleware/auth";
import { HttpError } from "../middleware/error";
import { sendEmail, sendOrderConfirmationWithInvoice, tpl } from "../utils/email";

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

// Legacy: status-only update
r.patch("/orders/:id/status", async (req, res, next) => {
  try {
    const { status } = z
      .object({
        status: z.enum(["Placed", "Packed", "Shipped", "Out for delivery", "Delivered", "Cancelled"]),
      })
      .parse(req.body);
    const o = await Order.findByIdAndUpdate(req.params.id, { status }, { new: true }).populate("user", "name email");
    if (!o) throw new HttpError(404, "Not found");
    const u: any = o.user;
    if (u?.email) {
      sendEmail({
        to: u.email,
        ...tpl.statusUpdate(u.name, o.trackingId ?? String(o._id).slice(-6).toUpperCase(), status, o.trackingId ?? undefined, o.courier, o.courierTrackingUrl),
      }).catch(() => {});
    }
    res.json({ order: o });
  } catch (e) {
    next(e);
  }
});

// Combined update: status / courier / tracking id / courier URL
r.patch("/orders/:id", async (req, res, next) => {
  try {
    const data = z
      .object({
        status: z.enum(["Placed", "Packed", "Shipped", "Out for delivery", "Delivered", "Cancelled"]).optional(),
        courier: z.enum(["Ekart", "DTDC", "Shree Murti", "India Post", "Delhivery", "Bluedart"]).nullable().optional(),
        trackingId: z.string().min(3).max(40).optional(),
        courierTrackingUrl: z.string().url().or(z.literal("")).optional(),
      })
      .parse(req.body);
    const update: any = {};
    if (data.status !== undefined) update.status = data.status;
    if (data.courier !== undefined) update.courier = data.courier;
    if (data.trackingId !== undefined) update.trackingId = data.trackingId.toUpperCase();
    if (data.courierTrackingUrl !== undefined) update.courierTrackingUrl = data.courierTrackingUrl;

    const o = await Order.findByIdAndUpdate(req.params.id, update, { new: true }).populate("user", "name email");
    if (!o) throw new HttpError(404, "Not found");
    const u: any = o.user;
    if (u?.email && (data.status || data.courier || data.trackingId)) {
      sendEmail({
        to: u.email,
        ...tpl.statusUpdate(u.name, o.trackingId ?? String(o._id).slice(-6).toUpperCase(), o.status!, o.trackingId ?? undefined, o.courier, o.courierTrackingUrl),
      }).catch(() => {});
    }
    res.json({ order: o });
  } catch (e) {
    next(e);
  }
});

// Manual payment verification
r.patch("/orders/:id/payment", async (req, res, next) => {
  try {
    const { status } = z.object({ status: z.enum(["paid", "failed", "refunded", "pending"]) }).parse(req.body);
    const o = await Order.findById(req.params.id).populate("user", "name email");
    if (!o) throw new HttpError(404, "Not found");

    o.payment!.status = status;
    if (status === "failed") o.status = "Cancelled";
    await o.save();

    const u: any = o.user;
    if (u?.email) {
      if (status === "paid") {
        sendEmail({
          to: u.email,
          ...tpl.orderConfirmed(u.name, {
            _id: o._id,
            trackingId: o.trackingId ?? undefined,
            courier: o.courier,
            items: o.items as any,
            subtotal: o.subtotal!,
            shipping: o.shipping!,
            total: o.total!,
            address: o.address as any,
            payment: { method: o.payment!.method!, status: "paid", razorpayPaymentId: o.payment!.razorpayPaymentId },
          }),
        }).catch(() => {});
      } else if (status === "failed") {
        sendEmail({
          to: u.email,
          ...tpl.paymentFailed(u.name, o.trackingId ?? String(o._id).slice(-6).toUpperCase(), o.total!, "Payment verification failed by admin"),
        }).catch(() => {});
      }
    }
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
      .select("total payment createdAt user trackingId")
      .populate("user", "name email");
    res.json({
      payments: orders.map((o) => ({
        id: o._id,
        trackingId: o.trackingId,
        user: o.user,
        amount: o.total,
        method: o.payment?.method,
        status: o.payment?.status,
        razorpayPaymentId: o.payment?.razorpayPaymentId,
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
    res.json({ orderCount, userCount, revenue: revenueAgg[0]?.total ?? 0 });
  } catch (e) {
    next(e);
  }
});

export default r;
