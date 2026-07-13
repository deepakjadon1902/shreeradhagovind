import { Schema, model } from "mongoose";

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const productSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, unique: true, sparse: true, lowercase: true, trim: true, index: true },
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

productSchema.pre("validate", function (next) {
  if (!this.slug && this.name) {
    this.slug = slugify(this.name);
  }
  next();
});

export const Product = model("Product", productSchema);
