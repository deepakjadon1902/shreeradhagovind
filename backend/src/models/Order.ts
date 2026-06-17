import { Schema, model } from "mongoose";

const orderItemSchema = new Schema(
  {
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    name: String,
    image: String,
    price: Number,
    qty: { type: Number, required: true, min: 1 },
  },
  { _id: false }
);

const orderSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    trackingId: { type: String, unique: true, sparse: true, index: true },
    courier: {
      type: String,
      enum: ["Ekart", "DTDC", "Shree Murti", "India Post", "Delhivery", "Bluedart", null],
      default: null,
    },
    courierTrackingUrl: { type: String, default: "" },
    items: { type: [orderItemSchema], required: true },
    subtotal: { type: Number, required: true },
    shipping: { type: Number, default: 0 },
    total: { type: Number, required: true },
    address: {
      name: String,
      phone: String,
      line1: String,
      city: String,
      state: String,
      pincode: String,
    },
    payment: {
      method: { type: String, enum: ["razorpay", "cod"], required: true },
      status: { type: String, enum: ["pending", "paid", "failed", "refunded"], default: "pending" },
      razorpayOrderId: String,
      razorpayPaymentId: String,
      razorpaySignature: String,
      failureReason: String,
    },
    status: {
      type: String,
      enum: ["Placed", "Packed", "Shipped", "Out for delivery", "Delivered", "Cancelled"],
      default: "Placed",
      index: true,
    },
  },
  { timestamps: true }
);

export const Order = model("Order", orderSchema);
