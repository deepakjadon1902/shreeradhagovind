import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Layout } from "@/components/Layout";
import { useStore, formatINR } from "@/lib/store";
import { API_URL, api, isApiEnabled } from "@/lib/api";
import { type Product } from "@/lib/products";
import {
  Heart,
  ShoppingBag,
  Star,
  Check,
  Minus,
  Plus,
  Share2,
  Truck,
  ShieldCheck,
  RotateCcw,
  Lock,
  MapPin,
  Eye,
  Sparkles,
  X,
  ChevronRight,
  Info,
  BookOpen,
  PackageCheck,
} from "lucide-react";
import { useEffect, useState, useRef } from "react";
import { ProductCard } from "@/components/ProductCard";
import { cleanMetaText, pageSeo, slugify } from "@/lib/seo";
import { FormattedText } from "@/components/SimpleRichEditor";
import { toast } from "sonner";

function normalizeProduct(value: Record<string, unknown>): Product {
  return {
    id: String(value.id ?? value._id ?? ""),
    slug: String(value.slug ?? slugify(String(value.name ?? value._id ?? ""))),
    name: String(value.name ?? ""),
    category: String(value.category ?? ""),
    price: Number(value.price ?? 0),
    mrp: Number(value.mrp ?? 0),
    costPrice: typeof value.costPrice === "number" ? value.costPrice : undefined,
    rating: Number(value.rating ?? 0),
    reviews: Number(value.reviews ?? 0),
    image: String(value.image ?? ""),
    images: Array.isArray(value.images) ? value.images.map(String) : [],
    featuredDeal: Boolean(value.featuredDeal),
    description: String(value.description ?? ""),
    details: Array.isArray(value.details) ? value.details.map(String) : [],
    stock: Number(value.stock ?? 0),
    hsnCode: value.hsnCode ? String(value.hsnCode) : undefined,
    gstRate: typeof value.gstRate === "number" ? value.gstRate : undefined,
    additionalImage: value.additionalImage ? String(value.additionalImage) : undefined,
    additionalHeading: value.additionalHeading ? String(value.additionalHeading) : undefined,
    additionalContent: value.additionalContent ? String(value.additionalContent) : undefined,
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
  const [reviewsList, setReviewsList] = useState<any[]>([]);
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [activeTab, setActiveTab] = useState<"description" | "details" | "care" | "shipping">("description");

  // Lightbox modal state
  const [lightboxOpen, setLightboxOpen] = useState(false);

  // Delivery check state
  const [pincodeInput, setPincodeInput] = useState("");
  const [checkingPincode, setCheckingPincode] = useState(false);
  const [pincodeResult, setPincodeResult] = useState<{
    checked: boolean;
    success: boolean;
    district?: string;
    state?: string;
    message?: string;
  } | null>(null);

  // Mobile sticky bar observer
  const purchaseBoxRef = useRef<HTMLDivElement>(null);
  const [showStickyBar, setShowStickyBar] = useState(false);

  useEffect(() => {
    if (!product?.id) return;
    let alive = true;
    const fetchReviews = async () => {
      setLoadingReviews(true);
      try {
        const res = await fetch(`${API_URL}/reviews/product/${encodeURIComponent(product.id)}`);
        if (res.ok) {
          const data = await res.json();
          if (alive && Array.isArray(data)) {
            setReviewsList(data);
          }
        }
      } catch {
        // ignore
      } finally {
        if (alive) setLoadingReviews(false);
      }
    };
    fetchReviews();
    return () => {
      alive = false;
    };
  }, [product?.id]);

  const avgRating =
    reviewsList.length > 0
      ? reviewsList.reduce((sum, r) => sum + (Number(r.rating) || 5), 0) / reviewsList.length
      : product?.rating || 5;

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

  // Lightbox keyboard listener
  useEffect(() => {
    if (!lightboxOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightboxOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [lightboxOpen]);

  // Mobile sticky bar scroll detection
  useEffect(() => {
    const el = purchaseBoxRef.current;
    if (!el || typeof window === "undefined") return;

    const handleScroll = () => {
      const rect = el.getBoundingClientRect();
      setShowStickyBar(rect.bottom < 80);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleCheckPincode = async () => {
    const pin = pincodeInput.replace(/\D/g, "").trim();
    if (pin.length !== 6) {
      toast.error("Please enter a valid 6-digit Indian pincode");
      return;
    }
    setCheckingPincode(true);
    try {
      let res: any = null;
      if (isApiEnabled()) {
        try {
          res = await api(`/postal/pincode/${pin}`);
        } catch {
          // fallback
        }
      }
      if (!res || !res.success) {
        const ext = await fetch(`https://api.postalpincode.in/pincode/${pin}`);
        if (ext.ok) {
          const extData = await ext.json();
          if (Array.isArray(extData) && extData[0]?.Status === "Success") {
            const poList = extData[0]?.PostOffice || [];
            const dist = poList.find((p: any) => p.District)?.District || "";
            const st = poList.find((p: any) => p.State)?.State || "";
            res = { success: true, district: dist, state: st };
          }
        }
      }

      if (res && res.success && (res.district || res.state)) {
        setPincodeResult({
          checked: true,
          success: true,
          district: res.district,
          state: res.state,
        });
      } else {
        setPincodeResult({
          checked: true,
          success: false,
          message: "Unable to verify location. Delivery is available across most Indian pincodes.",
        });
      }
    } catch {
      setPincodeResult({
        checked: true,
        success: false,
        message: "Postal service check timed out. We deliver pan-India via DTDC, Delhivery, and Shree Maruti.",
      });
    } finally {
      setCheckingPincode(false);
    }
  };

  if (!product) {
    return (
      <Layout>
        <div className="container-app py-20 text-center">
          <div className="mx-auto w-14 h-14 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700 mb-3">
            <Info className="h-7 w-7" />
          </div>
          <h1 className="font-serif text-2xl sm:text-3xl font-bold text-[#2B211C]">Product Not Found</h1>
          <p className="mt-2 text-xs sm:text-sm text-stone-500 max-w-md mx-auto">
            This devotional item may have been moved or is temporarily unavailable from our Vrindavan ashram store.
          </p>
          <Link
            to="/shop"
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#166F77] px-5 py-2.5 text-xs sm:text-sm font-semibold text-white shadow-xs hover:bg-[#125A61] transition"
          >
            Explore Sacred Catalog
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

  const displayImg = selectedImage || product.image;

  // Has additional backend content
  const hasAdditionalContent = Boolean(
    product.additionalImage ||
    product.additionalHeading?.trim() ||
    product.additionalContent?.trim()
  );

  return (
    <Layout>
      <div className="min-h-screen bg-[#FFFFF4] text-[#2B211C] pb-24 md:pb-0">
        <div className="container-app py-4 sm:py-6 lg:py-8">
          {/* Breadcrumb navigation */}
          <nav className="flex items-center flex-wrap gap-1.5 text-[11px] sm:text-xs text-stone-500 mb-4 sm:mb-5 font-medium">
            <Link to="/" className="hover:text-[#166F77] transition">
              Home
            </Link>
            <ChevronRight className="h-3 w-3 text-stone-300 shrink-0" />
            <Link to="/shop" className="hover:text-[#166F77] transition">
              Shop
            </Link>
            <ChevronRight className="h-3 w-3 text-stone-300 shrink-0" />
            <Link
              to="/shop"
              search={{ cat: product.category } as never}
              className="hover:text-[#166F77] transition"
            >
              {product.category}
            </Link>
            <ChevronRight className="h-3 w-3 text-stone-300 shrink-0" />
            <span className="text-stone-800 line-clamp-1 max-w-[180px] sm:max-w-xs">{product.name}</span>
          </nav>

          {/* Top Section: Two-Column Product Presentation */}
          <div className="grid gap-6 lg:gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(360px,1fr)] items-start">
            {/* LEFT COLUMN: Gallery */}
            <div className="space-y-3">
              {/* Main Image Container */}
              <div className="relative aspect-square w-full rounded-2xl border border-[#E7E1D6] bg-white shadow-[0_2px_16px_rgba(43,33,28,0.04)] overflow-hidden group flex items-center justify-center p-4 sm:p-6">
                {product.featuredDeal && (
                  <span className="absolute top-3 left-3 z-10 rounded-full bg-[#5a1f2a] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white shadow-xs">
                    Authentic Seva Item
                  </span>
                )}

                {/* Lightbox / Zoom Affordance Button */}
                <button
                  type="button"
                  onClick={() => setLightboxOpen(true)}
                  className="absolute top-3 right-3 z-10 grid h-8 w-8 place-items-center rounded-full bg-white/90 border border-[#E7E1D6] text-stone-600 shadow-xs transition hover:bg-white hover:text-[#166F77] hover:scale-105"
                  title="Click to view full-size photo"
                  aria-label="Enlarge image"
                >
                  <Eye className="h-3.5 w-3.5" />
                </button>

                <img
                  src={displayImg}
                  alt={product.name}
                  onClick={() => setLightboxOpen(true)}
                  className="h-full w-full object-contain cursor-zoom-in transition-transform duration-500 ease-out group-hover:scale-105"
                />
              </div>

              {/* Thumbnail Gallery */}
              {gallery.length > 1 && (
                <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                  {gallery.map((image, idx) => (
                    <button
                      key={image + idx}
                      type="button"
                      onClick={() => setSelectedImage(image)}
                      className={`relative h-14 w-14 sm:h-16 sm:w-16 shrink-0 aspect-square overflow-hidden rounded-xl border bg-white p-1 transition-all cursor-pointer ${
                        selectedImage === image
                          ? "border-[#166F77] ring-2 ring-[#166F77]/25 shadow-xs"
                          : "border-[#E7E1D6] opacity-75 hover:opacity-100 hover:border-[#C5A880]"
                      }`}
                      aria-label={`View photo ${idx + 1}`}
                    >
                      <img src={image} alt="" className="h-full w-full object-contain" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* RIGHT COLUMN: Product Purchase Panel */}
            <div className="flex flex-col">
              {/* Category Eyebrow */}
              <div>
                <span className="inline-block text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.18em] text-[#166F77] bg-[#166F77]/8 px-2.5 py-0.5 rounded-full border border-[#166F77]/15">
                  {product.category}
                </span>
              </div>

              {/* Product Title (H1) */}
              <h1 className="mt-2 text-xl sm:text-2xl lg:text-3xl font-serif font-bold text-[#2B211C] leading-snug tracking-tight">
                {product.name}
              </h1>

              {/* Rating & Review Count (Scrolls to reviews) */}
              <div className="mt-2 flex items-center gap-2 text-xs">
                <button
                  type="button"
                  onClick={() =>
                    document.getElementById("reviews-section")?.scrollIntoView({ behavior: "smooth" })
                  }
                  className="inline-flex items-center gap-1.5 text-stone-600 hover:text-[#166F77] transition cursor-pointer"
                >
                  <div className="flex items-center text-amber-500 gap-0.5">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star
                        key={s}
                        className={`h-3 w-3 sm:h-3.5 sm:w-3.5 ${
                          s <= Math.round(avgRating)
                            ? "fill-amber-400 text-amber-400"
                            : "text-stone-200 fill-stone-200"
                        }`}
                      />
                    ))}
                    <span className="font-bold text-stone-900 ml-1 text-xs">{avgRating.toFixed(1)}</span>
                  </div>
                  <span className="text-stone-300">·</span>
                  <span className="underline decoration-stone-300 hover:decoration-[#166F77] underline-offset-4 font-medium text-[11px] sm:text-xs">
                    {reviewsList.length > 0 ? `${reviewsList.length} verified devotee reviews` : `${product.reviews} reviews`}
                  </span>
                </button>
              </div>

              {/* Price Block */}
              <div className="mt-3.5 pt-3 border-t border-[#E7E1D6]/70">
                <div className="flex items-baseline gap-2.5">
                  <span className="text-2xl sm:text-3xl lg:text-4xl font-bold text-[#166F77] tracking-tight">
                    {formatINR(product.price)}
                  </span>
                  {product.mrp > product.price && (
                    <span className="text-sm sm:text-base text-stone-400 line-through font-normal">
                      {formatINR(product.mrp)}
                    </span>
                  )}
                  {off > 0 && (
                    <span className="inline-flex items-center rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[11px] font-bold text-emerald-800">
                      {off}% OFF
                    </span>
                  )}
                </div>
                <p className="mt-1 text-[11px] text-stone-500 font-medium">
                  Inclusive of all taxes · Free shipping on orders above ₹299
                </p>
              </div>

              {/* Stock Status Badge */}
              <div className="mt-2.5 flex items-center gap-2 text-xs">
                {product.stock > 0 ? (
                  <span className="inline-flex items-center gap-1.5 font-medium text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2.5 py-0.5 rounded-full text-[11px]">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    {product.stock <= 10 ? `In stock (Only ${product.stock} left)` : "In stock"}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 font-semibold text-rose-700 bg-rose-50 border border-rose-200 px-2.5 py-0.5 rounded-full text-[11px]">
                    <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                    Currently Out of Stock
                  </span>
                )}
              </div>

              {/* Short Description Preview */}
              {product.description && (
                <div className="mt-3 text-xs sm:text-sm text-stone-600 leading-relaxed line-clamp-2">
                  {product.description.replace(/<[^>]+>/g, "").slice(0, 160)}...{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab("description");
                      document.getElementById("product-info-section")?.scrollIntoView({ behavior: "smooth" });
                    }}
                    className="text-[#166F77] font-semibold underline underline-offset-2 ml-1 cursor-pointer"
                  >
                    Read full details
                  </button>
                </div>
              )}

              {/* Quantity + Purchase CTA block (Referenced for mobile sticky observer) */}
              <div ref={purchaseBoxRef} className="mt-4 sm:mt-5 space-y-2.5 pt-1">
                <div className="flex items-center gap-3">
                  <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-stone-600">
                    Quantity:
                  </span>
                  <div className="inline-flex items-center rounded-lg border border-[#E7E1D6] bg-white shadow-xs">
                    <button
                      type="button"
                      onClick={() => setQty(Math.max(1, qty - 1))}
                      disabled={qty <= 1 || product.stock === 0}
                      className="h-8 w-8 sm:h-9 sm:w-9 flex items-center justify-center text-stone-600 hover:bg-[#FAF7F2] transition disabled:opacity-30 disabled:cursor-not-allowed"
                      aria-label="Decrease quantity"
                    >
                      <Minus className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                    </button>
                    <span className="w-9 text-center text-xs sm:text-sm font-semibold text-stone-800">{qty}</span>
                    <button
                      type="button"
                      onClick={() => setQty(Math.min(product.stock, qty + 1))}
                      disabled={qty >= product.stock || product.stock === 0}
                      className="h-8 w-8 sm:h-9 sm:w-9 flex items-center justify-center text-stone-600 hover:bg-[#FAF7F2] transition disabled:opacity-30 disabled:cursor-not-allowed"
                      aria-label="Increase quantity"
                    >
                      <Plus className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Main Purchase CTAs */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      addToCart(product.id, qty);
                      toast.success(`Added ${qty} ${product.name} to cart`);
                    }}
                    disabled={product.stock === 0}
                    className="h-11 sm:h-12 rounded-xl border border-[#166F77] bg-white font-semibold text-[#166F77] hover:bg-[#F0F7F9] transition flex items-center justify-center gap-2 shadow-xs active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer text-xs sm:text-sm"
                  >
                    <ShoppingBag className="h-4 w-4" /> Add to Cart
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      buyNow(product.id, qty);
                      nav({ to: "/checkout" });
                    }}
                    disabled={product.stock === 0}
                    className="h-11 sm:h-12 rounded-xl bg-[#166F77] hover:bg-[#125A61] font-semibold text-white transition flex items-center justify-center gap-2 shadow-sm shadow-[#166F77]/15 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer text-xs sm:text-sm"
                  >
                    Buy Now
                  </button>
                </div>

                {/* Wishlist & Share Row */}
                <div className="flex items-center justify-between pt-1 text-xs text-stone-600">
                  <button
                    type="button"
                    onClick={() => toggleWishlist(product.id)}
                    className="inline-flex items-center gap-1.5 hover:text-[#166F77] transition cursor-pointer"
                  >
                    <Heart className={`h-3.5 w-3.5 ${wished ? "fill-rose-500 text-rose-500" : ""}`} />
                    <span className="text-[11px] sm:text-xs">{wished ? "Saved in Wishlist" : "Add to Wishlist"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (typeof navigator !== "undefined" && navigator.share) {
                        navigator.share({ title: product.name, url: window.location.href });
                      } else if (typeof navigator !== "undefined" && navigator.clipboard) {
                        navigator.clipboard.writeText(window.location.href);
                        toast.success("Product link copied to clipboard");
                      }
                    }}
                    className="inline-flex items-center gap-1.5 hover:text-[#166F77] transition cursor-pointer"
                  >
                    <Share2 className="h-3.5 w-3.5" />
                    <span className="text-[11px] sm:text-xs">Share with Devotees</span>
                  </button>
                </div>
              </div>

              {/* Trust / Service Strip (4 items - compact 2x2 grid on mobile, 4-col on sm) */}
              <div className="mt-5 pt-4 border-t border-[#E7E1D6]/80 grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="rounded-xl border border-[#E7E1D6]/80 bg-[#FAF7F2] p-2 text-center flex flex-col items-center justify-center min-h-[64px]">
                  <Truck className="h-3.5 w-3.5 text-[#166F77] mb-0.5 shrink-0" />
                  <p className="text-[10.5px] font-semibold text-stone-800 leading-tight">
                    Free shipping on orders above ₹299
                  </p>
                </div>
                <div className="rounded-xl border border-[#E7E1D6]/80 bg-[#FAF7F2] p-2 text-center flex flex-col items-center justify-center min-h-[64px]">
                  <ShieldCheck className="h-3.5 w-3.5 text-[#166F77] mb-0.5 shrink-0" />
                  <p className="text-[10.5px] font-semibold text-stone-800 leading-tight">
                    100% Authentic Vrindavan
                  </p>
                </div>
                <div className="rounded-xl border border-[#E7E1D6]/80 bg-[#FAF7F2] p-2 text-center flex flex-col items-center justify-center min-h-[64px]">
                  <RotateCcw className="h-3.5 w-3.5 text-[#166F77] mb-0.5 shrink-0" />
                  <p className="text-[10.5px] font-semibold text-stone-800 leading-tight">
                    7-Day Easy Returns
                  </p>
                </div>
                <div className="rounded-xl border border-[#E7E1D6]/80 bg-[#FAF7F2] p-2 text-center flex flex-col items-center justify-center min-h-[64px]">
                  <Lock className="h-3.5 w-3.5 text-[#166F77] mb-0.5 shrink-0" />
                  <p className="text-[10.5px] font-semibold text-stone-800 leading-tight">
                    100% Secure Payments
                  </p>
                </div>
              </div>

              {/* Delivery / Pincode Section */}
              <div className="mt-4 rounded-xl border border-[#E7E1D6] bg-white p-3.5 shadow-xs">
                <div className="flex items-center gap-1.5 text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-stone-700">
                  <MapPin className="h-3.5 w-3.5 text-[#166F77]" />
                  <span>Check delivery at your pincode</span>
                </div>
                <div className="mt-2 flex gap-2">
                  <input
                    type="text"
                    maxLength={6}
                    value={pincodeInput}
                    onChange={(e) => setPincodeInput(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="Enter 6-digit pincode"
                    className="h-9 flex-1 rounded-lg border border-[#E7E1D6] px-3 font-mono text-xs text-stone-800 placeholder:text-stone-400 focus:border-[#166F77] focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleCheckPincode}
                    disabled={pincodeInput.length !== 6 || checkingPincode}
                    className="h-9 px-3.5 rounded-lg bg-[#166F77] text-white text-xs font-semibold hover:bg-[#125A61] transition disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                  >
                    {checkingPincode ? "Checking..." : "Check"}
                  </button>
                </div>

                {pincodeResult && (
                  <div className="mt-2.5 text-xs border-t border-stone-100 pt-2">
                    {pincodeResult.success ? (
                      <div className="space-y-0.5 text-emerald-800">
                        <p className="font-semibold flex items-center gap-1.5 text-[11.5px]">
                          <Check className="h-3.5 w-3.5 text-emerald-600" />
                          Delivery available to {pincodeResult.district}
                          {pincodeResult.state ? `, ${pincodeResult.state}` : ""}
                        </p>
                        <p className="text-[11px] text-stone-600">
                          • Dispatched safely in 24–48 hours from Vrindavan Dham
                        </p>
                        <p className="text-[11px] text-stone-600">
                          • Free shipping on orders above ₹299 (Standard ₹49 below ₹299)
                        </p>
                        <p className="text-[11px] text-stone-600">
                          • Cash on Delivery available at checkout
                        </p>
                      </div>
                    ) : (
                      <p className="text-stone-600 text-[11px]">{pincodeResult.message}</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Dynamic Additional Content Section (From Backend / Admin) */}
          {hasAdditionalContent && (
            <section className="mt-10 sm:mt-14 rounded-2xl border border-[#E7E1D6] bg-white p-5 sm:p-7 shadow-xs">
              <div className="grid gap-6 lg:grid-cols-2 items-center">
                {product.additionalImage && (
                  <div className="overflow-hidden rounded-xl border border-[#E7E1D6] bg-[#FAF7F2] p-2 flex items-center justify-center aspect-video sm:aspect-[4/3]">
                    <img
                      src={product.additionalImage}
                      alt={product.additionalHeading || product.name}
                      className="max-h-full max-w-full object-contain rounded-lg"
                    />
                  </div>
                )}
                <div className={`space-y-3 ${!product.additionalImage ? "lg:col-span-2" : ""}`}>
                  {product.additionalHeading && (
                    <h3 className="font-serif text-xl sm:text-2xl font-bold text-[#166F77] leading-snug">
                      {product.additionalHeading}
                    </h3>
                  )}
                  {product.additionalContent && (
                    <div className="text-xs sm:text-sm text-stone-700 leading-relaxed">
                      <FormattedText content={product.additionalContent} />
                    </div>
                  )}
                </div>
              </div>
            </section>
          )}

          {/* Product Information Tabs / Accordion Section */}
          <section id="product-info-section" className="mt-10 sm:mt-14 border-t border-[#E7E1D6] pt-8">
            {/* Tab navigation buttons */}
            <div className="flex items-center gap-1.5 border-b border-[#E7E1D6] overflow-x-auto pb-px scrollbar-none">
              <button
                type="button"
                onClick={() => setActiveTab("description")}
                className={`flex items-center gap-1.5 px-3.5 py-2.5 text-xs sm:text-sm font-semibold tracking-wide transition border-b-2 whitespace-nowrap cursor-pointer ${
                  activeTab === "description"
                    ? "border-[#166F77] text-[#166F77] bg-white rounded-t-lg"
                    : "border-transparent text-stone-500 hover:text-stone-800"
                }`}
              >
                <BookOpen className="h-3.5 w-3.5" /> Description & Significance
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("details")}
                className={`flex items-center gap-1.5 px-3.5 py-2.5 text-xs sm:text-sm font-semibold tracking-wide transition border-b-2 whitespace-nowrap cursor-pointer ${
                  activeTab === "details"
                    ? "border-[#166F77] text-[#166F77] bg-white rounded-t-lg"
                    : "border-transparent text-stone-500 hover:text-stone-800"
                }`}
              >
                <Info className="h-3.5 w-3.5" /> Product Details & Specs
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("care")}
                className={`flex items-center gap-1.5 px-3.5 py-2.5 text-xs sm:text-sm font-semibold tracking-wide transition border-b-2 whitespace-nowrap cursor-pointer ${
                  activeTab === "care"
                    ? "border-[#166F77] text-[#166F77] bg-white rounded-t-lg"
                    : "border-transparent text-stone-500 hover:text-stone-800"
                }`}
              >
                <Sparkles className="h-3.5 w-3.5" /> Sacred Care & Guidelines
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("shipping")}
                className={`flex items-center gap-1.5 px-3.5 py-2.5 text-xs sm:text-sm font-semibold tracking-wide transition border-b-2 whitespace-nowrap cursor-pointer ${
                  activeTab === "shipping"
                    ? "border-[#166F77] text-[#166F77] bg-white rounded-t-lg"
                    : "border-transparent text-stone-500 hover:text-stone-800"
                }`}
              >
                <PackageCheck className="h-3.5 w-3.5" /> Shipping & Returns
              </button>
            </div>

            {/* Tab content area */}
            <div className="bg-white rounded-b-2xl rounded-tr-2xl border border-t-0 border-[#E7E1D6] p-5 sm:p-7 shadow-xs">
              {activeTab === "description" && (
                <div className="max-w-3xl space-y-3.5">
                  <div className="text-xs sm:text-sm leading-relaxed text-stone-700">
                    <FormattedText content={product.description} />
                  </div>
                  <div className="mt-5 rounded-xl bg-[#FAF7F2] border border-[#E7E1D6]/80 p-3.5 text-xs text-stone-600 space-y-1">
                    <p className="font-semibold text-[#166F77] flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5 text-amber-600" /> Authentic Vrindavan Dham Seva
                    </p>
                    <p>
                      Every parcel is packed with reverent care and dispatched directly from our sacred
                      offline seva counter at 155, 2nd Floor, Madan Mohan Ghera, Vrindavan, Mathura.
                    </p>
                  </div>
                </div>
              )}

              {activeTab === "details" && (
                <div className="max-w-3xl space-y-5">
                  {product.details && product.details.length > 0 && (
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-stone-500 mb-2.5">
                        Key Features
                      </h4>
                      <ul className="space-y-1.5">
                        {product.details.map((d, i) => (
                          <li key={i} className="flex items-start gap-2 text-xs sm:text-sm text-stone-700">
                            <Check className="h-3.5 w-3.5 text-[#166F77] shrink-0 mt-0.5" />
                            <span>{d}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-stone-500 mb-2.5">
                      Specifications
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                      <div className="p-2.5 rounded-lg bg-[#FAF7F2] border border-[#E7E1D6]/70 flex justify-between">
                        <span className="text-stone-500">Category:</span>
                        <span className="font-semibold text-stone-800">{product.category}</span>
                      </div>
                      <div className="p-2.5 rounded-lg bg-[#FAF7F2] border border-[#E7E1D6]/70 flex justify-between">
                        <span className="text-stone-500">Origin / Sanctity:</span>
                        <span className="font-semibold text-stone-800">Vrindavan Dham, India</span>
                      </div>
                      {product.hsnCode && (
                        <div className="p-2.5 rounded-lg bg-[#FAF7F2] border border-[#E7E1D6]/70 flex justify-between">
                          <span className="text-stone-500">HSN Code:</span>
                          <span className="font-semibold text-stone-800">{product.hsnCode}</span>
                        </div>
                      )}
                      <div className="p-2.5 rounded-lg bg-[#FAF7F2] border border-[#E7E1D6]/70 flex justify-between">
                        <span className="text-stone-500">Authenticity Guarantee:</span>
                        <span className="font-semibold text-emerald-700">100% Genuine</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "care" && (
                <div className="max-w-3xl space-y-3 text-xs sm:text-sm text-stone-700 leading-relaxed">
                  <h3 className="font-serif text-base sm:text-lg font-bold text-[#166F77]">
                    Maintaining Sanctity & Longevity
                  </h3>
                  <p>
                    Devotional and sacred articles carry spiritual purity and divine blessings. To maintain
                    their consecrated essence:
                  </p>
                  <ul className="space-y-2 pl-2">
                    <li className="flex items-start gap-2">
                      <span className="text-amber-600 font-bold">•</span>
                      <span>
                        <strong>Sacred Items & Malas:</strong> Keep away from harsh chemicals, synthetic detergents, or moisture when not in use. Store in a clean cloth pouch or on a dedicated altar.
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-amber-600 font-bold">•</span>
                      <span>
                        <strong>Natural Fragrances & Chandan:</strong> Store in a cool, dry place away from direct heat or sunlight. Keep containers tightly sealed after daily worship.
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-amber-600 font-bold">•</span>
                      <span>
                        <strong>Idols & Brassware:</strong> Wipe gently with a soft dry cotton cloth. Handle with clean hands in a spirit of devotion and purity.
                      </span>
                    </li>
                  </ul>
                </div>
              )}

              {activeTab === "shipping" && (
                <div className="max-w-3xl space-y-3.5 text-xs sm:text-sm text-stone-700 leading-relaxed">
                  <h3 className="font-serif text-base sm:text-lg font-bold text-[#166F77]">
                    Dispatch & Transparent Policy
                  </h3>
                  <div className="space-y-2.5">
                    <div className="p-3 rounded-xl bg-teal-50/60 border border-teal-200/80">
                      <p className="font-bold text-[#166F77] text-xs sm:text-sm">
                        Free shipping on orders above ₹299
                      </p>
                      <p className="text-[11px] sm:text-xs text-stone-600 mt-0.5">
                        Orders under ₹299 have a nominal flat delivery charge of ₹49 pan-India.
                      </p>
                    </div>

                    <ul className="space-y-1.5 pl-2">
                      <li className="flex items-start gap-2">
                        <span className="text-[#166F77] font-bold">•</span>
                        <span>
                          <strong>Dispatch Timeline:</strong> Orders are hand-packed with temple reverence and
                          dispatched within 24 to 48 hours directly from Vrindavan Dham.
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-[#166F77] font-bold">•</span>
                        <span>
                          <strong>Courier Partners:</strong> Delivered via trusted logistics partners including
                          DTDC, Delhivery, Shree Maruti, and Blue Dart.
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-[#166F77] font-bold">•</span>
                        <span>
                          <strong>7-Day Returns:</strong> Return or replacement claims are accepted within 7 days
                          of delivery for unused items in their original sacred packaging.
                        </span>
                      </li>
                    </ul>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Customer Reviews Section */}
          <section id="reviews-section" className="mt-10 sm:mt-14 border-t border-[#E7E1D6] pt-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
              <div>
                <p className="text-[10px] sm:text-xs uppercase tracking-[.22em] text-[#166F77] font-semibold mb-0.5">
                  Verified Devotee Feedback
                </p>
                <h2 className="font-serif text-xl sm:text-2xl font-bold text-[#2B211C]">Customer Reviews</h2>
              </div>
              {reviewsList.length > 0 && (
                <div className="flex items-center gap-2.5 bg-white px-3.5 py-2 rounded-xl border border-[#E7E1D6] shadow-xs">
                  <div className="flex items-center text-amber-500 gap-0.5">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star
                        key={s}
                        className={`h-3.5 w-3.5 ${
                          s <= Math.round(avgRating)
                            ? "fill-amber-400 text-amber-400"
                            : "text-slate-200 fill-slate-200"
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-xs sm:text-sm font-bold text-stone-900">{avgRating.toFixed(1)} / 5.0</span>
                  <span className="text-[11px] text-stone-500">
                    ({reviewsList.length} verified review{reviewsList.length === 1 ? "" : "s"})
                  </span>
                </div>
              )}
            </div>

            {loadingReviews ? (
              <div className="p-6 text-center text-xs text-stone-500">Loading verified reviews...</div>
            ) : reviewsList.length === 0 ? (
              <div className="bg-white rounded-2xl border border-[#E7E1D6] p-6 text-center max-w-xl mx-auto space-y-2 shadow-xs">
                <Star className="h-7 w-7 mx-auto text-amber-400/60" />
                <h3 className="font-serif font-bold text-sm sm:text-base text-[#2B211C]">No Verified Reviews Yet</h3>
                <p className="text-xs text-stone-500 leading-relaxed">
                  Reviews are exclusively shared by devotees who have received this sacred item from Vrindavan Dham.
                  Your heartfelt experience will appear here once submitted.
                </p>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 gap-3.5">
                {reviewsList.map((rev) => (
                  <div
                    key={rev._id}
                    className="bg-white rounded-xl border border-[#E7E1D6] p-4 shadow-xs space-y-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="h-7 w-7 rounded-full bg-teal-50 border border-teal-200 text-teal-800 font-bold grid place-items-center text-xs">
                          {(rev.customerName || "D").charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="text-xs sm:text-sm font-semibold text-stone-900 flex items-center gap-1.5">
                            <span>{rev.customerName || "Devotee"}</span>
                            <span className="inline-flex items-center gap-0.5 text-[9.5px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded-full">
                              <Check className="h-2.5 w-2.5 stroke-[3]" /> Verified Purchase
                            </span>
                          </div>
                          <div className="text-[10px] text-stone-400">
                            {new Date(rev.createdAt).toLocaleDateString("en-IN", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center text-amber-400 gap-0.5">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star
                            key={s}
                            className={`h-3 w-3 ${
                              s <= (rev.rating || 5)
                                ? "fill-amber-400 text-amber-400"
                                : "text-stone-200 fill-stone-200"
                            }`}
                          />
                        ))}
                      </div>
                    </div>

                    <p className="text-xs sm:text-sm text-stone-700 leading-relaxed font-sans">{rev.comment}</p>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Related Products Section */}
          {related.length > 0 && (
            <section className="mt-12 sm:mt-16 border-t border-[#E7E1D6] pt-8">
              <div className="mb-4 sm:mb-5">
                <p className="text-[10px] sm:text-xs uppercase tracking-[0.2em] text-[#166F77] font-semibold mb-0.5">
                  Sacred Companions
                </p>
                <h2 className="font-serif text-xl sm:text-2xl font-bold text-[#2B211C]">You May Also Like</h2>
                <p className="text-xs text-stone-500 mt-0.5">Explore more devotional essentials from Vrindavan</p>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {related.map((p) => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </div>
            </section>
          )}

          {/* Recently Viewed Products */}
          {recentlyViewed.length > 0 && (
            <section className="mt-12 border-t border-[#E7E1D6] pt-8">
              <div className="mb-4 sm:mb-5">
                <p className="text-[10px] sm:text-xs uppercase tracking-[0.2em] text-[#166F77] font-semibold mb-0.5">
                  Continue Exploring
                </p>
                <h2 className="font-serif text-xl sm:text-2xl font-bold text-[#2B211C]">Recently Viewed</h2>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {recentlyViewed.map((item) => (
                  <ProductCard key={item.id} product={item} />
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Fullscreen Lightbox Modal */}
        {lightboxOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 animate-in fade-in duration-200"
            onClick={() => setLightboxOpen(false)}
          >
            <div
              className="relative max-w-4xl max-h-[90vh] w-full bg-white rounded-2xl p-4 sm:p-6 overflow-hidden flex flex-col items-center"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => setLightboxOpen(false)}
                className="absolute top-3 right-3 sm:top-4 sm:right-4 z-10 grid h-8 w-8 sm:h-9 sm:w-9 place-items-center rounded-full bg-stone-100 text-stone-700 hover:bg-stone-200 transition"
                aria-label="Close image viewer"
              >
                <X className="h-4 w-4" />
              </button>

              <div className="w-full h-[60vh] sm:h-[70vh] flex items-center justify-center">
                <img src={displayImg} alt={product.name} className="max-h-full max-w-full object-contain" />
              </div>

              {gallery.length > 1 && (
                <div className="flex items-center gap-2 mt-3 overflow-x-auto max-w-full pb-1">
                  {gallery.map((img, i) => (
                    <button
                      key={img + i}
                      type="button"
                      onClick={() => setSelectedImage(img)}
                      className={`h-11 w-11 rounded-lg border overflow-hidden p-0.5 transition ${
                        selectedImage === img ? "border-[#166F77] ring-2 ring-[#166F77]" : "border-stone-200 opacity-60"
                      }`}
                    >
                      <img src={img} alt="" className="h-full w-full object-contain" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Mobile Sticky Bottom Purchase Bar (Side-by-Side 50/50 CTAs) */}
        {product.stock > 0 && (
          <div
            className={`fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-[#E7E1D6] px-3 pt-2.5 md:hidden shadow-[0_-4px_16px_rgba(0,0,0,0.06)] transition-transform duration-300 ${
              showStickyBar ? "translate-y-0" : "translate-y-full pointer-events-none"
            }`}
            style={{ paddingBottom: "max(0.65rem, env(safe-area-inset-bottom))" }}
          >
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  addToCart(product.id, qty);
                  toast.success(`Added ${qty} to cart`);
                }}
                className="h-11 rounded-xl border border-[#166F77] bg-white text-xs font-semibold text-[#166F77] active:scale-[0.98] transition flex items-center justify-center gap-1.5 shadow-xs"
              >
                <ShoppingBag className="h-3.5 w-3.5" />
                <span>Add to Cart</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  buyNow(product.id, qty);
                  nav({ to: "/checkout" });
                }}
                className="h-11 rounded-xl bg-[#166F77] text-xs font-semibold text-white shadow-sm active:scale-[0.98] transition flex items-center justify-center gap-1"
              >
                <span>Buy Now</span>
                <span className="opacity-90 font-normal">({formatINR(product.price * qty)})</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
