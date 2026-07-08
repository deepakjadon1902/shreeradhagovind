import { Schema, model } from "mongoose";

const productSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    price: { type: Number, required: true, min: 0 },
    mrp: { type: Number, default: 0, min: 0 },
    image: { type: String, default: "" },
    images: { type: [String], default: [] },
    featuredDeal: { type: Boolean, default: false, index: true },
    category: { type: String, required: true, index: true },
    stock: { type: Number, default: 100, min: 0 },
    rating: { type: Number, default: 4.7, min: 0, max: 5 },
    reviews: { type: Number, default: 0, min: 0 },
    details: { type: [String], default: [] },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const Product = model("Product", productSchema);
