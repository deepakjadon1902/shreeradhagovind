import { Router } from "express";
import { z } from "zod";
import { Settings } from "../models/Settings";
import { requireAuth, requireAdmin } from "../middleware/auth";

const r = Router();

r.get("/", async (_req, res, next) => {
  try {
    const s = (await Settings.findOne({ key: "global" })) ?? (await Settings.create({ key: "global" }));
    res.json({ settings: s });
  } catch (e) {
    next(e);
  }
});

r.patch("/", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const data = z
      .object({
        siteName: z.string().optional(),
        tagline: z.string().optional(),
        email: z.string().optional(),
        announcement: z.string().optional(),
        currency: z.string().optional(),
        freeShipThreshold: z.number().optional(),
        shippingFee: z.number().optional(),
        codEnabled: z.boolean().optional(),
        razorpayKeyId: z.string().optional(),
      })
      .parse(req.body);
    const s = await Settings.findOneAndUpdate({ key: "global" }, data, { new: true, upsert: true });
    res.json({ settings: s });
  } catch (e) {
    next(e);
  }
});

export default r;
