import { useEffect, useRef, useState, useCallback } from "react";
import { ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import { API_URL } from "@/lib/api";

export interface GoogleReviewItem {
  id: string;
  authorName: string;
  authorPhoto?: string;
  authorProfile?: string;
  authorReviewCount?: string;
  rating: number;
  relativeTime: string;
  text: string;
}

export interface GoogleReviewsData {
  businessName: string;
  rating: number;
  totalReviews: number;
  ratingText: string;
  mapsUrl: string;
  writeReviewUrl: string;
  reviews: GoogleReviewItem[];
}

// Fallback verified snapshot matching the official Google Business listing
const INITIAL_GOOGLE_DATA: GoogleReviewsData = {
  businessName: "Shri Radha Govind Store",
  rating: 4.5,
  totalReviews: 6,
  ratingText: "EXCELLENT",
  mapsUrl:
    "https://www.google.com/maps/place/Shri+Radha+Govind+Store/@27.5791339,77.6873286,16.48z/data=!4m6!3m5!1s0x39736f0f630f3391:0x962a506da187fa78!8m2!3d27.5789022!4d77.6877274!16s%2Fg%2F11xm_fb7ts",
  writeReviewUrl:
    "https://search.google.com/local/writereview?placeid=ChIJkTMPYw9vczkRePqHoW1QKpY",
  reviews: [
    {
      id: "Ci9DQUlRQUNvZENodHljRjlvT2xkR1dHWTJiakZ0TjI1blVVdHJNamRMV25GUmRIYxAB",
      authorName: "Bablu Bablu sen",
      authorPhoto:
        "https://lh3.googleusercontent.com/a/ACg8ocJgAOSrVon_vY6wjv5Xmgab4g1Zu8ZcD-ic625CueMo9xfg4g=s120-c-rp-mo-br100",
      authorProfile:
        "https://www.google.com/maps/contrib/117083500659318663776?hl=en-GB",
      authorReviewCount: "2 reviews",
      rating: 4,
      relativeTime: "a year ago",
      text: "Authentic product and fast delivery service. Very cheap price of every product. Must buy without any hesitation.",
    },
    {
      id: "Ci9DQUlRQUNvZENodHljRjlvT214SlN6azRZMVJOY0VGbmFWWXlXbFIwU2xsc2ExRRAB",
      authorName: "Rohit Pal",
      authorPhoto:
        "https://lh3.googleusercontent.com/a-/ALV-UjUenoJEULVapxupxizdHGleUxwb2wu4n61G6z4F2DEwkRd3QPi3=s120-c-rp-mo-br100",
      authorProfile:
        "https://www.google.com/maps/contrib/104999181175635627992?hl=en-GB",
      authorReviewCount: "1 review",
      rating: 5,
      relativeTime: "a year ago",
      text: "Best and authentic product for buying...\nMust buy",
    },
    {
      id: "Ci9DQUlRQUNvZENodHljRjlvT25SNk56bGhhMlJHYjFCTFQyVjVaM0ZSYkVsWFoyYxAB",
      authorName: "Neeraj Verma",
      authorPhoto:
        "https://lh3.googleusercontent.com/a/ACg8ocLXEQ5MAkcr5sCnMJh_arBkYfIzLFzWxCWlrXLGZd7JBZsj5g=s120-c-rp-mo-br100",
      authorProfile:
        "https://www.google.com/maps/contrib/117768216570012339632?hl=en-GB",
      authorReviewCount: "1 review",
      rating: 4,
      relativeTime: "a year ago",
      text: "Nice gopi dress and dhoti kurta 🥰🥰",
    },
    {
      id: "Ci9DQUlRQUNvZENodHljRjlvT21ScVZWZHBPRUl0VHpkNExWVmxhekF3U21ZM2RGRRAB",
      authorName: "Giridhari Das",
      authorPhoto:
        "https://lh3.googleusercontent.com/a-/ALV-UjVyN5M1-eE1T7mnXiQ_ycJQvTX7H_8iL_mEj89Pf_kAsfTAJgp9=s120-c-rp-mo-br100",
      authorProfile:
        "https://www.google.com/maps/contrib/116419968368120587316?hl=en-GB",
      authorReviewCount: "1 review",
      rating: 5,
      relativeTime: "a year ago",
      text: "Sbse saste products or bahut fast delivery h. Mujhe abhi tk pta nhi tha is website ke bare me but bahut acha experience rha best product milte..",
    },
    {
      id: "Ci9DQUlRQUNvZENodHljRjlvT2xsZk56Qm9jalJZYUVOSVZETTRXaTE0U1VkcWVIYxAB",
      authorName: "Pavan Yadav",
      authorPhoto:
        "https://lh3.googleusercontent.com/a-/ALV-UjVrZ6FteZ4EBtFyG6S_ETl0hY1ZidXmeElkQ3jxXH5unX7wMGQvLA=s120-c-rp-mo-br100",
      authorProfile:
        "https://www.google.com/maps/contrib/107877779457733814391?hl=en-GB",
      authorReviewCount: "5 reviews",
      rating: 5,
      relativeTime: "a year ago",
      text: "Bahut acha saman milta h",
    },
    {
      id: "Ci9DQUlRQUNvZENodHljRjlvT25GWFIxVlZMVTQzWWxnMWMzRXdOazQwV2s1TWNVRRAB",
      authorName: "Amar singh Pal",
      authorPhoto:
        "https://lh3.googleusercontent.com/a/ACg8ocIjWU_2JvVpTWMPgYYvKyxEBP6Jq5mj1wUVT39VtSNtNk7XSA=s120-c-rp-mo-br100",
      authorProfile:
        "https://www.google.com/maps/contrib/112117651686513431002?hl=en-GB",
      authorReviewCount: "1 review",
      rating: 4,
      relativeTime: "a year ago",
      text: "बहुत अच्छा यहां पर बहुत ही अच्छा सामान मिलता है।",
    },
  ],
};

// Official Google Multi-Color Wordmark
function GoogleWordmark({ className = "h-8" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 272 92"
      className={className}
      aria-label="Google"
      role="img"
    >
      <path
        fill="#EA4335"
        d="M115.75 47.18c0 12.77-9.99 22.18-22.25 22.18s-22.25-9.41-22.25-22.18C71.25 34.32 81.24 25 93.5 25s22.25 9.32 22.25 22.18zm-9.74 0c0-7.98-5.79-13.44-12.51-13.44S80.99 39.2 80.99 47.18c0 7.9 5.79 13.44 12.51 13.44s12.51-5.55 12.51-13.44z"
      />
      <path
        fill="#FBBC05"
        d="M163.75 47.18c0 12.77-9.99 22.18-22.25 22.18s-22.25-9.41-22.25-22.18c0-12.85 9.99-22.18 22.25-22.18s22.25 9.32 22.25 22.18zm-9.74 0c0-7.98-5.79-13.44-12.51-13.44s-12.51 5.46-12.51 13.44c0 7.9 5.79 13.44 12.51 13.44s12.51-5.55 12.51-13.44z"
      />
      <path
        fill="#4285F4"
        d="M209.75 26.34v39.82c0 16.38-9.66 23.07-21.08 23.07-10.75 0-17.22-7.19-19.66-13.07l8.48-3.53c1.51 3.61 5.21 8.16 11.18 8.16 7.31 0 11.85-4.53 11.85-13.07v-3.19h-.34c-2.18 2.69-6.38 5.04-11.68 5.04-11.09 0-21.25-9.66-21.25-22.09 0-12.52 10.16-22.26 21.25-22.26 5.29 0 9.49 2.35 11.68 4.96h.34v-3.86h9.93zm-8.99 21.01c0-7.82-5.21-13.62-11.85-13.62-6.81 0-12.51 5.8-12.51 13.62 0 7.73 5.7 13.44 12.51 13.44 6.64 0 11.85-5.71 11.85-13.44z"
      />
      <path fill="#34A853" d="M225 3v65h-9.5V3h9.5z" />
      <path
        fill="#EA4335"
        d="M262.02 54.48l7.56 5.04c-2.44 3.61-8.32 9.83-18.48 9.83-12.6 0-22.01-9.74-22.01-22.18 0-13.19 9.49-22.18 20.92-22.18 11.51 0 17.14 9.16 18.98 14.11l1.01 2.52-29.65 12.28c2.27 4.45 5.8 6.72 10.75 6.72 4.96 0 8.4-2.44 10.92-6.14zm-23.27-7.98l19.82-8.23c-1.09-2.77-4.37-4.7-8.23-4.7-4.95 0-11.84 4.37-11.59 12.93z"
      />
      <path
        fill="#4285F4"
        d="M35.29 41.41V32h33.85c.34 1.77.5 3.79.5 6.22 0 7.64-2.09 17.06-8.91 23.86-6.64 6.89-15.62 10.6-26.94 10.6C15.42 72.68 0 56.4 0 36.34 0 16.28 15.42 0 33.79 0c9.92 0 17.39 3.86 22.85 9.07l-6.47 6.47c-3.95-3.69-9.24-6.55-16.38-6.55-13.36 0-23.86 10.84-23.86 24.2s10.5 24.2 23.86 24.2c8.65 0 13.53-3.45 16.63-6.55 1.73-1.73 2.87-4.18 3.32-7.48H35.29v.01z"
      />
    </svg>
  );
}

// Google 4-color 'G' icon for review cards
function GoogleGIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.34 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.27a7.195 7.195 0 0 1 0-4.54V6.58H1.25a11.986 11.986 0 0 0 0 10.84l4.03-3.15z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
      />
    </svg>
  );
}

