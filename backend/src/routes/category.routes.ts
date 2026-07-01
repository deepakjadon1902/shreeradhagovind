import { Router } from "express";
import { z } from "zod";
import { Category } from "../models/Category";
import { Product } from "../models/Product";
import { requireAuth, requireAdmin } from "../middleware/auth";
import { HttpError } from "../middleware/error";

const r = Router();
const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const categorySchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1).optional(),
  parentId: z.string().nullable().optional(),
  image: z.string().optional().default(""),
  description: z.string().optional().default(""),
  metaTitle: z.string().optional().default(""),
  metaDescription: z.string().optional().default(""),
  isActive: z.boolean().optional().default(true),
  sortOrder: z.number().optional().default(0),
});

async function withProductCounts(filter: any = {}) {
  const [categories, counts] = await Promise.all([
    Category.find(filter).sort({ sortOrder: 1, name: 1 }),
    Product.aggregate([{ $match: { isActive: true } }, { $group: { _id: "$category", count: { $sum: 1 } } }]),
  ]);
  const countMap = new Map(counts.map((x) => [x._id, x.count]));
  return categories.map((c: any) => ({ ...c.toObject(), productCount: countMap.get(c.name) ?? 0 }));
}

r.get("/", async (_req, res, next) => {
  try {
    const categories = await withProductCounts();
    res.json({ categories });
  } catch (e) {
    next(e);
  }
});

r.get("/tree", async (_req, res, next) => {
  try {
    const categories = await withProductCounts({ isActive: true });
    const byParent = new Map<string, any[]>();
    for (const c of categories) {
      const key = c.parentId ? String(c.parentId) : "root";
      byParent.set(key, [...(byParent.get(key) ?? []), c]);
    }
    const attach = (items: any[]): any[] => items.map((c) => ({ ...c, children: attach(byParent.get(String(c._id)) ?? []) }));
    res.json({ categories: attach(byParent.get("root") ?? []) });
  } catch (e) {
    next(e);
  }
});

r.post("/", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const data = categorySchema.parse(req.body);
    const slug = slugify(data.slug ?? data.name);
    const c = await Category.create({ ...data, slug, parentId: data.parentId || null });
    res.status(201).json({ category: c });
  } catch (e) {
    next(e);
  }
});

r.patch("/sort/bulk", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const items = z.array(z.object({ id: z.string(), sortOrder: z.number(), parentId: z.string().nullable().optional() })).parse(req.body.items);
    await Promise.all(items.map((item) => Category.findByIdAndUpdate(item.id, { sortOrder: item.sortOrder, parentId: item.parentId || null })));
    res.json({ categories: await withProductCounts() });
  } catch (e) {
    next(e);
  }
});

r.patch("/:id", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const data = categorySchema.partial().parse(req.body);
    const patch: any = { ...data };
    if (data.name || data.slug) patch.slug = slugify(data.slug ?? data.name!);
    if ("parentId" in data) patch.parentId = data.parentId || null;
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
