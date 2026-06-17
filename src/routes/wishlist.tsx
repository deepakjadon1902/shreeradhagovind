import { createFileRoute, Link } from "@tanstack/react-router";
import { Layout } from "@/components/Layout";
import { ProductCard } from "@/components/ProductCard";
import { useStore } from "@/lib/store";
import { Heart } from "lucide-react";

export const Route = createFileRoute("/wishlist")({
  component: WishlistPage,
  head: () => ({ meta: [{ title: "My Wishlist — Shri Radha Govind Store" }, { name: "description", content: "Your saved sacred essentials from Vrindavan." }, { name: "robots", content: "noindex" }] }),
});

function WishlistPage() {
  const { wishlist, adminProducts } = useStore();
  const items = adminProducts.filter((p) => wishlist.includes(p.id));
  return (
    <Layout>
      <div className="container-app py-10">
        <h1 className="font-display text-4xl">My Wishlist</h1>
        <p className="text-muted-foreground mt-2 text-sm">{items.length} saved items</p>
        {items.length === 0 ? (
          <div className="text-center py-20">
            <Heart className="h-16 w-16 mx-auto text-muted-foreground" />
            <p className="mt-4 text-muted-foreground">Your wishlist is empty.</p>
            <Link to="/shop" className="mt-4 inline-flex h-11 px-6 rounded-full bg-primary text-primary-foreground items-center">Browse Shop</Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5 mt-8">
            {items.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        )}
      </div>
    </Layout>
  );
}
