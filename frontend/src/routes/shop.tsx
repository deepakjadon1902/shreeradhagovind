import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Layout } from "@/components/Layout";
import { ProductCard } from "@/components/ProductCard";
import { useStore } from "@/lib/store";
import { SlidersHorizontal, ChevronRight, Home, Sparkles, X, RotateCcw } from "lucide-react";
import { pageSeo, SITE_URL, cleanMetaText, DEFAULT_IMAGE } from "@/lib/seo";

type Search = { q?: string; cat?: string; filter?: string };

export const Route = createFileRoute("/shop")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    q: typeof s.q === "string" ? s.q : undefined,
    cat: typeof s.cat === "string" ? s.cat : undefined,
    filter: typeof s.filter === "string" ? s.filter : undefined,
  }),
  component: Shop,
  head: (ctx: any) => {
    const rawQ = typeof ctx?.search?.q === "string" ? ctx.search.q.trim() : "";
    const isSacredPicks =
      rawQ.toLowerCase() === "sacred-picks" ||
      ctx?.search?.filter?.toLowerCase() === "sacred-picks";
    const category = typeof ctx?.search?.cat === "string" && ctx.search.cat !== "All"
      ? ctx.search.cat.trim()
      : undefined;

    // Filter & Search Control:
    // Arbitrary internal search queries (e.g. ?q=mala) should not bloat the index with thin results.
    // Sacred Picks is a curated editorial landing page and is allowed.
    const isArbitrarySearch = Boolean(rawQ && !isSacredPicks);
    const hasArbitraryFilter = Boolean(ctx?.search?.filter && !isSacredPicks);
    const robots = (isArbitrarySearch || hasArbitraryFilter)
      ? "noindex, follow"
      : "index, follow";

    const title = isSacredPicks
      ? "Sacred Picks — Devotional Favorites | Shri Radha Govind Store"
      : category
      ? cleanMetaText(`Buy ${category} Online | Authentic Vrindavan Collection | Shri Radha Govind Store`, 70)
      : isArbitrarySearch
      ? cleanMetaText(`Search: "${rawQ}" | Shri Radha Govind Store`, 70)
      : "Shop Sacred Tulsi Mala, Puja Items & Vrindavan Essentials | Shri Radha Govind Store";

    const description = isSacredPicks
      ? "Explore curated Sacred Picks from Vrindavan: top-rated authentic Tulsi malas, pure Chandan, sacred Itra, and devotional essentials with fast all-India delivery."
      : category
      ? cleanMetaText(
          `Buy authentic ${category} handcrafted by Vrindavan artisans. Pure sacred devotional essentials with fast delivery across India. Shri Radha Govind Store.`,
          160,
        )
      : "Shop authentic Tulsi malas, Kanthi malas, Puja essentials, Chandan, Tilak, Itra and spiritual items directly from Vrindavan. Fast pan-India shipping.";

    const canonicalPath = isSacredPicks
      ? "/shop?q=sacred-picks"
      : category
      ? `/shop?cat=${encodeURIComponent(category)}`
      : "/shop";

    const canonicalUrl = `${SITE_URL}${canonicalPath}`;

    const breadcrumbSchema = {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: "Home",
          item: SITE_URL,
        },
        {
          "@type": "ListItem",
          position: 2,
          name: "Shop",
          item: `${SITE_URL}/shop`,
        },
        ...(category
          ? [
              {
                "@type": "ListItem",
                position: 3,
                name: category,
                item: canonicalUrl,
              },
            ]
          : isSacredPicks
          ? [
              {
                "@type": "ListItem",
                position: 3,
                name: "Sacred Picks",
                item: canonicalUrl,
              },
            ]
          : []),
      ],
    };

    const collectionSchema = category
      ? {
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: `${category} - Shri Radha Govind Store`,
          url: canonicalUrl,
          description,
        }
      : undefined;

    const baseSeo = pageSeo({
      title,
      description,
      path: canonicalPath,
      robots,
    });

    const scripts = [
      {
        type: "application/ld+json",
        children: JSON.stringify(breadcrumbSchema),
      },
      ...(collectionSchema
        ? [
            {
              type: "application/ld+json",
              children: JSON.stringify(collectionSchema),
            },
          ]
        : []),
    ];

    return {
      ...baseSeo,
      scripts,
    };
  },
});

