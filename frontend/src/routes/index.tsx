import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useRef, useState, useCallback, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { ProductCard } from "@/components/ProductCard";
import { useStore, type Category } from "@/lib/store";
import { type Product } from "@/lib/products";
import heroKrishna from "@/assets/hero-krishna.jpg";
import { DEFAULT_DESCRIPTION, DEFAULT_TITLE, pageSeo } from "@/lib/seo";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

const homeHero = "/home-devotional-hero.png";

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
            "Sacred essentials from Vrindavan: authentic Tulsi mala, Chandan, Itra, and Puja items.",
        }),
      },
    ],
  }),
});

function Home() {
  const { adminProducts, categoryTree, settings, isSettingsLoaded, isProductsLoaded } = useStore();

  const [heroImageLoaded, setHeroImageLoaded] = useState(false);
  const [storyImageLoaded, setStoryImageLoaded] = useState(false);

  // Hero image determination:
  // If settings configured an image, use it. If settings finished and none configured, use fallback.
  // While settings are resolving, do NOT render the fallback image so it doesn't flash.
  const configuredHero = settings?.homeHeroImage?.trim();
  const isHeroKnown = Boolean(configuredHero) || isSettingsLoaded;
  const targetHeroSrc = configuredHero || (isSettingsLoaded ? homeHero : null);

  // Vrindavan story image determination:
  const configuredStory = settings?.vrindavanStoryImage?.trim();
  const isStoryKnown = Boolean(configuredStory) || isSettingsLoaded;
  const targetStorySrc = configuredStory || (isSettingsLoaded ? heroKrishna : null);

  const categoryShelves = useMemo(
    () =>
      categoryTree
        .map((category) => {
          const names = [category.name, ...category.children.map((child) => child.name)];
          const products = adminProducts
            .filter((product) => names.includes(product.category))
            .sort(
              (a, b) => Number(!!b.featuredDeal) - Number(!!a.featuredDeal) || b.rating - a.rating,
            );
          return { category, products };
        })
        .filter((shelf) => shelf.products.length > 0),
    [adminProducts, categoryTree],
  );

  return (
    <Layout>
      {/* 1. HERO SECTION */}
      <section className="relative overflow-hidden border-b border-[#E7E1D6] bg-[#FFFFF4] py-10 md:py-16 lg:py-20">
        {/* Subtle decorative background glow */}
        <div className="pointer-events-none absolute -left-40 top-1/2 h-96 w-96 -translate-y-1/2 rounded-full bg-[#D9A441]/5 blur-3xl" />
        <div className="pointer-events-none absolute right-0 top-0 h-96 w-96 rounded-full bg-[#166F77]/5 blur-3xl" />

        <div className="container-app relative grid items-center gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:gap-14">
          <div className="flex flex-col justify-center text-left">
            <div className="inline-flex items-center gap-2">
              <span className="h-px w-6 bg-[#D9A441]" />
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#166F77]">
                From the Heart of Vrindavan
              </p>
            </div>

            <h1 className="mt-3 font-serif text-3xl font-semibold leading-[1.15] text-[#2B211C] sm:text-5xl lg:text-[3.4rem]">
              Shri Radha Govind Store
            </h1>

            <p className="mt-4 max-w-xl text-sm leading-relaxed text-[#6A605A] sm:text-base">
              Authentic devotional essentials, thoughtfully sourced from Vrindavan.
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-3 sm:gap-4">
              <Link
                to="/shop"
                className="inline-flex h-11 sm:h-12 items-center justify-center rounded-xl bg-[#166F77] px-6 sm:px-8 text-xs sm:text-sm font-semibold text-white shadow-sm transition hover:bg-[#135E65] active:scale-[0.99]"
              >
                Shop Sacred Collection
              </Link>
              <a
                href="#vrindavan-story"
                className="inline-flex h-11 sm:h-12 items-center justify-center rounded-xl border border-[#E7E1D6] bg-transparent px-5 sm:px-7 text-xs sm:text-sm font-medium text-[#2B211C] transition hover:border-[#D9A441] hover:bg-[#F8F4EC] active:scale-[0.99]"
              >
                Our Vrindavan Story
              </a>
            </div>

            {/* Compact footnote trust stats */}
            <div className="mt-8 border-t border-[#E7E1D6]/80 pt-5">
              <div className="flex flex-wrap items-center gap-6 sm:gap-12">
                <div>
                  <div className="text-base sm:text-lg font-bold text-[#2B211C]">50K+</div>
                  <div className="text-[10px] sm:text-[11px] uppercase tracking-wider text-[#6A605A]">
                    Devotees
                  </div>
                </div>
                <div className="h-6 w-px bg-[#E7E1D6]" />
                <div>
                  <div className="text-base sm:text-lg font-bold text-[#2B211C]">4.9 / 5</div>
                  <div className="text-[10px] sm:text-[11px] uppercase tracking-wider text-[#6A605A]">
                    Customer Rating
                  </div>
                </div>
                <div className="h-6 w-px bg-[#E7E1D6]" />
                <div>
                  <div className="text-base sm:text-lg font-bold text-[#2B211C]">100%</div>
                  <div className="text-[10px] sm:text-[11px] uppercase tracking-wider text-[#6A605A]">
                    Authentic Sacred Items
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="relative">
            <div className="soft-shadow overflow-hidden rounded-2xl border border-[#E7E1D6] bg-white p-2">
              <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl bg-[#FAF5EE]">
                {/* Neutral devotional placeholder while settings are resolving or image is downloading */}
                {(!isHeroKnown || !heroImageLoaded) && (
                  <div
                    className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-[#FFFDF8] via-[#FAF4EA] to-[#F2E8DA] p-4 text-center select-none"
                    aria-hidden="true"
                  >
                    <div className="h-9 w-9 rounded-full border-2 border-[#D9A441]/30 border-t-[#D9A441] animate-spin mb-2" />
                    <span className="text-[11px] font-serif font-semibold tracking-wider text-[#7A4D20]/60">
                      ॥ श्री राधा गोविन्द ॥
                    </span>
                  </div>
                )}

                {/* Hero Image renders ONLY once the authoritative URL is known */}
                {targetHeroSrc && (
                  <img
                    src={targetHeroSrc}
                    alt="Shri Radha Govind Store devotional collection from Vrindavan"
                    fetchPriority="high"
                    loading="eager"
                    decoding="async"
                    width={800}
                    height={600}
                    onLoad={() => setHeroImageLoaded(true)}
                    className={`aspect-[4/3] w-full rounded-xl object-cover object-center transition-opacity duration-300 ${
                      heroImageLoaded ? "opacity-100" : "opacity-0"
                    }`}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. PRODUCT SECTIONS (Horizontal Carousels / Sliders) */}
      {!isProductsLoaded && categoryShelves.length === 0 ? (
        <>
          <ProductShelfSkeleton isAlternate={false} categoryName="Tulsi Mala" />
          <ProductShelfSkeleton isAlternate={true} categoryName="Puja Essentials" />
        </>
      ) : (
        categoryShelves.map(({ category, products }, index) => (
          <ProductShelfCarousel
            key={category.id}
            category={category}
            products={products}
            isAlternate={index % 2 === 1}
          />
        ))
      )}

      {/* 4. VRINDAVAN STORY SECTION (Short & Compact) */}
      <section
        id="vrindavan-story"
        className="scroll-mt-24 border-b border-[#E7E1D6] bg-[#FAF4EE] py-8 md:py-10"
      >
        <div className="container-app">
          <div className="grid items-center gap-6 md:grid-cols-[280px_1fr] lg:grid-cols-[340px_1fr] lg:gap-10">
            <div className="soft-shadow overflow-hidden rounded-xl border border-[#E7E1D6] bg-white p-1.5">
              <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg bg-[#FAF5EE]">
                {(!isStoryKnown || !storyImageLoaded) && (
                  <div
                    className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[#FFFDF8] via-[#FAF4EA] to-[#F2E8DA] select-none"
                    aria-hidden="true"
                  >
                    <div className="h-7 w-7 rounded-full border-2 border-[#D9A441]/30 border-t-[#D9A441] animate-spin" />
                  </div>
                )}
                {targetStorySrc && (
                  <img
                    src={targetStorySrc}
                    alt="Shri Radha Govind Vrindavan"
                    loading="lazy"
                    decoding="async"
                    width={680}
                    height={510}
                    onLoad={() => setStoryImageLoaded(true)}
                    className={`aspect-[4/3] w-full rounded-lg object-cover transition-opacity duration-300 ${
                      storyImageLoaded ? "opacity-100" : "opacity-0"
                    }`}
                  />
                )}
              </div>
            </div>

            <div className="flex flex-col justify-center">
              <div className="inline-flex items-center gap-2">
                <span className="h-px w-5 bg-[#D9A441]" />
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#166F77]">
                  A Little Piece of Vrindavan
                </p>
              </div>

              <h2 className="mt-1 font-serif text-2xl font-semibold text-[#2B211C] sm:text-3xl">
                From our home to yours
              </h2>

              <p className="mt-2 text-xs leading-relaxed text-[#6A605A] sm:text-sm">
                Located in the sacred precincts of Madan Mohan Ghera in Vrindavan, Shri Radha Govind Store brings authentic, consecrated devotional essentials directly from local Braj artisans to your sacred altar. Every mala, poshak, and fragrance is prepared with heartfelt seva and pure devotion.
              </p>

              <div className="mt-4 flex items-center gap-3">
                <Link
                  to="/about"
                  className="inline-flex h-9 items-center justify-center rounded-lg bg-[#166F77] px-4 text-xs font-semibold text-white shadow-sm transition hover:bg-[#135E65]"
                >
                  Read Our Story
                </Link>
                <Link
                  to="/contact"
                  className="inline-flex h-9 items-center justify-center rounded-lg border border-[#E7E1D6] bg-white px-4 text-xs font-medium text-[#2B211C] transition hover:border-[#D9A441]"
                >
                  Visit in Vrindavan
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
}

function ProductShelfCarousel({
  category,
  products,
  isAlternate,
}: {
  category: Category;
  products: Product[];
  isAlternate: boolean;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isPaused, setIsPaused] = useState(false);
  const pauseTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Resume autoplay after user interaction ceases
  const scheduleResume = useCallback(() => {
    if (pauseTimeoutRef.current) clearTimeout(pauseTimeoutRef.current);
    pauseTimeoutRef.current = setTimeout(() => {
      setIsPaused(false);
    }, 3500);
  }, []);

  const pauseAutoplay = useCallback(() => {
    if (pauseTimeoutRef.current) clearTimeout(pauseTimeoutRef.current);
    setIsPaused(true);
  }, []);

  const scroll = useCallback(
    (direction: "left" | "right") => {
      if (!scrollRef.current) return;
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      const step = Math.max(145, Math.min(Math.floor(clientWidth * 0.75), 260));

      if (direction === "right") {
        if (scrollLeft + clientWidth >= scrollWidth - 15) {
          scrollRef.current.scrollTo({ left: 0, behavior: "smooth" });
        } else {
          scrollRef.current.scrollBy({ left: step, behavior: "smooth" });
        }
      } else {
        if (scrollLeft <= 10) {
          scrollRef.current.scrollTo({ left: scrollWidth - clientWidth, behavior: "smooth" });
        } else {
          scrollRef.current.scrollBy({ left: -step, behavior: "smooth" });
        }
      }
    },
    [],
  );

  // Autoplay loop with smooth slide interval
  useEffect(() => {
    if (products.length <= 1 || isPaused) return;

    const interval = setInterval(() => {
      scroll("right");
    }, 3800);

    return () => clearInterval(interval);
  }, [products.length, isPaused, scroll]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (pauseTimeoutRef.current) clearTimeout(pauseTimeoutRef.current);
    };
  }, []);

  const handleArrowClick = (direction: "left" | "right") => {
    pauseAutoplay();
    scroll(direction);
    scheduleResume();
  };

  const bgClass = isAlternate ? "bg-[#FAF4EE]" : "bg-[#FFFFF4]";

  return (
    <section
      className={`border-b border-[#E7E1D6] ${bgClass} py-6 md:py-8`}
      onMouseEnter={pauseAutoplay}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={pauseAutoplay}
      onTouchEnd={scheduleResume}
    >
      <div className="container-app">
        {/* Section Header */}
        <div className="flex items-end justify-between gap-3 border-b border-[#E7E1D6] pb-2.5">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#D9A441]">
              TOP PICKS
            </p>
            <h2 className="mt-0.5 font-serif text-xl font-semibold text-[#2B211C] sm:text-2xl">
              Best of {category.name}
            </h2>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            {products.length > 1 && (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleArrowClick("left")}
                  className="grid h-7 w-7 place-items-center rounded-full border border-[#E7E1D6] bg-white text-[#2B211C] shadow-sm transition hover:border-[#166F77] hover:text-[#166F77] hover:bg-[#F8F4EC] active:scale-95"
                  aria-label={`Scroll ${category.name} left`}
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => handleArrowClick("right")}
                  className="grid h-7 w-7 place-items-center rounded-full border border-[#E7E1D6] bg-white text-[#2B211C] shadow-sm transition hover:border-[#166F77] hover:text-[#166F77] hover:bg-[#F8F4EC] active:scale-95"
                  aria-label={`Scroll ${category.name} right`}
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
            <Link
              to="/shop"
              search={{ cat: category.name } as never}
              className="group inline-flex items-center gap-1 text-xs font-semibold text-[#166F77] hover:text-[#135E65]"
            >
              <span>See all {category.name}</span>
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
        </div>

        {/* Single Horizontal Row Carousel / Slider (desktop ~4-5, tablet ~3, mobile ~1.5-2) */}
        <div
          ref={scrollRef}
          onScroll={pauseAutoplay}
          className="mt-4 flex min-h-[270px] sm:min-h-[350px] snap-x snap-mandatory gap-2.5 sm:gap-3.5 overflow-x-auto scroll-smooth py-1 px-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {products.map((product) => (
            <div
              key={product.id}
              className="w-[145px] min-[360px]:w-[155px] min-[390px]:w-[165px] sm:w-[185px] md:w-[205px] lg:w-[225px] shrink-0 snap-start"
            >
              <ProductCard product={product} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ProductShelfSkeleton({ isAlternate, categoryName }: { isAlternate: boolean; categoryName: string }) {
  const bgClass = isAlternate ? "bg-[#FAF4EE]" : "bg-[#FFFFF4]";

  return (
    <section className={`border-b border-[#E7E1D6] ${bgClass} py-6 md:py-8`}>
      <div className="container-app">
        {/* Section Header Skeleton */}
        <div className="flex items-end justify-between gap-3 border-b border-[#E7E1D6] pb-2.5">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#D9A441]">
              TOP PICKS
            </p>
            <h2 className="mt-0.5 font-serif text-xl font-semibold text-[#2B211C] sm:text-2xl">
              Best of {categoryName}
            </h2>
          </div>
          <div className="h-4 w-28 rounded bg-[#E7E1D6]/60 animate-pulse" />
        </div>

        {/* Carousel Row Skeleton matching card widths */}
        <div className="mt-4 flex min-h-[270px] sm:min-h-[350px] gap-2.5 sm:gap-3.5 overflow-hidden py-1 px-0.5">
          {[1, 2, 3, 4, 5].map((idx) => (
            <div
              key={idx}
              className="w-[145px] min-[360px]:w-[155px] min-[390px]:w-[165px] sm:w-[185px] md:w-[205px] lg:w-[225px] shrink-0"
            >
              <div className="rounded-xl border border-[#E7E1D6] bg-white p-2 sm:p-2.5 shadow-sm">
                <div className="aspect-square w-full rounded-lg bg-[#FAF4EA] animate-pulse" />
                <div className="mt-2.5 h-3.5 w-4/5 rounded bg-[#FAF4EA] animate-pulse" />
                <div className="mt-1.5 h-3 w-3/5 rounded bg-[#FAF4EA] animate-pulse" />
                <div className="mt-3 flex items-center justify-between">
                  <div className="h-4 w-12 rounded bg-[#FAF4EA] animate-pulse" />
                  <div className="h-7 w-16 rounded bg-[#FAF4EA] animate-pulse" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

