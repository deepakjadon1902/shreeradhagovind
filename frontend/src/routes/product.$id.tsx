import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Layout } from "@/components/Layout";
import { useStore, formatINR } from "@/lib/store";
import { API_URL } from "@/lib/api";
import { type Product } from "@/lib/products";
import { Heart, ShoppingBag, Star, Check } from "lucide-react";
import { useEffect, useState } from "react";
import { ProductCard } from "@/components/ProductCard";
import { cleanMetaText, pageSeo, slugify } from "@/lib/seo";
import { FormattedText } from "@/components/SimpleRichEditor";

function normalizeProduct(value: Record<string, unknown>): Product {
  return {
    id: String(value.id ?? value._id ?? ""),
    slug: String(value.slug ?? slugify(String(value.name ?? value._id ?? ""))),
    name: String(value.name ?? ""),
    category: String(value.category ?? ""),
    price: Number(value.price ?? 0),
    mrp: Number(value.mrp ?? 0),
    rating: Number(value.rating ?? 0),
    reviews: Number(value.reviews ?? 0),
    image: String(value.image ?? ""),
    images: Array.isArray(value.images) ? value.images.map(String) : [],
    featuredDeal: Boolean(value.featuredDeal),
    description: String(value.description ?? ""),
    details: Array.isArray(value.details) ? value.details.map(String) : [],
    stock: Number(value.stock ?? 0),
  };
}

function matchesProduct(product: Product, idOrSlug: string) {
  return product.id === idOrSlug || (product.slug ?? slugify(product.name)) === idOrSlug;
}

async function loadProductForMeta(idOrSlug: string) {
  if (!API_URL) return null;

  try {
    const response = await fetch(`${API_URL}/products/${encodeURIComponent(idOrSlug)}`);
    if (!response.ok) return null;
    const data = (await response.json()) as { product?: Record<string, unknown> };
    return data.product ? normalizeProduct(data.product) : null;
  } catch {
    return null;
  }
}

export const Route = createFileRoute("/product/$id")({
  component: ProductDetail,
  loader: ({ params }) => loadProductForMeta(params.id),
  head: ({ params, loaderData: product }) => {
    const productName = product?.name || "Sacred Product";
    const title = cleanMetaText(productName, 300);
    const description = cleanMetaText(
      product?.description || `Shop ${productName}, an authentic sacred essential from Vrindavan.`,
      1000,
    );
    const slug = product?.slug ?? params.id;

    return pageSeo({
      title,
      description,
      path: `/product/${slug}`,
      image: product?.image,
      type: "product",
    });
  },
});

