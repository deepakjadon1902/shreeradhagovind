import { Link, useNavigate } from "@tanstack/react-router";
import { Heart, Search, ShoppingBag, User, Menu, X } from "lucide-react";
import { useState } from "react";
import { useStore } from "@/lib/store";

export function Header() {
  const { cart, wishlist, user } = useStore();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const nav = useNavigate();
  const cartCount = cart.reduce((s, i) => s + i.qty, 0);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    nav({ to: "/shop", search: { q } as never });
  };

  return (
    <header className="sticky top-0 z-40 bg-background/85 backdrop-blur-md border-b border-border/60">
      <div className="bg-primary/95 text-primary-foreground text-xs">
        <div className="container-app py-1.5 text-center tracking-wide">
          ॥ Radhe Radhe ॥ &nbsp;·&nbsp; Free shipping above ₹999 across India
        </div>
      </div>
      <div className="container-app flex h-16 items-center gap-4">
        <button className="md:hidden" onClick={() => setOpen(!open)} aria-label="Menu">
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
        <Link to="/" className="flex items-center gap-2">
          <span className="h-9 w-9 rounded-full gold-accent grid place-items-center text-white font-display text-lg">वृ</span>
          <span className="font-display text-2xl leading-none">Vrindavan<span className="text-primary">.</span></span>
        </Link>
        <nav className="hidden md:flex items-center gap-6 ml-6 text-sm">
          <Link to="/" className="hover:text-primary" activeProps={{ className: "text-primary" }} activeOptions={{ exact: true }}>Home</Link>
          <Link to="/shop" className="hover:text-primary" activeProps={{ className: "text-primary" }}>Shop</Link>
          <Link to="/orders" className="hover:text-primary" activeProps={{ className: "text-primary" }}>Orders</Link>
        </nav>
        <form onSubmit={submit} className="hidden md:flex flex-1 max-w-md mx-4 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Search dresses, chandan, itra…"
            className="w-full h-10 pl-10 pr-4 rounded-full bg-muted/60 border border-transparent focus:bg-card focus:border-primary/40 focus:outline-none text-sm"
          />
        </form>
        <div className="flex items-center gap-1 ml-auto md:ml-0">
          <Link to="/wishlist" className="relative p-2.5 rounded-full hover:bg-muted" aria-label="Wishlist">
            <Heart className="h-5 w-5" />
            {wishlist.length > 0 && <Badge>{wishlist.length}</Badge>}
          </Link>
          <Link to="/cart" className="relative p-2.5 rounded-full hover:bg-muted" aria-label="Cart">
            <ShoppingBag className="h-5 w-5" />
            {cartCount > 0 && <Badge>{cartCount}</Badge>}
          </Link>
          <Link to={user ? "/profile" : "/login"} className="hidden sm:flex items-center gap-2 p-2.5 rounded-full hover:bg-muted">
            <User className="h-5 w-5" />
            <span className="text-sm font-medium">{user ? user.name.split(" ")[0] : "Sign in"}</span>
          </Link>
        </div>
      </div>
      {open && (
        <div className="md:hidden border-t border-border bg-card">
          <div className="container-app py-3 flex flex-col gap-2">
            <form onSubmit={submit} className="relative mb-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className="w-full h-10 pl-10 pr-4 rounded-full bg-muted/60 text-sm focus:outline-none" />
            </form>
            {[["/","Home"],["/shop","Shop"],["/orders","Orders"],["/profile","Profile"]].map(([to,l]) => (
              <Link key={to} to={to} onClick={() => setOpen(false)} className="py-2 text-sm hover:text-primary">{l}</Link>
            ))}
          </div>
        </div>
      )}
    </header>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return <span className="absolute -top-0.5 -right-0.5 h-5 min-w-5 px-1 rounded-full bg-primary text-primary-foreground text-[10px] grid place-items-center font-semibold">{children}</span>;
}
