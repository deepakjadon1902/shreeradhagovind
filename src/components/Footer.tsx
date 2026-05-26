import { Link } from "@tanstack/react-router";

export function Footer() {
  return (
    <footer className="mt-20 border-t border-border bg-muted/30">
      <div className="container-app py-12 grid gap-8 md:grid-cols-4">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="h-8 w-8 rounded-full gold-accent grid place-items-center text-white font-display">वृ</span>
            <span className="font-display text-xl">Vrindavan.</span>
          </div>
          <p className="text-sm text-muted-foreground">Sacred products from the holy land of Vrindavan, delivered to your home with devotion.</p>
        </div>
        <div>
          <h4 className="font-display text-lg mb-3">Shop</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li><Link to="/shop" className="hover:text-primary">All Products</Link></li>
            <li><Link to="/shop" className="hover:text-primary">Deity Dresses</Link></li>
            <li><Link to="/shop" className="hover:text-primary">Chandan & Tilak</Link></li>
            <li><Link to="/shop" className="hover:text-primary">Itra & Fragrance</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="font-display text-lg mb-3">Account</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li><Link to="/profile" className="hover:text-primary">Profile</Link></li>
            <li><Link to="/orders" className="hover:text-primary">My Orders</Link></li>
            <li><Link to="/wishlist" className="hover:text-primary">Wishlist</Link></li>
            <li><Link to="/cart" className="hover:text-primary">Cart</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="font-display text-lg mb-3">Contact</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>Loi Bazaar, Vrindavan 281121</li>
            <li>+91 98765 43210</li>
            <li>seva@vrindavan.shop</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border">
        <div className="container-app py-4 text-xs text-muted-foreground flex flex-wrap justify-between gap-2">
          <span>© {new Date().getFullYear()} Vrindavan Sacred Bazaar · ॥ जय श्री राधे ॥</span>
          <span>Secure payments by Razorpay</span>
        </div>
      </div>
    </footer>
  );
}
