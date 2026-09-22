import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { API_URL } from "@/lib/api";
import { SITE_URL } from "@/lib/seo";

const FALLBACK_LLMS = [
  "# Shri Radha Govind Store",
  "",
  "> Shri Radha Govind Store is a devotional and spiritual e-commerce store based in Vrindavan, Uttar Pradesh, India, offering devotional products and spiritual essentials for personal practice, पूजा, gifting, and Krishna/Radha devotion.",
  "",
  "## About",
  "",
  "Shri Radha Govind Store operates from Vrindavan Dham, Uttar Pradesh, India, delivering devotional products and spiritual essentials to devotees across India. Our offerings include Tulsi malas, Gopi Chandan, traditional itra (attar), puja accessories, deity items, and devotional giftware. Every order is carefully checked, packed, and shipped with proper care from Vrindavan.",
  "",
  `- Website: ${SITE_URL}/`,
  "- Location: 155, 2nd Floor, Madan Mohan Ghera, Vrindavan, Mathura, Uttar Pradesh - 281121, India",
  "- Customer Care Email: support@shriradhagovindstore.com",
  "- Customer Care Phone: +91 7500533505",
  "- Working Hours: Monday - Saturday, 10:00 AM - 7:00 PM IST",
  "",
  "## Authoritative Sources",
  "",
  `- Storefront & Catalogue: ${SITE_URL}/shop`,
  `- Product Details: ${SITE_URL}/product/:slug`,
  `- Category Collections: ${SITE_URL}/shop?cat=:category`,
  `- Shipping Policy: ${SITE_URL}/shipping`,
  `- Returns & Refund Policy: ${SITE_URL}/returns`,
  `- Privacy Policy: ${SITE_URL}/privacy`,
  `- Terms & Conditions: ${SITE_URL}/terms`,
  `- About Us: ${SITE_URL}/about`,
  `- Contact & Support: ${SITE_URL}/contact`,
  `- Devotional Blog: ${SITE_URL}/blog`,
  `- Full Machine-Readable Knowledge Base: ${SITE_URL}/llms-full.txt`,
  "",
  "Live product catalogue data is currently synchronizing. Please visit the storefront links above for current product listings, real-time availability, and pricing.",
].join("\n");

async function fetchLlmsContent(): Promise<string | null> {
  if (!API_URL) return null;
  try {
    const baseApi = API_URL.startsWith("http")
      ? API_URL
      : `https://www.shriradhagovindstore.com${API_URL}`;
    // Construct the endpoint URL safely avoiding double /api
    const url = baseApi.endsWith("/api")
      ? `${baseApi}/llms.txt`
      : `${baseApi}/api/llms.txt`;
    const response = await fetch(url, { headers: { Accept: "text/plain" } });
    if (!response.ok) return null;
    return await response.text();
  } catch {
    return null;
  }
}

export const Route = createFileRoute("/llms.txt")({
  server: {
    handlers: {
      GET: async () => {
        const content = (await fetchLlmsContent()) || FALLBACK_LLMS;
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
