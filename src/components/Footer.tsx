import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Youtube, Instagram, Facebook, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { useStore } from "@/lib/store";
import logo from "@/assets/logo.jpeg.asset.json";

export function Footer() {
  const { settings } = useStore();
  const [email, setEmail] = useState("");

  const subscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.includes("@")) return toast.error("Please enter a valid email");
    toast.success("Subscribed! Use code WELCOME10 at checkout.");
    setEmail("");
  };

  const scrollTop = () => window.scrollTo({ top: 0, behavior: "smooth" });

  return (
    <footer className="mt-20 bg-muted/50 border-t border-border relative">
      <div className="container-app py-14 grid gap-10 md:grid-cols-2">
        {/* Left: Welcome */}
        <div className="space-y-5">
          <div className="flex items-center gap-3">
            <img src={logo.url} alt={settings.siteName} className="h-14 w-14 rounded-full object-cover ring-1 ring-primary/30" />
            <h3 className="font-display text-2xl md:text-3xl font-semibold">Welcome to {settings.siteName}</h3>
          </div>
          <p className="text-sm text-foreground/80 leading-relaxed max-w-md">
            Your one-stop spiritual destination for divine malas, pooja essentials & sacred gifts.
            Experience devotion in every product, delivered with love from Vrindavan.
          </p>
          <div className="border-t border-border pt-5 text-center max-w-md">
            <p className="font-semibold text-primary tracking-wide">GSTIN: 09CHYPN5573J1Z9</p>
            <p className="text-xs text-muted-foreground mt-1">Registered Devotional Store</p>
          </div>
          <div className="border-t border-border pt-5 flex items-center gap-3 max-w-md justify-center">
            <a href="https://youtube.com" target="_blank" rel="noreferrer" aria-label="YouTube"
              className="h-10 w-10 rounded-full bg-red-600 text-white grid place-items-center hover:scale-110 transition">
              <Youtube className="h-5 w-5" />
            </a>
            <a href="https://instagram.com" target="_blank" rel="noreferrer" aria-label="Instagram"
              className="h-10 w-10 rounded-full text-white grid place-items-center hover:scale-110 transition"
              style={{ background: "linear-gradient(135deg,#feda75,#fa7e1e,#d62976,#962fbf,#4f5bd5)" }}>
              <Instagram className="h-5 w-5" />
            </a>
            <a href="https://facebook.com" target="_blank" rel="noreferrer" aria-label="Facebook"
              className="h-10 w-10 rounded-full bg-blue-600 text-white grid place-items-center hover:scale-110 transition">
              <Facebook className="h-5 w-5" />
            </a>
          </div>
        </div>

        {/* Right: Newsletter + marketplaces */}
        <div className="space-y-5">
          <h3 className="font-display text-2xl md:text-3xl font-semibold">Newsletter</h3>
          <p className="text-sm text-primary font-medium">Get 10% off for your first order by joining our newsletter.</p>
          <form onSubmit={subscribe} className="flex items-center bg-card rounded-full border border-border shadow-sm overflow-hidden">
            <input
              type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              className="flex-1 px-5 h-12 bg-transparent focus:outline-none text-sm"
            />
            <button className="h-12 px-6 bg-primary text-primary-foreground text-sm font-semibold tracking-wide hover:opacity-90">
              SUBSCRIBE
            </button>
          </form>
          <div className="border-t border-border pt-5 text-center">
            <h4 className="font-semibold text-lg mb-4">We are Also Available On:</h4>
            <div className="flex items-center justify-around gap-4 flex-wrap">
              <Marketplace label="amazon" color="#FF9900" sublabel="" />
              <Marketplace label="Flipkart" color="#FFD500" textColor="#2874F0" />
              <Marketplace label="meesho" color="#F43397" />
            </div>
            <p className="text-xs text-muted-foreground mt-4">Marketplace prices may be higher due to platform fees.</p>
          </div>
        </div>
      </div>

      {/* Links bands */}
      <div className="border-t border-border">
        <div className="container-app py-10 grid gap-8 md:grid-cols-2">
          <div>
            <h4 className="font-display text-xl font-semibold mb-4">Support</h4>
            <ul className="space-y-3 text-sm text-foreground/85">
              <li><Link to="/" className="hover:text-primary">About</Link></li>
              <li><a href="#contact" className="hover:text-primary">Contact Us</a></li>
              <li><Link to="/orders" className="hover:text-primary">Track Order</Link></li>
              <li><Link to="/shop" className="hover:text-primary">Custom Poshak</Link></li>
              <li><Link to="/wishlist" className="hover:text-primary">Wishlist</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-display text-xl font-semibold mb-4">Help & Policies</h4>
            <ul className="space-y-3 text-sm text-foreground/85">
              <li><a href="#terms" className="hover:text-primary">Terms & Conditions</a></li>
              <li><a href="#privacy" className="hover:text-primary">Privacy Policy</a></li>
              <li><a href="#refund" className="hover:text-primary">Refund and Returns Policy</a></li>
              <li><a href="#shipping" className="hover:text-primary">Shipping Policy & Support</a></li>
            </ul>
          </div>
        </div>
      </div>

      <div className="border-t border-border bg-primary/5">
        <div className="container-app py-4 text-xs text-muted-foreground flex flex-wrap justify-between gap-2">
          <span>© {new Date().getFullYear()} {settings.siteName} · ॥ जय श्री राधे ॥</span>
          <span>Secure payments by Razorpay</span>
        </div>
      </div>

      {/* Floating WhatsApp + Scroll top */}
      <a
        href="https://wa.me/919876543210" target="_blank" rel="noreferrer" aria-label="WhatsApp"
        className="fixed bottom-5 left-5 h-12 w-12 rounded-full bg-green-500 text-white grid place-items-center shadow-lg hover:scale-110 transition z-30"
      >
        <svg viewBox="0 0 32 32" className="h-6 w-6 fill-current"><path d="M19.11 17.27c-.27-.14-1.62-.8-1.87-.89-.25-.09-.43-.14-.61.14-.18.27-.7.89-.86 1.07-.16.18-.32.2-.59.07-.27-.14-1.15-.42-2.19-1.35-.81-.72-1.36-1.61-1.52-1.88-.16-.27-.02-.41.12-.55.12-.12.27-.32.41-.48.14-.16.18-.27.27-.45.09-.18.05-.34-.02-.48-.07-.14-.61-1.47-.84-2.01-.22-.53-.45-.46-.61-.47l-.52-.01c-.18 0-.48.07-.73.34-.25.27-.95.93-.95 2.27 0 1.34.97 2.63 1.11 2.81.14.18 1.91 2.91 4.62 4.08.65.28 1.15.45 1.55.58.65.21 1.24.18 1.71.11.52-.08 1.62-.66 1.85-1.3.23-.64.23-1.18.16-1.3-.07-.11-.25-.18-.52-.32z"/><path d="M26.6 5.4A14.93 14.93 0 0 0 16 1C7.72 1 1 7.72 1 16c0 2.65.69 5.19 2 7.45L1 31l7.74-2.03A14.93 14.93 0 0 0 16 31c8.28 0 15-6.72 15-15 0-4-1.56-7.77-4.4-10.6zM16 28.5c-2.3 0-4.55-.62-6.52-1.79l-.47-.28-4.59 1.2 1.22-4.47-.3-.46A12.46 12.46 0 0 1 3.5 16C3.5 9.1 9.1 3.5 16 3.5S28.5 9.1 28.5 16 22.9 28.5 16 28.5z"/></svg>
      </a>
      <button
        onClick={scrollTop} aria-label="Scroll to top"
        className="fixed bottom-5 right-5 h-12 w-12 rounded-md bg-primary text-primary-foreground grid place-items-center shadow-lg hover:opacity-90 transition z-30"
      >
        <ChevronUp className="h-6 w-6" />
      </button>
    </footer>
  );
}

function Marketplace({ label, color, textColor = "#000", sublabel }: { label: string; color: string; textColor?: string; sublabel?: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="h-14 w-14 rounded-2xl grid place-items-center shadow-sm" style={{ background: color }}>
        <span className="font-bold text-sm" style={{ color: textColor }}>{label[0].toUpperCase()}</span>
      </div>
      <span className="text-xs font-medium">{label}</span>
      {sublabel && <span className="text-[10px] text-muted-foreground">{sublabel}</span>}
    </div>
  );
}
