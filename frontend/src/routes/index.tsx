import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { Layout } from "@/components/Layout";
import { ProductCard } from "@/components/ProductCard";
import { useStore } from "@/lib/store";
import heroKrishna from "@/assets/hero-krishna.jpg";
import { DEFAULT_DESCRIPTION, DEFAULT_TITLE, pageSeo } from "@/lib/seo";

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
            "Sacred essentials from Vrindavan: poshak, chandan, itra, mala, and puja items.",
        }),
      },
    ],
  }),
});

function Home() {
  const { adminProducts, categoryTree } = useStore();
  const categoryTiles = useMemo(
    () =>
      categoryTree.slice(0, 8).map((category) => {
        const product =
          adminProducts.find((item) => item.category === category.name) ??
          adminProducts.find((item) =>
            category.children.some((child) => child.name === item.category),
          ) ??
          adminProducts[0];
        return { category, image: category.image || product?.image || heroKrishna };
      }),
    [adminProducts, categoryTree],
  );
  const categoryShelves = useMemo(
    () =>
      categoryTree
        .slice(0, 6)
        .map((category) => {
          const names = [category.name, ...category.children.map((child) => child.name)];
          const products = adminProducts
            .filter((product) => names.includes(product.category))
            .sort(
              (a, b) => Number(!!b.featuredDeal) - Number(!!a.featuredDeal) || b.rating - a.rating,
            )
            .slice(0, 5);
          return { category, products };
        })
        .filter((shelf) => shelf.products.length > 0),
    [adminProducts, categoryTree],
  );

  return (
    <Layout>
      <section className="relative overflow-hidden bg-[var(--primary)] text-white">
        <div className="container-app grid items-center gap-8 py-9 md:grid-cols-[minmax(0,1fr)_minmax(300px,410px)] md:py-11 lg:grid-cols-[minmax(0,1fr)_420px]">
          <div className="reveal-up flex flex-col justify-center">
            <p className="mb-5 text-xs font-semibold uppercase tracking-[0.18em] text-[#f1eadf]">
              Blessed in Vrindavan
            </p>
            <h1 className="max-w-3xl text-4xl font-semibold leading-tight md:text-5xl lg:text-[3.4rem]">
              Shri Radha Govind Store
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-white/82">
              Authentic Krishna and Radha Rani poshak, gopi chandan, itra and puja items sourced
              directly from Vrindavan artisans.
            </p>
            <div className="mt-7 flex gap-3">
              <Link
                to="/shop"
                className="fx-button inline-flex h-12 items-center rounded-md bg-secondary px-6 font-semibold text-secondary-foreground"
              >
                Explore Collection
              </Link>
              <Link
                to="/about"
                className="fx-button inline-flex h-12 items-center rounded-md border border-white/25 bg-white/10 px-6 text-white hover:bg-white/15"
              >
                About Us
              </Link>
            </div>
            <div className="mt-10 grid max-w-md grid-cols-3 gap-4">
              {[
                ["50K+", "Devotees"],
                ["4.9", "Rating"],
                ["100%", "Authentic"],
              ].map(([n, l]) => (
                <div key={l}>
                  <div className="text-2xl font-semibold text-white">{n}</div>
                  <div className="text-xs uppercase tracking-wider text-white/60">{l}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="relative reveal-up reveal-delay-1">
            <div className="card-3d mx-auto aspect-[4/3] w-full max-w-[420px] overflow-hidden rounded-lg border border-white/10 premium-shadow md:aspect-[4/4.2] md:max-h-[480px]">
              <img
                src={heroKrishna}
                alt="Krishna"
                className="h-full w-full object-cover object-center"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-border bg-white">
        <div className="container-app py-7">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="eyebrow">Shop by category</p>
              <h2 className="section-title mt-1">Explore devotional collections</h2>
            </div>
            <Link
              to="/shop"
              className="hidden h-9 items-center gap-1 rounded-md border border-border px-3 text-sm font-semibold hover:border-primary sm:inline-flex"
            >
              All categories
            </Link>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
            {categoryTiles.map(({ category, image }) => (
              <Link
                key={category.id}
                to="/shop"
                search={{ cat: category.name } as never}
                className="group rounded-lg border border-border bg-white p-2.5 text-center transition hover:border-primary/40 hover:shadow-md"
              >
                <span className="mx-auto grid aspect-square w-full max-w-24 place-items-center overflow-hidden rounded-md bg-muted">
                  <img
                    src={image}
                    alt=""
                    className="h-full w-full object-cover transition group-hover:scale-105"
                  />
                </span>
                <span className="mt-2 line-clamp-2 block min-h-9 text-xs font-semibold leading-tight text-foreground">
                  {category.name}
                </span>
              </Link>
            ))}
          </div>

          {categoryShelves.length > 0 && (
            <div className="mt-8 space-y-4">
              {categoryShelves.map(({ category, products }) => (
                <div
                  key={category.id}
                  className="overflow-hidden rounded-lg border border-[#e5ded2] bg-white"
                >
                  <div className="flex items-center justify-between gap-3 border-b border-[#eee4d6] bg-[#fffaf2] px-4 py-3">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#647174]">
                        Top picks
                      </p>
                      <h3 className="text-lg font-semibold leading-tight text-[#102f33]">
                        Best of {category.name}
                      </h3>
                    </div>
                    <Link
                      to="/shop"
                      search={{ cat: category.name } as never}
                      className="inline-flex h-9 items-center rounded-md bg-[#2874f0] px-4 text-sm font-semibold text-white transition hover:bg-[#1f5fc7]"
                    >
                      View all
                    </Link>
                  </div>
                  <div className="grid grid-cols-2 gap-px bg-[#eee4d6] p-px sm:grid-cols-3 lg:grid-cols-5">
                    {products.map((product) => (
                      <div key={product.id} className="bg-white">
                        <ProductCard product={product} />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="container-app reveal-up reveal-delay-2 grid grid-cols-1 gap-3 py-8 sm:grid-cols-2 md:grid-cols-4">
        {[
          { t: "Free shipping", d: "On orders above Rs. 999" },
          { t: "Authentic products", d: "Sourced from Vrindavan" },
          { t: "Careful packing", d: "Packed with devotion" },
          { t: "Easy returns", d: "7-day return policy" },
        ].map(({ t, d }) => (
          <div key={t} className="premium-card p-5">
            <p className="text-sm font-semibold">{t}</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">{d}</p>
          </div>
        ))}
      </section>
    </Layout>
  );
}
