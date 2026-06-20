import { createContext, useContext, useEffect, useState, useMemo, useCallback, type ReactNode } from "react";
import { PRODUCTS, DEFAULT_CATEGORIES, type Product } from "./products";
import { toast } from "sonner";
import { api, isApiEnabled, setToken, getToken } from "./api";

export type CartItem = { productId: string; qty: number };
export type Courier = "Ekart" | "DTDC" | "Shree Murti" | "India Post" | "Delhivery" | "Bluedart";
export const COURIERS: Courier[] = ["Ekart", "DTDC", "Shree Murti", "India Post", "Delhivery", "Bluedart"];
export type Order = {
  id: string;
  trackingId?: string;
  courier?: Courier | null;
  courierTrackingUrl?: string;
  items: { product: Product; qty: number }[];
  total: number;
  address: { name: string; phone: string; line1: string; city: string; state: string; pincode: string };
  payment: { method: "razorpay" | "cod"; status: "paid" | "pending" | "failed"; razorpayOrderId?: string; razorpayPaymentId?: string; razorpaySignature?: string };
  status: "Placed" | "Packed" | "Shipped" | "Out for delivery" | "Delivered" | "Cancelled";
  createdAt: number;
};
export type User = { id?: string; name: string; email: string; phone?: string; avatar?: string; role?: "user" | "admin" } | null;

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
  announcement: "॥ Radhe Radhe ॥ · Made With Love From The Heart Of Vrindavan · Free shipping above ₹999",
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
  updateOrderTracking: (id: string, patch: { trackingId?: string; courier?: Courier | null; courierTrackingUrl?: string; status?: Order["status"] }) => Promise<void> | void;
  verifyOrderPayment: (id: string, status: "paid" | "failed") => Promise<void> | void;
  categories: string[];
  addCategory: (name: string) => Promise<void> | void;
  renameCategory: (oldName: string, newName: string) => Promise<void> | void;
  deleteCategory: (name: string) => Promise<void> | void;
  settings: Settings;
  updateSettings: (patch: Partial<Settings>) => Promise<void> | void;
  customers: { name: string; email: string; phone: string; orders: number; spent: number }[];
};

const Ctx = createContext<Store | null>(null);
const KEY = "shri_radha_govind_v1";

