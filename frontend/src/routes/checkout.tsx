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
  User as UserIcon,
  Sparkles,
  MapPin,
  FileText,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Receipt,
  HeartHandshake,
} from "lucide-react";
import { toast } from "sonner";
import { api, isApiEnabled, getToken } from "@/lib/api";

export const Route = createFileRoute("/checkout")({
  component: Checkout,
  head: () => ({
    meta: [
      { title: "Secure Checkout - Shri Radha Govind Store" },
      {
        name: "description",
        content: "Complete your sacred order with 100% secure payment at Shri Radha Govind Store.",
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

const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

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
  const formRef = useRef<HTMLFormElement>(null);
  const isSubmittingRef = useRef(false);

  const items = cart
    .map((c) => ({ ...c, product: adminProducts.find((p) => p.id === c.productId)! }))
    .filter((i) => i.product);

  const subtotal = items.reduce((s, i) => s + i.product.price * i.qty, 0);
  const totalMrp = items.reduce((s, i) => {
    const effectiveMrp = i.product.mrp && i.product.mrp > i.product.price ? i.product.mrp : i.product.price;
    return s + effectiveMrp * i.qty;
  }, 0);
  const totalSavings = Math.max(0, totalMrp - subtotal);
  const shipping = subtotal >= settings.freeShipThreshold ? 0 : settings.shippingFee;
  const total = subtotal + shipping;

  // Account vs Guest selection (default guest for non-logged in)
  const [accountChoice, setAccountChoice] = useState<"guest" | "create">("guest");

  // Main shipping & contact form
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

  // Billing address state
  const [billingSameAsShipping, setBillingSameAsShipping] = useState(true);
  const [billingForm, setBillingForm] = useState({
    name: "",
    line1: "",
    line2: "",
    pincode: "",
    city: "",
    state: "",
    postOffice: "",
  });

  // Terms & Conditions Consent (mandatory unchecked by default)
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [termsError, setTermsError] = useState(false);

  const [method, setMethod] = useState<"razorpay" | "cod">("razorpay");
  const [processing, setProcessing] = useState(false);
  const codAvailable = settings.codEnabled;

  // Indian Pincode -> Post Office lookup state for Shipping
  const [postalStatus, setPostalStatus] = useState<"idle" | "loading" | "success" | "not_found">("idle");
  const [postalMessage, setPostalMessage] = useState<string>("");
  const [availablePostOffices, setAvailablePostOffices] = useState<string[]>([]);
  const pincodeCacheRef = useRef<Map<string, { district: string; state: string; postOffices: string[] }>>(new Map());

  // Track manual edits for Shipping Address
  const manualEditsRef = useRef<{ city: boolean; state: boolean; postOffice: boolean }>({
    city: false,
    state: false,
    postOffice: false,
  });
  const lastLookedUpPincodeRef = useRef<string>("");

  // Billing address pincode lookup state
  const [billingPostalStatus, setBillingPostalStatus] = useState<"idle" | "loading" | "success" | "not_found">("idle");
  const [billingAvailablePostOffices, setBillingAvailablePostOffices] = useState<string[]>([]);
  const billingManualEditsRef = useRef<{ city: boolean; state: boolean; postOffice: boolean }>({
    city: false,
    state: false,
    postOffice: false,
  });
  const lastBillingPincodeRef = useRef<string>("");

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

  // Debounced Indian Pincode Lookup for Shipping Address
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
        if (prev.pincode.replace(/\D/g, "").trim() !== rawPin) return prev;
        const nextCity = manualEditsRef.current.city ? prev.city : district;
        const nextState = manualEditsRef.current.state ? prev.state : state;
        const nextPo = manualEditsRef.current.postOffice && postOffices.includes(prev.postOffice)
          ? prev.postOffice
          : postOffices[0] || "";

        return {
          ...prev,
          city: nextCity,
          state: nextState,
          postOffice: nextPo,
        };
      });
    };

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
            // fallback
          }
        }

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

  // Debounced Indian Pincode Lookup for Billing Address
  useEffect(() => {
    if (billingSameAsShipping) return;
    const rawPin = billingForm.pincode.replace(/\D/g, "").trim();
    if (rawPin.length !== 6) {
      setBillingPostalStatus("idle");
      setBillingAvailablePostOffices([]);
      return;
    }

    let isCurrent = true;

    const applyBillingData = (district: string, state: string, postOffices: string[]) => {
      lastBillingPincodeRef.current = rawPin;
      setBillingPostalStatus("success");
      setBillingAvailablePostOffices(postOffices);

      setBillingForm((prev) => {
        if (prev.pincode.replace(/\D/g, "").trim() !== rawPin) return prev;
        const nextCity = billingManualEditsRef.current.city ? prev.city : district;
        const nextState = billingManualEditsRef.current.state ? prev.state : state;
        const nextPo = billingManualEditsRef.current.postOffice && postOffices.includes(prev.postOffice)
          ? prev.postOffice
          : postOffices[0] || "";

        return {
          ...prev,
          city: nextCity,
          state: nextState,
          postOffice: nextPo,
        };
      });
    };

    const cached = pincodeCacheRef.current.get(rawPin);
    if (cached) {
      applyBillingData(cached.district, cached.state, cached.postOffices);
      return;
    }

    setBillingPostalStatus("loading");

    const timer = setTimeout(async () => {
      try {
        let result: { success: boolean; district?: string; state?: string; postOffices?: string[] } | null = null;
        if (isApiEnabled()) {
          try {
            result = await api(`/postal/pincode/${rawPin}`);
          } catch {
            // fallback
          }
        }
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
                result = { success: true, district: dist, state: st, postOffices: names };
              }
            }
          } catch {
            // ignore
          }
        }

        if (!isCurrent) return;

        if (result && result.success && (result.postOffices?.length || result.district)) {
          const district = result.district || "";
          const stateRaw = result.state || "";
          const matchedState = INDIAN_STATES.find((s) => s.toLowerCase() === stateRaw.toLowerCase()) || stateRaw;
          const postOffices = result.postOffices || [];
          pincodeCacheRef.current.set(rawPin, { district, state: matchedState, postOffices });
          applyBillingData(district, matchedState, postOffices);
        } else {
          setBillingPostalStatus("not_found");
          setBillingAvailablePostOffices([]);
        }
      } catch {
        if (!isCurrent) return;
        setBillingPostalStatus("not_found");
        setBillingAvailablePostOffices([]);
      }
    }, 350);

    return () => {
      isCurrent = false;
      clearTimeout(timer);
    };
  }, [billingForm.pincode, billingSameAsShipping]);

  if (items.length === 0) {
    return (
      <Layout>
        <div className="container-app py-20 text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-[#166F77]/10 flex items-center justify-center text-[#166F77] mb-4">
            <ShoppingBag className="w-8 h-8" />
          </div>
          <h1 className="font-serif text-3xl text-stone-900">Your sacred cart is empty</h1>
          <p className="text-stone-600 mt-2 text-sm max-w-sm mx-auto">
            Explore authentic Tulsi malas, deity dresses, sacred brass idols, and pure puja essentials blessed in Vrindavan Dham.
          </p>
          <Link
            to="/shop"
            className="mt-6 inline-flex items-center justify-center h-11 px-8 rounded-full bg-[#166F77] text-white font-medium text-sm hover:bg-[#125B62] transition shadow-md shadow-[#166F77]/20"
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
    const resolvedBillingAddress = billingSameAsShipping
      ? {
          name: form.name.trim(),
          line1: form.line1.trim(),
          line2: form.line2.trim() || undefined,
          postOffice: form.postOffice.trim() || undefined,
          city: form.city.trim(),
          state: form.state.trim(),
          pincode: form.pincode.trim(),
        }
      : {
          name: (billingForm.name || form.name).trim(),
          line1: billingForm.line1.trim(),
          line2: billingForm.line2.trim() || undefined,
          postOffice: billingForm.postOffice.trim() || undefined,
          city: billingForm.city.trim(),
          state: billingForm.state.trim(),
          pincode: billingForm.pincode.trim(),
        };

    const order = await placeOrder({
      customerEmail: form.email.trim(),
      createAccount: !user && accountChoice === "create",
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
      billingAddress: resolvedBillingAddress,
      payment: {
        method,
        status: method === "razorpay" ? "paid" : "pending",
        ...paymentExtras,
      },
    });

    toast.success("Order placed successfully! Radhe Radhe.");
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
      keyId = r.keyId || settings.razorpayKeyId;
      if (!keyId) {
        toast.error("Payment gateway credentials are not configured on server.");
        throw new Error("Missing Razorpay Key ID from server response");
      }
    } catch (error: unknown) {
      toast.error(errorMessage(error, "Could not initialize payment"));
      throw error;
    }

    await new Promise<void>((resolve, reject) => {
      const rzp = new (window as any).Razorpay({
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
        theme: { color: "#166F77" },
        handler: async (resp: any) => {
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
          ondismiss: () => {
            toast.info("Payment window closed. You can retry payment anytime.");
            reject(new Error("dismissed"));
          },
        },
      });
      rzp.on("payment.failed", async (resp: any) => {
        await reportPaymentFailed(rzpOrder.id, resp?.error?.description ?? "Payment failed");
        toast.error("Payment unsuccessful. Order was not placed.");
        reject(new Error(resp?.error?.description ?? "payment failed"));
      });
      rzp.open();
    });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isSubmittingRef.current || processing) return;

    // Terms validation
    if (!acceptedTerms) {
      setTermsError(true);
      toast.error("Please accept the Terms & Conditions and Policies to proceed.");
      const termsEl = document.getElementById("terms-checkbox-section");
      termsEl?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setTermsError(false);

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

    // Validate billing address if different
    if (!billingSameAsShipping) {
      if (!billingForm.line1.trim() || !billingForm.pincode.trim() || !billingForm.city.trim() || !billingForm.state.trim()) {
        toast.error("Please complete all required billing address fields");
        return;
      }
    }

    if (form.needsGstInvoice) {
      if (!form.businessName.trim()) {
        toast.error("Please enter your business/company name");
        return;
      }
      const cleanGst = form.gstin.trim().toUpperCase();
      if (cleanGst && !GSTIN_REGEX.test(cleanGst)) {
        toast.error("Please enter a valid 15-character GSTIN (e.g. 09AABCU9603R1ZM)");
        return;
      }
    }

    isSubmittingRef.current = true;
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
      isSubmittingRef.current = false;
    }
  };

  return (
    <Layout>
      <div className="min-h-screen bg-[#FAF7F2]/60 py-8 lg:py-12 text-stone-800">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Checkout Header & Trust Line */}
          <div className="mb-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-5 border-b border-stone-200">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-semibold uppercase tracking-wider text-[#166F77] bg-[#166F77]/10 px-2.5 py-0.5 rounded-full inline-flex items-center gap-1">
                    <Sparkles className="h-3 w-3 text-[#D9A441]" />
                    Direct From Vrindavan Dham
                  </span>
                </div>
                <h1 className="font-serif text-2xl sm:text-3xl text-stone-900 tracking-tight">
                  Secure Checkout
                </h1>
                <div className="flex items-center gap-1.5 mt-1.5 text-xs text-stone-600 font-medium">
                  <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span>256-Bit SSL Encryption • Authentic & Consecrated Sacred Items</span>
                </div>
              </div>

              {/* Progress Breadcrumbs */}
              <div className="flex items-center gap-2 text-xs font-medium text-stone-400">
                <Link to="/cart" className="hover:text-[#166F77] transition">
                  1. Cart
                </Link>
                <ChevronRight className="h-3 w-3 text-stone-300" />
                <span className="text-[#166F77] font-semibold bg-[#166F77]/10 px-2 py-0.5 rounded">
                  2. Details & Delivery
                </span>
                <ChevronRight className="h-3 w-3 text-stone-300" />
                <span className="text-stone-400">3. Payment</span>
              </div>
            </div>
          </div>

          <form ref={formRef} onSubmit={submit} className="grid gap-8 lg:grid-cols-12 items-start pb-24 lg:pb-0">
            {/* Left Column: Form Sections */}
            <div className="lg:col-span-7 xl:col-span-8 space-y-6">
              {/* SECTION 1: ACCOUNT VS GUEST */}
              <section className="bg-white rounded-2xl border border-stone-200/90 p-5 sm:p-7 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-base font-semibold text-stone-900 flex items-center gap-2.5">
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-[#166F77] text-white text-xs font-bold">
                      1
                    </span>
                    Account & Devotee Access
                  </h2>
                </div>

                {user ? (
                  <div className="bg-[#FAF7F2] border border-[#D9A441]/30 rounded-xl p-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-[#166F77]/10 flex items-center justify-center text-[#166F77] shrink-0 font-serif font-bold text-base">
                        {user.name ? user.name[0].toUpperCase() : "D"}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-semibold text-stone-900">
                            Signed in as {user.name || "Devotee"}
                          </p>
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        </div>
                        <p className="text-xs text-stone-500">{user.email}</p>
                      </div>
                    </div>
                    <span className="text-[11px] font-medium text-[#166F77] bg-[#166F77]/10 px-2.5 py-1 rounded-full shrink-0">
                      Saved Account
                    </span>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-xs text-stone-600 font-medium">
                      Would you like to create an account with this order?
                    </p>
                    <div className="grid sm:grid-cols-2 gap-3">
                      {/* Option 1: Guest (Default) */}
                      <div
                        onClick={() => setAccountChoice("guest")}
                        className={`cursor-pointer rounded-xl border p-3.5 transition flex items-start gap-3 select-none ${
                          accountChoice === "guest"
                            ? "border-[#166F77] bg-[#166F77]/5 ring-1 ring-[#166F77]/30"
                            : "border-stone-200 hover:border-stone-300 bg-white"
                        }`}
                      >
                        <input
                          type="radio"
                          name="accountOption"
                          checked={accountChoice === "guest"}
                          onChange={() => setAccountChoice("guest")}
                          className="mt-0.5 h-4 w-4 text-[#166F77] focus:ring-[#166F77]"
                        />
                        <div>
                          <p className="text-xs font-semibold text-stone-900">
                            No, continue as Guest
                          </p>
                          <p className="text-[11px] text-stone-500 mt-0.5">
                            Fast checkout without setting a password.
                          </p>
                        </div>
                      </div>

                      {/* Option 2: Create Account */}
                      <div
                        onClick={() => setAccountChoice("create")}
                        className={`cursor-pointer rounded-xl border p-3.5 transition flex items-start gap-3 select-none ${
                          accountChoice === "create"
                            ? "border-[#166F77] bg-[#166F77]/5 ring-1 ring-[#166F77]/30"
                            : "border-stone-200 hover:border-stone-300 bg-white"
                        }`}
                      >
                        <input
                          type="radio"
                          name="accountOption"
                          checked={accountChoice === "create"}
                          onChange={() => setAccountChoice("create")}
                          className="mt-0.5 h-4 w-4 text-[#166F77] focus:ring-[#166F77]"
                        />
                        <div>
                          <div className="flex items-center gap-1.5">
                            <p className="text-xs font-semibold text-stone-900">
                              Yes, create my account
                            </p>
                            <span className="text-[10px] font-bold text-[#D9A441] bg-amber-50 border border-[#D9A441]/40 px-1.5 py-0.2 rounded">
                              Recommended
                            </span>
                          </div>
                          <p className="text-[11px] text-stone-500 mt-0.5">
                            Save address & track orders anytime.
                          </p>
                        </div>
                      </div>
                    </div>

                    {accountChoice === "create" && (
                      <div className="mt-2 text-[11px] text-emerald-800 bg-emerald-50/80 border border-emerald-200/80 rounded-lg p-2.5 flex items-start gap-2">
                        <Sparkles className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-semibold">Account Benefits:</span> Live order tracking, downloadable tax invoices, and express 1-click checkout for future Vrindavan orders.
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </section>

              {/* SECTION 2: CONTACT INFORMATION */}
              <section className="bg-white rounded-2xl border border-stone-200/90 p-5 sm:p-7 shadow-sm">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-base font-semibold text-stone-900 flex items-center gap-2.5">
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-[#166F77] text-white text-xs font-bold">
                      2
                    </span>
                    Contact Information
                  </h2>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-stone-700 mb-1.5">
                      Email Address <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="email"
                      required
                      autoComplete="email"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      placeholder="e.g. devotee@example.com"
                      className="w-full h-11 px-3.5 rounded-xl border border-stone-200 bg-white text-sm text-stone-900 placeholder:text-stone-400 focus:border-[#166F77] focus:ring-2 focus:ring-[#166F77]/10 focus:outline-none transition"
                    />
                    <p className="mt-1.5 text-[11px] text-stone-500">
                      {user
                        ? "Order confirmation & tracking links will be sent to this email."
                        : "We will send your order receipt, dispatch tracking, and tax invoice here."}
                    </p>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-stone-700 mb-1.5">
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
                        className="w-full h-11 px-3.5 rounded-xl border border-stone-200 bg-white text-sm text-stone-900 placeholder:text-stone-400 focus:border-[#166F77] focus:ring-2 focus:ring-[#166F77]/10 focus:outline-none transition"
                      />
                      <p className="mt-1 text-[11px] text-stone-500">
                        For delivery updates and courier dispatch
                      </p>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-stone-700 mb-1.5">
                        Alternative Phone Number{" "}
                        <span className="text-stone-400 font-normal">(Optional)</span>
                      </label>
                      <input
                        type="tel"
                        maxLength={10}
                        value={form.alternatePhone}
                        onChange={(e) => setForm({ ...form, alternatePhone: e.target.value })}
                        placeholder="Optional backup mobile number"
                        className="w-full h-11 px-3.5 rounded-xl border border-stone-200 bg-white text-sm text-stone-900 placeholder:text-stone-400 focus:border-[#166F77] focus:ring-2 focus:ring-[#166F77]/10 focus:outline-none transition"
                      />
                      <p className="mt-1 text-[11px] text-stone-500">
                        Helpful if your primary phone is unreachable
                      </p>
                    </div>
                  </div>
                </div>
              </section>

              {/* SECTION 3: DELIVERY / SHIPPING ADDRESS */}
              <section className="bg-white rounded-2xl border border-stone-200/90 p-5 sm:p-7 shadow-sm">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-base font-semibold text-stone-900 flex items-center gap-2.5">
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-[#166F77] text-white text-xs font-bold">
                      3
                    </span>
                    Delivery Address
                  </h2>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-stone-700 mb-1.5">
                      Full Name / Recipient Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      autoComplete="name"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      placeholder="e.g. Radhika Sharma"
                      className="w-full h-11 px-3.5 rounded-xl border border-stone-200 bg-white text-sm text-stone-900 placeholder:text-stone-400 focus:border-[#166F77] focus:ring-2 focus:ring-[#166F77]/10 focus:outline-none transition"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-stone-700 mb-1.5">
                      Address Line 1 <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      autoComplete="address-line1"
                      value={form.line1}
                      onChange={(e) => setForm({ ...form, line1: e.target.value })}
                      placeholder="Flat / House no., Building name, Street name"
                      className="w-full h-11 px-3.5 rounded-xl border border-stone-200 bg-white text-sm text-stone-900 placeholder:text-stone-400 focus:border-[#166F77] focus:ring-2 focus:ring-[#166F77]/10 focus:outline-none transition"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-stone-700 mb-1.5">
                      Address Line 2{" "}
                      <span className="text-stone-400 font-normal">(Optional)</span>
                    </label>
                    <input
                      type="text"
                      autoComplete="address-line2"
                      value={form.line2}
                      onChange={(e) => setForm({ ...form, line2: e.target.value })}
                      placeholder="Apartment, Landmark, Colony, Area"
                      className="w-full h-11 px-3.5 rounded-xl border border-stone-200 bg-white text-sm text-stone-900 placeholder:text-stone-400 focus:border-[#166F77] focus:ring-2 focus:ring-[#166F77]/10 focus:outline-none transition"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-medium text-stone-700">
                        PIN Code <span className="text-rose-500">*</span>
                      </label>
                      {postalStatus === "loading" && (
                        <span className="text-[11px] text-[#166F77] flex items-center gap-1 font-medium">
                          <Loader2 className="h-3 w-3 animate-spin" /> Looking up Post Office...
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
                      placeholder="6-digit Indian PIN Code"
                      className="w-full h-11 px-3.5 rounded-xl border border-stone-200 bg-white text-sm text-stone-900 placeholder:text-stone-400 focus:border-[#166F77] focus:ring-2 focus:ring-[#166F77]/10 focus:outline-none transition"
                    />
                    {postalStatus === "not_found" && postalMessage && (
                      <p className="mt-1 text-[11px] text-amber-600">
                        {postalMessage}
                      </p>
                    )}
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-stone-700 mb-1.5">
                        City / District <span className="text-rose-500">*</span>
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
                        placeholder="e.g. Mathura"
                        className="w-full h-11 px-3.5 rounded-xl border border-stone-200 bg-white text-sm text-stone-900 placeholder:text-stone-400 focus:border-[#166F77] focus:ring-2 focus:ring-[#166F77]/10 focus:outline-none transition"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-stone-700 mb-1.5">
                        State <span className="text-rose-500">*</span>
                      </label>
                      <select
                        required
                        value={form.state}
                        onChange={(e) => {
                          manualEditsRef.current.state = e.target.value.trim().length > 0;
                          setForm({ ...form, state: e.target.value });
                        }}
                        className="w-full h-11 px-3.5 rounded-xl border border-stone-200 bg-white text-sm text-stone-900 focus:border-[#166F77] focus:ring-2 focus:ring-[#166F77]/10 focus:outline-none transition"
                      >
                        <option value="">Select Indian State</option>
                        {INDIAN_STATES.map((st) => (
                          <option key={st} value={st}>
                            {st}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-stone-700 mb-1.5">
                      Post Office / Locality <span className="text-rose-500">*</span>
                    </label>
                    {availablePostOffices.length > 0 ? (
                      <select
                        required
                        value={form.postOffice}
                        onChange={(e) => {
                          manualEditsRef.current.postOffice = e.target.value.trim().length > 0;
                          setForm({ ...form, postOffice: e.target.value });
                        }}
                        className="w-full h-11 px-3.5 rounded-xl border border-stone-200 bg-white text-sm text-stone-900 focus:border-[#166F77] focus:ring-2 focus:ring-[#166F77]/10 focus:outline-none transition"
                      >
                        <option value="">Select Delivery Post Office</option>
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
                        placeholder="Enter post office or locality"
                        className="w-full h-11 px-3.5 rounded-xl border border-stone-200 bg-white text-sm text-stone-900 placeholder:text-stone-400 focus:border-[#166F77] focus:ring-2 focus:ring-[#166F77]/10 focus:outline-none transition"
                      />
                    )}
                  </div>
                </div>
              </section>

              {/* SECTION 4: BILLING ADDRESS */}
              <section className="bg-white rounded-2xl border border-stone-200/90 p-5 sm:p-7 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-base font-semibold text-stone-900 flex items-center gap-2.5">
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-[#166F77] text-white text-xs font-bold">
                      4
                    </span>
                    Billing Address
                  </h2>
                </div>

                <div className="pt-2">
                  <label className="flex items-center gap-3 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={billingSameAsShipping}
                      onChange={(e) => setBillingSameAsShipping(e.target.checked)}
                      className="w-4 h-4 rounded text-[#166F77] focus:ring-[#166F77] border-stone-300 transition"
                    />
                    <span className="text-sm font-medium text-stone-800">
                      My billing address is the same as my delivery address
                    </span>
                  </label>

                  {!billingSameAsShipping && (
                    <div className="mt-5 pt-5 border-t border-stone-100 space-y-4">
                      <p className="text-xs text-stone-500 font-medium">
                        Please provide the billing address for the tax invoice:
                      </p>

                      <div>
                        <label className="block text-xs font-medium text-stone-700 mb-1.5">
                          Billing Name / Company <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          required={!billingSameAsShipping}
                          value={billingForm.name}
                          onChange={(e) => setBillingForm({ ...billingForm, name: e.target.value })}
                          placeholder="Name as registered for billing"
                          className="w-full h-11 px-3.5 rounded-xl border border-stone-200 bg-white text-sm text-stone-900 placeholder:text-stone-400 focus:border-[#166F77] focus:ring-2 focus:ring-[#166F77]/10 focus:outline-none transition"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-stone-700 mb-1.5">
                          Billing Address Line 1 <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          required={!billingSameAsShipping}
                          value={billingForm.line1}
                          onChange={(e) => setBillingForm({ ...billingForm, line1: e.target.value })}
                          placeholder="Building, street, office"
                          className="w-full h-11 px-3.5 rounded-xl border border-stone-200 bg-white text-sm text-stone-900 placeholder:text-stone-400 focus:border-[#166F77] focus:ring-2 focus:ring-[#166F77]/10 focus:outline-none transition"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-stone-700 mb-1.5">
                          Billing Address Line 2{" "}
                          <span className="text-stone-400 font-normal">(Optional)</span>
                        </label>
                        <input
                          type="text"
                          value={billingForm.line2}
                          onChange={(e) => setBillingForm({ ...billingForm, line2: e.target.value })}
                          placeholder="Area, landmark, unit"
                          className="w-full h-11 px-3.5 rounded-xl border border-stone-200 bg-white text-sm text-stone-900 placeholder:text-stone-400 focus:border-[#166F77] focus:ring-2 focus:ring-[#166F77]/10 focus:outline-none transition"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-stone-700 mb-1.5">
                          PIN Code <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          required={!billingSameAsShipping}
                          maxLength={6}
                          value={billingForm.pincode}
                          onChange={(e) => setBillingForm({ ...billingForm, pincode: e.target.value })}
                          placeholder="6-digit Indian PIN Code"
                          className="w-full h-11 px-3.5 rounded-xl border border-stone-200 bg-white text-sm text-stone-900 placeholder:text-stone-400 focus:border-[#166F77] focus:ring-2 focus:ring-[#166F77]/10 focus:outline-none transition"
                        />
                      </div>

                      <div className="grid sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-medium text-stone-700 mb-1.5">
                            City <span className="text-rose-500">*</span>
                          </label>
                          <input
                            type="text"
                            required={!billingSameAsShipping}
                            value={billingForm.city}
                            onChange={(e) => {
                              billingManualEditsRef.current.city = e.target.value.trim().length > 0;
                              setBillingForm({ ...billingForm, city: e.target.value });
                            }}
                            placeholder="Billing city"
                            className="w-full h-11 px-3.5 rounded-xl border border-stone-200 bg-white text-sm text-stone-900 placeholder:text-stone-400 focus:border-[#166F77] focus:ring-2 focus:ring-[#166F77]/10 focus:outline-none transition"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-stone-700 mb-1.5">
                            State <span className="text-rose-500">*</span>
                          </label>
                          <select
                            required={!billingSameAsShipping}
                            value={billingForm.state}
                            onChange={(e) => {
                              billingManualEditsRef.current.state = e.target.value.trim().length > 0;
                              setBillingForm({ ...billingForm, state: e.target.value });
                            }}
                            className="w-full h-11 px-3.5 rounded-xl border border-stone-200 bg-white text-sm text-stone-900 focus:border-[#166F77] focus:ring-2 focus:ring-[#166F77]/10 focus:outline-none transition"
                          >
                            <option value="">Select Indian State</option>
                            {INDIAN_STATES.map((st) => (
                              <option key={st} value={st}>
                                {st}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </section>

              {/* SECTION 5: GST INVOICE OPTION */}
              <section className="bg-white rounded-2xl border border-stone-200/90 p-5 sm:p-7 shadow-sm">
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
                      className="mt-0.5 w-4 h-4 rounded text-[#166F77] focus:ring-[#166F77] border-stone-300 transition"
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-stone-900">I need a GST invoice</p>
                        <span className="text-[10px] font-semibold text-[#166F77] bg-[#166F77]/10 px-2 py-0.5 rounded-full">
                          B2B / Tax Credit
                        </span>
                      </div>
                      <p className="text-xs text-stone-500 mt-0.5">
                        Add your registered Business Name and GSTIN to claim GST input tax credit
                      </p>
                    </div>
                  </label>
                </div>

                {form.needsGstInvoice && (
                  <div className="mt-5 pt-5 border-t border-stone-100 space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-stone-700 mb-1.5">
                        Registered Business / Company Name <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={form.businessName}
                        onChange={(e) => setForm({ ...form, businessName: e.target.value })}
                        placeholder="e.g. Radhavallabh Enterprises Pvt Ltd"
                        className="w-full h-11 px-3.5 rounded-xl border border-stone-200 bg-white text-sm text-stone-900 placeholder:text-stone-400 focus:border-[#166F77] focus:ring-2 focus:ring-[#166F77]/10 focus:outline-none transition"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="block text-xs font-medium text-stone-700">
                          GSTIN <span className="text-stone-400 font-normal">(Optional)</span>
                        </label>
                        {form.gstin && (
                          <span
                            className={`text-[11px] font-medium flex items-center gap-1 ${
                              GSTIN_REGEX.test(form.gstin.trim().toUpperCase())
                                ? "text-emerald-700"
                                : "text-amber-600"
                            }`}
                          >
                            {GSTIN_REGEX.test(form.gstin.trim().toUpperCase()) ? (
                              <>
                                <Check className="h-3 w-3" /> Valid GSTIN format
                              </>
                            ) : (
                              <>
                                <AlertCircle className="h-3 w-3" /> 15-character required
                              </>
                            )}
                          </span>
                        )}
                      </div>
                      <input
                        type="text"
                        maxLength={15}
                        value={form.gstin}
                        onChange={(e) => setForm({ ...form, gstin: e.target.value.toUpperCase() })}
                        placeholder="e.g. 09AABCU9603R1ZM"
                        className="w-full h-11 px-3.5 rounded-xl border border-stone-200 bg-white text-sm text-stone-900 uppercase placeholder:normal-case placeholder:text-stone-400 focus:border-[#166F77] focus:ring-2 focus:ring-[#166F77]/10 focus:outline-none transition font-mono"
                      />
                      <p className="mt-1.5 text-[11px] text-stone-500">
                        GSTIN is optional. Add it only if you want your 15-character GST number printed on the official invoice.
                      </p>
                    </div>
                  </div>
                )}
              </section>

              {/* SECTION 6: PAYMENT METHOD */}
              <section className="bg-white rounded-2xl border border-stone-200/90 p-5 sm:p-7 shadow-sm">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-base font-semibold text-stone-900 flex items-center gap-2.5">
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-[#166F77] text-white text-xs font-bold">
                      5
                    </span>
                    Payment Method
                  </h2>
                </div>

                <div className="space-y-3">
                  {/* Option 1: Razorpay */}
                  <button
                    type="button"
                    onClick={() => setMethod("razorpay")}
                    className={`w-full rounded-xl border p-4 text-left transition flex items-center justify-between ${
                      method === "razorpay"
                        ? "border-[#166F77] bg-[#166F77]/5 ring-1 ring-[#166F77]/30"
                        : "border-stone-200 bg-white hover:border-stone-300"
                    }`}
                  >
                    <div className="flex items-center gap-3.5">
                      <div
                        className={`h-5 w-5 rounded-full border flex items-center justify-center shrink-0 ${
                          method === "razorpay"
                            ? "border-[#166F77] bg-[#166F77]"
                            : "border-stone-300 bg-white"
                        }`}
                      >
                        {method === "razorpay" && (
                          <Check className="h-3 w-3 text-white stroke-[3]" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-stone-900">
                            Online Payment (Razorpay)
                          </p>
                          <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-1.5 py-0.2 rounded">
                            Fastest
                          </span>
                        </div>
                        <p className="text-xs text-stone-500 mt-0.5">
                          UPI (GPay, PhonePe, Paytm), Credit/Debit Cards, NetBanking & Wallets
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-2.5 py-1 rounded-full shrink-0">
                      <Lock className="h-3 w-3" />
                      <span>Instant & 100% Safe</span>
                    </div>
                  </button>

                  {/* Option 2: Cash on Delivery */}
                  {codAvailable && (
                    <button
                      type="button"
                      onClick={() => setMethod("cod")}
                      className={`w-full rounded-xl border p-4 text-left transition flex items-center justify-between ${
                        method === "cod"
                          ? "border-[#166F77] bg-[#166F77]/5 ring-1 ring-[#166F77]/30"
                          : "border-stone-200 bg-white hover:border-stone-300"
                      }`}
                    >
                      <div className="flex items-center gap-3.5">
                        <div
                          className={`h-5 w-5 rounded-full border flex items-center justify-center shrink-0 ${
                            method === "cod"
                              ? "border-[#166F77] bg-[#166F77]"
                              : "border-stone-300 bg-white"
                          }`}
                        >
                          {method === "cod" && <Check className="h-3 w-3 text-white stroke-[3]" />}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-stone-900">Cash on Delivery (COD)</p>
                          <p className="text-xs text-stone-500 mt-0.5">Pay in cash when your sacred package arrives</p>
                        </div>
                      </div>
                      <span className="text-xs text-stone-500">COD Available</span>
                    </button>
                  )}

                  {!codAvailable && (
                    <p className="text-xs text-stone-400 px-1 py-0.5">
                      Cash on Delivery is currently unavailable.
                    </p>
                  )}
                </div>

                <div className="mt-4 pt-4 border-t border-stone-100 flex items-center justify-between text-xs text-stone-500">
                  <div className="flex items-center gap-1.5">
                    <ShieldCheck className="h-4 w-4 text-[#166F77] shrink-0" />
                    <span>Protected by 128-bit Bank-grade Encryption</span>
                  </div>
                  <span className="text-[11px] text-stone-400">Powered by Razorpay</span>
                </div>
              </section>

              {/* SECTION 7: TERMS & POLICIES CONSENT */}
              <section
                id="terms-checkbox-section"
                className={`rounded-2xl border p-5 transition ${
                  termsError
                    ? "bg-rose-50/70 border-rose-300 ring-2 ring-rose-200"
                    : "bg-white border-stone-200/90 shadow-sm"
                }`}
              >
                <label className="flex items-start gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={acceptedTerms}
                    onChange={(e) => {
                      setAcceptedTerms(e.target.checked);
                      if (e.target.checked) setTermsError(false);
                    }}
                    className="mt-1 w-4 h-4 rounded text-[#166F77] focus:ring-[#166F77] border-stone-300 transition shrink-0"
                  />
                  <div className="text-xs text-stone-700 leading-relaxed">
                    <span className="font-semibold text-stone-900">
                      I have read and agree to the{" "}
                    </span>
                    <a
                      href="/terms"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#166F77] font-semibold underline underline-offset-2 hover:text-[#125B62] inline-flex items-center gap-0.5"
                    >
                      Terms & Conditions
                      <ExternalLink className="h-2.5 w-2.5 inline" />
                    </a>
                    ,{" "}
                    <a
                      href="/privacy"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#166F77] font-semibold underline underline-offset-2 hover:text-[#125B62] inline-flex items-center gap-0.5"
                    >
                      Privacy Policy
                      <ExternalLink className="h-2.5 w-2.5 inline" />
                    </a>
                    ,{" "}
                    <a
                      href="/shipping"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#166F77] font-semibold underline underline-offset-2 hover:text-[#125B62] inline-flex items-center gap-0.5"
                    >
                      Shipping Policy
                      <ExternalLink className="h-2.5 w-2.5 inline" />
                    </a>
                    {" and "}
                    <a
                      href="/returns"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#166F77] font-semibold underline underline-offset-2 hover:text-[#125B62] inline-flex items-center gap-0.5"
                    >
                      Return & Refund Policy
                      <ExternalLink className="h-2.5 w-2.5 inline" />
                    </a>
                    .
                  </div>
                </label>

                {termsError && (
                  <p className="mt-2.5 text-xs text-rose-600 font-medium flex items-center gap-1">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    You must accept the terms and policies to complete your order.
                  </p>
                )}
              </section>
            </div>

            {/* Right Column: Sticky Order Summary */}
            <div className="lg:col-span-5 xl:col-span-4">
              <aside className="bg-white rounded-2xl border border-stone-200/90 p-5 sm:p-6 shadow-sm lg:sticky lg:top-24 space-y-5">
                <div className="flex items-center justify-between pb-4 border-b border-stone-100">
                  <h2 className="text-base font-semibold text-stone-900 flex items-center gap-2">
                    <span>Order Summary</span>
                  </h2>
                  <span className="text-xs font-semibold bg-[#FAF7F2] text-[#166F77] border border-[#166F77]/20 px-2.5 py-0.5 rounded-full">
                    {items.length} {items.length === 1 ? "item" : "items"}
                  </span>
                </div>

                {/* Products List */}
                <div className="space-y-3.5 max-h-80 overflow-y-auto pr-1">
                  {items.map((i) => {
                    const hasMrp = i.product.mrp && i.product.mrp > i.product.price;
                    const itemSavings = hasMrp ? (i.product.mrp! - i.product.price) * i.qty : 0;
                    const savingsPercent = hasMrp ? Math.round(((i.product.mrp! - i.product.price) / i.product.mrp!) * 100) : 0;

                    return (
                      <div key={i.productId} className="flex gap-3 text-sm items-start py-2 border-b border-stone-50 last:border-0">
                        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-stone-100 bg-[#FAF7F2] p-1 flex items-center justify-center">
                          <img
                            src={i.product.image}
                            className="h-full w-full object-contain"
                            alt={i.product.name}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-stone-900 text-xs sm:text-sm line-clamp-2 leading-snug">
                            {i.product.name}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-stone-500 font-medium">Qty: {i.qty}</span>
                            <span className="text-xs text-stone-400">•</span>
                            <span className="text-xs text-stone-700 font-medium">{formatINR(i.product.price)} each</span>
                          </div>

                          {hasMrp && (
                            <div className="flex items-center gap-1.5 mt-1">
                              <span className="text-[11px] text-stone-400 line-through">
                                {formatINR(i.product.mrp! * i.qty)}
                              </span>
                              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded">
                                Save {formatINR(itemSavings)} ({savingsPercent}%)
                              </span>
                            </div>
                          )}
                        </div>
                        <span className="font-semibold text-stone-900 text-xs sm:text-sm shrink-0 pt-0.5">
                          {formatINR(i.product.price * i.qty)}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Price Breakdown */}
                <div className="pt-4 border-t border-stone-100 space-y-2.5 text-xs sm:text-sm">
                  <div className="flex justify-between text-stone-600">
                    <span>Items Subtotal</span>
                    <span className="font-medium text-stone-800">{formatINR(subtotal)}</span>
                  </div>

                  {totalSavings > 0 && (
                    <div className="flex justify-between text-emerald-700 font-medium">
                      <span>Total Savings</span>
                      <span>- {formatINR(totalSavings)}</span>
                    </div>
                  )}

                  <div className="flex justify-between text-stone-600 items-center">
                    <span>Delivery / Shipping</span>
                    {shipping === 0 ? (
                      <span className="font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-2 py-0.5 rounded text-xs">
                        FREE SHIPPING
                      </span>
                    ) : (
                      <span className="font-medium text-stone-800">{formatINR(shipping)}</span>
                    )}
                  </div>

                  <div className="flex justify-between text-stone-500 text-[11px] pt-1">
                    <span>Taxes & GST</span>
                    <span>Included in prices</span>
                  </div>

                  <div className="pt-3 border-t border-stone-200 flex justify-between items-baseline">
                    <div>
                      <span className="text-sm font-semibold text-stone-900 block">Total Payable</span>
                      <span className="text-[11px] text-stone-400">All taxes included</span>
                    </div>
                    <span className="font-serif text-2xl font-bold text-[#166F77]">
                      {formatINR(total)}
                    </span>
                  </div>
                </div>

                {/* Desktop Place Order Button */}
                <button
                  type="submit"
                  disabled={processing}
                  className="w-full h-12 rounded-xl bg-[#166F77] text-white font-semibold text-sm hover:bg-[#125B62] active:scale-[0.99] transition shadow-md shadow-[#166F77]/20 disabled:cursor-not-allowed disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {processing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Processing Order...</span>
                    </>
                  ) : (
                    <>
                      <Lock className="h-4 w-4" />
                      <span>{method === "razorpay" ? `Securely Pay ${formatINR(total)}` : `Place Order • ${formatINR(total)}`}</span>
                    </>
                  )}
                </button>

                {/* Reassurance Badges */}
                <div className="pt-2 border-t border-stone-100 space-y-2">
                  <div className="flex items-center gap-2 text-[11px] text-stone-600">
                    <Sparkles className="h-3.5 w-3.5 text-[#D9A441] shrink-0" />
                    <span>Blessed & Consecrated in Vrindavan Dham</span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-stone-600">
                    <Truck className="h-3.5 w-3.5 text-[#166F77] shrink-0" />
                    <span>Safe transit packaging with live tracking</span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-stone-600">
                    <HeartHandshake className="h-3.5 w-3.5 text-rose-500 shrink-0" />
                    <span>Dedicated Devotee Support: +91 7500533505</span>
                  </div>
                </div>
              </aside>
            </div>
          </form>
        </div>

        {/* MOBILE STICKY CHECKOUT BAR */}
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-stone-200 p-3.5 shadow-2xl lg:hidden pb-[max(0.875rem,env(safe-area-inset-bottom))]">
          <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] text-stone-500 font-medium">Total Amount</p>
              <p className="font-serif text-lg font-bold text-[#166F77] leading-tight">
                {formatINR(total)}
              </p>
            </div>

            <button
              type="button"
              onClick={(e) => {
                if (formRef.current) {
                  formRef.current.requestSubmit();
                } else {
                  submit(e as any);
                }
              }}
              disabled={processing}
              className="flex-1 max-w-[220px] h-11 rounded-xl bg-[#166F77] text-white font-semibold text-xs sm:text-sm hover:bg-[#125B62] active:scale-[0.99] transition shadow-md shadow-[#166F77]/20 disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {processing ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <Lock className="h-3.5 w-3.5" />
                  <span>{method === "razorpay" ? `Pay ${formatINR(total)}` : "Place Order"}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </Layout>
  );
}
