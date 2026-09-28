import { Router } from "express";
import crypto from "crypto";
import { z } from "zod";
import { User } from "../models/User";
import { MarketingUnsubscribe } from "../models/MarketingUnsubscribe";
import { optionalAuth, requireAuth } from "../middleware/auth";
import { HttpError } from "../middleware/error";

const r = Router();

// GET /api/marketing/unsubscribe - One-click or direct link unsubscribe
r.get("/unsubscribe", async (req, res, next) => {
  try {
    const rawToken = String(req.query.token || "").trim();
    const rawEmail = String(req.query.email || "").trim().toLowerCase();

    if (!rawToken && !rawEmail) {
      return res.status(400).send(`
        <!DOCTYPE html>
        <html>
        <head><title>Unsubscribe - Shri Radha Govind Store</title></head>
        <body style="font-family:sans-serif;text-align:center;padding:50px;">
          <h2>Invalid Request</h2>
          <p>The unsubscribe link is missing required verification parameters.</p>
        </body>
        </html>
      `);
    }

    let targetEmail = rawEmail;

    if (rawToken) {
      // Find matching user or prior unsubscribe record
      const user = await User.findOne({ unsubscribeToken: rawToken });
      if (user) {
        targetEmail = user.email;
        user.marketingEmailOptIn = false;
        await user.save();
      }
    }

    if (targetEmail) {
      await MarketingUnsubscribe.findOneAndUpdate(
        { email: targetEmail },
        {
          $set: {
            email: targetEmail,
            unsubscribedAt: new Date(),
            reason: "User clicked unsubscribe link",
          },
        },
        { upsert: true, new: true }
      );

      // Also ensure registered user opt-in flag is false if account exists
      await User.updateMany({ email: targetEmail }, { $set: { marketingEmailOptIn: false } });
    }

    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Unsubscribed - Shri Radha Govind Store</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: #fffbeb; color: #1f2937; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
          .card { background: #ffffff; padding: 40px; border-radius: 16px; box-shadow: 0 10px 25px rgba(0,0,0,0.05); max-width: 480px; text-align: center; border: 1px solid #fef3c7; }
          h1 { color: #b45309; font-size: 24px; margin-bottom: 12px; }
          p { color: #4b5563; font-size: 15px; line-height: 1.6; margin-bottom: 24px; }
          .badge { display: inline-block; background: #ecfdf5; color: #047857; font-weight: 600; padding: 6px 14px; border-radius: 999px; font-size: 13px; margin-bottom: 20px; }
          a { display: inline-block; background: #b45309; color: white; text-decoration: none; padding: 10px 24px; border-radius: 99px; font-weight: 500; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="badge">Preferences Updated</div>
          <h1>Successfully Unsubscribed</h1>
          <p>You have been unsubscribed from promotional and marketing emails from Shri Radha Govind Store (${targetEmail || "your email"}).</p>
          <p style="font-size:13px;color:#9ca3af;">Please note: Essential transactional communications (such as order confirmations, shipping tracking, and tax invoices) will still be delivered securely.</p>
          <a href="/">Return to Store</a>
        </div>
      </body>
      </html>
    `);
  } catch (e) {
    next(e);
  }
});

// POST /api/marketing/unsubscribe - JSON API for unsubscribing
r.post("/unsubscribe", async (req, res, next) => {
  try {
    const { email, token, reason } = z
      .object({
        email: z.string().email(),
        token: z.string().optional(),
        reason: z.string().optional().default(""),
      })
      .parse(req.body);

    const cleanEmail = email.trim().toLowerCase();

    await MarketingUnsubscribe.findOneAndUpdate(
      { email: cleanEmail },
      {
        $set: {
          email: cleanEmail,
          token: token || crypto.randomBytes(16).toString("hex"),
          unsubscribedAt: new Date(),
          reason: reason || "API opt-out",
        },
      },
      { upsert: true, new: true }
    );

    await User.updateMany({ email: cleanEmail }, { $set: { marketingEmailOptIn: false } });

    res.json({ ok: true, message: `Successfully unsubscribed ${cleanEmail} from marketing emails.` });
  } catch (e) {
    next(e);
  }
});

// GET /api/marketing/preference - Get current user marketing preference
r.get("/preference", requireAuth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user!.sub).select("marketingEmailOptIn email unsubscribeToken").lean();
    if (!user) throw new HttpError(404, "User not found");

    const unsubRecord = await MarketingUnsubscribe.findOne({ email: user.email.toLowerCase() }).lean();
    const isOptedIn = Boolean(user.marketingEmailOptIn && !unsubRecord);

    res.json({
      email: user.email,
      marketingEmailOptIn: isOptedIn,
      unsubscribeToken: user.unsubscribeToken,
    });
  } catch (e) {
    next(e);
  }
});

// PATCH /api/marketing/preference - Update current user marketing preference
r.patch("/preference", requireAuth, async (req, res, next) => {
  try {
    const { optIn } = z.object({ optIn: z.boolean() }).parse(req.body);
    const user = await User.findById(req.user!.sub);
    if (!user) throw new HttpError(404, "User not found");

    user.marketingEmailOptIn = optIn;
    if (!user.unsubscribeToken) {
      user.unsubscribeToken = crypto.randomBytes(16).toString("hex");
    }
    await user.save();

    if (optIn) {
      await MarketingUnsubscribe.deleteOne({ email: user.email.toLowerCase() });
    } else {
      await MarketingUnsubscribe.findOneAndUpdate(
        { email: user.email.toLowerCase() },
        {
          $set: {
            email: user.email.toLowerCase(),
            unsubscribedAt: new Date(),
            reason: "Account preferences toggle",
          },
        },
        { upsert: true }
      );
    }

    res.json({ ok: true, marketingEmailOptIn: optIn });
  } catch (e) {
    next(e);
  }
});

export default r;
