import { Schema, model, type Document, type Types } from "mongoose";

export interface ICheckoutSessionItem {
  productId: Types.ObjectId | string;
  qty: number;
  name: string;
  price: number;
  image?: string;
}

export interface ICheckoutSessionAddress {
  name?: string;
  phone?: string;
  alternatePhone?: string;
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  pincode?: string;
  postOffice?: string;
}

export interface ICheckoutSession extends Document {
  sessionId: string;
  user?: Types.ObjectId | null;
  email?: string;
  phone?: string;
  name?: string;
  address?: ICheckoutSessionAddress;
  items: ICheckoutSessionItem[];
  subtotal: number;
  shipping: number;
  total: number;
  status: "active" | "abandoned" | "recovered" | "cancelled";
  lastActivityAt: Date;
  abandonedAt?: Date;
  recoverySentCount: number;
  recoverySentAt?: Date;
  recoveredAt?: Date;
  recoveryToken: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const checkoutSessionItemSchema = new Schema<ICheckoutSessionItem>(
  {
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    qty: { type: Number, required: true, min: 1 },
    name: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    image: { type: String, default: "" },
  },
  { _id: false }
);

const checkoutSessionAddressSchema = new Schema<ICheckoutSessionAddress>(
  {
    name: { type: String, default: "" },
    phone: { type: String, default: "" },
    alternatePhone: { type: String, default: "" },
    line1: { type: String, default: "" },
    line2: { type: String, default: "" },
    city: { type: String, default: "" },
    state: { type: String, default: "" },
    pincode: { type: String, default: "" },
    postOffice: { type: String, default: "" },
  },
  { _id: false }
);

const checkoutSessionSchema = new Schema<ICheckoutSession>(
  {
    sessionId: { type: String, required: true, unique: true, index: true },
    user: { type: Schema.Types.ObjectId, ref: "User", index: true, default: null },
    email: { type: String, trim: true, lowercase: true, index: true, default: "" },
    phone: { type: String, trim: true, default: "" },
    name: { type: String, trim: true, default: "" },
    address: { type: checkoutSessionAddressSchema, default: () => ({}) },
    items: { type: [checkoutSessionItemSchema], default: [] },
    subtotal: { type: Number, default: 0 },
    shipping: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ["active", "abandoned", "recovered", "cancelled"],
      default: "active",
      index: true,
    },
    lastActivityAt: { type: Date, default: Date.now, index: true },
    abandonedAt: { type: Date },
    recoverySentCount: { type: Number, default: 0 },
    recoverySentAt: { type: Date },
    recoveredAt: { type: Date },
    recoveryToken: { type: String, required: true, unique: true, index: true },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

// Compound index for efficient scheduler queries to detect abandoned sessions
checkoutSessionSchema.index({ status: 1, lastActivityAt: 1, recoverySentCount: 1 });

export const CheckoutSession = model<ICheckoutSession>("CheckoutSession", checkoutSessionSchema);
