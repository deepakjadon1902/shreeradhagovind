import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { SITE_URL } from "@/lib/seo";

const robots = [
  "User-agent: *",
  "Allow: /",
  "",
  "Disallow: /admin",
  "Disallow: /admin/",
  "Disallow: /cart",
  "Disallow: /checkout",
  "Disallow: /login",
  "Disallow: /signup",
  "Disallow: /forgot-password",
  "Disallow: /orders",
  "Disallow: /orders/",
  "Disallow: /profile",
  "Disallow: /wishlist",
  "Disallow: /api/",
  "",
  `Sitemap: ${SITE_URL}/sitemap.xml`,
  "",
].join("\n");

export const Route = createFileRoute("/robots.txt")({
  server: {
    handlers: {
      GET: async () =>
        new Response(robots, {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "public, max-age=86400, s-maxage=86400",
          },
        }),
    },
  },
});
