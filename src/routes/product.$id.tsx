import { createFileRoute, Link, useNavigate, notFound } from "@tanstack/react-router";
import { Layout } from "@/components/Layout";
import { useStore, formatINR } from "@/lib/store";
import { Heart, ShoppingBag, Star, Truck, ShieldCheck, RefreshCw, Check } from "lucide-react";
import { useState } from "react";
import { ProductCard } from "@/components/ProductCard";

export const Route = createFileRoute("/product/$id")({
  component: ProductDetail,
});

function ProductDetail() {
  const { id } = Route.useParams();
  const { adminProducts, addToCart, wishlist, toggleWishlist } = useStore();
  const nav = useNavigate();
  const product = adminProducts.find((p) => p.id === id);
  const [qty, setQty] = useState(1);

  if (!product) {
    return <Layout><div className="container-app py-20 text-center"><h1 className="font-display text-3xl">Product not found</h1><Link to="/shop" className="text-primary mt-4 inline-block">← Back to shop</Link></div></Layout>;
  }

  const wished = wishlist.includes(product.id);
  const off = Math.round(((product.mrp - product.price) / product.mrp) * 100);
  const related = adminProducts.filter((p) => p.category === product.category && p.id !== product.id).slice(0, 4);

  return (
    <Layout>
      <div className="container-app py-8">
        <nav className="text-xs text-muted-foreground mb-6">
          <Link to="/" className="hover:text-primary">Home</Link> / <Link to="/shop" className="hover:text-primary">Shop</Link> / <span>{product.category}</span>
        </nav>
        <div className="grid md:grid-cols-2 gap-10">
          <div className="aspect-square rounded-2xl overflow-hidden bg-muted premium-shadow">
            <img src={product.image} alt={product.name} className="h-full w-full object-cover" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-primary">{product.category}</p>
            <h1 className="font-display text-3xl md:text-4xl mt-2">{product.name}</h1>
            <div className="flex items-center gap-3 mt-3">
              <span className="inline-flex items-center gap-1 bg-green-600/10 text-green-700 px-2 py-1 rounded text-xs"><Star className="h-3 w-3 fill-current" />{product.rating}</span>
              <span className="text-sm text-muted-foreground">{product.reviews.toLocaleString()} reviews</span>
            </div>
            <div className="flex items-baseline gap-3 mt-5">
              <span className="text-3xl font-semibold">{formatINR(product.price)}</span>
              <span className="text-base text-muted-foreground line-through">{formatINR(product.mrp)}</span>
              {off > 0 && <span className="text-sm text-green-700 font-medium">{off}% off</span>}
            </div>
            <p className="text-muted-foreground mt-4 leading-relaxed">{product.description}</p>

            <ul className="mt-5 space-y-2">
              {product.details.map((d) => (
                <li key={d} className="flex items-center gap-2 text-sm"><Check className="h-4 w-4 text-primary" /> {d}</li>
              ))}
            </ul>

            <div className="flex items-center gap-3 mt-6">
              <div className="inline-flex items-center border rounded-full overflow-hidden">
                <button onClick={() => setQty(Math.max(1, qty - 1))} className="h-11 w-11 hover:bg-muted">−</button>
                <span className="w-10 text-center">{qty}</span>
                <button onClick={() => setQty(qty + 1)} className="h-11 w-11 hover:bg-muted">+</button>
              </div>
              <span className="text-sm text-muted-foreground">{product.stock} in stock</span>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-6">
              <button onClick={() => addToCart(product.id, qty)} className="h-12 rounded-full border border-foreground/20 hover:border-primary hover:text-primary inline-flex items-center justify-center gap-2 font-medium">
                <ShoppingBag className="h-4 w-4" /> Add to cart
              </button>
              <button onClick={() => { addToCart(product.id, qty); nav({ to: "/checkout" }); }} className="h-12 rounded-full bg-primary text-primary-foreground hover:opacity-90 font-medium">Buy Now</button>
            </div>
            <button onClick={() => toggleWishlist(product.id)} className="mt-3 inline-flex items-center gap-2 text-sm hover:text-primary">
              <Heart className={`h-4 w-4 ${wished ? "fill-primary text-primary" : ""}`} /> {wished ? "In wishlist" : "Add to wishlist"}
            </button>

            <div className="mt-8 grid grid-cols-3 gap-3 border-t pt-6">
              {[[Truck,"Free shipping"],[ShieldCheck,"100% Authentic"],[RefreshCw,"7-day returns"]].map(([I,t],i) => {
                const Icon = I as typeof Truck;
                return <div key={i} className="text-center"><Icon className="h-5 w-5 mx-auto text-primary" /><p className="text-xs mt-1.5">{t}</p></div>;
              })}
            </div>
          </div>
        </div>

        {related.length > 0 && (
          <section className="mt-20">
            <h2 className="font-display text-3xl mb-6">You may also like</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
              {related.map((p) => <ProductCard key={p.id} product={p} />)}
            </div>
          </section>
        )}
      </div>
    </Layout>
  );
}
