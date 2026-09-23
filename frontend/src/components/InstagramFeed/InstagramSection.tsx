import { useRef, useCallback } from "react";
import { ChevronLeft, ChevronRight, Play, Layers } from "lucide-react";

export interface InstagramPost {
  id: string;
  mediaUrl: string;
  permalink: string;
  caption?: string;
  timestamp?: string;
  mediaType?: "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM";
}

const INSTAGRAM_PROFILE_URL = "https://www.instagram.com/shriradhagovind_store/";
const INSTAGRAM_HANDLE = "shriradhagovind_store";

// Verified real public posts from @shriradhagovind_store (retrieved directly from profile)
const DEFAULT_REAL_POSTS: InstagramPost[] = [
  {
    id: "DdL_9kdJXCC",
    mediaUrl: "/instagram/post-1.webp",
    permalink: "https://www.instagram.com/p/DdL_9kdJXCC/",
    caption: "जहाँ नाम है, वहीं शांति है… वहीं मेरा वृंदावन है।",
    timestamp: "12 September 2026",
    mediaType: "IMAGE",
  },
  {
    id: "DdIhrOcxZSc",
    mediaUrl: "/instagram/post-2.webp",
    permalink: "https://www.instagram.com/p/DdIhrOcxZSc/",
    caption: "11 सितंबर — श्री नीम करौली बाबा की महासमाधि दिवस",
    timestamp: "10 September 2026",
    mediaType: "IMAGE",
  },
  {
    id: "DaXqYxqifmo",
    mediaUrl: "/instagram/post-3.jpg",
    permalink: "https://www.instagram.com/p/DaXqYxqifmo/",
    caption: "Our New Website is LIVE!",
    timestamp: "04 July 2026",
    mediaType: "IMAGE",
  },
  {
    id: "DYUdkfCkbRK",
    mediaUrl: "/instagram/post-4.jpg",
    permalink: "https://www.instagram.com/p/DYUdkfCkbRK/",
    caption: "Website Update in Progress",
    timestamp: "14 May 2026",
    mediaType: "IMAGE",
  },
  {
    id: "DYPMCU5kYkZ",
    mediaUrl: "/instagram/post-5.jpg",
    permalink: "https://www.instagram.com/p/DYPMCU5kYkZ/",
    caption: "BIG STORE UPDATE - Tulsi & Chanting Malas",
    timestamp: "12 May 2026",
    mediaType: "IMAGE",
  },
  {
    id: "DWbmiUZEd79",
    mediaUrl: "/instagram/post-6.webp",
    permalink: "https://www.instagram.com/p/DWbmiUZEd79/",
    caption: "New stock updated Laddu Gopal Poshak",
    timestamp: "28 March 2026",
    mediaType: "CAROUSEL_ALBUM",
  },
  {
    id: "DPn5i-GEcE0",
    mediaUrl: "/instagram/post-7.jpg",
    permalink: "https://www.instagram.com/p/DPn5i-GEcE0/",
    caption: "Deep Dan in Shri Vrindavan Dham",
    timestamp: "10 October 2025",
    mediaType: "VIDEO",
  },
];

// Official Instagram Camera Glyph
function InstagramGlyph({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
    </svg>
  );
}

