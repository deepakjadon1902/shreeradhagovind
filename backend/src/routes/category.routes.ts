import { Router } from "express";
import { z } from "zod";
import { Category } from "../models/Category";
import { Product } from "../models/Product";
import { requireAuth, requireAdmin } from "../middleware/auth";
import { HttpError } from "../middleware/error";

const r = Router();
const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

r.get("/", async (_req, res, next) => {
  try {
    const categories = await Category.find().sort({ sortOrder: 1, name: 1 });
    res.json({ categories });
  } catch (e) {
    next(e);
  }
});

r.post("/", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { name, image } = z
      .object({ name: z.string().min(1), image: z.string().url().optional().default("") })
      .parse(req.body);
    const slug = slugify(name);
    const c = await Category.create({ name, slug, image });
    res.status(201).json({ category: c });
  } catch (e) {
    next(e);
  }
});

r.patch("/:id", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const data = z
      .object({
        name: z.string().min(1).optional(),
        image: z.string().url().optional(),
        sortOrder: z.number().optional(),
      })
      .parse(req.body);
    const patch: any = { ...data };
    if (data.name) patch.slug = slugify(data.name);
    const prev = await Category.findById(req.params.id);
    if (!prev) throw new HttpError(404, "Not found");
    const c = await Category.findByIdAndUpdate(req.params.id, patch, { new: true });
    if (data.name && prev.name !== data.name) {
      await Product.updateMany({ category: prev.name }, { category: data.name });
    }
    res.json({ category: c });
  } catch (e) {
    next(e);
  }
});

r.delete("/:id", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const c = await Category.findByIdAndDelete(req.params.id);
    if (c) await Product.updateMany({ category: c.name }, { isActive: false });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

export default r;
