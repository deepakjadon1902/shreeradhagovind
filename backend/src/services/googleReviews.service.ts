export interface GoogleReviewItem {
  id: string;
  authorName: string;
  authorPhoto: string;
  authorProfile: string;
  authorReviewCount: string;
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
  lastFetchedAt: string;
  source: "live" | "cache" | "fallback";
}

const PLACE_ID = "ChIJkTMPYw9vczkRePqHoW1QKpY";
const MAPS_URL =
  "https://www.google.com/maps/place/Shri+Radha+Govind+Store/@27.5791339,77.6873286,16.48z/data=!4m6!3m5!1s0x39736f0f630f3391:0x962a506da187fa78!8m2!3d27.5789022!4d77.6877274!16s%2Fg%2F11xm_fb7ts";
const WRITE_REVIEW_URL = `https://search.google.com/local/writereview?placeid=${PLACE_ID}`;

// Verified snapshot directly from official Google Business listing
const VERIFIED_SNAPSHOT_REVIEWS: GoogleReviewItem[] = [
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
];

let cachedData: GoogleReviewsData = {
  businessName: "Shri Radha Govind Store",
  rating: 4.5,
  totalReviews: 6,
  ratingText: "EXCELLENT",
  mapsUrl: MAPS_URL,
  writeReviewUrl: WRITE_REVIEW_URL,
  reviews: VERIFIED_SNAPSHOT_REVIEWS,
  lastFetchedAt: new Date().toISOString(),
  source: "fallback",
};

let lastFetchTimestamp = 0;
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

function computeRatingText(rating: number): string {
  if (rating >= 4.5) return "EXCELLENT";
  if (rating >= 4.0) return "VERY GOOD";
  if (rating >= 3.5) return "GOOD";
  return "RECOMMENDED";
}

/**
 * Parses Google Maps preview place payload for updated ratings, review counts, and reviews.
 */
function parseGoogleMapsPayload(text: string): Partial<GoogleReviewsData> | null {
  try {
    let jsonStr = text;
    const marker = ")]}'\n";
    if (jsonStr.startsWith(marker)) {
      jsonStr = jsonStr.substring(marker.length);
    }
    const json = JSON.parse(jsonStr);
    if (!Array.isArray(json) || !json[6]) return null;

    const summary = json[6][4];
    const rating = typeof summary?.[7] === "number" ? summary[7] : 4.5;
    const totalReviews = typeof summary?.[8] === "number" ? summary[8] : 6;

    const rawReviews = json[6][175]?.[9]?.[0]?.[0];
    const parsedReviews: GoogleReviewItem[] = [];

    if (Array.isArray(rawReviews)) {
      for (const item of rawReviews) {
        const r = item?.[0];
        if (!r) continue;
        const reviewId = String(r[0] || Math.random().toString());
        const authorData = r[1]?.[4]?.[5] || [];
        const authorName = String(authorData[0] || "Google User");
        const authorPhoto = String(authorData[1] || "");
        const authorProfile = String(authorData[2]?.[0] || "");
        const authorReviewCount = String(authorData[10]?.[0] || "");
        const relativeTime = String(r[1]?.[6] || "Recently");
        const itemRating = typeof r[2]?.[0]?.[0] === "number" ? r[2][0][0] : 5;

        let reviewText = "";
        if (r[2]?.[15]?.[0]?.[0] && typeof r[2][15][0][0] === "string") {
          reviewText = r[2][15][0][0];
        }

        parsedReviews.push({
          id: reviewId,
          authorName,
          authorPhoto,
          authorProfile,
          authorReviewCount,
          rating: itemRating,
          relativeTime,
          text: reviewText,
        });
      }
    }

    return {
      rating,
      totalReviews,
      ratingText: computeRatingText(rating),
      reviews: parsedReviews.length > 0 ? parsedReviews : VERIFIED_SNAPSHOT_REVIEWS,
    };
  } catch (err) {
    return null;
  }
}

/**
 * Attempts a live fetch from the official Google Maps preview endpoint.
 */
async function fetchLiveGoogleReviews(): Promise<void> {
  try {
    const previewUrl =
      "https://www.google.com/maps/preview/place?authuser=0&hl=en&gl=in&q=Shri+Radha+Govind+Store&pb=%211m17%211s0x39736f0f630f3391%3A0x962a506da187fa78%212sShri+Radha+Govind+Store%213m8%211m3%211d5071.133036985133%212d77.6873286%213d27.5791339%213m2%211i1024%212i768%214f13.1%214m2%213d27.5789022%214d77.6877274%2115m2%211m1%214s%2Fg%2F11xm_fb7ts";

    const response = await fetch(previewUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
      },
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) return;
    const body = await response.text();
    const parsed = parseGoogleMapsPayload(body);
    if (parsed && parsed.reviews && parsed.reviews.length > 0) {
      cachedData = {
        businessName: "Shri Radha Govind Store",
        rating: parsed.rating ?? 4.5,
        totalReviews: parsed.totalReviews ?? 6,
        ratingText: computeRatingText(parsed.rating ?? 4.5),
        mapsUrl: MAPS_URL,
        writeReviewUrl: WRITE_REVIEW_URL,
        reviews: parsed.reviews,
        lastFetchedAt: new Date().toISOString(),
        source: "live",
      };
      lastFetchTimestamp = Date.now();
    }
  } catch {
    // If live fetch fails, cachedData or verified fallback remains intact
  }
}

/**
 * Returns Google Reviews data for Shri Radha Govind Store.
 * Returns cached data immediately to prevent blocking requests.
 * Triggers background refresh if cache is expired.
 */
export async function getGoogleReviews(): Promise<GoogleReviewsData> {
  const now = Date.now();
  if (now - lastFetchTimestamp > CACHE_TTL_MS) {
    // Refresh in background if we already have cache/fallback
    if (lastFetchTimestamp > 0) {
      fetchLiveGoogleReviews().catch(() => {});
    } else {
      // First call: attempt quick live fetch, fall back to snapshot on timeout
      await fetchLiveGoogleReviews();
      lastFetchTimestamp = Date.now();
    }
  }

  return cachedData;
}
