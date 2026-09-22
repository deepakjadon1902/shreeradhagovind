import { Product } from "../../models/Product";
import { Category } from "../../models/Category";
import { Settings } from "../../models/Settings";
import {
  SafeProductSummary,
  SafeProductDetail,
  SafeCategory,
  SafeStockInfo,
  StorePolicyInfo,
} from "./ai.types";

function escapeRegex(text: string): string {
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
}

export interface SearchProductsParams {
  query?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  limit?: number;
}

/**
 * Searches storefront products safely without exposing any internal database fields.
 * Only returns active/published products.
 */
export async function searchProducts(
  params: SearchProductsParams
): Promise<SafeProductSummary[]> {
  const filter: Record<string, any> = {
    isActive: { $ne: false },
  };

  if (params.category && params.category.trim()) {
    const cleanCat = params.category.trim();
    filter.category = new RegExp(`^${escapeRegex(cleanCat)}$`, "i");
  }

  if (
    (typeof params.minPrice === "number" && !isNaN(params.minPrice)) ||
    (typeof params.maxPrice === "number" && !isNaN(params.maxPrice))
  ) {
    filter.price = {};
    if (typeof params.minPrice === "number" && !isNaN(params.minPrice) && params.minPrice >= 0) {
      filter.price.$gte = params.minPrice;
    }
    if (typeof params.maxPrice === "number" && !isNaN(params.maxPrice) && params.maxPrice > 0) {
      filter.price.$lte = params.maxPrice;
    }
  }

  if (params.query && params.query.trim()) {
    const cleanQuery = params.query.trim();
    const regex = new RegExp(escapeRegex(cleanQuery), "i");
    filter.$or = [
      { name: regex },
      { description: regex },
      { category: regex },
    ];
  }

  const maxLimit = Math.min(Math.max(Number(params.limit || 8), 1), 12);

  const docs = await Product.find(filter)
    .sort({ featuredDeal: -1, stock: -1, rating: -1, createdAt: -1 })
    .limit(maxLimit)
    .select("name slug price mrp image description stock category")
    .lean();

  return docs.map((p: any) => ({
    name: String(p.name || ""),
    slug: String(p.slug || ""),
    price: Number(p.price || 0),
    mrp: p.mrp && p.mrp > p.price ? Number(p.mrp) : undefined,
    image: String(p.image || ""),
    shortDescription: p.description ? String(p.description).slice(0, 160).trim() : undefined,
    available: Number(p.stock ?? 0) > 0,
    category: String(p.category || ""),
  }));
}

/**
 * Retrieves detailed customer-facing product information by slug or name.
 */
export async function getProduct(
  idOrSlug: string
): Promise<SafeProductDetail | null> {
  if (!idOrSlug || !idOrSlug.trim()) return null;
  const cleanId = idOrSlug.trim();

  const doc: any = await Product.findOne({
    isActive: { $ne: false },
    $or: [
      { slug: cleanId.toLowerCase() },
      { name: new RegExp(`^${escapeRegex(cleanId)}$`, "i") },
      { name: new RegExp(escapeRegex(cleanId), "i") },
    ],
  })
    .select("name slug description price mrp stock category details image")
    .lean();

  if (!doc) return null;

  const stockNum = Number(doc.stock ?? 0);
  return {
    name: String(doc.name || ""),
    slug: String(doc.slug || ""),
    description: String(doc.description || ""),
    price: Number(doc.price || 0),
    mrp: Number(doc.mrp || 0),
    available: stockNum > 0,
    stockStatus: stockNum > 0 ? "In Stock" : "Currently Out of Stock",
    category: String(doc.category || ""),
    details: Array.isArray(doc.details) ? doc.details.map(String) : [],
    image: String(doc.image || ""),
  };
}

/**
 * Returns active storefront categories.
 */
export async function getCategories(): Promise<SafeCategory[]> {
  const docs = await Category.find({ isActive: { $ne: false } })
    .sort({ sortOrder: 1, name: 1 })
    .select("name slug description")
    .lean();

  if (docs.length > 0) {
    return docs.map((c: any) => ({
      name: String(c.name || ""),
      slug: String(c.slug || ""),
      description: c.description ? String(c.description) : undefined,
    }));
  }

  // Fallback to distinct categories in active products if Category collection is sparse
  const distinct = await Product.distinct("category", { isActive: { $ne: false } });
  return distinct.filter(Boolean).map((catName) => ({
    name: String(catName),
    slug: String(catName).toLowerCase().replace(/[^a-z0-9]+/g, "-"),
  }));
}

/**
 * Checks stock availability for an approved product identifier.
 */
