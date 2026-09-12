import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { Layout } from "@/components/Layout";
import { useStore, type Blog } from "@/lib/store";
import { pageSeo, slugify, SITE_URL, DEFAULT_IMAGE, cleanMetaText, absoluteUrl } from "@/lib/seo";
import { FormattedText } from "@/components/SimpleRichEditor";
import { API_URL } from "@/lib/api";
import { CalendarDays, ChevronRight, Home, ShoppingBag, ArrowRight } from "lucide-react";

async function loadBlogForMeta(slug: string): Promise<Blog | null> {
  if (!API_URL) return null;
  try {
    const baseApi = API_URL.startsWith("http") ? API_URL : `https://www.shriradhagovindstore.com${API_URL}`;
    const response = await fetch(`${baseApi}/blogs/${encodeURIComponent(slug)}`);
    if (!response.ok) return null;
    const data = (await response.json()) as { blog?: Blog };
    return data.blog ?? null;
  } catch {
    return null;
  }
}

function BlogNotFoundComponent() {
  return (
    <Layout>
      <div className="container-app py-20 text-center">
        <h1 className="font-serif text-3xl font-bold text-[#2B211C]">Blog Post Not Found</h1>
        <p className="mt-2 text-sm text-stone-500 max-w-md mx-auto">
          The devotional article you are looking for may have been moved or unpublished.
        </p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <Link
            to="/blog"
            className="inline-flex h-10 items-center rounded-full bg-[#166F77] px-6 text-sm font-medium text-white transition hover:bg-[#125A61]"
          >
            Back to Devotional Blog
          </Link>
          <Link
            to="/shop"
            className="inline-flex h-10 items-center rounded-full border border-stone-300 px-6 text-sm font-medium text-stone-700 transition hover:bg-stone-50"
          >
            Explore Sacred Catalog
          </Link>
        </div>
      </div>
    </Layout>
  );
}

export const Route = createFileRoute("/blog/$slug")({
  component: BlogPost,
  loader: async ({ params }) => {
    const blog = await loadBlogForMeta(params.slug);
    if (!blog) {
      throw notFound();
    }
    return { blog };
  },
  notFoundComponent: BlogNotFoundComponent,
  head: ({ params, loaderData }) => {
    const blog = loaderData?.blog;
    if (!blog) {
      return {
        meta: [
          { title: "Post Not Found | Shri Radha Govind Store" },
          { name: "robots", content: "noindex, nofollow" },
        ],
      };
    }

    const postTitle = blog.title || "Devotional Guide";
    const title = cleanMetaText(
      blog.metaTitle || `${postTitle} | Shri Radha Govind Store Blog`,
      70,
    );
    const rawDesc =
      blog.metaDescription ||
      blog.excerpt ||
      blog.content ||
      "Read authentic devotional guidance and Vrindavan stories from Shri Radha Govind Store.";
    const description = cleanMetaText(rawDesc, 160);

    const slug = blog.slug || params.slug;
    const canonicalPath = `/blog/${slug}`;
    const canonicalUrl = `${SITE_URL}${canonicalPath}`;
    const postImage = blog.image ? absoluteUrl(blog.image) : DEFAULT_IMAGE;

    const breadcrumbSchema = {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: "Home",
          item: SITE_URL,
        },
        {
          "@type": "ListItem",
          position: 2,
          name: "Blog",
          item: `${SITE_URL}/blog`,
        },
        {
          "@type": "ListItem",
          position: 3,
          name: postTitle,
          item: canonicalUrl,
        },
      ],
    };

    const articleSchema: Record<string, any> = {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      headline: postTitle,
      description,
      image: [postImage],
      url: canonicalUrl,
      mainEntityOfPage: {
        "@type": "WebPage",
        "@id": canonicalUrl,
      },
      publisher: {
        "@type": "Organization",
        name: "Shri Radha Govind Store",
        logo: {
          "@type": "ImageObject",
          url: `${SITE_URL}/brand-logo-large.png`,
        },
      },
    };

    if (blog.author) {
      articleSchema.author = {
        "@type": "Person",
        name: blog.author,
      };
    } else {
      articleSchema.author = {
        "@type": "Organization",
        name: "Shri Radha Govind Store",
      };
    }

    if (blog.publishedAt) {
      articleSchema.datePublished = new Date(blog.publishedAt).toISOString();
      articleSchema.dateModified = new Date(blog.publishedAt).toISOString();
    }

    const baseSeo = pageSeo({
      title,
      description,
      path: canonicalPath,
      image: postImage,
      type: "article",
      robots: "index, follow",
    });

    return {
      ...baseSeo,
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify(breadcrumbSchema),
        },
        {
          type: "application/ld+json",
          children: JSON.stringify(articleSchema),
        },
      ],
    };
  },
});

