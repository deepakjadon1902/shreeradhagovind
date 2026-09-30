import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { Layout } from "@/components/Layout";
import { displayOrderNumber, formatINR, useStore, type Address, type LoyaltyInfo, type WalletInfo } from "@/lib/store";
import {
  CheckCircle2,
  ChevronRight,
  Heart,
  LockKeyhole,
  LogOut,
  Mail,
  MapPin,
  Package,
  Pencil,
  Phone,
  Save,
  ShoppingBag,
  UserRound,
  X,
  Award,
  Wallet,
  Coins,
  Clock,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  ShieldCheck,
  LifeBuoy,
  RefreshCw,
  Send,
  MessageSquare,
} from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import type { SupportTicket } from "@/lib/types/support";
import {
  SUPPORT_STATUS_LABELS,
  SUPPORT_STATUS_COLORS,
  SUPPORT_CATEGORY_LABELS,
} from "@/lib/types/support";

export const Route = createFileRoute("/profile")({
  component: Profile,
  head: () => ({ meta: [{ title: "My Profile - Shri Radha Govind Store" }, { name: "robots", content: "noindex" }] }),
});

type Section = "overview" | "details" | "address" | "orders" | "loyalty" | "wallet" | "support";

function Profile() {
  const { user, logout, orders, wishlist, updateProfile, loyalty, wallet, fetchLoyalty, fetchWallet } = useStore();
  const nav = useNavigate();
  const [section, setSection] = useState<Section>("overview");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState({ name: user?.name ?? "", phone: user?.phone ?? "", address: completeAddress(user?.address) });

  useEffect(() => {
    if (user) {
      fetchLoyalty();
      fetchWallet();
    }
  }, [user, fetchLoyalty, fetchWallet]);

  if (!user) {
    return (
      <Layout>
        <div className="container-app py-20 text-center">
          <h1 className="font-display text-3xl">Sign in to view your profile</h1>
          <Link to="/login" className="fx-button mt-6 inline-flex h-11 items-center rounded-full bg-primary px-6 text-primary-foreground">
            Sign in
          </Link>
        </div>
      </Layout>
    );
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
  const signOut = () => {
    logout();
    nav({ to: "/" });
  };

  return (
    <Layout>
      <div className="container-app py-10 lg:py-14">
        <section className="glass-panel relative overflow-hidden rounded-lg p-6 sm:p-8">
          <div className="absolute -right-12 -top-14 h-44 w-44 rounded-full bg-primary/10 blur-2xl" />
          <div className="relative flex flex-wrap items-center gap-5">
            <div className="gold-accent grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-lg text-3xl text-white shadow-xl">
              {user.avatar ? <img src={user.avatar} alt="" className="h-full w-full object-cover" /> : user.name[0]?.toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <p className="text-xs font-semibold uppercase tracking-[.2em] text-primary">Devotee account</p>
                {loyalty?.tier?.name && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
                    <Sparkles className="h-3 w-3" />
                    {loyalty.tier.name}
                  </span>
                )}
              </div>
              <h1 className="font-display text-3xl sm:text-4xl">{user.name}</h1>
              <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5"><Mail className="h-4 w-4" />{user.email}</span>
                {user.phone && <span className="flex items-center gap-1.5"><Phone className="h-4 w-4" />{user.phone}</span>}
              </div>
            </div>
            <button onClick={signOut} className="fx-button inline-flex h-10 items-center gap-2 rounded-full border bg-card/70 px-4 text-sm hover:border-destructive hover:text-destructive">
              <LogOut className="h-4 w-4" /> Logout
            </button>
          </div>
        </section>

        <div className="mt-7 grid gap-6 lg:grid-cols-[260px_1fr]">
          <aside className="premium-card h-fit space-y-1 p-3 lg:sticky lg:top-40">
            <ProfileNav active={section === "overview"} onClick={() => setSection("overview")} icon={UserRound}>
              Overview
            </ProfileNav>
            <ProfileNav active={section === "loyalty"} onClick={() => setSection("loyalty")} icon={Award}>
              Loyalty & Rewards
              {loyalty && loyalty.pointsBalance > 0 && (
                <span className="ml-auto rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-700">
                  {loyalty.pointsBalance} pts
                </span>
              )}
            </ProfileNav>
            <ProfileNav active={section === "wallet"} onClick={() => setSection("wallet")} icon={Wallet}>
              Wallet & Credits
              {wallet && wallet.balance > 0 && (
                <span className="ml-auto rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                  {formatINR(wallet.balance)}
                </span>
              )}
            </ProfileNav>
            <ProfileNav active={section === "details"} onClick={() => setSection("details")} icon={Pencil}>
              Personal details
            </ProfileNav>
            <ProfileNav active={section === "address"} onClick={() => setSection("address")} icon={MapPin}>
              My address
            </ProfileNav>
            <ProfileNav active={section === "orders"} onClick={() => setSection("orders")} icon={ShoppingBag}>
              Order history
            </ProfileNav>
            <ProfileNav active={section === "support"} onClick={() => setSection("support")} icon={LifeBuoy}>
              Support Tickets
            </ProfileNav>
            <Link to="/wishlist" className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-primary">
              <Heart className="h-4 w-4" /> Wishlist <span className="ml-auto rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">{wishlist.length}</span>
            </Link>
          </aside>

          <main className="min-w-0">
            {section === "overview" && (
              <Overview
                user={user}
                orders={orders}
                wishlistCount={wishlist.length}
                loyalty={loyalty}
                wallet={wallet}
                onSection={setSection}
              />
            )}
            {section === "loyalty" && <LoyaltyRewards loyalty={loyalty} />}
            {section === "wallet" && <WalletCredits wallet={wallet} />}
            {section === "support" && <ProfileSupportTickets />}
            {(section === "details" || section === "address") && (
              <section className="premium-card overflow-hidden">
                <div className="flex items-center justify-between border-b p-5 sm:p-6">
                  <div>
                    <h2 className="font-display text-2xl">{section === "details" ? "Personal details" : "Delivery address"}</h2>
                    <p className="text-sm text-muted-foreground">{editing ? "Make your changes, then save them securely." : "These details prefill your checkout automatically."}</p>
                  </div>
                  {!editing && (
                    <button onClick={() => setEditing(true)} className="fx-button inline-flex h-10 items-center gap-2 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground">
                      <Pencil className="h-4 w-4" /> Edit
                    </button>
                  )}
                </div>
                <div className="grid gap-5 p-5 sm:grid-cols-2 sm:p-6">
                  {section === "details" ? (
                    <>
                      <ProfileField label="Full name" value={editing ? draft.name : user.name} onChange={(name) => setDraft({ ...draft, name })} disabled={!editing} icon={UserRound} />
                      <ProfileField label="Phone number" value={editing ? draft.phone : user.phone ?? "Not added"} onChange={(phone) => setDraft({ ...draft, phone })} disabled={!editing} icon={Phone} />
                      <ProfileField label="Email address" value={user.email} onChange={() => {}} disabled icon={Mail} locked />
                      <div className="rounded-lg border bg-secondary/40 p-4 text-sm">
                        <p className="flex items-center gap-2 font-semibold">
                          <CheckCircle2 className="h-4 w-4 text-primary" /> Account verified
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">Your email is permanently linked to this account and cannot be changed.</p>
                      </div>
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
                {editing && (
                  <div className="flex justify-end gap-3 border-t bg-muted/20 p-5">
                    <button onClick={resetDraft} className="inline-flex h-10 items-center gap-2 rounded-full border px-5 text-sm">
                      <X className="h-4 w-4" /> Cancel
                    </button>
                    <button onClick={save} disabled={saving} className="fx-button inline-flex h-10 items-center gap-2 rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground disabled:opacity-50">
                      <Save className="h-4 w-4" /> {saving ? "Saving..." : "Save changes"}
                    </button>
                  </div>
                )}
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

function Overview({
  user,
  orders,
  wishlistCount,
  loyalty,
  wallet,
  onSection,
}: {
  user: NonNullable<ReturnType<typeof useStore>["user"]>;
  orders: ReturnType<typeof useStore>["orders"];
  wishlistCount: number;
  loyalty: LoyaltyInfo | null;
  wallet: WalletInfo | null;
  onSection: (section: Section) => void;
}) {
  const spent = orders.reduce((total, order) => total + order.total, 0);
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric icon={Package} label="Total orders" value={String(orders.length)} />
        <Metric
          icon={Award}
          label="Devotee Points"
          value={loyalty ? `${loyalty.pointsBalance} pts` : "0 pts"}
          subtext={loyalty ? `≈ ${formatINR(loyalty.rupeeValue)}` : undefined}
          onClick={() => onSection("loyalty")}
        />
        <Metric
          icon={Wallet}
          label="Wallet Balance"
          value={formatINR(wallet?.balance || 0)}
          onClick={() => onSection("wallet")}
        />
        <Metric icon={ShoppingBag} label="Total spent" value={formatINR(spent)} />
      </div>

      <section className="premium-card p-5 sm:p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display text-2xl">Account at a glance</h2>
            <p className="text-sm text-muted-foreground">Everything ready for a faster, rewarding checkout.</p>
          </div>
          <LockKeyhole className="h-6 w-6 text-primary" />
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <SummaryButton
            icon={Award}
            title={loyalty?.tier?.name ? `${loyalty.tier.name} Tier` : "Loyalty Rewards"}
            text={loyalty ? `${loyalty.pointsBalance} points available to redeem` : "Start earning rewards on purchases"}
            onClick={() => onSection("loyalty")}
          />
          <SummaryButton
            icon={Wallet}
            title="Devotee Store Credit"
            text={wallet && wallet.balance > 0 ? `${formatINR(wallet.balance)} available credit` : "Zero balance (no pending credits)"}
            onClick={() => onSection("wallet")}
          />
          <SummaryButton
            icon={UserRound}
            title="Personal details"
            text={user.phone || "Add your phone number"}
            onClick={() => onSection("details")}
          />
          <SummaryButton
            icon={MapPin}
            title="Default address"
            text={user.address?.city ? `${user.address.line1}, ${user.address.city}` : "Add a delivery address"}
            onClick={() => onSection("address")}
          />
        </div>
      </section>
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  subtext,
  onClick,
}: {
  icon: typeof Package;
  label: string;
  value: string;
  subtext?: string;
  onClick?: () => void;
}) {
  const content = (
    <div className={`premium-card p-5 ${onClick ? "cursor-pointer transition hover:-translate-y-0.5 hover:border-primary" : ""}`}>
      <Icon className="h-5 w-5 text-primary" />
      <p className="mt-3 text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-2xl">{value}</p>
      {subtext && <p className="mt-0.5 text-xs font-medium text-primary">{subtext}</p>}
    </div>
  );
  if (onClick) return <button type="button" onClick={onClick} className="text-left w-full">{content}</button>;
  return content;
}

function SummaryButton({ icon: Icon, title, text, onClick }: { icon: typeof UserRound; title: string; text: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="group flex items-center gap-3 rounded-lg border bg-card/60 p-4 text-left transition hover:-translate-y-0.5 hover:border-primary">
      <span className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{title}</span>
        <span className="block truncate text-xs text-muted-foreground">{text}</span>
      </span>
      <ChevronRight className="h-4 w-4 transition group-hover:translate-x-1" />
    </button>
  );
}

function ProfileNav({ active, onClick, icon: Icon, children }: { active: boolean; onClick: () => void; icon: typeof UserRound; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition ${active ? "bg-primary text-primary-foreground shadow-md" : "text-muted-foreground hover:bg-muted hover:text-primary"}`}>
      <Icon className="h-4 w-4" />
      {children}
    </button>
  );
}

function ProfileField({ label, value, onChange, disabled, locked = false, full = false, icon: Icon }: { label: string; value: string; onChange: (value: string) => void; disabled: boolean; locked?: boolean; full?: boolean; icon: typeof UserRound }) {
  return (
    <label className={full ? "sm:col-span-2" : ""}>
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <span className="relative mt-1 block">
        <Icon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled} className={`h-12 w-full rounded-lg border pl-10 pr-10 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10 ${disabled ? "bg-muted/50 text-muted-foreground" : "bg-card"}`} />
        {locked && <LockKeyhole className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />}
      </span>
    </label>
  );
}

function OrderHistory({ orders }: { orders: ReturnType<typeof useStore>["orders"] }) {
  return (
    <section className="premium-card overflow-hidden">
      <div className="border-b p-5 sm:p-6">
        <h2 className="font-display text-2xl">Order history</h2>
        <p className="text-sm text-muted-foreground">Track every purchase and delivery in one place.</p>
      </div>
      {orders.length === 0 ? (
        <div className="p-12 text-center">
          <ShoppingBag className="mx-auto h-10 w-10 text-primary/50" />
          <h3 className="mt-3 font-display text-xl">No orders yet</h3>
          <p className="mt-1 text-sm text-muted-foreground">Your devotional purchases will appear here.</p>
          <Link to="/shop" className="fx-button mt-5 inline-flex h-10 items-center rounded-full bg-primary px-5 text-sm text-primary-foreground">
            Start shopping
          </Link>
        </div>
      ) : (
        <div className="divide-y">
          {orders.map((order) => (
            <Link key={order.id} to="/orders/$id" params={{ id: order.id }} className="group flex flex-wrap items-center gap-4 p-5 transition hover:bg-secondary/40">
              <span className="grid h-12 w-12 place-items-center rounded-lg bg-primary/10 text-primary">
                <Package className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">Order #{displayOrderNumber(order)}</span>
                <span className="block text-xs text-muted-foreground">
                  {new Date(order.createdAt).toLocaleDateString("en-IN", { dateStyle: "medium" })} - {order.items.length} item{order.items.length === 1 ? "" : "s"}
                  {order.loyaltyPointsDiscount ? ` • Saved ₹${order.loyaltyPointsDiscount} via Points` : ""}
                </span>
              </span>
              <span className="text-right">
                <span className="block font-semibold">{formatINR(order.total)}</span>
                <span className="rounded-full bg-primary/10 px-2 py-1 text-xs text-primary">{order.status}</span>
              </span>
              <ChevronRight className="h-4 w-4 transition group-hover:translate-x-1" />
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

function LoyaltyRewards({ loyalty }: { loyalty: LoyaltyInfo | null }) {
  const points = loyalty?.pointsBalance ?? 0;
  const rupeeValue = loyalty?.rupeeValue ?? 0;
  const tier = loyalty?.tier;
  const history = loyalty?.history ?? [];

  return (
    <section className="space-y-6">
      {/* Top Banner & Overview */}
      <div className="premium-card p-6 sm:p-8 relative overflow-hidden">
        <div className="absolute right-0 top-0 h-48 w-48 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-700">
              <Sparkles className="h-3.5 w-3.5" />
              Radha Govind Devotee Loyalty
            </span>
            <h2 className="mt-2 font-display text-3xl">Your Devotee Rewards</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Earn divine points on every order. Redeem them instantly during checkout for exclusive discounts.
            </p>
          </div>
          {tier && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 text-center sm:text-right">
              <p className="text-xs font-medium uppercase tracking-wider text-amber-800">Current Tier</p>
              <p className="font-display text-xl font-bold text-amber-900">{tier.name}</p>
              <p className="text-xs text-amber-700 mt-0.5">{tier.pointsMultiplier}x Points Multiplier</p>
            </div>
          )}
        </div>

        {/* Balance Card Grid */}
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border bg-card/70 p-4">
            <p className="text-xs font-medium text-muted-foreground">Available Points</p>
            <p className="mt-1 font-display text-3xl font-bold text-primary">{points}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">Points in account</p>
          </div>
          <div className="rounded-xl border bg-card/70 p-4">
            <p className="text-xs font-medium text-muted-foreground">Monetary Value</p>
            <p className="mt-1 font-display text-3xl font-bold text-emerald-700">{formatINR(rupeeValue)}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">Usable at checkout</p>
          </div>
          <div className="rounded-xl border bg-card/70 p-4">
            <p className="text-xs font-medium text-muted-foreground">Redemption Rules</p>
            <p className="mt-1 text-sm font-semibold">Min: {loyalty?.minPointsToRedeem ?? 100} pts</p>
            <p className="text-xs text-muted-foreground">Up to {loyalty?.maxRedemptionPercent ?? 50}% of order value</p>
          </div>
        </div>

        {tier?.perks && tier.perks.length > 0 && (
          <div className="mt-5 rounded-lg border bg-amber-500/5 p-4 text-xs">
            <p className="font-semibold text-amber-900 mb-1.5 flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-amber-600" />
              Your {tier.name} VIP Perks:
            </p>
            <ul className="grid sm:grid-cols-2 gap-1 text-muted-foreground">
              {tier.perks.map((perk, i) => (
                <li key={i} className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-3 w-3 text-primary shrink-0" />
                  {perk}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Points History Ledger */}
      <div className="premium-card overflow-hidden">
        <div className="border-b p-5 sm:p-6 flex items-center justify-between">
          <div>
            <h3 className="font-display text-xl">Points History</h3>
            <p className="text-xs text-muted-foreground">Detailed record of all earned and redeemed points</p>
          </div>
          <Clock className="h-5 w-5 text-muted-foreground" />
        </div>

        {history.length === 0 ? (
          <div className="p-10 text-center">
            <Coins className="mx-auto h-9 w-9 text-muted-foreground/40" />
            <h4 className="mt-2 font-display text-base">No points activity yet</h4>
            <p className="text-xs text-muted-foreground mt-1">Complete your first order to begin earning devotee points!</p>
          </div>
        ) : (
          <div className="divide-y">
            {history.map((tx) => {
              const isPositive = tx.pointsDelta > 0;
              return (
                <div key={tx._id} className="p-4 flex items-center justify-between gap-3 text-sm">
                  <div className="flex items-center gap-3">
                    <span
                      className={`grid h-8 w-8 place-items-center rounded-full ${
                        isPositive ? "bg-emerald-500/10 text-emerald-700" : "bg-red-500/10 text-red-700"
                      }`}
                    >
                      {isPositive ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                    </span>
                    <div>
                      <p className="font-medium">{tx.reason || (isPositive ? "Points Earned" : "Points Redeemed")}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(tx.createdAt).toLocaleDateString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                        <span className="ml-2 inline-block px-1.5 py-0.2 rounded bg-muted text-[10px] uppercase font-semibold">
                          {tx.type}
                        </span>
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-semibold ${isPositive ? "text-emerald-700" : "text-red-700"}`}>
                      {isPositive ? `+${tx.pointsDelta}` : tx.pointsDelta} pts
                    </p>
                    <p className="text-xs text-muted-foreground">Bal: {tx.balanceAfter} pts</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

function WalletCredits({ wallet }: { wallet: WalletInfo | null }) {
  const balance = wallet?.balance ?? 0;
  const history = wallet?.history ?? [];

  return (
    <section className="space-y-6">
      {/* Top Wallet Overview */}
      <div className="premium-card p-6 sm:p-8 relative overflow-hidden">
        <div className="absolute right-0 top-0 h-48 w-48 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-700">
              <ShieldCheck className="h-3.5 w-3.5" />
              Devotee Store Credit
            </span>
            <h2 className="mt-2 font-display text-3xl">Your Store Credit & Wallet</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Credits issued for promotional rewards, adjustments, or refunds are securely stored here.
            </p>
          </div>
        </div>

        <div className="mt-6 rounded-xl border bg-card/70 p-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Current Wallet Balance</p>
            <p className="mt-1 font-display text-4xl font-bold text-emerald-700">{formatINR(balance)}</p>
          </div>
          <div className="max-w-xs text-xs text-muted-foreground">
            <p>Your store credit is automatically eligible to be applied against upcoming orders or adjustments.</p>
          </div>
        </div>
      </div>

      {/* Wallet History Ledger */}
      <div className="premium-card overflow-hidden">
        <div className="border-b p-5 sm:p-6 flex items-center justify-between">
          <div>
            <h3 className="font-display text-xl">Wallet Activity</h3>
            <p className="text-xs text-muted-foreground">Complete record of credits and deductions</p>
          </div>
          <Wallet className="h-5 w-5 text-muted-foreground" />
        </div>

        {history.length === 0 ? (
          <div className="p-10 text-center">
            <Wallet className="mx-auto h-9 w-9 text-muted-foreground/40" />
            <h4 className="mt-2 font-display text-base">No wallet transactions yet</h4>
            <p className="text-xs text-muted-foreground mt-1">Any promotional credits or refund adjustments will appear here.</p>
          </div>
        ) : (
          <div className="divide-y">
            {history.map((tx) => {
              const isCredit = tx.type === "CREDIT" || tx.type === "REFUND";
              return (
                <div key={tx._id} className="p-4 flex items-center justify-between gap-3 text-sm">
                  <div className="flex items-center gap-3">
                    <span
                      className={`grid h-8 w-8 place-items-center rounded-full ${
                        isCredit ? "bg-emerald-500/10 text-emerald-700" : "bg-blue-500/10 text-blue-700"
                      }`}
                    >
                      {isCredit ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                    </span>
                    <div>
                      <p className="font-medium">{tx.reason || (isCredit ? "Wallet Credit" : "Wallet Debit")}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(tx.createdAt).toLocaleDateString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                        <span className="ml-2 inline-block px-1.5 py-0.2 rounded bg-muted text-[10px] uppercase font-semibold">
                          {tx.type}
                        </span>
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-semibold ${isCredit ? "text-emerald-700" : "text-blue-700"}`}>
                      {isCredit ? `+${formatINR(tx.amount)}` : `-${formatINR(tx.amount)}`}
                    </p>
                    <p className="text-xs text-muted-foreground">Bal: {formatINR(tx.balanceAfter)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

function ProfileSupportTickets() {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTicket, setActiveTicket] = useState<SupportTicket | null>(null);
  const [replyText, setReplyText] = useState("");
  const [sendingReply, setSendingReply] = useState(false);

  const fetchTickets = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api<{ ok: boolean; tickets: SupportTicket[] }>("/support/tickets/my");
      if (res?.ok && Array.isArray(res.tickets)) {
        setTickets(res.tickets);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTicket || !replyText.trim()) return;

    try {
      setSendingReply(true);
      const res = await api<{ ok: boolean; ticket: SupportTicket; message: string }>(
        `/support/tickets/${activeTicket.ticketNo}/reply`,
        {
          method: "POST",
          body: { message: replyText.trim() },
        }
      );
      if (res?.ok && res.ticket) {
        toast.success("Reply submitted to seva team!");
        setActiveTicket(res.ticket);
        setReplyText("");
        fetchTickets();
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to send reply");
    } finally {
      setSendingReply(false);
    }
  };

  return (
    <section className="space-y-6">
      <div className="premium-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b">
          <div>
            <h2 className="font-display text-2xl">Support Tickets</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Direct assistance from our Vrindavan seva team
            </p>
          </div>
          <Link
            to="/support"
            search={{ tab: "submit" } as never}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition"
          >
            + New Support Ticket
          </Link>
        </div>

        {loading ? (
          <div className="py-12 text-center">
            <RefreshCw className="w-5 h-5 animate-spin mx-auto text-primary mb-2" />
            <p className="text-xs text-muted-foreground">Loading your tickets...</p>
          </div>
        ) : tickets.length === 0 ? (
          <div className="py-12 text-center">
            <LifeBuoy className="w-10 h-10 text-muted-foreground/40 mx-auto mb-2" />
            <p className="font-display text-base">No support tickets found</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
              If you have any questions regarding your orders, tulsi malas, or devotional seva, we are here to help.
            </p>
            <Link
              to="/support"
              search={{ tab: "submit" } as never}
              className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-primary text-primary-foreground text-xs font-semibold"
            >
              Open a Support Ticket
            </Link>
          </div>
        ) : (
          <div className="divide-y mt-2">
            {tickets.map((t) => (
              <div key={t._id} className="py-4">
                <div
                  onClick={() => setActiveTicket(activeTicket?._id === t._id ? null : t)}
                  className="flex items-center justify-between gap-3 cursor-pointer group"
                >
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-xs font-bold">{t.ticketNo}</span>
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                          SUPPORT_STATUS_COLORS[t.status]?.bg || "bg-muted"
                        } ${SUPPORT_STATUS_COLORS[t.status]?.text || "text-foreground"} ${
                          SUPPORT_STATUS_COLORS[t.status]?.border || "border-border"
                        }`}
                      >
                        {SUPPORT_STATUS_LABELS[t.status] || t.status}
                      </span>
                      {t.orderNo && (
                        <span className="text-[10px] font-medium text-primary bg-primary/10 px-1.5 py-0.2 rounded">
                          Order #{t.orderNo}
                        </span>
                      )}
                    </div>
                    <h4 className="text-sm font-semibold group-hover:text-primary transition">{t.subject}</h4>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {SUPPORT_CATEGORY_LABELS[t.category]} • Updated{" "}
                      {new Date(t.updatedAt).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                  <ChevronRight
                    className={`w-4 h-4 text-muted-foreground transition-transform ${
                      activeTicket?._id === t._id ? "rotate-90" : ""
                    }`}
                  />
                </div>

                {activeTicket?._id === t._id && (
                  <div className="mt-4 rounded-xl border bg-muted/30 p-4 space-y-4">
                    <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                      {activeTicket.messages.map((m, idx) => {
                        const isAdmin = m.senderType === "admin";
                        return (
                          <div
                            key={idx}
                            className={`p-3 rounded-lg text-xs leading-relaxed ${
                              isAdmin
                                ? "bg-primary/10 border border-primary/20 text-foreground"
                                : "bg-card border text-foreground"
                            }`}
                          >
                            <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
                              <span className="font-semibold">
                                {isAdmin ? `🛡️ Seva Team (${m.senderName})` : `🙏 You`}
                              </span>
                              <span>
                                {new Date(m.createdAt).toLocaleTimeString("en-IN", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                  day: "numeric",
                                  month: "short",
                                })}
                              </span>
                            </div>
                            <p className="whitespace-pre-wrap">{m.message}</p>
                          </div>
                        );
                      })}
                    </div>

                    {activeTicket.status !== "CLOSED" ? (
                      <form onSubmit={handleReply} className="space-y-2 pt-2 border-t">
                        <textarea
                          required
                          rows={2}
                          placeholder="Type your message to reply..."
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          className="w-full p-2.5 rounded-lg border bg-background text-xs focus:outline-none focus:border-primary"
                        />
                        <div className="flex justify-end">
                          <button
                            type="submit"
                            disabled={sendingReply}
                            className="px-4 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition flex items-center gap-1.5 disabled:opacity-60 cursor-pointer"
                          >
                            {sendingReply ? (
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Send className="w-3.5 h-3.5" />
                            )}
                            <span>Send Reply</span>
                          </button>
                        </div>
                      </form>
                    ) : (
                      <p className="text-xs text-muted-foreground text-center italic py-1">
                        This support ticket has been closed. Please open a new ticket if you have further inquiries.
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
