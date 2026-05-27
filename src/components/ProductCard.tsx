import { Link, useNavigate } from "@tanstack/react-router";
import { Heart, Star, ShoppingBag, Zap } from "lucide-react";
import { type Product } from "@/lib/products";
import { useStore, formatINR } from "@/lib/store";

export function ProductCard({ product }: { product: Product }) {
  const { wishlist, toggleWishlist, addToCart, buyNow } = useStore();
  const nav = useNavigate();
  const wished = wishlist.includes(product.id);
  const off = Math.round(((product.mrp - product.price) / product.mrp) * 100);
  return (
    <div className="premium-card group overflow-hidden flex flex-col">
      <Link to="/product/$id" params={{ id: product.id }} className="relative block aspect-square overflow-hidden bg-muted">
        <img src={product.image} alt={product.name} loading="lazy" className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-700" />
        {off > 0 && <span className="absolute top-3 left-3 bg-primary text-primary-foreground text-[10px] font-semibold px-2 py-1 rounded-full tracking-wide">{off}% OFF</span>}
        <button
          onClick={(e) => { e.preventDefault(); toggleWishlist(product.id); }}
          className="absolute top-3 right-3 h-9 w-9 grid place-items-center rounded-full bg-card/90 backdrop-blur shadow-sm hover:scale-110 transition"
          aria-label="Wishlist"
        >
          <Heart className={`h-4 w-4 ${wished ? "fill-primary text-primary" : ""}`} />
        </button>
      </Link>
      <div className="p-4 flex flex-col gap-2 flex-1">
        <p className="text-[11px] uppercase tracking-widest text-muted-foreground">{product.category}</p>
        <Link to="/product/$id" params={{ id: product.id }} className="font-medium text-sm leading-snug line-clamp-2 hover:text-primary">
          {product.name}
        </Link>
        <div className="flex items-center gap-1 text-xs">
          <span className="flex items-center gap-0.5 bg-green-600/10 text-green-700 px-1.5 py-0.5 rounded">
            <Star className="h-3 w-3 fill-current" /> {product.rating}
          </span>
          <span className="text-muted-foreground">({product.reviews})</span>
        </div>
        <div className="flex items-baseline gap-2 mt-auto">
          <span className="font-semibold text-base">{formatINR(product.price)}</span>
          <span className="text-xs text-muted-foreground line-through">{formatINR(product.mrp)}</span>
        </div>
        <div className="grid grid-cols-2 gap-2 mt-2">
          <button
            onClick={() => addToCart(product.id)}
            className="inline-flex items-center justify-center gap-1.5 h-9 rounded-full border border-foreground/80 text-foreground text-xs font-medium hover:bg-foreground hover:text-background transition"
          >
            <ShoppingBag className="h-3.5 w-3.5" /> Add
          </button>
          <button
            onClick={() => { buyNow(product.id); nav({ to: "/checkout" }); }}
            className="inline-flex items-center justify-center gap-1.5 h-9 rounded-full bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 transition"
          >
            <Zap className="h-3.5 w-3.5" /> Buy Now
          </button>
        </div>
      </div>
    </div>
  );
}
