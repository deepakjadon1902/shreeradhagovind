import { Router } from "express";
import crypto from "crypto";
import { z } from "zod";
import mongoose from "mongoose";
import { CheckoutSession } from "../models/CheckoutSession";
import { Product } from "../models/Product";
import { Settings } from "../models/Settings";
import { optionalAuth } from "../middleware/auth";
import { HttpError } from "../middleware/error";

const r = Router();

const captureSchema = z.object({
  sessionId: z.string().optional(),
  name: z.string().optional().default(""),
  email: z.string().optional().default(""),
  phone: z.string().optional().default(""),
  alternatePhone: z.string().optional().default(""),
  address: z
    .object({
      name: z.string().optional().default(""),
      phone: z.string().optional().default(""),
      alternatePhone: z.string().optional().default(""),
      line1: z.string().optional().default(""),
      line2: z.string().optional().default(""),
      city: z.string().optional().default(""),
      state: z.string().optional().default(""),
      pincode: z.string().optional().default(""),
      postOffice: z.string().optional().default(""),
    })
    .optional(),
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        qty: z.number().int().min(1).max(20),
      })
    )
    .min(1),
});

const dismissSchema = z.object({
  sessionId: z.string().min(1),
});

/**
 * POST /api/checkout-sessions/capture
 * Captures or updates a checkout session when the customer provides contact details.
 * Supports guest and authenticated sessions.
 * Never trusts client prices or stock; recalculates subtotal and total from DB.
 * Does not create an order and does not decrement stock.
 */
