export const SITE_URL = "https://shriradhagovindstore.com";
export const STORE_NAME = "Shri Radha Govind Store";
export const DEFAULT_IMAGE = `${SITE_URL}/icon-512.png`;

export const DEFAULT_TITLE =
  "Buy Tulsi Mala, Kanthi Mala, Puja Items & Itra Online | Shri Radha Govind Store";

export const DEFAULT_DESCRIPTION =
  "Buy authentic Tulsi Mala, Kanthi Mala, Puja Essentials, Chandan, Tilak, Itra, Keychains, Temple Gifts and Spiritual Products online from Shri Radha Govind Store, Vrindavan. Fast Shipping Across India.";

export function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function cleanMetaText(value: string, maxLength: number) {
  const text = value
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1).replace(/\s+\S*$/, "")}...`;
}

export function absoluteUrl(path = "/") {
  if (/^https?:\/\//i.test(path)) return path;
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

export function pageSeo({
  title,
  description,
  path,
  image = DEFAULT_IMAGE,
  type = "website",
  robots,
}: {
  title: string;
  description: string;
  path: string;
  image?: string;
  type?: string;
  robots?: string;
}) {
  const canonical = absoluteUrl(path);
  const meta = [
    { title },
    { name: "description", content: description },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:type", content: type },
    { property: "og:url", content: canonical },
    { property: "og:image", content: image },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: description },
    { name: "twitter:image", content: image },
  ];

  if (robots) meta.push({ name: "robots", content: robots });

  return {
    meta,
    links: [{ rel: "canonical", href: canonical }],
  };
}
