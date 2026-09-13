/**
 * ImageKit URL optimization helper
 *
 * Automatically resizes, compresses, and format-optimizes images served via ImageKit (ik.imagekit.io).
 * Preserves existing query parameters, safely replaces or sets transformation parameters (w, q, f-auto),
 * and leaves non-ImageKit URLs completely unchanged.
 */

export function optimizeImageKit(
  url: string | undefined | null,
  width?: number,
  quality = 80,
): string {
  if (!url) return "";
  if (!url.includes("ik.imagekit.io")) return url;

  try {
    const parsed = new URL(url);

    const parts: string[] = [];
    if (typeof width === "number" && width > 0) {
      parts.push(`w-${width}`);
    }
    if (typeof quality === "number" && quality > 0) {
      parts.push(`q-${quality}`);
    }
    parts.push("f-auto");

    // If query string already has ?tr=, update or replace width/quality/format
    if (parsed.searchParams.has("tr")) {
      const existing = parsed.searchParams.get("tr") || "";
      const cleaned = existing
        .split(",")
        .filter((t) => !t.startsWith("w-") && !t.startsWith("q-") && !t.startsWith("f-"));
      parsed.searchParams.set("tr", [...cleaned, ...parts].join(","));
      return parsed.toString();
    }

    // If path contains /tr:.../
    const pathParts = parsed.pathname.split("/").filter(Boolean);
    if (pathParts.some((p) => p.startsWith("tr:"))) {
      return url;
    }

    parsed.searchParams.set("tr", parts.join(","));
    return parsed.toString();
  } catch {
    return url;
  }
}
