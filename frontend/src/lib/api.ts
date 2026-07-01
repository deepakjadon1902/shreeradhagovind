// Lightweight fetch wrapper for the backend API.
// Set VITE_API_URL in your frontend .env (e.g. http://localhost:5000/api).
// When unset, isApiEnabled() is false and the store falls back to local data.

const RAW = (import.meta.env.VITE_API_URL as string | undefined)?.trim() ?? "";
export const API_URL = RAW.replace(/\/$/, "");

const TOKEN_KEY = "srg_token";

export const getToken = () =>
  typeof window === "undefined" ? null : localStorage.getItem(TOKEN_KEY);

export const setToken = (t: string | null) => {
  if (typeof window === "undefined") return;
  if (t) localStorage.setItem(TOKEN_KEY, t);
  else localStorage.removeItem(TOKEN_KEY);
};

export const isApiEnabled = () => !!API_URL;

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
