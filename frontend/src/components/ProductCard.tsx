import { Link, useNavigate } from "@tanstack/react-router";
import { Eye, Heart, ShoppingCart } from "lucide-react";
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
    <div className="group relative flex h-full flex-col overflow-hidden rounded-lg border border-[#eadfce] bg-[#fffaf2] transition duration-200 hover:border-[#e4c895] hover:shadow-[0_10px_28px_-22px_rgba(85,34,34,.38)]">
      <div className="relative aspect-square overflow-hidden bg-[#fff7ec]">
        <Link to="/product/$id" params={{ id: productSlug }} className="block h-full">
          <img
            src={product.image}
            alt={product.name}
            loading="lazy"
            className="h-full w-full object-contain p-4 transition-transform duration-300 group-hover:scale-[1.025]"
          />
          <span className="absolute left-2 top-2 rounded-md bg-[#5a1f2a] px-2 py-1 text-[10px] font-bold leading-none text-white shadow-sm">
            Best Seller
          </span>
          {off > 0 && (
            <span className="absolute bottom-3 right-3 rounded bg-[#c62828] px-2 py-1 text-xs font-bold leading-none text-white shadow-sm">
              -{off}%
            </span>
          )}
          <span className="absolute bottom-3 left-3 rounded bg-[#2f8d3c] px-2 py-1 text-[11px] font-bold leading-none text-white shadow-sm">
            {product.rating.toFixed(1)} *
          </span>
          {outOfStock && (
            <span className="absolute inset-0 grid place-items-center bg-background/70 text-xs font-semibold uppercase tracking-widest text-foreground backdrop-blur-[1px]">
              Sold out
            </span>
          )}
        </Link>
        <button
          onClick={(e) => {
            toggleWishlist(product.id);
          }}
          className="absolute right-2 top-2 grid h-9 w-9 place-items-center rounded-full border border-border bg-white/95 shadow-sm transition hover:border-[#e4c895]"
          aria-label={
            wished ? `Remove ${product.name} from wishlist` : `Add ${product.name} to wishlist`
          }
        >
          <Heart
            className={`h-4 w-4 ${wished ? "fill-destructive text-destructive" : "text-foreground/70"}`}
          />
        </button>
        <span className="absolute right-2 top-12 grid h-9 w-9 place-items-center rounded-full border border-border bg-white/95 text-foreground/70 shadow-sm">
          <Eye className="h-4 w-4" />
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-2 bg-[#fff8ed] p-3">
        <Link
          to="/product/$id"
          params={{ id: productSlug }}
          className="line-clamp-2 min-h-[42px] text-[15px] font-medium leading-[1.35] text-[#202124] hover:text-[#6b2730]"
        >
          {product.name}
        </Link>

        <div className="flex flex-wrap items-baseline gap-2">
          <span className="text-[20px] font-semibold leading-none text-[#222]">
            {formatINR(product.price)}
          </span>
          {off > 0 && (
            <>
              <span className="text-xs text-muted-foreground line-through">
                {formatINR(product.mrp)}
              </span>
              <span className="text-xs font-medium text-[#2f8d3c]">{off}% off</span>
            </>
          )}
        </div>

        <div className="mt-auto grid grid-cols-2 gap-2 pt-2">
          <button
            disabled={outOfStock}
            onClick={() => addToCart(product.id)}
            className="inline-flex h-10 items-center justify-center gap-1.5 rounded-md border border-[#ddd4c8] bg-white px-2 text-xs font-semibold text-[#333] transition hover:border-[#c99a3a] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ShoppingCart className="h-3.5 w-3.5" /> Add to Cart
          </button>
          <button
            disabled={outOfStock}
            onClick={() => {
              buyNow(product.id);
              nav({ to: "/checkout" });
            }}
            className="inline-flex h-10 items-center justify-center rounded-md bg-[#f59611] px-2 text-xs font-semibold text-[#211000] transition hover:bg-[#ec8b00] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Buy Now
          </button>
        </div>
      </div>
    </div>
  );
}
