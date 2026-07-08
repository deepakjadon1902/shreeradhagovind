import {
  createContext,
  useContext,
  useEffect,
  useState,
  useMemo,
  useCallback,
  type ReactNode,
} from "react";
import { PRODUCTS, DEFAULT_CATEGORIES, DEFAULT_CATEGORY_TREE, type Product } from "./products";
import { toast } from "sonner";
import { api, isApiEnabled, setToken, getToken } from "./api";

export type CartItem = { productId: string; qty: number };
export type Courier = "Ekart" | "DTDC" | "Shree Murti" | "India Post" | "Delhivery" | "Bluedart";
export const COURIERS: Courier[] = [
  "Ekart",
  "DTDC",
  "Shree Murti",
  "India Post",
  "Delhivery",
  "Bluedart",
];
export type PaymentStatus = "paid" | "pending" | "failed" | "refunded";
export type Order = {
  id: string;
  trackingId?: string;
  courier?: Courier | null;
  courierTrackingUrl?: string;
  items: { product: Product; qty: number }[];
  total: number;
  address: {
    name: string;
    phone: string;
    line1: string;
    city: string;
    state: string;
    pincode: string;
  };
  payment: {
    method: "razorpay" | "cod";
    status: PaymentStatus;
    razorpayOrderId?: string;
    razorpayPaymentId?: string;
    razorpaySignature?: string;
    failureReason?: string;
  };
  status: "Placed" | "Packed" | "Shipped" | "Out for delivery" | "Delivered" | "Cancelled";
  createdAt: number;
};
export type Address = { line1: string; city: string; state: string; pincode: string };
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
  currency: string;
  freeShipThreshold: number;
  shippingFee: number;
  razorpayKeyId: string;
  codEnabled: boolean;
  announcement: string;
};

const DEFAULT_SETTINGS: Settings = {
  siteName: "Shri Radha Govind Store",
  tagline: "Made With Love From The Heart Of Vrindavan",
  supportEmail: "support@shriradhagovindstore.com",
  supportPhone: "+91 7500533505",
  currency: "INR",
  freeShipThreshold: 999,
  shippingFee: 49,
  razorpayKeyId: "rzp_test_XXXXXXXXXXXXXX",
  codEnabled: true,
  announcement:
    "॥ Radhe Radhe ॥ · Made With Love From The Heart Of Vrindavan · Free shipping above ₹999",
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
    },
  ) => Promise<void> | void;
  verifyOrderPayment: (id: string, status: PaymentStatus) => Promise<void> | void;
  categories: string[];
  addCategory: (name: string, parentId?: string | null) => Promise<void> | void;
  renameCategory: (oldName: string, newName: string) => Promise<void> | void;
  deleteCategory: (name: string) => Promise<void> | void;
  settings: Settings;
  updateSettings: (patch: Partial<Settings>) => Promise<void> | void;
  customers: { name: string; email: string; phone: string; orders: number; spent: number }[];
  registeredUsers: RegisteredUser[];
  fetchRegisteredUsers: () => Promise<void>;
  toggleUserBlock: (id: string, isBlocked: boolean) => Promise<void>;
  fetchOrderEvents: (id: string) => Promise<{ events: CourierEvent[]; order: Order } | null>;
  categoryDetails: Category[];
  categoryTree: (Category & { children: Category[] })[];
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
  name: p.name,
  description: p.description ?? "",
  price: p.price,
  mrp: p.mrp ?? p.compareAtPrice ?? 0,
  image: p.image ?? "",
  images: p.images ?? [],
  featuredDeal: !!p.featuredDeal,
  category: p.category,
  stock: p.stock ?? 100,
  rating: p.rating ?? 4.7,
  reviews: p.reviews ?? 0,
  details: p.details ?? [],
});

const mapSettings = (s: any): Partial<Settings> => ({
  siteName: s.siteName,
  tagline: s.tagline,
  supportEmail: s.email ?? s.supportEmail,
  currency: s.currency,
  freeShipThreshold: s.freeShipThreshold,
  shippingFee: s.shippingFee,
  razorpayKeyId: s.razorpayKeyId,
  codEnabled: s.codEnabled,
  announcement: s.announcement,
});

