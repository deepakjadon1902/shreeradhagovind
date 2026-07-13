import { createFileRoute, Link } from "@tanstack/react-router";
import { Layout } from "@/components/Layout";
import {
  ArrowRight,
  Globe,
  Heart,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  Sparkles,
  Truck,
} from "lucide-react";
import heroKrishna from "@/assets/hero-krishna.jpg";

export const Route = createFileRoute("/about")({
  component: AboutPage,
  head: () => ({
    meta: [
      { title: "About Us - Shri Radha Govind Store, Vrindavan" },
      {
        name: "description",
        content:
          "Learn about Shri Radha Govind Store, a Vrindavan devotional marketplace for poshak, mala, chandan, itra, puja essentials, gifts, and temple products.",
      },
      { property: "og:title", content: "About Us - Shri Radha Govind Store" },
      {
        property: "og:description",
        content:
          "Devotional essentials curated from Vrindavan and delivered with care across India.",
      },
      { property: "og:url", content: "https://www.shriradhagovindstore.com/about" },
    ],
    links: [{ rel: "canonical", href: "https://www.shriradhagovindstore.com/about" }],
  }),
});

function AboutPage() {
  return (
    <Layout>
      <section className="bg-[#212020] text-white">
        <div className="container-app grid gap-8 py-10 md:grid-cols-[1fr_420px] md:py-14">
          <div className="flex flex-col justify-center">
            <p className="mb-3 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.25em] text-[#ffd814]">
              <Sparkles className="h-4 w-4" /> Radhe Radhe from Vrindavan
            </p>
            <h1 className="font-display text-5xl leading-tight md:text-6xl">
              Shri Radha Govind Store
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-white/78 md:text-lg">
              A devotional marketplace from Madan Mohan Ghera, Vrindavan, created to bring authentic
              poshak, mala, chandan, itra, puja essentials, gifts, and temple collections to
              devotees across India.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              {[
                "Vrindavan sourced",
                "Devotee focused",
                "Secure checkout",
                "Pan-India delivery",
              ].map((label) => (
                <span
                  key={label}
                  className="rounded-md border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white"
                >
                  {label}
                </span>
              ))}
            </div>
            <Link
              to="/shop"
              className="mt-7 inline-flex h-11 w-fit items-center gap-2 rounded-md bg-[#ffd814] px-5 text-sm font-bold text-black"
            >
              Shop our collection <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="overflow-hidden rounded-lg border border-white/10">
            <img
              src={heroKrishna}
              alt="Shri Krishna"
              className="h-full min-h-72 w-full object-cover"
            />
          </div>
        </div>
      </section>

      <section className="container-app py-12 md:py-16">
        <div className="grid gap-5 md:grid-cols-[1.1fr_.9fr]">
          <article className="rounded-lg border border-border bg-white p-7 premium-shadow">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-muted-foreground">
              Our story
            </p>
            <h2 className="mt-2 font-display text-3xl text-black">
              A store built like seva, run like a trusted marketplace.
            </h2>
            <p className="mt-4 leading-relaxed text-muted-foreground">
              We started with a simple purpose: help devotees find authentic Vrindavan essentials
              without confusion, imitation, or unreliable delivery. Every collection is curated
              around daily bhakti, festival shringar, gifting, and temple use, with clear pricing
              and support.
            </p>
          </article>
          <article className="rounded-lg border border-border bg-[#f6f6f6] p-7">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-muted-foreground">
              What we sell
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2 text-sm font-semibold text-black">
              {[
                "Tulsi mala",
                "Puja essentials",
                "Itra & fragrance",
                "Jewellery",
                "Gifts & toys",
                "Temple collection",
                "Festival collection",
                "Combo packs",
              ].map((item) => (
                <span key={item} className="rounded-md bg-white px-3 py-2 shadow-sm">
                  {item}
                </span>
              ))}
            </div>
          </article>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              icon: Heart,
              t: "Packed with care",
              d: "Products are handled as devotional offerings.",
            },
            {
              icon: Sparkles,
              t: "Authentic selection",
              d: "Curated from Vrindavan and trusted suppliers.",
            },
            {
              icon: ShieldCheck,
              t: "Secure payments",
              d: "Razorpay support with COD where enabled.",
            },
            {
              icon: Truck,
              t: "Order tracking",
              d: "Courier, tracking ID, and status updates from admin.",
            },
          ].map(({ icon: Icon, t, d }) => (
            <div key={t} className="rounded-lg border border-border bg-card p-5 premium-shadow">
              <Icon className="h-5 w-5 text-primary" />
              <p className="mt-3 font-display text-lg">{t}</p>
              <p className="mt-1 text-sm text-muted-foreground">{d}</p>
            </div>
          ))}
        </div>

        <section className="mt-10 rounded-lg border border-border bg-white p-7 premium-shadow">
          <h2 className="mb-4 font-display text-3xl text-black">Visit Us in Vrindavan</h2>
          <div className="grid gap-6 text-sm md:grid-cols-2">
            <p className="flex items-start gap-3">
              <MapPin className="mt-1 h-4 w-4 shrink-0 text-primary" />
              <span>
                Shri Radha Govind Store, 155, 2nd Floor, Madan Mohan Ghera,
                <br />
                Vrindavan, Mathura, Uttar Pradesh - 281121, India
              </span>
            </p>
            <div className="space-y-2">
              <p className="flex items-center gap-3">
                <Phone className="h-4 w-4 text-primary" /> +91 7500533505
              </p>
              <p className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-primary" /> support@shriradhagovindstore.com
              </p>
              <p className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-primary" /> shriradhagovindstore@gmail.com
              </p>
              <p className="flex items-center gap-3">
                <Globe className="h-4 w-4 text-primary" /> shriradhagovindstore.com
              </p>
            </div>
          </div>
          <Link
            to="/contact"
            className="mt-6 inline-flex h-11 items-center rounded-md bg-primary px-6 text-sm font-semibold text-primary-foreground"
          >
            Contact us
          </Link>
        </section>
      </section>
    </Layout>
  );
}
