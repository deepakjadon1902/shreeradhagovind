import { Schema, model, Document } from "mongoose";

export interface IReview extends Document {
  product: Schema.Types.ObjectId;
  order: Schema.Types.ObjectId;
  orderNo?: number;
  user?: Schema.Types.ObjectId;
  customerName: string;
  customerEmail: string;
  rating: number;
  comment: string;
  status: "pending" | "approved" | "rejected";
  createdAt: Date;
  updatedAt: Date;
}

const reviewSchema = new Schema<IReview>(
  {
    product: { type: Schema.Types.ObjectId, ref: "Product", required: true, index: true },
    order: { type: Schema.Types.ObjectId, ref: "Order", required: true, index: true },
    orderNo: { type: Number },
    user: { type: Schema.Types.ObjectId, ref: "User", index: true },
    customerName: { type: String, required: true, trim: true },
    customerEmail: { type: String, required: true, trim: true, lowercase: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, required: true, trim: true, maxlength: 1000 },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
      index: true,
    },
  },
  { timestamps: true }
);

// One review per customer order item
reviewSchema.index({ order: 1, product: 1 }, { unique: true });

export const Review = model<IReview>("Review", reviewSchema);
