import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Layout } from "@/components/Layout";
import { ProductCard } from "@/components/ProductCard";
import { useStore } from "@/lib/store";
import { SlidersHorizontal } from "lucide-react";

type Search = { q?: string; cat?: string };

export const Route = createFileRoute("/shop")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    q: typeof s.q === "string" ? s.q : undefined,
    cat: typeof s.cat === "string" ? s.cat : undefined,
  }),
  component: Shop,
  head: () => ({
    meta: [
      { title: "Shop Sacred Vrindavan Essentials — Shri Radha Govind Store" },
      { name: "description", content: "Browse the full collection of Krishna & Radha Rani poshak, gopi chandan, itra, mala, puja items and Janmashtami specials." },
      { property: "og:title", content: "Shop — Shri Radha Govind Store" },
      { property: "og:description", content: "Browse authentic sacred essentials hand-curated from Vrindavan." },
      { property: "og:url", content: "https://shriradhagovindstore.com/shop" },
    ],
    links: [{ rel: "canonical", href: "https://shriradhagovindstore.com/shop" }],
  }),
});

function Shop() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const { adminProducts, categories, categoryTree } = useStore();
  const [cat, setCat] = useState<string>(search.cat ?? "All");
  const [sort, setSort] = useState("featured");
  const [maxPrice, setMaxPrice] = useState(2500);

  useEffect(() => {
    setCat(search.cat ?? "All");
  }, [search.cat]);

  const selectCategory = (category: string) => {
    setCat(category);
    navigate({ to: "/shop", search: { ...search, cat: category === "All" ? undefined : category } });
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
      <div className="container-app py-10">
        <h1 className="font-display text-4xl md:text-5xl">Shop {cat !== "All" ? <span className="italic text-primary">— {cat}</span> : ""}</h1>
        <p className="text-muted-foreground mt-2 text-sm">{products.length} sacred products{search.q ? ` for "${search.q}"` : ""}</p>

        <div className="grid lg:grid-cols-[260px_1fr] gap-8 mt-8">
          <aside className="space-y-6">
            <div>
              <h3 className="font-display text-lg mb-3 flex items-center gap-2"><SlidersHorizontal className="h-4 w-4" /> Categories</h3>
              <div className="flex flex-col gap-1">
                <button onClick={() => selectCategory("All")} className={`text-left px-3 py-2 rounded-lg text-sm transition ${cat === "All" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>All</button>
                {categoryTree.length > 0 ? categoryTree.map((parent) => (
                  <div key={parent.id}>
                    <button onClick={() => selectCategory(parent.name)} className={`w-full text-left px-3 py-2 rounded-lg text-sm font-semibold transition ${cat === parent.name ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>{parent.name}</button>
                    <div className="ml-3 mt-1 space-y-1 border-l pl-2">
                      {parent.children.map((child) => (
                        <button key={child.id} onClick={() => selectCategory(child.name)} className={`w-full text-left px-3 py-1.5 rounded-lg text-xs transition ${cat === child.name ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>{child.name}</button>
                      ))}
                    </div>
                  </div>
                )) : categories.map((c) => (
                  <button key={c} onClick={() => selectCategory(c)} className={`text-left px-3 py-2 rounded-lg text-sm transition ${cat === c ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>{c}</button>
                ))}
              </div>
            </div>
            <div>
              <h3 className="font-display text-lg mb-3">Price</h3>
              <input type="range" min={100} max={2500} step={50} value={maxPrice} onChange={(e) => setMaxPrice(+e.target.value)} className="w-full accent-primary" />
              <p className="text-xs text-muted-foreground mt-1">Up to ₹{maxPrice}</p>
            </div>
            <div>
              <h3 className="font-display text-lg mb-3">Sort</h3>
              <select value={sort} onChange={(e) => setSort(e.target.value)} className="w-full h-10 rounded-lg border bg-card px-3 text-sm">
                <option value="featured">Featured</option>
                <option value="low">Price: Low to High</option>
                <option value="high">Price: High to Low</option>
                <option value="rating">Top rated</option>
              </select>
            </div>
          </aside>
          <div>
            {products.length === 0 ? (
              <div className="text-center py-20 text-muted-foreground">No products match your filters.</div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
                {products.map((p) => <ProductCard key={p.id} product={p} />)}
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
