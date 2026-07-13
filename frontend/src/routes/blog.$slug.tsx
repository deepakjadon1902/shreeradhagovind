import { createFileRoute, Link } from "@tanstack/react-router";
import { Layout } from "@/components/Layout";
import { useStore } from "@/lib/store";
import { pageSeo } from "@/lib/seo";

export const Route = createFileRoute("/blog/$slug")({
  component: BlogPost,
  head: ({ params }) => {
    const title = `${params.slug
      .split("-")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ")} | Shri Radha Govind Store Blog`;

    return pageSeo({
      title,
      description:
        "Read devotional guidance, product care tips, festival notes and Vrindavan stories from Shri Radha Govind Store.",
      path: `/blog/${params.slug}`,
      type: "article",
    });
  },
});

function BlogPost() {
  const { slug } = Route.useParams();
  const { blogs } = useStore();
  const post = blogs.find((b) => b.slug === slug && b.isPublished);
  if (!post) {
    return <Layout><div className="container-app py-20 text-center"><h1 className="font-display text-3xl">Post not found</h1><Link to="/blog" className="mt-5 inline-flex h-10 items-center rounded-full bg-primary px-5 text-sm text-primary-foreground">Back to blog</Link></div></Layout>;
  }
  return (
    <Layout>
      <article className="container-app max-w-3xl py-10">
        <Link to="/blog" className="text-sm text-primary">Back to blog</Link>
        <h1 className="mt-4 font-display text-4xl md:text-5xl">{post.title}</h1>
        <p className="mt-3 text-sm text-muted-foreground">{post.author} · {post.publishedAt ? new Date(post.publishedAt).toLocaleDateString() : ""}</p>
        {post.image && <img src={post.image} alt={post.title} className="mt-8 max-h-[440px] w-full rounded-lg object-cover" />}
        <div className="prose prose-neutral mt-8 max-w-none whitespace-pre-line text-foreground">
          {post.content || post.excerpt}
        </div>
      </article>
    </Layout>
  );
}
