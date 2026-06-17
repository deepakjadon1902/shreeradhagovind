import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Layout } from "@/components/Layout";
import { useStore } from "@/lib/store";
import { User, ShoppingBag, Heart, MapPin, LogOut } from "lucide-react";

export const Route = createFileRoute("/profile")({
  component: Profile,
  head: () => ({ meta: [{ title: "My Profile — Shri Radha Govind Store" }, { name: "robots", content: "noindex" }] }),
});

function Profile() {
  const { user, logout, orders, wishlist } = useStore();
  const nav = useNavigate();
  if (!user) {
    return <Layout><div className="container-app py-20 text-center"><h1 className="font-display text-3xl">Sign in to view your profile</h1><Link to="/login" className="mt-6 inline-flex h-11 px-6 rounded-full bg-primary text-primary-foreground items-center">Sign in</Link></div></Layout>;
  }
  return (
    <Layout>
      <div className="container-app py-10 max-w-3xl">
        <div className="premium-card p-6 flex items-center gap-4">
          <div className="h-16 w-16 rounded-full gold-accent grid place-items-center text-white font-display text-2xl">{user.name[0]?.toUpperCase()}</div>
          <div className="flex-1">
            <h1 className="font-display text-2xl">{user.name}</h1>
            <p className="text-sm text-muted-foreground">{user.email}</p>
          </div>
          <button onClick={() => { logout(); nav({ to: "/" }); }} className="inline-flex items-center gap-2 px-4 h-10 rounded-full border hover:border-destructive hover:text-destructive text-sm">
            <LogOut className="h-4 w-4" /> Logout
          </button>
        </div>
        <div className="grid sm:grid-cols-2 gap-4 mt-6">
          <Tile to="/orders" icon={ShoppingBag} title="My Orders" desc={`${orders.length} orders`} />
          <Tile to="/wishlist" icon={Heart} title="Wishlist" desc={`${wishlist.length} saved`} />
          <Tile to="/profile" icon={MapPin} title="Addresses" desc="Manage delivery" />
          <Tile to="/profile" icon={User} title="Account" desc="Update details" />
        </div>
      </div>
    </Layout>
  );
}
function Tile({ to, icon: Icon, title, desc }: { to: string; icon: typeof User; title: string; desc: string }) {
  return <Link to={to} className="premium-card p-5 flex items-center gap-4 hover:border-primary">
    <Icon className="h-6 w-6 text-primary" />
    <div><p className="font-medium">{title}</p><p className="text-xs text-muted-foreground">{desc}</p></div>
  </Link>;
}
