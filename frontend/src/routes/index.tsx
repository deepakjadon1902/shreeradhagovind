import { createFileRoute, Link } from "@tanstack/react-router";
import { Layout } from "@/components/Layout";
import { ProductCard } from "@/components/ProductCard";
import { useStore } from "@/lib/store";
import {
  ArrowRight,
  BadgePercent,
  Flame,
  Flower2,
  ShieldCheck,
  Sparkles,
  Truck,
} from "lucide-react";
import heroKrishna from "@/assets/hero-krishna.jpg";
import { DEFAULT_DESCRIPTION, DEFAULT_TITLE, pageSeo, slugify } from "@/lib/seo";

export const Route = createFileRoute("/")({
  component: Home,
  head: () => ({
    ...pageSeo({
      title: DEFAULT_TITLE,
      description: DEFAULT_DESCRIPTION,
      path: "/",
    }),
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "Shri Radha Govind Store",
          url: "https://www.shriradhagovindstore.com/",
          description:
            "Sacred essentials from Vrindavan — poshak, chandan, itra, mala, puja items.",
        }),
      },
    ],
  }),
});

function Home() {
  const { adminProducts, categoryTree } = useStore();
  const featured = adminProducts.slice(0, 8);
  const deals = adminProducts.filter((p) => p.featuredDeal).slice(0, 12);
  const categoryTiles = categoryTree.slice(0, 8).map((category) => {
    const product =
      adminProducts.find((item) => item.category === category.name) ??
      adminProducts.find((item) =>
        category.children.some((child) => child.name === item.category),
      ) ??
      adminProducts[0];
    return { category, image: category.image || product?.image || heroKrishna };
  });

  return (
    <Layout>
      {/* Hero */}
      <section className="relative overflow-hidden bg-[#212020] text-white">
        <div className="container-app grid gap-8 py-8 md:grid-cols-[1fr_420px] md:py-12 lg:grid-cols-[1fr_500px]">
          <div className="reveal-up flex flex-col justify-center">
            <p className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.25em] text-[#ffd814] mb-5">
              <Sparkles className="h-3.5 w-3.5" /> Blessed in Vrindavan
            </p>
            <h1 className="font-display text-5xl md:text-6xl leading-[1.05]">
              Shri Radha Govind Store
            </h1>
            <p className="mt-5 max-w-xl text-white/78">
              Authentic Krishna & Radha Rani poshak, gopi chandan, itra and puja items — sourced
              directly from Vrindavan artisans.
            </p>
            <div className="mt-7 flex gap-3">
              <Link
                to="/shop"
                className="fx-button icon-bounce inline-flex items-center gap-2 h-12 px-6 rounded-md bg-[#ffd814] text-black font-semibold"
              >
                Explore Collection <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/shop"
                className="fx-button inline-flex items-center h-12 px-6 rounded-md border border-white/25 bg-white/10 text-white hover:bg-white/15"
              >
                New Arrivals
              </Link>
            </div>
            <div className="mt-10 grid grid-cols-3 gap-4 max-w-md">
              {[
                ["50K+", "Devotees"],
                ["4.9★", "Rating"],
                ["100%", "Authentic"],
              ].map(([n, l]) => (
                <div key={l}>
                  <div className="font-display text-2xl text-white">{n}</div>
                  <div className="text-xs text-white/60 uppercase tracking-wider">{l}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="relative reveal-up reveal-delay-1">
            <div className="card-3d aspect-[4/3] overflow-hidden rounded-lg border border-white/10 premium-shadow md:aspect-[4/5]">
              <img src={heroKrishna} alt="Krishna" className="h-full w-full object-cover" />
            </div>
            <div className="glass-panel float-soft absolute -bottom-6 -left-6 rounded-lg p-5 hidden text-black md:block">
              <div className="flex items-center gap-3">
                <Flower2 className="h-8 w-8 text-primary" />
                <div>
                  <p className="font-display text-lg leading-none">Hare Krishna</p>
                  <p className="text-xs text-muted-foreground mt-1">Made with devotion</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-border bg-white">
        <div className="container-app py-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-muted-foreground">
                Shop by category
              </p>
              <h2 className="font-display text-2xl text-black">Explore devotional collections</h2>
            </div>
            <Link
              to="/shop"
              className="hidden h-9 items-center gap-1 rounded-md border border-border px-3 text-sm font-semibold hover:border-primary sm:inline-flex"
            >
              All categories <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="mt-4 grid grid-cols-4 gap-3 sm:grid-cols-4 lg:grid-cols-8">
            {categoryTiles.map(({ category, image }) => (
              <Link
                key={category.id}
                to="/shop"
                search={{ cat: category.name } as never}
                className="group rounded-lg border border-border bg-white p-2 text-center transition hover:border-primary hover:shadow-md"
              >
                <span className="mx-auto grid aspect-square w-full max-w-24 place-items-center overflow-hidden rounded-md bg-muted">
                  <img
                    src={image}
                    alt=""
                    className="h-full w-full object-cover transition group-hover:scale-105"
                  />
                </span>
                <span className="mt-2 line-clamp-2 block min-h-9 text-xs font-semibold leading-tight text-black">
                  {category.name}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Trust */}
      <section className="container-app reveal-up reveal-delay-2 grid grid-cols-2 md:grid-cols-4 gap-4 py-6">
        {[
          { Icon: Truck, t: "Free shipping", d: "On orders above ₹999" },
          { Icon: ShieldCheck, t: "100% Authentic", d: "Sourced from Vrindavan" },
          { Icon: Sparkles, t: "Temple blessed", d: "Energised at ISKCON" },
          { Icon: Flower2, t: "Easy returns", d: "7-day return policy" },
        ].map(({ Icon, t, d }) => (
          <div key={t} className="premium-card p-5 flex items-center gap-3">
            <Icon className="h-6 w-6 text-primary shrink-0" />
            <div>
              <p className="font-medium text-sm">{t}</p>
              <p className="text-xs text-muted-foreground">{d}</p>
            </div>
          </div>
        ))}
      </section>

      {deals.length > 0 && (
        <section className="container-app py-8">
          <div className="rounded-lg border border-border bg-white p-4 premium-shadow">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-[0.22em] text-[#90878e]">
                  <Flame className="h-3.5 w-3.5" /> Limited offers
                </p>
                <h2 className="font-display text-3xl text-black">Today&apos;s Sacred Deals</h2>
              </div>
              <Link to="/shop" className="text-sm font-semibold hover:text-primary">
                See all
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
              {deals.map((product) => {
                const off =
                  product.mrp > product.price
                    ? Math.round(((product.mrp - product.price) / product.mrp) * 100)
                    : 0;
                return (
                  <Link
                    key={product.id}
                    to="/product/$id"
                    params={{ id: product.slug ?? slugify(product.name) }}
                    className="group rounded-lg border border-border bg-white p-3 transition hover:border-primary hover:shadow-md"
                  >
                    <div className="relative aspect-square overflow-hidden rounded-md bg-muted">
                      <img
                        src={product.image}
                        alt={product.name}
                        className="h-full w-full object-contain p-2 transition group-hover:scale-105"
                      />
                      {off > 0 && (
                        <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded bg-[#ffd814] px-2 py-1 text-[10px] font-bold text-black">
                          <BadgePercent className="h-3 w-3" /> {off}% off
                        </span>
                      )}
                    </div>
                    <p className="mt-3 line-clamp-2 min-h-10 text-sm font-semibold text-black">
                      {product.name}
                    </p>
                    <p className="mt-1 text-base font-bold text-black">₹{product.price}</p>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* Featured */}
      <section className="container-app py-12">
        <div className="flex items-end justify-between mb-8">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground mb-2">
              Curated for you
            </p>
            <h2 className="font-display text-4xl md:text-5xl">Featured Deals</h2>
          </div>
          <Link to="/shop" className="text-sm hover:text-primary inline-flex items-center gap-1">
            View all <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {featured.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </section>

      {/* Banner */}
      <section className="container-app py-14">
        <div className="gold-accent relative overflow-hidden rounded-lg p-10 text-center text-white md:p-16">
          <p className="text-xs uppercase tracking-[0.3em] opacity-80 mb-3">Janmashtami Special</p>
          <h2 className="font-display text-4xl md:text-6xl">Adorn your Laddu Gopal</h2>
          <p className="mt-3 max-w-xl mx-auto opacity-90">
            Exclusive poshak, jewellery & shringar sets — handcrafted by master artisans of
            Vrindavan.
          </p>
          <Link
            to="/shop"
            className="fx-button mt-6 inline-flex h-12 px-7 rounded-md bg-white text-black font-semibold items-center"
          >
            Shop the collection
          </Link>
        </div>
      </section>
    </Layout>
  );
}
