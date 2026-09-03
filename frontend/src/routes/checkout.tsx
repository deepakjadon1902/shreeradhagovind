import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { Layout } from "@/components/Layout";
import { useStore, formatINR } from "@/lib/store";
import { useEffect, useState, useRef } from "react";
import {
  CreditCard,
  Truck,
  Lock,
  Check,
  ShieldCheck,
  ChevronRight,
  ShoppingBag,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { api, isApiEnabled, getToken, API_URL } from "@/lib/api";

export const Route = createFileRoute("/checkout")({
  component: Checkout,
  head: () => ({
    meta: [
      { title: "Secure Checkout - Shri Radha Govind Store" },
      {
        name: "description",
        content: "Complete your order with secure payment at Shri Radha Govind Store.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
});

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

type RazorpayOrder = { id: string; amount: number; currency: string };
type RazorpaySuccessResponse = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};
type RazorpayFailedResponse = { error?: { description?: string } };
type RazorpayInstance = {
  on: (event: "payment.failed", handler: (response: RazorpayFailedResponse) => void) => void;
  open: () => void;
};
type RazorpayOptions = {
  key: string;
  amount: number;
  currency: string;
  order_id: string;
  name: string;
  description: string;
  prefill: { name: string; contact: string; email: string };
  theme: { color: string };
  handler: (response: RazorpaySuccessResponse) => void;
  modal: { ondismiss: () => void };
};

const INDIAN_STATES = [
  "Andaman and Nicobar Islands",
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chandigarh",
  "Chhattisgarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jammu and Kashmir",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Ladakh",
  "Lakshadweep",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Puducherry",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
];

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
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
  const items = cart
    .map((c) => ({ ...c, product: adminProducts.find((p) => p.id === c.productId)! }))
    .filter((i) => i.product);
  const subtotal = items.reduce((s, i) => s + i.product.price * i.qty, 0);
  const shipping = subtotal >= settings.freeShipThreshold ? 0 : settings.shippingFee;
  const total = subtotal + shipping;

  const [form, setForm] = useState({
    name: user?.name ?? "",
    email: user?.email ?? "",
    phone: user?.phone ?? "",
    alternatePhone: "",
    line1: user?.address?.line1 ?? "",
    line2: user?.address?.line2 ?? "",
    pincode: user?.address?.pincode ?? "",
    city: user?.address?.city ?? "",
    state: user?.address?.state ?? "",
    postOffice: (user?.address as any)?.postOffice ?? "",
    needsGstInvoice: false,
    businessName: "",
    gstin: "",
  });
  const [method, setMethod] = useState<"razorpay" | "cod">("razorpay");
  const [processing, setProcessing] = useState(false);
  const codAvailable = settings.codEnabled;

  // Indian Pincode -> Post Office lookup state
  const [postalStatus, setPostalStatus] = useState<"idle" | "loading" | "success" | "not_found">("idle");
  const [postalMessage, setPostalMessage] = useState<string>("");
  const [availablePostOffices, setAvailablePostOffices] = useState<string[]>([]);
  const pincodeCacheRef = useRef<Map<string, { district: string; state: string; postOffices: string[] }>>(new Map());

  // Track whether City, State, Post Office were manually typed/selected by the user
  const manualEditsRef = useRef<{ city: boolean; state: boolean; postOffice: boolean }>({
    city: false,
    state: false,
    postOffice: false,
  });
  const lastLookedUpPincodeRef = useRef<string>("");

  useEffect(() => {
    if (!codAvailable && method === "cod") setMethod("razorpay");
  }, [codAvailable, method]);

  useEffect(() => {
    if (!user) return;
    setForm((current) => ({
      name: current.name || user.name || "",
      email: current.email || user.email || "",
      phone: current.phone || user.phone || "",
      alternatePhone: current.alternatePhone || "",
      line1: current.line1 || user.address?.line1 || "",
      line2: current.line2 || user.address?.line2 || "",
      pincode: current.pincode || user.address?.pincode || "",
      city: current.city || user.address?.city || "",
      state: current.state || user.address?.state || "",
      postOffice: current.postOffice || (user.address as any)?.postOffice || "",
      needsGstInvoice: current.needsGstInvoice,
      businessName: current.businessName,
      gstin: current.gstin,
    }));
  }, [user]);

  // Debounced Indian Pincode Lookup
  useEffect(() => {
    const rawPin = form.pincode.replace(/\D/g, "").trim();
    if (rawPin.length !== 6) {
      setPostalStatus("idle");
      setPostalMessage("");
      setAvailablePostOffices([]);
      return;
    }

    let isCurrent = true;

    const applyData = (district: string, state: string, postOffices: string[]) => {
      lastLookedUpPincodeRef.current = rawPin;
      setPostalStatus("success");
      setPostalMessage("Post Office details found");
      setAvailablePostOffices(postOffices);

      setForm((prev) => {
        // Race condition safety: only update if form.pincode still matches rawPin
        if (prev.pincode.replace(/\D/g, "").trim() !== rawPin) return prev;

        // If City was not manually edited by user, update to new API district
        const nextCity = manualEditsRef.current.city ? prev.city : district;

        // If State was not manually edited by user, update to new API state
        const nextState = manualEditsRef.current.state ? prev.state : state;

        // If Post Office was manually chosen from THIS pincode list, keep it; otherwise default to first available
        const nextPo = (manualEditsRef.current.postOffice && postOffices.includes(prev.postOffice))
          ? prev.postOffice
          : (postOffices[0] || "");

        return {
          ...prev,
          city: nextCity,
          state: nextState,
          postOffice: nextPo,
        };
      });
    };

    // Check in-memory cache to prevent duplicate requests
    const cached = pincodeCacheRef.current.get(rawPin);
    if (cached) {
      applyData(cached.district, cached.state, cached.postOffices);
      return;
    }

    setPostalStatus("loading");
    setPostalMessage("");

    const timer = setTimeout(async () => {
      try {
        let result: { success: boolean; district?: string; state?: string; postOffices?: string[]; message?: string } | null = null;

        if (isApiEnabled()) {
          try {
            result = await api(`/postal/pincode/${rawPin}`);
          } catch {
            // fallback gracefully
          }
        }

        // Direct browser fallback if backend endpoint was unreachable
        if (!result || !result.success) {
          try {
            const extRes = await fetch(`https://api.postalpincode.in/pincode/${rawPin}`);
            if (extRes.ok) {
              const extData = await extRes.json();
              if (Array.isArray(extData) && extData[0]?.Status === "Success" && Array.isArray(extData[0]?.PostOffice)) {
                const poList = extData[0].PostOffice;
                const dist = poList.find((p: any) => p.District)?.District || "";
                const st = poList.find((p: any) => p.State)?.State || "";
                const names = Array.from(new Set(poList.map((p: any) => (p.Name || "").trim()).filter(Boolean))) as string[];
                result = {
                  success: true,
                  district: dist,
                  state: st,
                  postOffices: names,
                };
              }
            }
          } catch {
            // ignore
          }
        }

        // Ignore stale response if another pincode lookup was initiated
        if (!isCurrent) return;

        if (result && result.success && (result.postOffices?.length || result.district)) {
          const district = result.district || "";
          const stateRaw = result.state || "";
          const matchedState = INDIAN_STATES.find((s) => s.toLowerCase() === stateRaw.toLowerCase()) || stateRaw;
          const postOffices = result.postOffices || [];

          pincodeCacheRef.current.set(rawPin, { district, state: matchedState, postOffices });
          applyData(district, matchedState, postOffices);
        } else {
          setPostalStatus("not_found");
          setPostalMessage("We couldn't find this pincode. You can enter the address manually.");
          setAvailablePostOffices([]);
        }
      } catch {
        if (!isCurrent) return;
        setPostalStatus("not_found");
        setPostalMessage("We couldn't find this pincode. You can enter the address manually.");
        setAvailablePostOffices([]);
      }
    }, 350);

    return () => {
      isCurrent = false;
      clearTimeout(timer);
    };
  }, [form.pincode]);

  if (items.length === 0) {
    return (
      <Layout>
        <div className="container-app py-20 text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-4">
            <ShoppingBag className="w-8 h-8" />
          </div>
          <h1 className="font-display text-3xl">Your cart is empty</h1>
          <p className="text-muted-foreground mt-2 text-sm max-w-sm mx-auto">
            Discover sacred essentials, Tulsi malas, deity dresses, and more from Vrindavan.
          </p>
          <Link
            to="/shop"
            className="mt-6 inline-flex items-center justify-center h-11 px-8 rounded-full bg-primary text-primary-foreground font-medium text-sm hover:opacity-90 transition"
          >
            Explore Sacred Shop
          </Link>
        </div>
      </Layout>
    );
  }

  const finalizeOrder = async (paymentExtras?: {
    razorpayOrderId: string;
    razorpayPaymentId: string;
    razorpaySignature: string;
  }) => {
    const order = await placeOrder({
      customerEmail: form.email.trim(),
      items: items.map((i) => ({ product: i.product, qty: i.qty })),
      total,
      alternatePhone: form.alternatePhone.trim() || undefined,
      needsGstInvoice: form.needsGstInvoice,
      businessName: form.needsGstInvoice ? form.businessName.trim() : undefined,
      gstin: form.needsGstInvoice ? form.gstin.trim().toUpperCase() : undefined,
      address: {
        name: form.name.trim(),
        phone: form.phone.trim(),
        alternatePhone: form.alternatePhone.trim() || undefined,
        line1: form.line1.trim(),
        line2: form.line2.trim() || undefined,
        postOffice: form.postOffice.trim() || undefined,
        city: form.city.trim(),
        state: form.state.trim(),
        pincode: form.pincode.trim(),
      },
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
    if (!isApiEnabled()) return;
    try {
      await api("/orders/payment-failed", {
        method: "POST",
        body: {
          email: form.email.trim(),
          razorpayOrderId: razorpayOrderId ?? "N/A",
          amount: total,
          reason,
          address: {
            ...form,
            alternatePhone: form.alternatePhone.trim() || undefined,
          },
          items: items.map((item) => ({ productId: item.product.id, qty: item.qty })),
        },
      });
    } catch {
      /* ignore */
    }
  };

  const payWithRazorpay = async () => {
    const useRealRazorpay = isApiEnabled();

    if (!useRealRazorpay) {
      toast("Opening secure checkout...");
      await new Promise((r) => setTimeout(r, 1000));
      await finalizeOrder();
      return;
    }

    const ok = await loadRazorpayScript();
    if (!ok) {
      toast.error("Could not load payment gateway. Please check your internet connection.");
      throw new Error("razorpay script failed");
    }

    let rzpOrder: RazorpayOrder;
    let keyId: string;
    try {
      const r = await api<{ order: RazorpayOrder; keyId?: string }>("/payments/razorpay/order", {
        method: "POST",
        body: { items: items.map((item) => ({ productId: item.product.id, qty: item.qty })) },
      });
      rzpOrder = r.order;
      keyId = r.keyId ?? settings.razorpayKeyId;
    } catch (error: unknown) {
      toast.error(errorMessage(error, "Could not initialize payment"));
      throw error;
    }

    await new Promise<void>((resolve, reject) => {
      const rzp = new window.Razorpay({
        key: keyId,
        amount: rzpOrder.amount,
        currency: rzpOrder.currency || "INR",
        order_id: rzpOrder.id,
        name: settings.siteName,
        description: `Sacred Order (${items.length} item${items.length === 1 ? "" : "s"})`,
        prefill: {
          name: form.name.trim(),
          contact: form.phone.trim(),
          email: form.email.trim(),
        },
        theme: { color: "#0f6f72" },
        handler: async (resp) => {
          try {
            await finalizeOrder({
              razorpayOrderId: resp.razorpay_order_id,
              razorpayPaymentId: resp.razorpay_payment_id,
              razorpaySignature: resp.razorpay_signature,
            });
            resolve();
          } catch (err: unknown) {
            await reportPaymentFailed(
              resp.razorpay_order_id,
              errorMessage(err, "Order confirmation failed after payment"),
            );
            reject(err);
          }
        },
        modal: {
          ondismiss: async () => {
            await reportPaymentFailed(rzpOrder.id, "Payment dismissed by user");
            toast.error("Payment cancelled. Your order was not placed.");
            reject(new Error("dismissed"));
          },
        },
      });
      rzp.on("payment.failed", async (resp) => {
        await reportPaymentFailed(rzpOrder.id, resp?.error?.description ?? "Payment failed");
        toast.error("Payment unsuccessful. Order was not placed.");
        reject(new Error(resp?.error?.description ?? "payment failed"));
      });
      rzp.open();
    });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = form.email.trim();
    if (!cleanEmail || !/^\S+@\S+\.\S+$/.test(cleanEmail)) {
      toast.error("Please enter a valid email address");
      return;
    }
    const cleanPhone = form.phone.replace(/\D/g, "");
    if (!cleanPhone || cleanPhone.length < 10) {
      toast.error("Please enter a valid 10-digit primary phone number");
      return;
    }
    if (form.alternatePhone.trim()) {
      const cleanAlt = form.alternatePhone.replace(/\D/g, "");
      if (cleanAlt.length > 0 && cleanAlt.length < 10) {
        toast.error("Alternative phone number must be at least 10 digits if provided");
        return;
      }
    }
    if (!form.name.trim() || !form.line1.trim() || !form.pincode.trim() || !form.city.trim() || !form.state.trim() || !form.postOffice.trim()) {
      toast.error("Please complete all required delivery address fields");
      return;
    }
    if (form.needsGstInvoice) {
      if (!form.businessName.trim()) {
        toast.error("Please enter your business/company name");
        return;
      }
      const cleanGst = form.gstin.trim().toUpperCase();
      const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
      if (cleanGst && !GSTIN_REGEX.test(cleanGst)) {
        toast.error("Please enter a valid 15-character GSTIN (e.g. 09AABCU9603R1ZM)");
        return;
      }
    }
    setProcessing(true);
    try {
      if (method === "razorpay") {
        await payWithRazorpay();
      } else {
        await finalizeOrder();
      }
    } catch {
      // toasts handled in functions
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Layout>
      <div className="min-h-screen bg-slate-50/50 py-8 lg:py-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Checkout Header & Trust Line */}
          <div className="mb-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-5 border-b border-slate-200">
              <div>
                <h1 className="font-display text-2xl sm:text-3xl text-slate-900 tracking-tight">
                  Secure Checkout
                </h1>
                <div className="flex items-center gap-1.5 mt-1.5 text-xs text-slate-500 font-medium">
                  <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span>Secure checkout • Your information is protected</span>
                </div>
              </div>

              {/* Progress Breadcrumbs */}
              <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
                <Link to="/cart" className="hover:text-primary transition">
                  Cart
                </Link>
                <ChevronRight className="h-3 w-3" />
                <span className="text-primary font-semibold">Details</span>
                <ChevronRight className="h-3 w-3" />
                <span className="text-slate-400">Payment</span>
              </div>
            </div>
          </div>

          <form onSubmit={submit} className="grid gap-8 lg:grid-cols-12 items-start">
            {/* Left Column: Form Sections */}
            <div className="lg:col-span-7 xl:col-span-8 space-y-6">
              {/* 1. Contact Information Card */}
              <section className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-7 shadow-sm">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold">
                      1
                    </span>
                    Contact Information
                  </h2>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1.5">
                      Email Address <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="email"
                      required
                      autoComplete="email"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      placeholder="Enter your email"
                      className="w-full h-11 px-3.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/10 focus:outline-none transition"
                    />
                    <p className="mt-1.5 text-[11px] text-slate-500">
                      {user
                        ? "Using your account email. You can change it for this order."
                        : "We'll send your order confirmation and invoice here."}
                    </p>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1.5">
                        Primary Phone Number <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="tel"
                        required
                        autoComplete="tel"
                        maxLength={10}
                        value={form.phone}
                        onChange={(e) => setForm({ ...form, phone: e.target.value })}
                        placeholder="10-digit mobile number"
                        className="w-full h-11 px-3.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/10 focus:outline-none transition"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1.5">
                        Alternative Phone Number{" "}
                        <span className="text-slate-400 font-normal">(Optional)</span>
                      </label>
                      <input
                        type="tel"
                        maxLength={10}
                        value={form.alternatePhone}
                        onChange={(e) => setForm({ ...form, alternatePhone: e.target.value })}
                        placeholder="Optional second number"
                        className="w-full h-11 px-3.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/10 focus:outline-none transition"
                      />
                      <p className="mt-1 text-[11px] text-slate-500">
                        Optional backup contact number
                      </p>
                    </div>
                  </div>
                </div>
              </section>

              {/* 2. Delivery Address Card */}
              <section className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-7 shadow-sm">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold">
                      2
                    </span>
                    Delivery Address
                  </h2>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1.5">
                      Full Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      autoComplete="name"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      placeholder="Enter your full name"
                      className="w-full h-11 px-3.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/10 focus:outline-none transition"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1.5">
                      Address Line 1 <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      autoComplete="address-line1"
                      value={form.line1}
                      onChange={(e) => setForm({ ...form, line1: e.target.value })}
                      placeholder="House no., building, street, area"
                      className="w-full h-11 px-3.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/10 focus:outline-none transition"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1.5">
                      Address Line 2{" "}
                      <span className="text-slate-400 font-normal">(Optional)</span>
                    </label>
                    <input
                      type="text"
                      autoComplete="address-line2"
                      value={form.line2}
                      onChange={(e) => setForm({ ...form, line2: e.target.value })}
                      placeholder="Apartment, landmark, locality, etc."
                      className="w-full h-11 px-3.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/10 focus:outline-none transition"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-medium text-slate-700">
                        Pincode <span className="text-rose-500">*</span>
                      </label>
                      {postalStatus === "loading" && (
                        <span className="text-[11px] text-primary flex items-center gap-1 font-medium">
                          <Loader2 className="h-3 w-3 animate-spin" /> Finding post office...
                        </span>
                      )}
                      {postalStatus === "success" && (
                        <span className="text-[11px] text-emerald-700 flex items-center gap-1 font-medium">
                          <Check className="h-3 w-3 text-emerald-600" /> Post Office details found
                        </span>
                      )}
                    </div>
                    <input
                      type="text"
                      required
                      maxLength={6}
                      autoComplete="postal-code"
                      value={form.pincode}
                      onChange={(e) => {
                        const nextPin = e.target.value;
                        setForm({ ...form, pincode: nextPin });
                        const clean = nextPin.replace(/\D/g, "");
                        if (clean !== lastLookedUpPincodeRef.current) {
                          manualEditsRef.current.postOffice = false;
                        }
                      }}
                      placeholder="6-digit pincode"
                      className="w-full h-11 px-3.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/10 focus:outline-none transition"
                    />
                    {postalStatus === "not_found" && postalMessage && (
                      <p className="mt-1 text-[11px] text-slate-500">
                        {postalMessage}
                      </p>
                    )}
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1.5">
                        City <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        autoComplete="address-level2"
                        value={form.city}
                        onChange={(e) => {
                          manualEditsRef.current.city = e.target.value.trim().length > 0;
                          setForm({ ...form, city: e.target.value });
                        }}
                        placeholder="Enter city"
                        className="w-full h-11 px-3.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/10 focus:outline-none transition"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1.5">
                        State <span className="text-rose-500">*</span>
                      </label>
                      <select
                        required
                        value={form.state}
                        onChange={(e) => {
                          manualEditsRef.current.state = e.target.value.trim().length > 0;
                          setForm({ ...form, state: e.target.value });
                        }}
                        className="w-full h-11 px-3.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 focus:border-primary focus:ring-2 focus:ring-primary/10 focus:outline-none transition"
                      >
                        <option value="">Select state</option>
                        {INDIAN_STATES.map((st) => (
                          <option key={st} value={st}>
                            {st}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1.5">
                      Post Office <span className="text-rose-500">*</span>
                    </label>
                    {availablePostOffices.length > 0 ? (
                      <select
                        required
                        value={form.postOffice}
                        onChange={(e) => {
                          manualEditsRef.current.postOffice = e.target.value.trim().length > 0;
                          setForm({ ...form, postOffice: e.target.value });
                        }}
                        className="w-full h-11 px-3.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 focus:border-primary focus:ring-2 focus:ring-primary/10 focus:outline-none transition"
                      >
                        <option value="">Select post office</option>
                        {availablePostOffices.map((po) => (
                          <option key={po} value={po}>
                            {po}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        required
                        value={form.postOffice}
                        onChange={(e) => {
                          manualEditsRef.current.postOffice = e.target.value.trim().length > 0;
                          setForm({ ...form, postOffice: e.target.value });
                        }}
                        placeholder="Enter post office"
                        className="w-full h-11 px-3.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/10 focus:outline-none transition"
                      />
                    )}
                  </div>
                </div>
              </section>

              {/* Optional Business / GST Details Card */}
              <section className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-7 shadow-sm">
                <div className="flex items-center justify-between">
                  <label className="flex items-start gap-3 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={form.needsGstInvoice}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          needsGstInvoice: e.target.checked,
                          businessName: e.target.checked ? form.businessName : "",
                          gstin: e.target.checked ? form.gstin : "",
                        })
                      }
                      className="mt-0.5 w-4 h-4 rounded text-primary focus:ring-primary border-slate-300 transition"
                    />
                    <div>
                      <p className="text-sm font-semibold text-slate-900">I need a GST invoice</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Add business / GSTIN details to receive a GST invoice for business purposes
                      </p>
                    </div>
                  </label>
                </div>

                {form.needsGstInvoice && (
                  <div className="mt-5 pt-5 border-t border-slate-100 space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1.5">
                        Business Name <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={form.businessName}
                        onChange={(e) => setForm({ ...form, businessName: e.target.value })}
                        placeholder="Enter business/company name"
                        className="w-full h-11 px-3.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/10 focus:outline-none transition"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1.5">
                        GSTIN <span className="text-slate-400 font-normal">(Optional)</span>
                      </label>
                      <input
                        type="text"
                        maxLength={15}
                        value={form.gstin}
                        onChange={(e) => setForm({ ...form, gstin: e.target.value.toUpperCase() })}
                        placeholder="Enter 15-digit GSTIN"
                        className="w-full h-11 px-3.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 uppercase placeholder:normal-case placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/10 focus:outline-none transition"
                      />
                      <p className="mt-1.5 text-[11px] text-slate-500">
                        GSTIN is optional. Add it only if you need the invoice for business purposes.
                      </p>
                    </div>
                  </div>
                )}
              </section>

              {/* 3. Payment Method Card */}
              <section className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-7 shadow-sm">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold">
                      3
                    </span>
                    Payment Method
                  </h2>
                </div>

                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={() => setMethod("razorpay")}
                    className={`w-full rounded-xl border p-4 text-left transition flex items-center justify-between ${
                      method === "razorpay"
                        ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                        : "border-slate-200 bg-white hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-center gap-3.5">
                      <div
                        className={`h-5 w-5 rounded-full border flex items-center justify-center shrink-0 ${
                          method === "razorpay"
                            ? "border-primary bg-primary"
                            : "border-slate-300 bg-white"
                        }`}
                      >
                        {method === "razorpay" && (
                          <Check className="h-3 w-3 text-white stroke-[3]" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-900">Razorpay</p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          UPI, Cards, Net Banking & Wallets
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-2.5 py-1 rounded-full">
                      <Lock className="h-3 w-3" />
                      <span>Instant & Secure</span>
                    </div>
                  </button>

                  {codAvailable && (
                    <button
                      type="button"
                      onClick={() => setMethod("cod")}
                      className={`w-full rounded-xl border p-4 text-left transition flex items-center justify-between ${
                        method === "cod"
                          ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                          : "border-slate-200 bg-white hover:border-slate-300"
                      }`}
                    >
                      <div className="flex items-center gap-3.5">
                        <div
                          className={`h-5 w-5 rounded-full border flex items-center justify-center shrink-0 ${
                            method === "cod"
                              ? "border-primary bg-primary"
                              : "border-slate-300 bg-white"
                          }`}
                        >
                          {method === "cod" && <Check className="h-3 w-3 text-white stroke-[3]" />}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-900">Cash on Delivery</p>
                          <p className="text-xs text-slate-500 mt-0.5">Pay when your order arrives</p>
                        </div>
                      </div>
                    </button>
                  )}

                  {!codAvailable && (
                    <p className="text-xs text-slate-400 px-1 py-0.5">
                      Cash on Delivery is currently unavailable.
                    </p>
                  )}
                </div>

                <div className="mt-4 pt-4 border-t border-slate-100 flex items-center gap-2 text-xs text-slate-500">
                  <ShieldCheck className="h-4 w-4 text-primary shrink-0" />
                  <span>Secure payment powered by Razorpay</span>
                </div>
              </section>
            </div>

            {/* Right Column: Sticky Order Summary */}
            <div className="lg:col-span-5 xl:col-span-4">
              <aside className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-sm lg:sticky lg:top-24 space-y-5">
                <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                  <h2 className="text-base font-semibold text-slate-900">Order Summary</h2>
                  <span className="text-xs font-medium bg-slate-100 text-slate-600 px-2.5 py-0.5 rounded-full">
                    {items.length} {items.length === 1 ? "item" : "items"}
                  </span>
                </div>

                {/* Products List */}
                <div className="space-y-3.5 max-h-72 overflow-y-auto pr-1">
                  {items.map((i) => (
                    <div key={i.productId} className="flex gap-3 text-sm items-center">
                      <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-slate-100 bg-slate-50 p-1 flex items-center justify-center">
                        <img
                          src={i.product.image}
                          className="h-full w-full object-contain"
                          alt={i.product.name}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="line-clamp-1 font-medium text-slate-800 text-xs sm:text-sm">
                          {i.product.name}
                        </p>
                        <p className="text-slate-400 text-xs mt-0.5">Qty {i.qty}</p>
                      </div>
                      <span className="font-semibold text-slate-900 text-xs sm:text-sm shrink-0">
                        {formatINR(i.product.price * i.qty)}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Price Breakdown */}
                <div className="pt-4 border-t border-slate-100 space-y-2.5 text-xs sm:text-sm">
                  <div className="flex justify-between text-slate-600">
                    <span>Subtotal</span>
                    <span className="font-medium text-slate-800">{formatINR(subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600 items-center">
                    <span>Shipping</span>
                    {shipping === 0 ? (
                      <span className="font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded text-xs">
                        FREE
                      </span>
                    ) : (
                      <span className="font-medium text-slate-800">{formatINR(shipping)}</span>
                    )}
                  </div>

                  <div className="pt-3 border-t border-slate-200/80 flex justify-between items-baseline">
                    <span className="text-sm font-semibold text-slate-900">Total</span>
                    <span className="font-display text-xl font-bold text-primary">
                      {formatINR(total)}
                    </span>
                  </div>
                </div>

                {/* Submit / Place Order Button */}
                <button
                  type="submit"
                  disabled={processing}
                  className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 active:scale-[0.99] transition shadow-md shadow-primary/20 disabled:cursor-not-allowed disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Lock className="h-4 w-4" />
                  <span>
                    {processing ? "Processing Order..." : `Place Order • ${formatINR(total)}`}
                  </span>
                </button>

                {/* Reassurance text */}
                <div className="text-center pt-1">
                  <p className="text-[11px] text-slate-400 flex items-center justify-center gap-1.5">
                    <Lock className="h-3 w-3 text-slate-400" />
                    <span>Secure payment via Razorpay</span>
                  </p>
                </div>
              </aside>
            </div>
          </form>
        </div>
      </div>
    </Layout>
  );
}
