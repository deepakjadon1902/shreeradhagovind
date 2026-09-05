import { Router } from "express";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { Order } from "../models/Order";
import { Product } from "../models/Product";
import { Settings } from "../models/Settings";
import { User } from "../models/User";
import { Counter } from "../models/Counter";
import { requireAuth, optionalAuth } from "../middleware/auth";
import { HttpError } from "../middleware/error";
import { signToken } from "../utils/jwt";
import {
  sendEmail,
  sendOrderConfirmationWithInvoice,
  tpl,
  formatOrderNumber,
} from "../utils/email";
import { generateInvoicePDF, type InvoiceData } from "../utils/invoice";
import { getCourierTrackingUrl } from "../utils/courier";
import { env } from "../config/env";

const r = Router();
const FIRST_ORDER_NO = 5000;

const safeUser = (u: any) => ({
  id: String(u._id),
  name: u.name,
  email: u.email,
  role: u.role,
  avatar: u.avatar,
  phone: u.phone,
  address: u.address ?? {},
});

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
    const rawTerm = (req.params.trackingId || "").trim();
    const term = rawTerm.toUpperCase().replace(/^#/, "");
    const asNumber = Number(term);
    const query: any = {
      $or: [
        { trackingId: term },
        ...(Number.isInteger(asNumber) && asNumber > 0 ? [{ orderNo: asNumber }] : []),
      ],
    };
    const o = await Order.findOne(query);
    if (!o) throw new HttpError(404, "No order found for this tracking ID or Order Number");
    const trackingUrl = o.courierTrackingUrl || getCourierTrackingUrl(o.courier, o.trackingId);
    res.json({
      order: {
        orderNo: o.orderNo,
        trackingId: o.trackingId,
        status: o.status,
        courier: o.courier,
        courierTrackingUrl: trackingUrl,
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
    const userId = req.user!.sub;
    const orders = await Order.find({ user: userId }).sort({
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
    const userId = req.user!.sub;
    const isOwner = String(o.user) === userId;
    const isAdmin = req.user!.role === "admin";
    if (!isOwner && !isAdmin)
      throw new HttpError(403, "Forbidden");
    res.json({ order: o });
  } catch (e) {
    next(e);
  }
});

r.get("/:id/invoice", requireAuth, async (req, res, next) => {
  try {
    const o = await Order.findById(req.params.id);
    if (!o) throw new HttpError(404, "Order not found");
    const userId = req.user!.sub;
    const isOwner = String(o.user) === userId;
    const isAdmin = req.user!.role === "admin";
    if (!isOwner && !isAdmin) throw new HttpError(403, "Forbidden");

    const orderNum = formatOrderNumber(o);
    const invoiceData: InvoiceData = {
      orderId: String(o._id),
      orderNo: o.orderNo ?? orderNum,
      invoiceNo: `INV-${orderNum}`,
      trackingId: o.trackingId ?? undefined,
      courier: o.courier ?? null,
      status: o.status,
      customerName: o.address?.name || "Customer",
      customerEmail: o.customerEmail ?? undefined,
      businessName: o.businessName,
      gstin: o.gstin,
      needsGstInvoice: o.needsGstInvoice,
      items: o.items as any,
      subtotal: o.subtotal,
      shipping: o.shipping,
      total: o.total,
      address: o.address as any,
      payment: {
        method: o.payment?.method ?? "cod",
        status: o.payment?.status ?? "pending",
        razorpayPaymentId: o.payment?.razorpayPaymentId ?? undefined,
      },
      createdAt: o.createdAt,
    };

    const pdfBuffer = await generateInvoicePDF(invoiceData);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="Invoice-${orderNum}.pdf"`);
    res.send(pdfBuffer);
  } catch (e) {
    next(e);
  }
});

const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

const createSchema = z.object({
  email: z.string().email().optional(),
  needsGstInvoice: z.boolean().optional().default(false),
  businessName: z.string().optional().default(""),
  gstin: z.string().optional().default(""),
  items: z
    .array(
      z.object({ productId: z.string(), qty: z.number().int().min(1).max(20) }),
    )
    .min(1),
  address: z.object({
    name: z.string().min(1),
    phone: z.string().min(5),
    alternatePhone: z.string().optional().default(""),
    line1: z.string().min(1),
    line2: z.string().optional().default(""),
    postOffice: z.string().optional().default(""),
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

r.post("/", optionalAuth, async (req, res, next) => {
  try {
    const body = createSchema.parse(req.body);

    // Validate GST details if requested
    let cleanBusinessName = "";
    let cleanGstin = "";
    if (body.needsGstInvoice) {
      cleanBusinessName = (body.businessName || "").trim();
      if (!cleanBusinessName) {
        throw new HttpError(400, "Business Name is required when requesting a GST invoice");
      }
      const rawGstin = (body.gstin || "").trim().toUpperCase();
      if (rawGstin) {
        if (!GSTIN_REGEX.test(rawGstin)) {
          throw new HttpError(
            400,
            "Invalid GSTIN format. Please enter a valid 15-character GSTIN (e.g. 09AABCU9603R1ZM)",
          );
        }
        cleanGstin = rawGstin;
      }
    }

    // Resolve user & account linkage
    let user: any = null;
    let orderUserId: any = null;
    let isNewAccount = false;
    let sessionToken: string | undefined;

    if (req.user?.sub) {
      user = await User.findById(req.user.sub);
      if (user) {
        orderUserId = user._id;
      }
    }

    const rawEmail = body.email || user?.email || "";
    const normalizedEmail = rawEmail.trim().toLowerCase();
    if (!normalizedEmail) {
      throw new HttpError(400, "Customer email is required for order confirmation and invoicing");
    }

    if (!orderUserId) {
      // Guest checkout: Check if user exists with this email
      const existingUser = await User.findOne({ email: normalizedEmail });
      if (!existingUser) {
        // Automatically create customer account with passwordSet=false
        user = await User.create({
          name: body.address.name.trim() || "Customer",
          email: normalizedEmail,
          phone: body.address.phone.trim(),
          passwordHash: "",
          passwordSet: false,
          role: "user",
          address: {
            line1: body.address.line1,
            city: body.address.city,
            state: body.address.state,
            pincode: body.address.pincode,
          },
        });
        isNewAccount = true;
        orderUserId = user._id;
        // Issue session token for the newly created customer
        sessionToken = signToken({
          sub: String(user._id),
          role: user.role,
          email: user.email,
        });
        sendEmail({ to: normalizedEmail, ...tpl.welcome(user.name) }).catch(() => {});
      } else {
        // Existing email entered as guest does NOT prove ownership.
        // Create unlinked guest order until email owner verifies via OTP login.
        orderUserId = undefined;
        user = null;
        sessionToken = undefined;
      }
    }

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
          if (normalizedEmail)
            sendEmail({
              to: normalizedEmail,
              ...tpl.paymentFailed(
                body.address.name || user?.name || "Customer",
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
      const price = p.price;
      const gstRate = Number(p.gstRate ?? 0);
      const gstInclusive = p.gstInclusive !== false;
      const hsnCode = p.hsnCode || "";

      let taxableUnit = price;
      let gstUnit = 0;
      if (gstRate > 0) {
        if (gstInclusive) {
          taxableUnit = Math.round((price / (1 + gstRate / 100)) * 100) / 100;
          gstUnit = Math.round((price - taxableUnit) * 100) / 100;
        } else {
          taxableUnit = price;
          gstUnit = Math.round((price * (gstRate / 100)) * 100) / 100;
        }
      }

      return {
        productId: p._id,
        name: p.name,
        image: p.image,
        price: p.price,
        qty: i.qty,
        hsnCode,
        gstRate,
        gstInclusive,
        taxableAmount: Math.round(taxableUnit * i.qty * 100) / 100,
        gstAmount: Math.round(gstUnit * i.qty * 100) / 100,
      };
    });
    const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
    const settings =
      (await Settings.findOne({ key: "global" })) ??
      (await Settings.create({ key: "global" }));
    if (body.payment.method === "cod" && !settings.codEnabled) {
      throw new HttpError(
        400,
        "Cash on Delivery is currently unavailable",
      );
    }
    const shipping =
      subtotal >= settings.freeShipThreshold ? 0 : settings.shippingFee;
    const total = subtotal + shipping;

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
      user: orderUserId,
      customerEmail: normalizedEmail,
      orderNo: await nextOrderNo(),
      needsGstInvoice: Boolean(body.needsGstInvoice),
      businessName: cleanBusinessName,
      gstin: cleanGstin,
      items,
      subtotal,
      shipping,
      total,
      courier: body.payment.method === "cod" ? "DTDC" : null,
      alternatePhone: body.address.alternatePhone || "",
      address: {
        name: body.address.name,
        phone: body.address.phone,
        alternatePhone: body.address.alternatePhone || "",
        line1: body.address.line1,
        line2: body.address.line2 || "",
        postOffice: body.address.postOffice?.trim() || "",
        city: body.address.city,
        state: body.address.state,
        pincode: body.address.pincode,
      },
      payment: {
        method: body.payment.method,
        status: body.payment.method === "razorpay" ? "paid" : "pending",
        razorpayOrderId: body.payment.razorpayOrderId,
        razorpayPaymentId: body.payment.razorpayPaymentId,
        razorpaySignature: body.payment.razorpaySignature,
      },
      status: "Placed",
    });

    const payment = order.payment;
    const customerRecipientName = body.address.name || user?.name || "Customer";
    if (
      normalizedEmail &&
      (payment?.status === "paid" || payment?.method === "cod")
    ) {
      sendOrderConfirmationWithInvoice(normalizedEmail, customerRecipientName, {
        _id: order._id,
        orderNo: order.orderNo,
        trackingId: order.trackingId ?? undefined,
        courier: order.courier ?? undefined,
        courierTrackingUrl: order.courierTrackingUrl ?? undefined,
        status: order.status,
        items,
        subtotal,
        shipping,
        total,
        businessName: order.businessName || undefined,
        gstin: order.gstin || undefined,
        needsGstInvoice: order.needsGstInvoice,
        address: {
          name: body.address.name,
          phone: body.address.phone,
          alternatePhone: body.address.alternatePhone || undefined,
          line1: body.address.line1,
          line2: body.address.line2 || undefined,
          postOffice: body.address.postOffice?.trim() || undefined,
          city: body.address.city,
          state: body.address.state,
          pincode: body.address.pincode,
        },
        payment: {
          method: payment.method!,
          status: payment.status!,
          razorpayPaymentId: payment.razorpayPaymentId ?? undefined,
        },
        createdAt: order.createdAt,
      }).catch(() => {});
    } else if (normalizedEmail) {
      sendEmail({
        to: normalizedEmail,
        ...tpl.orderPlaced(customerRecipientName, formatOrderNumber(order), total),
      }).catch(() => {});
    }

    res.status(201).json({
      order,
      token: sessionToken,
      user: user ? safeUser(user) : undefined,
      isNewAccount,
    });
  } catch (e) {
    next(e);
  }
});

// Frontend reports a payment failure (Razorpay modal closed / failed)
r.post("/payment-failed", optionalAuth, async (req, res, next) => {
  try {
    const {
      email,
      razorpayOrderId,
      amount,
      reason,
      items: requestedItems,
      address,
    } = z
      .object({
        email: z.string().email().optional(),
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
            alternatePhone: z.string().optional().default(""),
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

      order = await Order.create({
        user: req.user?.sub || undefined,
        customerEmail: email || undefined,
        orderNo: await nextOrderNo(),
        items,
        subtotal,
        shipping,
        total,
        alternatePhone: address.alternatePhone || "",
        address: {
          ...address,
          alternatePhone: address.alternatePhone || "",
        },
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

    const user = req.user?.sub ? await User.findById(req.user.sub) : null;
    const recipientEmail = email || user?.email;
    const recipientName = address?.name || user?.name || "Customer";
    if (recipientEmail) {
      const orderRef = order
        ? formatOrderNumber(order)
        : razorpayOrderId.slice(-6).toUpperCase();
      await sendEmail({
        to: recipientEmail,
        ...tpl.paymentFailed(
          recipientName,
          orderRef,
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
