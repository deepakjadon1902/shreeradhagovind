import { Link, useNavigate } from "@tanstack/react-router";
import { Heart, Search, ShoppingCart, User, Menu, X, Newspaper, Star, UserPlus, ChevronDown, LogOut, Package } from "lucide-react";
import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
const logo = "/shriradhagovind%20store%20logo.jpeg";

export function Header() {
  const { cart, wishlist, user, settings, categoryTree, logout } = useStore();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [openCategory, setOpenCategory] = useState<string | null>(null);
  const [accountOpen, setAccountOpen] = useState(false);
  const [accountPinned, setAccountPinned] = useState(false);
  const nav = useNavigate();
  const cartCount = cart.reduce((s, i) => s + i.qty, 0);

  useEffect(() => {
    const close = (event?: Event) => {
      if (event instanceof PointerEvent && (event.target as Element | null)?.closest?.("[data-header-popup]")) return;
      setOpenCategory(null);
      setAccountOpen(false);
      setAccountPinned(false);
    };
    document.addEventListener("pointerdown", close);
    window.addEventListener("scroll", close, { passive: true });
    return () => { document.removeEventListener("pointerdown", close); window.removeEventListener("scroll", close); };
  }, []);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    nav({ to: "/shop", search: { q } as never });
    setOpen(false);
  };

  return (
    <header className="glass-panel sticky top-0 z-40 border-b border-white/60 shadow-sm">
      <div className="border-b border-border bg-primary text-primary-foreground text-xs">
        <div className="container-app flex h-8 items-center justify-center text-center font-medium tracking-wide">
          {settings.announcement}
        </div>
      </div>

      <div className="container-app flex h-[72px] items-center gap-3">
        <button className="grid h-10 w-10 place-items-center rounded-md border md:hidden" onClick={() => setOpen(!open)} aria-label="Menu">
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>

        <Link to="/" className="neo-surface flex h-14 w-[116px] shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white transition-transform duration-300 hover:-translate-y-0.5 hover:scale-[1.02]">
          <img src={logo} alt="Shri Radha Govind Store" className="h-full w-full object-contain p-1" />
        </Link>

        <form onSubmit={submit} className="hidden md:flex h-12 flex-1 overflow-hidden rounded-md border border-primary/30 bg-white shadow-sm focus-within:border-primary">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search Prasadam, Books, Shringar..."
            className="min-w-0 flex-1 px-5 text-sm outline-none"
          />
          <button className="fx-button icon-bounce grid w-16 place-items-center bg-accent text-accent-foreground" aria-label="Search">
            <Search className="h-5 w-5" />
          </button>
        </form>

        <nav className="ml-auto hidden items-center gap-2 md:flex">
          <Action to="/blog" icon={Newspaper} label="Blog" />
          <Action to="/wishlist" icon={Heart} label="Wishlist" count={wishlist.length} />
          <Action to="/cart" icon={ShoppingCart} label="Cart" count={cartCount} />
          <Action to="/wishlist" icon={Star} label="Favorite" count={wishlist.length} />
          {user ? (
            <div data-header-popup className="relative" onMouseEnter={() => setAccountOpen(true)} onMouseLeave={() => { if (!accountPinned) setAccountOpen(false); }}>
              <button onClick={() => { const next = !accountPinned; setAccountPinned(next); setAccountOpen(next); }} className="fx-button icon-bounce inline-flex h-10 items-center gap-2 rounded-full border border-primary px-4 text-sm font-semibold text-primary hover:bg-primary hover:text-primary-foreground" aria-expanded={accountOpen}>
                <User className="h-4 w-4" /> {user.name.split(" ")[0]} <ChevronDown className={`h-3.5 w-3.5 transition ${accountOpen ? "rotate-180" : ""}`} />
              </button>
              {accountOpen && <AccountMenu wishlistCount={wishlist.length} onNavigate={() => { setAccountOpen(false); setAccountPinned(false); }} onLogout={() => { setAccountOpen(false); setAccountPinned(false); logout(); }} />}
            </div>
          ) : (
            <Link to="/login" className="fx-button icon-bounce inline-flex h-10 items-center gap-2 rounded-full border border-primary px-4 text-sm font-semibold text-primary hover:bg-primary hover:text-primary-foreground"><User className="h-4 w-4" /> Login</Link>
          )}
          {!user && (
            <Link to="/signup" className="fx-button icon-bounce inline-flex h-10 items-center gap-2 rounded-full bg-accent px-4 text-sm font-semibold text-accent-foreground">
              <UserPlus className="h-4 w-4" />
              Sign Up
            </Link>
          )}
        </nav>

        <div className="ml-auto flex items-center gap-1 md:hidden">
          <Link to="/cart" className="relative grid h-10 w-10 place-items-center rounded-md border" aria-label="Cart">
            <ShoppingCart className="h-5 w-5" />
            {cartCount > 0 && <Badge>{cartCount}</Badge>}
          </Link>
          <Link to={user ? "/profile" : "/login"} className="grid h-10 w-10 place-items-center rounded-md border" aria-label="Login">
            <User className="h-5 w-5" />
          </Link>
        </div>
      </div>

      <div className="hidden border-t border-border bg-secondary md:block">
        <div className="container-app flex h-12 items-center gap-1">
          <Link to="/shop" className="inline-flex h-10 shrink-0 items-center gap-2 rounded-md px-3 text-sm font-semibold hover:bg-card">
            <Menu className="h-4 w-4" />
            All
          </Link>
          {categoryTree.map((category) => (
            <div data-header-popup key={category.id} className="relative h-12 shrink-0" onMouseEnter={() => setOpenCategory(category.id)} onMouseLeave={() => setOpenCategory(null)}>
              <Link to="/shop" search={{ cat: category.name } as never} onClick={() => setOpenCategory(null)} className="inline-flex h-12 items-center rounded-md px-4 text-sm font-semibold text-foreground/85 transition hover:bg-card hover:text-primary">
                {category.name}
              </Link>
              {category.children.length > 0 && openCategory === category.id && (
                <div className="glass-panel absolute left-0 top-[calc(100%-2px)] z-50 min-w-56 animate-in fade-in slide-in-from-top-2 rounded-xl p-2 shadow-xl duration-150">
                  <p className="px-3 py-2 text-[10px] font-bold uppercase tracking-[.16em] text-muted-foreground">{category.name}</p>
                  {category.children.map((child) => (
                    <Link key={child.id} to="/shop" search={{ cat: child.name } as never} onClick={() => setOpenCategory(null)} className="block rounded-lg px-3 py-2 text-sm font-medium transition hover:bg-primary hover:text-primary-foreground">
                      {child.name}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {open && (
        <div className="border-t border-border bg-card md:hidden">
          <div className="container-app py-3">
            <form onSubmit={submit} className="mb-3 flex h-11 overflow-hidden rounded-md border border-primary/30 bg-white">
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products..." className="min-w-0 flex-1 px-4 text-sm outline-none" />
              <button className="grid w-12 place-items-center bg-accent text-accent-foreground" aria-label="Search">
                <Search className="h-5 w-5" />
              </button>
            </form>
            <div className="grid grid-cols-2 gap-1">
              <Link to="/blog" onClick={() => setOpen(false)} className="rounded-md px-3 py-2 text-sm font-medium hover:bg-muted">Blog</Link>
              <Link to="/wishlist" onClick={() => setOpen(false)} className="rounded-md px-3 py-2 text-sm font-medium hover:bg-muted">Wishlist</Link>
              <Link to="/cart" onClick={() => setOpen(false)} className="rounded-md px-3 py-2 text-sm font-medium hover:bg-muted">Cart</Link>
              {categoryTree.map((category) => (
                <div key={category.id} className="rounded-lg border border-border/60 p-1">
                  <Link to="/shop" search={{ cat: category.name } as never} onClick={() => setOpen(false)} className="block rounded-md px-3 py-2 text-sm font-semibold hover:bg-muted">{category.name}</Link>
                  {category.children.map((child) => <Link key={child.id} to="/shop" search={{ cat: child.name } as never} onClick={() => setOpen(false)} className="block rounded-md px-5 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-primary">{child.name}</Link>)}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

function Action({ to, icon: Icon, label, count = 0 }: { to: string; icon: React.ComponentType<{ className?: string }>; label: string; count?: number }) {
  return (
    <Link to={to} className="icon-bounce relative flex min-w-14 flex-col items-center gap-0.5 rounded-md px-2 py-1.5 text-[11px] font-medium transition-all duration-200 hover:-translate-y-0.5 hover:bg-white/60 hover:text-primary">
      <Icon className="h-5 w-5" />
      <span>{label}</span>
      {count > 0 && <Badge>{count}</Badge>}
    </Link>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">{children}</span>;
}

function AccountMenu({ wishlistCount, onNavigate, onLogout }: { wishlistCount: number; onNavigate: () => void; onLogout: () => void }) {
  return <div className="glass-panel absolute right-0 top-[calc(100%+8px)] z-50 w-64 animate-in fade-in slide-in-from-top-2 rounded-2xl p-2 shadow-2xl duration-150"><p className="px-3 pb-2 pt-2 text-[10px] font-bold uppercase tracking-[.18em] text-muted-foreground">My account</p><AccountLink to="/profile" icon={User} label="Profile & address" onClick={onNavigate} /><AccountLink to="/orders" icon={Package} label="Order history" onClick={onNavigate} /><AccountLink to="/wishlist" icon={Heart} label="Wishlist & favorites" count={wishlistCount} onClick={onNavigate} /><button onClick={onLogout} className="mt-1 flex w-full items-center gap-3 rounded-xl border-t px-3 py-3 text-sm font-medium text-destructive transition hover:bg-destructive/10"><LogOut className="h-4 w-4" /> Logout</button></div>;
}

function AccountLink({ to, icon: Icon, label, count, onClick }: { to: string; icon: typeof User; label: string; count?: number; onClick: () => void }) {
  return <Link to={to} onClick={onClick} className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition hover:bg-primary hover:text-primary-foreground"><Icon className="h-4 w-4" /><span className="flex-1">{label}</span>{count !== undefined && <span className="rounded-full bg-current/10 px-2 py-0.5 text-xs">{count}</span>}</Link>;
}