const slugify = (s: string) =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

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
  price: i.price ?? 0,
  mrp: 0,
  image: i.image ?? "",
  images: [],
  featuredDeal: false,
  category: "",
  stock: 0,
  rating: 5,
  reviews: 0,
  details: [],
});

const mapOrder = (o: any, productLookup: Map<string, Product>): Order => ({
  id: String(o._id ?? o.id),
  trackingId: o.trackingId ?? undefined,
  courier: o.courier ?? null,
  courierTrackingUrl: o.courierTrackingUrl ?? "",
  items: (o.items ?? []).map((i: any) => ({
    product: productLookup.get(String(i.productId)) ?? fallbackProduct(i),
    qty: i.qty,
  })),
  total: o.total,
  address: o.address ?? { name: "", phone: "", line1: "", city: "", state: "", pincode: "" },
  payment: {
    method: o.payment?.method ?? "cod",
    status: (o.payment?.status as PaymentStatus) ?? "pending",
    razorpayOrderId: o.payment?.razorpayOrderId,
    razorpayPaymentId: o.payment?.razorpayPaymentId,
    razorpaySignature: o.payment?.razorpaySignature,
    failureReason: o.payment?.failureReason,
  },
  status: o.status ?? "Placed",
  createdAt: o.createdAt ? new Date(o.createdAt).getTime() : Date.now(),
});

