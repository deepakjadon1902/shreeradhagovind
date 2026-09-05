import { Schema, model } from "mongoose";

const syncLockSchema = new Schema(
  {
    _id: { type: String, required: true },
    lockedAt: { type: Date, required: true },
    lockedBy: { type: String, required: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: false, versionKey: false }
);

export const SyncLock = model("SyncLock", syncLockSchema);
