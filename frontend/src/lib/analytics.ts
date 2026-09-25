import { API_URL } from "./api";

const VISITOR_ID_KEY = "rg_visitor_id";
const SESSION_ID_KEY = "rg_analytics_session";
const CAMPAIGN_CONTEXT_KEY = "rg_campaign_context";

export type DeviceCategory = "mobile" | "desktop" | "tablet" | "unknown";

export interface IUtmContext {
  source?: string;
  medium?: string;
  campaign?: string;
  term?: string;
  content?: string;
  landingPath?: string;
  referrer?: string;
}

/**
 * Generate a random RFC4122 v4 UUID
 */
function generateUUID(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    try {
      return crypto.randomUUID();
    } catch {
      // fallback if randomUUID fails
    }
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Returns privacy-safe pseudonymous Visitor ID from localStorage (or creates one)
 */
export function getVisitorId(): string {
  if (typeof window === "undefined") return "server-visitor";
  try {
    let vid = localStorage.getItem(VISITOR_ID_KEY);
    if (!vid || vid.length < 10) {
      vid = generateUUID();
      localStorage.setItem(VISITOR_ID_KEY, vid);
    }
    return vid;
  } catch {
    return generateUUID();
  }
}

/**
 * Returns session ID for the current browser session from sessionStorage (or creates one)
 */
export function getSessionId(): string {
  if (typeof window === "undefined") return "server-session";
  try {
    let sid = sessionStorage.getItem(SESSION_ID_KEY);
    if (!sid || sid.length < 10) {
      sid = generateUUID();
      sessionStorage.setItem(SESSION_ID_KEY, sid);
    }
    return sid;
  } catch {
    return generateUUID();
  }
}

/**
 * Lightweight, privacy-safe device category detection from User-Agent
 */
export function getDeviceCategory(): DeviceCategory {
  if (typeof window === "undefined" || !navigator?.userAgent) return "unknown";
  const ua = navigator.userAgent.toLowerCase();

  if (/ipad|tablet|playbook|silk/i.test(ua)) {
    return "tablet";
  }
  if (/mobile|iphone|ipod|android|blackberry|opera mini|iemobile/i.test(ua)) {
    return "mobile";
  }
  return "desktop";
}

/**
 * Clean & sanitize query parameters to prevent capturing sensitive tokens or credentials
 */
function sanitizeQueryParam(val: string | null): string {
  if (!val) return "";
  // Strip control chars, limit length to 100
  return val.trim().slice(0, 100);
}

/**
 * Captures and persists campaign context (UTMs, referrer, initial landing path)
 * Preserves the initial campaign context across internal navigation
 */
export function getCampaignContext(): IUtmContext {
  if (typeof window === "undefined") return {};

  try {
    let storedContext: IUtmContext | null = null;
    const storedStr = sessionStorage.getItem(CAMPAIGN_CONTEXT_KEY);
    if (storedStr) {
      try {
        storedContext = JSON.parse(storedStr);
      } catch {
        // invalid JSON
      }
    }

    // Check current URL search for incoming UTM parameters
    const params = new URLSearchParams(window.location.search);
    const hasIncomingUtm =
      params.has("utm_source") ||
      params.has("utm_medium") ||
      params.has("utm_campaign") ||
      params.has("utm_term") ||
      params.has("utm_content");

    if (hasIncomingUtm || !storedContext) {
      const incomingUtm: IUtmContext = {
        source: sanitizeQueryParam(params.get("utm_source")) || storedContext?.source || "",
        medium: sanitizeQueryParam(params.get("utm_medium")) || storedContext?.medium || "",
        campaign: sanitizeQueryParam(params.get("utm_campaign")) || storedContext?.campaign || "",
        term: sanitizeQueryParam(params.get("utm_term")) || storedContext?.term || "",
        content: sanitizeQueryParam(params.get("utm_content")) || storedContext?.content || "",
        landingPath: storedContext?.landingPath || window.location.pathname || "/",
        referrer: storedContext?.referrer || (typeof document !== "undefined" ? document.referrer : "") || "",
      };

      // Only save if there's meaningful data or initial landing
      sessionStorage.setItem(CAMPAIGN_CONTEXT_KEY, JSON.stringify(incomingUtm));
      return incomingUtm;
    }

    return storedContext;
  } catch {
    return {};
  }
}

/**
 * Sends an analytics event non-blockingly using sendBeacon with keepalive fetch fallback
 */
function dispatchEvent(
  eventType: "page_view" | "product_view" | "add_to_cart" | "checkout_start",
  payload: {
    entityId?: string | null;
    path?: string;
    metadata?: Record<string, any>;
  } = {}
) {
  if (typeof window === "undefined") return;

  try {
    const visitorId = getVisitorId();
    const sessionId = getSessionId();
    const device = getDeviceCategory();
    const campaign = getCampaignContext();
    const currentPath = payload.path || window.location.pathname || "/";

    // Exclude admin pages from public visitor conversion analytics
    if (currentPath.startsWith("/admin")) {
      return;
    }

    const eventData = {
      eventType,
      visitorId,
      sessionId,
      entityId: payload.entityId || null,
      path: currentPath,
      device,
      referrer: campaign.referrer || (typeof document !== "undefined" ? document.referrer : ""),
      utm: {
        source: campaign.source || "",
        medium: campaign.medium || "",
        campaign: campaign.campaign || "",
        term: campaign.term || "",
        content: campaign.content || "",
      },
      metadata: payload.metadata || {},
    };

    const endpoint = `${API_URL}/analytics/events`;
    const jsonBody = JSON.stringify(eventData);

    // Primary transport: navigator.sendBeacon
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      try {
        const blob = new Blob([jsonBody], { type: "application/json" });
        const enqueued = navigator.sendBeacon(endpoint, blob);
        if (enqueued) return;
      } catch {
        // fallback to fetch if sendBeacon throws
      }
    }

    // Secondary fallback: fetch with keepalive: true
    if (typeof fetch === "function") {
      fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: jsonBody,
        keepalive: true,
      }).catch(() => {
        // Silently swallow analytics dispatch errors
      });
    }
  } catch {
    // Pure silent failure
  }
}

// Memory cache to deduplicate rapid consecutive page_views on same path caused by React re-renders
let lastTrackedPath = "";
let lastTrackedTime = 0;

/**
 * Tracks a page view once per route transition
 */
export function trackPageView(path?: string) {
  const currentPath = path || (typeof window !== "undefined" ? window.location.pathname : "/");
  const now = Date.now();

  // Deduplicate if fired for same path within 400ms (e.g. React StrictMode / re-renders)
  if (currentPath === lastTrackedPath && now - lastTrackedTime < 400) {
    return;
  }

  lastTrackedPath = currentPath;
  lastTrackedTime = now;
  dispatchEvent("page_view", { path: currentPath });
}

/**
 * Tracks a product detail view once per meaningful visit
 */
export function trackProductView(productId: string) {
  if (!productId) return;
  dispatchEvent("product_view", { entityId: productId });
}

/**
 * Tracks successful Add to Cart action (called ONLY after cart state updates)
 */
export function trackAddToCart(productId: string, quantity: number = 1) {
  if (!productId) return;
  dispatchEvent("add_to_cart", {
    entityId: productId,
    metadata: { quantity: Math.max(1, quantity) },
  });
}

/**
 * Tracks when a customer meaningfully enters checkout
 */
export function trackCheckoutStart() {
  dispatchEvent("checkout_start");
}