r.post("/capture", optionalAuth, async (req, res, next) => {
  try {
    const body = captureSchema.parse(req.body);

    const email = (body.email || "").trim().toLowerCase();
    const phone = (body.phone || "").replace(/\D/g, "");
    const name = (body.name || "").trim();

    // Do not capture if customer has not meaningfully provided an email or 10-digit phone
    const hasValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    const hasValidPhone = phone.length >= 10;
    if (!hasValidEmail && !hasValidPhone) {
      return res.json({ ok: false, reason: "Insufficient contact information to capture session" });
    }

    // Filter valid MongoDB ObjectIds for products
    const validProductIds = body.items
      .map((i) => i.productId)
      .filter((id) => mongoose.Types.ObjectId.isValid(id));

    if (validProductIds.length === 0) {
      return res.json({ ok: false, reason: "No valid products in cart" });
    }

    const products = await Product.find({
      _id: { $in: validProductIds },
      isActive: true,
    });

    if (products.length === 0) {
      return res.json({ ok: false, reason: "Cart products unavailable" });
    }

    // Calculate subtotal from live database product prices
    let subtotal = 0;
    const sessionItems = [];

    for (const item of body.items) {
      const product = products.find((p) => String(p._id) === item.productId);
      if (product) {
        subtotal += product.price * item.qty;
        sessionItems.push({
          productId: product._id,
          qty: item.qty,
          name: product.name,
          price: product.price,
          image: product.image || "",
        });
      }
    }

    if (sessionItems.length === 0) {
      return res.json({ ok: false, reason: "No active products could be added" });
    }

    const settings =
      (await Settings.findOne({ key: "global" })) ?? (await Settings.create({ key: "global" }));
    const freeShipThreshold = settings?.freeShipThreshold ?? 999;
    const shippingFee = settings?.shippingFee ?? 49;
    const shipping = subtotal >= freeShipThreshold ? 0 : shippingFee;
    const total = subtotal + shipping;

    const userId = req.user?.sub ? new mongoose.Types.ObjectId(req.user.sub) : null;

    let sessionId = (body.sessionId || "").trim();
    let session = sessionId ? await CheckoutSession.findOne({ sessionId }) : null;

    // If session is already recovered or cancelled, start a fresh session to protect past completed orders
    if (session && (session.status === "recovered" || session.status === "cancelled")) {
      sessionId = "";
      session = null;
    }

    const now = new Date();

    if (session) {
      // Update existing active or abandoned session
      if (userId && !session.user) {
        session.user = userId;
      }
      if (email) session.email = email;
      if (phone) session.phone = phone;
      if (name) session.name = name;

      if (body.address) {
        session.address = {
          name: body.address.name || name || session.address?.name || "",
          phone: body.address.phone || phone || session.address?.phone || "",
          alternatePhone: body.address.alternatePhone || body.alternatePhone || session.address?.alternatePhone || "",
          line1: body.address.line1 || session.address?.line1 || "",
          line2: body.address.line2 || session.address?.line2 || "",
          city: body.address.city || session.address?.city || "",
          state: body.address.state || session.address?.state || "",
          pincode: body.address.pincode || session.address?.pincode || "",
          postOffice: body.address.postOffice || session.address?.postOffice || "",
        };
      }

      session.items = sessionItems as any;
      session.subtotal = subtotal;
      session.shipping = shipping;
      session.total = total;
      session.status = "active"; // Re-activated by recent user activity
      session.lastActivityAt = now;

      await session.save();
    } else {
      // Create new checkout session
      sessionId = sessionId || crypto.randomUUID();
      const recoveryToken = crypto.randomBytes(24).toString("hex");

      const addressData = body.address
        ? {
            name: body.address.name || name || "",
            phone: body.address.phone || phone || "",
            alternatePhone: body.address.alternatePhone || body.alternatePhone || "",
            line1: body.address.line1 || "",
            line2: body.address.line2 || "",
            city: body.address.city || "",
            state: body.address.state || "",
            pincode: body.address.pincode || "",
            postOffice: body.address.postOffice || "",
          }
        : undefined;

      session = await CheckoutSession.create({
        sessionId,
        user: userId,
        email,
        phone,
        name,
        address: addressData,
        items: sessionItems,
        subtotal,
        shipping,
        total,
        status: "active",
        lastActivityAt: now,
        recoveryToken,
        recoverySentCount: 0,
      });
    }

    return res.json({
      ok: true,
      sessionId: session.sessionId,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/checkout-sessions/dismiss
 * Records that the Razorpay modal was closed/dismissed.
 * Updates lastActivityAt and records the event timestamp in metadata.
 * Does not immediately mark the session permanently abandoned.
 */
r.post("/dismiss", async (req, res, next) => {
  try {
    const { sessionId } = dismissSchema.parse(req.body);

    const session = await CheckoutSession.findOne({ sessionId });
    if (session && session.status === "active") {
      session.lastActivityAt = new Date();
      session.metadata = {
        ...(session.metadata || {}),
        razorpayDismissedAt: new Date(),
      };
      await session.save();
    }

    return res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/checkout-sessions/:token
 * Validates recovery token and returns only the safe, necessary data to hydrate the checkout page.
 * Live prices and current stock are verified against the database.
 * Internal IDs and sensitive admin fields are never exposed.
 */
r.get("/:token", async (req, res, next) => {
  try {
    const token = (req.params.token || "").trim();
    if (!token || token.length < 16) {
      throw new HttpError(400, "Invalid recovery token format");
    }

    const session = await CheckoutSession.findOne({ recoveryToken: token });
    if (!session) {
      throw new HttpError(404, "Checkout session not found or link has expired");
    }

    if (session.status === "recovered") {
      return res.json({
        ok: false,
        recovered: true,
        message: "This order has already been completed. Thank you!",
      });
    }

    if (session.status === "cancelled") {
      return res.json({
        ok: false,
        cancelled: true,
        message: "This checkout session has expired.",
      });
    }

    // Revalidate products and live prices from database
    const productIds = session.items.map((i) => i.productId);
    const products = await Product.find({ _id: { $in: productIds } });

    let liveSubtotal = 0;
    let hasUnavailableItems = false;

    const verifiedItems = session.items.map((item) => {
      const product = products.find((p) => String(p._id) === String(item.productId));
      const inStock = Boolean(product && product.isActive && (product.stock ?? 0) > 0);
      const availableStock = product ? Math.max(0, product.stock ?? 0) : 0;
      const livePrice = product ? product.price : item.price;
      const effectiveQty = inStock ? Math.min(item.qty, availableStock) : 0;

      if (!inStock || effectiveQty < item.qty) {
        hasUnavailableItems = true;
      }

      if (inStock && effectiveQty > 0) {
        liveSubtotal += livePrice * effectiveQty;
      }

      return {
        productId: String(item.productId),
        name: product?.name || item.name,
        image: product?.image || item.image || "",
        price: livePrice,
        qty: effectiveQty > 0 ? effectiveQty : item.qty,
        inStock,
        availableStock,
      };
    });

    const settings = await Settings.findOne({ key: "global" });
    const freeShipThreshold = settings?.freeShipThreshold ?? 999;
    const shippingFee = settings?.shippingFee ?? 49;
    const shipping = liveSubtotal >= freeShipThreshold || liveSubtotal === 0 ? 0 : shippingFee;
    const total = liveSubtotal + shipping;

    return res.json({
      ok: true,
      session: {
        sessionId: session.sessionId,
        name: session.name || "",
        email: session.email || "",
        phone: session.phone || "",
        address: {
          name: session.address?.name || "",
          phone: session.address?.phone || "",
          alternatePhone: session.address?.alternatePhone || "",
          line1: session.address?.line1 || "",
          line2: session.address?.line2 || "",
          city: session.address?.city || "",
          state: session.address?.state || "",
          pincode: session.address?.pincode || "",
          postOffice: session.address?.postOffice || "",
        },
        items: verifiedItems,
        subtotal: liveSubtotal,
        shipping,
        total,
        hasUnavailableItems,
      },
    });
  } catch (err) {
    next(err);
  }
});

export default r;
