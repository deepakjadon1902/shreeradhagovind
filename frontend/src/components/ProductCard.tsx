import { Link, useNavigate } from "@tanstack/react-router";
import { Heart } from "lucide-react";
import { type Product } from "@/lib/products";
import { useStore, formatINR } from "@/lib/store";
import { slugify } from "@/lib/seo";

export function ProductCard({ product }: { product: Product }) {
  const { wishlist, toggleWishlist, addToCart, buyNow } = useStore();
  const nav = useNavigate();
  const wished = wishlist.includes(product.id);
  const off =
    product.mrp > product.price
      ? Math.round(((product.mrp - product.price) / product.mrp) * 100)
      : 0;
  const outOfStock = product.stock === 0;
  const productSlug = product.slug ?? slugify(product.name);

  return (
    <div className="group relative flex h-full flex-col overflow-hidden rounded-lg border border-border bg-white transition duration-200 hover:border-primary/30 hover:shadow-[0_18px_36px_-30px_rgba(15,111,114,.45)]">
      <Link
        to="/product/$id"
        params={{ id: productSlug }}
        className="relative block aspect-square overflow-hidden bg-white"
      >
        <img
          src={product.image}
          alt={product.name}
          loading="lazy"
          className="h-full w-full object-contain p-3 transition-transform duration-300 group-hover:scale-[1.025]"
        />
        {off > 0 && (
          <span className="absolute left-2 top-2 rounded bg-primary px-2 py-1 text-[10px] font-bold text-primary-foreground shadow-sm">
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
          className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full border border-border bg-white/95 shadow-sm transition hover:border-primary/30"
          aria-label={
            wished ? `Remove ${product.name} from wishlist` : `Add ${product.name} to wishlist`
          }
        >
          <Heart
            className={`h-4 w-4 ${wished ? "fill-destructive text-destructive" : "text-foreground/70"}`}
          />
        </button>
      </Link>

      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <p className="truncate text-[10px] uppercase tracking-wider text-muted-foreground">
          {product.category}
        </p>
        <Link
          to="/product/$id"
          params={{ id: productSlug }}
          className="line-clamp-2 min-h-9 text-xs font-semibold leading-snug hover:text-primary sm:min-h-10 sm:text-sm"
        >
          {product.name}
        </Link>

        <div className="flex items-center gap-1.5 text-xs">
          <span className="inline-flex items-center gap-0.5 rounded bg-emerald-600/10 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-700">
            {product.rating.toFixed(1)}
          </span>
          <span className="text-muted-foreground text-[11px]">
            ({product.reviews.toLocaleString("en-IN")})
          </span>
        </div>

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

        <p className="text-[11px] font-medium text-emerald-700">Free delivery</p>

        <div className="mt-auto grid grid-cols-2 gap-2 pt-2">
          <button
            disabled={outOfStock}
            onClick={() => addToCart(product.id)}
            className="inline-flex h-9 items-center justify-center rounded-md border border-primary/20 bg-white text-xs font-semibold text-foreground transition hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-40"
          >
            Add
          </button>
          <button
            disabled={outOfStock}
            onClick={() => {
              buyNow(product.id);
              nav({ to: "/checkout" });
            }}
            className="inline-flex h-9 items-center justify-center rounded-md bg-primary text-xs font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Buy
          </button>
        </div>
      </div>
    </div>
  );
}
