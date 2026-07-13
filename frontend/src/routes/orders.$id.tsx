import { createFileRoute, Link } from "@tanstack/react-router";
import { Layout } from "@/components/Layout";
import { useStore, formatINR, type Order } from "@/lib/store";
import { Check, Package, Truck, Home, CreditCard } from "lucide-react";

export const Route = createFileRoute("/orders/$id")({
  component: OrderDetail,
  head: () => ({ meta: [{ title: "Order Details — Shri Radha Govind Store" }, { name: "robots", content: "noindex" }] }),
});

const STAGES: Order["status"][] = ["Placed", "Confirmed", "Processing", "Packed", "Shipped", "Out for delivery", "Delivered"];

function OrderDetail() {
  const { id } = Route.useParams();
  const { orders } = useStore();
  const order = orders.find((o) => o.id === id);

  if (!order) return <Layout><div className="container-app py-20 text-center"><h1 className="font-display text-3xl">Order not found</h1><Link to="/orders" className="text-primary mt-4 inline-block">← All orders</Link></div></Layout>;

  const idx = STAGES.indexOf(order.status);
  const cancelled = order.status === "Cancelled";
  return (
    <Layout>
      <div className="container-app py-10">
        <Link to="/orders" className="text-sm text-muted-foreground hover:text-primary">← All orders</Link>
        <h1 className="font-display text-4xl mt-2">Order #{order.id}</h1>
        <p className="text-muted-foreground text-sm">Placed on {new Date(order.createdAt).toLocaleString()}</p>

        {order.trackingId && (
          <div className="premium-card p-5 mt-4 flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-0">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Tracking ID</p>
              <p className="font-display text-xl text-primary">{order.trackingId}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Courier</p>
              <p className="font-medium">{order.courier ?? "To be assigned"}</p>
            </div>
            <Link to="/track" search={{ id: order.trackingId } as never} className="h-10 px-5 rounded-full bg-primary text-primary-foreground text-sm inline-flex items-center">Open public tracker</Link>
          </div>
        )}

        {!cancelled && (
        <div className="premium-card p-6 mt-6">
          <h2 className="font-display text-xl mb-6">Track your order</h2>
          <div className="flex items-center justify-between relative">
            <div className="absolute top-5 left-5 right-5 h-0.5 bg-border" />
            <div className="absolute top-5 left-5 h-0.5 bg-primary transition-all" style={{ width: `calc(${(idx / (STAGES.length - 1)) * 100}% - 0px)` }} />
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

        <div className="grid lg:grid-cols-[1fr_360px] gap-6 mt-6">
          <div className="premium-card p-6">
            <h2 className="font-display text-xl mb-4 flex items-center gap-2"><Package className="h-5 w-5 text-primary" /> Items</h2>
            <div className="space-y-4">
              {order.items.map((i) => (
                <div key={i.product.id} className="flex gap-4">
                  <div className="h-16 w-16 rounded-lg overflow-hidden bg-muted shrink-0"><img src={i.product.image} alt="" className="h-full w-full object-cover" /></div>
                  <div className="flex-1">
                    <p className="font-medium text-sm">{i.product.name}</p>
                    <p className="text-xs text-muted-foreground">Qty {i.qty} · {formatINR(i.product.price)}</p>
                  </div>
                  <span className="font-semibold">{formatINR(i.product.price * i.qty)}</span>
                </div>
              ))}
            </div>
          </div>
          <aside className="space-y-4">
            <div className="premium-card p-5">
              <h3 className="font-display text-lg mb-2 flex items-center gap-2"><Home className="h-4 w-4 text-primary" /> Shipping</h3>
              <p className="text-sm">{order.address.name}</p>
              <p className="text-xs text-muted-foreground">{order.address.line1}, {order.address.city}, {order.address.state} {order.address.pincode}</p>
              <p className="text-xs text-muted-foreground mt-1">📞 {order.address.phone}</p>
            </div>
            <div className="premium-card p-5">
              <h3 className="font-display text-lg mb-2 flex items-center gap-2"><CreditCard className="h-4 w-4 text-primary" /> Payment</h3>
              <p className="text-sm capitalize">{order.payment.method === "razorpay" ? "Razorpay" : "Cash on Delivery"}</p>
              <p className={`text-xs mt-1 ${order.payment.status === "paid" ? "text-green-700" : "text-amber-700"}`}>{order.payment.status.toUpperCase()}</p>
              <div className="border-t my-3" />
              <div className="flex justify-between font-semibold"><span>Total</span><span>{formatINR(order.total)}</span></div>
            </div>
          </aside>
        </div>
      </div>
    </Layout>
  );
}
