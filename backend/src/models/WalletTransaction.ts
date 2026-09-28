import { Schema, model, type InferSchemaType } from "mongoose";

const walletTransactionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: {
      type: String,
      enum: ["CREDIT", "DEBIT", "REVERSAL", "ADJUSTMENT_CREDIT", "ADJUSTMENT_DEBIT"],
      required: true,
      index: true,
    },
    amount: { type: Number, required: true },
    balanceAfter: { type: Number, required: true, min: 0 },
    referenceOrderId: { type: Schema.Types.ObjectId, ref: "Order", sparse: true, index: true },
    reason: { type: String, required: true, trim: true },
    adminActor: { type: String, default: null },
    metadata: { type: Schema.Types.Mixed, default: null },
  },
  { timestamps: true }
);

walletTransactionSchema.index({ userId: 1, createdAt: -1 });

export type WalletTransactionDoc = InferSchemaType<typeof walletTransactionSchema> & {
  _id: string;
};
export const WalletTransaction = model("WalletTransaction", walletTransactionSchema);
