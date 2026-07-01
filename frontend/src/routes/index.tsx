import { createFileRoute, Link } from "@tanstack/react-router";
import { Layout } from "@/components/Layout";
import { ProductCard } from "@/components/ProductCard";
import { useStore } from "@/lib/store";
import { ArrowRight, Sparkles, Truck, ShieldCheck, Flower2 } from "lucide-react";
import heroKrishna from "@/assets/hero-krishna.jpg";

export const Route = createFileRoute("/")({
  component: Home,
  head: () => ({
    meta: [
      { title: "Shri Radha Govind Store — Sacred Vrindavan Essentials Online" },
      { name: "description", content: "Authentic Krishna & Radha Rani poshak, gopi chandan, itra, mala and puja items — handcrafted in Vrindavan and delivered across India." },
      { property: "og:title", content: "Shri Radha Govind Store — Sacred Vrindavan Essentials" },
      { property: "og:description", content: "Shop authentic Vrindavan products — poshak, chandan, itra, mala, puja items. Free shipping above ₹999." },
      { property: "og:url", content: "https://shriradhagovindstore.com/" },
    ],
    links: [{ rel: "canonical", href: "https://shriradhagovindstore.com/" }],
    scripts: [{
      type: "application/ld+json",
      children: JSON.stringify({
        "@context": "https://schema.org",
        "@type": "Organization",
        name: "Shri Radha Govind Store",
        url: "https://shriradhagovindstore.com/",
        description: "Sacred essentials from Vrindavan — poshak, chandan, itra, mala, puja items.",
      }),
    }],
  }),
});

function Home() {
  const { adminProducts } = useStore();
  const featured = adminProducts.slice(0, 8);
  return (
    <Layout>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="container-app py-14 md:py-24 grid md:grid-cols-2 gap-10 items-center">
          <div className="reveal-up">
            <p className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.25em] text-primary mb-5">
              <Sparkles className="h-3.5 w-3.5" /> Blessed in Vrindavan
            </p>
            <h1 className="font-display text-5xl md:text-7xl leading-[1.05]">
              Sacred treasures<br />
              <span className="italic text-primary">from the holy land.</span>
            </h1>
            <p className="mt-5 text-muted-foreground max-w-md">
              Authentic Krishna & Radha Rani poshak, gopi chandan, itra and puja items — sourced directly from Vrindavan artisans.
            </p>
            <div className="mt-7 flex gap-3">
              <Link to="/shop" className="fx-button icon-bounce inline-flex items-center gap-2 h-12 px-6 rounded-full bg-primary text-primary-foreground font-medium">
                Explore Collection <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/shop" className="fx-button inline-flex items-center h-12 px-6 rounded-full border border-foreground/20 bg-card/55 hover:border-primary hover:text-primary">
                New Arrivals
              </Link>
            </div>
            <div className="mt-10 grid grid-cols-3 gap-4 max-w-md">
              {[["50K+","Devotees"],["4.9★","Rating"],["100%","Authentic"]].map(([n,l]) => (
                <div key={l}><div className="font-display text-2xl">{n}</div><div className="text-xs text-muted-foreground uppercase tracking-wider">{l}</div></div>
              ))}
            </div>
          </div>
          <div className="relative reveal-up reveal-delay-1">
            <div className="card-3d aspect-[4/5] rounded-3xl overflow-hidden premium-shadow">
              <img src={heroKrishna} alt="Krishna" className="h-full w-full object-cover" />
            </div>
            <div className="glass-panel float-soft absolute -bottom-6 -left-6 rounded-2xl p-5 hidden md:block">
              <div className="flex items-center gap-3">
                <Flower2 className="h-8 w-8 text-primary" />
                <div>
                  <p className="font-display text-lg leading-none">Hare Krishna</p>
                  <p className="text-xs text-muted-foreground mt-1">Made with devotion</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trust */}
      <section className="container-app reveal-up reveal-delay-2 grid grid-cols-2 md:grid-cols-4 gap-4 py-6">
        {([
          { Icon: Truck, t: "Free shipping", d: "On orders above ₹999" },
          { Icon: ShieldCheck, t: "100% Authentic", d: "Sourced from Vrindavan" },
          { Icon: Sparkles, t: "Temple blessed", d: "Energised at ISKCON" },
          { Icon: Flower2, t: "Easy returns", d: "7-day return policy" },
        ]).map(({ Icon, t, d }) => (
          <div key={t} className="premium-card p-5 flex items-center gap-3">
            <Icon className="h-6 w-6 text-primary shrink-0" />
            <div><p className="font-medium text-sm">{t}</p><p className="text-xs text-muted-foreground">{d}</p></div>
          </div>
        ))}
      </section>

      {/* Featured */}
      <section className="container-app py-14">
        <div className="flex items-end justify-between mb-8">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-primary mb-2">Curated for you</p>
            <h2 className="font-display text-4xl md:text-5xl">Featured Treasures</h2>
          </div>
          <Link to="/shop" className="text-sm hover:text-primary inline-flex items-center gap-1">View all <ArrowRight className="h-4 w-4" /></Link>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {featured.map((p) => <ProductCard key={p.id} product={p} />)}
        </div>
      </section>

      {/* Banner */}
      <section className="container-app py-14">
        <div className="gold-accent relative overflow-hidden rounded-3xl p-10 text-center text-white md:p-16">
          <p className="text-xs uppercase tracking-[0.3em] opacity-80 mb-3">Janmashtami Special</p>
          <h2 className="font-display text-4xl md:text-6xl">Adorn your Laddu Gopal</h2>
          <p className="mt-3 max-w-xl mx-auto opacity-90">Exclusive poshak, jewellery & shringar sets — handcrafted by master artisans of Vrindavan.</p>
          <Link to="/shop" className="fx-button mt-6 inline-flex h-12 px-7 rounded-full bg-white text-primary font-medium items-center">Shop the collection</Link>
        </div>
      </section>
    </Layout>
  );
}
