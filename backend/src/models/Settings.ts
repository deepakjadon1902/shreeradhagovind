import { Schema, model } from "mongoose";

const settingsSchema = new Schema(
  {
    key: { type: String, default: "global", unique: true },
    siteName: { type: String, default: "Shri Radha Govind Store" },
    tagline: { type: String, default: "Sacred essentials from Vrindavan" },
    email: { type: String, default: "support@shreeradhagovind.com" },
    announcement: { type: String, default: "🚚 Free shipping over ₹999 · 🎁 Use code RADHE10" },
    currency: { type: String, default: "INR" },
    freeShipThreshold: { type: Number, default: 999 },
    shippingFee: { type: Number, default: 49 },
    codEnabled: { type: Boolean, default: true },
    razorpayKeyId: { type: String, default: "" },
  },
  { timestamps: true }
);

export const Settings = model("Settings", settingsSchema);
