import { Schema, model, type InferSchemaType } from "mongoose";

const marketingUnsubscribeSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    token: { type: String, unique: true, sparse: true, index: true },
    unsubscribedAt: { type: Date, default: Date.now },
    reason: { type: String, default: "" },
  },
  { timestamps: true }
);

export type MarketingUnsubscribeDoc = InferSchemaType<typeof marketingUnsubscribeSchema> & {
  _id: string;
};
export const MarketingUnsubscribe = model("MarketingUnsubscribe", marketingUnsubscribeSchema);
