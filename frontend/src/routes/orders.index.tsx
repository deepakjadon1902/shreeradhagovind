import { createFileRoute, Link } from "@tanstack/react-router";
import { Layout } from "@/components/Layout";
import { useStore, formatINR } from "@/lib/store";
import { Package } from "lucide-react";

export const Route = createFileRoute("/orders/")({
  component: OrdersPage,
  head: () => ({ meta: [{ title: "My Orders — Shri Radha Govind Store" }, { name: "description", content: "View your order history, payment status and delivery progress." }, { name: "robots", content: "noindex" }] }),
});

function OrdersPage() {
  const { orders } = useStore();
  return (
    <Layout>
      <div className="container-app py-10">
        <h1 className="font-display text-4xl">My Orders</h1>
        {orders.length === 0 ? (
          <div className="text-center py-20">
            <Package className="h-16 w-16 mx-auto text-muted-foreground" />
            <p className="mt-4 text-muted-foreground">No orders yet.</p>
            <Link to="/shop" className="mt-4 inline-flex h-11 px-6 rounded-full bg-primary text-primary-foreground items-center">Start Shopping</Link>
          </div>
        ) : (
          <div className="space-y-4 mt-6">
            {orders.map((o) => (
              <Link key={o.id} to="/orders/$id" params={{ id: o.id }} className="premium-card p-5 flex items-center gap-4 hover:border-primary">
                <div className="flex -space-x-2">
                  {o.items.slice(0, 3).map((i) => (
                    <div key={i.product.id} className="h-14 w-14 rounded-lg overflow-hidden bg-muted border-2 border-card">
                      <img src={i.product.image} alt="" className="h-full w-full object-cover" />
                    </div>
                  ))}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium">Order #{o.id}</p>
                  <p className="text-xs text-muted-foreground">{new Date(o.createdAt).toLocaleDateString()} · {o.items.length} items</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{formatINR(o.total)}</p>
                  <span className="text-xs inline-block mt-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary">{o.status}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
