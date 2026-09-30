import { Schema, model, type Document, type Types } from "mongoose";

export const SUPPORT_CATEGORIES = [
  "Order Status & Delivery",
  "Product Inquiry & Poshak Sizing",
  "Payment & Billing",
  "Cancellation & Modification",
  "Returns & Replacements",
  "Loyalty & Coupons",
  "General & Seva Query",
] as const;

export type SupportCategory = (typeof SUPPORT_CATEGORIES)[number];

export const SUPPORT_STATUSES = [
  "OPEN",
  "IN_PROGRESS",
  "WAITING_FOR_CUSTOMER",
  "RESOLVED",
  "CLOSED",
] as const;

export type SupportStatus = (typeof SUPPORT_STATUSES)[number];

export const SUPPORT_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;

export type SupportPriority = (typeof SUPPORT_PRIORITIES)[number];

export interface ISupportMessage {
  _id?: Types.ObjectId;
  senderType: "customer" | "admin" | "system";
  senderId?: string | null;
  senderName: string;
  message: string;
  isInternal: boolean;
  createdAt: Date;
}

export interface ISupportTicket extends Document {
  ticketNo: string;
  userId?: Types.ObjectId | null;
  customerEmail: string;
  customerName: string;
  customerPhone?: string;
  orderId?: Types.ObjectId | null;
  orderNo?: number | null;
  category: SupportCategory;
  subject: string;
  status: SupportStatus;
  priority: SupportPriority;
  messages: ISupportMessage[];
  lastCustomerReplyAt?: Date | null;
  lastAdminReplyAt?: Date | null;
  firstResponseAt?: Date | null;
  resolvedAt?: Date | null;
  closedAt?: Date | null;
  autoCloseAt?: Date | null;
  reopenedAt?: Date | null;
  reopenCount: number;
  createdEmailSentAt?: Date | null;
  resolvedEmailSentAt?: Date | null;
  closedEmailSentAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const supportMessageSchema = new Schema<ISupportMessage>(
  {
    senderType: {
      type: String,
      enum: ["customer", "admin", "system"],
      required: true,
    },
    senderId: { type: String, default: null },
    senderName: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true, maxlength: 4000 },
    isInternal: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const supportTicketSchema = new Schema<ISupportTicket>(
  {
    ticketNo: {
      type: String,
      required: true,
      unique: true,
      trim: true,
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
      required: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    customerName: {
      type: String,
      required: true,
      trim: true,
    },
    customerPhone: {
      type: String,
      default: "",
      trim: true,
    },
    orderId: {
      type: Schema.Types.ObjectId,
      ref: "Order",
      default: null,
      index: true,
    },
    orderNo: {
      type: Number,
      default: null,
      index: true,
    },
    category: {
      type: String,
      enum: SUPPORT_CATEGORIES,
      required: true,
      index: true,
    },
    subject: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    status: {
      type: String,
      enum: SUPPORT_STATUSES,
      default: "OPEN",
      index: true,
    },
    priority: {
      type: String,
      enum: SUPPORT_PRIORITIES,
      default: "MEDIUM",
      index: true,
    },
    messages: {
      type: [supportMessageSchema],
      default: [],
    },
    lastCustomerReplyAt: { type: Date, default: Date.now },
    lastAdminReplyAt: { type: Date, default: null },
    firstResponseAt: { type: Date, default: null },
    resolvedAt: { type: Date, default: null },
    closedAt: { type: Date, default: null },
    autoCloseAt: { type: Date, default: null, index: true },
    reopenedAt: { type: Date, default: null },
    reopenCount: { type: Number, default: 0 },
    createdEmailSentAt: { type: Date, default: null },
    resolvedEmailSentAt: { type: Date, default: null },
    closedEmailSentAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Compound indexes for high-frequency queries
supportTicketSchema.index({ customerEmail: 1, status: 1 });
supportTicketSchema.index({ userId: 1, status: 1 });
supportTicketSchema.index({ status: 1, autoCloseAt: 1 });
supportTicketSchema.index({ createdAt: -1 });

export const SupportTicket = model<ISupportTicket>(
  "SupportTicket",
  supportTicketSchema
);
