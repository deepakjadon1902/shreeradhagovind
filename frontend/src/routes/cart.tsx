import { createFileRoute, Link } from "@tanstack/react-router";
import { Layout } from "@/components/Layout";
import { useStore, formatINR } from "@/lib/store";
import { Minus, Plus, Trash2, ShoppingBag, Heart, Tag, ShieldCheck, Truck } from "lucide-react";
import { slugify } from "@/lib/seo";

export const Route = createFileRoute("/cart")({
  component: CartPage,
  head: () => ({
    meta: [
      { title: "Shopping Cart — Shri Radha Govind Store" },
      { name: "description", content: "Review the sacred essentials in your bag and proceed to a secure checkout." },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function CartPage() {
  const { cart, adminProducts, updateQty, removeFromCart, toggleWishlist, wishlist } = useStore();
  const items = cart
    .map((c) => ({ ...c, product: adminProducts.find((p) => p.id === c.productId)! }))
    .filter((i) => i.product);
  const subtotal = items.reduce((s, i) => s + i.product.price * i.qty, 0);
  const mrpTotal = items.reduce((s, i) => s + i.product.mrp * i.qty, 0);
  const savings = mrpTotal - subtotal;
  const shipping = subtotal > 999 || subtotal === 0 ? 0 : 49;
  const total = subtotal + shipping;
  const totalQty = items.reduce((s, i) => s + i.qty, 0);

  if (items.length === 0) {
    return (
      <Layout>
        <div className="container-app py-20 text-center">
          <div className="inline-grid place-items-center h-24 w-24 rounded-full bg-muted">
            <ShoppingBag className="h-10 w-10 text-muted-foreground" />
          </div>
          <h1 className="font-display text-4xl mt-6">Your bag is empty</h1>
          <p className="text-muted-foreground mt-2">Add sacred treasures from Vrindavan to your cart.</p>
          <Link to="/shop" className="mt-6 inline-flex h-12 px-8 rounded-full bg-primary text-primary-foreground items-center font-medium">
            Continue shopping
          </Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container-app py-6 md:py-10">
        <div className="flex items-baseline gap-3 mb-6">
          <h1 className="font-display text-3xl md:text-4xl">My Cart</h1>
          <span className="text-sm text-muted-foreground">({totalQty} {totalQty === 1 ? "item" : "items"})</span>
        </div>

        <div className="grid lg:grid-cols-[1fr_380px] gap-6">
          {/* Items column */}
          <div className="space-y-3">
            {/* Free delivery banner */}
            {shipping === 0 ? (
              <div className="flex items-center gap-2 text-sm bg-green-600/10 text-green-700 px-4 py-3 rounded-lg">
                <Truck className="h-4 w-4" /> Yay! You get <strong>FREE delivery</strong> on this order.
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm bg-amber-500/10 text-amber-700 px-4 py-3 rounded-lg">
                <Truck className="h-4 w-4" /> Add {formatINR(1000 - subtotal)} more for <strong>FREE delivery</strong>.
              </div>
            )}

            {items.map((i) => {
              const off = i.product.mrp > i.product.price
                ? Math.round(((i.product.mrp - i.product.price) / i.product.mrp) * 100)
                : 0;
              const wished = wishlist.includes(i.productId);
              return (
                <div key={i.productId} className="bg-card border border-border/60 rounded-xl p-4 flex gap-4">
                  <Link
                    to="/product/$id"
                    params={{ id: i.product.slug ?? slugify(i.product.name) }}
                    className="h-28 w-28 sm:h-32 sm:w-32 rounded-lg overflow-hidden bg-muted shrink-0"
                  >
                    <img src={i.product.image} alt={i.product.name} className="h-full w-full object-cover" />
                  </Link>
                  <div className="flex-1 min-w-0 flex flex-col">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{i.product.category}</p>
                    <Link
                      to="/product/$id"
                      params={{ id: i.product.slug ?? slugify(i.product.name) }}
                      className="font-medium hover:text-primary line-clamp-2 text-sm sm:text-base"
                    >
                      {i.product.name}
                    </Link>
                    <div className="flex items-baseline gap-2 flex-wrap mt-1">
                      <span className="font-bold text-base">{formatINR(i.product.price)}</span>
                      {off > 0 && (
                        <>
                          <span className="text-xs text-muted-foreground line-through">{formatINR(i.product.mrp)}</span>
                          <span className="text-xs font-semibold text-green-700">{off}% off</span>
                        </>
                      )}
                    </div>
                    <p className="text-xs text-green-700 mt-0.5">In stock · Delivery in 3–5 days</p>

                    <div className="mt-auto pt-3 flex items-center gap-2 flex-wrap">
                      <div className="inline-flex items-center border rounded-full bg-background overflow-hidden">
                        <button
                          onClick={() => updateQty(i.productId, i.qty - 1)}
                          className="h-8 w-8 grid place-items-center hover:bg-muted disabled:opacity-30"
                          disabled={i.qty <= 1}
                          aria-label="Decrease"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="w-8 text-center text-sm font-medium">{i.qty}</span>
                        <button
                          onClick={() => updateQty(i.productId, i.qty + 1)}
                          className="h-8 w-8 grid place-items-center hover:bg-muted"
                          aria-label="Increase"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                      <button
                        onClick={() => { toggleWishlist(i.productId); removeFromCart(i.productId); }}
                        className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:text-primary px-2 h-8"
                      >
                        <Heart className={`h-3.5 w-3.5 ${wished ? "fill-destructive text-destructive" : ""}`} /> Save for later
                      </button>
                      <button
                        onClick={() => removeFromCart(i.productId)}
                        className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:text-destructive px-2 h-8"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Remove
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Summary sticky aside (Amazon / Flipkart pattern) */}
          <aside className="lg:sticky lg:top-24 h-fit space-y-3">
            <div className="bg-card border border-border/60 rounded-xl p-5">
              <h2 className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-4">
                Price Details ({totalQty} items)
              </h2>
              <div className="space-y-2.5 text-sm">
                <Row label={`Price (${totalQty} items)`} value={formatINR(mrpTotal)} />
                <Row label="Discount" value={savings > 0 ? `– ${formatINR(savings)}` : "—"} valueClass={savings > 0 ? "text-green-700 font-medium" : ""} />
                <Row label="Delivery Charges" value={shipping === 0 ? "FREE" : formatINR(shipping)} valueClass={shipping === 0 ? "text-green-700 font-medium" : ""} />
                <div className="border-t border-dashed my-2" />
                <Row label="Total Amount" value={formatINR(total)} bold />
              </div>
              {savings > 0 && (
                <p className="mt-3 text-sm text-green-700 font-medium flex items-center gap-1.5">
                  <Tag className="h-4 w-4" /> You'll save {formatINR(savings)} on this order
                </p>
              )}
              <Link
                to="/checkout"
                className="mt-5 w-full h-12 rounded-full bg-primary text-primary-foreground grid place-items-center font-semibold hover:opacity-90 transition"
              >
                Place Order
              </Link>
              <Link
                to="/shop"
                className="mt-2 w-full h-11 rounded-full border grid place-items-center text-sm hover:bg-muted"
              >
                Continue shopping
              </Link>
            </div>

            <div className="bg-card border border-border/60 rounded-xl p-4 flex items-start gap-3">
              <ShieldCheck className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium">Safe & secure payments</p>
                <p className="text-xs text-muted-foreground">100% authentic · Easy 7-day returns</p>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </Layout>
  );
}

function Row({ label, value, bold, valueClass }: { label: string; value: string; bold?: boolean; valueClass?: string }) {
  return (
    <div className={`flex justify-between ${bold ? "font-bold text-base pt-1" : "text-foreground/80"}`}>
      <span>{label}</span>
      <span className={valueClass}>{value}</span>
    </div>
  );
}
