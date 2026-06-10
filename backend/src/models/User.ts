import { Schema, model, type InferSchemaType } from "mongoose";

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, index: true },
    passwordHash: { type: String, default: "" },
    role: { type: String, enum: ["user", "admin"], default: "user", index: true },
    provider: { type: String, enum: ["password", "google"], default: "password" },
    avatar: { type: String, default: "" },
  },
  { timestamps: true }
);

export type UserDoc = InferSchemaType<typeof userSchema> & { _id: string };
export const User = model("User", userSchema);
