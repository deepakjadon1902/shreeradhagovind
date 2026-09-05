import {
  createContext,
  useContext,
  useEffect,
  useState,
  useMemo,
  useCallback,
  type ReactNode,
} from "react";
import { DEFAULT_CATEGORIES, DEFAULT_CATEGORY_TREE, type Product } from "./products";
import { toast } from "sonner";
import { api, isApiEnabled, setToken, getToken } from "./api";
import { slugify } from "./seo";

export type CartItem = { productId: string; qty: number };
export type Courier = "Ekart" | "DTDC" | "Shree Maruti" | "India Post" | "Delhivery" | "Bluedart";
export const COURIERS: Courier[] = [
  "Ekart",
  "DTDC",
  "Shree Maruti",
  "India Post",
  "Delhivery",
  "Bluedart",
];
export type PaymentStatus = "paid" | "pending" | "failed" | "refunded";
export type OrderItem = {
  product: Product;
  qty: number;
  hsnCode?: string;
  price?: number;
  mrp?: number;
  taxableAmount?: number;
  gstAmount?: number;
  gstRate?: number;
};
export type Order = {
  id: string;
  orderNo?: number;
  customerEmail?: string;
  trackingId?: string;
  courier?: Courier | null;
  courierTrackingUrl?: string;
  items: OrderItem[];
  subtotal?: number;
  shipping?: number;
  packagingFee?: number;
  discount?: number;
  taxableAmount?: number;
  cgst?: number;
  sgst?: number;
  igst?: number;
  gstTotal?: number;
  total: number;
  alternatePhone?: string;
  needsGstInvoice?: boolean;
  businessName?: string;
  gstin?: string;
  address: {
    name: string;
    phone: string;
    alternatePhone?: string;
    line1: string;
    line2?: string;
    postOffice?: string;
    city: string;
    state: string;
    pincode: string;
  };
  billingAddress?: {
    name?: string;
    line1?: string;
    line2?: string;
    postOffice?: string;
    city?: string;
    state?: string;
    pincode?: string;
  };
  createAccount?: boolean;
  payment: {
    method: "razorpay" | "cod";
    status: PaymentStatus;
    razorpayOrderId?: string;
    razorpayPaymentId?: string;
    razorpaySignature?: string;
    failureReason?: string;
  };
  status:
    | "Placed"
    | "Confirmed"
    | "Processing"
    | "Hold"
    | "Packed"
    | "Shipped"
    | "Out for delivery"
    | "Delivered"
    | "Cancelled";
  holdReason?: string;
  holdAt?: string;
  guestAccessToken?: string;
  courierTrackingData?: NormalizedTrackingData | null;
  statusHistory?: {
    status: string;
    changedAt: string;
    changedBy?: string;
    note?: string;
    holdReason?: string;
  }[];
  createdAt: number;
};

export interface CourierCheckpoint {
  time: string;
  location: string;
  description: string;
  status?: string;
}

export interface NormalizedTrackingData {
  status:
    | "info_received"
    | "in_transit"
    | "out_for_delivery"
    | "delivered"
    | "exception"
    | "undelivered"
    | "unknown";
  latestStatus: string;
  latestMessage: string;
  currentLocation: string;
  origin: string | null;
  destination: string | null;
  expectedDeliveryDate: string | null;
  checkpoints: CourierCheckpoint[];
  lastUpdated: string;
  provider: "trackcourier";
  quotaExceeded?: boolean;
}
export type Address = { line1: string; line2?: string; postOffice?: string; city: string; state: string; pincode: string };
export type User = {
  id?: string;
  name: string;
  email: string;
  phone?: string;
  avatar?: string;
  role?: "user" | "admin";
  address?: Partial<Address>;
} | null;
export type Category = {
  id: string;
  name: string;
  slug: string;
  parentId?: string | null;
  image?: string;
  description?: string;
  metaTitle?: string;
  metaDescription?: string;
  isActive: boolean;
  sortOrder: number;
  productCount: number;
};

export type Blog = {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  image: string;
  author: string;
  metaTitle?: string;
  metaDescription?: string;
  isPublished: boolean;
  sortOrder: number;
  publishedAt?: string;
};

export type Settings = {
  siteName: string;
  tagline: string;
  supportEmail: string;
  supportPhone: string;
  whatsappPhone?: string;
  storeAddress?: string;
  gstin?: string;
  currency: string;
  freeShipThreshold: number;
  shippingFee: number;
  razorpayKeyId: string;
  codEnabled: boolean;
  announcement: string;
  heroTitle?: string;
  heroSubtitle?: string;
  footerDescription?: string;
  homeHeroImage?: string;
  vrindavanStoryImage?: string;
  whatsappTemplate?: string;
};

const DEFAULT_SETTINGS: Settings = {
  siteName: "Shri Radha Govind Store",
  tagline: "Made With Love From The Heart Of Vrindavan",
  supportEmail: "support@shriradhagovindstore.com",
  supportPhone: "+91 7500533505",
  whatsappPhone: "+91 7500533505",
  storeAddress: "Vrindavan, Mathura, Uttar Pradesh, India - 281121",
  gstin: "",
  currency: "INR",
  freeShipThreshold: 999,
  shippingFee: 49,
  razorpayKeyId: "",
  codEnabled: true,
  announcement:
    "॥ Radhe Radhe ॥  -  Made With Love From The Heart Of Vrindavan  -  Free shipping above Rs. 999",
  heroTitle: "Sacred Treasures From Vrindavan",
  heroSubtitle: "Handcrafted Japa malas, authentic Tulsi, sacred idols, and pure puja essentials blessed in the holy dham.",
  footerDescription: "Shri Radha Govind Store brings authentic, consecrated devotional items directly from the holy land of Vrindavan Dham to your home.",
  homeHeroImage: "",
  vrindavanStoryImage: "",
  whatsappTemplate: "",
};

export type RegisteredUser = {
  id: string;
  name: string;
  email: string;
  phone?: string;
  avatar?: string;
  role: "user" | "admin";
  provider?: "password" | "google";
  isBlocked: boolean;
  address?: { line1?: string; city?: string; state?: string; pincode?: string };
  ordersCount?: number;
  totalSpent?: number;
  createdAt?: string;
  lastLoginAt?: string | null;
};

export type CourierEvent = { at: string; label: string; description: string };