export async function checkStock(
  idOrSlug: string
): Promise<SafeStockInfo | null> {
  if (!idOrSlug || !idOrSlug.trim()) return null;
  const cleanId = idOrSlug.trim();

  const doc: any = await Product.findOne({
    isActive: { $ne: false },
    $or: [
      { slug: cleanId.toLowerCase() },
      { name: new RegExp(`^${escapeRegex(cleanId)}$`, "i") },
      { name: new RegExp(escapeRegex(cleanId), "i") },
    ],
  })
    .select("name slug stock price")
    .lean();

  if (!doc) return null;

  const stockNum = Number(doc.stock ?? 0);
  return {
    name: String(doc.name || ""),
    slug: String(doc.slug || ""),
    available: stockNum > 0,
    stockStatus: stockNum > 0 ? "Available in stock" : "Currently out of stock",
    price: Number(doc.price || 0),
  };
}

/**
 * Fetches accurate store policy and contact information based on real settings and terms.
 */
export async function getStorePolicy(
  policyType: "shipping" | "returns" | "privacy" | "terms" | "contact"
): Promise<StorePolicyInfo> {
  const settings = (await Settings.findOne({ key: "global" }).lean()) as any;
  const freeShip = settings?.freeShipThreshold ?? 999;
  const shipFee = settings?.shippingFee ?? 49;
  const codAvailable = settings?.codEnabled ?? true;
  const storeEmail = settings?.email || "support@shreeradhagovind.com";

  switch (policyType) {
    case "shipping":
      return {
        policyType: "shipping",
        title: "Shipping & Delivery Policy",
        summary: `Orders are dispatched from holy Vrindavan Dham within 1 to 2 business days. Delivery across India typically takes 3 to 7 business days.`,
        details: [
          `Free shipping on orders over ₹${freeShip}.`,
          `Standard delivery fee is ₹${shipFee} for orders below ₹${freeShip}.`,
          `Cash on Delivery (COD) is ${codAvailable ? "available for eligible pincodes" : "currently unavailable"}.`,
          `Delivered via trusted partners including DTDC, India Post, Delhivery, and Shree Maruti.`,
          `Tracking details are shared via email, SMS, and WhatsApp upon dispatch.`,
        ],
      };

    case "returns":
      return {
        policyType: "returns",
        title: "Returns & Replacements Policy",
        summary: `Sacred and devotional items are inspected and packed with utmost reverence. Replacements or returns are supported for damaged or incorrect items.`,
        details: [
          `If a product arrives damaged, defective, or incorrect, please notify our support team within 48 hours of delivery.`,
          `Items must remain in their original sacred condition and unwashed/unused.`,
          `To initiate a return or replacement, contact our customer support team with photos of the package.`,
        ],
      };

    case "contact":
      return {
        policyType: "contact",
        title: "Store & Support Contact Details",
        summary: `Shri Radha Govind Store is based directly in Sri Vrindavan Dham, serving devotees worldwide with authentic sacred items.`,
        details: [
          `Support Email: ${storeEmail}`,
          `Physical Address: 155, 2nd Floor, Madan Mohan Ghera, Raman Reti, Vrindavan, Mathura, Uttar Pradesh - 281121`,
          `WhatsApp Support: Direct link available on the website footer`,
          `Support Hours: Monday to Saturday, 10:00 AM - 7:00 PM IST`,
        ],
      };

    case "privacy":
      return {
        policyType: "privacy",
        title: "Privacy & Data Protection",
        summary: `Your privacy and payment security are strictly protected. We never sell or share customer personal information.`,
        details: [
          `All transactions are secured via Razorpay with industry-standard 256-bit SSL encryption.`,
          `Customer contact details are used strictly for order fulfillment and delivery tracking.`,
          `We never store sensitive credit card or net banking credentials.`,
        ],
      };

    case "terms":
      return {
        policyType: "terms",
        title: "Terms of Service",
        summary: `All sacred items sold on Shri Radha Govind Store (such as Tulsi malas, Kanthi malas, Deity shringar, and spiritual items) are genuine and crafted with devotional care.`,
        details: [
          `All prices are shown in Indian Rupees (INR) and are inclusive of applicable taxes.`,
          `Orders are subject to acceptance and stock availability.`,
          `Authentic consecrated items dispatched directly from Vrindavan Dham.`,
        ],
      };

    default:
      return {
        policyType: "contact",
        title: "Shri Radha Govind Store Help",
        summary: `For any inquiries, reach our Vrindavan Dham support team at ${storeEmail}.`,
        details: [`Support Email: ${storeEmail}`],
      };
  }
}
