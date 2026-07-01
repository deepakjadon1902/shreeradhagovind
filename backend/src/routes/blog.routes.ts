import { Router } from "express";
import { z } from "zod";
import { Blog } from "../models/Blog";
import { requireAuth, requireAdmin } from "../middleware/auth";
import { HttpError } from "../middleware/error";

const r = Router();
const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const blogSchema = z.object({
  title: z.string().min(1),
  slug: z.string().min(1).optional(),
  excerpt: z.string().optional().default(""),
  content: z.string().optional().default(""),
  image: z.string().optional().default(""),
  author: z.string().optional().default("Shri Radha Govind Store"),
  metaTitle: z.string().optional().default(""),
  metaDescription: z.string().optional().default(""),
  isPublished: z.boolean().optional().default(true),
  sortOrder: z.number().optional().default(0),
  publishedAt: z.string().datetime().optional(),
});

r.get("/", async (req, res, next) => {
  try {
    const includeDrafts = req.query.all === "true";
    const filter = includeDrafts ? {} : { isPublished: true };
    const blogs = await Blog.find(filter).sort({ sortOrder: 1, publishedAt: -1, createdAt: -1 });
    res.json({ blogs });
  } catch (e) {
    next(e);
  }
});

r.get("/:slug", async (req, res, next) => {
  try {
    const blog = await Blog.findOne({ slug: req.params.slug, isPublished: true });
    if (!blog) throw new HttpError(404, "Blog not found");
    res.json({ blog });
  } catch (e) {
    next(e);
  }
});

r.post("/", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const data = blogSchema.parse(req.body);
    const blog = await Blog.create({ ...data, slug: slugify(data.slug ?? data.title), publishedAt: data.publishedAt ? new Date(data.publishedAt) : new Date() });
    res.status(201).json({ blog });
  } catch (e) {
    next(e);
  }
});

r.patch("/:id", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const data = blogSchema.partial().parse(req.body);
    const patch: any = { ...data };
    if (data.title || data.slug) patch.slug = slugify(data.slug ?? data.title!);
    if (data.publishedAt) patch.publishedAt = new Date(data.publishedAt);
    const blog = await Blog.findByIdAndUpdate(req.params.id, patch, { new: true });
    if (!blog) throw new HttpError(404, "Blog not found");
    res.json({ blog });
  } catch (e) {
    next(e);
  }
});

r.delete("/:id", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    await Blog.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

export default r;
