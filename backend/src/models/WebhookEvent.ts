import { Schema, model } from "mongoose";

const webhookEventSchema = new Schema(
 {
 eventId: { type: String, required: true, unique: true, index: true },
 eventType: { type: String, required: true },
 razorpayOrderId: { type: String, index: true },
 razorpayPaymentId: { type: String, index: true },
 processedAt: { type: Date, default: Date.now },
 // Expire after 30 days automatically using MongoDB TTL index
 createdAt: { type: Date, default: Date.now, expires: 30 * 24 * 3600 },
 },
 { timestamps: false }
);

export const WebhookEvent = model("WebhookEvent", webhookEventSchema);