function Shop() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const { adminProducts, categories, categoryTree } = useStore();
  const [cat, setCat] = useState<string>(search.cat ?? "All");
  const [sort, setSort] = useState("featured");
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);

  const isSacredPicks = useMemo(() => {
    return (
      search.q?.toLowerCase() === "sacred-picks" ||
      search.filter?.toLowerCase() === "sacred-picks"
    );
  }, [search.q, search.filter]);

  const catalogMaxPrice = useMemo(
    () => Math.max(100, ...adminProducts.map((product) => product.price || 0)),
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
      search: {
        ...search,
        cat: category === "All" ? undefined : category,
        q: isSacredPicks ? undefined : search.q,
        filter: undefined,
      },
    });
  };

  const selectSacredPicks = () => {
    setCat("All");
    navigate({
      to: "/shop",
      search: {
        cat: undefined,
        q: "sacred-picks",
        filter: undefined,
      },
    });
  };

  const resetFilters = () => {
    setMaxPrice(catalogMaxPrice);
    setSort("featured");
    setCat("All");
    navigate({
      to: "/shop",
      search: {},
    });
  };

  const activeCategoryInfo = useMemo(() => {
    if (cat === "All" || isSacredPicks) return null;
    const catLower = cat.toLowerCase();
    const asParent = categoryTree.find((t) => t.name.toLowerCase() === catLower);
    if (asParent) {
      return {
        parent: asParent,
        current: asParent,
        isParent: true,
        subcategories: asParent.children || [],
      };
    }
    const asChildParent = categoryTree.find((t) =>
      (t.children || []).some((c) => c.name.toLowerCase() === catLower),
    );
    if (asChildParent) {
      const currentChild = asChildParent.children.find(
        (c) => c.name.toLowerCase() === catLower,
      );
      return {
        parent: asChildParent,
        current: currentChild || null,
        isParent: false,
        subcategories: asChildParent.children || [],
      };
    }
    return null;
  }, [cat, categoryTree, isSacredPicks]);

  const products = useMemo(() => {
    let p = [...adminProducts];

    if (isSacredPicks) {
      // Sacred Picks: Featured deals or highest rated products
      const featured = p.filter((x) => x.featuredDeal);
      if (featured.length > 0) {
        p = featured;
      } else {
        // Fallback to top-rated picks
        p = [...p].sort((a, b) => b.rating - a.rating);
      }
    } else {
      if (cat !== "All") {
        const catLower = cat.toLowerCase();
        const parent = categoryTree.find((x) => x.name.toLowerCase() === catLower);
        if (parent) {
          const names = [parent.name, ...parent.children.map((x) => x.name)].map((n) =>
            n.toLowerCase(),
          );
          p = p.filter((x) => names.includes(x.category.toLowerCase()));
        } else {
          p = p.filter((x) => x.category.toLowerCase() === catLower);
        }
      }
      if (search.q) {
        const q = search.q.toLowerCase().trim();
        p = p.filter(
          (x) =>
            x.name.toLowerCase().includes(q) ||
            x.category.toLowerCase().includes(q) ||
            (x.description && x.description.toLowerCase().includes(q)),
        );
      }
    }

    p = p.filter((x) => x.price <= maxPrice);

    if (sort === "low") p.sort((a, b) => a.price - b.price);
    if (sort === "high") p.sort((a, b) => b.price - a.price);
    if (sort === "rating") p.sort((a, b) => b.rating - a.rating);
    return p;
  }, [adminProducts, cat, isSacredPicks, search.q, sort, maxPrice, categoryTree]);

  const pageTitle = isSacredPicks
    ? "Sacred Picks"
    : cat !== "All"
    ? cat
    : search.q
    ? `Search: "${search.q}"`
    : "All Products";

  return (
    <Layout>
      <div className="container-app py-4 sm:py-6">
        {/* Breadcrumb Navigation */}
        <nav
          aria-label="Breadcrumb"
          className="mb-3 flex items-center gap-1.5 text-xs text-muted-foreground flex-wrap"
        >
          <Link to="/" className="inline-flex items-center gap-1 hover:text-[#166F77] transition">
            <Home className="h-3.5 w-3.5" /> Home
          </Link>
          <ChevronRight className="h-3 w-3 text-muted-foreground/60" />
          <Link
            to="/shop"
            className={`hover:text-[#166F77] transition ${
              cat === "All" && !isSacredPicks ? "font-semibold text-foreground" : ""
            }`}
          >
            Shop
          </Link>
          {isSacredPicks && (
            <>
              <ChevronRight className="h-3 w-3 text-muted-foreground/60" />
              <span className="font-semibold text-foreground">Sacred Picks</span>
            </>
          )}
          {activeCategoryInfo && (
            <>
              <ChevronRight className="h-3 w-3 text-muted-foreground/60" />
              <Link
                to="/shop"
                search={{ cat: activeCategoryInfo.parent.name } as never}
                className={`hover:text-[#166F77] transition ${
                  activeCategoryInfo.isParent ? "font-semibold text-foreground" : ""
                }`}
              >
                {activeCategoryInfo.parent.name}
              </Link>
            </>
          )}
          {activeCategoryInfo && !activeCategoryInfo.isParent && (
            <>
              <ChevronRight className="h-3 w-3 text-muted-foreground/60" />
              <span className="font-semibold text-foreground">{cat}</span>
            </>
          )}
        </nav>

        {/* Compact Category & Controls Header */}
        <div className="rounded-xl border border-[#E7E1D6] bg-white p-3 sm:p-4 shadow-sm mb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#E7E1D6]">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-serif text-lg sm:text-2xl font-bold text-[#2B211C]">
                  {pageTitle}
                </h1>
                <span className="rounded-full bg-[#166F77]/10 px-2 py-0.5 text-xs font-semibold text-[#166F77]">
                  {products.length} {products.length === 1 ? "item" : "items"}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {isSacredPicks
                  ? "Handpicked sacred devotional items from Vrindavan"
                  : "Authentic sacred products from Vrindavan"}
              </p>
            </div>

            {/* Sort & Filter Toggle Controls */}
            <div className="flex items-center gap-2 self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setFilterDrawerOpen(!filterDrawerOpen)}
                className={`inline-flex items-center gap-1.5 h-9 rounded-lg border px-3 text-xs font-medium transition ${
                  filterDrawerOpen || maxPrice < catalogMaxPrice
                    ? "border-[#166F77] bg-[#166F77]/10 text-[#166F77]"
                    : "border-[#E7E1D6] bg-white text-[#2B211C] hover:border-[#166F77]"
                }`}
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                <span>Filters</span>
                {maxPrice < catalogMaxPrice && (
                  <span className="h-1.5 w-1.5 rounded-full bg-[#166F77]" />
                )}
              </button>

              <div className="relative">
                <select
                  value={sort}
                  aria-label="Sort products"
                  onChange={(e) => setSort(e.target.value)}
                  className="h-9 rounded-lg border border-[#E7E1D6] bg-white px-3 pr-7 text-xs font-medium text-[#2B211C] outline-none hover:border-[#166F77] focus:border-[#166F77] transition cursor-pointer"
                >
                  <option value="featured">Sort: Featured</option>
                  <option value="low">Price: Low to High</option>
                  <option value="high">Price: High to Low</option>
                  <option value="rating">Top Rated</option>
                </select>
              </div>
            </div>
          </div>

          {/* Horizontal Scrollable Categories Pills */}
          <div className="pt-3">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <button
                type="button"
                onClick={() => selectCategory("All")}
                className={`h-8 rounded-full px-3 text-xs font-medium shrink-0 transition ${
                  cat === "All" && !isSacredPicks
                    ? "bg-[#166F77] text-white shadow-sm"
                    : "bg-[#F8F4EC] text-[#2B211C] hover:bg-[#EDE6D8]"
                }`}
              >
                All Categories
              </button>

              <button
                type="button"
                onClick={selectSacredPicks}
                className={`inline-flex items-center gap-1 h-8 rounded-full px-3 text-xs font-medium shrink-0 transition ${
                  isSacredPicks
                    ? "bg-[#D9A441] text-white shadow-sm font-semibold"
                    : "bg-[#FFF9EE] border border-[#D9A441]/40 text-[#9C6D18] hover:bg-[#FFF2D6]"
                }`}
              >
                <Sparkles className="h-3 w-3" />
                Sacred Picks
              </button>

              {categoryTree.map((parent) => (
                <button
                  key={parent.id}
                  type="button"
                  onClick={() => selectCategory(parent.name)}
                  className={`h-8 rounded-full px-3 text-xs font-medium shrink-0 transition ${
                    cat.toLowerCase() === parent.name.toLowerCase() && !isSacredPicks
                      ? "bg-[#166F77] text-white shadow-sm"
                      : "bg-[#F8F4EC] text-[#2B211C] hover:bg-[#EDE6D8]"
                  }`}
                >
                  {parent.name}
                </button>
              ))}
            </div>

            {/* Subcategory Pills (when parent is selected) */}
            {activeCategoryInfo && activeCategoryInfo.subcategories.length > 0 && (
              <div className="mt-2.5 pt-2.5 border-t border-[#E7E1D6]/70 flex items-center gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider shrink-0 mr-1">
                  Subcategories:
                </span>
                <button
                  type="button"
                  onClick={() => selectCategory(activeCategoryInfo.parent.name)}
                  className={`h-7 rounded-md px-2.5 text-xs font-medium shrink-0 transition ${
                    activeCategoryInfo.isParent
                      ? "bg-[#166F77] text-white"
                      : "bg-white border border-[#E7E1D6] text-muted-foreground hover:text-foreground"
                  }`}
                >
                  All {activeCategoryInfo.parent.name}
                </button>
                {activeCategoryInfo.subcategories.map((sub) => (
                  <button
                    key={sub.id}
                    type="button"
                    onClick={() => selectCategory(sub.name)}
                    className={`h-7 rounded-md px-2.5 text-xs font-medium shrink-0 transition ${
                      cat.toLowerCase() === sub.name.toLowerCase()
                        ? "bg-[#166F77] text-white"
                        : "bg-white border border-[#E7E1D6] text-[#2B211C] hover:border-[#166F77]"
                    }`}
                  >
                    {sub.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Expandable Filter Tray */}
          {filterDrawerOpen && (
            <div className="mt-3 pt-3 border-t border-[#E7E1D6] bg-[#FAF8F4] -mx-3 -mb-3 sm:-mx-4 sm:-mb-4 p-3 sm:p-4 rounded-b-xl">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex-1 min-w-[200px] max-w-sm">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-semibold text-[#2B211C]">Max Price</span>
                    <span className="font-bold text-[#166F77]">Up to ₹{maxPrice}</span>
                  </div>
                  <input
                    type="range"
                    min={100}
                    max={catalogMaxPrice}
                    step={50}
                    value={maxPrice}
                    aria-label="Filter by maximum price"
                    onChange={(e) => setMaxPrice(+e.target.value)}
                    className="w-full accent-[#166F77] cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground mt-0.5">
                    <span>₹100</span>
                    <span>₹{catalogMaxPrice}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {(maxPrice < catalogMaxPrice || cat !== "All" || isSacredPicks) && (
                    <button
                      type="button"
                      onClick={resetFilters}
                      className="inline-flex items-center gap-1 h-8 rounded-lg border border-[#E7E1D6] bg-white px-2.5 text-xs text-muted-foreground hover:text-foreground transition"
                    >
                      <RotateCcw className="h-3 w-3" /> Reset Filters
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setFilterDrawerOpen(false)}
                    className="inline-flex items-center gap-1 h-8 rounded-lg bg-[#166F77] px-3 text-xs font-semibold text-white transition hover:bg-[#135E65]"
                  >
                    Done
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Products Grid (Appears immediately near the top!) */}
        <div>
          {products.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#E7E1D6] bg-white py-16 px-4 text-center">
              <p className="font-serif text-lg font-semibold text-[#2B211C]">
                No sacred products found
              </p>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1 max-w-md mx-auto">
                No items match your current selection. Try resetting filters or choosing another category.
              </p>
              <button
                type="button"
                onClick={resetFilters}
                className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-[#166F77] px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-[#135E65]"
              >
                View All Products
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2.5 sm:gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {products.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
