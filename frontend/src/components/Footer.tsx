import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Youtube, Instagram, Facebook, Mail, Phone, MapPin } from "lucide-react";
import { toast } from "sonner";
import { useStore } from "@/lib/store";
const logo = "/shriradhagovind store logo.jpeg";

export function Footer() {
  const { settings } = useStore();
  const [email, setEmail] = useState("");

  const subscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.includes("@")) return toast.error("Please enter a valid email");
    toast.success("Subscribed. Use code WELCOME10 at checkout.");
    setEmail("");
  };

  return (
    <footer className="mt-16 shrink-0 border-t border-border bg-white">
      <div className="border-b border-border bg-secondary">
        <div className="container-app grid gap-4 py-5 sm:grid-cols-3">
          <Promise title="Fast Delivery" text="Across India from Vrindavan" />
          <Promise title="Authentic Products" text="Temple-sourced devotional items" />
          <Promise title="Easy Returns" text="Simple support-led return process" />
        </div>
      </div>

      <div className="container-app grid gap-8 py-10 lg:grid-cols-[1.2fr_2fr_1.1fr]">
        <section>
          <Link to="/" className="mb-4 flex items-center gap-3">
            <img
              src={logo}
              alt={settings.siteName}
              className="h-14 w-14 rounded-full border border-border bg-white object-contain"
            />
            <span className="max-w-48 text-lg font-semibold leading-tight">
              {settings.siteName}
            </span>
          </Link>
          <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
            Authentic malas, pooja essentials, poshak, shringar and sacred gifts delivered with care
            from Vrindavan.
          </p>
          <div className="mt-5 flex items-center gap-2">
            <Social href="https://youtube.com" label="YouTube" icon={Youtube} />
            <Social href="https://instagram.com" label="Instagram" icon={Instagram} />
            <Social href="https://facebook.com" label="Facebook" icon={Facebook} />
          </div>
        </section>

        <section className="grid gap-6 sm:grid-cols-3">
          <FooterLinks
            title="Shop"
            links={[
              ["All Products", "/shop"],
              ["Puja Items", "/shop"],
              ["Wishlist", "/wishlist"],
              ["Track Order", "/track"],
            ]}
          />
          <FooterLinks
            title="Help"
            links={[
              ["About Us", "/about"],
              ["Contact Us", "/contact"],
              ["Shipping Policy", "/shipping"],
              ["Returns Policy", "/returns"],
              ["Privacy Policy", "/privacy"],
              ["Terms", "/terms"],
            ]}
          />
          <FooterLinks
            title="Account"
            links={[
              ["Login", "/login"],
              ["Sign Up", "/signup"],
              ["Orders", "/orders"],
              ["Profile", "/profile"],
              ["Cart", "/cart"],
            ]}
          />
        </section>

        <section>
          <h3 className="text-sm font-bold uppercase tracking-wide">Newsletter</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Get restock alerts, offers and new devotional collections.
          </p>
          <form
            onSubmit={subscribe}
            className="mt-4 flex h-11 overflow-hidden rounded-lg border border-border bg-white shadow-sm"
          >
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              placeholder="Enter email"
              className="min-w-0 flex-1 px-3 text-sm outline-none"
            />
            <button className="bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90">
              Subscribe
            </button>
          </form>
          <address className="mt-5 space-y-2 text-sm not-italic text-muted-foreground">
            <p className="flex gap-2">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              155, 2nd Floor, Madan Mohan Ghera, Vrindavan, Mathura, UP 281121
            </p>
            <p className="flex gap-2">
              <Phone className="h-4 w-4 shrink-0 text-primary" />
              <a href="tel:+917500533505" className="hover:text-primary">
                +91 7500533505
              </a>
            </p>
            <p className="flex gap-2">
              <Mail className="h-4 w-4 shrink-0 text-primary" />
              <a href={`mailto:${settings.supportEmail}`} className="break-all hover:text-primary">
                {settings.supportEmail}
              </a>
            </p>
          </address>
        </section>
      </div>

      <div className="border-t border-border bg-primary text-primary-foreground">
        <div className="container-app flex flex-wrap items-center justify-between gap-3 py-4 text-xs">
          <span>
            Copyright {new Date().getFullYear()} {settings.siteName}. All rights reserved.
          </span>
          <span>GSTIN: 09CHYPN5573J1Z9 | Secure payments by Razorpay</span>
        </div>
      </div>

      <a
        href="https://wa.me/917500533505"
        target="_blank"
        rel="noreferrer"
        aria-label="Chat on WhatsApp"
        className="whatsapp-bounce fixed bottom-5 right-5 z-50 grid h-14 w-14 place-items-center rounded-full bg-[#25D366] text-white shadow-[0_12px_30px_-10px_rgba(37,211,102,.8)] transition hover:scale-110 hover:bg-[#20bd5a]"
      >
        <svg viewBox="0 0 32 32" aria-hidden="true" className="h-8 w-8 fill-current">
          <path d="M16.04 3C9.39 3 4 8.27 4 14.77c0 2.3.68 4.55 1.96 6.47L4 28l6.95-1.82a12.2 12.2 0 0 0 5.08 1.1h.01c6.64 0 12.05-5.28 12.05-11.76C28.09 9.02 22.69 3 16.04 3Zm0 21.98h-.01a9.9 9.9 0 0 1-5.04-1.35l-.36-.21-4.12 1.08 1.1-4.02-.23-.37a9.46 9.46 0 0 1-1.5-5.34c0-5.23 4.56-9.48 10.17-9.48 5.6 0 10.16 4.25 10.16 9.48 0 5.23-4.56 10.21-10.17 10.21Zm5.58-7.66c-.3-.15-1.8-.87-2.08-.97-.28-.1-.48-.15-.69.15-.2.3-.79.97-.97 1.17-.18.2-.36.23-.66.08-.31-.15-1.29-.47-2.46-1.49a9.22 9.22 0 0 1-1.7-2.06c-.18-.3-.02-.46.13-.61.14-.14.31-.36.46-.54.15-.18.2-.31.31-.51.1-.2.05-.38-.03-.54-.08-.15-.69-1.62-.94-2.22-.25-.6-.5-.51-.69-.52h-.58c-.2 0-.53.08-.81.38-.28.31-1.06 1.02-1.06 2.48s1.09 2.87 1.24 3.08c.15.2 2.14 3.2 5.2 4.49.72.31 1.29.49 1.73.63.73.23 1.39.2 1.91.12.58-.09 1.8-.72 2.05-1.41.25-.69.25-1.28.18-1.41-.08-.13-.28-.2-.59-.35Z" />
        </svg>
      </a>
    </footer>
  );
}

function Promise({ title, text }: { title: string; text: string }) {
  return (
    <div>
      <p className="text-sm font-bold">{title}</p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">{text}</p>
    </div>
  );
}

function FooterLinks({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div>
      <h3 className="text-sm font-bold uppercase tracking-wide">{title}</h3>
      <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
        {links.map(([label, to]) => (
          <li key={label}>
            <Link to={to} className="hover:text-primary">
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Social({
  href,
  label,
  icon: Icon,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label={label}
      className="grid h-10 w-10 place-items-center rounded-md border border-border bg-white text-primary transition hover:border-primary/40 hover:bg-secondary"
    >
      <Icon className="h-5 w-5" />
    </a>
  );
}
