import { Link, useNavigate } from "@tanstack/react-router";
import { Eye, Heart, ShoppingCart, Star, Check, Minus, Plus } from "lucide-react";
import { useState } from "react";
import { type Product } from "@/lib/products";
import { useStore, formatINR } from "@/lib/store";
import { slugify } from "@/lib/seo";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

export function ProductCard({ product }: { product: Product }) {
  const { wishlist, toggleWishlist, addToCart, buyNow } = useStore();
  const nav = useNavigate();
  const [quickViewOpen, setQuickViewOpen] = useState(false);
  const [selectedImg, setSelectedImg] = useState(product.image);
  const [qty, setQty] = useState(1);
  const [isAdded, setIsAdded] = useState(false);

  const wished = wishlist.includes(product.id);
  const off =
    product.mrp > product.price
      ? Math.round(((product.mrp - product.price) / product.mrp) * 100)
      : 0;
  const outOfStock = product.stock === 0;
  const productSlug = product.slug ?? slugify(product.name);
  const hasRating = product.rating > 0 && product.reviews > 0;
  const allImages = Array.from(new Set([product.image, ...(product.images || [])])).filter(Boolean);

  const handleAddToCart = (e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    if (outOfStock || isAdded) return;
    setIsAdded(true);
    for (let i = 0; i < qty; i++) {
      addToCart(product.id);
    }
    setTimeout(() => {
      setIsAdded(false);
    }, 1300);
  };

  const handleBuyNow = (e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    if (outOfStock) return;
    for (let i = 0; i < qty; i++) {
      addToCart(product.id);
    }
    setQuickViewOpen(false);
    nav({ to: "/checkout" });
  };

  return (
    <>
      <div className="group relative flex flex-col h-full overflow-hidden rounded-lg border border-[#eadfce] bg-[#fffaf2] transition duration-200 hover:border-[#e4c895] hover:shadow-[0_4px_16px_rgba(43,33,28,0.06)]">
        <div className="relative aspect-square w-full overflow-hidden bg-[#fff7ec]">
          <Link to="/product/$id" params={{ id: productSlug }} className="block h-full w-full">
            <img
              src={product.image}
              alt={product.name}
              loading="lazy"
              className="h-full w-full object-contain p-2 sm:p-3.5 transition-transform duration-300 group-hover:scale-[1.03]"
            />
            {product.featuredDeal && (
              <span className="absolute left-1.5 top-1.5 rounded bg-[#5a1f2a] px-1.5 py-0.5 text-[9px] sm:text-[10px] font-bold leading-none text-white shadow-sm">
                Best Seller
              </span>
            )}
            {off > 0 && (
              <span className="absolute bottom-1.5 right-1.5 rounded bg-[#c62828] px-1.5 py-0.5 text-[9px] sm:text-[10px] font-bold leading-none text-white shadow-sm">
                -{off}%
              </span>
            )}
            {hasRating && (
              <span className="absolute bottom-1.5 left-1.5 rounded bg-[#2f8d3c] px-1.5 py-0.5 text-[9px] sm:text-[10px] font-bold leading-none text-white shadow-sm">
                {product.rating.toFixed(1)} ★
              </span>
            )}
            {outOfStock && (
              <span className="absolute inset-0 grid place-items-center bg-background/80 text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-foreground backdrop-blur-[1px]">
                Sold out
              </span>
            )}
          </Link>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              toggleWishlist(product.id);
            }}
            className="absolute right-1.5 top-1.5 grid h-6 w-6 sm:h-7 sm:w-7 place-items-center rounded-full border border-border bg-white/95 shadow-sm transition hover:border-[#e4c895] active:scale-95 z-10"
            aria-label={
              wished ? `Remove ${product.name} from wishlist` : `Add ${product.name} to wishlist`
            }
          >
            <Heart
              className={`h-3 w-3 sm:h-3.5 sm:w-3.5 ${wished ? "fill-destructive text-destructive" : "text-foreground/70"}`}
            />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setSelectedImg(product.image);
              setQty(1);
              setQuickViewOpen(true);
            }}
            className="absolute right-1.5 top-8 sm:top-9 grid h-6 w-6 sm:h-7 sm:w-7 place-items-center rounded-full border border-border bg-white/95 text-foreground/80 shadow-sm transition hover:border-[#166F77] hover:text-[#166F77] active:scale-95 cursor-pointer z-10"
            aria-label={`Quick view ${product.name}`}
            title="Quick view"
          >
            <Eye className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
          </button>
        </div>

        <div className="flex flex-1 flex-col justify-between bg-[#fff8ed] p-2 sm:p-2.5">
          <div>
            <Link
              to="/product/$id"
              params={{ id: productSlug }}
              className="line-clamp-2 text-[11px] sm:text-[13px] font-medium leading-tight text-[#202124] hover:text-[#6b2730] transition min-h-[2.2em]"
              title={product.name}
            >
              {product.name}
            </Link>

            <div className="flex flex-wrap items-baseline gap-1 mt-1">
              <span className="text-xs sm:text-sm font-bold leading-none text-[#222]">
                {formatINR(product.price)}
              </span>
              {off > 0 && (
                <>
                  <span className="text-[10px] sm:text-xs text-muted-foreground line-through">
                    {formatINR(product.mrp)}
                  </span>
                  <span className="text-[9px] sm:text-[10px] font-semibold text-[#2f8d3c]">{off}% off</span>
                </>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-1 mt-1.5 pt-1 border-t border-[#eadfce]/60">
            <button
              type="button"
              disabled={outOfStock || isAdded}
              onClick={handleAddToCart}
              className={`inline-flex h-7 sm:h-8 items-center justify-center gap-0.5 sm:gap-1 rounded-md border px-0.5 sm:px-1.5 text-[9.5px] min-[360px]:text-[10px] sm:text-[11px] font-semibold whitespace-nowrap overflow-hidden transition-all duration-200 active:scale-95 ${
                isAdded
                  ? "border-[#2f8d3c] bg-[#eaf7ed] text-[#2f8d3c]"
                  : "border-[#ddd4c8] bg-white text-[#333] hover:border-[#c99a3a]"
              } disabled:cursor-not-allowed disabled:opacity-40`}
            >
              {isAdded ? (
                <>
                  <Check className="h-2.5 w-2.5 sm:h-3 sm:w-3 shrink-0 text-[#2f8d3c]" />
                  <span>Added</span>
                </>
              ) : (
                <>
                  <ShoppingCart className="h-2.5 w-2.5 sm:h-3 sm:w-3 shrink-0" />
                  <span>Add to Cart</span>
                </>
              )}
            </button>
            <button
              type="button"
              disabled={outOfStock}
              onClick={handleBuyNow}
              className="inline-flex h-7 sm:h-8 items-center justify-center rounded-md bg-[#f59611] px-0.5 sm:px-1.5 text-[9.5px] min-[360px]:text-[10px] sm:text-[11px] font-semibold text-[#211000] whitespace-nowrap overflow-hidden transition hover:bg-[#ec8b00] disabled:cursor-not-allowed disabled:opacity-40 active:scale-[0.98]"
            >
              <span>Buy Now</span>
            </button>
          </div>
        </div>
      </div>

      {/* Quick View Modal */}
      <Dialog open={quickViewOpen} onOpenChange={setQuickViewOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-[#fffaf2] border-[#eadfce] p-4 sm:p-6 text-[#202124]">
          <DialogHeader className="sr-only">
            <DialogTitle>{product.name} - Quick View</DialogTitle>
            <DialogDescription>Quick view product details for {product.name}</DialogDescription>
          </DialogHeader>

          <div className="grid gap-6 md:grid-cols-2 items-start">
            {/* Left: Gallery */}
            <div className="flex flex-col gap-3">
              <div className="relative aspect-square w-full overflow-hidden rounded-xl border border-[#eadfce] bg-[#fff7ec] p-4 flex items-center justify-center">
                <img
                  src={selectedImg || product.image}
                  alt={product.name}
                  className="max-h-full max-w-full object-contain"
                />
                {off > 0 && (
                  <span className="absolute left-3 top-3 rounded bg-[#c62828] px-2 py-1 text-xs font-bold text-white shadow-sm">
                    -{off}% OFF
                  </span>
                )}
              </div>
              {allImages.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
                  {allImages.map((img, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setSelectedImg(img)}
                      className={`h-14 w-14 shrink-0 overflow-hidden rounded-lg border p-1 transition ${
                        selectedImg === img ? "border-[#166F77] ring-2 ring-[#166F77]/20" : "border-[#eadfce] hover:border-[#e4c895]"
                      }`}
                    >
                      <img src={img} alt="" className="h-full w-full object-contain" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Right: Info & Actions */}
            <div className="flex flex-col">
              {product.category && (
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#166F77]">
                  {product.category}
                </span>
              )}
              <h2 className="mt-1 font-serif text-xl sm:text-2xl font-semibold leading-snug text-[#202124]">
                {product.name}
              </h2>

              {hasRating && (
                <div className="mt-2 flex items-center gap-2">
                  <div className="flex items-center gap-1 rounded bg-[#2f8d3c] px-2 py-0.5 text-xs font-bold text-white">
                    <span>{product.rating.toFixed(1)}</span>
                    <Star className="h-3 w-3 fill-white" />
                  </div>
                  <span className="text-xs text-[#6A605A]">
                    ({product.reviews} {product.reviews === 1 ? "review" : "reviews"})
                  </span>
                </div>
              )}

              <div className="mt-3 flex items-baseline gap-2.5">
                <span className="text-2xl font-bold text-[#222]">
                  {formatINR(product.price)}
                </span>
                {off > 0 && (
                  <>
                    <span className="text-sm text-muted-foreground line-through">
                      {formatINR(product.mrp)}
                    </span>
                    <span className="text-xs font-semibold text-[#2f8d3c]">Save {off}%</span>
                  </>
                )}
              </div>

              {product.description && (
                <p className="mt-3 text-xs sm:text-sm leading-relaxed text-[#6A605A] line-clamp-3">
                  {product.description}
                </p>
              )}

              {product.details && product.details.length > 0 && (
                <div className="mt-3 space-y-1">
                  {product.details.slice(0, 3).map((detail, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-xs text-[#6A605A]">
                      <Check className="h-3.5 w-3.5 text-[#166F77] shrink-0" />
                      <span>{detail}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-4 flex items-center gap-3">
                <span className="text-xs font-medium text-[#6A605A]">Quantity:</span>
                <div className="inline-flex items-center rounded-lg border border-[#eadfce] bg-white">
                  <button
                    type="button"
                    onClick={() => setQty((q) => Math.max(1, q - 1))}
                    disabled={qty <= 1 || outOfStock}
                    className="grid h-8 w-8 place-items-center hover:bg-[#FAF4EE] disabled:opacity-40"
                    aria-label="Decrease quantity"
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <span className="w-8 text-center text-xs font-semibold">{qty}</span>
                  <button
                    type="button"
                    onClick={() => setQty((q) => q + 1)}
                    disabled={outOfStock}
                    className="grid h-8 w-8 place-items-center hover:bg-[#FAF4EE] disabled:opacity-40"
                    aria-label="Increase quantity"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
                <span className={`text-xs font-semibold ${outOfStock ? "text-destructive" : "text-[#2f8d3c]"}`}>
                  {outOfStock ? "Out of Stock" : "In Stock"}
                </span>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  disabled={outOfStock || isAdded}
                  onClick={handleAddToCart}
                  className={`inline-flex h-10 items-center justify-center gap-2 rounded-lg border px-3 text-xs font-semibold transition active:scale-95 disabled:opacity-40 ${
                    isAdded
                      ? "border-[#2f8d3c] bg-[#eaf7ed] text-[#2f8d3c]"
                      : "border-[#166F77] bg-[#166F77]/10 text-[#166F77] hover:bg-[#166F77]/15"
                  }`}
                >
                  {isAdded ? (
                    <>
                      <Check className="h-4 w-4 text-[#2f8d3c]" /> Added
                    </>
                  ) : (
                    <>
                      <ShoppingCart className="h-4 w-4" /> Add to Cart
                    </>
                  )}
                </button>
                <button
                  type="button"
                  disabled={outOfStock}
                  onClick={handleBuyNow}
                  className="inline-flex h-10 items-center justify-center rounded-lg bg-[#f59611] hover:bg-[#ec8b00] px-3 text-xs font-semibold text-[#211000] shadow-sm transition disabled:opacity-40"
                >
                  Buy Now
                </button>
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-[#eadfce] pt-3">
                <button
                  type="button"
                  onClick={() => toggleWishlist(product.id)}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-[#6A605A] hover:text-[#166F77] transition"
                >
                  <Heart className={`h-4 w-4 ${wished ? "fill-destructive text-destructive" : ""}`} />
                  <span>{wished ? "In Wishlist" : "Add to Wishlist"}</span>
                </button>
                <Link
                  to="/product/$id"
                  params={{ id: productSlug }}
                  onClick={() => setQuickViewOpen(false)}
                  className="text-xs font-semibold text-[#166F77] hover:underline"
                >
                  View Full Details →
                </Link>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
