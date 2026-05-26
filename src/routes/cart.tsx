import { createFileRoute, Link } from "@tanstack/react-router";
import { Layout } from "@/components/Layout";
import { useStore, formatINR } from "@/lib/store";
import { Minus, Plus, Trash2, ShoppingBag } from "lucide-react";

export const Route = createFileRoute("/cart")({ component: CartPage });

function CartPage() {
  const { cart, adminProducts, updateQty, removeFromCart } = useStore();
  const items = cart.map((c) => ({ ...c, product: adminProducts.find((p) => p.id === c.productId)! })).filter((i) => i.product);
  const subtotal = items.reduce((s, i) => s + i.product.price * i.qty, 0);
  const shipping = subtotal > 999 || subtotal === 0 ? 0 : 49;
  const total = subtotal + shipping;

  if (items.length === 0) {
    return <Layout>
      <div className="container-app py-20 text-center">
        <ShoppingBag className="h-16 w-16 mx-auto text-muted-foreground" />
        <h1 className="font-display text-4xl mt-6">Your cart is empty</h1>
        <p className="text-muted-foreground mt-2">Discover sacred treasures from Vrindavan.</p>
        <Link to="/shop" className="mt-6 inline-flex h-12 px-8 rounded-full bg-primary text-primary-foreground items-center">Browse Shop</Link>
      </div>
    </Layout>;
  }

  return (
    <Layout>
      <div className="container-app py-10">
        <h1 className="font-display text-4xl">Shopping Cart</h1>
        <div className="grid lg:grid-cols-[1fr_380px] gap-8 mt-8">
          <div className="space-y-4">
            {items.map((i) => (
              <div key={i.productId} className="premium-card p-4 flex gap-4">
                <Link to="/product/$id" params={{ id: i.product.id }} className="h-24 w-24 rounded-lg overflow-hidden bg-muted shrink-0">
                  <img src={i.product.image} alt={i.product.name} className="h-full w-full object-cover" />
                </Link>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">{i.product.category}</p>
                  <Link to="/product/$id" params={{ id: i.product.id }} className="font-medium hover:text-primary line-clamp-2">{i.product.name}</Link>
                  <p className="font-semibold mt-1">{formatINR(i.product.price)}</p>
                </div>
                <div className="flex flex-col items-end justify-between">
                  <button onClick={() => removeFromCart(i.productId)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                  <div className="inline-flex items-center border rounded-full">
                    <button onClick={() => updateQty(i.productId, i.qty - 1)} className="h-8 w-8 grid place-items-center"><Minus className="h-3 w-3" /></button>
                    <span className="w-8 text-center text-sm">{i.qty}</span>
                    <button onClick={() => updateQty(i.productId, i.qty + 1)} className="h-8 w-8 grid place-items-center"><Plus className="h-3 w-3" /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <aside className="premium-card p-6 h-fit lg:sticky lg:top-24">
            <h2 className="font-display text-2xl mb-4">Order Summary</h2>
            <div className="space-y-2 text-sm">
              <Row label={`Subtotal (${items.length} items)`} value={formatINR(subtotal)} />
              <Row label="Shipping" value={shipping === 0 ? "FREE" : formatINR(shipping)} />
              <div className="border-t my-3" />
              <Row label="Total" value={formatINR(total)} bold />
            </div>
            <Link to="/checkout" className="mt-6 w-full h-12 rounded-full bg-primary text-primary-foreground grid place-items-center font-medium">Proceed to Checkout</Link>
            <Link to="/shop" className="mt-2 w-full h-11 rounded-full border grid place-items-center text-sm">Continue shopping</Link>
          </aside>
        </div>
      </div>
    </Layout>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return <div className={`flex justify-between ${bold ? "font-semibold text-base" : ""}`}><span>{label}</span><span>{value}</span></div>;
}
