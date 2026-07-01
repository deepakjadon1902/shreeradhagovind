import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Layout } from "@/components/Layout";
import { formatINR, useStore, type Address } from "@/lib/store";
import { CheckCircle2, ChevronRight, Heart, LockKeyhole, LogOut, Mail, MapPin, Package, Pencil, Phone, Save, ShoppingBag, UserRound, X } from "lucide-react";

export const Route = createFileRoute("/profile")({
  component: Profile,
  head: () => ({ meta: [{ title: "My Profile — Shri Radha Govind Store" }, { name: "robots", content: "noindex" }] }),
});

type Section = "overview" | "details" | "address" | "orders";

function Profile() {
  const { user, logout, orders, wishlist, updateProfile } = useStore();
  const nav = useNavigate();
  const [section, setSection] = useState<Section>("overview");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState({ name: user?.name ?? "", phone: user?.phone ?? "", address: completeAddress(user?.address) });

  if (!user) {
    return <Layout><div className="container-app py-20 text-center"><h1 className="font-display text-3xl">Sign in to view your profile</h1><Link to="/login" className="fx-button mt-6 inline-flex h-11 items-center rounded-full bg-primary px-6 text-primary-foreground">Sign in</Link></div></Layout>;
  }

  const resetDraft = () => {
    setDraft({ name: user.name, phone: user.phone ?? "", address: completeAddress(user.address) });
    setEditing(false);
  };
  const save = async () => {
    if (!draft.name.trim()) return;
    setSaving(true);
    if (await updateProfile({ name: draft.name.trim(), phone: draft.phone.trim(), address: draft.address })) setEditing(false);
    setSaving(false);
  };
  const signOut = () => { logout(); nav({ to: "/" }); };

  return (
    <Layout>
      <div className="container-app py-10 lg:py-14">
        <section className="glass-panel relative overflow-hidden rounded-3xl p-6 sm:p-8">
          <div className="absolute -right-12 -top-14 h-44 w-44 rounded-full bg-primary/10 blur-2xl" />
          <div className="relative flex flex-wrap items-center gap-5">
            <div className="gold-accent grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-2xl text-3xl text-white shadow-xl">
              {user.avatar ? <img src={user.avatar} alt="" className="h-full w-full object-cover" /> : user.name[0]?.toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="mb-1 text-xs font-semibold uppercase tracking-[.2em] text-primary">Devotee account</p>
              <h1 className="font-display text-3xl sm:text-4xl">{user.name}</h1>
              <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5"><Mail className="h-4 w-4" />{user.email}</span>
                {user.phone && <span className="flex items-center gap-1.5"><Phone className="h-4 w-4" />{user.phone}</span>}
              </div>
            </div>
            <button onClick={signOut} className="fx-button inline-flex h-10 items-center gap-2 rounded-full border bg-card/70 px-4 text-sm hover:border-destructive hover:text-destructive"><LogOut className="h-4 w-4" /> Logout</button>
          </div>
        </section>

        <div className="mt-7 grid gap-6 lg:grid-cols-[240px_1fr]">
          <aside className="premium-card h-fit space-y-1 p-3 lg:sticky lg:top-40">
            <ProfileNav active={section === "overview"} onClick={() => setSection("overview")} icon={UserRound}>Overview</ProfileNav>
            <ProfileNav active={section === "details"} onClick={() => setSection("details")} icon={Pencil}>Personal details</ProfileNav>
            <ProfileNav active={section === "address"} onClick={() => setSection("address")} icon={MapPin}>My address</ProfileNav>
            <ProfileNav active={section === "orders"} onClick={() => setSection("orders")} icon={ShoppingBag}>Order history</ProfileNav>
            <Link to="/wishlist" className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-primary"><Heart className="h-4 w-4" /> Wishlist <span className="ml-auto rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">{wishlist.length}</span></Link>
          </aside>

          <main className="min-w-0">
            {section === "overview" && <Overview user={user} orders={orders} wishlistCount={wishlist.length} onSection={setSection} />}
            {(section === "details" || section === "address") && (
              <section className="premium-card overflow-hidden">
                <div className="flex items-center justify-between border-b p-5 sm:p-6">
                  <div><h2 className="font-display text-2xl">{section === "details" ? "Personal details" : "Delivery address"}</h2><p className="text-sm text-muted-foreground">{editing ? "Make your changes, then save them securely." : "These details prefill your checkout automatically."}</p></div>
                  {!editing && <button onClick={() => setEditing(true)} className="fx-button inline-flex h-10 items-center gap-2 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground"><Pencil className="h-4 w-4" /> Edit</button>}
                </div>
                <div className="grid gap-5 p-5 sm:grid-cols-2 sm:p-6">
                  {section === "details" ? (
                    <>
                      <ProfileField label="Full name" value={editing ? draft.name : user.name} onChange={(name) => setDraft({ ...draft, name })} disabled={!editing} icon={UserRound} />
                      <ProfileField label="Phone number" value={editing ? draft.phone : user.phone ?? "Not added"} onChange={(phone) => setDraft({ ...draft, phone })} disabled={!editing} icon={Phone} />
                      <ProfileField label="Email address" value={user.email} onChange={() => {}} disabled icon={Mail} locked />
                      <div className="rounded-2xl border bg-secondary/40 p-4 text-sm"><p className="flex items-center gap-2 font-semibold"><CheckCircle2 className="h-4 w-4 text-primary" /> Account verified</p><p className="mt-1 text-xs text-muted-foreground">Your email is permanently linked to this account and cannot be changed.</p></div>
                    </>
                  ) : (
                    <>
                      <ProfileField label="Street / area" value={editing ? draft.address.line1 : user.address?.line1 || "Not added"} onChange={(line1) => setDraft({ ...draft, address: { ...draft.address, line1 } })} disabled={!editing} icon={MapPin} full />
                      <ProfileField label="City" value={editing ? draft.address.city : user.address?.city || "Not added"} onChange={(city) => setDraft({ ...draft, address: { ...draft.address, city } })} disabled={!editing} icon={MapPin} />
                      <ProfileField label="State" value={editing ? draft.address.state : user.address?.state || "Not added"} onChange={(state) => setDraft({ ...draft, address: { ...draft.address, state } })} disabled={!editing} icon={MapPin} />
                      <ProfileField label="Pincode" value={editing ? draft.address.pincode : user.address?.pincode || "Not added"} onChange={(pincode) => setDraft({ ...draft, address: { ...draft.address, pincode } })} disabled={!editing} icon={MapPin} />
                    </>
                  )}
                </div>
                {editing && <div className="flex justify-end gap-3 border-t bg-muted/20 p-5"><button onClick={resetDraft} className="inline-flex h-10 items-center gap-2 rounded-full border px-5 text-sm"><X className="h-4 w-4" /> Cancel</button><button onClick={save} disabled={saving} className="fx-button inline-flex h-10 items-center gap-2 rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground disabled:opacity-50"><Save className="h-4 w-4" /> {saving ? "Saving…" : "Save changes"}</button></div>}
              </section>
            )}
            {section === "orders" && <OrderHistory orders={orders} />}
          </main>
        </div>
      </div>
    </Layout>
  );
}

function completeAddress(address?: Partial<Address>): Address {
  return { line1: address?.line1 ?? "", city: address?.city ?? "", state: address?.state ?? "", pincode: address?.pincode ?? "" };
}

function Overview({ user, orders, wishlistCount, onSection }: { user: NonNullable<ReturnType<typeof useStore>["user"]>; orders: ReturnType<typeof useStore>["orders"]; wishlistCount: number; onSection: (section: Section) => void }) {
  const spent = orders.reduce((total, order) => total + order.total, 0);
  return <div className="space-y-6"><div className="grid gap-4 sm:grid-cols-3"><Metric icon={Package} label="Total orders" value={String(orders.length)} /><Metric icon={Heart} label="Saved items" value={String(wishlistCount)} /><Metric icon={ShoppingBag} label="Total spent" value={formatINR(spent)} /></div><section className="premium-card p-5 sm:p-6"><div className="flex items-center justify-between"><div><h2 className="font-display text-2xl">Account at a glance</h2><p className="text-sm text-muted-foreground">Everything ready for a faster checkout.</p></div><LockKeyhole className="h-6 w-6 text-primary" /></div><div className="mt-5 grid gap-3 sm:grid-cols-2"><SummaryButton icon={UserRound} title="Personal details" text={user.phone || "Add your phone number"} onClick={() => onSection("details")} /><SummaryButton icon={MapPin} title="Default address" text={user.address?.city ? `${user.address.line1}, ${user.address.city}` : "Add a delivery address"} onClick={() => onSection("address")} /><SummaryButton icon={ShoppingBag} title="Recent orders" text={orders.length ? `${orders.length} order${orders.length === 1 ? "" : "s"} placed` : "No orders yet"} onClick={() => onSection("orders")} /></div></section></div>;
}

function Metric({ icon: Icon, label, value }: { icon: typeof Package; label: string; value: string }) { return <div className="premium-card p-5"><Icon className="h-5 w-5 text-primary" /><p className="mt-3 text-xs uppercase tracking-wider text-muted-foreground">{label}</p><p className="mt-1 font-display text-2xl">{value}</p></div>; }
function SummaryButton({ icon: Icon, title, text, onClick }: { icon: typeof UserRound; title: string; text: string; onClick: () => void }) { return <button onClick={onClick} className="group flex items-center gap-3 rounded-2xl border bg-card/60 p-4 text-left transition hover:-translate-y-0.5 hover:border-primary"><span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary"><Icon className="h-5 w-5" /></span><span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{title}</span><span className="block truncate text-xs text-muted-foreground">{text}</span></span><ChevronRight className="h-4 w-4 transition group-hover:translate-x-1" /></button>; }
function ProfileNav({ active, onClick, icon: Icon, children }: { active: boolean; onClick: () => void; icon: typeof UserRound; children: React.ReactNode }) { return <button onClick={onClick} className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition ${active ? "bg-primary text-primary-foreground shadow-md" : "text-muted-foreground hover:bg-muted hover:text-primary"}`}><Icon className="h-4 w-4" />{children}</button>; }

function ProfileField({ label, value, onChange, disabled, locked = false, full = false, icon: Icon }: { label: string; value: string; onChange: (value: string) => void; disabled: boolean; locked?: boolean; full?: boolean; icon: typeof UserRound }) {
  return <label className={full ? "sm:col-span-2" : ""}><span className="text-xs font-medium text-muted-foreground">{label}</span><span className="relative mt-1 block"><Icon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><input value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled} className={`h-12 w-full rounded-xl border pl-10 pr-10 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10 ${disabled ? "bg-muted/50 text-muted-foreground" : "bg-card"}`} />{locked && <LockKeyhole className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />}</span></label>;
}

function OrderHistory({ orders }: { orders: ReturnType<typeof useStore>["orders"] }) {
  return <section className="premium-card overflow-hidden"><div className="border-b p-5 sm:p-6"><h2 className="font-display text-2xl">Order history</h2><p className="text-sm text-muted-foreground">Track every purchase and delivery in one place.</p></div>{orders.length === 0 ? <div className="p-12 text-center"><ShoppingBag className="mx-auto h-10 w-10 text-primary/50" /><h3 className="mt-3 font-display text-xl">No orders yet</h3><p className="mt-1 text-sm text-muted-foreground">Your devotional purchases will appear here.</p><Link to="/shop" className="fx-button mt-5 inline-flex h-10 items-center rounded-full bg-primary px-5 text-sm text-primary-foreground">Start shopping</Link></div> : <div className="divide-y">{orders.map((order) => <Link key={order.id} to="/orders/$id" params={{ id: order.id }} className="group flex flex-wrap items-center gap-4 p-5 transition hover:bg-secondary/40"><span className="grid h-12 w-12 place-items-center rounded-xl bg-primary/10 text-primary"><Package className="h-5 w-5" /></span><span className="min-w-0 flex-1"><span className="block font-semibold">Order #{order.id}</span><span className="block text-xs text-muted-foreground">{new Date(order.createdAt).toLocaleDateString("en-IN", { dateStyle: "medium" })} · {order.items.length} item{order.items.length === 1 ? "" : "s"}</span></span><span className="text-right"><span className="block font-semibold">{formatINR(order.total)}</span><span className="rounded-full bg-primary/10 px-2 py-1 text-xs text-primary">{order.status}</span></span><ChevronRight className="h-4 w-4 transition group-hover:translate-x-1" /></Link>)}</div>}</section>;
}
