import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { Layout } from "@/components/Layout";
import { useStore, formatINR } from "@/lib/store";
import { useState } from "react";
import { CreditCard, Truck, Lock, Check } from "lucide-react";
import { toast } from "sonner";
import { api, isApiEnabled, getToken, API_URL } from "@/lib/api";

export const Route = createFileRoute("/checkout")({
  component: Checkout,
  head: () => ({ meta: [{ title: "Secure Checkout — Shri Radha Govind Store" }, { name: "description", content: "Complete your order with secure Razorpay payment or Cash on Delivery." }, { name: "robots", content: "noindex" }] }),
});

declare global {
  interface Window { Razorpay?: any }
}

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") return resolve(false);
    if (window.Razorpay) return resolve(true);
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.async = true;
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

function Checkout() {
  const { cart, adminProducts, user, placeOrder, settings } = useStore();
  const nav = useNavigate();
  const items = cart.map((c) => ({ ...c, product: adminProducts.find((p) => p.id === c.productId)! })).filter((i) => i.product);
  const subtotal = items.reduce((s, i) => s + i.product.price * i.qty, 0);
  const shipping = subtotal >= settings.freeShipThreshold ? 0 : settings.shippingFee;
  const total = subtotal + shipping;

  const [form, setForm] = useState({
    name: user?.name ?? "", phone: user?.phone ?? "", line1: user?.address?.line1 ?? "", city: user?.address?.city ?? "", state: user?.address?.state ?? "", pincode: user?.address?.pincode ?? "",
  });
  const [method, setMethod] = useState<"razorpay" | "cod">("razorpay");
  const [processing, setProcessing] = useState(false);

  if (items.length === 0) {
    return <Layout><div className="container-app py-20 text-center"><h1 className="font-display text-3xl">Your cart is empty</h1><Link to="/shop" className="text-primary mt-4 inline-block">← Continue shopping</Link></div></Layout>;
  }

  const finalizeOrder = async (paymentExtras?: { razorpayOrderId: string; razorpayPaymentId: string; razorpaySignature: string }) => {
    const order = await placeOrder({
      items: items.map((i) => ({ product: i.product, qty: i.qty })),
      total,
      address: form,
      payment: {
        method,
        status: method === "razorpay" ? "paid" : "pending",
        ...paymentExtras,
      },
    });
    toast.success("Order placed successfully!");
    nav({ to: "/orders/$id", params: { id: order.id } });
  };

  const reportPaymentFailed = async (razorpayOrderId: string | undefined, reason: string) => {
    if (!isApiEnabled() || !getToken()) return;
    try {
      await api("/orders/payment-failed", {
        method: "POST",
        body: { razorpayOrderId: razorpayOrderId ?? "N/A", amount: total, reason },
      });
    } catch { /* ignore */ }
  };

  const payWithRazorpay = async () => {
    const useRealRazorpay =
      isApiEnabled() &&
      !!getToken() &&
      settings.razorpayKeyId &&
      !settings.razorpayKeyId.includes("XXXX");

    if (!useRealRazorpay) {
      // Demo / local mode — simulate a successful payment
      toast("Opening Razorpay secure checkout…");
      await new Promise((r) => setTimeout(r, 1200));
      await finalizeOrder();
      return;
    }

    const ok = await loadRazorpayScript();
    if (!ok) {
      toast.error("Could not load Razorpay. Check your connection.");
      throw new Error("razorpay script failed");
    }

    // Create a Razorpay order on the backend
    let rzpOrder: { id: string; amount: number; currency: string };
    let keyId: string;
    try {
      const r = await api<{ order: any; keyId: string }>("/payments/razorpay/order", {
        method: "POST",
        body: { amount: total },
      });
      rzpOrder = r.order;
      keyId = r.keyId ?? settings.razorpayKeyId;
    } catch (e: any) {
      toast.error(e?.message ?? "Could not start payment");
      throw e;
    }

    await new Promise<void>((resolve, reject) => {
      const rzp = new window.Razorpay({
        key: keyId,
        amount: rzpOrder.amount,
        currency: rzpOrder.currency || "INR",
        order_id: rzpOrder.id,
        name: settings.siteName,
        description: `Order payment · ${items.length} item${items.length === 1 ? "" : "s"}`,
        prefill: { name: form.name, contact: form.phone, email: user?.email ?? "" },
        theme: { color: "#b45309" },
        handler: async (resp: any) => {
          try {
            await finalizeOrder({
              razorpayOrderId: resp.razorpay_order_id,
              razorpayPaymentId: resp.razorpay_payment_id,
              razorpaySignature: resp.razorpay_signature,
            });
            resolve();
          } catch (err: any) {
            await reportPaymentFailed(resp.razorpay_order_id, err?.message ?? "Order creation failed after payment");
            reject(err);
          }
        },
        modal: {
          ondismiss: async () => {
            await reportPaymentFailed(rzpOrder.id, "Payment dismissed by user");
            toast.error("Payment cancelled · order not placed. An email has been sent.");
            reject(new Error("dismissed"));
          },
        },
      });
      rzp.on("payment.failed", async (resp: any) => {
        await reportPaymentFailed(rzpOrder.id, resp?.error?.description ?? "Payment failed");
        toast.error("Payment failed · order cancelled. We've emailed you the details.");
        reject(new Error(resp?.error?.description ?? "payment failed"));
      });
      rzp.open();
    });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.phone || !form.line1 || !form.city || !form.pincode) {
      toast.error("Please complete shipping details"); return;
    }
    setProcessing(true);
    try {
      if (method === "razorpay") {
        await payWithRazorpay();
      } else {
        await finalizeOrder();
      }
    } catch {
      // toasts already shown
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Layout>
      <div className="container-app py-10">
        <h1 className="font-display text-4xl">Checkout</h1>
        <form onSubmit={submit} className="grid lg:grid-cols-[1fr_400px] gap-8 mt-8">
          <div className="space-y-6">
            <section className="premium-card p-6">
              <h2 className="font-display text-2xl mb-4 flex items-center gap-2"><Truck className="h-5 w-5 text-primary" /> Shipping Address</h2>
              <div className="grid sm:grid-cols-2 gap-3">
                <Input label="Full Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
                <Input label="Account Email (locked)" value={user?.email ?? ""} onChange={() => {}} readOnly />
                <Input label="Phone" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
                <Input label="Address" value={form.line1} onChange={(v) => setForm({ ...form, line1: v })} full />
                <Input label="City" value={form.city} onChange={(v) => setForm({ ...form, city: v })} />
                <Input label="State" value={form.state} onChange={(v) => setForm({ ...form, state: v })} />
                <Input label="Pincode" value={form.pincode} onChange={(v) => setForm({ ...form, pincode: v })} />
              </div>
            </section>

            <section className="premium-card p-6">
              <h2 className="font-display text-2xl mb-4 flex items-center gap-2"><CreditCard className="h-5 w-5 text-primary" /> Payment Method</h2>
              <div className="space-y-3">
                <PayOption checked={method === "razorpay"} onClick={() => setMethod("razorpay")} title="Razorpay — Cards, UPI, Netbanking, Wallets" desc="Pay securely via Razorpay. Verified server-side; failed payments auto-cancel." />
                {settings.codEnabled && <PayOption checked={method === "cod"} onClick={() => setMethod("cod")} title="Cash on Delivery" desc="Pay with cash when your order arrives." />}
              </div>
              {!API_URL && <p className="text-[11px] text-amber-700 mt-3">Demo mode · payments are simulated. Set VITE_API_URL to enable live Razorpay.</p>}
            </section>
          </div>

          <aside className="premium-card p-6 h-fit lg:sticky lg:top-24">
            <h2 className="font-display text-2xl mb-4">Order Summary</h2>
            <div className="space-y-3 max-h-72 overflow-auto">
              {items.map((i) => (
                <div key={i.productId} className="flex gap-3 text-sm">
                  <div className="h-14 w-14 rounded-lg overflow-hidden bg-muted shrink-0"><img src={i.product.image} className="h-full w-full object-cover" alt="" /></div>
                  <div className="flex-1 min-w-0">
                    <p className="line-clamp-1 font-medium">{i.product.name}</p>
                    <p className="text-muted-foreground text-xs">Qty {i.qty}</p>
                  </div>
                  <span className="font-medium">{formatINR(i.product.price * i.qty)}</span>
                </div>
              ))}
            </div>
            <div className="border-t my-4" />
            <div className="space-y-2 text-sm">
              <Row label="Subtotal" value={formatINR(subtotal)} />
              <Row label="Shipping" value={shipping === 0 ? "FREE" : formatINR(shipping)} />
              <div className="border-t my-3" />
              <Row label="Total" value={formatINR(total)} bold />
            </div>
            <button disabled={processing} type="submit" className="mt-6 w-full h-12 rounded-full bg-primary text-primary-foreground font-medium hover:opacity-90 inline-flex items-center justify-center gap-2 disabled:opacity-50">
              <Lock className="h-4 w-4" /> {processing ? "Processing…" : `Pay ${formatINR(total)}`}
            </button>
            <p className="text-[11px] text-muted-foreground text-center mt-3">Secure payment · 256-bit SSL</p>
          </aside>
        </form>
      </div>
    </Layout>
  );
}

