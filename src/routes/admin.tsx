import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useStore, formatINR, type Order, type Settings } from "@/lib/store";
import { type Product } from "@/lib/products";
import { Lock, LayoutDashboard, Package, ShoppingCart, LogOut, Plus, Pencil, Trash2, IndianRupee, TrendingUp, Users, Tag, CreditCard, Settings as SettingsIcon } from "lucide-react";

export const Route = createFileRoute("/admin")({
  component: AdminRoot,
  head: () => ({ meta: [{ title: "Admin · Shri Radha Govind Store" }, { name: "robots", content: "noindex,nofollow" }] }),
});

type Tab = "dash" | "products" | "orders" | "categories" | "users" | "payments" | "settings";

function AdminRoot() {
  const { adminAuthed, adminLogin, adminLogout, adminProducts, saveProduct, deleteProduct, orders, updateOrderStatus, categories, addCategory, renameCategory, deleteCategory, customers, settings, updateSettings } = useStore();
  const [u, setU] = useState(""); const [p, setP] = useState("");
  const [tab, setTab] = useState<Tab>("dash");
  const [editing, setEditing] = useState<Product | null>(null);
  const [pickCat, setPickCat] = useState<string | null>(null);

  if (!adminAuthed) {
    return (
      <div className="min-h-screen grid place-items-center bg-foreground/95 text-background p-6">
        <div className="w-full max-w-sm">
          <div className="flex items-center gap-2 mb-8 justify-center">
            <span className="h-10 w-10 rounded-full gold-accent grid place-items-center text-white font-display">वृ</span>
            <span className="font-display text-2xl">Vrindavan Admin</span>
          </div>
          <div className="bg-card text-foreground rounded-2xl p-8 premium-shadow">
            <Lock className="h-8 w-8 text-primary mx-auto" />
            <h1 className="font-display text-2xl text-center mt-3">Secure Admin Access</h1>
            <p className="text-sm text-muted-foreground text-center mt-1">Authorized personnel only</p>
            <form onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const user = String(fd.get("user") ?? u).trim();
              const pass = String(fd.get("pass") ?? p);
              adminLogin(user, pass);
            }} className="space-y-3 mt-6">
              <input name="user" autoComplete="username" value={u} onChange={(e) => setU(e.target.value)} placeholder="Email or username" className="w-full h-11 rounded-lg border px-3 bg-background focus:outline-none focus:border-primary" />
              <input name="pass" autoComplete="current-password" value={p} onChange={(e) => setP(e.target.value)} type="password" placeholder="Password" className="w-full h-11 rounded-lg border px-3 bg-background focus:outline-none focus:border-primary" />
              <button type="submit" className="w-full h-11 rounded-lg bg-primary text-primary-foreground font-medium">Sign in</button>
            </form>
            <p className="text-[11px] text-muted-foreground text-center mt-4">Demo: <code className="bg-muted px-1.5 py-0.5 rounded">deepakjadon1907@gmail.com</code> / <code className="bg-muted px-1.5 py-0.5 rounded">deepakjadon1907@</code></p>
            <Link to="/" className="block text-center text-xs text-muted-foreground mt-4 hover:text-primary">← Back to store</Link>
          </div>
        </div>
      </div>
    );
  }

  const revenue = orders.reduce((s, o) => s + o.total, 0);
  const pending = orders.filter((o) => o.status !== "Delivered").length;

  const openNewProduct = () => setPickCat("");

  const createWithCategory = (category: string) => {
    setPickCat(null);
    setEditing({ id: "", name: "", category, price: 0, mrp: 0, rating: 4.5, reviews: 0, image: "https://images.unsplash.com/photo-1604608672516-f1b9b1d1f1f4?auto=format&fit=crop&w=900&q=80", description: "", details: [], stock: 0 });
  };

  return (
    <div className="min-h-screen flex bg-muted/30">
      <aside className="w-60 bg-foreground text-background p-5 flex flex-col">
        <div className="flex items-center gap-2 mb-10">
          <span className="h-9 w-9 rounded-full gold-accent grid place-items-center text-white font-display">वृ</span>
          <span className="font-display text-lg">Admin Panel</span>
        </div>
        <nav className="space-y-1 flex-1">
          <NavBtn active={tab === "dash"} onClick={() => setTab("dash")} icon={LayoutDashboard}>Dashboard</NavBtn>
          <NavBtn active={tab === "categories"} onClick={() => setTab("categories")} icon={Tag}>Categories</NavBtn>
          <NavBtn active={tab === "products"} onClick={() => setTab("products")} icon={Package}>Products</NavBtn>
          <NavBtn active={tab === "orders"} onClick={() => setTab("orders")} icon={ShoppingCart}>Orders</NavBtn>
          <NavBtn active={tab === "payments"} onClick={() => setTab("payments")} icon={CreditCard}>Payments</NavBtn>
          <NavBtn active={tab === "users"} onClick={() => setTab("users")} icon={Users}>Customers</NavBtn>
          <NavBtn active={tab === "settings"} onClick={() => setTab("settings")} icon={SettingsIcon}>Settings</NavBtn>
        </nav>
        <button onClick={adminLogout} className="flex items-center gap-2 text-sm text-background/70 hover:text-background py-2"><LogOut className="h-4 w-4" /> Logout</button>
        <Link to="/" className="text-xs text-background/50 hover:text-background mt-2">← View store</Link>
      </aside>

      <main className="flex-1 p-6 md:p-10 overflow-x-auto">
        {tab === "dash" && (
          <div>
            <h1 className="font-display text-3xl">Dashboard</h1>
            <p className="text-sm text-muted-foreground">Welcome back, Admin</p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
              <Stat icon={IndianRupee} label="Revenue" value={formatINR(revenue)} />
              <Stat icon={ShoppingCart} label="Total Orders" value={String(orders.length)} />
              <Stat icon={TrendingUp} label="Pending" value={String(pending)} />
              <Stat icon={Package} label="Products" value={String(adminProducts.length)} />
            </div>
            <div className="mt-8 bg-card rounded-2xl p-6 premium-shadow">
              <h2 className="font-display text-xl mb-4">Recent Orders</h2>
              {orders.slice(0, 5).length === 0 ? <p className="text-sm text-muted-foreground">No orders yet.</p> : (
                <table className="w-full text-sm">
                  <thead className="text-left text-muted-foreground text-xs uppercase tracking-wider">
                    <tr><th className="py-2">ID</th><th>Customer</th><th>Total</th><th>Status</th></tr>
                  </thead>
                  <tbody>
                    {orders.slice(0, 5).map((o) => (
                      <tr key={o.id} className="border-t"><td className="py-3">#{o.id}</td><td>{o.address.name}</td><td>{formatINR(o.total)}</td><td><span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs">{o.status}</span></td></tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {tab === "categories" && (
          <div>
            <h1 className="font-display text-3xl">Categories</h1>
            <p className="text-sm text-muted-foreground">Manage the categories shown across the store.</p>
            <form onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); const name = String(fd.get("cat") ?? "").trim(); if (name) { addCategory(name); e.currentTarget.reset(); } }} className="flex gap-2 mt-6 max-w-md">
              <input name="cat" placeholder="New category name" className="flex-1 h-11 rounded-lg border px-3 bg-card focus:outline-none focus:border-primary" />
              <button className="h-11 px-5 rounded-lg bg-primary text-primary-foreground text-sm font-medium inline-flex items-center gap-2"><Plus className="h-4 w-4" /> Add</button>
            </form>
            <div className="mt-6 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {categories.map((c) => {
                const count = adminProducts.filter((p) => p.category === c).length;
                return (
                  <div key={c} className="bg-card rounded-2xl p-5 premium-shadow">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-display text-lg">{c}</p>
                        <p className="text-xs text-muted-foreground mt-1">{count} product{count === 1 ? "" : "s"}</p>
                      </div>
                      <div className="flex gap-1">
                        <button onClick={() => { const n = prompt("Rename category", c); if (n) renameCategory(c, n); }} className="p-2 hover:bg-muted rounded-lg" aria-label="Rename"><Pencil className="h-4 w-4" /></button>
                        <button onClick={() => { if (confirm(`Delete category "${c}" and its ${count} product(s)?`)) deleteCategory(c); }} className="p-2 hover:bg-destructive/10 hover:text-destructive rounded-lg" aria-label="Delete"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {tab === "products" && (
          <div>
            <div className="flex items-center justify-between">
              <h1 className="font-display text-3xl">Products</h1>
              <button onClick={openNewProduct} className="inline-flex items-center gap-2 h-10 px-5 rounded-full bg-primary text-primary-foreground text-sm font-medium"><Plus className="h-4 w-4" /> Add Product</button>
            </div>
            <div className="mt-6 bg-card rounded-2xl premium-shadow overflow-hidden">
              <table className="w-full text-sm">
                <thead className="text-left text-muted-foreground text-xs uppercase tracking-wider bg-muted/40">
                  <tr><th className="p-4">Product</th><th>Category</th><th>Price</th><th>Stock</th><th></th></tr>
                </thead>
                <tbody>
                  {adminProducts.map((pr) => (
                    <tr key={pr.id} className="border-t">
                      <td className="p-4 flex items-center gap-3"><img src={pr.image} className="h-12 w-12 rounded-lg object-cover" alt="" /><span className="font-medium line-clamp-1 max-w-xs">{pr.name}</span></td>
                      <td>{pr.category}</td>
                      <td className="font-medium">{formatINR(pr.price)}</td>
                      <td>{pr.stock}</td>
                      <td className="p-4">
                        <div className="flex gap-2 justify-end">
                          <button onClick={() => setEditing(pr)} className="p-2 hover:bg-muted rounded-lg"><Pencil className="h-4 w-4" /></button>
                          <button onClick={() => { if (confirm("Delete this product?")) deleteProduct(pr.id); }} className="p-2 hover:bg-destructive/10 hover:text-destructive rounded-lg"><Trash2 className="h-4 w-4" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {pickCat !== null && (
              <CategoryPicker categories={categories} onPick={createWithCategory} onClose={() => setPickCat(null)} />
            )}
            {editing && <ProductEditor product={editing} categories={categories} onClose={() => setEditing(null)} onSave={(p) => { saveProduct(p); setEditing(null); }} />}
          </div>
        )}

        {tab === "orders" && (
          <div>
            <h1 className="font-display text-3xl">Orders</h1>
            <div className="mt-6 space-y-3">
              {orders.length === 0 ? <p className="text-sm text-muted-foreground">No orders yet.</p> : orders.map((o) => (
                <div key={o.id} className="bg-card rounded-xl p-5 premium-shadow flex flex-wrap items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">#{o.id} · {o.address.name}</p>
                    <p className="text-xs text-muted-foreground">{new Date(o.createdAt).toLocaleString()} · {o.items.length} items · {o.address.city}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{formatINR(o.total)}</p>
                    <p className={`text-xs ${o.payment.status === "paid" ? "text-green-700" : "text-amber-700"}`}>{o.payment.method.toUpperCase()} · {o.payment.status}</p>
                  </div>
                  <select value={o.status} onChange={(e) => updateOrderStatus(o.id, e.target.value as Order["status"])} className="h-10 rounded-lg border px-3 text-sm bg-background">
                    {(["Placed","Packed","Shipped","Out for delivery","Delivered"] as Order["status"][]).map((s) => <option key={s}>{s}</option>)}
                  </select>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "payments" && (
          <div>
            <h1 className="font-display text-3xl">Payments</h1>
            <p className="text-sm text-muted-foreground">All transactions recorded against orders.</p>
            <div className="grid sm:grid-cols-3 gap-4 mt-6">
              <Stat icon={IndianRupee} label="Total Received" value={formatINR(orders.filter((o) => o.payment.status === "paid").reduce((s, o) => s + o.total, 0))} />
              <Stat icon={IndianRupee} label="Pending (COD)" value={formatINR(orders.filter((o) => o.payment.status === "pending").reduce((s, o) => s + o.total, 0))} />
              <Stat icon={CreditCard} label="Transactions" value={String(orders.length)} />
            </div>
            <div className="mt-6 bg-card rounded-2xl premium-shadow overflow-hidden">
              <table className="w-full text-sm">
                <thead className="text-left text-muted-foreground text-xs uppercase tracking-wider bg-muted/40">
                  <tr><th className="p-4">Txn ID</th><th>Order</th><th>Customer</th><th>Method</th><th>Amount</th><th>Status</th><th>Date</th></tr>
                </thead>
                <tbody>
                  {orders.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">No payments yet.</td></tr>}
                  {orders.map((o) => (
                    <tr key={o.id} className="border-t">
                      <td className="p-4 font-mono text-xs">TXN{o.id.slice(2)}</td>
                      <td>#{o.id}</td>
                      <td>{o.address.name}</td>
                      <td className="uppercase text-xs">{o.payment.method}</td>
                      <td className="font-medium">{formatINR(o.total)}</td>
                      <td><span className={`px-2 py-0.5 rounded-full text-xs ${o.payment.status === "paid" ? "bg-green-600/10 text-green-700" : "bg-amber-500/10 text-amber-700"}`}>{o.payment.status}</span></td>
                      <td className="text-xs text-muted-foreground">{new Date(o.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === "users" && (
          <div>
            <h1 className="font-display text-3xl">Customers</h1>
            <p className="text-sm text-muted-foreground">Unique customers who placed orders.</p>
            <div className="mt-6 bg-card rounded-2xl premium-shadow overflow-hidden">
              <table className="w-full text-sm">
                <thead className="text-left text-muted-foreground text-xs uppercase tracking-wider bg-muted/40">
                  <tr><th className="p-4">Name</th><th>Phone</th><th>Orders</th><th>Total Spent</th></tr>
                </thead>
                <tbody>
                  {customers.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">No customers yet.</td></tr>}
                  {customers.map((c, i) => (
                    <tr key={i} className="border-t">
                      <td className="p-4 flex items-center gap-3"><span className="h-9 w-9 rounded-full bg-primary/10 text-primary grid place-items-center font-medium">{c.name.charAt(0).toUpperCase()}</span>{c.name}</td>
                      <td>{c.phone || "—"}</td>
                      <td>{c.orders}</td>
                      <td className="font-medium">{formatINR(c.spent)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === "settings" && <SettingsPanel settings={settings} onSave={updateSettings} />}
      </main>
    </div>
  );
}

function NavBtn({ active, onClick, icon: Icon, children }: { active: boolean; onClick: () => void; icon: typeof Package; children: React.ReactNode }) {
  return <button onClick={onClick} className={`w-full text-left px-3 py-2.5 rounded-lg text-sm flex items-center gap-3 transition ${active ? "bg-primary text-primary-foreground" : "text-background/70 hover:bg-background/10 hover:text-background"}`}><Icon className="h-4 w-4" />{children}</button>;
}
function Stat({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: string }) {
  return <div className="bg-card rounded-2xl p-5 premium-shadow"><Icon className="h-6 w-6 text-primary" /><p className="text-xs uppercase tracking-wider text-muted-foreground mt-3">{label}</p><p className="font-display text-2xl mt-1">{value}</p></div>;
}

function CategoryPicker({ categories, onPick, onClose }: { categories: string[]; onPick: (c: string) => void; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 grid place-items-center p-4" onClick={onClose}>
      <div className="bg-card rounded-2xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <h2 className="font-display text-2xl mb-2">Select a category</h2>
        <p className="text-sm text-muted-foreground mb-4">Choose the category this new product belongs to.</p>
        {categories.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">No categories yet. Add one from the Categories tab first.</p>
        ) : (
          <div className="grid grid-cols-2 gap-2 max-h-80 overflow-y-auto">
            {categories.map((c) => (
              <button key={c} onClick={() => onPick(c)} className="p-4 rounded-xl border-2 border-border hover:border-primary hover:bg-primary/5 text-sm font-medium text-left transition">{c}</button>
            ))}
          </div>
        )}
        <div className="flex justify-end mt-5"><button onClick={onClose} className="h-10 px-5 rounded-full border text-sm">Cancel</button></div>
      </div>
    </div>
  );
}

function ProductEditor({ product, categories, onClose, onSave }: { product: Product; categories: string[]; onClose: () => void; onSave: (p: Product) => void }) {
  const [p, setP] = useState<Product>(product);
  return (
    <div className="fixed inset-0 bg-black/50 z-50 grid place-items-center p-4" onClick={onClose}>
      <div className="bg-card rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <h2 className="font-display text-2xl mb-1">{product.id ? "Edit Product" : "New Product"}</h2>
        <p className="text-xs text-muted-foreground mb-4">Category: <span className="font-medium text-foreground">{p.category}</span></p>
        <div className="space-y-3">
          <In label="Name" value={p.name} onChange={(v) => setP({ ...p, name: v })} />
          <div className="grid grid-cols-2 gap-3">
            <In label="Price (₹)" type="number" value={String(p.price)} onChange={(v) => setP({ ...p, price: +v })} />
            <In label="MRP (₹)" type="number" value={String(p.mrp)} onChange={(v) => setP({ ...p, mrp: +v })} />
            <In label="Stock" type="number" value={String(p.stock)} onChange={(v) => setP({ ...p, stock: +v })} />
            <label className="text-sm"><span className="text-muted-foreground text-xs">Category</span>
              <select value={p.category} onChange={(e) => setP({ ...p, category: e.target.value })} className="mt-1 w-full h-11 rounded-lg border px-3 bg-background">
                {categories.map((c) => <option key={c}>{c}</option>)}
              </select>
            </label>
          </div>
          <In label="Image URL" value={p.image} onChange={(v) => setP({ ...p, image: v })} />
          <label className="text-sm block"><span className="text-muted-foreground text-xs">Description</span>
            <textarea value={p.description} onChange={(e) => setP({ ...p, description: e.target.value })} rows={3} className="mt-1 w-full rounded-lg border p-3 bg-background focus:outline-none focus:border-primary" />
          </label>
        </div>
        <div className="flex gap-3 mt-6 justify-end">
          <button onClick={onClose} className="h-10 px-5 rounded-full border text-sm">Cancel</button>
          <button onClick={() => onSave(p)} className="h-10 px-5 rounded-full bg-primary text-primary-foreground text-sm font-medium">Save</button>
        </div>
      </div>
    </div>
  );
}
function In({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return <label className="text-sm block"><span className="text-muted-foreground text-xs">{label}</span><input type={type} value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 w-full h-11 rounded-lg border px-3 bg-background focus:outline-none focus:border-primary" /></label>;
}

function SettingsPanel({ settings, onSave }: { settings: Settings; onSave: (p: Partial<Settings>) => void }) {
  const [s, setS] = useState<Settings>(settings);
  return (
    <div>
      <h1 className="font-display text-3xl">Settings</h1>
      <p className="text-sm text-muted-foreground">Tune the storefront — changes reflect immediately across the app.</p>
      <div className="grid lg:grid-cols-2 gap-6 mt-6">
        <section className="bg-card rounded-2xl p-6 premium-shadow space-y-3">
          <h2 className="font-display text-xl">Brand</h2>
          <In label="Site Name" value={s.siteName} onChange={(v) => setS({ ...s, siteName: v })} />
          <In label="Tagline" value={s.tagline} onChange={(v) => setS({ ...s, tagline: v })} />
          <In label="Announcement Bar" value={s.announcement} onChange={(v) => setS({ ...s, announcement: v })} />
        </section>
        <section className="bg-card rounded-2xl p-6 premium-shadow space-y-3">
          <h2 className="font-display text-xl">Contact</h2>
          <In label="Support Email" value={s.supportEmail} onChange={(v) => setS({ ...s, supportEmail: v })} />
          <In label="Support Phone" value={s.supportPhone} onChange={(v) => setS({ ...s, supportPhone: v })} />
        </section>
        <section className="bg-card rounded-2xl p-6 premium-shadow space-y-3">
          <h2 className="font-display text-xl">Shipping</h2>
          <In label="Free Shipping Above (₹)" type="number" value={String(s.freeShipThreshold)} onChange={(v) => setS({ ...s, freeShipThreshold: +v })} />
          <In label="Default Shipping Fee (₹)" type="number" value={String(s.shippingFee)} onChange={(v) => setS({ ...s, shippingFee: +v })} />
        </section>
        <section className="bg-card rounded-2xl p-6 premium-shadow space-y-3">
          <h2 className="font-display text-xl">Payments</h2>
          <In label="Razorpay Key ID" value={s.razorpayKeyId} onChange={(v) => setS({ ...s, razorpayKeyId: v })} />
          <label className="flex items-center gap-3 text-sm pt-2">
            <input type="checkbox" checked={s.codEnabled} onChange={(e) => setS({ ...s, codEnabled: e.target.checked })} className="h-4 w-4 accent-primary" />
            Enable Cash on Delivery
          </label>
        </section>
      </div>
      <div className="flex justify-end mt-6">
        <button onClick={() => onSave(s)} className="h-11 px-6 rounded-full bg-primary text-primary-foreground font-medium">Save Settings</button>
      </div>
    </div>
  );
}
