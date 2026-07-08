import { Router } from "express";
import { z } from "zod";
import { Product } from "../models/Product";
import { requireAuth, requireAdmin } from "../middleware/auth";
import { HttpError } from "../middleware/error";

const r = Router();

r.get("/", async (req, res, next) => {
  try {
    const { category, q, sort } = req.query as Record<string, string | undefined>;
    const filter: any = { isActive: true };
    if (category && category !== "all") filter.category = category;
    if (q) filter.name = { $regex: q, $options: "i" };
    const sortMap: Record<string, any> = {
      newest: { createdAt: -1 },
      price_asc: { price: 1 },
      price_desc: { price: -1 },
      rating: { rating: -1 },
    };
    const products = await Product.find(filter).sort(sortMap[sort ?? "newest"] ?? { createdAt: -1 });
    res.json({ products });
  } catch (e) {
    next(e);
  }
});

r.get("/:id", async (req, res, next) => {
  try {
    const p = await Product.findById(req.params.id);
    if (!p) throw new HttpError(404, "Product not found");
    res.json({ product: p });
  } catch (e) {
    next(e);
  }
});

const productSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional().default(""),
  price: z.number().min(0),
  mrp: z.number().min(0).optional().default(0),
  image: z.string().optional().default(""),
  images: z.array(z.string()).optional().default([]),
  featuredDeal: z.boolean().optional().default(false),
  category: z.string().min(1),
  stock: z.number().min(0).optional().default(100),
  rating: z.number().min(0).max(5).optional(),
  reviews: z.number().min(0).optional(),
  details: z.array(z.string()).optional().default([]),
  isActive: z.boolean().optional().default(true),
});

r.post("/", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const data = productSchema.parse(req.body);
    const p = await Product.create(data);
    res.status(201).json({ product: p });
  } catch (e) {
    next(e);
  }
});

r.patch("/:id", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const data = productSchema.partial().parse(req.body);
    const p = await Product.findByIdAndUpdate(req.params.id, data, { new: true });
    if (!p) throw new HttpError(404, "Not found");
    res.json({ product: p });
  } catch (e) {
    next(e);
  }
});

r.delete("/:id", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    await Product.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

export default r;
