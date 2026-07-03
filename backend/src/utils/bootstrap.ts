import bcrypt from "bcryptjs";
import { env } from "../config/env";
import { User } from "../models/User";
import { Settings } from "../models/Settings";
import { Category } from "../models/Category";

export async function ensureBootstrapAdmin() {
  if (env.ADMIN_EMAIL && env.ADMIN_PASSWORD) {
    const existing = await User.findOne({ email: env.ADMIN_EMAIL.toLowerCase() });
    if (!existing) {
      const passwordHash = await bcrypt.hash(env.ADMIN_PASSWORD, 10);
      await User.create({
        name: env.ADMIN_NAME,
        email: env.ADMIN_EMAIL.toLowerCase(),
        passwordHash,
        role: "admin",
      });
      // eslint-disable-next-line no-console
      console.log(`[bootstrap] admin created: ${env.ADMIN_EMAIL}`);
    } else {
      let changed = false;
      if (existing.role !== "admin") {
        existing.role = "admin";
        changed = true;
      }
      if (!existing.passwordHash || !(await bcrypt.compare(env.ADMIN_PASSWORD, existing.passwordHash))) {
        existing.passwordHash = await bcrypt.hash(env.ADMIN_PASSWORD, 10);
        changed = true;
      }
      if (existing.isBlocked) {
        existing.isBlocked = false;
        changed = true;
      }
      if (changed) await existing.save();
    }
  }

  if (!(await Settings.findOne({ key: "global" }))) {
    await Settings.create({ key: "global" });
  }

  const categoryTree = [
    ["Tulsi Mala", ["Japa Mala", "Kanthi Mala", "Tulsi Bracelet"]],
    ["Puja Essentials", ["Chandan & Tilak", "Kapoor", "Puja Accessories"]],
    ["Itra & Fragrance", ["Rose Itra", "Sandalwood Itra", "Other Itra"]],
    ["Jewellery", ["Bracelets", "Pendants", "Necklaces"]],
    ["Gifts & Toys", ["Radha Krishna Dolls", "Keychains", "Gift Items"]],
    ["Temple Collection", ["Braj Raj", "Temple Prasad", "Holy Water"]],
    ["Festival Collection", ["Janmashtami", "Radhashtami", "Diwali", "Holi"]],
    ["Combo Packs", ["Tulsi Combos", "Gift Combos"]],
  ] as const;
  const slugify = (value: string) => value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  for (const [parentOrder, [parentName, children]] of categoryTree.entries()) {
    const parent = await Category.findOneAndUpdate(
      { slug: slugify(parentName) },
      { $set: { name: parentName, parentId: null, sortOrder: parentOrder }, $setOnInsert: { description: `${parentName} collection from Shri Radha Govind Store.`, metaTitle: `${parentName} | Shri Radha Govind Store`, metaDescription: `Shop ${parentName} at Shri Radha Govind Store.`, isActive: true } },
      { new: true, upsert: true }
    );
    for (const [sortOrder, childName] of children.entries()) {
      await Category.findOneAndUpdate(
        { slug: slugify(childName) },
        { $set: { name: childName, parentId: parent._id, sortOrder }, $setOnInsert: { description: `${childName} products for devotees.`, metaTitle: `${childName} | Shri Radha Govind Store`, metaDescription: `Shop ${childName} at Shri Radha Govind Store.`, isActive: true } },
        { upsert: true }
      );
    }
  }
}
