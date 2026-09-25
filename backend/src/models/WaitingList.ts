import { Schema, model, type Document, type Types } from "mongoose";

export interface IWaitingList extends Document {
  productId: Types.ObjectId;
  user?: Types.ObjectId | null;
  email: string;
  phone?: string;
  status: "waiting" | "notified" | "cancelled";
  notifiedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const waitingListSchema = new Schema<IWaitingList>(
  {
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true, index: true },
    user: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
    email: { type: String, required: true, trim: true, lowercase: true, index: true },
    phone: { type: String, default: "", trim: true },
    status: {
      type: String,
      enum: ["waiting", "notified", "cancelled"],
      default: "waiting",
      index: true,
    },
    notifiedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

waitingListSchema.index(
  { productId: 1, email: 1, status: 1 },
  { name: "uniq_waitlist_product_email_status", unique: true }
);

export const WaitingList = model<IWaitingList>("WaitingList", waitingListSchema);
