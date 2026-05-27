import { createContext, useContext, useEffect, useState, useMemo, type ReactNode } from "react";
import { PRODUCTS, DEFAULT_CATEGORIES, type Product } from "./products";
import { toast } from "sonner";

export type CartItem = { productId: string; qty: number };
export type Order = {
  id: string;
  items: { product: Product; qty: number }[];
  total: number;
  address: { name: string; phone: string; line1: string; city: string; state: string; pincode: string };
  payment: { method: "razorpay" | "cod"; status: "paid" | "pending" };
  status: "Placed" | "Packed" | "Shipped" | "Out for delivery" | "Delivered";
  createdAt: number;
};
export type User = { name: string; email: string; phone?: string; avatar?: string } | null;

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
  siteName: "Vrindavan",
  tagline: "Sacred goods from the land of Krishna",
  supportEmail: "support@vrindavan.shop",
  supportPhone: "+91 98765 43210",
  currency: "INR",
  freeShipThreshold: 999,
  shippingFee: 49,
  razorpayKeyId: "rzp_test_XXXXXXXXXXXXXX",
  codEnabled: true,
  announcement: "॥ Radhe Radhe ॥ · Free shipping above ₹999 across India",
};

type Store = {
  user: User;
  login: (email: string, name?: string) => void;
  loginGoogle: () => void;
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
  placeOrder: (o: Omit<Order, "id" | "createdAt" | "status">) => Order;
  // admin
  adminAuthed: boolean;
  adminLogin: (u: string, p: string) => boolean;
  adminLogout: () => void;
  adminProducts: Product[];
  saveProduct: (p: Product) => void;
  deleteProduct: (id: string) => void;
  updateOrderStatus: (id: string, status: Order["status"]) => void;
  categories: string[];
  addCategory: (name: string) => void;
  renameCategory: (oldName: string, newName: string) => void;
  deleteCategory: (name: string) => void;
  settings: Settings;
  updateSettings: (patch: Partial<Settings>) => void;
  customers: { name: string; email: string; phone: string; orders: number; spent: number }[];
};

const Ctx = createContext<Store | null>(null);
const KEY = "vrindavan_v1";

function load<T>(k: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try { const v = localStorage.getItem(`${KEY}_${k}`); return v ? JSON.parse(v) : fallback; }
  catch { return fallback; }
}
function save(k: string, v: unknown) {
  if (typeof window === "undefined") return;
  localStorage.setItem(`${KEY}_${k}`, JSON.stringify(v));
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [wishlist, setWishlist] = useState<string[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [adminAuthed, setAdminAuthed] = useState(false);
  const [adminProducts, setAdminProducts] = useState<Product[]>(PRODUCTS);
  const [categories, setCategories] = useState<string[]>(DEFAULT_CATEGORIES);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);

  useEffect(() => {
    setUser(load("user", null));
    setCart(load("cart", []));
    setWishlist(load("wishlist", []));
    setOrders(load("orders", []));
    setAdminAuthed(load("admin", false));
    setAdminProducts(load("products", PRODUCTS));
    setCategories(load("categories", DEFAULT_CATEGORIES));
    setSettings({ ...DEFAULT_SETTINGS, ...load("settings", {}) });
  }, []);

  useEffect(() => save("user", user), [user]);
  useEffect(() => save("cart", cart), [cart]);
  useEffect(() => save("wishlist", wishlist), [wishlist]);
  useEffect(() => save("orders", orders), [orders]);
  useEffect(() => save("admin", adminAuthed), [adminAuthed]);
  useEffect(() => save("products", adminProducts), [adminProducts]);
  useEffect(() => save("categories", categories), [categories]);
  useEffect(() => save("settings", settings), [settings]);

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

  const value: Store = {
    user,
    login: (email, name) => { setUser({ email, name: name ?? email.split("@")[0] }); toast.success("Welcome back!"); },
    loginGoogle: () => { setUser({ email: "devotee@gmail.com", name: "Krishna Devotee", avatar: "https://api.dicebear.com/9.x/initials/svg?seed=KD" }); toast.success("Signed in with Google"); },
    logout: () => { setUser(null); toast("Logged out"); },
    cart,
    addToCart: (productId, qty = 1) => {
      setCart((c) => {
        const e = c.find((i) => i.productId === productId);
        if (e) return c.map((i) => i.productId === productId ? { ...i, qty: i.qty + qty } : i);
        return [...c, { productId, qty }];
      });
      toast.success("Added to cart");
    },
    buyNow: (productId, qty = 1) => {
      setCart([{ productId, qty }]);
    },
    updateQty: (productId, qty) => setCart((c) => qty <= 0 ? c.filter((i) => i.productId !== productId) : c.map((i) => i.productId === productId ? { ...i, qty } : i)),
    removeFromCart: (productId) => { setCart((c) => c.filter((i) => i.productId !== productId)); toast("Removed from cart"); },
    clearCart: () => setCart([]),
    wishlist,
    toggleWishlist: (productId) => setWishlist((w) => {
      const has = w.includes(productId);
      toast(has ? "Removed from wishlist" : "Added to wishlist");
      return has ? w.filter((i) => i !== productId) : [...w, productId];
    }),
    orders,
    placeOrder: (o) => {
      const order: Order = { ...o, id: `OD${Date.now().toString().slice(-8)}`, createdAt: Date.now(), status: "Placed" };
      setOrders((arr) => [order, ...arr]);
      setCart([]);
      return order;
    },
    adminAuthed,
    adminLogin: (u, p) => {
      const user = (u ?? "").trim().toLowerCase();
      const pass = (p ?? "").trim();
      if ((user === "deepakjadon1907@gmail.com" && pass === "deepakjadon1907@") || (user === "admin" && pass === "admin123")) { setAdminAuthed(true); toast.success("Admin authenticated"); return true; }
      toast.error("Invalid admin credentials"); return false;
    },
    adminLogout: () => setAdminAuthed(false),
    adminProducts,
    saveProduct: (p) => setAdminProducts((arr) => {
      const i = arr.findIndex((x) => x.id === p.id);
      if (i >= 0) { const next = [...arr]; next[i] = p; return next; }
      return [{ ...p, id: p.id || `p${Date.now()}` }, ...arr];
    }),
    deleteProduct: (id) => setAdminProducts((arr) => arr.filter((p) => p.id !== id)),
    updateOrderStatus: (id, status) => setOrders((arr) => arr.map((o) => o.id === id ? { ...o, status } : o)),
    categories,
    addCategory: (name) => {
      const n = name.trim();
      if (!n) return;
      setCategories((c) => c.includes(n) ? c : [...c, n]);
      toast.success(`Category "${n}" added`);
    },
    renameCategory: (oldName, newName) => {
      const n = newName.trim();
      if (!n || oldName === n) return;
      setCategories((c) => c.map((x) => x === oldName ? n : x));
      setAdminProducts((arr) => arr.map((p) => p.category === oldName ? { ...p, category: n } : p));
      toast.success("Category renamed");
    },
    deleteCategory: (name) => {
      setCategories((c) => c.filter((x) => x !== name));
      setAdminProducts((arr) => arr.filter((p) => p.category !== name));
      toast("Category & its products removed");
    },
    settings,
    updateSettings: (patch) => { setSettings((s) => ({ ...s, ...patch })); toast.success("Settings saved"); },
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
