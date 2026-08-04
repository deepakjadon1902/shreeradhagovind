import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Layout } from "@/components/Layout";
import { ProductCard } from "@/components/ProductCard";
import { useStore } from "@/lib/store";
import { SlidersHorizontal } from "lucide-react";
import { pageSeo } from "@/lib/seo";

type Search = { q?: string; cat?: string };

export const Route = createFileRoute("/shop")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    q: typeof s.q === "string" ? s.q : undefined,
    cat: typeof s.cat === "string" ? s.cat : undefined,
  }),
  component: Shop,
  head: ({ search }) => {
    const category = search.cat;
    const title = category
      ? `Buy ${category} Online | Shri Radha Govind Store`
      : "Shop Tulsi Mala, Puja Items, Itra & Temple Gifts | Shri Radha Govind Store";
    const description = category
      ? `Buy authentic ${category} online from Shri Radha Govind Store, Vrindavan. Explore trusted devotional products with fast shipping across India.`
      : "Shop Tulsi Mala, Kanthi Mala, Puja Essentials, Chandan, Tilak, Itra, Keychains, Temple Gifts and spiritual products from Vrindavan.";

    return pageSeo({
      title,
      description,
      path: category ? `/shop?cat=${encodeURIComponent(category)}` : "/shop",
    });
  },
});

function Shop() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const { adminProducts, categories, categoryTree } = useStore();
  const [cat, setCat] = useState<string>(search.cat ?? "All");
  const [sort, setSort] = useState("featured");
  const catalogMaxPrice = useMemo(
    () => Math.max(100, ...adminProducts.map((product) => product.price)),
    [adminProducts],
  );
  const [maxPrice, setMaxPrice] = useState(catalogMaxPrice);

  useEffect(() => {
    setCat(search.cat ?? "All");
  }, [search.cat]);

  useEffect(() => {
    setMaxPrice((value) => Math.max(value, catalogMaxPrice));
  }, [catalogMaxPrice]);

  const selectCategory = (category: string) => {
    setCat(category);
    navigate({
      to: "/shop",
      search: { ...search, cat: category === "All" ? undefined : category },
    });
  };

  const products = useMemo(() => {
    let p = [...adminProducts];
    if (cat !== "All") {
      const parent = categoryTree.find((x) => x.name === cat);
      const names = parent ? [parent.name, ...parent.children.map((x) => x.name)] : [cat];
      p = p.filter((x) => names.includes(x.category));
    }
    if (search.q) {
      const q = search.q.toLowerCase();
      p = p.filter((x) => x.name.toLowerCase().includes(q) || x.category.toLowerCase().includes(q));
    }
    p = p.filter((x) => x.price <= maxPrice);
    if (sort === "low") p.sort((a, b) => a.price - b.price);
    if (sort === "high") p.sort((a, b) => b.price - a.price);
    if (sort === "rating") p.sort((a, b) => b.rating - a.rating);
    return p;
  }, [adminProducts, cat, search.q, sort, maxPrice, categoryTree]);

  return (
    <Layout>
      <div className="container-app py-8 md:py-10">
        <div className="flex flex-col gap-2 border-b border-border pb-5">
          <p className="eyebrow">Store collection</p>
          <h1 className="section-title">
            Shop {cat !== "All" ? <span className="text-primary">- {cat}</span> : "all products"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {products.length} sacred products{search.q ? ` for "${search.q}"` : ""}
          </p>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[260px_1fr]">
          <aside className="h-fit space-y-6 rounded-lg border border-border bg-white p-4 lg:sticky lg:top-32">
            <div>
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                <SlidersHorizontal className="h-4 w-4" /> Categories
              </h3>
              <div className="flex flex-col gap-1">
                <button
                  onClick={() => selectCategory("All")}
                  className={`rounded-md px-3 py-2 text-left text-sm transition ${cat === "All" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                >
                  All
                </button>
                {categoryTree.length > 0
                  ? categoryTree.map((parent) => (
                      <div key={parent.id}>
                        <button
                          onClick={() => selectCategory(parent.name)}
                          className={`w-full rounded-md px-3 py-2 text-left text-sm font-semibold transition ${cat === parent.name ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                        >
                          {parent.name}
                        </button>
                        <div className="ml-3 mt-1 space-y-1 border-l pl-2">
                          {parent.children.map((child) => (
                            <button
                              key={child.id}
                              onClick={() => selectCategory(child.name)}
                              className={`w-full rounded-md px-3 py-1.5 text-left text-xs transition ${cat === child.name ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                            >
                              {child.name}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))
                  : categories.map((c) => (
                      <button
                        key={c}
                        onClick={() => selectCategory(c)}
                        className={`rounded-md px-3 py-2 text-left text-sm transition ${cat === c ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                      >
                        {c}
                      </button>
                    ))}
              </div>
            </div>
            <div>
              <h3 className="mb-3 text-sm font-semibold">Price</h3>
              <input
                type="range"
                min={100}
                max={catalogMaxPrice}
                step={50}
                value={maxPrice}
                onChange={(e) => setMaxPrice(+e.target.value)}
                className="w-full accent-primary"
              />
              <p className="mt-1 text-xs text-muted-foreground">Up to Rs. {maxPrice}</p>
            </div>
            <div>
              <h3 className="mb-3 text-sm font-semibold">Sort</h3>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                className="h-10 w-full rounded-md border bg-card px-3 text-sm outline-none focus:border-primary"
              >
                <option value="featured">Featured</option>
                <option value="low">Price: Low to High</option>
                <option value="high">Price: High to Low</option>
                <option value="rating">Top rated</option>
              </select>
            </div>
          </aside>
          <div>
            {products.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border bg-white py-20 text-center text-muted-foreground">
                No products match your filters.
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {products.map((p) => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