// Blue Verified Badge Icon matching the uploaded reference badge
function VerifiedBadge({ className = "h-4 w-4 sm:h-[18px] sm:w-[18px]" }: { className?: string }) {
  return (
    <img
      src="/google-verified-badge.png"
      alt=""
      width={18}
      height={18}
      loading="lazy"
      decoding="async"
      className={`${className} inline-block shrink-0 select-none object-contain`}
      aria-hidden="true"
    />
  );
}

// Subtle decorative wavy contour line pattern matching the reference screenshot
function CardWavePattern() {
  return (
    <svg
      className="pointer-events-none absolute right-0 top-0 h-full w-[180px] sm:w-[220px] text-stone-200/50 opacity-60 select-none overflow-hidden"
      viewBox="0 0 200 240"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path d="M50 0C50 65 100 115 160 115C185 115 200 95 200 85" stroke="currentColor" strokeWidth="1" />
      <path d="M30 0C30 80 90 140 165 140C190 140 200 120 200 110" stroke="currentColor" strokeWidth="1" />
      <path d="M10 0C10 95 80 165 170 165C195 165 200 145 200 135" stroke="currentColor" strokeWidth="1" />
      <path d="M-10 0C-10 110 70 190 175 190C195 190 200 170 200 160" stroke="currentColor" strokeWidth="1" />
      <path d="M-30 0C-30 125 60 215 180 215C195 215 200 195 200 185" stroke="currentColor" strokeWidth="1" />
      <path d="M-50 0C-50 140 50 240 185 240" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}

// Star Rating Display (supports full, half, and empty stars)
function StarRating({
  rating,
  starClass = "h-5 w-5",
}: {
  rating: number;
  starClass?: string;
}) {
  return (
    <div className="flex items-center gap-1" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((star) => {
        const isFull = star <= Math.floor(rating);
        const isHalf = !isFull && star === Math.ceil(rating) && rating % 1 >= 0.3;

        if (isFull) {
          return (
            <svg
              key={star}
              viewBox="0 0 24 24"
              className={`${starClass} fill-[#F4B400] text-[#F4B400]`}
              aria-hidden="true"
            >
              <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
            </svg>
          );
        }

        if (isHalf) {
          return (
            <svg
              key={star}
              viewBox="0 0 24 24"
              className={`${starClass} text-[#F4B400]`}
              aria-hidden="true"
            >
              <defs>
                <linearGradient id={`half-star-${star}`}>
                  <stop offset="50%" stopColor="#F4B400" />
                  <stop offset="50%" stopColor="#E2DCD5" />
                </linearGradient>
              </defs>
              <path
                fill={`url(#half-star-${star})`}
                d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"
              />
            </svg>
          );
        }

        return (
          <svg
            key={star}
            viewBox="0 0 24 24"
            className={`${starClass} fill-[#E2DCD5] text-[#E2DCD5]`}
            aria-hidden="true"
          >
            <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
          </svg>
        );
      })}
    </div>
  );
}

