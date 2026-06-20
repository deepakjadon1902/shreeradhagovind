import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { OAuth2Client } from "google-auth-library";
import { User } from "../models/User";
import { signToken } from "../utils/jwt";
import { sendEmail, tpl } from "../utils/email";
import { requireAuth } from "../middleware/auth";
import { HttpError } from "../middleware/error";
import { env } from "../config/env";

const r = Router();
const google = env.GOOGLE_CLIENT_ID ? new OAuth2Client(env.GOOGLE_CLIENT_ID) : null;

const safe = (u: any) => ({
  id: String(u._id),
  name: u.name,
  email: u.email,
  role: u.role,
  avatar: u.avatar,
  phone: u.phone,
});

r.post("/signup", async (req, res, next) => {
  try {
    const { name, email, password, phone, address } = z
      .object({
        name: z.string().min(1).max(80),
        email: z.string().email(),
        password: z.string().min(6),
        phone: z.string().min(5).max(20).optional(),
        address: z
          .object({
            line1: z.string().max(200).optional(),
            city: z.string().max(80).optional(),
            state: z.string().max(80).optional(),
            pincode: z.string().max(12).optional(),
          })
          .optional(),
      })
      .parse(req.body);
    const lower = email.toLowerCase();
    if (await User.findOne({ email: lower })) throw new HttpError(409, "Email already registered");
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email: lower, passwordHash, phone: phone ?? "", address: address ?? {} });
    sendEmail({ to: lower, ...tpl.welcome(name) }).catch(() => {});
    res.json({ token: signToken({ sub: String(user._id), role: user.role, email: user.email }), user: safe(user) });
  } catch (e) {
    next(e);
  }
});

r.post("/login", async (req, res, next) => {
  try {
    const { email, password } = z
      .object({ email: z.string().email(), password: z.string().min(1) })
      .parse(req.body);
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user || !user.passwordHash) throw new HttpError(401, "Invalid credentials");
    if (user.isBlocked) throw new HttpError(403, "Your account has been blocked. Please contact support.");
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw new HttpError(401, "Invalid credentials");
    user.lastLoginAt = new Date();
    await user.save();
    res.json({ token: signToken({ sub: String(user._id), role: user.role, email: user.email }), user: safe(user) });
  } catch (e) {
    next(e);
  }
});

r.post("/google", async (req, res, next) => {
  try {
    if (!google) throw new HttpError(400, "Google sign-in not configured");
    const { credential } = z.object({ credential: z.string().min(10) }).parse(req.body);
    const ticket = await google.verifyIdToken({ idToken: credential, audience: env.GOOGLE_CLIENT_ID });
    const p = ticket.getPayload();
    if (!p?.email) throw new HttpError(401, "Google token invalid");
    const lower = p.email.toLowerCase();
    let user = await User.findOne({ email: lower });
    if (!user) {
      user = await User.create({
        name: p.name || lower.split("@")[0],
        email: lower,
        provider: "google",
        avatar: p.picture || "",
      });
      sendEmail({ to: lower, ...tpl.welcome(user.name) }).catch(() => {});
    }
    if (user.isBlocked) throw new HttpError(403, "Your account has been blocked. Please contact support.");
    user.lastLoginAt = new Date();
    await user.save();
    res.json({ token: signToken({ sub: String(user._id), role: user.role, email: user.email }), user: safe(user) });
  } catch (e) {
    next(e);
  }
});

r.get("/me", requireAuth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user!.sub);
    if (!user) throw new HttpError(404, "User not found");
    res.json({ user: safe(user) });
  } catch (e) {
    next(e);
  }
});

export default r;
