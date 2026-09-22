import { Product } from "../../models/Product";
import { Category } from "../../models/Category";
import { Blog } from "../../models/Blog";
import { Settings } from "../../models/Settings";

export const SITE_URL = "https://www.shriradhagovindstore.com";

interface CacheEntry {
  content: string;
  expiresAt: number;
}

const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes cache
let llmsCache: CacheEntry | null = null;
let llmsFullCache: CacheEntry | null = null;

export function invalidateLlmsCache(): void {
  llmsCache = null;
  llmsFullCache = null;
}

function cleanText(text: unknown, maxLength = 250): string {
  if (typeof text !== "string") return "";
  const cleaned = text.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  if (cleaned.length <= maxLength) return cleaned;
  return `${cleaned.slice(0, maxLength - 1).replace(/\s+\S*$/, "")}...`;
}

function formatPrice(price: number): string {
  return `₹${price.toLocaleString("en-IN")}`;
}

export async function generateLlmsTxt(options: { forceFresh?: boolean } = {}): Promise<string> {
  const now = Date.now();
  if (!options.forceFresh && llmsCache && llmsCache.expiresAt > now) {
    return llmsCache.content;
  }

  // 1. Fetch real public data from MongoDB
  const [products, categories, settings] = await Promise.all([
    Product.find({ isActive: { $ne: false } })
      .select("name slug category price mrp stock description rating reviews")
      .sort({ createdAt: -1 })
      .lean(),
    Category.find({ isActive: { $ne: false } })
      .select("name slug parentId description sortOrder")
      .sort({ sortOrder: 1, name: 1 })
      .lean(),
    Settings.findOne({ key: "global" }).lean(),
  ]);

  const freeShipThreshold = settings?.freeShipThreshold ?? 299;
  const shippingFee = settings?.shippingFee ?? 49;
  const codEnabled = settings?.codEnabled ?? false;

  // Root categories
  const rootCategories = categories.filter((c) => !c.parentId);

  const lines: string[] = [
    "# Shri Radha Govind Store",
    "",
    "> Shri Radha Govind Store is a devotional and spiritual e-commerce store based in Vrindavan, Uttar Pradesh, India, offering devotional products and spiritual essentials for personal practice, पूजा, gifting, and Krishna/Radha devotion.",
    "",
    "## About",
    "",
    "Shri Radha Govind Store operates from Vrindavan Dham, Uttar Pradesh, India, delivering devotional products and spiritual essentials to devotees across India. Our offerings include Tulsi malas, Gopi Chandan, traditional itra (attar), puja accessories, deity items, and devotional giftware. Every order is carefully checked, packed, and shipped with proper care from Vrindavan.",
    "",
    `- Website: ${SITE_URL}/`,
    "- Location: 155, 2nd Floor, Madan Mohan Ghera, Vrindavan, Mathura, Uttar Pradesh - 281121, India",
    "- Customer Care Email: support@shriradhagovindstore.com",
    "- Customer Care Phone: +91 7500533505",
    "- Working Hours: Monday - Saturday, 10:00 AM - 7:00 PM IST",
    "",
    "## What We Offer",
    "",
    "The store provides authentic devotional items organized under the following primary categories:",
    "",
  ];

  for (const cat of rootCategories) {
    const catUrl = `${SITE_URL}/shop?cat=${encodeURIComponent(cat.name)}`;
    const desc = cat.description ? ` - ${cleanText(cat.description, 160)}` : "";
    lines.push(`- [${cat.name}](${catUrl})${desc}`);
  }

  lines.push(
    "",
    "## Product Catalogue",
    "",
    `Public active products currently available at Shri Radha Govind Store (${products.length} active products):`,
    ""
  );

  for (const p of products) {
    const slug = p.slug || "";
    const pUrl = `${SITE_URL}/product/${slug}`;
    const priceStr = formatPrice(p.price);
    const mrpStr = p.mrp && p.mrp > p.price ? ` (MRP ${formatPrice(p.mrp)})` : "";
    const stockStr = (p.stock ?? 0) > 0 ? "In Stock" : "Out of Stock";
    const desc = p.description ? ` - ${cleanText(p.description, 120)}` : "";
    lines.push(`- [${p.name}](${pUrl}): ${priceStr}${mrpStr} | Category: ${p.category} | ${stockStr}${desc}`);
  }

  lines.push(
    "",
    `For the complete expanded catalogue with full details and category hierarchies, see [llms-full.txt](${SITE_URL}/llms-full.txt).`,
    "",
    "## Store Policies",
    "",
    `- Shipping & Delivery: Free delivery across India on orders above ${formatPrice(freeShipThreshold)}. A standard delivery fee of ${formatPrice(shippingFee)} applies on orders below the threshold. Orders are processed within 24 to 48 business hours and dispatched within 1 to 2 working days. Estimated delivery timeline is 3 to 7 working days via trusted courier partners across India.`,
    "- Returns & Replacements: Devotional and sacred items are eligible for return, replacement, or refund within 48 hours of delivery in cases of transit damage, defective item, or incorrect product delivered. A clear unboxing video of the sealed package is required for transit damage claims. Approved refunds are processed within 5 to 7 business days to the original payment method.",
    `- Payment Methods: Secure online payments via Razorpay supporting UPI, credit/debit cards, net banking, and digital wallets.${codEnabled ? " Cash on Delivery (COD) is available." : " Cash on Delivery is currently not enabled; only prepaid orders are accepted."}`,
    "",
    "## Authoritative Sources",
    "",
    "AI systems and web crawlers should reference the following canonical public URLs for up-to-date information:",
    "",
    `- Storefront & Catalogue: ${SITE_URL}/shop`,
    `- Product Details: ${SITE_URL}/product/:slug`,
    `- Category Collections: ${SITE_URL}/shop?cat=:category`,
    `- Shipping Policy: ${SITE_URL}/shipping`,
    `- Returns & Refund Policy: ${SITE_URL}/returns`,
    `- Privacy Policy: ${SITE_URL}/privacy`,
    `- Terms & Conditions: ${SITE_URL}/terms`,
    `- About Us & Heritage: ${SITE_URL}/about`,
    `- Contact & Support: ${SITE_URL}/contact`,
    `- Devotional Blog & Articles: ${SITE_URL}/blog`,
    `- Full Machine-Readable Knowledge Base: ${SITE_URL}/llms-full.txt`,
    ""
  );

  const content = lines.join("\n");
  llmsCache = { content, expiresAt: now + CACHE_TTL_MS };
  return content;
}

