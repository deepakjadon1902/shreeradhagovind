import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Layout } from "@/components/Layout";
import { ProductCard } from "@/components/ProductCard";
import { useStore } from "@/lib/store";
import { SlidersHorizontal, ChevronRight, Home } from "lucide-react";
import { pageSeo } from "@/lib/seo";

type Search = { q?: string; cat?: string };

export const Route = createFileRoute("/shop")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    q: typeof s.q === "string" ? s.q : undefined,
    cat: typeof s.cat === "string" ? s.cat : undefined,
  }),
  component: Shop,
  head: (ctx: any) => {
    const category = ctx?.search?.cat;
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

  const activeCategoryInfo = useMemo(() => {
    if (cat === "All") return null;
    const asParent = categoryTree.find((t) => t.name === cat);
    if (asParent) {
      return {
        parent: asParent,
        current: asParent,
        isParent: true,
        subcategories: asParent.children || [],
      };
    }
    const asChildParent = categoryTree.find((t) =>
      (t.children || []).some((c) => c.name === cat),
    );
    if (asChildParent) {
      const currentChild = asChildParent.children.find((c) => c.name === cat);
      return {
        parent: asChildParent,
        current: currentChild || null,
        isParent: false,
        subcategories: asChildParent.children || [],
      };
    }
    return null;
  }, [cat, categoryTree]);

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
      <div className="container-app py-6 md:py-8">
        {/* Breadcrumb navigation */}
        <nav aria-label="Breadcrumb" className="mb-4 flex items-center gap-1.5 text-xs text-muted-foreground flex-wrap">
          <Link to="/" className="inline-flex items-center gap-1 hover:text-primary transition">
            <Home className="h-3.5 w-3.5" /> Home
          </Link>
          <ChevronRight className="h-3 w-3 text-muted-foreground/60" />
          <button
            type="button"
            onClick={() => selectCategory("All")}
            className={`hover:text-primary transition ${cat === "All" ? "font-semibold text-foreground" : ""}`}
          >
            Shop
          </button>
          {activeCategoryInfo && (
            <>
              <ChevronRight className="h-3 w-3 text-muted-foreground/60" />
              <button
                type="button"
                onClick={() => selectCategory(activeCategoryInfo.parent.name)}
                className={`hover:text-primary transition ${activeCategoryInfo.isParent ? "font-semibold text-foreground" : ""}`}
              >
                {activeCategoryInfo.parent.name}
              </button>
            </>
          )}
          {activeCategoryInfo && !activeCategoryInfo.isParent && (
            <>
              <ChevronRight className="h-3 w-3 text-muted-foreground/60" />
              <span className="font-semibold text-foreground">{cat}</span>
            </>
          )}
        </nav>

        <div className="flex flex-col gap-2 border-b border-border pb-5">
          <p className="eyebrow">Sacred Collection</p>
          <h1 className="section-title">
            Shop {cat !== "All" ? <span className="text-primary">- {cat}</span> : "all products"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {products.length} sacred {products.length === 1 ? "product" : "products"}
            {search.q ? ` matching "${search.q}"` : ""}
          </p>
        </div>

        {/* Subcategory Pills Bar */}
        {activeCategoryInfo && activeCategoryInfo.subcategories.length > 0 && (
          <div className="mt-4 flex items-center gap-2 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <button
              type="button"
              onClick={() => selectCategory(activeCategoryInfo.parent.name)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-medium shrink-0 transition ${
                activeCategoryInfo.isParent
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "border border-border bg-white text-foreground hover:bg-muted/60"
              }`}
            >
              All {activeCategoryInfo.parent.name}
            </button>
            {activeCategoryInfo.subcategories.map((sub) => (
              <button
                key={sub.id}
                type="button"
                onClick={() => selectCategory(sub.name)}
                className={`rounded-full px-3.5 py-1.5 text-xs font-medium shrink-0 transition ${
                  cat === sub.name
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "border border-border bg-white text-foreground hover:bg-muted/60"
                }`}
              >
                {sub.name}
              </button>
            ))}
          </div>
        )}

        <div className="mt-6 grid gap-6 lg:grid-cols-[260px_1fr]">
          <aside className="h-fit space-y-6 rounded-lg border border-border bg-white p-4 lg:sticky lg:top-32 shadow-sm">
            <div>
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                <SlidersHorizontal className="h-4 w-4" /> Categories
              </h3>
              <div className="flex flex-col gap-1">
                <button
                  onClick={() => selectCategory("All")}
                  className={`rounded-md px-3 py-2 text-left text-sm transition ${cat === "All" ? "bg-primary text-primary-foreground font-medium" : "hover:bg-muted"}`}
                >
                  All Categories
                </button>
                {categoryTree.filter((p) => p.name.toLowerCase() !== "featured").length > 0
                  ? categoryTree
                      .filter((p) => p.name.toLowerCase() !== "featured")
                      .map((parent) => (
                        <div key={parent.id}>
                          <button
                            onClick={() => selectCategory(parent.name)}
                            className={`w-full rounded-md px-3 py-2 text-left text-sm font-semibold transition ${cat === parent.name ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                          >
                            {parent.name}
                          </button>
                          {parent.children.filter((c) => c.name.toLowerCase() !== "featured").length > 0 && (
                            <div className="ml-3 mt-1 space-y-1 border-l-2 border-border/60 pl-2.5">
                              {parent.children
                                .filter((c) => c.name.toLowerCase() !== "featured")
                                .map((child) => (
                                  <button
                                    key={child.id}
                                    onClick={() => selectCategory(child.name)}
                                    className={`w-full rounded-md px-2.5 py-1.5 text-left text-xs transition ${cat === child.name ? "bg-primary text-primary-foreground font-medium" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}
                                  >
                                    {child.name}
                                  </button>
                                ))}
                            </div>
                          )}
                        </div>
                      ))
                  : categories
                      .filter((c) => c.toLowerCase() !== "featured")
                      .map((c) => (
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
