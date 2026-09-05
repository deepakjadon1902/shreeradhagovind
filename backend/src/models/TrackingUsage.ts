import { Schema, model } from "mongoose";

const trackingUsageSchema = new Schema(
  {
    _id: { type: String, required: true }, // Format: "YYYY-MM" (e.g. "2026-09")
    used: { type: Number, default: 0 },
    budget: { type: Number, default: 80 },
    providerUsage: {
      used: Number,
      quota: Number,
      remaining: Number,
    },
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: false, versionKey: false }
);

export const TrackingUsage = model("TrackingUsage", trackingUsageSchema);
