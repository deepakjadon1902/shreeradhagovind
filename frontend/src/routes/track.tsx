import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { formatINR } from "@/lib/store";
import { api, isApiEnabled } from "@/lib/api";
import { Check, Package, Search, Truck, MapPin, ExternalLink } from "lucide-react";
import { toast } from "sonner";

type Search = { id?: string };

const STAGES = ["Placed", "Packed", "Shipped", "Out for delivery", "Delivered"] as const;

type TrackedOrder = {
  trackingId: string;
  status: string;
  courier?: string | null;
  courierTrackingUrl?: string;
  createdAt: string;
  items: { name?: string; image?: string; qty: number; price?: number }[];
  total: number;
  address: { name?: string; city?: string; state?: string; pincode?: string };
  payment: { method: string; status: string };
};

export const Route = createFileRoute("/track")({
  validateSearch: (s: Record<string, unknown>): Search => ({ id: typeof s.id === "string" ? s.id : undefined }),
  component: TrackPage,
  head: () => ({
    meta: [
      { title: "Track Your Order — Shri Radha Govind Store" },
      { name: "description", content: "Track your Shri Radha Govind Store order in real time using your unique tracking ID. See courier, status and delivery updates." },
      { property: "og:title", content: "Track Your Order — Shri Radha Govind Store" },
      { property: "og:description", content: "Live order tracking for sacred essentials from Vrindavan." },
      { property: "og:url", content: "https://www.shriradhagovindstore.com/track" },
    ],
    links: [{ rel: "canonical", href: "https://www.shriradhagovindstore.com/track" }],
  }),
});

function TrackPage() {
  const search = Route.useSearch();
  const [id, setId] = useState(search.id ?? "");
  const [loading, setLoading] = useState(false);
  const [order, setOrder] = useState<TrackedOrder | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const lookup = async (trackingId: string) => {
    const t = trackingId.trim().toUpperCase();
    if (!t) return;
    setLoading(true); setErr(null); setOrder(null);
    try {
      if (!isApiEnabled()) {
        // demo mode: read from localStorage
        const raw = localStorage.getItem("shri_radha_govind_v1_orders");
        const orders = raw ? JSON.parse(raw) : [];
        const found = orders.find((o: any) => (o.trackingId ?? "").toUpperCase() === t || o.id === t);
        if (!found) throw new Error("No order found for this tracking ID");
        setOrder({
          trackingId: found.trackingId ?? found.id,
          status: found.status,
          courier: found.courier ?? null,
          courierTrackingUrl: found.courierTrackingUrl ?? "",
          createdAt: new Date(found.createdAt).toISOString(),
          items: found.items.map((i: any) => ({ name: i.product?.name, image: i.product?.image, qty: i.qty, price: i.product?.price })),
          total: found.total,
          address: found.address,
          payment: found.payment,
        });
      } else {
        const r = await api<{ order: TrackedOrder }>(`/orders/track/${encodeURIComponent(t)}`);
        setOrder(r.order);
      }
    } catch (e: any) {
      setErr(e?.message ?? "Not found");
      toast.error(e?.message ?? "Not found");
    } finally { setLoading(false); }
  };

  useEffect(() => { if (search.id) lookup(search.id); /* eslint-disable-next-line */ }, []);

  const idx = order ? STAGES.indexOf(order.status as any) : -1;
  const cancelled = order?.status === "Cancelled";

  return (
    <Layout>
      <div className="container-app py-10 max-w-3xl">
        <h1 className="font-display text-4xl">Track your order</h1>
        <p className="text-sm text-muted-foreground mt-1">Enter the tracking ID you received in your order confirmation email.</p>
        <form onSubmit={(e) => { e.preventDefault(); lookup(id); }} className="mt-6 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input value={id} onChange={(e) => setId(e.target.value)} placeholder="e.g. SRG-AB12CD34" className="w-full h-12 pl-10 pr-4 rounded-full border bg-card focus:outline-none focus:border-primary text-sm uppercase tracking-wider" />
          </div>
          <button disabled={loading} className="h-12 px-6 rounded-full bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50">{loading ? "Searching…" : "Track"}</button>
        </form>

        {err && !order && <p className="text-sm text-destructive mt-4">{err}</p>}

        {order && (
          <div className="mt-8 space-y-6">
            <div className="premium-card p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">Tracking ID</p>
                  <p className="font-display text-2xl text-primary">{order.trackingId}</p>
                  <p className="text-xs text-muted-foreground mt-1">Placed on {new Date(order.createdAt).toLocaleString()}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">Status</p>
                  <p className={`font-display text-xl ${cancelled ? "text-destructive" : "text-primary"}`}>{order.status}</p>
                  {order.courier && <p className="text-xs text-muted-foreground mt-1 inline-flex items-center gap-1"><Truck className="h-3 w-3" /> {order.courier}</p>}
                </div>
              </div>

              {!cancelled && (
                <div className="mt-8">
                  <div className="flex items-center justify-between relative">
                    <div className="absolute top-5 left-5 right-5 h-0.5 bg-border" />
                    <div className="absolute top-5 left-5 h-0.5 bg-primary transition-all" style={{ width: `calc(${Math.max(0, idx) / (STAGES.length - 1) * 100}% - 0px)` }} />
                    {STAGES.map((s, i) => (
                      <div key={s} className="relative z-10 flex flex-col items-center text-center">
                        <div className={`h-10 w-10 rounded-full grid place-items-center ${i <= idx ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                          {i <= idx ? <Check className="h-4 w-4" /> : <span className="text-xs">{i + 1}</span>}
                        </div>
                        <p className={`text-[10px] mt-2 max-w-[80px] ${i <= idx ? "text-foreground font-medium" : "text-muted-foreground"}`}>{s}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {order.courier && order.courierTrackingUrl && (
                <a href={order.courierTrackingUrl} target="_blank" rel="noreferrer" className="mt-6 inline-flex items-center gap-2 text-sm text-primary hover:underline">
                  Track on {order.courier} <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
            </div>

            <div className="premium-card p-6">
              <h2 className="font-display text-xl mb-4 flex items-center gap-2"><Package className="h-5 w-5 text-primary" /> Items ({order.items.length})</h2>
              <div className="space-y-4">
                {order.items.map((i, idx) => (
                  <div key={idx} className="flex gap-4">
                    {i.image && <div className="h-14 w-14 rounded-lg overflow-hidden bg-muted shrink-0"><img src={i.image} alt="" className="h-full w-full object-cover" /></div>}
                    <div className="flex-1">
                      <p className="text-sm font-medium">{i.name}</p>
                      <p className="text-xs text-muted-foreground">Qty {i.qty}{i.price ? ` · ${formatINR(i.price)}` : ""}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="border-t mt-4 pt-3 flex justify-between font-semibold"><span>Total</span><span>{formatINR(order.total)}</span></div>
              <p className="text-xs text-muted-foreground mt-1">Payment: {order.payment.method.toUpperCase()} · {order.payment.status.toUpperCase()}</p>
            </div>

            <div className="premium-card p-6">
              <h2 className="font-display text-xl mb-2 flex items-center gap-2"><MapPin className="h-5 w-5 text-primary" /> Delivery</h2>
              <p className="text-sm">{order.address.name}</p>
              <p className="text-sm text-muted-foreground">{order.address.city}, {order.address.state} {order.address.pincode}</p>
            </div>
          </div>
        )}

        <p className="text-xs text-muted-foreground mt-10">Lost your tracking ID? Sign in to your account and visit <Link to="/orders" className="text-primary">My Orders</Link>.</p>
      </div>
    </Layout>
  );
}
