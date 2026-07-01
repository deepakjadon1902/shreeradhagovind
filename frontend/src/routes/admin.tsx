import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useStore, formatINR, type Order, type Settings, type Courier, type RegisteredUser, type CourierEvent, type Category, type Blog, COURIERS } from "@/lib/store";
import { type Product } from "@/lib/products";
import { api, isApiEnabled } from "@/lib/api";
import { toast } from "sonner";
import { Lock, LayoutDashboard, Package, ShoppingCart, LogOut, Plus, Pencil, Trash2, IndianRupee, TrendingUp, Users, Tag, CreditCard, Settings as SettingsIcon, Truck, Check, X as XIcon, ShieldOff, ShieldCheck, RefreshCw, Mail, Phone, UploadCloud, FileText } from "lucide-react";

export const Route = createFileRoute("/admin")({
  component: AdminRoot,
  head: () => ({ meta: [{ title: "Admin · Shri Radha Govind Store" }, { name: "robots", content: "noindex,nofollow" }] }),
});

type Tab = "dash" | "products" | "orders" | "categories" | "blogs" | "users" | "payments" | "settings";

function AdminRoot() {
  const { adminAuthed, adminLogin, adminLogout, adminProducts, saveProduct, deleteProduct, orders, updateOrderTracking, verifyOrderPayment, categories, categoryDetails, categoryTree, saveCategory, deleteCategory, reorderCategories, blogs, saveBlog, deleteBlog, registeredUsers, fetchRegisteredUsers, toggleUserBlock, fetchOrderEvents, settings, updateSettings } = useStore();
  const [u, setU] = useState(""); const [p, setP] = useState("");
  const [tab, setTab] = useState<Tab>("dash");
  const [editing, setEditing] = useState<Product | null>(null);
  const [pickCat, setPickCat] = useState<string | null>(null);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [viewUser, setViewUser] = useState<RegisteredUser | null>(null);

  useEffect(() => {
    if (adminAuthed && tab === "users") fetchRegisteredUsers();
    // The store action is recreated with provider state; depending on it causes a request loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminAuthed, tab]);


  if (!adminAuthed) {
    return (
      <div className="min-h-screen grid place-items-center bg-foreground/95 text-background p-6">
        <div className="w-full max-w-sm">
          <div className="flex items-center gap-3 mb-8 justify-center">
            <img src="/shriradhagovind%20store%20logo.jpeg" alt="Shri Radha Govind Store" className="h-14 w-14 rounded-full object-cover ring-2 ring-accent/70" />
            <span className="font-display text-2xl">Store Admin</span>
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
    <div className="min-h-screen flex flex-col bg-muted/30 md:flex-row">
      <aside className="w-full bg-primary text-primary-foreground p-4 flex flex-col md:sticky md:top-0 md:h-screen md:w-64 md:p-5">
        <div className="flex items-center gap-3 mb-4 md:mb-10">
          <img src="/shriradhagovind%20store%20logo.jpeg" alt="Shri Radha Govind Store" className="h-11 w-11 rounded-full object-cover ring-2 ring-accent" />
          <div><span className="block font-display text-lg leading-tight">Admin Panel</span><span className="text-[10px] uppercase tracking-[.18em] text-primary-foreground/65">Shri Radha Govind</span></div>
        </div>
        <nav className="flex gap-1 overflow-x-auto pb-2 md:block md:space-y-1 md:overflow-visible md:pb-0 md:flex-1">
          <NavBtn active={tab === "dash"} onClick={() => setTab("dash")} icon={LayoutDashboard}>Dashboard</NavBtn>
          <NavBtn active={tab === "categories"} onClick={() => setTab("categories")} icon={Tag}>Categories</NavBtn>
          <NavBtn active={tab === "blogs"} onClick={() => setTab("blogs")} icon={FileText}>Blogs</NavBtn>
          <NavBtn active={tab === "products"} onClick={() => setTab("products")} icon={Package}>Products</NavBtn>
          <NavBtn active={tab === "orders"} onClick={() => setTab("orders")} icon={ShoppingCart}>Orders</NavBtn>
          <NavBtn active={tab === "payments"} onClick={() => setTab("payments")} icon={CreditCard}>Payments</NavBtn>
          <NavBtn active={tab === "users"} onClick={() => setTab("users")} icon={Users}>Users</NavBtn>
          <NavBtn active={tab === "settings"} onClick={() => setTab("settings")} icon={SettingsIcon}>Settings</NavBtn>
        </nav>
        <div className="mt-3 flex items-center gap-4 border-t border-primary-foreground/15 pt-3 md:block">
          <button onClick={adminLogout} className="flex items-center gap-2 text-sm text-primary-foreground/75 hover:text-primary-foreground py-2"><LogOut className="h-4 w-4" /> Logout</button>
          <Link to="/" className="text-xs text-primary-foreground/60 hover:text-primary-foreground md:mt-2 md:block">← View store</Link>
        </div>
      </aside>

      <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-10 overflow-x-hidden">
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

        {tab === "categories" && <CategoryManager categories={categoryDetails} tree={categoryTree} products={adminProducts} onSave={saveCategory} onDelete={deleteCategory} onReorder={reorderCategories} />}

        {tab === "blogs" && <BlogManager blogs={blogs} onSave={saveBlog} onDelete={deleteBlog} />}

        {tab === "products" && (
          <div>
            <div className="flex items-center justify-between">
              <h1 className="font-display text-3xl">Products</h1>
              <button onClick={openNewProduct} className="inline-flex items-center gap-2 h-10 px-5 rounded-full bg-primary text-primary-foreground text-sm font-medium"><Plus className="h-4 w-4" /> Add Product</button>
            </div>
            <div className="mt-6 bg-card rounded-2xl premium-shadow overflow-x-auto">
              <table className="w-full min-w-[680px] text-sm">
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
            <p className="text-sm text-muted-foreground">Set tracking ID, courier and status. Customer gets an email on every update.</p>
            <div className="mt-6 space-y-3">
              {orders.length === 0 ? <p className="text-sm text-muted-foreground">No orders yet.</p> : orders.map((o) => (
                <div key={o.id} className="bg-card rounded-xl p-5 premium-shadow flex flex-wrap items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">#{o.id} · {o.address.name}</p>
                    <p className="text-xs text-muted-foreground">{new Date(o.createdAt).toLocaleString()} · {o.items.length} items · {o.address.city}</p>
                    {o.trackingId && <p className="text-xs mt-1"><span className="text-muted-foreground">Tracking:</span> <span className="font-mono text-primary">{o.trackingId}</span>{o.courier ? ` · ${o.courier}` : ""}</p>}
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{formatINR(o.total)}</p>
                    <p className={`text-xs ${o.payment.status === "paid" ? "text-green-700" : o.payment.status === "failed" ? "text-destructive" : "text-amber-700"}`}>{o.payment.method.toUpperCase()} · {o.payment.status}</p>
                  </div>
                  <span className="px-2 py-1 rounded-full bg-primary/10 text-primary text-xs">{o.status}</span>
                  <button onClick={() => setEditingOrder(o)} className="h-10 px-4 rounded-lg bg-primary text-primary-foreground text-sm inline-flex items-center gap-2"><Truck className="h-4 w-4" /> Manage</button>
                </div>
              ))}
            </div>
            {editingOrder && <OrderManager order={editingOrder} fetchEvents={fetchOrderEvents} onClose={() => setEditingOrder(null)} onSave={(patch) => { updateOrderTracking(editingOrder.id, patch); setEditingOrder(null); }} />}
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
            <div className="mt-6 bg-card rounded-2xl premium-shadow overflow-x-auto">
              <table className="w-full min-w-[900px] text-sm">
                <thead className="text-left text-muted-foreground text-xs uppercase tracking-wider bg-muted/40">
                  <tr><th className="p-4">Txn ID</th><th>Order</th><th>Customer</th><th>Method</th><th>Amount</th><th>Status</th><th>Verify</th><th>Date</th></tr>
                </thead>
                <tbody>
                  {orders.length === 0 && <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">No payments yet.</td></tr>}
                  {orders.map((o) => (
                    <tr key={o.id} className="border-t">
                      <td className="p-4 font-mono text-xs">TXN{o.id.slice(-6)}</td>
                      <td>#{o.id}</td>
                      <td>{o.address.name}</td>
                      <td className="uppercase text-xs">{o.payment.method}</td>
                      <td className="font-medium">{formatINR(o.total)}</td>
                      <td><span className={`px-2 py-0.5 rounded-full text-xs ${o.payment.status === "paid" ? "bg-green-600/10 text-green-700" : o.payment.status === "failed" ? "bg-destructive/10 text-destructive" : "bg-amber-500/10 text-amber-700"}`}>{o.payment.status}</span></td>
                      <td>
                        <div className="flex gap-1">
                          <button onClick={() => { if (confirm("Mark as PAID and send invoice email?")) verifyOrderPayment(o.id, "paid"); }} disabled={o.payment.status === "paid"} className="p-1.5 rounded-md bg-green-600/10 text-green-700 hover:bg-green-600/20 disabled:opacity-30" title="Mark paid"><Check className="h-3.5 w-3.5" /></button>
                          <button onClick={() => { if (confirm("Mark as FAILED, auto-cancel order, and email user?")) verifyOrderPayment(o.id, "failed"); }} disabled={o.payment.status === "failed"} className="p-1.5 rounded-md bg-destructive/10 text-destructive hover:bg-destructive/20 disabled:opacity-30" title="Mark failed"><XIcon className="h-3.5 w-3.5" /></button>
                        </div>
                      </td>
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
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h1 className="font-display text-3xl">Users</h1>
                <p className="text-sm text-muted-foreground">All registered accounts. Activate or block them and view full profile details.</p>
              </div>
              <button onClick={() => fetchRegisteredUsers()} className="h-10 px-4 rounded-full border text-sm inline-flex items-center gap-2 hover:border-primary"><RefreshCw className="h-4 w-4" /> Refresh</button>
            </div>
            <div className="grid sm:grid-cols-3 gap-4 mt-6">
              <Stat icon={Users} label="Total Users" value={String(registeredUsers.length)} />
              <Stat icon={ShieldCheck} label="Active" value={String(registeredUsers.filter((x) => !x.isBlocked).length)} />
              <Stat icon={ShieldOff} label="Blocked" value={String(registeredUsers.filter((x) => x.isBlocked).length)} />
            </div>
            <div className="mt-6 bg-card rounded-2xl premium-shadow overflow-x-auto">
              <table className="w-full text-sm min-w-[760px]">
                <thead className="text-left text-muted-foreground text-xs uppercase tracking-wider bg-muted/40">
                  <tr><th className="p-4">User</th><th>Contact</th><th>Joined</th><th>Orders</th><th>Spent</th><th>Status</th><th className="text-right pr-4">Actions</th></tr>
                </thead>
                <tbody>
                  {registeredUsers.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">No registered users yet.</td></tr>}
                  {registeredUsers.map((ru) => (
                    <tr key={ru.id} className="border-t">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <span className="h-9 w-9 rounded-full bg-primary/10 text-primary grid place-items-center font-medium">{ru.name.charAt(0).toUpperCase()}</span>
                          <div className="min-w-0">
                            <p className="font-medium truncate max-w-[180px]">{ru.name}</p>
                            <p className="text-xs text-muted-foreground truncate max-w-[180px]">{ru.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="text-xs">
                        {ru.phone || <span className="text-muted-foreground">—</span>}
                        <p className="text-muted-foreground">{ru.address?.city || ""}{ru.address?.city && ru.address?.state ? ", " : ""}{ru.address?.state || ""}</p>
                      </td>
                      <td className="text-xs text-muted-foreground">{ru.createdAt ? new Date(ru.createdAt).toLocaleDateString() : "—"}</td>
                      <td>{ru.ordersCount ?? 0}</td>
                      <td className="font-medium">{formatINR(ru.totalSpent ?? 0)}</td>
                      <td>
                        <span className={`px-2 py-0.5 rounded-full text-xs ${ru.isBlocked ? "bg-destructive/10 text-destructive" : "bg-green-600/10 text-green-700"}`}>
                          {ru.isBlocked ? "Blocked" : "Active"}
                        </span>
                      </td>
                      <td className="pr-4">
                        <div className="flex gap-2 justify-end">
                          <button onClick={() => setViewUser(ru)} className="px-3 h-8 rounded-md text-xs border hover:border-primary">View</button>
                          {ru.isBlocked ? (
                            <button onClick={() => toggleUserBlock(ru.id, false)} className="px-3 h-8 rounded-md text-xs bg-green-600/10 text-green-700 hover:bg-green-600/20 inline-flex items-center gap-1"><ShieldCheck className="h-3.5 w-3.5" /> Activate</button>
                          ) : (
                            <button onClick={() => { if (confirm(`Block ${ru.name}? They will not be able to sign in.`)) toggleUserBlock(ru.id, true); }} className="px-3 h-8 rounded-md text-xs bg-destructive/10 text-destructive hover:bg-destructive/20 inline-flex items-center gap-1"><ShieldOff className="h-3.5 w-3.5" /> Block</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {viewUser && <UserDetail user={viewUser} onClose={() => setViewUser(null)} onToggleBlock={(b) => toggleUserBlock(viewUser.id, b)} />}
          </div>
        )}


        {tab === "settings" && <SettingsPanel settings={settings} onSave={updateSettings} />}
      </main>
    </div>
  );
}

function NavBtn({ active, onClick, icon: Icon, children }: { active: boolean; onClick: () => void; icon: typeof Package; children: React.ReactNode }) {
  return <button onClick={onClick} className={`shrink-0 text-left px-3 py-2.5 rounded-lg text-sm flex items-center gap-2 transition md:w-full md:gap-3 ${active ? "bg-accent text-accent-foreground" : "text-primary-foreground/75 hover:bg-primary-foreground/10 hover:text-primary-foreground"}`}><Icon className="h-4 w-4" />{children}</button>;
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
  const [uploading, setUploading] = useState(false);

  const uploadImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!isApiEnabled()) {
      toast.error("Set VITE_API_URL to use ImageKit uploads from admin.");
      e.target.value = "";
      return;
    }
    const body = new FormData();
    body.append("file", file);
    setUploading(true);
    try {
      const result = await api<{ url: string; publicId: string }>("/uploads/image", { method: "POST", formData: body });
      setP((current) => ({ ...current, image: result.url, images: [result.url, ...(current.images ?? []).filter((x) => x !== result.url)] }));
      toast.success("Image uploaded to ImageKit");
    } catch (err: any) {
      toast.error(err?.message ?? "Image upload failed");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

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
          <div className="grid sm:grid-cols-[1fr_auto] gap-3 items-end">
            <In label="Image URL" value={p.image} onChange={(v) => setP({ ...p, image: v })} />
            <label className={`h-11 px-4 rounded-lg border bg-background text-sm font-medium inline-flex items-center justify-center gap-2 cursor-pointer hover:border-primary ${uploading ? "opacity-60 pointer-events-none" : ""}`}>
              <UploadCloud className="h-4 w-4" />
              {uploading ? "Uploading" : "Upload"}
              <input type="file" accept="image/*" className="sr-only" onChange={uploadImage} disabled={uploading} />
            </label>
          </div>
          {p.image && (
            <div className="rounded-lg border bg-muted/30 p-2">
              <img src={p.image} alt={p.name || "Product preview"} className="h-32 w-full rounded-md object-contain bg-white" />
            </div>
          )}
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

function OrderManager({
  order: initialOrder,
  fetchEvents,
  onClose,
  onSave,
}: {
  order: Order;
  fetchEvents?: (id: string) => Promise<{ events: CourierEvent[]; order: Order } | null>;
  onClose: () => void;
  onSave: (patch: { trackingId?: string; courier?: Courier | null; courierTrackingUrl?: string; status?: Order["status"] }) => void;
}) {
  const [order, setOrder] = useState<Order>(initialOrder);
  const [events, setEvents] = useState<CourierEvent[]>([]);
  const [lastSync, setLastSync] = useState<number | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [trackingId, setTrackingId] = useState(initialOrder.trackingId ?? "");
  const [courier, setCourier] = useState<Courier | "">(initialOrder.courier ?? "");
  const [courierTrackingUrl, setCourierTrackingUrl] = useState(initialOrder.courierTrackingUrl ?? "");
  const [status, setStatus] = useState<Order["status"]>(initialOrder.status);

  const STATUSES: Order["status"][] = ["Placed", "Packed", "Shipped", "Out for delivery", "Delivered", "Cancelled"];

  // ---- Auto courier event sync (poll backend every 15s) ----
  useEffect(() => {
    if (!fetchEvents) return;
    let alive = true;
    const sync = async () => {
      setSyncing(true);
      const r = await fetchEvents(initialOrder.id);
      if (alive && r) {
        setEvents(r.events);
        setOrder(r.order);
        setLastSync(Date.now());
      }
      if (alive) setSyncing(false);
    };
    sync();
    const t = setInterval(sync, 15000);
    return () => { alive = false; clearInterval(t); };
  }, [fetchEvents, initialOrder.id]);

  const manualRefresh = async () => {
    if (!fetchEvents) return;
    setSyncing(true);
    const r = await fetchEvents(initialOrder.id);
    if (r) { setEvents(r.events); setOrder(r.order); setLastSync(Date.now()); }
    setSyncing(false);
  };

  const submit = () => {
    const patch: Parameters<typeof onSave>[0] = { status };
    if (trackingId.trim()) patch.trackingId = trackingId.trim().toUpperCase();
    patch.courier = (courier || null) as Courier | null;
    patch.courierTrackingUrl = courierTrackingUrl.trim();
    onSave(patch);
  };

  // ----- timeline derived from current status + timestamps -----
  const TIMELINE: Order["status"][] = ["Placed", "Packed", "Shipped", "Out for delivery", "Delivered"];
  const isCancelled = order.status === "Cancelled";
  const currentIdx = isCancelled ? -1 : Math.max(0, TIMELINE.indexOf(order.status));
  const fmt = (ts: number | string) => new Date(ts).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });

  const payBadge =
    order.payment.status === "paid"
      ? "bg-green-600/10 text-green-700 border-green-600/20"
      : order.payment.status === "failed"
      ? "bg-destructive/10 text-destructive border-destructive/20"
      : "bg-amber-500/10 text-amber-700 border-amber-500/20";

  return (
    <div className="fixed inset-0 bg-black/50 z-50 grid place-items-center p-4" onClick={onClose}>
      <div className="bg-card rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 mb-2">
          <div>
            <h2 className="font-display text-2xl">Manage Order</h2>
            <p className="text-xs text-muted-foreground mt-0.5">#{order.id} · {order.address.name} · {formatINR(order.total)}</p>
          </div>
          <div className="flex items-center gap-2">
            {fetchEvents && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-600/10 text-green-700 text-[11px]" title="Auto-syncs every 15s">
                <span className={`h-1.5 w-1.5 rounded-full bg-green-600 ${syncing ? "animate-pulse" : ""}`} />
                Live · {lastSync ? new Date(lastSync).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "syncing…"}
              </div>
            )}
            {fetchEvents && (
              <button onClick={manualRefresh} disabled={syncing} className="p-2 rounded-lg hover:bg-muted disabled:opacity-50" aria-label="Refresh"><RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} /></button>
            )}
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted" aria-label="Close"><XIcon className="h-4 w-4" /></button>
          </div>
        </div>

        {/* ---- Quick facts: payment + courier snapshot ---- */}
        <div className="grid sm:grid-cols-3 gap-3 mt-4">
          <div className={`rounded-xl border p-3 ${payBadge}`}>
            <p className="text-[10px] uppercase tracking-wider opacity-80">Payment</p>
            <p className="font-semibold text-sm mt-0.5">{order.payment.method.toUpperCase()} · {order.payment.status}</p>
            <p className="text-[11px] opacity-70 mt-0.5">{formatINR(order.total)}</p>
          </div>
          <div className="rounded-xl border bg-muted/30 p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Courier</p>
            <p className="font-semibold text-sm mt-0.5">{order.courier ?? "Not assigned"}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{order.trackingId ?? "No tracking ID"}</p>
          </div>
          <div className="rounded-xl border bg-muted/30 p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Latest Status</p>
            <p className={`font-semibold text-sm mt-0.5 ${isCancelled ? "text-destructive" : "text-primary"}`}>{order.status}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Placed {fmt(order.createdAt)}</p>
          </div>
        </div>

        {/* ---- Timeline ---- */}
        <div className="mt-5 rounded-xl border bg-card p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">Order Timeline</p>
          {isCancelled ? (
            <div className="flex items-center gap-3 text-destructive">
              <span className="h-7 w-7 rounded-full bg-destructive/10 grid place-items-center"><XIcon className="h-3.5 w-3.5" /></span>
              <div>
                <p className="text-sm font-medium">Order cancelled</p>
                <p className="text-[11px] text-muted-foreground">Customer was notified by email.</p>
              </div>
            </div>
          ) : (
            <ol className="space-y-3">
              {TIMELINE.map((step, i) => {
                const done = i <= currentIdx;
                const active = i === currentIdx;
                return (
                  <li key={step} className="flex items-start gap-3">
                    <span className={`mt-0.5 h-5 w-5 rounded-full grid place-items-center text-[10px] font-semibold shrink-0 ${done ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                      {done ? <Check className="h-3 w-3" /> : i + 1}
                    </span>
                    <div className="flex-1 min-w-0 -mt-0.5">
                      <p className={`text-sm ${active ? "font-semibold text-primary" : done ? "font-medium" : "text-muted-foreground"}`}>{step}</p>
                      {i === 0 && <p className="text-[11px] text-muted-foreground">{fmt(order.createdAt)}</p>}
                      {active && i !== 0 && <p className="text-[11px] text-muted-foreground">Updated just now · email sent</p>}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}

          {/* Courier latest event */}
          {order.courier && (
            <div className="mt-4 pt-3 border-t">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">Latest courier event</p>
              <div className="flex items-start gap-3">
                <Truck className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm">
                    {order.status === "Delivered"
                      ? `Delivered by ${order.courier} to ${order.address.city}.`
                      : order.status === "Out for delivery"
                      ? `${order.courier} agent is out for delivery in ${order.address.city}.`
                      : order.status === "Shipped"
                      ? `Shipped via ${order.courier}. In transit to ${order.address.city}.`
                      : order.status === "Packed"
                      ? `Handed over to ${order.courier} for pickup.`
                      : `Assigned to ${order.courier}. Awaiting pickup.`}
                  </p>
                  {order.courierTrackingUrl && (
                    <a href={order.courierTrackingUrl} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">View live tracking on {order.courier} →</a>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Live synced event feed */}
          {events.length > 0 && (
            <div className="mt-4 pt-3 border-t">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">Courier event history (auto-synced)</p>
              <ol className="space-y-2.5">
                {[...events].reverse().map((ev, i) => (
                  <li key={`${ev.at}-${i}`} className="flex items-start gap-3">
                    <span className={`mt-1 h-2 w-2 rounded-full shrink-0 ${i === 0 ? "bg-primary ring-2 ring-primary/30" : "bg-muted-foreground/40"}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{ev.label}</p>
                      <p className="text-xs text-muted-foreground">{ev.description}</p>
                      <p className="text-[10px] text-muted-foreground/70 mt-0.5">{fmt(ev.at)}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>

        {/* ---- Editable fields ---- */}
        <div className="mt-5 space-y-3">
          <label className="text-sm block">
            <span className="text-muted-foreground text-xs">Tracking ID</span>
            <input value={trackingId} onChange={(e) => setTrackingId(e.target.value)} placeholder="SRG-XXXXXXXX" className="mt-1 w-full h-11 rounded-lg border px-3 bg-background font-mono uppercase focus:outline-none focus:border-primary" />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm block">
              <span className="text-muted-foreground text-xs">Courier</span>
              <select value={courier} onChange={(e) => setCourier(e.target.value as Courier | "")} className="mt-1 w-full h-11 rounded-lg border px-3 bg-background focus:outline-none focus:border-primary">
                <option value="">— Not assigned —</option>
                {COURIERS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            <label className="text-sm block">
              <span className="text-muted-foreground text-xs">Delivery Status</span>
              <select value={status} onChange={(e) => setStatus(e.target.value as Order["status"])} className="mt-1 w-full h-11 rounded-lg border px-3 bg-background focus:outline-none focus:border-primary">
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
          </div>

          <label className="text-sm block">
            <span className="text-muted-foreground text-xs">Courier Tracking URL (optional)</span>
            <input value={courierTrackingUrl} onChange={(e) => setCourierTrackingUrl(e.target.value)} placeholder="https://courier.com/track/..." className="mt-1 w-full h-11 rounded-lg border px-3 bg-background focus:outline-none focus:border-primary" />
          </label>

          <div className="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
            Saving sends an automatic status-update email to the customer with the tracking ID, courier name and link.
          </div>
        </div>

        <div className="flex gap-3 mt-6 justify-end">
          <button onClick={onClose} className="h-10 px-5 rounded-full border text-sm">Cancel</button>
          <button onClick={submit} className="h-10 px-5 rounded-full bg-primary text-primary-foreground text-sm font-medium inline-flex items-center gap-2"><Truck className="h-4 w-4" /> Save & Notify</button>
        </div>
      </div>
    </div>
  );
}

function UserDetail({ user, onClose, onToggleBlock }: { user: RegisteredUser; onClose: () => void; onToggleBlock: (b: boolean) => void }) {
  const a = user.address ?? {};
  return (
    <div className="fixed inset-0 bg-black/50 z-50 grid place-items-center p-4" onClick={onClose}>
      <div className="bg-card rounded-2xl p-6 w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="h-12 w-12 rounded-full bg-primary/10 text-primary grid place-items-center text-lg font-medium">{user.name.charAt(0).toUpperCase()}</span>
            <div>
              <h2 className="font-display text-xl">{user.name}</h2>
              <p className="text-xs text-muted-foreground">{user.role.toUpperCase()} · {user.provider ?? "password"} · joined {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : "—"}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted" aria-label="Close"><XIcon className="h-4 w-4" /></button>
        </div>

        <div className="mt-4 space-y-2 text-sm">
          <p className="flex items-center gap-2"><Mail className="h-4 w-4 text-primary" /> {user.email}</p>
          <p className="flex items-center gap-2"><Phone className="h-4 w-4 text-primary" /> {user.phone || <span className="text-muted-foreground">No phone</span>}</p>
          <div className="rounded-lg border bg-muted/30 p-3 text-xs leading-relaxed">
            <p className="uppercase tracking-wider text-muted-foreground mb-1">Shipping Address</p>
            {a.line1 || a.city || a.pincode ? (
              <p>{a.line1}{a.line1 ? ", " : ""}{a.city}{a.state ? `, ${a.state}` : ""} {a.pincode}</p>
            ) : (
              <p className="text-muted-foreground">No address saved.</p>
            )}
          </div>
          <div className="grid grid-cols-3 gap-2 mt-3">
            <Stat icon={ShoppingCart} label="Orders" value={String(user.ordersCount ?? 0)} />
            <Stat icon={IndianRupee} label="Spent" value={formatINR(user.totalSpent ?? 0)} />
            <Stat icon={user.isBlocked ? ShieldOff : ShieldCheck} label="Status" value={user.isBlocked ? "Blocked" : "Active"} />
          </div>
          {user.lastLoginAt && <p className="text-[11px] text-muted-foreground">Last login: {new Date(user.lastLoginAt).toLocaleString()}</p>}
        </div>

        <div className="flex gap-3 mt-6 justify-end">
          <button onClick={onClose} className="h-10 px-5 rounded-full border text-sm">Close</button>
          {user.isBlocked ? (
            <button onClick={() => { onToggleBlock(false); onClose(); }} className="h-10 px-5 rounded-full bg-green-600 text-white text-sm font-medium inline-flex items-center gap-2"><ShieldCheck className="h-4 w-4" /> Activate</button>
          ) : (
            <button onClick={() => { if (confirm(`Block ${user.name}? They will not be able to sign in.`)) { onToggleBlock(true); onClose(); } }} className="h-10 px-5 rounded-full bg-destructive text-destructive-foreground text-sm font-medium inline-flex items-center gap-2"><ShieldOff className="h-4 w-4" /> Block User</button>
          )}
        </div>
      </div>
    </div>
  );
}

function CategoryManager({
  categories,
  tree,
  products,
  onSave,
  onDelete,
  onReorder,
}: {
  categories: Category[];
  tree: (Category & { children: Category[] })[];
  products: Product[];
  onSave: (category: Partial<Category> & { name: string; id?: string }) => Promise<void> | void;
  onDelete: (name: string) => Promise<void> | void;
  onReorder: (items: { id: string; sortOrder: number; parentId?: string | null }[]) => Promise<void> | void;
}) {
  const empty = (): Partial<Category> & { name: string } => ({ name: "", parentId: null, description: "", image: "", isActive: true, sortOrder: categories.length });
  const [editing, setEditing] = useState<(Partial<Category> & { name: string }) | null>(null);

  const move = (category: Category, direction: -1 | 1) => {
    const siblings = categories.filter((item) => (item.parentId ?? null) === (category.parentId ?? null)).sort((a, b) => a.sortOrder - b.sortOrder);
    const index = siblings.findIndex((item) => item.id === category.id);
    const target = siblings[index + direction];
    if (!target) return;
    onReorder([
      { id: category.id, sortOrder: target.sortOrder, parentId: category.parentId },
      { id: target.id, sortOrder: category.sortOrder, parentId: target.parentId },
    ]);
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="font-display text-3xl">Categories</h1><p className="text-sm text-muted-foreground">Manage the navigation structure used by the storefront.</p></div>
        <button onClick={() => setEditing(empty())} className="inline-flex h-10 items-center gap-2 rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground"><Plus className="h-4 w-4" /> Add Category</button>
      </div>
      <div className="mt-6 space-y-4">
        {tree.length === 0 && <div className="rounded-2xl bg-card p-8 text-center text-sm text-muted-foreground premium-shadow">No categories yet.</div>}
        {tree.map((parent) => (
          <section key={parent.id} className="overflow-hidden rounded-2xl bg-card premium-shadow">
            <CategoryRow category={parent} count={products.filter((p) => p.category === parent.name).length} onEdit={() => setEditing(parent)} onDelete={onDelete} onMove={move} />
            {parent.children.length > 0 && <div className="border-t bg-muted/20 pl-5 sm:pl-10">{parent.children.map((child) => <CategoryRow key={child.id} category={child} count={products.filter((p) => p.category === child.name).length} onEdit={() => setEditing(child)} onDelete={onDelete} onMove={move} child />)}</div>}
          </section>
        ))}
      </div>
      {editing && <CategoryEditor category={editing} parents={categories.filter((item) => !item.parentId && item.id !== editing.id)} onClose={() => setEditing(null)} onSave={(value) => { onSave(value); setEditing(null); }} />}
    </div>
  );
}

function CategoryRow({ category, count, child = false, onEdit, onDelete, onMove }: { category: Category; count: number; child?: boolean; onEdit: () => void; onDelete: (name: string) => Promise<void> | void; onMove: (category: Category, direction: -1 | 1) => void }) {
  return <div className="flex flex-wrap items-center gap-3 border-b border-border/60 p-4 last:border-0"><div className="min-w-0 flex-1"><p className={`font-medium ${child ? "text-sm" : "font-display text-lg"}`}>{category.name}</p><p className="text-xs text-muted-foreground">{count} products · {category.isActive ? "Visible" : "Hidden"}</p></div><div className="flex items-center gap-1"><button onClick={() => onMove(category, -1)} className="rounded-md border px-2 py-1 text-xs" aria-label={`Move ${category.name} up`}>↑</button><button onClick={() => onMove(category, 1)} className="rounded-md border px-2 py-1 text-xs" aria-label={`Move ${category.name} down`}>↓</button><button onClick={onEdit} className="rounded-lg p-2 hover:bg-muted" aria-label={`Edit ${category.name}`}><Pencil className="h-4 w-4" /></button><button onClick={() => { if (confirm(`Delete ${category.name}? Products in it will be hidden.`)) onDelete(category.name); }} className="rounded-lg p-2 text-destructive hover:bg-destructive/10" aria-label={`Delete ${category.name}`}><Trash2 className="h-4 w-4" /></button></div></div>;
}

function CategoryEditor({ category, parents, onClose, onSave }: { category: Partial<Category> & { name: string }; parents: Category[]; onClose: () => void; onSave: (category: Partial<Category> & { name: string }) => void }) {
  const [value, setValue] = useState(category);
  return <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={onClose}><form onSubmit={(event) => { event.preventDefault(); if (value.name.trim()) onSave({ ...value, name: value.name.trim() }); }} className="w-full max-w-lg space-y-4 rounded-2xl bg-card p-6" onClick={(event) => event.stopPropagation()}><div><h2 className="font-display text-2xl">{category.id ? "Edit Category" : "New Category"}</h2><p className="text-sm text-muted-foreground">Changes appear in storefront navigation immediately.</p></div><In label="Category name" value={value.name} onChange={(name) => setValue({ ...value, name })} /><label className="block text-sm"><span className="text-xs text-muted-foreground">Parent category</span><select value={value.parentId ?? ""} onChange={(event) => setValue({ ...value, parentId: event.target.value || null })} className="mt-1 h-11 w-full rounded-lg border bg-background px-3"><option value="">Top level</option>{parents.map((parent) => <option key={parent.id} value={parent.id}>{parent.name}</option>)}</select></label><In label="Image URL" value={value.image ?? ""} onChange={(image) => setValue({ ...value, image })} /><label className="block text-sm"><span className="text-xs text-muted-foreground">Description</span><textarea value={value.description ?? ""} onChange={(event) => setValue({ ...value, description: event.target.value })} rows={3} className="mt-1 w-full rounded-lg border bg-background p-3" /></label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={value.isActive ?? true} onChange={(event) => setValue({ ...value, isActive: event.target.checked })} /> Visible in storefront</label><div className="flex justify-end gap-3"><button type="button" onClick={onClose} className="h-10 rounded-full border px-5 text-sm">Cancel</button><button type="submit" className="h-10 rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground">Save Category</button></div></form></div>;
}

function BlogManager({ blogs, onSave, onDelete }: { blogs: Blog[]; onSave: (blog: Blog) => Promise<void> | void; onDelete: (id: string) => Promise<void> | void }) {
  const blank = (): Blog => ({ id: "", title: "", slug: "", excerpt: "", content: "", image: "", author: "Shri Radha Govind Store", isPublished: true, sortOrder: blogs.length });
  const [editing, setEditing] = useState<Blog | null>(null);
  return <div><div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="font-display text-3xl">Blogs</h1><p className="text-sm text-muted-foreground">Publish and maintain devotional articles.</p></div><button onClick={() => setEditing(blank())} className="inline-flex h-10 items-center gap-2 rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground"><Plus className="h-4 w-4" /> New Post</button></div><div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{blogs.length === 0 && <div className="rounded-2xl bg-card p-8 text-sm text-muted-foreground premium-shadow">No blog posts yet.</div>}{blogs.map((blog) => <article key={blog.id} className="overflow-hidden rounded-2xl bg-card premium-shadow">{blog.image && <img src={blog.image} alt="" className="h-40 w-full object-cover" />}<div className="p-5"><div className="mb-2 flex items-center justify-between gap-2"><span className={`rounded-full px-2 py-1 text-[10px] ${blog.isPublished ? "bg-green-600/10 text-green-700" : "bg-muted text-muted-foreground"}`}>{blog.isPublished ? "Published" : "Draft"}</span><span className="text-xs text-muted-foreground">{blog.publishedAt ? new Date(blog.publishedAt).toLocaleDateString() : "Unscheduled"}</span></div><h2 className="font-display text-xl">{blog.title}</h2><p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{blog.excerpt || "No excerpt"}</p><div className="mt-4 flex justify-end gap-2"><button onClick={() => setEditing(blog)} className="rounded-lg border p-2" aria-label={`Edit ${blog.title}`}><Pencil className="h-4 w-4" /></button><button onClick={() => { if (confirm(`Delete ${blog.title}?`)) onDelete(blog.id); }} className="rounded-lg bg-destructive/10 p-2 text-destructive" aria-label={`Delete ${blog.title}`}><Trash2 className="h-4 w-4" /></button></div></div></article>)}</div>{editing && <BlogEditor blog={editing} onClose={() => setEditing(null)} onSave={(blog) => { onSave(blog); setEditing(null); }} />}</div>;
}

function BlogEditor({ blog, onClose, onSave }: { blog: Blog; onClose: () => void; onSave: (blog: Blog) => void }) {
  const [value, setValue] = useState(blog);
  return <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={onClose}><form onSubmit={(event) => { event.preventDefault(); if (value.title.trim()) onSave({ ...value, title: value.title.trim() }); }} className="max-h-[90vh] w-full max-w-2xl space-y-4 overflow-y-auto rounded-2xl bg-card p-6" onClick={(event) => event.stopPropagation()}><div><h2 className="font-display text-2xl">{blog.id ? "Edit Post" : "New Post"}</h2><p className="text-sm text-muted-foreground">Write, preview, and publish content for the store blog.</p></div><In label="Title" value={value.title} onChange={(title) => setValue({ ...value, title })} /><div className="grid gap-3 sm:grid-cols-2"><In label="Slug (optional)" value={value.slug} onChange={(slug) => setValue({ ...value, slug })} /><In label="Author" value={value.author} onChange={(author) => setValue({ ...value, author })} /></div><In label="Cover image URL" value={value.image} onChange={(image) => setValue({ ...value, image })} /><label className="block text-sm"><span className="text-xs text-muted-foreground">Excerpt</span><textarea value={value.excerpt} onChange={(event) => setValue({ ...value, excerpt: event.target.value })} rows={2} className="mt-1 w-full rounded-lg border bg-background p-3" /></label><label className="block text-sm"><span className="text-xs text-muted-foreground">Content</span><textarea value={value.content} onChange={(event) => setValue({ ...value, content: event.target.value })} rows={10} className="mt-1 w-full rounded-lg border bg-background p-3" /></label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={value.isPublished} onChange={(event) => setValue({ ...value, isPublished: event.target.checked })} /> Publish this post</label><div className="flex justify-end gap-3"><button type="button" onClick={onClose} className="h-10 rounded-full border px-5 text-sm">Cancel</button><button type="submit" className="h-10 rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground">Save Post</button></div></form></div>;
}