function load<T>(k: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try { const v = localStorage.getItem(`${KEY}_${k}`); return v ? JSON.parse(v) : fallback; }
  catch { return fallback; }
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

const fallbackProduct = (i: any): Product => ({
  id: String(i.productId ?? i.id ?? ""),
  name: i.name ?? "Product",
  description: "",
  price: i.price ?? 0,
  mrp: 0,
  image: i.image ?? "",
  images: [],
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
  payment: { method: o.payment?.method ?? "cod", status: (o.payment?.status as any) ?? "pending" },
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
  // backend category name → id
  const [categoryIds, setCategoryIds] = useState<Record<string, string>>({});
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);

  // ---- initial load (local + remote) ----
  useEffect(() => {
    setUser(load("user", null));
    setCart(load("cart", []));
    setWishlist(load("wishlist", []));
    setAdminProducts(load("products", PRODUCTS));
    setCategories(load("categories", DEFAULT_CATEGORIES));
    setOrders(load("orders", []));
    setSettings({ ...DEFAULT_SETTINGS, ...load("settings", {}) });
    if (!apiEnabled) return;

    (async () => {
      try {
        const [prodRes, catRes, setRes] = await Promise.all([
          api<{ products: any[] }>("/products"),
          api<{ categories: any[] }>("/categories"),
          api<{ settings: any }>("/settings"),
        ]);
        const products = prodRes.products.map(mapProduct);
        setAdminProducts(products);
        setCategories(catRes.categories.map((c) => c.name));
        setCategoryIds(Object.fromEntries(catRes.categories.map((c) => [c.name, String(c._id)])));
        setSettings((s) => ({ ...s, ...mapSettings(setRes.settings) }));

        if (getToken()) {
          try {
            const me = await api<{ user: any }>("/auth/me");
            setUser({ id: me.user.id, name: me.user.name, email: me.user.email, role: me.user.role, avatar: me.user.avatar });
            const ord = await api<{ orders: any[] }>("/orders");
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
  useEffect(() => save("settings", settings), [settings]);

  const adminAuthed = !!user && user.role === "admin";

  const refreshOrders = useCallback(async () => {
    if (!apiEnabled || !getToken()) return;
    try {
      const ord = await api<{ orders: any[] }>("/orders");
      const lookup = new Map(adminProducts.map((p) => [p.id, p]));
      setOrders(ord.orders.map((o) => mapOrder(o, lookup)));
    } catch { /* ignore */ }
  }, [apiEnabled, adminProducts]);

  const customers = useMemo(() => {
    const map = new Map<string, { name: string; email: string; phone: string; orders: number; spent: number }>();
    for (const o of orders) {
      const key = o.address.phone || o.address.name;
      const e = map.get(key);
      if (e) { e.orders++; e.spent += o.total; }
      else map.set(key, { name: o.address.name, email: "—", phone: o.address.phone, orders: 1, spent: o.total });
    }
    return Array.from(map.values()).sort((a, b) => b.spent - a.spent);
  }, [orders]);

  // ---- auth ----
  const finishAuth = (token: string, u: any) => {
    setToken(token);
    setUser({ id: u.id, name: u.name, email: u.email, role: u.role, avatar: u.avatar });
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
        await refreshOrders();
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
        await refreshOrders();
      } catch (e: any) {
        toast.error(e?.message ?? "Google sign-in failed");
      }
    } else {
      setUser({ email: "devotee@gmail.com", name: "Krishna Devotee", avatar: "https://api.dicebear.com/9.x/initials/svg?seed=KD" });
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
        await refreshOrders();
        return true;
      } catch (e: any) {
        toast.error(e?.message ?? "Invalid admin credentials");
        return false;
      }
    }
    // local fallback
    if ((email === "deepakjadon1907@gmail.com" && pass === "deepakjadon1907@") || (email === "admin" && pass === "admin123")) {
      setUser({ name: "Admin", email, role: "admin" });
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
          if (i >= 0) { const next = [...arr]; next[i] = saved; return next; }
          return [saved, ...arr];
        });
        toast.success("Product saved");
      } catch (e: any) {
        toast.error(e?.message ?? "Save failed");
      }
    } else {
      setAdminProducts((arr) => {
        const i = arr.findIndex((x) => x.id === p.id);
        if (i >= 0) { const next = [...arr]; next[i] = p; return next; }
        return [{ ...p, id: p.id || `p${Date.now()}` }, ...arr];
      });
    }
  };

  const deleteProduct: Store["deleteProduct"] = async (id) => {
    if (apiEnabled) {
      try { await api(`/products/${id}`, { method: "DELETE" }); } catch (e: any) { toast.error(e?.message); return; }
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
    const order: Order = { ...o, id: `OD${Date.now().toString().slice(-8)}`, createdAt: Date.now(), status: "Placed" };
    setOrders((arr) => [order, ...arr]);
    setCart([]);
    return order;
  };

  const updateOrderStatus: Store["updateOrderStatus"] = async (id, status) => {
    if (apiEnabled) {
      try { await api(`/admin/orders/${id}/status`, { method: "PATCH", body: { status } }); }
      catch (e: any) { toast.error(e?.message); return; }
    }
    setOrders((arr) => arr.map((o) => o.id === id ? { ...o, status } : o));
  };

  const updateOrderTracking: Store["updateOrderTracking"] = async (id, patch) => {
    if (apiEnabled) {
      try {
        const r = await api<{ order: any }>(`/admin/orders/${id}`, { method: "PATCH", body: patch });
        const lookup = new Map(adminProducts.map((p) => [p.id, p]));
        const updated = mapOrder(r.order, lookup);
        setOrders((arr) => arr.map((o) => o.id === id ? updated : o));
        toast.success("Order updated");
        return;
      } catch (e: any) { toast.error(e?.message); return; }
    }
    setOrders((arr) => arr.map((o) => o.id === id ? { ...o, ...patch } : o));
    toast.success("Order updated");
  };

  const verifyOrderPayment: Store["verifyOrderPayment"] = async (id, status) => {
    if (apiEnabled) {
      try {
        const r = await api<{ order: any }>(`/admin/orders/${id}/payment`, { method: "PATCH", body: { status } });
        const lookup = new Map(adminProducts.map((p) => [p.id, p]));
        const updated = mapOrder(r.order, lookup);
        setOrders((arr) => arr.map((o) => o.id === id ? updated : o));
        toast.success(status === "paid" ? "Payment marked paid · email sent" : "Payment marked failed · order cancelled");
        return;
      } catch (e: any) { toast.error(e?.message); return; }
    }
    setOrders((arr) => arr.map((o) => o.id === id ? { ...o, payment: { ...o.payment, status }, status: status === "failed" ? "Cancelled" : o.status } : o));
    toast.success(status === "paid" ? "Marked paid" : "Marked failed · cancelled");
  };


  // ---- categories ----
  const addCategory: Store["addCategory"] = async (name) => {
    const n = name.trim(); if (!n) return;
    if (apiEnabled) {
      try {
        const r = await api<{ category: any }>("/categories", { method: "POST", body: { name: n } });
        setCategoryIds((m) => ({ ...m, [r.category.name]: String(r.category._id) }));
        setCategories((c) => c.includes(r.category.name) ? c : [...c, r.category.name]);
        toast.success(`Category "${n}" added`);
      } catch (e: any) { toast.error(e?.message); }
    } else {
      setCategories((c) => c.includes(n) ? c : [...c, n]);
      toast.success(`Category "${n}" added`);
    }
  };

  const renameCategory: Store["renameCategory"] = async (oldName, newName) => {
    const n = newName.trim(); if (!n || oldName === n) return;
    if (apiEnabled) {
      const id = categoryIds[oldName];
      if (!id) { toast.error("Unknown category"); return; }
      try {
        await api(`/categories/${id}`, { method: "PATCH", body: { name: n } });
        setCategoryIds((m) => { const x = { ...m }; delete x[oldName]; x[n] = id; return x; });
        setCategories((c) => c.map((x) => x === oldName ? n : x));
        setAdminProducts((arr) => arr.map((p) => p.category === oldName ? { ...p, category: n } : p));
        toast.success("Category renamed");
      } catch (e: any) { toast.error(e?.message); }
    } else {
      setCategories((c) => c.map((x) => x === oldName ? n : x));
      setAdminProducts((arr) => arr.map((p) => p.category === oldName ? { ...p, category: n } : p));
      toast.success("Category renamed");
    }
  };

  const deleteCategory: Store["deleteCategory"] = async (name) => {
    if (apiEnabled) {
      const id = categoryIds[name];
      if (!id) { toast.error("Unknown category"); return; }
      try {
        await api(`/categories/${id}`, { method: "DELETE" });
        setCategoryIds((m) => { const x = { ...m }; delete x[name]; return x; });
      } catch (e: any) { toast.error(e?.message); return; }
    }
    setCategories((c) => c.filter((x) => x !== name));
    setAdminProducts((arr) => arr.filter((p) => p.category !== name));
    toast("Category & its products removed");
  };

  // ---- settings ----
  const updateSettings: Store["updateSettings"] = async (patch) => {
    if (apiEnabled) {
      try {
        const r = await api<{ settings: any }>("/settings", { method: "PATCH", body: { ...patch, email: patch.supportEmail } });
        setSettings((s) => ({ ...s, ...mapSettings(r.settings) }));
        toast.success("Settings saved");
      } catch (e: any) { toast.error(e?.message); }
    } else {
      setSettings((s) => ({ ...s, ...patch }));
      toast.success("Settings saved");
    }
  };

  const value: Store = {
    apiEnabled,
    user,
    login,
    signup,
    loginGoogle,
    logout,
    cart,
    addToCart: (productId, qty = 1) => {
      setCart((c) => {
        const e = c.find((i) => i.productId === productId);
        if (e) return c.map((i) => i.productId === productId ? { ...i, qty: i.qty + qty } : i);
        return [...c, { productId, qty }];
      });
      toast.success("Added to cart");
    },
    buyNow: (productId, qty = 1) => setCart([{ productId, qty }]),
    updateQty: (productId, qty) =>
      setCart((c) => qty <= 0 ? c.filter((i) => i.productId !== productId) : c.map((i) => i.productId === productId ? { ...i, qty } : i)),
    removeFromCart: (productId) => { setCart((c) => c.filter((i) => i.productId !== productId)); toast("Removed from cart"); },
    clearCart: () => setCart([]),
    wishlist,
    toggleWishlist: (productId) => setWishlist((w) => {
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
    addCategory,
    renameCategory,
    deleteCategory,
    settings,
    updateSettings,
    customers,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useStore = () => {
  const v = useContext(Ctx);
  if (!v) throw new Error("useStore must be inside StoreProvider");
  return v;
};

export const formatINR = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
