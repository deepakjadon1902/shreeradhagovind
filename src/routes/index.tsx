import { createFileRoute, Link } from "@tanstack/react-router";
import { Layout } from "@/components/Layout";
import { ProductCard } from "@/components/ProductCard";
import { PRODUCTS, CATEGORIES } from "@/lib/products";
import { ArrowRight, Sparkles, Truck, ShieldCheck, Flower2 } from "lucide-react";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const featured = PRODUCTS.slice(0, 8);
  return (
    <Layout>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="container-app py-14 md:py-24 grid md:grid-cols-2 gap-10 items-center">
          <div>
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
              <Link to="/shop" className="inline-flex items-center gap-2 h-12 px-6 rounded-full bg-primary text-primary-foreground font-medium hover:opacity-90 transition">
                Explore Collection <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/shop" className="inline-flex items-center h-12 px-6 rounded-full border border-foreground/20 hover:border-primary hover:text-primary transition">
                New Arrivals
              </Link>
            </div>
            <div className="mt-10 grid grid-cols-3 gap-4 max-w-md">
              {[["50K+","Devotees"],["4.9★","Rating"],["100%","Authentic"]].map(([n,l]) => (
                <div key={l}><div className="font-display text-2xl">{n}</div><div className="text-xs text-muted-foreground uppercase tracking-wider">{l}</div></div>
              ))}
            </div>
          </div>
          <div className="relative">
            <div className="aspect-[4/5] rounded-3xl overflow-hidden premium-shadow">
              <img src="https://images.unsplash.com/photo-1609858351150-2f865c1a8b6e?auto=format&fit=crop&w=900&q=80" alt="Krishna" className="h-full w-full object-cover" />
            </div>
            <div className="absolute -bottom-6 -left-6 bg-card rounded-2xl p-5 premium-shadow hidden md:block">
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

      {/* Categories */}
      <section className="container-app py-10">
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.slice(1).map((c) => (
            <Link key={c} to="/shop" className="px-5 h-10 inline-flex items-center rounded-full bg-muted hover:bg-primary hover:text-primary-foreground transition text-sm">{c}</Link>
          ))}
        </div>
      </section>

      {/* Trust */}
      <section className="container-app grid grid-cols-2 md:grid-cols-4 gap-4 py-6">
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
        <div className="rounded-3xl overflow-hidden relative gold-accent text-white p-10 md:p-16 text-center">
          <p className="text-xs uppercase tracking-[0.3em] opacity-80 mb-3">Janmashtami Special</p>
          <h2 className="font-display text-4xl md:text-6xl">Adorn your Laddu Gopal</h2>
          <p className="mt-3 max-w-xl mx-auto opacity-90">Exclusive poshak, jewellery & shringar sets — handcrafted by master artisans of Vrindavan.</p>
          <Link to="/shop" className="mt-6 inline-flex h-12 px-7 rounded-full bg-white text-primary font-medium items-center">Shop the collection</Link>
        </div>
      </section>
    </Layout>
  );
}