export function StoreProvider({ children }: { children: ReactNode }) {
  const apiEnabled = isApiEnabled();
  const [user, setUser] = useState<User>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [wishlist, setWishlist] = useState<string[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [adminProducts, setAdminProducts] = useState<Product[]>(PRODUCTS);
  const [categories, setCategories] = useState<string[]>(DEFAULT_CATEGORIES);
  const [categoryDetails, setCategoryDetails] = useState<Category[]>(DEFAULT_CATEGORY_DETAILS);
  // backend category name → id
  const [categoryIds, setCategoryIds] = useState<Record<string, string>>({});
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [registeredUsers, setRegisteredUsers] = useState<RegisteredUser[]>([]);
  const [blogs, setBlogs] = useState<Blog[]>([]);

  // ---- initial load (local + remote) ----
  useEffect(() => {
    setUser(load("user", null));
    setCart(load("cart", []));
    setWishlist(load("wishlist", []));
    setAdminProducts(load("products", PRODUCTS));
    setCategories(load("categories", DEFAULT_CATEGORIES));
    setCategoryDetails(load("categoryDetails", DEFAULT_CATEGORY_DETAILS));
    setBlogs(load("blogs", []));
    setOrders(load("orders", []));
    setSettings({ ...DEFAULT_SETTINGS, ...load("settings", {}) });
    if (!apiEnabled) return;

    (async () => {
      try {
        const [prodRes, catRes, setRes, blogRes] = await Promise.all([
          api<{ products: any[] }>("/products"),
          api<{ categories: any[] }>("/categories"),
          api<{ settings: any }>("/settings"),
          api<{ blogs: any[] }>("/blogs?all=true"),
        ]);
        const products = prodRes.products.map(mapProduct);
        const mappedCategories = catRes.categories.map(mapCategory);
        setAdminProducts(products);
        setCategoryDetails(mappedCategories);
        setCategories(mappedCategories.filter((c) => c.isActive).map((c) => c.name));
        setCategoryIds(Object.fromEntries(mappedCategories.map((c) => [c.name, c.id])));
        setSettings((s) => ({ ...s, ...mapSettings(setRes.settings) }));
        setBlogs(blogRes.blogs.map(mapBlog));

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
            const lookup = new Map(products.map((p) => [p.id, p]));
            setOrders(ord.orders.map((o) => mapOrder(o, lookup)));
          } catch {
            setToken(null);
            setUser(null);
          }
        }
      } catch (e: any) {
        console.warn("[api] initial load failed:", e?.message);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- local persistence ----
  useEffect(() => save("user", user), [user]);
  useEffect(() => save("cart", cart), [cart]);
  useEffect(() => save("wishlist", wishlist), [wishlist]);
  useEffect(() => save("orders", orders), [orders]);
  useEffect(() => save("products", adminProducts), [adminProducts]);
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
        setOrders(ord.orders.map((o) => mapOrder(o, lookup)));
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
    for (const o of orders) {
      const key = o.address.phone || o.address.name;
      const e = map.get(key);
      if (e) {
        e.orders++;
        e.spent += o.total;
      } else
        map.set(key, {
          name: o.address.name,
          email: "—",
          phone: o.address.phone,
          orders: 1,
          spent: o.total,
        });
    }
    return Array.from(map.values()).sort((a, b) => b.spent - a.spent);
  }, [orders]);

  const categoryTree = useMemo(() => {
    const active = categoryDetails
      .filter((c) => c.isActive)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
    return active
      .filter((c) => !c.parentId)
      .map((parent) => ({ ...parent, children: active.filter((c) => c.parentId === parent.id) }));
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
        await refreshOrders(true);
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
          rating: Number(p.rating ?? 4.7),
          reviews: Number(p.reviews ?? 0),
          details: p.details ?? [],
        };
        const isExisting = p.id && adminProducts.some((x) => x.id === p.id);
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
        toast.success("Product saved");
      } catch (e: any) {
        toast.error(e?.message ?? "Save failed");
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
    toast("Product deleted");
  };

  // ---- orders ----
  const placeOrder: Store["placeOrder"] = async (o) => {
    if (apiEnabled && getToken()) {
      try {
        const r = await api<{ order: any }>("/orders", {
          method: "POST",
          body: {
            items: o.items.map((i) => ({ productId: i.product.id, qty: i.qty })),
            address: o.address,
            payment: {
              method: o.payment.method,
              status: o.payment.status,
              razorpayOrderId: o.payment.razorpayOrderId,
              razorpayPaymentId: o.payment.razorpayPaymentId,
              razorpaySignature: o.payment.razorpaySignature,
            },
          },
        });
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

  const verifyOrderPayment: Store["verifyOrderPayment"] = async (id, status) => {
    if (apiEnabled) {
      try {
        const r = await api<{ order: any }>(`/admin/orders/${id}/payment`, {
          method: "PATCH",
          body: { status },
        });
        const lookup = new Map(adminProducts.map((p) => [p.id, p]));
        const updated = mapOrder(r.order, lookup);
        setOrders((arr) => arr.map((o) => (o.id === id ? updated : o)));
        toast.success(
          status === "paid"
            ? "Payment marked paid · email sent"
            : status === "failed"
              ? "Payment marked failed · order cancelled"
              : `Payment marked ${status}`,
        );
        return;
      } catch (e: any) {
        toast.error(e?.message);
        return;
      }
    }
    setOrders((arr) =>
      arr.map((o) =>
        o.id === id
          ? {
              ...o,
              payment: { ...o.payment, status },
              status: status === "failed" ? "Cancelled" : o.status,
            }
          : o,
      ),
    );
    toast.success(
      status === "paid"
        ? "Marked paid"
        : status === "failed"
          ? "Marked failed · cancelled"
          : `Marked ${status}`,
    );
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
        setCategoryIds((m) => ({ ...m, [saved.name]: saved.id }));
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

  const deleteCategory: Store["deleteCategory"] = async (name) => {
    if (apiEnabled) {
      const id = categoryIds[name];
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
    setCategoryDetails((arr) =>
      arr.filter((x) => x.name !== name && x.parentId !== categoryIds[name]),
    );
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
    const payload = { ...blog, slug: blog.slug || slugify(blog.title) };
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
    signup,
    loginGoogle,
    logout,
    updateProfile,
    cart,
    addToCart: (productId, qty = 1) => {
      setCart((c) => {
        const e = c.find((i) => i.productId === productId);
        if (e) return c.map((i) => (i.productId === productId ? { ...i, qty: i.qty + qty } : i));
        return [...c, { productId, qty }];
      });
      toast.success("Added to cart");
    },
    buyNow: (productId, qty = 1) => setCart([{ productId, qty }]),
    updateQty: (productId, qty) =>
      setCart((c) =>
        qty <= 0
          ? c.filter((i) => i.productId !== productId)
          : c.map((i) => (i.productId === productId ? { ...i, qty } : i)),
      ),
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
    saveProduct,
    deleteProduct,
    updateOrderStatus,
    updateOrderTracking,
    verifyOrderPayment,
    categories,
    categoryDetails,
    categoryTree,
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

export const formatINR = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);
