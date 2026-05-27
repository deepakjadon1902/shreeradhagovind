import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
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
});

function Shop() {
  const search = Route.useSearch();
  const { adminProducts, categories } = useStore();
  const CATS = ["All", ...categories];
  const [cat, setCat] = useState<string>(search.cat ?? "All");
  const [sort, setSort] = useState("featured");
  const [maxPrice, setMaxPrice] = useState(2500);

  const products = useMemo(() => {
    let p = [...adminProducts];
    if (cat !== "All") p = p.filter((x) => x.category === cat);
    if (search.q) {
      const q = search.q.toLowerCase();
      p = p.filter((x) => x.name.toLowerCase().includes(q) || x.category.toLowerCase().includes(q));
    }
    p = p.filter((x) => x.price <= maxPrice);
    if (sort === "low") p.sort((a, b) => a.price - b.price);
    if (sort === "high") p.sort((a, b) => b.price - a.price);
    if (sort === "rating") p.sort((a, b) => b.rating - a.rating);
    return p;
  }, [adminProducts, cat, search.q, sort, maxPrice]);

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
                {CATEGORIES.map((c) => (
                  <button key={c} onClick={() => setCat(c)} className={`text-left px-3 py-2 rounded-lg text-sm transition ${cat === c ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>{c}</button>
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