export function InstagramSection({
  initialPosts = DEFAULT_REAL_POSTS,
}: {
  initialPosts?: InstagramPost[];
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const posts = initialPosts;

  const scroll = useCallback((direction: "left" | "right") => {
    if (!scrollRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
    const step = Math.min(260, clientWidth * 0.7);

    if (direction === "right") {
      if (scrollLeft + clientWidth >= scrollWidth - 10) {
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
  }, []);

  const hasPosts = posts.length >= 5;

  return (
    <section
      aria-label="Instagram feed from Shri Radha Govind Store"
      className="border-b border-[#E7E1D6] bg-white py-8 sm:py-10 md:py-12 relative overflow-hidden"
    >
      <div className="container-app max-w-6xl mx-auto px-4 sm:px-6">
        {/* HEADER: Profile/avatar on LEFT, Follow button on RIGHT (Matches Reference Screenshot) */}
        <div className="flex items-center justify-between gap-4 pb-5 sm:pb-6">
          <div className="flex items-center gap-3">
            {/* Colorful Instagram Story Gradient Ring */}
            <a
              href={INSTAGRAM_PROFILE_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Visit Shri Radha Govind Store on Instagram"
              className="p-[2.5px] rounded-full bg-gradient-to-tr from-[#f09433] via-[#dc2743] to-[#bc1888] shrink-0 block transition-transform hover:scale-105 active:scale-95"
            >
              <div className="bg-white p-0.5 rounded-full">
                <img
                  src="/instagram/profile.jpg"
                  alt={INSTAGRAM_HANDLE}
                  width={52}
                  height={52}
                  loading="lazy"
                  decoding="async"
                  className="h-12 w-12 sm:h-13 sm:w-13 rounded-full object-cover"
                />
              </div>
            </a>

            {/* Account Handle + Real Public Statistics */}
            <div>
              <a
                href={INSTAGRAM_PROFILE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="font-sans text-base sm:text-lg font-bold text-stone-900 tracking-tight hover:underline block leading-tight"
              >
                {INSTAGRAM_HANDLE}
              </a>
              <div className="flex items-center gap-3 text-xs sm:text-[13px] text-stone-600 mt-0.5 leading-snug">
                <span>
                  <strong className="font-semibold text-stone-900">39</strong> posts
                </span>
                <span>
                  <strong className="font-semibold text-stone-900">28</strong> followers
                </span>
              </div>
            </div>
          </div>

          {/* Blue Instagram Follow Button on the RIGHT */}
          <div className="shrink-0">
            <a
              href={INSTAGRAM_PROFILE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-9 sm:h-9.5 items-center justify-center gap-2 rounded-lg bg-[#0095F6] hover:bg-[#1877F2] px-4 sm:px-5 text-xs sm:text-sm font-semibold text-white shadow-xs transition active:scale-[0.98] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[#0095F6]"
            >
              <InstagramGlyph className="h-4 w-4" />
              Follow
            </a>
          </div>
        </div>

        {/* POST GRID: 5 posts in one row matching the reference screenshot */}
        {hasPosts ? (
          <div className="relative">
            {/* Circular LEFT arrow overlapping the first post */}
            <button
              type="button"
              onClick={() => scroll("left")}
              aria-label="Previous Instagram posts"
              className="absolute left-1.5 sm:left-3 top-1/2 -translate-y-1/2 z-20 flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-800 shadow-md transition-all hover:bg-stone-50 hover:shadow-lg active:scale-95 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[#0095F6]"
            >
              <ChevronLeft className="h-5 w-5" strokeWidth={2.2} />
            </button>

            {/* Circular RIGHT arrow overlapping the fifth post */}
            <button
              type="button"
              onClick={() => scroll("right")}
              aria-label="Next Instagram posts"
              className="absolute right-1.5 sm:right-3 top-1/2 -translate-y-1/2 z-20 flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-800 shadow-md transition-all hover:bg-stone-50 hover:shadow-lg active:scale-95 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[#0095F6]"
            >
              <ChevronRight className="h-5 w-5" strokeWidth={2.2} />
            </button>

            {/* Posts Row */}
            <div
              ref={scrollRef}
              className="flex gap-2.5 sm:gap-3 lg:gap-3.5 overflow-x-auto scroll-smooth snap-x snap-mandatory scrollbar-none py-1"
            >
              {posts.map((post) => (
                <a
                  key={post.id}
                  href={post.permalink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-[72vw] sm:w-[calc(50%-6px)] md:w-[calc(33.333%-8px)] lg:w-[calc((100%-56px)/5)] shrink-0 snap-start rounded-xl sm:rounded-2xl border border-stone-200/80 overflow-hidden shadow-xs hover:shadow-md transition-all group relative aspect-square sm:aspect-[4/5] bg-stone-100 block"
                >
                  <img
                    src={post.mediaUrl}
                    alt={post.caption || `Instagram post from ${INSTAGRAM_HANDLE}`}
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-103"
                  />

                  {/* Top-right Media Type Indicator */}
                  {post.mediaType === "VIDEO" && (
                    <div className="absolute top-2.5 right-2.5 rounded-md bg-black/45 backdrop-blur-xs p-1 text-white">
                      <Play className="h-3.5 w-3.5 fill-white" />
                    </div>
                  )}
                  {post.mediaType === "CAROUSEL_ALBUM" && (
                    <div className="absolute top-2.5 right-2.5 rounded-md bg-black/45 backdrop-blur-xs p-1 text-white">
                      <Layers className="h-3.5 w-3.5 text-white" />
                    </div>
                  )}

                  {/* Instagram-style Bottom Overlay */}
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/45 to-transparent p-2.5 sm:p-3 text-white flex items-end justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <img
                        src="/instagram/profile.jpg"
                        alt=""
                        width={24}
                        height={24}
                        className="h-6 w-6 rounded-full border border-white/70 object-cover shrink-0"
                      />
                      <div className="flex flex-col min-w-0 text-left">
                        <span className="text-[11px] font-semibold truncate leading-tight text-white drop-shadow-xs">
                          {INSTAGRAM_HANDLE}
                        </span>
                        {post.timestamp && (
                          <span className="text-[9px] text-white/80 leading-tight truncate mt-0.5 drop-shadow-xs">
                            {post.timestamp}
                          </span>
                        )}
                      </div>
                    </div>
                    <InstagramGlyph className="h-4 w-4 shrink-0 text-white opacity-95 drop-shadow-xs" />
                  </div>
                </a>
              ))}
            </div>
          </div>
        ) : (
          /* Clean Instagram Profile CTA (Only used if feed is unavailable) */
          <div className="rounded-xl border border-stone-200 bg-stone-50/70 p-6 text-center">
            <p className="text-sm text-stone-600">
              View our latest reels, moments &amp; updates on Instagram.
            </p>
            <a
              href={INSTAGRAM_PROFILE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex h-9 items-center gap-2 rounded-lg bg-[#0095F6] px-4 text-xs font-semibold text-white shadow-xs transition hover:bg-[#1877F2]"
            >
              <InstagramGlyph className="h-4 w-4" />
              Open @{INSTAGRAM_HANDLE}
            </a>
          </div>
        )}
      </div>
    </section>
  );
}