type Store = {
  apiEnabled: boolean;
  user: User;
  login: (email: string, passwordOrName?: string) => Promise<void> | void;
  sendLoginOtp: (email: string) => Promise<{ ok: boolean; message: string }>;
  verifyLoginOtp: (
    email: string,
    otp: string
  ) => Promise<{ requiresPasswordSet: boolean; setPasswordToken?: string; user?: any }>;
  createPassword: (token: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string) => Promise<void>;
  loginGoogle: (credential?: string) => Promise<void> | void;
  logout: () => void;
  updateProfile: (patch: { name: string; phone: string; address: Address }) => Promise<boolean>;
  cart: CartItem[];
  addToCart: (productId: string, qty?: number) => void;
  buyNow: (productId: string, qty?: number) => void;
  updateQty: (productId: string, qty: number) => void;
  removeFromCart: (productId: string) => void;
  clearCart: () => void;
  wishlist: string[];
  toggleWishlist: (productId: string) => void;
  orders: Order[];
  placeOrder: (o: Omit<Order, "id" | "createdAt" | "status">) => Promise<Order> | Order;
  // admin
  adminAuthed: boolean;
  adminLogin: (u: string, p: string) => Promise<boolean> | boolean;
  adminLogout: () => void;
  adminProducts: Product[];
  refreshProducts: () => Promise<Product[]>;
  saveProduct: (p: Product) => Promise<void> | void;
  deleteProduct: (id: string) => Promise<void> | void;
  updateOrderStatus: (id: string, status: Order["status"]) => Promise<void> | void;
  updateOrderTracking: (
    id: string,
    patch: {
      trackingId?: string;
      courier?: Courier | null;
      courierTrackingUrl?: string;
      status?: Order["status"];
      holdReason?: string;
      note?: string;
    },
  ) => Promise<void> | void;
  categories: string[];
  addCategory: (name: string, parentId?: string | null) => Promise<void> | void;
  renameCategory: (oldName: string, newName: string) => Promise<void> | void;
  deleteCategory: (nameOrId: string) => Promise<void> | void;
  settings: Settings;
  updateSettings: (patch: Partial<Settings>) => Promise<void> | void;
  customers: { name: string; email: string; phone: string; orders: number; spent: number }[];
  registeredUsers: RegisteredUser[];
  fetchRegisteredUsers: () => Promise<void>;
  toggleUserBlock: (id: string, isBlocked: boolean) => Promise<void>;
  fetchOrderEvents: (id: string) => Promise<{ events: CourierEvent[]; order: Order } | null>;
  categoryDetails: Category[];
  categoryTree: (Category & { children: Category[] })[];
  adminCategoryTree: (Category & { children: Category[] })[];
  saveCategory: (c: Partial<Category> & { name: string; id?: string }) => Promise<void> | void;
  reorderCategories: (
    items: { id: string; sortOrder: number; parentId?: string | null }[],
  ) => Promise<void> | void;
  blogs: Blog[];
  saveBlog: (b: Blog) => Promise<void> | void;
  deleteBlog: (id: string) => Promise<void> | void;
  requestPasswordReset: (email: string) => Promise<void>;
  verifyPasswordResetOtp: (email: string, otp: string) => Promise<void>;
  resetPassword: (email: string, password: string) => Promise<void>;
};

const Ctx = createContext<Store | null>(null);
const KEY = "shri_radha_govind_v1";

function load<T>(k: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const v = localStorage.getItem(`${KEY}_${k}`);
    return v ? JSON.parse(v) : fallback;
  } catch {
    return fallback;
  }
}
function save(k: string, v: unknown) {
  if (typeof window === "undefined") return;
  localStorage.setItem(`${KEY}_${k}`, JSON.stringify(v));
}

// ---------- backend ↔ frontend mappers ----------
const mapProduct = (p: any): Product => ({
  id: String(p._id ?? p.id),
  slug: p.slug ?? slugify(p.name ?? String(p._id ?? p.id)),
  name: p.name,
  description: p.description ?? "",
  price: p.price,
  mrp: p.mrp ?? p.compareAtPrice ?? 0,
  image: p.image ?? "",
  images: p.images ?? [],
  featuredDeal: !!p.featuredDeal,
  category: p.category,
  stock: p.stock ?? 100,
  rating: p.rating ?? 0,
  reviews: p.reviews ?? 0,
  details: p.details ?? [],
  hsnCode: p.hsnCode ?? "",
  gstRate: p.gstRate !== undefined ? Number(p.gstRate) : 0,
  gstInclusive: p.gstInclusive !== undefined ? Boolean(p.gstInclusive) : true,
  isTaxable: p.isTaxable !== undefined ? Boolean(p.isTaxable) : true,
  metaTitle: p.metaTitle ?? "",
  metaDescription: p.metaDescription ?? "",
  comboComponents: Array.isArray(p.comboComponents) ? p.comboComponents : [],
});

const mapSettings = (s: any): Partial<Settings> => ({
  siteName: s.siteName,
  tagline: s.tagline,
  supportEmail: s.email ?? s.supportEmail,
  supportPhone: s.phone ?? s.supportPhone,
  whatsappPhone: s.whatsappPhone,
  storeAddress: s.address ?? s.storeAddress,
  gstin: s.gstin,
  currency: s.currency,
  freeShipThreshold: s.freeShipThreshold,
  shippingFee: s.shippingFee,
  razorpayKeyId: s.razorpayKeyId,
  codEnabled: s.codEnabled,
  announcement: s.announcement,
  heroTitle: s.heroTitle,
  heroSubtitle: s.heroSubtitle,
  footerDescription: s.footerDescription,
  homeHeroImage: s.homeHeroImage,
  vrindavanStoryImage: s.vrindavanStoryImage,
  whatsappTemplate: s.whatsappTemplate,
});

const mapCategory = (c: any): Category => ({
  id: String(c._id ?? c.id),
  name: c.name,
  slug: c.slug ?? slugify(c.name),
  parentId: c.parentId ? String(c.parentId) : null,
  image: c.image ?? "",
  description: c.description ?? "",
  metaTitle: c.metaTitle ?? "",
  metaDescription: c.metaDescription ?? "",
  isActive: c.isActive ?? true,
  sortOrder: c.sortOrder ?? 0,
  productCount: c.productCount ?? 0,
});

