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

  if ((await Category.countDocuments()) === 0) {
    await Category.insertMany([
      { name: "Deities", slug: "deities", sortOrder: 1 },
      { name: "Pooja Items", slug: "pooja-items", sortOrder: 2 },
      { name: "Incense", slug: "incense", sortOrder: 3 },
      { name: "Apparel", slug: "apparel", sortOrder: 4 },
      { name: "Books", slug: "books", sortOrder: 5 },
    ]);
  }
}
