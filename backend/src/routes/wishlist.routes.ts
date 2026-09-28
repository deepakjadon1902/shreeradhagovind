import { Router } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import { User } from "../models/User";
import { Product } from "../models/Product";
import { requireAuth } from "../middleware/auth";
import { HttpError } from "../middleware/error";

const r = Router();

// GET /api/wishlist - Get authenticated customer's server wishlist
r.get("/", requireAuth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user!.sub).select("wishlist").lean();
    if (!user) throw new HttpError(404, "User not found");

    const rawIds = (user.wishlist || []).map((id) => String(id));
    // Verify products exist and are active
    const activeProducts = await Product.find({
      _id: { $in: rawIds },
      isActive: { $ne: false },
    })
      .select("_id")
      .lean();

    const validIds = activeProducts.map((p) => String(p._id));
    res.json({ wishlist: validIds });
  } catch (e) {
    next(e);
  }
});

// POST /api/wishlist/sync - Merges local client wishlist into server wishlist without data loss
r.post("/sync", requireAuth, async (req, res, next) => {
  try {
    const { items } = z.object({ items: z.array(z.string()) }).parse(req.body);
    const user = await User.findById(req.user!.sub);
    if (!user) throw new HttpError(404, "User not found");

    const existingServerIds = (user.wishlist || []).map((id) => String(id));
    const mergedUniqueIds = Array.from(new Set([...existingServerIds, ...items])).filter((id) =>
      mongoose.isValidObjectId(id)
    );

    // Validate that merged products actually exist and are active
    const activeProducts = await Product.find({
      _id: { $in: mergedUniqueIds },
      isActive: { $ne: false },
    })
      .select("_id")
      .lean();

    const validIds = activeProducts.map((p) => p._id);
    user.wishlist = validIds as any;
    await user.save();

    res.json({
      ok: true,
      wishlist: validIds.map((id) => String(id)),
      count: validIds.length,
    });
  } catch (e) {
    next(e);
  }
});

// POST /api/wishlist/toggle - Toggles item in customer's server wishlist
r.post("/toggle", requireAuth, async (req, res, next) => {
  try {
    const { productId } = z.object({ productId: z.string() }).parse(req.body);
    if (!mongoose.isValidObjectId(productId)) {
      throw new HttpError(400, "Invalid product ID");
    }

    const user = await User.findById(req.user!.sub);
    if (!user) throw new HttpError(404, "User not found");

    const strList = (user.wishlist || []).map((id) => String(id));
    const exists = strList.includes(productId);

    let updatedList: any[];
    let added = false;

    if (exists) {
      updatedList = strList.filter((id) => id !== productId);
      added = false;
    } else {
      // Verify product exists before adding
      const product = await Product.findById(productId).select("_id isActive").lean();
      if (!product || product.isActive === false) {
        throw new HttpError(404, "Product not found or unavailable");
      }
      updatedList = [...strList, productId];
      added = true;
    }

    user.wishlist = updatedList as any;
    await user.save();

    res.json({
      ok: true,
      added,
      wishlist: updatedList,
      count: updatedList.length,
    });
  } catch (e) {
    next(e);
  }
});

export default r;