const DEFAULT_CATEGORY_DETAILS: Category[] = DEFAULT_CATEGORY_TREE.flatMap(
  (parent, parentIndex) => {
    const parentId = `local-${slugify(parent.name)}`;
    const base: Category = {
      id: parentId,
      name: parent.name,
      slug: slugify(parent.name),
      parentId: null,
      image: "",
      description: `${parent.name} collection from Shri Radha Govind Store.`,
      metaTitle: `${parent.name} | Shri Radha Govind Store`,
      metaDescription: `Shop ${parent.name} at Shri Radha Govind Store.`,
      isActive: true,
      sortOrder: parentIndex,
      productCount: 0,
    };
    return [
      base,
      ...parent.children.map((name, childIndex) => ({
        id: `local-${slugify(parent.name)}-${slugify(name)}`,
        name,
        slug: slugify(name),
        parentId,
        image: "",
        description: `${name} products for devotees.`,
        metaTitle: `${name} | Shri Radha Govind Store`,
        metaDescription: `Shop ${name} at Shri Radha Govind Store.`,
        isActive: true,
        sortOrder: childIndex,
        productCount: 0,
      })),
    ];
  },
);

const mapBlog = (b: any): Blog => ({
  id: String(b._id ?? b.id),
  title: b.title,
  slug: b.slug ?? slugify(b.title),
  excerpt: b.excerpt ?? "",
  content: b.content ?? "",
  image: b.image ?? "",
  author: b.author ?? "Shri Radha Govind Store",
  metaTitle: b.metaTitle ?? "",
  metaDescription: b.metaDescription ?? "",
  isPublished: b.isPublished ?? true,
  sortOrder: b.sortOrder ?? 0,
  publishedAt: b.publishedAt ?? b.createdAt,
});

const fallbackProduct = (i: any): Product => ({
  id: String(i.productId ?? i.id ?? ""),
  name: i.name ?? "Product",
  description: "",
  price: typeof i.price === "number" ? i.price : 0,
  mrp: typeof i.mrp === "number" ? i.mrp : 0,
  image: i.image ?? "",
  images: [],
  featuredDeal: false,
  category: "",
  stock: 0,
  rating: 0,
  reviews: 0,
  details: [],
  hsnCode: i.hsnCode ?? "",
  gstRate: typeof i.gstRate === "number" ? i.gstRate : 0,
  gstInclusive: typeof i.gstInclusive === "boolean" ? i.gstInclusive : true,
  comboComponents: Array.isArray(i.comboComponents) ? i.comboComponents : [],
});

const mapOrder = (o: any, productLookup: Map<string, Product>): Order => {
  const safeAddress: Order["address"] = {
    name: String(o?.address?.name || o?.customerName || "Devotee"),
    phone: String(o?.address?.phone || o?.phone || ""),
    alternatePhone: String(o?.address?.alternatePhone || o?.alternatePhone || ""),
    line1: String(o?.address?.line1 || o?.line1 || ""),
    line2: String(o?.address?.line2 || o?.line2 || ""),
    postOffice: String(o?.address?.postOffice || o?.postOffice || ""),
    city: String(o?.address?.city || o?.city || ""),
    state: String(o?.address?.state || o?.state || ""),
    pincode: String(o?.address?.pincode || o?.pincode || ""),
  };

  const safePayment: Order["payment"] = {
    method: o?.payment?.method === "razorpay" ? "razorpay" : "cod",
    status: ((o?.payment?.status as PaymentStatus) || "pending"),
    razorpayOrderId: o?.payment?.razorpayOrderId ? String(o.payment.razorpayOrderId) : undefined,
    razorpayPaymentId: o?.payment?.razorpayPaymentId ? String(o.payment.razorpayPaymentId) : undefined,
    razorpaySignature: o?.payment?.razorpaySignature ? String(o.payment.razorpaySignature) : undefined,
    failureReason: o?.payment?.failureReason ? String(o.payment.failureReason) : undefined,
  };

  return {
    id: String(o?._id ?? o?.id ?? Math.random().toString(36).slice(2)),
    orderNo: typeof o?.orderNo === "number" ? o.orderNo : undefined,
    customerEmail: o?.customerEmail ? String(o.customerEmail) : undefined,
    trackingId: o?.trackingId ? String(o.trackingId) : undefined,
    courier: (o?.courier as Courier) || null,
    courierTrackingUrl: String(o?.courierTrackingUrl || ""),
    items: Array.isArray(o?.items)
      ? o.items.map((i: any) => {
          const matchedProd = productLookup.get(String(i?.productId ?? i?._id));
          const baseProd = matchedProd ?? fallbackProduct(i);
          return {
            product: baseProd,
            qty: Number(i?.qty) || 1,
            hsnCode: i?.hsnCode || baseProd.hsnCode || "",
            price: typeof i?.price === "number" ? i.price : baseProd.price,
            mrp: typeof i?.mrp === "number" ? i.mrp : baseProd.mrp,
            taxableAmount: typeof i?.taxableAmount === "number" ? i.taxableAmount : undefined,
            gstAmount: typeof i?.gstAmount === "number" ? i.gstAmount : undefined,
            gstRate: typeof i?.gstRate === "number" ? i.gstRate : baseProd.gstRate,
          };
        })
      : [],
    subtotal: typeof o?.subtotal === "number" ? o.subtotal : undefined,
    shipping: typeof o?.shipping === "number" ? o.shipping : undefined,
    packagingFee: typeof o?.packagingFee === "number" ? o.packagingFee : undefined,
    discount: typeof o?.discount === "number" ? o.discount : undefined,
    taxableAmount: typeof o?.taxableAmount === "number" ? o.taxableAmount : undefined,
    cgst: typeof o?.cgst === "number" ? o.cgst : undefined,
    sgst: typeof o?.sgst === "number" ? o.sgst : undefined,
    igst: typeof o?.igst === "number" ? o.igst : undefined,
    gstTotal: typeof o?.gstTotal === "number" ? o.gstTotal : undefined,
    total: Number(o?.total) || 0,
    alternatePhone: o?.alternatePhone ?? safeAddress.alternatePhone,
    needsGstInvoice: Boolean(o?.needsGstInvoice),
    businessName: String(o?.businessName || ""),
    gstin: String(o?.gstin || ""),
    address: safeAddress,
    billingAddress: o?.billingAddress
      ? {
          name: String(o.billingAddress.name || ""),
          line1: String(o.billingAddress.line1 || ""),
          line2: String(o.billingAddress.line2 || ""),
          postOffice: String(o.billingAddress.postOffice || ""),
          city: String(o.billingAddress.city || ""),
          state: String(o.billingAddress.state || ""),
          pincode: String(o.billingAddress.pincode || ""),
        }
      : undefined,
    payment: safePayment,
    status: o?.status ?? "Placed",
    createdAt: o?.createdAt ? new Date(o.createdAt).getTime() : Date.now(),
  };
};

export const displayOrderNumber = (order?: Pick<Order, "id" | "orderNo"> | null) => {
  if (!order) return "0000";
  if (typeof order.orderNo === "number") return String(order.orderNo).padStart(4, "0");
  const idStr = String(order.id || "0");
  const hash = idStr.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return String(5000 + (hash % 5000)).padStart(4, "0");
};

