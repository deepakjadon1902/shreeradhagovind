import mongoose from "mongoose";
import { env } from "./env";

export async function connectDB() {
  mongoose.set("strictQuery", true);
  await mongoose.connect(env.MONGODB_URI);
  // eslint-disable-next-line no-console
  console.log("[db] connected");
}
