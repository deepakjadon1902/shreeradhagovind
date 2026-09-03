import { Schema, model } from "mongoose";

const orderItemSchema = new Schema(
  {
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    name: String,
    image: String,
    price: Number,
    qty: { type: Number, required: true, min: 1 },
    hsnCode: { type: String, default: "" },
    gstRate: { type: Number, default: 0 },
    gstInclusive: { type: Boolean, default: true },
    taxableAmount: Number,
    gstAmount: Number,
  },
  { _id: false }
);

const orderSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", index: true },
    customerEmail: { type: String, trim: true, lowercase: true, index: true },
    orderNo: { type: Number, unique: true, sparse: true, index: true },
    trackingId: { type: String, unique: true, sparse: true, index: true },
    courier: {
      type: String,
      enum: ["Ekart", "DTDC", "Shree Maruti", "Shree Murti", "India Post", "Delhivery", "Bluedart", null],
      default: null,
    },
    courierTrackingUrl: { type: String, default: "" },
    items: { type: [orderItemSchema], required: true },
    subtotal: { type: Number, required: true },
    shipping: { type: Number, default: 0 },
    total: { type: Number, required: true },
    alternatePhone: { type: String, default: "" },
    needsGstInvoice: { type: Boolean, default: false },
    businessName: { type: String, default: "", trim: true },
    gstin: { type: String, default: "", trim: true, uppercase: true },
    address: {
      name: String,
      phone: String,
      alternatePhone: { type: String, default: "" },
      line1: String,
      line2: { type: String, default: "" },
      postOffice: { type: String, default: "" },
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
      enum: ["Placed", "Confirmed", "Processing", "Packed", "Shipped", "Out for delivery", "Delivered", "Cancelled"],
      default: "Placed",
      index: true,
    },
  },
  { timestamps: true }
);

export const Order = model("Order", orderSchema);
