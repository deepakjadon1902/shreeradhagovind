import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Layout } from "@/components/Layout";
import { useStore, formatINR } from "@/lib/store";
import { Heart, ShoppingBag, X, Zap } from "lucide-react";

export const Route = createFileRoute("/wishlist")({
  component: WishlistPage,
  head: () => ({
    meta: [
      { title: "My Wishlist — Shri Radha Govind Store" },
      { name: "description", content: "Sacred essentials you've saved for later. Move items to cart or buy now in one tap." },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function WishlistPage() {
  const { wishlist, adminProducts, toggleWishlist, addToCart, buyNow } = useStore();
  const nav = useNavigate();
  const items = adminProducts.filter((p) => wishlist.includes(p.id));

  return (
    <Layout>
      <div className="container-app py-6 md:py-10">
        <div className="flex items-baseline gap-3 mb-6">
          <h1 className="font-display text-3xl md:text-4xl">My Wishlist</h1>
          <span className="text-sm text-muted-foreground">
            ({items.length} {items.length === 1 ? "item" : "items"})
          </span>
        </div>

        {items.length === 0 ? (
          <div className="text-center py-20 bg-card border border-border/60 rounded-xl">
            <div className="inline-grid place-items-center h-24 w-24 rounded-full bg-muted">
              <Heart className="h-10 w-10 text-muted-foreground" />
            </div>
            <p className="mt-6 font-display text-2xl">Your wishlist is empty</p>
            <p className="text-sm text-muted-foreground mt-1">
              Tap the heart icon on any product to save it for later.
            </p>
            <Link
              to="/shop"
              className="mt-6 inline-flex h-11 px-6 rounded-full bg-primary text-primary-foreground items-center font-medium"
            >
              Browse Shop
            </Link>
          </div>
        ) : (
          <div className="bg-card border border-border/60 rounded-xl divide-y">
            {items.map((p) => {
              const off = p.mrp > p.price ? Math.round(((p.mrp - p.price) / p.mrp) * 100) : 0;
              return (
                <div key={p.id} className="p-4 flex gap-4 hover:bg-muted/30 transition relative">
                  <Link
                    to="/product/$id"
                    params={{ id: p.id }}
                    className="h-28 w-28 sm:h-32 sm:w-32 rounded-lg overflow-hidden bg-muted shrink-0"
                  >
                    <img src={p.image} alt={p.name} className="h-full w-full object-cover" />
                  </Link>

                  <div className="flex-1 min-w-0 flex flex-col">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{p.category}</p>
                    <Link
                      to="/product/$id"
                      params={{ id: p.id }}
                      className="font-medium text-sm sm:text-base hover:text-primary line-clamp-2"
                    >
                      {p.name}
                    </Link>
                    <div className="flex items-baseline gap-2 flex-wrap mt-1">
                      <span className="font-bold text-base">{formatINR(p.price)}</span>
                      {off > 0 && (
                        <>
                          <span className="text-xs text-muted-foreground line-through">{formatINR(p.mrp)}</span>
                          <span className="text-xs font-semibold text-green-700">{off}% off</span>
                        </>
                      )}
                    </div>
                    <p className="text-xs text-green-700 mt-0.5">In stock · Free delivery</p>

                    <div className="mt-auto pt-3 flex items-center gap-2 flex-wrap">
                      <button
                        onClick={() => addToCart(p.id)}
                        className="inline-flex items-center gap-1.5 h-9 px-4 rounded-full border border-foreground/15 bg-secondary/60 text-xs font-semibold hover:bg-secondary"
                      >
                        <ShoppingBag className="h-3.5 w-3.5" /> Move to cart
                      </button>
                      <button
                        onClick={() => { buyNow(p.id); nav({ to: "/checkout" }); }}
                        className="inline-flex items-center gap-1.5 h-9 px-4 rounded-full bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90"
                      >
                        <Zap className="h-3.5 w-3.5" /> Buy now
                      </button>
                    </div>
                  </div>

                  <button
                    onClick={() => toggleWishlist(p.id)}
                    className="absolute top-3 right-3 h-8 w-8 grid place-items-center rounded-full hover:bg-muted text-muted-foreground hover:text-destructive"
                    aria-label="Remove from wishlist"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}
