import { Link, useNavigate } from "@tanstack/react-router";
import {
  ChevronDown,
  ChevronRight,
  Heart,
  LogOut,
  Menu,
  Newspaper,
  Package,
  Search,
  ShoppingCart,
  Sparkles,
  Star,
  User,
  X,
} from "lucide-react";
import { useEffect, useState, type ComponentType, type FormEvent, type ReactNode } from "react";
import { useStore, type Category } from "@/lib/store";

const logo = "/brand-logo.webp";

export function Header() {
  const { cart, wishlist, user, settings, categoryTree, logout } = useStore();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [openCategory, setOpenCategory] = useState<string | null>(null);
  const [expandedDrawer, setExpandedDrawer] = useState<string | null>(null);
  const [accountOpen, setAccountOpen] = useState(false);
  const navigate = useNavigate();
  const cartCount = cart.reduce((sum, item) => sum + item.qty, 0);
  const firstName = user?.name.split(" ")[0] || "devotee";

  useEffect(() => {
    if (!drawerOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => event.key === "Escape" && setDrawerOpen(false);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [drawerOpen]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    navigate({ to: "/shop", search: { q: query } as never });
    setMobileOpen(false);
  };

  const closeMenus = () => {
    setOpenCategory(null);
    setAccountOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 shadow-md">
      <div className="bg-[#102f35] text-white">
        <div className="container-app flex min-h-[70px] flex-wrap items-center gap-2 py-2 sm:flex-nowrap sm:gap-4">
          <button
            onClick={() => setMobileOpen((value) => !value)}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-md border border-white/25 lg:hidden"
            aria-label="Toggle navigation"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>

          <Link to="/" onClick={closeMenus} className="flex shrink-0 items-center gap-2 rounded-md p-1 hover:outline hover:outline-1 hover:outline-white/60">
            <span className="grid h-12 w-12 place-items-center overflow-hidden rounded-full border border-[#d4aa50] bg-white">
              <img src={logo} alt="Shri Radha Govind Store" className="h-full w-full object-contain" />
            </span>
            <span className="hidden xl:block">
              <strong className="block font-display text-lg leading-none">Shri Radha Govind</strong>
              <small className="text-[10px] uppercase tracking-[.18em] text-[#efcf86]">Sacred marketplace</small>
            </span>
          </Link>

          <form onSubmit={submit} className="order-last flex h-11 w-full overflow-hidden rounded-lg bg-white text-foreground sm:order-none sm:flex-1">
            <select aria-label="Search category" className="hidden w-28 border-r bg-stone-100 px-2 text-xs outline-none md:block">
              <option>All</option>
              {categoryTree.map((category) => <option key={category.id}>{category.name}</option>)}
            </select>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search Tulsi mala, puja essentials and gifts" className="min-w-0 flex-1 px-4 text-sm outline-none" />
            <button className="grid w-14 place-items-center bg-[#d4a84d] text-[#102f35] transition hover:bg-[#e4bd68]" aria-label="Search"><Search className="h-5 w-5" /></button>
          </form>

          <nav className="ml-auto hidden shrink-0 items-center gap-1 lg:flex">
            <div className="relative" onMouseEnter={() => setAccountOpen(true)} onMouseLeave={() => setAccountOpen(false)}>
              <button onClick={() => setAccountOpen((value) => !value)} className="rounded-md px-3 py-2 text-left hover:outline hover:outline-1 hover:outline-white/60">
                <span className="block text-[11px]">Hello, {firstName}</span>
                <strong className="flex items-center text-sm">Account & Lists <ChevronDown className="h-3.5 w-3.5" /></strong>
              </button>
              {accountOpen && <AccountMenu user={!!user} wishlistCount={wishlist.length} onClose={() => setAccountOpen(false)} onLogout={() => logout()} />}
            </div>
            <Link to={user ? "/orders" : "/login"} className="rounded-md px-3 py-2 hover:outline hover:outline-1 hover:outline-white/60"><span className="block text-[11px]">Returns</span><strong className="text-sm">& Orders</strong></Link>
            <Link to="/wishlist" className="relative grid h-12 w-12 place-items-center rounded-md hover:outline hover:outline-1 hover:outline-white/60" aria-label="Wishlist"><Heart className="h-6 w-6" />{wishlist.length > 0 && <Badge>{wishlist.length}</Badge>}</Link>
            <Link to="/cart" className="relative flex h-12 items-end gap-1 rounded-md px-2 pb-2 hover:outline hover:outline-1 hover:outline-white/60"><ShoppingCart className="h-8 w-8" /><strong className="text-sm">Cart</strong>{cartCount > 0 && <Badge>{cartCount}</Badge>}</Link>
          </nav>

          <Link to="/cart" className="relative grid h-10 w-10 shrink-0 place-items-center lg:hidden" aria-label="Cart"><ShoppingCart className="h-6 w-6" />{cartCount > 0 && <Badge>{cartCount}</Badge>}</Link>
        </div>
      </div>

      <div className="bg-[#204e55] text-white">
        <div className="container-app flex h-11 items-center gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <button onClick={() => setDrawerOpen(true)} className="flex h-9 shrink-0 items-center gap-2 rounded px-3 text-sm font-bold hover:outline hover:outline-1 hover:outline-white"><Menu className="h-5 w-5" /> All</button>
          <Shortcut label="Trending" search="trending" />
          <Shortcut label="Today's Sacred Picks" search="sacred-picks" icon={Sparkles} />
          {categoryTree.map((category) => (
            <div key={category.id} className="relative h-11 shrink-0" onMouseEnter={() => setOpenCategory(category.id)} onMouseLeave={() => setOpenCategory(null)}>
              <Link to="/shop" search={{ cat: category.name } as never} className="flex h-11 items-center gap-1 rounded px-3 text-sm font-medium hover:bg-white/10">{category.name}{category.children.length > 0 && <ChevronDown className="h-3.5 w-3.5" />}</Link>
              {openCategory === category.id && category.children.length > 0 && <MegaMenu category={category} onClose={() => setOpenCategory(null)} />}
            </div>
          ))}
          <Link to="/blog" className="flex h-11 shrink-0 items-center gap-1 rounded px-3 text-sm font-medium hover:bg-white/10"><Newspaper className="h-4 w-4" /> Devotional Blog</Link>
        </div>
      </div>

      {settings.announcement && <div className="bg-[#f3dfad] px-4 py-1.5 text-center text-xs font-semibold text-[#173d43]">{settings.announcement}</div>}

      {mobileOpen && (
        <div className="border-b bg-white p-3 text-foreground lg:hidden">
          <div className="mb-2 flex gap-2"><Link to={user ? "/profile" : "/login"} onClick={() => setMobileOpen(false)} className="flex-1 rounded-lg bg-muted px-3 py-2 text-sm font-semibold">Hello, {firstName} · Account</Link><Link to={user ? "/orders" : "/login"} onClick={() => setMobileOpen(false)} className="rounded-lg bg-muted px-3 py-2 text-sm font-semibold">Orders</Link></div>
          <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">{categoryTree.map((category) => <Link key={category.id} to="/shop" search={{ cat: category.name } as never} onClick={() => setMobileOpen(false)} className="shrink-0 rounded-full border border-primary/20 px-4 py-2 text-sm font-medium">{category.name}</Link>)}</div>
        </div>
      )}

      <AllDrawer open={drawerOpen} categories={categoryTree} expanded={expandedDrawer} setExpanded={setExpandedDrawer} userName={firstName} onClose={() => setDrawerOpen(false)} />
    </header>
  );
}

function Shortcut({ label, search, icon: Icon }: { label: string; search: string; icon?: ComponentType<{ className?: string }> }) {
  return <Link to="/shop" search={{ q: search } as never} className="flex h-11 shrink-0 items-center gap-1.5 rounded px-3 text-sm font-medium hover:bg-white/10">{Icon && <Icon className="h-4 w-4 text-[#efcf86]" />}{label}</Link>;
}

function MegaMenu({ category, onClose }: { category: Category & { children: Category[] }; onClose: () => void }) {
  return <div className="absolute left-0 top-full z-50 w-[620px] rounded-b-xl border border-t-0 bg-white p-5 text-foreground shadow-2xl"><div className="grid grid-cols-[1fr_180px] gap-5"><div><p className="mb-3 text-xs font-bold uppercase tracking-[.15em] text-primary">Shop {category.name}</p><div className="grid grid-cols-2 gap-2">{category.children.map((child) => <Link key={child.id} to="/shop" search={{ cat: child.name } as never} onClick={onClose} className="group flex items-center gap-2 rounded-lg p-3 hover:bg-muted"><ChevronRight className="h-4 w-4 text-accent" /><span><strong className="block text-sm">{child.name}</strong><small className="text-muted-foreground">Explore collection</small></span></Link>)}</div></div><Link to="/shop" search={{ cat: category.name } as never} onClick={onClose} className="relative flex min-h-40 flex-col justify-end overflow-hidden rounded-xl bg-gradient-to-br from-[#174a50] to-[#28747b] p-4 text-white">{category.image && <img src={category.image} alt="" className="absolute inset-0 h-full w-full object-cover opacity-25" />}<Star className="relative mb-2 h-6 w-6 text-[#efcf86]" /><strong className="relative font-display text-xl">Sacred {category.name}</strong><span className="relative mt-1 text-xs text-white/75">View the complete collection →</span></Link></div></div>;
}

function AllDrawer({ open, categories, expanded, setExpanded, userName, onClose }: { open: boolean; categories: (Category & { children: Category[] })[]; expanded: string | null; setExpanded: (id: string | null) => void; userName: string; onClose: () => void }) {
  if (!open) return null;
  return <div className="fixed inset-0 z-[70] bg-black/65" onMouseDown={onClose}><aside role="dialog" aria-modal="true" aria-label="All store categories" className="h-full w-[min(92vw,390px)] overflow-y-auto bg-white text-foreground shadow-2xl" onMouseDown={(event) => event.stopPropagation()}><div className="sticky top-0 z-10 flex h-16 items-center justify-between bg-[#173d43] px-5 text-white"><Link to="/profile" onClick={onClose} className="flex items-center gap-3 text-lg font-bold"><User className="h-7 w-7" /> Hello, {userName}</Link><button onClick={onClose} className="rounded-md p-2 hover:bg-white/10" aria-label="Close menu"><X className="h-6 w-6" /></button></div><DrawerSection title="Trending"><DrawerLink label="Bestsellers" query="bestsellers" onClose={onClose} /><DrawerLink label="New Arrivals" query="new" onClose={onClose} /><DrawerLink label="Today's Sacred Picks" query="sacred-picks" onClose={onClose} /></DrawerSection><DrawerSection title="Shop by Category">{categories.map((category) => <div key={category.id}><div className="flex items-center"><Link to="/shop" search={{ cat: category.name } as never} onClick={onClose} className="flex-1 px-5 py-3 text-sm font-medium hover:bg-muted">{category.name}</Link>{category.children.length > 0 && <button onClick={() => setExpanded(expanded === category.id ? null : category.id)} className="p-4" aria-label={`Expand ${category.name}`}><ChevronRight className={`h-4 w-4 transition ${expanded === category.id ? "rotate-90" : ""}`} /></button>}</div>{expanded === category.id && <div className="bg-stone-50 py-1">{category.children.map((child) => <Link key={child.id} to="/shop" search={{ cat: child.name } as never} onClick={onClose} className="block px-9 py-2.5 text-sm text-muted-foreground hover:bg-muted hover:text-primary">{child.name}</Link>)}</div>}</div>)}</DrawerSection><DrawerSection title="Help & Account"><Link to="/orders" onClick={onClose} className="block px-5 py-3 text-sm hover:bg-muted">Your Orders</Link><Link to="/wishlist" onClick={onClose} className="block px-5 py-3 text-sm hover:bg-muted">Your Wishlist</Link><Link to="/contact" onClick={onClose} className="block px-5 py-3 text-sm hover:bg-muted">Customer Support</Link></DrawerSection></aside></div>;
}

function DrawerSection({ title, children }: { title: string; children: ReactNode }) {
  return <section className="border-b py-3"><h2 className="px-5 py-2 text-lg font-bold">{title}</h2>{children}</section>;
}

function DrawerLink({ label, query, onClose }: { label: string; query: string; onClose: () => void }) {
  return <Link to="/shop" search={{ q: query } as never} onClick={onClose} className="block px-5 py-3 text-sm hover:bg-muted">{label}</Link>;
}

function AccountMenu({ user, wishlistCount, onClose, onLogout }: { user: boolean; wishlistCount: number; onClose: () => void; onLogout: () => void }) {
  return <div className="absolute right-0 top-full z-50 w-64 rounded-xl border bg-white p-2 text-foreground shadow-2xl"><p className="px-3 py-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">Your account</p>{user ? <><AccountLink to="/profile" icon={User} label="Profile & address" onClick={onClose} /><AccountLink to="/orders" icon={Package} label="Your orders" onClick={onClose} /><AccountLink to="/wishlist" icon={Heart} label={`Wishlist (${wishlistCount})`} onClick={onClose} /><button onClick={() => { onLogout(); onClose(); }} className="mt-1 flex w-full items-center gap-3 border-t px-3 py-3 text-sm font-medium text-destructive hover:bg-destructive/10"><LogOut className="h-4 w-4" /> Logout</button></> : <><AccountLink to="/login" icon={User} label="Sign in" onClick={onClose} /><AccountLink to="/signup" icon={Star} label="Create account" onClick={onClose} /></>}</div>;
}

function AccountLink({ to, icon: Icon, label, onClick }: { to: string; icon: ComponentType<{ className?: string }>; label: string; onClick: () => void }) {
  return <Link to={to} onClick={onClick} className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium hover:bg-muted"><Icon className="h-4 w-4" />{label}</Link>;
}

function Badge({ children }: { children: ReactNode }) {
  return <span className="absolute right-0 top-0 grid h-5 min-w-5 place-items-center rounded-full bg-[#d4a84d] px-1 text-[10px] font-bold text-[#102f35]">{children}</span>;
}
