import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { API_URL } from "@/lib/api";
import { PRODUCTS, DEFAULT_CATEGORIES } from "@/lib/products";
import { SITE_URL, slugify } from "@/lib/seo";

type ChangeFreq = "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";

type SitemapEntry = {
  path: string;
  changefreq: ChangeFreq;
  priority: string;
  lastmod?: string;
};

const staticEntries: SitemapEntry[] = [
  { path: "/", changefreq: "weekly", priority: "1.0" },
  { path: "/shop", changefreq: "daily", priority: "0.9" },
  { path: "/about", changefreq: "monthly", priority: "0.7" },
  { path: "/contact", changefreq: "monthly", priority: "0.7" },
  { path: "/blog", changefreq: "weekly", priority: "0.6" },
  { path: "/track", changefreq: "weekly", priority: "0.5" },
  { path: "/shipping", changefreq: "monthly", priority: "0.4" },
  { path: "/returns", changefreq: "monthly", priority: "0.4" },
  { path: "/privacy", changefreq: "yearly", priority: "0.3" },
  { path: "/terms", changefreq: "yearly", priority: "0.3" },
];

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function toDate(value: unknown, fallback: string) {
  if (!value) return fallback;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? fallback : date.toISOString().slice(0, 10);
}

async function fetchApi<T>(path: string): Promise<T | null> {
  if (!API_URL) return null;
  try {
    const response = await fetch(`${API_URL}${path}`);
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

async function productEntries(today: string): Promise<SitemapEntry[]> {
  const data = await fetchApi<{ products?: Record<string, unknown>[] }>("/products");
  const products = data?.products?.length ? data.products : PRODUCTS;

  return products
    .filter((product) => product && product.name)
    .map((product) => {
      const name = String(product.name);
      const slug = String(product.slug ?? slugify(name));
      return {
        path: `/product/${slug}`,
        changefreq: "weekly" as const,
        priority: "0.8",
        lastmod: toDate(product.updatedAt, today),
      };
    });
}

async function categoryEntries(today: string): Promise<SitemapEntry[]> {
  const data = await fetchApi<{ categories?: Record<string, unknown>[] }>("/categories");
  const categories = data?.categories?.length
    ? data.categories.map((category) => String(category.name ?? "")).filter(Boolean)
    : DEFAULT_CATEGORIES;

  return Array.from(new Set(categories)).map((category) => ({
    path: `/shop?cat=${encodeURIComponent(category)}`,
    changefreq: "daily" as const,
    priority: "0.7",
    lastmod: today,
  }));
}

async function blogEntries(today: string): Promise<SitemapEntry[]> {
  const data = await fetchApi<{ blogs?: Record<string, unknown>[] }>("/blogs");
  const blogs = data?.blogs ?? [];

  return blogs
    .filter((blog) => blog.isPublished !== false && blog.slug)
    .map((blog) => ({
      path: `/blog/${String(blog.slug)}`,
      changefreq: "monthly" as const,
      priority: "0.5",
      lastmod: toDate(blog.updatedAt ?? blog.publishedAt, today),
    }));
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const today = new Date().toISOString().slice(0, 10);
        const entries = [
          ...staticEntries.map((entry) => ({ ...entry, lastmod: entry.lastmod ?? today })),
          ...(await categoryEntries(today)),
          ...(await productEntries(today)),
          ...(await blogEntries(today)),
        ];

        const seen = new Set<string>();
        const urls = entries
          .filter((entry) => {
            if (seen.has(entry.path)) return false;
            seen.add(entry.path);
            return true;
          })
          .map((entry) =>
            [
              "  <url>",
              `    <loc>${escapeXml(`${SITE_URL}${entry.path}`)}</loc>`,
              `    <lastmod>${entry.lastmod ?? today}</lastmod>`,
              `    <changefreq>${entry.changefreq}</changefreq>`,
              `    <priority>${entry.priority}</priority>`,
              "  </url>",
            ].join("\n"),
          );

        const xml = [
          '<?xml version="1.0" encoding="UTF-8"?>',
          '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
          ...urls,
          "</urlset>",
        ].join("\n");

        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml; charset=utf-8",
            "Cache-Control": "public, max-age=3600, s-maxage=3600",
          },
        });
      },
    },
  },
});
