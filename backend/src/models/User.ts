import { Schema, model, type InferSchemaType } from "mongoose";

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, index: true },
    passwordHash: { type: String, default: "" },
    role: { type: String, enum: ["user", "admin"], default: "user", index: true },
    provider: { type: String, enum: ["password", "google"], default: "password" },
    avatar: { type: String, default: "" },
    phone: { type: String, default: "" },
    address: {
      line1: { type: String, default: "" },
      city: { type: String, default: "" },
      state: { type: String, default: "" },
      pincode: { type: String, default: "" },
    },
    isBlocked: { type: Boolean, default: false, index: true },
    lastLoginAt: { type: Date, default: null },
    resetOtpHash: { type: String, default: "" },
    resetOtpExpiresAt: { type: Date, default: null },
    resetOtpVerifiedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export type UserDoc = InferSchemaType<typeof userSchema> & { _id: string };
export const User = model("User", userSchema);
