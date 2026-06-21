import { Link, useNavigate } from "@tanstack/react-router";
import { Heart, Star, ShoppingBag, Zap } from "lucide-react";
import { type Product } from "@/lib/products";
import { useStore, formatINR } from "@/lib/store";

/**
 * Marketplace-style product card inspired by Flipkart / Meesho / Amazon:
 *  - Square image with discount ribbon top-left and floating wishlist top-right
 *  - Tight typography, title clamped to 2 lines
 *  - Green pill rating with review count (Flipkart pattern)
 *  - Bold price + strikethrough MRP + green "X% off" (Amazon pattern)
 *  - Sticky Add / Buy Now CTA row
 */
export function ProductCard({ product }: { product: Product }) {
  const { wishlist, toggleWishlist, addToCart, buyNow } = useStore();
  const nav = useNavigate();
  const wished = wishlist.includes(product.id);
  const off = product.mrp > product.price
    ? Math.round(((product.mrp - product.price) / product.mrp) * 100)
    : 0;
  const outOfStock = product.stock === 0;

  return (
    <div className="group relative flex flex-col rounded-xl bg-card border border-border/60 overflow-hidden transition-all hover:shadow-[0_8px_28px_-12px_rgba(0,0,0,0.18)] hover:border-primary/40">
      <Link
        to="/product/$id"
        params={{ id: product.id }}
        className="relative block aspect-square overflow-hidden bg-muted/40"
      >
        <img
          src={product.image}
          alt={product.name}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
        />
        {off > 0 && (
          <span className="absolute top-2 left-2 bg-primary text-primary-foreground text-[10px] font-bold px-2 py-1 rounded shadow-sm">
            {off}% OFF
          </span>
        )}
        {outOfStock && (
          <span className="absolute inset-0 bg-background/70 backdrop-blur-[1px] grid place-items-center text-xs font-semibold uppercase tracking-widest text-foreground">
            Sold out
          </span>
        )}
        <button
          onClick={(e) => { e.preventDefault(); toggleWishlist(product.id); }}
          className="absolute top-2 right-2 h-8 w-8 grid place-items-center rounded-full bg-card/95 backdrop-blur shadow-sm hover:scale-110 transition"
          aria-label="Add to wishlist"
        >
          <Heart className={`h-4 w-4 ${wished ? "fill-destructive text-destructive" : "text-foreground/70"}`} />
        </button>
      </Link>

      <div className="p-3 flex flex-col gap-1.5 flex-1">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground truncate">
          {product.category}
        </p>
        <Link
          to="/product/$id"
          params={{ id: product.id }}
          className="text-sm font-medium leading-snug line-clamp-2 min-h-[2.5rem] hover:text-primary"
        >
          {product.name}
        </Link>

        {/* Flipkart-style rating pill */}
        <div className="flex items-center gap-1.5 text-xs">
          <span className="inline-flex items-center gap-0.5 bg-green-600 text-white px-1.5 py-0.5 rounded text-[11px] font-semibold">
            {product.rating.toFixed(1)} <Star className="h-2.5 w-2.5 fill-current" />
          </span>
          <span className="text-muted-foreground text-[11px]">({product.reviews.toLocaleString("en-IN")})</span>
        </div>

        {/* Amazon-style price block */}
        <div className="flex items-baseline gap-1.5 flex-wrap mt-0.5">
          <span className="font-bold text-base text-foreground">{formatINR(product.price)}</span>
          {off > 0 && (
            <>
              <span className="text-xs text-muted-foreground line-through">{formatINR(product.mrp)}</span>
              <span className="text-xs font-semibold text-green-700">{off}% off</span>
            </>
          )}
        </div>

        <p className="text-[11px] text-green-700 font-medium">Free delivery</p>

        <div className="grid grid-cols-2 gap-1.5 mt-2">
          <button
            disabled={outOfStock}
            onClick={() => addToCart(product.id)}
            className="inline-flex items-center justify-center gap-1 h-9 rounded-md border border-foreground/15 bg-secondary/60 text-foreground text-xs font-semibold hover:bg-secondary transition disabled:opacity-40"
          >
            <ShoppingBag className="h-3.5 w-3.5" /> Add
          </button>
          <button
            disabled={outOfStock}
            onClick={() => { buyNow(product.id); nav({ to: "/checkout" }); }}
            className="inline-flex items-center justify-center gap-1 h-9 rounded-md bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition disabled:opacity-40"
          >
            <Zap className="h-3.5 w-3.5" /> Buy
          </button>
        </div>
      </div>
    </div>
  );
}
