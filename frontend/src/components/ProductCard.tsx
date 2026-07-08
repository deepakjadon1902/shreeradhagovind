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
  const off =
    product.mrp > product.price
      ? Math.round(((product.mrp - product.price) / product.mrp) * 100)
      : 0;
  const outOfStock = product.stock === 0;

  return (
    <div className="card-3d group relative flex h-full flex-col overflow-hidden rounded-lg border border-border bg-white hover:border-primary/35">
      <Link
        to="/product/$id"
        params={{ id: product.id }}
        className="relative block aspect-[1/1.02] overflow-hidden bg-white"
      >
        <img
          src={product.image}
          alt={product.name}
          loading="lazy"
          className="h-full w-full object-contain p-2.5 transition-transform duration-300 group-hover:scale-[1.03]"
        />
        {off > 0 && (
          <span className="absolute left-2 top-2 rounded bg-[#212020] px-2 py-1 text-[10px] font-bold text-white shadow-sm">
            {off}% OFF
          </span>
        )}
        {outOfStock && (
          <span className="absolute inset-0 bg-background/70 backdrop-blur-[1px] grid place-items-center text-xs font-semibold uppercase tracking-widest text-foreground">
            Sold out
          </span>
        )}
        <button
          onClick={(e) => {
            e.preventDefault();
            toggleWishlist(product.id);
          }}
          className="glass-panel icon-bounce absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full transition hover:scale-110"
          aria-label={
            wished ? `Remove ${product.name} from wishlist` : `Add ${product.name} to wishlist`
          }
        >
          <Heart
            className={`h-4 w-4 ${wished ? "fill-destructive text-destructive" : "text-foreground/70"}`}
          />
        </button>
      </Link>

      <div className="flex flex-1 flex-col gap-1.5 p-2.5 sm:p-3">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground truncate">
          {product.category}
        </p>
        <Link
          to="/product/$id"
          params={{ id: product.id }}
          className="line-clamp-2 min-h-9 text-xs font-medium leading-snug hover:text-primary sm:min-h-10 sm:text-sm"
        >
          {product.name}
        </Link>

        {/* Flipkart-style rating pill */}
        <div className="flex items-center gap-1.5 text-xs">
          <span className="inline-flex items-center gap-0.5 rounded bg-green-600 px-1.5 py-0.5 text-[11px] font-semibold text-white">
            {product.rating.toFixed(1)} <Star className="h-2.5 w-2.5 fill-current" />
          </span>
          <span className="text-muted-foreground text-[11px]">
            ({product.reviews.toLocaleString("en-IN")})
          </span>
        </div>

        {/* Amazon-style price block */}
        <div className="mt-0.5 flex flex-wrap items-baseline gap-1.5">
          <span className="text-base font-bold text-foreground">{formatINR(product.price)}</span>
          {off > 0 && (
            <>
              <span className="text-xs text-muted-foreground line-through">
                {formatINR(product.mrp)}
              </span>
              <span className="text-xs font-semibold text-green-700">{off}% off</span>
            </>
          )}
        </div>

        <p className="text-[11px] font-medium text-green-700">Free delivery</p>

        <div className="mt-auto grid grid-cols-2 gap-1.5 pt-2">
          <button
            disabled={outOfStock}
            onClick={() => addToCart(product.id)}
            className="fx-button icon-bounce inline-flex h-9 items-center justify-center gap-1 rounded-md border border-[#212020]/15 bg-white text-xs font-semibold text-black hover:bg-secondary disabled:opacity-40"
          >
            <ShoppingBag className="h-3.5 w-3.5" /> Add
          </button>
          <button
            disabled={outOfStock}
            onClick={() => {
              buyNow(product.id);
              nav({ to: "/checkout" });
            }}
            className="fx-button icon-bounce inline-flex h-9 items-center justify-center gap-1 rounded-md bg-[#ffd814] text-xs font-semibold text-black hover:bg-[#f7ca00] disabled:opacity-40"
          >
            <Zap className="h-3.5 w-3.5" /> Buy
          </button>
        </div>
      </div>
    </div>
  );
}