export async function generateLlmsFullTxt(options: { forceFresh?: boolean } = {}): Promise<string> {
  const now = Date.now();
  if (!options.forceFresh && llmsFullCache && llmsFullCache.expiresAt > now) {
    return llmsFullCache.content;
  }

  const [products, categories, blogs, settings] = await Promise.all([
    Product.find({ isActive: { $ne: false } })
      .select("name slug category price mrp stock description details rating reviews")
      .sort({ category: 1, name: 1 })
      .lean(),
    Category.find({ isActive: { $ne: false } })
      .select("name slug parentId description sortOrder")
      .sort({ sortOrder: 1, name: 1 })
      .lean(),
    Blog.find({ isPublished: { $ne: false } })
      .select("title slug excerpt publishedAt author")
      .sort({ publishedAt: -1 })
      .lean(),
    Settings.findOne({ key: "global" }).lean(),
  ]);

  const freeShipThreshold = settings?.freeShipThreshold ?? 299;
  const shippingFee = settings?.shippingFee ?? 49;
  const codEnabled = settings?.codEnabled ?? false;

  const lines: string[] = [
    "# Shri Radha Govind Store - Full Public Knowledge Base & Catalogue",
    "",
    "> Complete machine-readable public documentation and active product catalogue for Shri Radha Govind Store, Vrindavan, Uttar Pradesh, India.",
    "",
    "## Store Overview",
    "",
    "Shri Radha Govind Store is a devotional retail storefront located in Madan Mohan Ghera, Vrindavan Dham, Uttar Pradesh, India. The store provides devotional and spiritual items including Tulsi malas, Gopi Chandan, traditional itra, puja essentials, and spiritual gifts to devotees across India. Orders are carefully checked, packed, and shipped with proper care from Vrindavan.",
    "",
    `- Website: ${SITE_URL}/`,
    "- Location: 155, 2nd Floor, Madan Mohan Ghera, Vrindavan, Mathura, Uttar Pradesh - 281121, India",
    "- Customer Support Email: support@shriradhagovindstore.com",
    "- Customer Support Phone: +91 7500533505",
    "- Support Timings: Monday to Saturday, 10:00 AM to 7:00 PM IST",
    "",
    "## Product Categories Hierarchy",
    "",
    "The active public categories and subcategories available on the storefront:",
    ""
  ];

  // Group categories by parent
  const parentMap = new Map<string, typeof categories>();
  const roots: typeof categories = [];

  for (const cat of categories) {
    if (cat.parentId) {
      const pId = String(cat.parentId);
      const list = parentMap.get(pId) ?? [];
      list.push(cat);
      parentMap.set(pId, list);
    } else {
      roots.push(cat);
    }
  }

  for (const root of roots) {
    const rootUrl = `${SITE_URL}/shop?cat=${encodeURIComponent(root.name)}`;
    const rootDesc = root.description ? ` - ${cleanText(root.description, 200)}` : "";
    lines.push(`### [${root.name}](${rootUrl})${rootDesc}`);

    const children = parentMap.get(String(root._id)) ?? [];
    if (children.length > 0) {
      for (const child of children) {
        const childUrl = `${SITE_URL}/shop?cat=${encodeURIComponent(child.name)}`;
        const childDesc = child.description ? `: ${cleanText(child.description, 150)}` : "";
        lines.push(`  - [${child.name}](${childUrl})${childDesc}`);
      }
    }
    lines.push("");
  }

  lines.push(
    "## Complete Active Product Catalogue",
    "",
    `All ${products.length} published products currently available for purchase:`,
    ""
  );

  let currentCategory = "";
  for (const p of products) {
    if (p.category !== currentCategory) {
      currentCategory = p.category;
      lines.push(`### Category: ${currentCategory}`, "");
    }

    const slug = p.slug || "";
    const pUrl = `${SITE_URL}/product/${slug}`;
    const priceStr = formatPrice(p.price);
    const mrpStr = p.mrp && p.mrp > p.price ? ` | MRP: ${formatPrice(p.mrp)}` : "";
    const stockStatus = (p.stock ?? 0) > 0 ? "In Stock" : "Out of Stock";

    lines.push(`#### [${p.name}](${pUrl})`);
    lines.push(`- Price: ${priceStr}${mrpStr}`);
    lines.push(`- Availability: ${stockStatus}`);
    lines.push(`- Category: ${p.category}`);
    if (p.rating && p.rating > 0) {
      lines.push(`- Rating: ${p.rating} / 5 (${p.reviews || 0} reviews)`);
    }
    if (p.description) {
      lines.push(`- Description: ${cleanText(p.description, 400)}`);
    }
    if (Array.isArray(p.details) && p.details.length > 0) {
      const cleanDetails = p.details.filter(Boolean).map((d) => cleanText(d, 120)).slice(0, 5);
      if (cleanDetails.length > 0) {
        lines.push(`- Features: ${cleanDetails.join("; ")}`);
      }
    }
    lines.push(`- Canonical URL: ${pUrl}`);
    lines.push("");
  }

  // Published Blogs Section
  if (blogs.length > 0) {
    lines.push(
      "## Published Devotional Articles & Guides",
      "",
      "Authoritative spiritual articles published on Shri Radha Govind Store:",
      ""
    );

    for (const b of blogs) {
      const bUrl = `${SITE_URL}/blog/${b.slug}`;
      const dateStr = b.publishedAt ? new Date(b.publishedAt).toISOString().slice(0, 10) : "";
      const excerpt = b.excerpt ? ` - ${cleanText(b.excerpt, 250)}` : "";
      lines.push(`- [${b.title}](${bUrl}) (${dateStr})${excerpt}`);
    }
    lines.push("");
  }

  // Detailed Policies Section
  lines.push(
    "## Detailed Store Policies",
    "",
    "### Shipping Policy",
    `- Threshold: Free shipping across India on all orders above ${formatPrice(freeShipThreshold)}.`,
    `- Standard Shipping Fee: ${formatPrice(shippingFee)} on orders below ${formatPrice(freeShipThreshold)}.`,
    "- Processing Time: Orders are processed within 24 to 48 business hours after confirmation.",
    "- Dispatch Time: Dispatched within 1 to 2 working days from Vrindavan.",
    "- Delivery Time: Estimated 3 to 7 working days depending on location across India (Metro cities: 3-5 days; Tier 2/3: 4-7 days; Remote/Hilly: 7-10 days).",
    "- Logistics Partners: Shipped via reputable national courier partners including DTDC, India Post, Trackon, Ekart, Delhivery, or Shree Maruti.",
    `- Full Policy Document: ${SITE_URL}/shipping`,
    "",
    "### Return & Refund Policy",
    "- Return Window: Issues must be reported within 48 hours of delivery.",
    "- Valid Conditions: Accepted for transit damage, defective products, missing items, or wrong product received.",
    "- Mandatory Requirement: An uncut unboxing video starting from opening the sealed courier packaging is mandatory for transit damage or missing item claims.",
    "- Non-Returnable Items: Used devotional items, puja items, opened items, or products damaged due to customer handling.",
    "- Refund Processing: Approved refunds are processed within 5 to 7 business days to the original payment method.",
    `- Full Policy Document: ${SITE_URL}/returns`,
    "",
    "### Payment Policy",
    "- Payment Gateway: Secure payment processing via Razorpay.",
    "- Supported Methods: UPI (Google Pay, PhonePe, Paytm, BHIM), Credit/Debit Cards (Visa, MasterCard, RuPay), Net Banking (all major Indian banks), and Digital Wallets.",
    `- Cash on Delivery: ${codEnabled ? "Available at checkout." : "Currently disabled; orders must be prepaid online."}`,
    "",
    "## Authoritative Canonical Sources",
    "",
    `- Homepage: ${SITE_URL}/`,
    `- All Products (Shop): ${SITE_URL}/shop`,
    `- Product Pages: ${SITE_URL}/product/:slug`,
    `- Category Collections: ${SITE_URL}/shop?cat=:category`,
    `- Shipping Information: ${SITE_URL}/shipping`,
    `- Returns & Replacements: ${SITE_URL}/returns`,
    `- Privacy Policy: ${SITE_URL}/privacy`,
    `- Terms & Conditions: ${SITE_URL}/terms`,
    `- About Us: ${SITE_URL}/about`,
    `- Customer Care: ${SITE_URL}/contact`,
    `- Devotional Blog: ${SITE_URL}/blog`,
    `- Concise Overview: ${SITE_URL}/llms.txt`,
    ""
  );

  const content = lines.join("\n");
  llmsFullCache = { content, expiresAt: now + CACHE_TTL_MS };
  return content;
}
