import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { Toaster } from "sonner";
import { StoreProvider } from "@/lib/store";
import { DEFAULT_DESCRIPTION, DEFAULT_IMAGE, DEFAULT_TITLE, SITE_URL, STORE_NAME } from "@/lib/seo";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-display text-primary">404</h1>
        <h2 className="mt-4 text-xl font-display">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">The page you're looking for doesn't exist.</p>
        <Link to="/" className="mt-6 inline-flex h-10 items-center rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground hover:opacity-90">Go home</Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-display">This page didn't load</h1>
        <p className="mt-2 text-sm text-muted-foreground">Something went wrong.</p>
        <div className="mt-6 flex justify-center gap-2">
          <button onClick={() => { router.invalidate(); reset(); }} className="h-10 px-4 rounded-full bg-primary text-primary-foreground text-sm">Try again</button>
          <a href="/" className="h-10 px-4 rounded-full border text-sm grid place-items-center">Go home</a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: DEFAULT_TITLE },
      { name: "description", content: DEFAULT_DESCRIPTION },
      { property: "og:site_name", content: STORE_NAME },
      { property: "og:title", content: DEFAULT_TITLE },
      { name: "twitter:title", content: DEFAULT_TITLE },
      { property: "og:description", content: DEFAULT_DESCRIPTION },
      { name: "twitter:description", content: DEFAULT_DESCRIPTION },
      { property: "og:image", content: DEFAULT_IMAGE },
      { name: "twitter:image", content: DEFAULT_IMAGE },
      { property: "og:url", content: SITE_URL },
      { title: "Shri Radha Govind Store — Sacred Products from Vrindavan" },
      { name: "description", content: "Authentic Krishna & Radha Rani products from Vrindavan — dresses, chandan, itra, mala, puja items. Delivered with devotion." },
      { property: "og:title", content: "Shri Radha Govind Store — Sacred Products from Vrindavan" },
      { name: "twitter:title", content: "Shri Radha Govind Store — Sacred Products from Vrindavan" },
      { property: "og:description", content: "Authentic Krishna & Radha Rani products from Vrindavan — dresses, chandan, itra, mala, puja items. Delivered with devotion." },
      { name: "twitter:description", content: "Authentic Krishna & Radha Rani products from Vrindavan — dresses, chandan, itra, mala, puja items. Delivered with devotion." },
      { property: "og:image", content: "https://shriradhagovindstore.com/icon-512.png" },
      { name: "twitter:image", content: "https://shriradhagovindstore.com/icon-512.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
      { title: DEFAULT_TITLE },
      { name: "description", content: DEFAULT_DESCRIPTION },
      { property: "og:site_name", content: STORE_NAME },
      { property: "og:title", content: DEFAULT_TITLE },
      { name: "twitter:title", content: DEFAULT_TITLE },
      { property: "og:description", content: DEFAULT_DESCRIPTION },
      { name: "twitter:description", content: DEFAULT_DESCRIPTION },
      { property: "og:image", content: DEFAULT_IMAGE },
      { name: "twitter:image", content: DEFAULT_IMAGE },
      { property: "og:url", content: SITE_URL },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", type: "image/png", sizes: "32x32", href: "/favicon-32.png" },
      { rel: "icon", type: "image/png", sizes: "192x192", href: "/favicon-192.png" },
      { rel: "apple-touch-icon", sizes: "180x180", href: "/apple-touch-icon.png" },
      { rel: "manifest", href: "/site.webmanifest" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&family=Inter:wght@300;400;500;600;700&display=swap" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head><HeadContent /></head>
      <body>{children}<Scripts /></body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <StoreProvider>
        <Outlet />
        <Toaster position="top-center" richColors />
      </StoreProvider>
    </QueryClientProvider>
  );
}
