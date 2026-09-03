function resolveApiUrl(): string {
  const configured = (import.meta.env.VITE_API_URL as string | undefined)?.trim();
  if (configured) return configured.replace(/\/$/, "");
  // In development, fallback to default local backend API endpoint
  if (import.meta.env.DEV) return "http://localhost:5000/api";
  // In production, fallback to relative API route (same origin)
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

type Options = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  headers?: Record<string, string>;
  formData?: FormData;
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
  const res = await fetch(`${API_URL}${path}`, {
    method: opts.method ?? "GET",
    headers,
    body,
  });
  const text = await res.text();
  const data = text ? safeJSON(text) : null;
  if (!res.ok) {
    const msg = (data && (data.error || data.message)) || `${res.status} ${res.statusText}`;
    throw new Error(msg);
  }
  return data as T;
}

function safeJSON(s: string) {
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}