// User Initials Avatar Fallback
function InitialsAvatar({ name }: { name: string }) {
  const parts = name.trim().split(/\s+/);
  const initials =
    parts.length > 1
      ? `${parts[0][0]}${parts[1][0]}`.toUpperCase()
      : (parts[0]?.[0] || "U").toUpperCase();

  return (
    <div
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-stone-100 font-sans text-xs font-bold text-stone-700 border border-stone-200"
      aria-hidden="true"
    >
      {initials}
    </div>
  );
}

export function GoogleReviewsSection() {
  const [data, setData] = useState<GoogleReviewsData>(INITIAL_GOOGLE_DATA);
  const [activeSlide, setActiveSlide] = useState(0);

  const scrollRef = useRef<HTMLDivElement>(null);
  const [isPaused, setIsPaused] = useState(false);
  const pauseTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch verified reviews from backend API on mount
  useEffect(() => {
    let isMounted = true;
    async function loadReviews() {
      try {
        const base = API_URL.startsWith("http")
          ? API_URL
          : `https://www.shriradhagovindstore.com${API_URL}`;

        const res = await fetch(`${base}/reviews/google`, {
          headers: { Accept: "application/json" },
        });

        if (!res.ok) return;
        const json = await res.json();
        if (isMounted && json && Array.isArray(json.reviews) && json.reviews.length > 0) {
          setData(json);
        }
      } catch {
        // Keeps verified INITIAL_GOOGLE_DATA on fetch error
      }
    }

    loadReviews();
    return () => {
      isMounted = false;
    };
  }, []);

  const resumeAutoplay = useCallback(() => {
    if (pauseTimeoutRef.current) clearTimeout(pauseTimeoutRef.current);
    pauseTimeoutRef.current = setTimeout(() => {
      setIsPaused(false);
    }, 4500);
  }, []);

  const pauseAutoplay = useCallback(() => {
    if (pauseTimeoutRef.current) clearTimeout(pauseTimeoutRef.current);
    setIsPaused(true);
  }, []);

  const scroll = useCallback((direction: "left" | "right") => {
    if (!scrollRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
    // Step by approximately one card width plus gap
    const cardStep = Math.max(300, Math.floor(clientWidth * 0.85));

    if (direction === "right") {
      if (scrollLeft + clientWidth >= scrollWidth - 10) {
        scrollRef.current.scrollTo({ left: 0, behavior: "smooth" });
      } else {
        scrollRef.current.scrollBy({ left: cardStep, behavior: "smooth" });
      }
    } else {
      if (scrollLeft <= 10) {
        scrollRef.current.scrollTo({ left: scrollWidth - clientWidth, behavior: "smooth" });
      } else {
        scrollRef.current.scrollBy({ left: -cardStep, behavior: "smooth" });
      }
    }
  }, []);

  const handleArrow = (direction: "left" | "right") => {
    pauseAutoplay();
    scroll(direction);
    resumeAutoplay();
  };

  // Update active slide indicator based on scroll position
  const handleScroll = () => {
    if (!scrollRef.current || !data.reviews.length) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
    const maxScroll = scrollWidth - clientWidth;
    if (maxScroll <= 0) {
      setActiveSlide(0);
      return;
    }
    const ratio = Math.max(0, Math.min(1, scrollLeft / maxScroll));
    const idx = Math.round(ratio * (data.reviews.length - 1));
    setActiveSlide(idx);
  };

  // Autoplay cycle
  useEffect(() => {
    if (isPaused || data.reviews.length <= 1) return;
    const interval = setInterval(() => {
      scroll("right");
    }, 5000);

    return () => clearInterval(interval);
  }, [isPaused, data.reviews.length, scroll]);

  useEffect(() => {
    return () => {
      if (pauseTimeoutRef.current) clearTimeout(pauseTimeoutRef.current);
    };
  }, []);

  return (
    <section
      aria-labelledby="google-reviews-heading"
      className="bg-white py-8 sm:py-10 md:py-12 border-b border-stone-200/80 relative overflow-hidden"
      onMouseEnter={pauseAutoplay}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={pauseAutoplay}
      onTouchEnd={resumeAutoplay}
    >
      <div className="container-app max-w-6xl mx-auto px-4 sm:px-6">
        {/* 1. HEADING AREA (Matches reference screenshot hierarchy) */}
        <div className="text-center">
          <h2
            id="google-reviews-heading"
            className="text-xl sm:text-2xl font-bold text-stone-900 tracking-tight"
          >
            Trusted by Devotees & Pilgrims
          </h2>

          <p className="mt-1 text-xs sm:text-sm text-stone-600 font-medium">
            Loved by devotees and pilgrims shopping for devotional essentials from Vrindavan
          </p>

          {/* 2. RATING BLOCK (Tight vertical spacing, large stars, Google logo) */}
          <div className="mt-3.5 sm:mt-4 flex flex-col items-center justify-center gap-1.5">
            <span className="text-base sm:text-lg font-black tracking-wider text-stone-900 uppercase">
              {data.ratingText || "EXCELLENT"}
            </span>

            {/* Substantially larger gold stars */}
            <StarRating rating={data.rating} starClass="h-7 w-7 sm:h-8 sm:w-8" />

            {/* Review Count */}
            <p className="text-xs sm:text-sm text-stone-700">
              Based on{" "}
              <strong className="font-bold text-stone-900">
                {data.totalReviews} reviews
              </strong>
            </p>

            {/* Google Logo */}
            <div className="mt-0.5">
              <GoogleWordmark className="h-7 sm:h-8" />
            </div>
          </div>
        </div>

        {/* 3. REVIEWS CAROUSEL (3 cards visible on desktop, side arrows overlapping edges) */}
        <div className="relative mt-6 sm:mt-8">
          {/* Previous Arrow Button (overlapping left edge) */}
          <button
            type="button"
            onClick={() => handleArrow("left")}
            aria-label="Previous review"
            className="absolute -left-3 sm:-left-5 top-1/2 -translate-y-1/2 z-20 flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-full border border-stone-200/90 bg-white text-stone-700 shadow-md transition-all hover:bg-stone-50 hover:text-stone-900 hover:shadow-lg active:scale-95 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-stone-400"
          >
            <ChevronLeft className="h-5 w-5" strokeWidth={2} />
          </button>

          {/* Next Arrow Button (overlapping right edge) */}
          <button
            type="button"
            onClick={() => handleArrow("right")}
            aria-label="Next review"
            className="absolute -right-3 sm:-right-5 top-1/2 -translate-y-1/2 z-20 flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-full border border-stone-200/90 bg-white text-stone-700 shadow-md transition-all hover:bg-stone-50 hover:text-stone-900 hover:shadow-lg active:scale-95 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-stone-400"
          >
            <ChevronRight className="h-5 w-5" strokeWidth={2} />
          </button>

          {/* Cards Scroll Container */}
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            role="region"
            aria-roledescription="carousel"
            aria-label="Customer Google reviews"
            className="flex gap-4 sm:gap-5 overflow-x-auto scroll-smooth snap-x snap-mandatory scrollbar-none px-1 py-2"
          >
            {data.reviews.map((rev) => (
              <article
                key={rev.id}
                className="w-[88vw] sm:w-[calc(50%-10px)] lg:w-[calc((100%-40px)/3)] shrink-0 snap-start rounded-2xl border border-stone-200/90 bg-white p-5 sm:p-6 shadow-[0_2px_12px_rgba(0,0,0,0.05)] hover:shadow-md transition-shadow relative overflow-hidden flex flex-col justify-start min-h-[220px] sm:min-h-[240px]"
              >
                {/* Subtle decorative wavy contour line pattern */}
                <CardWavePattern />

                {/* Card Header: Avatar, Name, Relative Date & Google G */}
                <div className="relative z-10 flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    {rev.authorPhoto ? (
                      <img
                        src={rev.authorPhoto}
                        alt={rev.authorName}
                        loading="lazy"
                        decoding="async"
                        referrerPolicy="no-referrer"
                        className="h-11 w-11 rounded-full object-cover shrink-0 border border-stone-200"
                        onError={(e) => {
                          const target = e.currentTarget;
                          target.style.display = "none";
                          const fallback = target.nextElementSibling as HTMLElement;
                          if (fallback) fallback.style.display = "flex";
                        }}
                      />
                    ) : null}
                    <div
                      style={{ display: rev.authorPhoto ? "none" : "flex" }}
                      className="shrink-0"
                    >
                      <InitialsAvatar name={rev.authorName} />
                    </div>

                    <div className="min-w-0">
                      <h3 className="font-bold text-sm sm:text-[15px] text-stone-900 leading-snug truncate">
                        {rev.authorName}
                      </h3>
                      <p className="text-xs text-stone-500 mt-0.5">
                        {rev.relativeTime}
                      </p>
                    </div>
                  </div>

                  {/* Top-right: Google 'G' icon */}
                  <div className="shrink-0 pt-0.5">
                    <GoogleGIcon className="h-5 w-5" />
                  </div>
                </div>

                {/* Rating Stars + Blue Verified Badge */}
                <div className="relative z-10 mt-3 flex items-center gap-1.5">
                  <StarRating rating={rev.rating} starClass="h-4 w-4 sm:h-[18px] sm:w-[18px]" />
                  <VerifiedBadge className="h-4 w-4 sm:h-[18px] sm:w-[18px]" />
                </div>

                {/* Review Text: Prominent, comfortable reading font */}
                <div className="relative z-10 mt-3 flex-1">
                  <p className="text-sm sm:text-[15px] text-stone-700 leading-relaxed whitespace-pre-line line-clamp-4">
                    {rev.text || "Rated 5 stars on Google Maps."}
                  </p>
                </div>
              </article>
            ))}
          </div>

          {/* Dots Indicator */}
          {data.reviews.length > 1 && (
            <div className="mt-5 flex items-center justify-center gap-1.5" aria-hidden="true">
              {data.reviews.map((_, i) => (
                <span
                  key={i}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    i === activeSlide ? "w-6 bg-stone-800" : "w-1.5 bg-stone-300"
                  }`}
                />
              ))}
            </div>
          )}
        </div>

        {/* 4. PRIMARY ACTION (Single clean button matching site's teal style) */}
        <div className="mt-6 sm:mt-7 flex items-center justify-center">
          <a
            href={data.writeReviewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#166F77] hover:bg-[#135E65] px-6 text-xs sm:text-sm font-semibold text-white shadow-xs transition active:scale-[0.99] focus-visible:ring-2 focus-visible:ring-[#166F77]"
          >
            Review us on Google <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>
    </section>
  );
}
