import { Router } from "express";
import { z } from "zod";
import { Settings } from "../models/Settings";
import { requireAuth, requireAdmin } from "../middleware/auth";
import { env } from "../config/env";

const r = Router();

r.get("/", async (_req, res, next) => {
  try {
    const s = (await Settings.findOne({ key: "global" })) ?? (await Settings.create({ key: "global" }));
    const sObj = s.toObject();
    sObj.razorpayKeyId = env.RAZORPAY_KEY_ID || "";
    res.json({ settings: sObj });
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
        freeShipThreshold: z.number().min(0).optional(),
        shippingFee: z.number().min(0).optional(),
        codEnabled: z.boolean().optional(),
        homeHeroImage: z.string().optional(),
        vrindavanStoryImage: z.string().optional(),
        whatsappTemplate: z.string().optional(),
      })
      .parse(req.body);
    const s = await Settings.findOneAndUpdate({ key: "global" }, data, { new: true, upsert: true });
    const sObj = s.toObject();
    sObj.razorpayKeyId = env.RAZORPAY_KEY_ID || "";
    res.json({ settings: sObj });
  } catch (e) {
    next(e);
  }
});

export default r;
