/**
 * WordPress / WooCommerce importer.
 *
 * Reads a WP eXtended RSS (.xml) export and seeds MongoDB with:
 *   - products  (post_type=product)
 *   - users     (wp:author entries — no passwords; reset required)
 *   - orders    (post_type=shop_order, if present)
 *
 * Product images are re-uploaded to ImageKit so the storefront is
 * self-contained and does not depend on the original WordPress CDN.
 *
 * Usage:
 *   cd backend
 *   npx tsx src/scripts/importWordpress.ts <file1.xml> [file2.xml ...]
 *
 * Env required (read from backend/.env):
 *   MONGODB_URI
 *   IMAGEKIT_PRIVATE_KEY
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { XMLParser } from "fast-xml-parser";
import mongoose from "mongoose";
import { connectDB } from "../config/db";
import { uploadRemoteImageToImageKit } from "../config/imagekit";
import { Product } from "../models/Product";
import { Order } from "../models/Order";
import { User } from "../models/User";

type Postmeta = { "wp:meta_key": string; "wp:meta_value": unknown };
type WpItem = {
  title?: string;
  link?: string;
  "content:encoded"?: string;
  "excerpt:encoded"?: string;
  "wp:post_id"?: number | string;
  "wp:post_type"?: string;
  "wp:status"?: string;
  "wp:post_parent"?: number | string;
  "wp:attachment_url"?: string;
  "wp:post_date"?: string;
  category?: unknown;
  "wp:postmeta"?: Postmeta | Postmeta[];
};

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  cdataPropName: "__cdata",
  parseTagValue: false,
});

// fast-xml-parser will leave CDATA in a `__cdata` field; unwrap recursively.
function unwrap(v: any): any {
  if (v == null) return v;
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v.map(unwrap);
  if (typeof v === "object") {
    if ("__cdata" in v) return v.__cdata;
    const out: any = {};
    for (const [k, val] of Object.entries(v)) out[k] = unwrap(val);
    return out;
  }
  return v;
}

function asArray<T>(v: T | T[] | undefined | null): T[] {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

function metaMap(meta?: Postmeta | Postmeta[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of asArray(meta)) {
    if (!m) continue;
    const k = String((m as any)["wp:meta_key"] ?? "");
    const v = (m as any)["wp:meta_value"];
    out[k] = v == null ? "" : String(v);
  }
  return out;
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#\d+;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function pickCategory(item: WpItem): string {
  const cats = asArray<any>(item.category);
  for (const c of cats) {
    const domain = c?.["@_domain"];
    const nice = c?.["@_nicename"];
    const text = typeof c === "string" ? c : c?.["#text"] ?? c?.__cdata ?? "";
    if (domain === "product_cat" && nice !== "on-sale" && text) {
      return String(text);
    }
  }
  return "General";
}

const imageKitCache = new Map<string, string>();

async function uploadToImageKit(url: string): Promise<string> {
  if (!url) return "";
  if (imageKitCache.has(url)) return imageKitCache.get(url)!;
  try {
    const res = await uploadRemoteImageToImageKit(url);
    imageKitCache.set(url, res.url);
    return res.url;
  } catch (e) {
    console.warn(`  ! ImageKit upload failed for ${url}: ${(e as Error).message}`);
    imageKitCache.set(url, url); // fall back to remote URL
    return url;
  }
}

async function importFile(file: string) {
  console.log(`\n=== Parsing ${file} ===`);
  const xml = fs.readFileSync(file, "utf8");
  const parsed = unwrap(parser.parse(xml));
  const channel = parsed?.rss?.channel ?? {};
  const items: WpItem[] = asArray(channel.item);
  console.log(`Found ${items.length} <item> entries.`);

  // ---------- Users (from wp:author) ----------
  const authors = asArray(channel["wp:author"]);
  let userCount = 0;
  for (const a of authors) {
    const email = String((a as any)["wp:author_email"] ?? "").toLowerCase().trim();
    if (!email) continue;
    const first = String((a as any)["wp:author_first_name"] ?? "");
    const last = String((a as any)["wp:author_last_name"] ?? "");
    const display = String((a as any)["wp:author_display_name"] ?? "");
    const name = [first, last].filter(Boolean).join(" ").trim() || display || email.split("@")[0];
    const res = await User.updateOne(
      { email },
      {
        $setOnInsert: {
          email,
          name,
          passwordHash: "",
          role: "user",
          provider: "password",
          isBlocked: false,
        },
      },
      { upsert: true }
    );
    if (res.upsertedCount) userCount++;
  }
  console.log(`Users: ${userCount} new (existing skipped).`);

  // ---------- Attachments → URL map (post_id → image url) ----------
  const attachmentUrl = new Map<string, string>();
  for (const it of items) {
    if (it["wp:post_type"] === "attachment") {
      const id = String(it["wp:post_id"] ?? "");
      const url = String(it["wp:attachment_url"] ?? "");
      if (id && url) attachmentUrl.set(id, url);
    }
  }
  console.log(`Attachments indexed: ${attachmentUrl.size}`);

  // ---------- Products ----------
  let productNew = 0;
  let productSkip = 0;
  for (const it of items) {
    if (it["wp:post_type"] !== "product") continue;
    if (it["wp:status"] !== "publish") continue;

    const name = String(it.title ?? "").trim();
    if (!name) continue;

    const meta = metaMap(it["wp:postmeta"]);
    const regular = parseFloat(meta._regular_price || "0");
    const sale = parseFloat(meta._sale_price || "0");
    const price = sale > 0 ? sale : regular;
    const mrp = regular > 0 ? regular : price;
    if (!price) {
      productSkip++;
      continue;
    }

    const stockStatus = meta._stock_status || "instock";
    const stockNum = parseInt(meta._stock || "0", 10);
    const stock = stockStatus === "instock" ? (stockNum > 0 ? stockNum : 50) : 0;
    const rating = parseFloat(meta._wc_average_rating || "0") || 4.7;
    const reviews = parseInt(meta._wc_review_count || "0", 10) || 0;

    const category = pickCategory(it);
    const description =
      stripHtml(String(it["excerpt:encoded"] ?? "")) ||
      stripHtml(String(it["content:encoded"] ?? "")).slice(0, 800);

    // Check existing first (cheap dedup)
    const existing = await Product.findOne({ name }).select("_id");
    if (existing) {
      productSkip++;
      continue;
    }

    // Resolve images
    const thumbId = meta._thumbnail_id;
    const galleryIds = (meta._product_image_gallery || "").split(",").map((s) => s.trim()).filter(Boolean);
    const imageUrls: string[] = [];
    if (thumbId && attachmentUrl.has(thumbId)) imageUrls.push(attachmentUrl.get(thumbId)!);
    for (const gid of galleryIds) if (attachmentUrl.has(gid)) imageUrls.push(attachmentUrl.get(gid)!);

    const uploaded: string[] = [];
    for (const url of imageUrls) {
      const cdn = await uploadToImageKit(url);
      if (cdn && !uploaded.includes(cdn)) uploaded.push(cdn);
    }
    const image = uploaded[0] || "";

    await Product.create({
      name,
      description,
      price,
      mrp,
      image,
      images: uploaded,
      category,
      stock,
      rating,
      reviews,
      details: [],
      isActive: true,
    });
    productNew++;
    process.stdout.write(`  + ${name.slice(0, 60)}\n`);
  }
  console.log(`Products: ${productNew} new, ${productSkip} skipped (existing or no price).`);

  // ---------- Orders (shop_order) ----------
  let orderNew = 0;
  for (const it of items) {
    if (it["wp:post_type"] !== "shop_order") continue;
    const meta = metaMap(it["wp:postmeta"]);
    const total = parseFloat(meta._order_total || "0");
    const email = String(meta._billing_email || "").toLowerCase().trim();
    if (!email || !total) continue;
    const user = await User.findOne({ email }).select("_id");
    if (!user) continue;
    const wpOrderId = String(it["wp:post_id"] ?? "");
    const trackingId = `WP-${wpOrderId}`;
    const exists = await Order.findOne({ trackingId }).select("_id");
    if (exists) continue;
    const subtotal = total - parseFloat(meta._order_shipping || "0");
    await Order.create({
      user: user._id,
      trackingId,
      items: [
        {
          productId: new mongoose.Types.ObjectId(),
          name: "Legacy order (imported)",
          image: "",
          price: total,
          qty: 1,
        },
      ],
      subtotal: subtotal > 0 ? subtotal : total,
      shipping: parseFloat(meta._order_shipping || "0"),
      total,
      address: {
        name: `${meta._billing_first_name || ""} ${meta._billing_last_name || ""}`.trim(),
        phone: meta._billing_phone || "",
        line1: meta._billing_address_1 || "",
        city: meta._billing_city || "",
        state: meta._billing_state || "",
        pincode: meta._billing_postcode || "",
      },
      payment: {
        method: "razorpay",
        status: "paid",
      },
      status: "Delivered",
    });
    orderNew++;
  }
  if (orderNew) console.log(`Orders: ${orderNew} imported.`);
}

async function main() {
  const files = process.argv.slice(2);
  if (!files.length) {
    console.error("Usage: tsx src/scripts/importWordpress.ts <xml-file> [more...]");
    process.exit(1);
  }
  for (const f of files) {
    if (!fs.existsSync(f)) {
      console.error(`File not found: ${path.resolve(f)}`);
      process.exit(1);
    }
  }
  await connectDB();
  for (const f of files) await importFile(f);
  console.log("\nDone. Disconnecting…");
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error("Import failed:", e);
  process.exit(1);
});
