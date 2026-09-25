import { Schema, model, type Document } from "mongoose";

export type AnalyticsEventType =
  | "page_view"
  | "product_view"
  | "add_to_cart"
  | "checkout_start";

export type DeviceCategory = "mobile" | "desktop" | "tablet" | "unknown";

export interface IUtmParams {
  source?: string;
  medium?: string;
  campaign?: string;
  term?: string;
  content?: string;
}

export interface IAnalyticsEvent extends Document {
  eventType: AnalyticsEventType;
  visitorId: string;
  sessionId: string;
  entityId?: string | null;
  path: string;
  device: DeviceCategory;
  referrer?: string;
  utm?: IUtmParams;
  metadata?: Record<string, any>;
  createdAt: Date;
}

const utmSchema = new Schema<IUtmParams>(
  {
    source: { type: String, default: "" },
    medium: { type: String, default: "" },
    campaign: { type: String, default: "" },
    term: { type: String, default: "" },
    content: { type: String, default: "" },
  },
  { _id: false }
);

const analyticsEventSchema = new Schema<IAnalyticsEvent>(
  {
    eventType: {
      type: String,
      required: true,
      enum: ["page_view", "product_view", "add_to_cart", "checkout_start"],
      index: true,
    },
    visitorId: {
      type: String,
      required: true,
      index: true,
      maxlength: 100,
    },
    sessionId: {
      type: String,
      required: true,
      maxlength: 100,
    },
    entityId: {
      type: String,
      default: null,
      maxlength: 100,
    },
    path: {
      type: String,
      required: true,
      maxlength: 500,
    },
    device: {
      type: String,
      enum: ["mobile", "desktop", "tablet", "unknown"],
      default: "unknown",
    },
    referrer: {
      type: String,
      default: "",
      maxlength: 1000,
    },
    utm: {
      type: utmSchema,
      default: () => ({}),
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: () => ({}),
    },
    // MongoDB TTL Index: Exactly 90 days retention (90 * 24 * 60 * 60 seconds = 7,776,000s)
    createdAt: {
      type: Date,
      default: Date.now,
      expires: 90 * 24 * 60 * 60,
      index: true,
    },
  },
  { timestamps: false }
);

// Targeted compound indexes for high-frequency queries
analyticsEventSchema.index({ eventType: 1, createdAt: -1 });
analyticsEventSchema.index({ visitorId: 1, createdAt: -1 });
analyticsEventSchema.index({ entityId: 1, eventType: 1, createdAt: -1 });

export const AnalyticsEvent = model<IAnalyticsEvent>("AnalyticsEvent", analyticsEventSchema);
