import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { API_URL } from "@/lib/api";
import { SITE_URL } from "@/lib/seo";

const FALLBACK_LLMS_FULL = [
  "# Shri Radha Govind Store - Full Public Knowledge Base & Catalogue",
  "",
  "> Complete machine-readable public documentation and active product catalogue for Shri Radha Govind Store, Vrindavan, Uttar Pradesh, India.",
  "",
  "## Store Overview",
  "",
  "Shri Radha Govind Store operates from Vrindavan Dham, Uttar Pradesh, India, delivering devotional products and spiritual essentials to devotees across India. Our offerings include Tulsi malas, Gopi Chandan, traditional itra (attar), puja accessories, deity items, and devotional giftware. Every order is carefully checked, packed, and shipped with proper care from Vrindavan.",
  "",
  `- Website: ${SITE_URL}/`,
  "- Location: 155, 2nd Floor, Madan Mohan Ghera, Vrindavan, Mathura, Uttar Pradesh - 281121, India",
  "- Customer Care Email: support@shriradhagovindstore.com",
  "- Customer Care Phone: +91 7500533505",
  "- Working Hours: Monday - Saturday, 10:00 AM - 7:00 PM IST",
  "",
  "## Authoritative Canonical Sources",
  "",
  `- Homepage: ${SITE_URL}/`,
  `- All Products (Shop): ${SITE_URL}/shop`,
  `- Product Pages: ${SITE_URL}/product/:slug`,
  `- Category Collections: ${SITE_URL}/shop?cat=:category`,
  `- Shipping Information: ${SITE_URL}/shipping`,
  `- Returns & Replacements: ${SITE_URL}/returns`,
  `- Privacy Policy: ${SITE_URL}/privacy`,
  `- Terms & Conditions: ${SITE_URL}/terms`,
  `- About Us: ${SITE_URL}/about`,
  `- Customer Care: ${SITE_URL}/contact`,
  `- Devotional Blog: ${SITE_URL}/blog`,
  `- Concise Overview: ${SITE_URL}/llms.txt`,
  "",
  "Detailed catalogue data is currently synchronizing. Please visit the canonical storefront links above for complete real-time catalogue items, prices, and stock.",
].join("\n");

async function fetchLlmsFullContent(): Promise<string | null> {
  if (!API_URL) return null;
  try {
    const baseApi = API_URL.startsWith("http")
      ? API_URL
      : `https://www.shriradhagovindstore.com${API_URL}`;
    const url = baseApi.endsWith("/api")
      ? `${baseApi}/llms-full.txt`
      : `${baseApi}/api/llms-full.txt`;
    const response = await fetch(url, { headers: { Accept: "text/plain" } });
    if (!response.ok) return null;
    return await response.text();
  } catch {
    return null;
  }
}

export const Route = createFileRoute("/llms-full.txt")({
  server: {
    handlers: {
      GET: async () => {
        const content = (await fetchLlmsFullContent()) || FALLBACK_LLMS_FULL;
        return new Response(content, {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "public, max-age=3600, s-maxage=3600",
          },
        });
      },
    },
  },
});
