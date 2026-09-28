import { Schema, model, type Document, type Types } from "mongoose";

export interface ICouponRedemption extends Document {
  couponId: Types.ObjectId;
  couponCode: string;
  orderId: Types.ObjectId;
  orderNo?: number;
  userId?: Types.ObjectId | null;
  customerEmail: string;
  customerPhone: string;
  discountAmount: number;
  status: "active" | "restored";
  createdAt: Date;
  restoredAt?: Date | null;
}

const couponRedemptionSchema = new Schema<ICouponRedemption>(
  {
    couponId: {
      type: Schema.Types.ObjectId,
      ref: "Coupon",
      required: true,
      index: true,
    },
    couponCode: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    orderId: {
      type: Schema.Types.ObjectId,
      ref: "Order",
      required: true,
      unique: true,
      index: true,
    },
    orderNo: {
      type: Number,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    customerEmail: {
      type: String,
      lowercase: true,
      trim: true,
      index: true,
      default: "",
    },
    customerPhone: {
      type: String,
      trim: true,
      index: true,
      default: "",
    },
    discountAmount: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    status: {
      type: String,
      enum: ["active", "restored"],
      default: "active",
      index: true,
    },
    restoredAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

couponRedemptionSchema.index({ couponId: 1, customerEmail: 1, status: 1 });
couponRedemptionSchema.index({ couponId: 1, customerPhone: 1, status: 1 });
couponRedemptionSchema.index({ couponId: 1, userId: 1, status: 1 });

export const CouponRedemption = model<ICouponRedemption>(
  "CouponRedemption",
  couponRedemptionSchema
);
