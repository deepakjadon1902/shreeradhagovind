import { Schema, model, type Document, type Types } from "mongoose";

export type CouponDiscountType = "percentage" | "flat" | "free_shipping";
export type CouponPaymentMethod = "both" | "online" | "cod";

export interface ICoupon extends Document {
  code: string;
  title?: string;
  description?: string;
  discountType: CouponDiscountType;
  discountValue: number;
  maxDiscountAmount?: number | null;
  minOrderValue?: number | null;
  startDate?: Date | null;
  endDate?: Date | null;
  expiryDate?: Date | null;
  isActive: boolean;
  usageLimitTotal?: number | null;
  usageLimitPerUser?: number | null;
  usedCount: number;
  applicableProductIds: Types.ObjectId[];
  applicableCategoryIds: string[];
  allowedPaymentMethods: CouponPaymentMethod;
  createdBy?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const couponSchema = new Schema<ICoupon>(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    title: {
      type: String,
      default: "",
      trim: true,
    },
    description: {
      type: String,
      default: "",
      trim: true,
    },
    discountType: {
      type: String,
      enum: ["percentage", "flat", "free_shipping"],
      required: true,
    },
    discountValue: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    maxDiscountAmount: {
      type: Number,
      min: 0,
      default: null,
    },
    minOrderValue: {
      type: Number,
      min: 0,
      default: null,
    },
    startDate: {
      type: Date,
      default: null,
    },
    endDate: {
      type: Date,
      default: null,
    },
    expiryDate: {
      type: Date,
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    usageLimitTotal: {
      type: Number,
      min: 1,
      default: null,
    },
    usageLimitPerUser: {
      type: Number,
      min: 1,
      default: null,
    },
    usedCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    applicableProductIds: [
      {
        type: Schema.Types.ObjectId,
        ref: "Product",
      },
    ],
    applicableCategoryIds: [
      {
        type: String,
        trim: true,
      },
    ],
    allowedPaymentMethods: {
      type: String,
      enum: ["both", "online", "cod"],
      default: "both",
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true }
);

couponSchema.index({ isActive: 1, startDate: 1, endDate: 1 });
couponSchema.index({ createdAt: -1 });

export const Coupon = model<ICoupon>("Coupon", couponSchema);
