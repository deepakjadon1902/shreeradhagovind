import { Schema, model, type InferSchemaType } from "mongoose";

const loyaltyTransactionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    customerEmail: { type: String, required: true, lowercase: true, trim: true, index: true },
    type: {
      type: String,
      enum: ["EARN", "REDEEM", "EXPIRE", "ADJUSTMENT_CREDIT", "ADJUSTMENT_DEBIT", "REVERSAL"],
      required: true,
      index: true,
    },
    pointsDelta: { type: Number, required: true },
    balanceAfter: { type: Number, required: true, min: 0 },
    referenceOrderId: { type: Schema.Types.ObjectId, ref: "Order", sparse: true, index: true },
    referenceType: {
      type: String,
      enum: [
        "order_earned",
        "order_redeemed",
        "order_cancelled",
        "order_refunded",
        "admin_adjustment",
        "expiry",
        "initial_grant",
      ],
      required: true,
    },
    reason: { type: String, required: true, trim: true },
    expiresAt: { type: Date, default: null, index: true },
    isExpired: { type: Boolean, default: false, index: true },
    metadata: { type: Schema.Types.Mixed, default: null },
  },
  { timestamps: true }
);

loyaltyTransactionSchema.index({ userId: 1, createdAt: -1 });
loyaltyTransactionSchema.index({ referenceOrderId: 1, type: 1 });

export type LoyaltyTransactionDoc = InferSchemaType<typeof loyaltyTransactionSchema> & {
  _id: string;
};
export const LoyaltyTransaction = model("LoyaltyTransaction", loyaltyTransactionSchema);