function BlogPost() {
  const { slug } = Route.useParams();
  const loaderData = Route.useLoaderData();
  const loadedBlog = loaderData?.blog;
  const { blogs } = useStore();
  const post =
    blogs.find((b) => (b.slug === slug || slugify(b.title) === slug) && b.isPublished) ??
    loadedBlog;

  if (!post) {
    return <BlogNotFoundComponent />;
  }

  return (
    <Layout>
      <article className="container-app max-w-3xl py-8 sm:py-12">
        {/* Visual Breadcrumb Navigation */}
        <nav
          aria-label="Breadcrumb"
          className="mb-6 flex items-center gap-1.5 text-xs text-stone-500 flex-wrap"
        >
          <Link to="/" className="inline-flex items-center gap-1 hover:text-[#166F77] transition">
            <Home className="h-3.5 w-3.5" /> Home
          </Link>
          <ChevronRight className="h-3 w-3 text-stone-300" />
          <Link to="/blog" className="hover:text-[#166F77] transition">
            Blog
          </Link>
          <ChevronRight className="h-3 w-3 text-stone-300" />
          <span className="font-semibold text-stone-800 line-clamp-1 max-w-xs">{post.title}</span>
        </nav>

        <h1 className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold text-[#2B211C] leading-tight">
          {post.title}
        </h1>

        <div className="mt-4 flex items-center gap-3 text-xs text-stone-500 border-b border-stone-200 pb-4">
          <span className="font-medium text-stone-700">{post.author || "Shri Radha Govind Store"}</span>
          {post.publishedAt && (
            <>
              <span className="text-stone-300">•</span>
              <span className="flex items-center gap-1">
                <CalendarDays className="h-3.5 w-3.5" />
                {new Date(post.publishedAt).toLocaleDateString("en-IN", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </span>
            </>
          )}
        </div>

        {post.image && (
          <img
            src={post.image}
            alt={post.title}
            loading="lazy"
            decoding="async"
            className="mt-6 max-h-[440px] w-full rounded-2xl object-cover border border-[#E7E1D6] shadow-sm"
          />
        )}

        <div className="mt-8 text-[#2B211C] leading-relaxed text-base prose max-w-none">
          <FormattedText content={post.content || post.excerpt} />
        </div>

        {/* Natural Devotional Internal Cross-Link Card */}
        <div className="mt-12 rounded-2xl border border-[#E7E1D6] bg-[#FFFFF4] p-6 text-center sm:text-left sm:flex sm:items-center sm:justify-between gap-6">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#D9A441]">
              From Vrindavan Dham
            </span>
            <h3 className="mt-1 font-serif text-lg font-bold text-[#2B211C]">
              Looking for Authentic Tulsi Malas & Sacred Items?
            </h3>
            <p className="mt-1 text-xs text-stone-600 max-w-md">
              Each sacred item in our store is thoughtfully sourced from traditional Vrindavan artisans and blessed for your daily sadhana.
            </p>
          </div>
          <Link
            to="/shop"
            className="mt-4 sm:mt-0 shrink-0 inline-flex items-center gap-2 rounded-xl bg-[#166F77] px-5 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-[#125A61] transition"
          >
            <ShoppingBag className="h-4 w-4" />
            <span>Explore Catalog</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </article>
    </Layout>
  );
}
