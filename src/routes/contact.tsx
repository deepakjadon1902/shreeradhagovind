import { createFileRoute } from "@tanstack/react-router";
import { Layout } from "@/components/Layout";
import { useState } from "react";
import { toast } from "sonner";
import { MapPin, Phone, Mail, Globe, MessageCircle, Send } from "lucide-react";

export const Route = createFileRoute("/contact")({
  component: ContactPage,
  head: () => ({
    meta: [
      { title: "Contact Us — Shri Radha Govind Store" },
      { name: "description", content: "Reach Shri Radha Govind Store in Vrindavan for orders, custom poshak and devotional queries. Call +91 7500533505 or email support@shriradhagovindstore.com." },
      { property: "og:title", content: "Contact Us — Shri Radha Govind Store" },
      { property: "og:description", content: "Call, email or visit our Vrindavan store. We respond within 24 hours." },
      { property: "og:url", content: "https://shreeradhagovind.lovable.app/contact" },
    ],
    links: [{ rel: "canonical", href: "https://shreeradhagovind.lovable.app/contact" }],
  }),
});

function ContactPage() {
  const [form, setForm] = useState({ name: "", email: "", phone: "", subject: "", message: "" });
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.message) return toast.error("Please fill name, email and message");
    const body = encodeURIComponent(`From: ${form.name} (${form.email}, ${form.phone})\n\n${form.message}`);
    window.location.href = `mailto:support@shriradhagovindstore.com?subject=${encodeURIComponent(form.subject || "Website enquiry")}&body=${body}`;
    toast.success("Opening your mail app…");
  };

  return (
    <Layout>
      <section className="container-app py-12 md:py-16">
        <header className="text-center max-w-2xl mx-auto">
          <p className="text-xs uppercase tracking-[0.25em] text-primary mb-3">Reach Out</p>
          <h1 className="font-display text-4xl md:text-5xl">Contact Us</h1>
          <p className="text-muted-foreground mt-3">We usually respond within 24 working hours.</p>
        </header>

        <div className="grid lg:grid-cols-5 gap-6 mt-10">
          <aside className="lg:col-span-2 space-y-4">
            <InfoCard icon={MapPin} title="Store Address">
              Shri Radha Govind Store<br />155, 2nd Floor, Madan Mohan Ghera<br />Vrindavan, Mathura, Uttar Pradesh – 281121
            </InfoCard>
            <InfoCard icon={Phone} title="Customer Care">
              <a href="tel:+917500533505" className="text-primary hover:underline">+91 7500533505</a>
              <br /><span className="text-xs text-muted-foreground">Mon – Sat · 10 AM – 7 PM IST</span>
            </InfoCard>
            <InfoCard icon={Mail} title="Email">
              <a href="mailto:support@shriradhagovindstore.com" className="text-primary hover:underline">support@shriradhagovindstore.com</a>
              <br /><a href="mailto:shriradhagovindstore@gmail.com" className="text-primary hover:underline">shriradhagovindstore@gmail.com</a>
            </InfoCard>
            <InfoCard icon={Globe} title="Website">
              <a href="https://shriradhagovindstore.com" target="_blank" rel="noreferrer" className="text-primary hover:underline">shriradhagovindstore.com</a>
            </InfoCard>
            <a href="https://wa.me/917500533505" target="_blank" rel="noreferrer" className="flex items-center gap-3 bg-green-600 text-white rounded-2xl p-5 hover:bg-green-700 transition">
              <MessageCircle className="h-5 w-5" />
              <div>
                <p className="font-medium">Chat on WhatsApp</p>
                <p className="text-xs opacity-90">Quickest way to reach our seva team</p>
              </div>
            </a>
          </aside>

          <form onSubmit={submit} className="lg:col-span-3 bg-card border border-border rounded-2xl p-6 md:p-8 premium-shadow space-y-4">
            <h2 className="font-display text-2xl">Send us a message</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <Input label="Your name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} required />
              <Input label="Email" type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} required />
              <Input label="Phone (optional)" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
              <Input label="Subject" value={form.subject} onChange={(v) => setForm({ ...form, subject: v })} />
            </div>
            <label className="block text-sm">
              <span className="text-muted-foreground text-xs">Message</span>
              <textarea required rows={5} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} className="mt-1 w-full rounded-xl border border-border bg-background p-3 focus:outline-none focus:border-primary" />
            </label>
            <button type="submit" className="inline-flex items-center gap-2 h-11 px-6 rounded-full bg-primary text-primary-foreground font-medium hover:opacity-90"><Send className="h-4 w-4" /> Send message</button>
          </form>
        </div>
      </section>
    </Layout>
  );
}

function InfoCard({ icon: Icon, title, children }: { icon: typeof MapPin; title: string; children: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-5">
      <div className="flex items-center gap-2 text-primary"><Icon className="h-4 w-4" /><span className="text-xs uppercase tracking-wider font-semibold">{title}</span></div>
      <div className="text-sm mt-2 text-foreground/85 leading-relaxed">{children}</div>
    </div>
  );
}
function Input({ label, value, onChange, type = "text", required }: { label: string; value: string; onChange: (v: string) => void; type?: string; required?: boolean }) {
  return (
    <label className="block text-sm">
      <span className="text-muted-foreground text-xs">{label}</span>
      <input required={required} type={type} value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 w-full h-11 rounded-xl border border-border bg-background px-3 focus:outline-none focus:border-primary" />
    </label>
  );
}
