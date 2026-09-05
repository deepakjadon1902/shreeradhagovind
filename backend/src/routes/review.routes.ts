import { Router } from "express";
import { z } from "zod";
import { Review } from "../models/Review";
import { Order } from "../models/Order";
import { Product } from "../models/Product";
import { requireAuth, requireAdmin, optionalAuth } from "../middleware/auth";
import { HttpError } from "../middleware/error";

const r = Router();

// Public: Get only APPROVED reviews for a product
r.get("/product/:productId", async (req, res, next) => {
  try {
    const reviews = await Review.find({
      product: req.params.productId,
      status: "approved",
    })
      .sort({ createdAt: -1 })
      .lean();

    res.json(reviews);
  } catch (e) {
    next(e);
  }
});

// Check review eligibility for an order item
r.get("/eligibility", optionalAuth, async (req, res, next) => {
  try {
    const orderId = String(req.query.orderId || "");
    const productId = String(req.query.productId || "");
    const guestAccessToken = req.query.guestAccessToken ? String(req.query.guestAccessToken) : undefined;

    if (!orderId || !productId) {
      return res.json({ eligible: false, reason: "Order ID and Product ID required" });
    }

    const order = await Order.findById(orderId).lean();
    if (!order) {
      return res.json({ eligible: false, reason: "Order not found" });
    }

    // Verify ownership
    let isAuthorized = false;
    if (req.user) {
      isAuthorized =
        (order.user && order.user.toString() === req.user.sub) ||
        (Boolean(order.customerEmail && req.user.email) &&
          order.customerEmail?.toLowerCase() === req.user.email?.toLowerCase());
    } else if (guestAccessToken && order.guestAccessToken) {
      isAuthorized = order.guestAccessToken === guestAccessToken;
    }

    if (!isAuthorized) {
      return res.json({ eligible: false, reason: "Not authorized for this order" });
    }

    // Check item presence
    const hasItem = (order.items || []).some(
      (item) => String(item.productId) === productId || String((item as any)._id) === productId
    );
    if (!hasItem) {
      return res.json({ eligible: false, reason: "Product was not in this order" });
    }

    // Check if already reviewed
    const existing = await Review.findOne({ order: order._id, product: productId }).lean();
    if (existing) {
      return res.json({
        eligible: false,
        alreadyReviewed: true,
        status: existing.status,
        review: existing,
      });
    }

    const isDelivered = order.status === "Delivered";
    res.json({
      eligible: isDelivered,
      delivered: isDelivered,
      orderNo: order.orderNo,
      customerName: order.address?.name || "Verified Customer",
    });
  } catch (e) {
    next(e);
  }
});

// Customer: Submit review for a purchased product
r.post("/", optionalAuth, async (req, res, next) => {
  try {
    const data = z
      .object({
        orderId: z.string().min(1),
        productId: z.string().min(1),
        rating: z.number().int().min(1).max(5),
        comment: z.string().min(3).max(1000),
        guestAccessToken: z.string().optional(),
      })
      .parse(req.body);

    const order = await Order.findById(data.orderId);
    if (!order) {
      throw new HttpError(404, "Order not found");
    }

    // Verify customer authorization
    let isAuthorized = false;
    let customerName = order.address?.name || "Verified Buyer";
    let customerEmail = order.customerEmail || "";

    if (req.user) {
      isAuthorized =
        (order.user && order.user.toString() === req.user.sub) ||
        (Boolean(order.customerEmail && req.user.email) &&
          order.customerEmail?.toLowerCase() === req.user.email?.toLowerCase());
      customerEmail = req.user.email || customerEmail;
    } else if (data.guestAccessToken && order.guestAccessToken) {
      isAuthorized = order.guestAccessToken === data.guestAccessToken;
    }

    if (!isAuthorized) {
      throw new HttpError(403, "You can only review products from your own orders");
    }

    // Strict Delivery Check: Review only allowed on Delivered orders
    if (order.status !== "Delivered") {
      throw new HttpError(400, "Reviews can only be submitted after the order has been delivered");
    }

    // Verify product was purchased in this order
    const orderedItem = (order.items || []).find(
      (item) => String(item.productId) === data.productId || String((item as any)._id) === data.productId
    );
    if (!orderedItem) {
      throw new HttpError(400, "This product was not purchased in the specified order");
    }

    // Check duplicate: 1 review per product per order
    const existing = await Review.findOne({ order: order._id, product: data.productId });
    if (existing) {
      throw new HttpError(400, "You have already submitted a review for this order item");
    }

    const review = await Review.create({
      product: data.productId,
      order: order._id,
      orderNo: order.orderNo,
      user: order.user,
      customerName,
      customerEmail,
      rating: data.rating,
      comment: data.comment.trim(),
      status: "pending", // Always pending admin approval
    });

    res.status(201).json({
      ok: true,
      message: "Thank you! Your review has been submitted and will appear once approved by admin.",
      review,
    });
  } catch (e) {
    next(e);
  }
});

// Admin: List all reviews (with optional status filter)
r.get(["/admin", "/admin/all"], requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const status = req.query.status ? String(req.query.status) : undefined;
    const filter: Record<string, any> = {};
    if (status && ["pending", "approved", "rejected"].includes(status)) {
      filter.status = status;
    }

    const reviews = await Review.find(filter)
      .populate("product", "name image price category")
      .sort({ createdAt: -1 })
      .lean();

    const mapped = reviews.map((rev: any) => ({
      ...rev,
      productName: rev.product?.name || "Sacred Item",
      productImage: rev.product?.image || "",
    }));

    res.json(mapped);
  } catch (e) {
    next(e);
  }
});

// Admin: Approve or Reject a review
r.patch("/admin/:id/status", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { status } = z
      .object({
        status: z.enum(["approved", "rejected", "pending"]),
      })
      .parse(req.body);

    const review = await Review.findById(req.params.id);
    if (!review) throw new HttpError(404, "Review not found");

    review.status = status;
    await review.save();

    // If status changed, recalculate product rating if desired
    if (review.product) {
      const approvedReviews = await Review.find({
        product: review.product,
        status: "approved",
      }).lean();

      if (approvedReviews.length > 0) {
        const sum = approvedReviews.reduce((acc, r) => acc + r.rating, 0);
        const avg = Math.round((sum / approvedReviews.length) * 10) / 10;
        await Product.findByIdAndUpdate(review.product, {
          rating: avg,
          reviews: approvedReviews.length,
        });
      }
    }

    res.json({ ok: true, review });
  } catch (e) {
    next(e);
  }
});

// Admin: Delete a review permanently
r.delete("/admin/:id", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const review = await Review.findByIdAndDelete(req.params.id);
    if (!review) throw new HttpError(404, "Review not found");
    res.json({ ok: true, message: "Review deleted successfully" });
  } catch (e) {
    next(e);
  }
});

export default r;