export function StoreProvider({ children }: { children: ReactNode }) {
  const apiEnabled = isApiEnabled();
  const [user, setUser] = useState<User>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [wishlist, setWishlist] = useState<string[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [adminProducts, setAdminProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>(DEFAULT_CATEGORIES);
  const [categoryDetails, setCategoryDetails] = useState<Category[]>(DEFAULT_CATEGORY_DETAILS);
  // backend category name → id
  const [categoryIds, setCategoryIds] = useState<Record<string, string>>({});
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [registeredUsers, setRegisteredUsers] = useState<RegisteredUser[]>([]);
  const [blogs, setBlogs] = useState<Blog[]>([]);

  const refreshProducts = useCallback(async () => {
    if (!apiEnabled) return [];
    try {
      const prodRes = await api<{ products: any[] }>("/products", { retries: 1, retryDelayMs: 1000 });
      const prods = (prodRes?.products || []).map(mapProduct);
      setAdminProducts(prods);
      return prods;
    } catch (e: any) {
      console.warn("[api] fetch products failed:", e?.message);
      return [];
    }
  }, [apiEnabled]);

  // ---- initial load (local + remote) ----
  useEffect(() => {
    setUser(load("user", null));
    setCart(load("cart", []));
    setWishlist(load("wishlist", []));
    if (typeof window !== "undefined") {
      try {
        localStorage.removeItem(`${KEY}_products`);
      } catch {
        /* ignore */
      }
    }
    setCategories(load("categories", DEFAULT_CATEGORIES));
    setCategoryDetails(load("categoryDetails", DEFAULT_CATEGORY_DETAILS));
    setBlogs(load("blogs", []));
    setOrders((load("orders", []) || []).map((o: any) => mapOrder(o, new Map())));
    setSettings({ ...DEFAULT_SETTINGS, ...load("settings", {}) });
    if (!apiEnabled) return;

    (async () => {
      // 1. Independent products fetch
      const prodPromise = api<{ products: any[] }>("/products", { retries: 2, retryDelayMs: 1500 })
        .then((prodRes) => {
          const products = (prodRes?.products || []).map(mapProduct);
          setAdminProducts(products);
          return products;
        })
        .catch((e: any) => {
          console.warn("[api] initial products load failed:", e?.message);
          return [] as Product[];
        });

      // 2. Independent categories fetch
      const catPromise = api<{ categories: any[] }>("/categories", { retries: 2, retryDelayMs: 1500 })
        .then((catRes) => {
          const mappedCategories = (catRes?.categories || []).map(mapCategory);
          setCategoryDetails(mappedCategories);
          setCategories(mappedCategories.filter((c) => c.isActive).map((c) => c.name));
          setCategoryIds(Object.fromEntries(mappedCategories.map((c) => [c.name, c.id])));
        })
        .catch((e: any) => {
          console.warn("[api] initial categories load failed:", e?.message);
        });

      // 3. Independent settings fetch
      const setPromise = api<{ settings: any }>("/settings", { retries: 2, retryDelayMs: 1500 })
        .then((setRes) => {
          if (setRes?.settings) {
            setSettings((s) => ({ ...s, ...mapSettings(setRes.settings) }));
          }
        })
        .catch((e: any) => {
          console.warn("[api] initial settings load failed:", e?.message);
        });

      // 4. Independent blogs fetch
      const blogPromise = api<{ blogs: any[] }>("/blogs?all=true", { retries: 2, retryDelayMs: 1500 })
        .then((blogRes) => {
          if (blogRes?.blogs) {
            setBlogs(blogRes.blogs.map(mapBlog));
          }
        })
        .catch((e: any) => {
          console.warn("[api] initial blogs load failed:", e?.message);
        });

      await Promise.allSettled([prodPromise, catPromise, setPromise, blogPromise]);

      if (getToken()) {
        try {
          const me = await api<{ user: any }>("/auth/me");
          setUser({
            id: me.user.id,
            name: me.user.name,
            email: me.user.email,
            role: me.user.role,
            avatar: me.user.avatar,
            phone: me.user.phone ?? "",
            address: me.user.address ?? {},
          });
          const ord = await api<{ orders: any[] }>(
            me.user.role === "admin" ? "/admin/orders" : "/orders",
          );
          const currentProducts = await prodPromise;
          const lookup = new Map(currentProducts.map((p) => [p.id, p]));
          setOrders((ord?.orders || []).map((o) => mapOrder(o, lookup)));
        } catch {
          setToken(null);
          setUser(null);
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- local persistence ----
  useEffect(() => save("user", user), [user]);
  useEffect(() => save("cart", cart), [cart]);
  useEffect(() => save("wishlist", wishlist), [wishlist]);
  useEffect(() => save("orders", orders), [orders]);
  useEffect(() => save("categories", categories), [categories]);
  useEffect(() => save("categoryDetails", categoryDetails), [categoryDetails]);
  useEffect(() => save("blogs", blogs), [blogs]);
  useEffect(() => save("settings", settings), [settings]);

  const adminAuthed = !!user && user.role === "admin";

  const refreshOrders = useCallback(
    async (asAdmin = false) => {
      if (!apiEnabled || !getToken()) return;
      try {
        const ord = await api<{ orders: any[] }>(asAdmin ? "/admin/orders" : "/orders");
        const lookup = new Map(adminProducts.map((p) => [p.id, p]));
        setOrders((ord?.orders || []).map((o) => mapOrder(o, lookup)));
      } catch {
        /* ignore */
      }
    },
    [apiEnabled, adminProducts],
  );

  const customers = useMemo(() => {
    const map = new Map<
      string,
      { name: string; email: string; phone: string; orders: number; spent: number }
    >();
    if (!Array.isArray(orders)) return [];
    for (const o of orders) {
      if (!o) continue;
      const phone = o.address?.phone || "";
      const name = o.address?.name || "Customer";
      const key = phone || name || o.id;
      if (!key) continue;
      const e = map.get(key);
      if (e) {
        e.orders++;
        e.spent += Number(o.total) || 0;
      } else {
        map.set(key, {
          name,
          email: o.customerEmail || "-",
          phone: phone || "-",
          orders: 1,
          spent: Number(o.total) || 0,
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => b.spent - a.spent);
  }, [orders]);

  // Admin full category tree (all categories including hidden ones, preserving hierarchy)
  const adminCategoryTree = useMemo(() => {
    const all = [...categoryDetails].sort(
      (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name)
    );
    const allIds = new Set(all.map((c) => c.id));
    const roots = all.filter((c) => !c.parentId || !allIds.has(c.parentId));
    return roots.map((parent) => ({
      ...parent,
      children: all.filter((c) => c.parentId === parent.id),
    }));
  }, [categoryDetails]);

  // Storefront active category tree (active root categories and active subcategories only)
  const categoryTree = useMemo(() => {
    const all = [...categoryDetails].sort(
      (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name)
    );
    const allIds = new Set(all.map((c) => c.id));
    const activeRoots = all.filter((c) => c.isActive && (!c.parentId || !allIds.has(c.parentId)));
    return activeRoots.map((parent) => ({
      ...parent,
      children: all.filter((c) => c.parentId === parent.id && c.isActive),
    }));
  }, [categoryDetails]);

  // ---- auth ----
  const finishAuth = (token: string, u: any) => {
    setToken(token);
    setUser({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      avatar: u.avatar,
      phone: u.phone ?? "",
      address: u.address ?? {},
    });
    toast.success(`Welcome, ${u.name}!`);
  };

  const login: Store["login"] = async (email, passwordOrName) => {
    if (apiEnabled) {
      try {
        const r = await api<{ token: string; user: any }>("/auth/login", {
          method: "POST",
          body: { email, password: passwordOrName ?? "" },
        });
        finishAuth(r.token, r.user);
        await refreshOrders(false);
      } catch (e: any) {
        toast.error(e?.message ?? "Login failed");
        throw e;
      }
    } else {
      setUser({ name: passwordOrName ?? email.split("@")[0], email });
      toast.success("Welcome back!");
    }
  };

  const sendLoginOtp: Store["sendLoginOtp"] = async (email) => {
    if (apiEnabled) {
      try {
        const r = await api<{ ok: boolean; message: string }>("/auth/send-login-otp", {
          method: "POST",
          body: { email: email.trim().toLowerCase() },
        });
        toast.success(r.message || "OTP sent to your email.");
        return r;
      } catch (e: any) {
        toast.error(e?.message ?? "Failed to send OTP");
        throw e;
      }
    }
    toast.success("Demo OTP sent: 123456");
    return { ok: true, message: "Demo OTP sent." };
  };

  const verifyLoginOtp: Store["verifyLoginOtp"] = async (email, otp) => {
    if (apiEnabled) {
      try {
        const r = await api<{
          requiresPasswordSet: boolean;
          setPasswordToken?: string;
          token?: string;
          user: any;
        }>("/auth/verify-login-otp", {
          method: "POST",
          body: { email: email.trim().toLowerCase(), otp: otp.trim() },
        });
        if (!r.requiresPasswordSet && r.token) {
          finishAuth(r.token, r.user);
          await refreshOrders(false);
        }
        return r;
      } catch (e: any) {
        toast.error(e?.message ?? "OTP verification failed");
        throw e;
      }
    }
    const demoUser = { id: "demo-user", name: email.split("@")[0], email };
    finishAuth("demo-token", demoUser);
    return { requiresPasswordSet: false, user: demoUser };
  };

  const createPassword: Store["createPassword"] = async (token, password) => {
    if (apiEnabled) {
      try {
        const r = await api<{ token: string; user: any }>("/auth/create-password", {
          method: "POST",
          body: { token, password },
        });
        finishAuth(r.token, r.user);
        await refreshOrders(false);
        toast.success("Password created successfully. Your account is ready.");
      } catch (e: any) {
        toast.error(e?.message ?? "Failed to create password");
        throw e;
      }
    } else {
      toast.success("Password created successfully.");
    }
  };

  const signup: Store["signup"] = async (name, email, password) => {
    if (apiEnabled) {
      try {
        const r = await api<{ token: string; user: any }>("/auth/signup", {
          method: "POST",
          body: { name, email, password },
        });
        finishAuth(r.token, r.user);
      } catch (e: any) {
        toast.error(e?.message ?? "Signup failed");
        throw e;
      }
    } else {
      setUser({ name, email });
      toast.success("Account created");
    }
  };

  const loginGoogle: Store["loginGoogle"] = async (credential) => {
    if (apiEnabled && credential) {
      try {
        const r = await api<{ token: string; user: any }>("/auth/google", {
          method: "POST",
          body: { credential },
        });
        finishAuth(r.token, r.user);
        await refreshOrders(false);
      } catch (e: any) {
        toast.error(e?.message ?? "Google sign-in failed");
        throw e;
      }
    } else {
      setUser({
        email: "devotee@gmail.com",
        name: "Krishna Devotee",
        avatar: "https://api.dicebear.com/9.x/initials/svg?seed=KD",
      });
      toast.success("Signed in with Google");
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    setOrders([]);
    toast("Logged out");
  };

  // ---- admin login ----
  const adminLogin: Store["adminLogin"] = async (u, p) => {
    const email = (u ?? "").trim().toLowerCase();
    const pass = (p ?? "").trim();
    if (apiEnabled) {
      try {
        const r = await api<{ token: string; user: any }>("/auth/login", {
          method: "POST",
          body: { email, password: pass },
        });
        if (r.user.role !== "admin") {
          toast.error("Not an admin account");
          return false;
        }
        finishAuth(r.token, r.user);
        await Promise.allSettled([refreshOrders(true), refreshProducts()]);
        return true;
      } catch (e: any) {
        toast.error(e?.message ?? "Invalid admin credentials");
        return false;
      }
    }
    // local fallback
    if (email === "shriradhagovindstore@gmail.com" && pass === "shriradhagovindstore108@") {
      setUser({ name: "Shri Radha Govind Store", email, role: "admin" });
      toast.success("Admin authenticated");
      return true;
    }
    toast.error("Invalid admin credentials");
    return false;
  };

  const adminLogout = () => {
    setToken(null);
    setUser(null);
  };

  // ---- products (admin) ----
  const saveProduct: Store["saveProduct"] = async (p) => {
    if (apiEnabled) {
      try {
        const previousProduct = adminProducts.find((x) => x.id === p.id);
        const payload: any = {
          name: p.name,
          description: p.description,
          price: Number(p.price),
          mrp: Number(p.mrp ?? 0),
          image: p.image,
          images: p.images ?? [],
          featuredDeal: !!p.featuredDeal,
          category: p.category,
          stock: Number(p.stock ?? 100),
          rating: Number(p.rating ?? 0),
          reviews: Number(p.reviews ?? 0),
          details: p.details ?? [],
          slug: p.slug || slugify(p.name),
          hsnCode: p.hsnCode ?? "",
          gstRate: Number(p.gstRate ?? 0),
          gstInclusive: p.gstInclusive !== undefined ? Boolean(p.gstInclusive) : true,
          isTaxable: p.isTaxable !== undefined ? Boolean(p.isTaxable) : true,
          metaTitle: p.metaTitle ?? "",
          metaDescription: p.metaDescription ?? "",
        };
        const isExisting = !!previousProduct;
        const r = isExisting
          ? await api<{ product: any }>(`/products/${p.id}`, { method: "PATCH", body: payload })
          : await api<{ product: any }>(`/products`, { method: "POST", body: payload });
        const saved = mapProduct(r.product);
        setAdminProducts((arr) => {
          const i = arr.findIndex((x) => x.id === saved.id);
          if (i >= 0) {
            const next = [...arr];
            next[i] = saved;
            return next;
          }
          return [saved, ...arr];
        });
        setCategoryDetails((arr) =>
          arr.map((category) => ({
            ...category,
            productCount: Math.max(
              0,
              category.productCount +
                (category.name === saved.category && !isExisting ? 1 : 0) +
                (isExisting &&
                category.name === previousProduct?.category &&
                category.name !== saved.category
                  ? -1
                  : 0) +
                (isExisting &&
                category.name === saved.category &&
                previousProduct?.category !== saved.category
                  ? 1
                  : 0),
            ),
          })),
        );
        toast.success("Product saved");
        return;
      } catch (e: any) {
        toast.error(e?.message ?? "Save failed");
        throw e;
      }
    } else {
      setAdminProducts((arr) => {
        const i = arr.findIndex((x) => x.id === p.id);
        if (i >= 0) {
          const next = [...arr];
          next[i] = p;
          return next;
        }
        return [{ ...p, id: p.id || `p${Date.now()}` }, ...arr];
      });
      setCategoryDetails((arr) =>
        arr.map((category) => ({
          ...category,
          productCount:
            category.name === p.category
              ? category.productCount + (p.id ? 0 : 1)
              : category.productCount,
        })),
      );
      toast.success("Product saved");
    }
  };

  const deleteProduct: Store["deleteProduct"] = async (id) => {
    if (apiEnabled) {
      try {
        await api(`/products/${id}`, { method: "DELETE" });
      } catch (e: any) {
        toast.error(e?.message);
        return;
      }
    }
    setAdminProducts((arr) => arr.filter((p) => p.id !== id));
    setCategoryDetails((arr) =>
      arr.map((category) => ({
        ...category,
        productCount: Math.max(
          0,
          category.productCount -
            (adminProducts.find((product) => product.id === id)?.category === category.name
              ? 1
              : 0),
        ),
      })),
    );
    toast("Product deleted");
  };

  // ---- orders ----
  const placeOrder: Store["placeOrder"] = async (o) => {
    if (apiEnabled) {
      try {
        const orderEmail = o.customerEmail || (o.address as any)?.email;
        const r = await api<{ order: any; token?: string; user?: any; isNewAccount?: boolean }>("/orders", {
          method: "POST",
          body: {
            email: orderEmail,
            createAccount: o.createAccount,
            needsGstInvoice: o.needsGstInvoice,
            businessName: o.businessName,
            gstin: o.gstin,
            items: o.items.map((i) => ({ productId: i.product.id, qty: i.qty })),
            address: o.address,
            billingAddress: o.billingAddress,
            payment: {
              method: o.payment.method,
              status: o.payment.status,
              razorpayOrderId: o.payment.razorpayOrderId,
              razorpayPaymentId: o.payment.razorpayPaymentId,
              razorpaySignature: o.payment.razorpaySignature,
            },
          },
        });
        if (r.token && r.user && !getToken()) {
          setToken(r.token);
          setUser(r.user);
        }
        const lookup = new Map(adminProducts.map((p) => [p.id, p]));
        const placed = mapOrder(r.order, lookup);
        setOrders((arr) => [placed, ...arr]);
        setCart([]);
        return placed;
      } catch (e: any) {
        toast.error(e?.message ?? "Order failed");
        throw e;
      }
    }
    const order: Order = {
      ...o,
      id: `OD${Date.now().toString().slice(-8)}`,
      orderNo:
        Math.max(
          4999,
          ...orders.map((existing) => existing.orderNo ?? 0).filter((value) => value < 9999),
        ) + 1,
      createdAt: Date.now(),
      status: "Placed",
    };
    setOrders((arr) => [order, ...arr]);
    setCart([]);
    return order;
  };

  const updateOrderStatus: Store["updateOrderStatus"] = async (id, status) => {
    if (apiEnabled) {
      try {
        await api(`/admin/orders/${id}/status`, { method: "PATCH", body: { status } });
      } catch (e: any) {
        toast.error(e?.message);
        return;
      }
    }
    setOrders((arr) => arr.map((o) => (o.id === id ? { ...o, status } : o)));
  };

  const updateOrderTracking: Store["updateOrderTracking"] = async (id, patch) => {
    if (apiEnabled) {
      try {
        const r = await api<{ order: any }>(`/admin/orders/${id}`, {
          method: "PATCH",
          body: patch,
        });
        const lookup = new Map(adminProducts.map((p) => [p.id, p]));
        const updated = mapOrder(r.order, lookup);
        setOrders((arr) => arr.map((o) => (o.id === id ? updated : o)));
        toast.success("Order updated");
        return;
      } catch (e: any) {
        toast.error(e?.message);
        return;
      }
    }
    setOrders((arr) => arr.map((o) => (o.id === id ? { ...o, ...patch } : o)));
    toast.success("Order updated");
  };

  // ---- categories ----
  const addCategory: Store["addCategory"] = async (name, parentId = null) => {
    const n = name.trim();
    if (!n) return;
    await saveCategory({ name: n, parentId, isActive: true, sortOrder: categoryDetails.length });
  };

  const updateProfile: Store["updateProfile"] = async (patch) => {
    if (apiEnabled && getToken()) {
      try {
        const r = await api<{ user: any }>("/auth/me", { method: "PATCH", body: patch });
        setUser((current) =>
          current
            ? {
                ...current,
                name: r.user.name,
                phone: r.user.phone ?? "",
                address: r.user.address ?? {},
              }
            : current,
        );
        toast.success("Profile updated");
        return true;
      } catch (e: any) {
        toast.error(e?.message ?? "Could not update profile");
        return false;
      }
    }
    setUser((current) => (current ? { ...current, ...patch } : current));
    toast.success("Profile updated");
    return true;
  };

  const saveCategory: Store["saveCategory"] = async (category) => {
    const n = category.name.trim();
    if (!n) return;
    const payload = {
      name: n,
      slug: category.slug || slugify(n),
      parentId: category.parentId || null,
      image: category.image ?? "",
      description: category.description ?? "",
      metaTitle: category.metaTitle ?? `${n} | Shri Radha Govind Store`,
      metaDescription: category.metaDescription ?? `Shop ${n} at Shri Radha Govind Store.`,
      isActive: category.isActive ?? true,
      sortOrder: Number(category.sortOrder ?? 0),
    };
    if (apiEnabled) {
      try {
        const r = category.id
          ? await api<{ category: any }>(`/categories/${category.id}`, {
              method: "PATCH",
              body: payload,
            })
          : await api<{ category: any }>("/categories", { method: "POST", body: payload });
        const saved = mapCategory(r.category);
        setCategoryIds((m) => {
          const next = { ...m, [saved.name]: saved.id };
          for (const [name, id] of Object.entries(next)) {
            if (id === saved.id && name !== saved.name) delete next[name];
          }
          return next;
        });
        setCategoryDetails((arr) => {
          const i = arr.findIndex((x) => x.id === saved.id);
          const next =
            i >= 0 ? arr.map((x) => (x.id === saved.id ? { ...x, ...saved } : x)) : [...arr, saved];
          setCategories(next.filter((x) => x.isActive).map((x) => x.name));
          return next;
        });
        toast.success("Category saved");
      } catch (e: any) {
        toast.error(e?.message);
        throw e;
      }
    } else {
      const saved: Category = {
        id: category.id || `local-${Date.now()}`,
        productCount: 0,
        ...payload,
      };
      setCategoryDetails((arr) => {
        const next = category.id
          ? arr.map((x) => (x.id === category.id ? { ...x, ...saved } : x))
          : [...arr, saved];
        setCategories(next.filter((x) => x.isActive).map((x) => x.name));
        return next;
      });
      toast.success("Category saved");
    }
  };

  const renameCategory: Store["renameCategory"] = async (oldName, newName) => {
    const n = newName.trim();
    if (!n || oldName === n) return;
    if (apiEnabled) {
      const id = categoryIds[oldName];
      if (!id) {
        toast.error("Unknown category");
        return;
      }
      try {
        await api(`/categories/${id}`, { method: "PATCH", body: { name: n } });
        setCategoryIds((m) => {
          const x = { ...m };
          delete x[oldName];
          x[n] = id;
          return x;
        });
        setCategories((c) => c.map((x) => (x === oldName ? n : x)));
        setCategoryDetails((arr) =>
          arr.map((x) => (x.name === oldName ? { ...x, name: n, slug: slugify(n) } : x)),
        );
        setAdminProducts((arr) =>
          arr.map((p) => (p.category === oldName ? { ...p, category: n } : p)),
        );
        toast.success("Category renamed");
      } catch (e: any) {
        toast.error(e?.message);
      }
    } else {
      setCategories((c) => c.map((x) => (x === oldName ? n : x)));
      setCategoryDetails((arr) =>
        arr.map((x) => (x.name === oldName ? { ...x, name: n, slug: slugify(n) } : x)),
      );
      setAdminProducts((arr) =>
        arr.map((p) => (p.category === oldName ? { ...p, category: n } : p)),
      );
      toast.success("Category renamed");
    }
  };

  const deleteCategory: Store["deleteCategory"] = async (nameOrId) => {
    const target = categoryDetails.find(
      (category) => category.id === nameOrId || category.name === nameOrId,
    );
    const id = target?.id ?? categoryIds[nameOrId];
    const name = target?.name ?? nameOrId;
    if (apiEnabled) {
      if (!id) {
        toast.error("Unknown category");
        return;
      }
      try {
        await api(`/categories/${id}`, { method: "DELETE" });
        setCategoryIds((m) => {
          const x = { ...m };
          delete x[name];
          return x;
        });
      } catch (e: any) {
        toast.error(e?.message);
        return;
      }
    }
    setCategories((c) => c.filter((x) => x !== name));
    setCategoryDetails((arr) => arr.filter((x) => x.name !== name && x.parentId !== id));
    setAdminProducts((arr) => arr.filter((p) => p.category !== name));
    toast("Category & its products removed");
  };

  const reorderCategories: Store["reorderCategories"] = async (items) => {
    if (apiEnabled) {
      try {
        const r = await api<{ categories: any[] }>("/categories/sort/bulk", {
          method: "PATCH",
          body: { items },
        });
        const mapped = r.categories.map(mapCategory);
        setCategoryDetails(mapped);
        setCategories(mapped.filter((c) => c.isActive).map((c) => c.name));
        toast.success("Category order saved");
        return;
      } catch (e: any) {
        toast.error(e?.message);
        return;
      }
    }
    setCategoryDetails((arr) =>
      arr.map((c) => {
        const item = items.find((x) => x.id === c.id);
        return item
          ? { ...c, sortOrder: item.sortOrder, parentId: item.parentId ?? c.parentId }
          : c;
      }),
    );
    toast.success("Category order saved");
  };

  const saveBlog: Store["saveBlog"] = async (blog) => {
    const payload = { ...blog, slug: slugify(blog.slug || blog.title) };
    if (apiEnabled) {
      try {
        const isExisting = blog.id && blogs.some((x) => x.id === blog.id);
        const r = isExisting
          ? await api<{ blog: any }>(`/blogs/${blog.id}`, { method: "PATCH", body: payload })
          : await api<{ blog: any }>("/blogs", { method: "POST", body: payload });
        const saved = mapBlog(r.blog);
        setBlogs((arr) =>
          arr.some((x) => x.id === saved.id)
            ? arr.map((x) => (x.id === saved.id ? saved : x))
            : [saved, ...arr],
        );
        toast.success("Blog saved");
      } catch (e: any) {
        toast.error(e?.message ?? "Blog save failed");
      }
      return;
    }
    const saved = { ...payload, id: blog.id || `blog-${Date.now()}` };
    setBlogs((arr) =>
      arr.some((x) => x.id === saved.id)
        ? arr.map((x) => (x.id === saved.id ? saved : x))
        : [saved, ...arr],
    );
    toast.success("Blog saved");
  };

  const deleteBlog: Store["deleteBlog"] = async (id) => {
    if (apiEnabled) {
      try {
        await api(`/blogs/${id}`, { method: "DELETE" });
      } catch (e: any) {
        toast.error(e?.message ?? "Delete failed");
        return;
      }
    }
    setBlogs((arr) => arr.filter((b) => b.id !== id));
    toast("Blog deleted");
  };

  const requestPasswordReset: Store["requestPasswordReset"] = async (email) => {
    if (apiEnabled) await api("/auth/forgot-password", { method: "POST", body: { email } });
    toast.success("OTP sent if the email exists");
  };

  const verifyPasswordResetOtp: Store["verifyPasswordResetOtp"] = async (email, otp) => {
    if (apiEnabled) await api("/auth/verify-reset-otp", { method: "POST", body: { email, otp } });
    toast.success("OTP verified");
  };

  const resetPassword: Store["resetPassword"] = async (email, password) => {
    if (apiEnabled) {
      const r = await api<{ token: string; user: any }>("/auth/reset-password", {
        method: "POST",
        body: { email, password },
      });
      finishAuth(r.token, r.user);
      return;
    }
    setUser({ name: email.split("@")[0], email });
    toast.success("Password updated");
  };

  // ---- settings ----
  const updateSettings: Store["updateSettings"] = async (patch) => {
    if (apiEnabled) {
      try {
        const r = await api<{ settings: any }>("/settings", {
          method: "PATCH",
          body: { ...patch, email: patch.supportEmail },
        });
        setSettings((s) => ({ ...s, ...mapSettings(r.settings) }));
        toast.success("Settings saved");
      } catch (e: any) {
        toast.error(e?.message);
      }
    } else {
      setSettings((s) => ({ ...s, ...patch }));
      toast.success("Settings saved");
    }
  };

  // ---- registered users (admin) ----
  const fetchRegisteredUsers: Store["fetchRegisteredUsers"] = async () => {
    if (!apiEnabled) return;
    try {
      const r = await api<{ users: any[] }>("/admin/users");
      setRegisteredUsers(
        r.users.map((u: any) => ({
          id: String(u._id ?? u.id),
          name: u.name,
          email: u.email,
          phone: u.phone ?? "",
          avatar: u.avatar ?? "",
          role: u.role ?? "user",
          provider: u.provider ?? "password",
          isBlocked: !!u.isBlocked,
          address: u.address ?? {},
          ordersCount: u.ordersCount ?? 0,
          totalSpent: u.totalSpent ?? 0,
          createdAt: u.createdAt,
          lastLoginAt: u.lastLoginAt ?? null,
        })),
      );
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to load users");
    }
  };

  const toggleUserBlock: Store["toggleUserBlock"] = async (id, isBlocked) => {
    if (!apiEnabled) {
      setRegisteredUsers((arr) => arr.map((u) => (u.id === id ? { ...u, isBlocked } : u)));
      return;
    }
    try {
      await api(`/admin/users/${id}/status`, { method: "PATCH", body: { isBlocked } });
      setRegisteredUsers((arr) => arr.map((u) => (u.id === id ? { ...u, isBlocked } : u)));
      toast.success(isBlocked ? "User blocked" : "User activated");
    } catch (e: any) {
      toast.error(e?.message ?? "Action failed");
    }
  };

  const fetchOrderEvents: Store["fetchOrderEvents"] = async (id) => {
    if (!apiEnabled) return null;
    try {
      const r = await api<{ order: any; events: CourierEvent[] }>(`/admin/orders/${id}`);
      const lookup = new Map(adminProducts.map((p) => [p.id, p]));
      return { events: r.events ?? [], order: mapOrder(r.order, lookup) };
    } catch {
      return null;
    }
  };

  const value: Store = {
    apiEnabled,
    user,
    login,
    sendLoginOtp,
    verifyLoginOtp,
    createPassword,
    signup,
    loginGoogle,
    logout,
    updateProfile,
    cart,
    addToCart: (productId, qty = 1) => {
      const product = adminProducts.find((item) => item.id === productId);
      if (!product) {
        toast.error("Product is no longer available");
        return;
      }
      if (product.stock <= 0) {
        toast.error(`${product.name} is out of stock`);
        return;
      }
      const requestedQty = Math.max(1, Math.min(20, qty));
      setCart((c) => {
        const e = c.find((i) => i.productId === productId);
        const currentQty = e?.qty ?? 0;
        const nextQty = Math.min(product.stock, currentQty + requestedQty);
        if (nextQty <= currentQty) {
          toast.error(`Only ${product.stock} available`);
          return c;
        }
        if (e) return c.map((i) => (i.productId === productId ? { ...i, qty: nextQty } : i));
        return [...c, { productId, qty: nextQty }];
      });
      toast.success("Added to cart");
    },
    buyNow: (productId, qty = 1) => {
      const product = adminProducts.find((item) => item.id === productId);
      if (!product || product.stock <= 0) {
        toast.error("Product is out of stock");
        return;
      }
      setCart([{ productId, qty: Math.max(1, Math.min(product.stock, 20, qty)) }]);
    },
    updateQty: (productId, qty) =>
      setCart((c) => {
        if (qty <= 0) return c.filter((i) => i.productId !== productId);
        const product = adminProducts.find((item) => item.id === productId);
        const nextQty = Math.min(Math.max(1, qty), product?.stock ?? qty, 20);
        return c.map((i) => (i.productId === productId ? { ...i, qty: nextQty } : i));
      }),
    removeFromCart: (productId) => {
      setCart((c) => c.filter((i) => i.productId !== productId));
      toast("Removed from cart");
    },
    clearCart: () => setCart([]),
    wishlist,
    toggleWishlist: (productId) =>
      setWishlist((w) => {
        const has = w.includes(productId);
        toast(has ? "Removed from wishlist" : "Added to wishlist");
        return has ? w.filter((i) => i !== productId) : [...w, productId];
      }),
    orders,
    placeOrder,
    adminAuthed,
    adminLogin,
    adminLogout,
    adminProducts,
    refreshProducts,
    saveProduct,
    deleteProduct,
    updateOrderStatus,
    updateOrderTracking,
    categories,
    categoryDetails,
    categoryTree,
    adminCategoryTree,
    addCategory,
    saveCategory,
    renameCategory,
    deleteCategory,
    reorderCategories,
    blogs,
    saveBlog,
    deleteBlog,
    requestPasswordReset,
    verifyPasswordResetOtp,
    resetPassword,
    settings,
    updateSettings,
    customers,
    registeredUsers,
    fetchRegisteredUsers,
    toggleUserBlock,
    fetchOrderEvents,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useStore = () => {
  const v = useContext(Ctx);
  if (!v) throw new Error("useStore must be inside StoreProvider");
  return v;
};

export const formatINR = (n?: number | null) => {
  const num = typeof n === "number" && !isNaN(n) ? n : Number(n) || 0;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(num);
};