function ProductDetail() {
  const { id } = Route.useParams();
  const loadedProduct = Route.useLoaderData();
  const { adminProducts, addToCart, buyNow, wishlist, toggleWishlist } = useStore();
  const nav = useNavigate();
  const product = adminProducts.find((p) => matchesProduct(p, id)) ?? loadedProduct;
  const [qty, setQty] = useState(1);
  const [recentIds, setRecentIds] = useState<string[]>([]);
  const [selectedImage, setSelectedImage] = useState("");

  useEffect(() => {
    if (!product || typeof window === "undefined") return;
    const key = "srg_recent_products";
    let previous: string[] = [];
    try {
      previous = JSON.parse(localStorage.getItem(key) ?? "[]");
    } catch {
      previous = [];
    }
    const next = [product.id, ...previous.filter((item) => item !== product.id)].slice(0, 8);
    localStorage.setItem(key, JSON.stringify(next));
    setRecentIds(next);
  }, [product]);

  useEffect(() => {
    if (product) setSelectedImage(product.image);
  }, [product]);

  if (!product) {
    return (
      <Layout>
        <div className="container-app py-20 text-center">
          <h1 className="font-display text-3xl">Product not found</h1>
          <Link to="/shop" className="text-primary mt-4 inline-block">
            Back to shop
          </Link>
        </div>
      </Layout>
    );
  }

  const wished = wishlist.includes(product.id);
  const off =
    product.mrp > product.price
      ? Math.round(((product.mrp - product.price) / product.mrp) * 100)
      : 0;
  const gallery = Array.from(new Set([product.image, ...(product.images ?? [])].filter(Boolean)));
  const related = adminProducts
    .filter((p) => p.category === product.category && p.id !== product.id)
    .slice(0, 4);
  const recentlyViewed = recentIds
    .filter((recentId) => recentId !== product.id)
    .map((recentId) => adminProducts.find((item) => item.id === recentId))
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .slice(0, 4);

  return (
    <Layout>
      <div className="container-app py-8">
        <nav className="text-xs text-muted-foreground mb-6">
          <Link to="/" className="hover:text-primary">
            Home
          </Link>{" "}
          /{" "}
          <Link to="/shop" className="hover:text-primary">
            Shop
          </Link>{" "}
          / <span>{product.category}</span>
        </nav>
        <div className="grid gap-8 md:grid-cols-[minmax(0,1fr)_minmax(320px,480px)] lg:gap-12">
          <div>
            <div className="aspect-square overflow-hidden rounded-lg border border-border bg-white premium-shadow">
              <img
                src={selectedImage || product.image}
                alt={product.name}
                className="h-full w-full object-contain p-5"
              />
            </div>
            {gallery.length > 1 && (
              <div className="mt-3 grid grid-cols-5 gap-2">
                {gallery.map((image) => (
                  <button
                    key={image}
                    onClick={() => setSelectedImage(image)}
                    className={`aspect-square overflow-hidden rounded-md border bg-white p-1 ${selectedImage === image ? "border-primary ring-2 ring-primary/20" : "border-border"}`}
                    aria-label="View product photo"
                  >
                    <img src={image} alt="" className="h-full w-full object-contain" />
                  </button>
                ))}
              </div>
            )}
          </div>
          <div>
            <p className="eyebrow text-primary">{product.category}</p>
            <h1 className="mt-2 text-3xl font-semibold leading-tight md:text-4xl">
              {product.name}
            </h1>
            {product.rating > 0 && product.reviews > 0 && (
              <div className="flex items-center gap-3 mt-3">
                <span className="inline-flex items-center gap-1 rounded bg-emerald-600/10 px-2 py-1 text-xs text-emerald-700">
                  <Star className="h-3 w-3 fill-current" />
                  {product.rating}
                </span>
                <span className="text-sm text-muted-foreground">
                  {product.reviews.toLocaleString()} reviews
                </span>
              </div>
            )}
            <div className="flex items-baseline gap-3 mt-5">
              <span className="text-3xl font-semibold">{formatINR(product.price)}</span>
              <span className="text-base text-muted-foreground line-through">
                {formatINR(product.mrp)}
              </span>
              {off > 0 && <span className="text-sm font-medium text-emerald-700">{off}% off</span>}
            </div>
            <FormattedText content={product.description} className="mt-4 text-muted-foreground" />

            <ul className="mt-5 space-y-2">
              {product.details.map((d) => (
                <li key={d} className="flex items-center gap-2 text-sm">
                  <Check className="h-4 w-4 text-primary" /> {d}
                </li>
              ))}
            </ul>

            <div className="flex items-center gap-3 mt-6">
              <div className="inline-flex items-center overflow-hidden rounded-md border bg-white">
                <button
                  onClick={() => setQty(Math.max(1, qty - 1))}
                  className="h-11 w-11 hover:bg-muted"
                >
                  -
                </button>
                <span className="w-10 text-center text-sm font-semibold">{qty}</span>
                <button
                  onClick={() => setQty(Math.min(product.stock, qty + 1))}
                  disabled={qty >= product.stock}
                  className="h-11 w-11 hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
                >
                  +
                </button>
              </div>
              <span className="text-sm text-muted-foreground">{product.stock} in stock</span>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-6">
              <button
                onClick={() => addToCart(product.id, qty)}
                disabled={product.stock === 0}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-md border border-primary/20 bg-white font-semibold transition hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ShoppingBag className="h-4 w-4" /> Add to cart
              </button>
              <button
                onClick={() => {
                  buyNow(product.id, qty);
                  nav({ to: "/checkout" });
                }}
                disabled={product.stock === 0}
                className="h-12 rounded-md bg-primary font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Buy Now
              </button>
            </div>
            <button
              onClick={() => toggleWishlist(product.id)}
              className="mt-3 inline-flex items-center gap-2 text-sm hover:text-primary"
            >
              <Heart className={`h-4 w-4 ${wished ? "fill-primary text-primary" : ""}`} />{" "}
              {wished ? "In wishlist" : "Add to wishlist"}
            </button>

            <div className="mt-8 grid grid-cols-3 gap-3 border-t pt-6">
              {["Free shipping", "100% Authentic", "7-day returns"].map((t) => (
                <div key={t} className="rounded-lg border border-border bg-white p-3 text-center">
                  <p className="text-xs font-medium">{t}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {related.length > 0 && (
          <section className="mt-20">
            <h2 className="font-display text-3xl mb-6">You may also like</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
              {related.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </section>
        )}
        {recentlyViewed.length > 0 && (
          <section className="mt-16 border-t border-border/70 pt-12">
            <p className="mb-2 text-xs uppercase tracking-[.22em] text-primary">
              Continue exploring
            </p>
            <h2 className="font-display text-3xl mb-6">Recently viewed</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
              {recentlyViewed.map((item) => (
                <ProductCard key={item.id} product={item} />
              ))}
            </div>
          </section>
        )}
      </div>
    </Layout>
  );
}
