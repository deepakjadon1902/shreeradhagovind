function resolveApiUrl(): string {
  const configured = (import.meta.env.VITE_API_URL as string | undefined)?.trim();
  if (configured) return configured.replace(/\/$/, "");
  // In development, fallback to default local backend API endpoint
  if (import.meta.env.DEV) return "http://localhost:5000/api";
  // In production, fallback to relative API route (same origin, proxied via vercel.json rewrite)
  return "/api";
}

export const API_URL = resolveApiUrl();

const TOKEN_KEY = "srg_token";

export const getToken = () =>
  typeof window === "undefined" ? null : localStorage.getItem(TOKEN_KEY);

export const setToken = (t: string | null) => {
  if (typeof window === "undefined") return;
  if (t) localStorage.setItem(TOKEN_KEY, t);
  else localStorage.removeItem(TOKEN_KEY);
};

export const isApiEnabled = () => Boolean(API_URL);

export class ApiError extends Error {
  status: number;
  data: any;
  constructor(message: string, status: number, data?: any) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

export type Options = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  headers?: Record<string, string>;
  formData?: FormData;
  retries?: number;
  retryDelayMs?: number;
};

export async function api<T = any>(path: string, opts: Options = {}): Promise<T> {
  if (!API_URL) throw new Error("VITE_API_URL not configured");
  const headers: Record<string, string> = { ...(opts.headers ?? {}) };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  let body: BodyInit | undefined;
  if (opts.formData) {
    body = opts.formData;
  } else if (opts.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(opts.body);
  }

  const maxAttempts = Math.max(1, (opts.retries ?? 0) + 1);
  const initialDelay = opts.retryDelayMs ?? 1000;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const res = await fetch(`${API_URL}${path}`, {
        method: opts.method ?? "GET",
        headers,
        body,
      });
      const text = await res.text();
      const data = text ? safeJSON(text) : null;
      if (!res.ok) {
        const msg = (data && (data.error || data.message)) || `${res.status} ${res.statusText}`;
        const error = new ApiError(msg, res.status, data);
        // Do NOT retry 4xx errors
        if (res.status >= 400 && res.status < 500) {
          throw error;
        }
        // For 5xx server errors, retry if attempts remain
        if (attempt < maxAttempts - 1) {
          await new Promise((resolve) => setTimeout(resolve, initialDelay * Math.pow(2, attempt)));
          continue;
        }
        throw error;
      }
      return data as T;
    } catch (err: any) {
      // Do not retry 4xx client errors
      if (err instanceof ApiError && err.status >= 400 && err.status < 500) {
        throw err;
      }
      if (attempt >= maxAttempts - 1) {
        throw err;
      }
      // Transient network / 5xx error -> wait and retry
      await new Promise((resolve) => setTimeout(resolve, initialDelay * Math.pow(2, attempt)));
    }
  }

  throw new Error("API request failed");
}

function safeJSON(s: string) {
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}
