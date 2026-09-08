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
    costPrice: { type: Number, min: 0 },
    taxableAmount: Number,
    gstAmount: Number,
    comboComponents: [
      {
        name: String,
        qty: Number,
        hsnCode: String,
        gstRate: Number,
        gstInclusive: Boolean,
        costPrice: { type: Number, min: 0 },
        baseValue: Number,
        allocatedTaxableValue: Number,
        gstAmount: Number,
        cgst: Number,
        sgst: Number,
        igst: Number,
      },
    ],
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
    billingAddress: {
      name: { type: String, default: "" },
      line1: { type: String, default: "" },
      line2: { type: String, default: "" },
      postOffice: { type: String, default: "" },
      city: { type: String, default: "" },
      state: { type: String, default: "" },
      pincode: { type: String, default: "" },
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
      enum: [
        "Placed",
        "Confirmed",
        "Processing",
        "Hold",
        "Packed",
        "Shipped",
        "Out for delivery",
        "Delivered",
        "Cancelled",
      ],
      default: "Placed",
      index: true,
    },
    holdReason: { type: String, default: "" },
    holdAt: { type: Date },
    invoiceSentAt: { type: Date, default: null },
    invoiceLockUntil: { type: Date, default: null },
    courierCharge: { type: Number, default: 0, min: 0 },
    packagingCost: { type: Number, min: 0 },
    razorpayFee: { type: Number, min: 0 },
    productCost: { type: Number, min: 0 },
    totalExpense: { type: Number, min: 0 },
    netProfit: { type: Number },
    guestAccessToken: { type: String, sparse: true, index: true },
    courierTrackingData: { type: Schema.Types.Mixed, default: null },
    courierTrackingLastFetchedAt: { type: Date },
    statusHistory: [
      {
        status: { type: String, required: true },
        changedAt: { type: Date, default: Date.now },
        changedBy: { type: String, default: "system" },
        note: { type: String, default: "" },
        holdReason: { type: String, default: "" },
      },
    ],
  },
  { timestamps: true }
);

orderSchema.index({ "payment.razorpayOrderId": 1 }, { sparse: true });
orderSchema.index({ "payment.razorpayPaymentId": 1 }, { sparse: true });

export const Order = model("Order", orderSchema);
