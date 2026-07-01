import { createFileRoute, Link } from "@tanstack/react-router";
import { Layout } from "@/components/Layout";
import { useStore } from "@/lib/store";
import { CalendarDays } from "lucide-react";

export const Route = createFileRoute("/blog")({
  component: BlogIndex,
  head: () => ({
    meta: [
      { title: "Blog | Shri Radha Govind Store" },
      { name: "description", content: "Read devotional guides, festival notes, product care tips and Vrindavan stories from Shri Radha Govind Store." },
    ],
  }),
});

function BlogIndex() {
  const { blogs } = useStore();
  const published = blogs.filter((b) => b.isPublished).sort((a, b) => a.sortOrder - b.sortOrder);
  return (
    <Layout>
      <div className="container-app py-10">
        <h1 className="font-display text-4xl md:text-5xl">Blog</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">Devotional guides, festival notes and care tips from Shri Radha Govind Store.</p>
        <div className="mt-8 grid gap-5 md:grid-cols-3">
          {published.length === 0 ? (
            <p className="text-sm text-muted-foreground">No blog posts published yet.</p>
          ) : published.map((post) => (
            <Link key={post.id} to="/blog/$slug" params={{ slug: post.slug }} className="overflow-hidden rounded-lg border bg-card hover:border-primary">
              {post.image && <img src={post.image} alt={post.title} className="h-44 w-full object-cover" />}
              <div className="p-5">
                <p className="flex items-center gap-1 text-xs text-muted-foreground"><CalendarDays className="h-3.5 w-3.5" /> {post.publishedAt ? new Date(post.publishedAt).toLocaleDateString() : "Draft"}</p>
                <h2 className="mt-2 font-display text-2xl leading-tight">{post.title}</h2>
                <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{post.excerpt}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </Layout>
  );
}