function Input({ label, value, onChange, full, readOnly = false }: { label: string; value: string; onChange: (v: string) => void; full?: boolean; readOnly?: boolean }) {
  return (
    <label className={`text-sm ${full ? "sm:col-span-2" : ""}`}>
      <span className="text-muted-foreground text-xs">{label}</span>
      <input value={value} readOnly={readOnly} onChange={(e) => onChange(e.target.value)} className={`mt-1 w-full h-11 rounded-lg border px-3 focus:outline-none focus:border-primary ${readOnly ? "cursor-not-allowed bg-muted/70 text-muted-foreground" : "bg-card"}`} />
    </label>
  );
}
function PayOption({ checked, onClick, title, desc }: { checked: boolean; onClick: () => void; title: string; desc: string }) {
  return (
    <button type="button" onClick={onClick} className={`w-full text-left p-4 rounded-xl border-2 transition ${checked ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}>
      <div className="flex items-start gap-3">
        <div className={`h-5 w-5 rounded-full border-2 grid place-items-center shrink-0 mt-0.5 ${checked ? "border-primary bg-primary" : "border-muted-foreground"}`}>
          {checked && <Check className="h-3 w-3 text-primary-foreground" />}
        </div>
        <div><p className="font-medium text-sm">{title}</p><p className="text-xs text-muted-foreground mt-0.5">{desc}</p></div>
      </div>
    </button>
  );
}
function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return <div className={`flex justify-between ${bold ? "font-semibold text-base" : ""}`}><span>{label}</span><span>{value}</span></div>;
}
