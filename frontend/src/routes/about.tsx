import { createFileRoute, Link } from "@tanstack/react-router";
import { Layout } from "@/components/Layout";
import { MapPin, Phone, Mail, Globe, Heart, Sparkles, ShieldCheck, Truck } from "lucide-react";

export const Route = createFileRoute("/about")({
  component: AboutPage,
  head: () => ({
    meta: [
      { title: "About Us — Shri Radha Govind Store · Vrindavan" },
      { name: "description", content: "Learn the story behind Shri Radha Govind Store — devotional essentials, deity poshak and sacred gifts curated from the holy land of Vrindavan." },
      { property: "og:title", content: "About Us — Shri Radha Govind Store" },
      { property: "og:description", content: "Devotional essentials hand-curated from Vrindavan, delivered with love across India." },
      { property: "og:url", content: "https://shriradhagovindstore.com/about" },
    ],
    links: [{ rel: "canonical", href: "https://shriradhagovindstore.com/about" }],
  }),
});

function AboutPage() {
  return (
    <Layout>
      <section className="container-app py-12 md:py-20">
        <header className="text-center max-w-3xl mx-auto">
          <p className="text-xs uppercase tracking-[0.25em] text-primary mb-3">॥ Radhe Radhe ॥</p>
          <h1 className="font-display text-4xl md:text-5xl text-foreground">Shri Radha Govind Store</h1>
          <p className="text-muted-foreground mt-4 text-lg">
            A sacred destination born in the heart of Vrindavan — bringing the bhakti, beauty and craftsmanship
            of the dham to devotees across India and the world.
          </p>
          <div className="flex flex-wrap gap-2 justify-center mt-6">
            {["Pure Bhakti", "Vrindavan Crafted", "Devotee Trusted", "Pan-India Shipping"].map((p) => (
              <span key={p} className="px-4 py-1.5 rounded-full bg-card border border-border text-sm">{p}</span>
            ))}
          </div>
        </header>

        <div className="grid md:grid-cols-2 gap-8 mt-14">
          <article className="bg-card border border-border rounded-2xl p-7 premium-shadow">
            <h2 className="font-display text-2xl text-primary mb-3">Our Story</h2>
            <p className="text-foreground/80 leading-relaxed">
              Shri Radha Govind Store began as a humble seva in the lanes of Madan Mohan Ghera, Vrindavan —
              offering devotees authentic poshak, malas, deities and pooja essentials sourced directly from local
              artisans. Each item is a small offering of love at the lotus feet of Shri Radha Govind Dev Ji.
            </p>
          </article>
          <article className="bg-card border border-border rounded-2xl p-7 premium-shadow">
            <h2 className="font-display text-2xl text-primary mb-3">Our Mission</h2>
            <p className="text-foreground/80 leading-relaxed">
              To make the divine atmosphere of Vrindavan accessible to every devotee — through sacred,
              ethically crafted products, transparent pricing, and seva-driven customer care.
            </p>
          </article>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-10">
          {[
            { icon: Heart, t: "Made with Bhakti", d: "Every item is selected and packed as an offering." },
            { icon: Sparkles, t: "Authentic & Pure", d: "Sourced from Vrindavan's most trusted artisans." },
            { icon: ShieldCheck, t: "Secure Payments", d: "Razorpay verified · COD available on most pincodes." },
            { icon: Truck, t: "Pan-India Delivery", d: "Ekart, DTDC, India Post, Delhivery & Shree Maruti." },
          ].map(({ icon: I, t, d }) => (
            <div key={t} className="bg-card border border-border rounded-2xl p-5">
              <I className="h-5 w-5 text-primary" />
              <p className="font-display text-lg mt-3">{t}</p>
              <p className="text-sm text-muted-foreground mt-1">{d}</p>
            </div>
          ))}
        </div>

        <section className="mt-14 bg-primary/5 border border-primary/20 rounded-2xl p-7">
          <h2 className="font-display text-2xl text-primary mb-4">Visit Us in Vrindavan</h2>
          <div className="grid md:grid-cols-2 gap-6 text-sm">
            <p className="flex items-start gap-3"><MapPin className="h-4 w-4 mt-1 text-primary shrink-0" />
              Shri Radha Govind Store, 155, 2nd Floor, Madan Mohan Ghera,<br />Vrindavan, Mathura, Uttar Pradesh – 281121, India
            </p>
            <div className="space-y-2">
              <p className="flex items-center gap-3"><Phone className="h-4 w-4 text-primary" /> +91 7500533505</p>
              <p className="flex items-center gap-3"><Mail className="h-4 w-4 text-primary" /> support@shriradhagovindstore.com</p>
              <p className="flex items-center gap-3"><Mail className="h-4 w-4 text-primary" /> shriradhagovindstore@gmail.com</p>
              <p className="flex items-center gap-3"><Globe className="h-4 w-4 text-primary" /> shriradhagovindstore.com</p>
            </div>
          </div>
          <div className="mt-6">
            <Link to="/contact" className="inline-flex h-11 px-6 rounded-full bg-primary text-primary-foreground items-center text-sm font-medium">Contact us</Link>
          </div>
        </section>
      </section>
    </Layout>
  );
}
