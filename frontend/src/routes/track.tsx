import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect, useRef, useCallback } from "react";
import { Layout } from "@/components/Layout";
import { formatINR, useStore, type NormalizedTrackingData } from "@/lib/store";
import { api, isApiEnabled } from "@/lib/api";
import { slugify } from "@/lib/seo";
import {
  Check,
  Package,
  Search,
  Truck,
  MapPin,
  ExternalLink,
  AlertTriangle,
  Clock,
  CheckCircle2,
  XCircle,
  Phone,
  MessageCircle,
  RefreshCw,
  Sparkles,
  Copy,
  Mail,
} from "lucide-react";
import { toast } from "sonner";

type Search = { id?: string };

const MAIN_STAGES = [
  "Placed",
  "Confirmed",
  "Processing",
  "Packed",
  "Shipped",
  "Out for delivery",
  "Delivered",
] as const;

type TrackedOrder = {
  orderNo?: number;
  trackingId?: string;
  status: string;
  holdReason?: string;
  statusHistory?: {
    status: string;
    changedAt: string;
    holdReason?: string;
  }[];
  courier?: string | null;
  courierTrackingUrl?: string;
  courierTrackingData?: NormalizedTrackingData | null;
  createdAt: string;
  items: {
    productId?: string;
    slug?: string;
    name?: string;
    image?: string;
    qty: number;
    price?: number;
  }[];
  total: number;
  address: { name?: string; city?: string; state?: string; pincode?: string };
  payment: { method: string; status: string };
};

export const Route = createFileRoute("/track")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    id: typeof s.id === "string" ? s.id : undefined,
  }),
  component: TrackPage,
  head: () => ({
    meta: [
      { title: "Track Your Order - Shri Radha Govind Store" },
      {
        name: "description",
        content:
          "Track your Shri Radha Govind Store sacred order in real time. Live status updates, courier tracking, and delivery progress from Vrindavan Dham.",
      },
      { property: "og:title", content: "Track Your Order - Shri Radha Govind Store" },
      {
        property: "og:description",
        content: "Live sacred order tracking blessed in Vrindavan Dham.",
      },
      { property: "og:url", content: "https://www.shriradhagovindstore.com/track" },
    ],
    links: [{ rel: "canonical", href: "https://www.shriradhagovindstore.com/track" }],
  }),
});

function TrackPage() {
  const { settings } = useStore();
  const supportEmail = settings?.supportEmail?.trim() || "support@shriradhagovindstore.com";
  const whatsappPhone = settings?.whatsappPhone?.trim() || "917500533505";
  const search = Route.useSearch();
  const [id, setId] = useState(search.id ?? "");
  const [loading, setLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [order, setOrder] = useState<TrackedOrder | null>(null);
  const [liveTracking, setLiveTracking] = useState<NormalizedTrackingData | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const activeTermRef = useRef<string>("");

  const lookup = useCallback(
    async (term: string, isSilent = false) => {
      const t = term.trim().toUpperCase().replace(/^#/, "");
      if (!t) return;
      activeTermRef.current = t;

      if (!isSilent) {
        setLoading(true);
        setErr(null);
      } else {
        setIsRefreshing(true);
      }

      try {
        if (!isApiEnabled()) {
          const raw = localStorage.getItem("shri_radha_govind_v1_orders");
          const orders = raw ? JSON.parse(raw) : [];
          const found = orders.find(
            (o: any) =>
              (o.trackingId ?? "").toUpperCase() === t ||
              String(o.orderNo ?? "") === t ||
              o.id === t
          );
          if (!found) throw new Error("No order found for this tracking ID or Order Number");
          setOrder({
            orderNo: found.orderNo,
            trackingId: found.trackingId,
            status: found.status,
            holdReason: found.holdReason,
            statusHistory: found.statusHistory,
            courier: found.courier ?? null,
            courierTrackingUrl: found.courierTrackingUrl ?? "",
            courierTrackingData: found.courierTrackingData ?? null,
            createdAt: new Date(found.createdAt).toISOString(),
            items: found.items.map((i: any) => ({
              name: i.product?.name,
              image: i.product?.image,
              qty: i.qty,
              price: i.product?.price,
            })),
            total: found.total,
            address: found.address,
            payment: found.payment,
          });
          setLiveTracking(found.courierTrackingData ?? null);
        } else {
          const r = await api<{ order: TrackedOrder; tracking?: NormalizedTrackingData }>(
            `/orders/track/${encodeURIComponent(t)}`
          );
          setOrder(r.order);
          if (r.tracking) {
            setLiveTracking(r.tracking);
          } else if (r.order?.courierTrackingData) {
            setLiveTracking(r.order.courierTrackingData);
          } else {
            setLiveTracking(null);
          }
        }
        setLastUpdated(new Date());
        setErr(null);
      } catch (e: any) {
        if (!isSilent) {
          setErr(e?.message ?? "No matching order found");
          toast.error(e?.message ?? "No matching order found");
          setOrder(null);
          setLiveTracking(null);
        }
      } finally {
        setLoading(false);
        setIsRefreshing(false);
      }
    },
    []
  );

  useEffect(() => {
    if (search.id) {
      lookup(search.id);
    }
  }, [search.id, lookup]);

  // Automatic Polling (15-20s while active) & Visibility Change Refetch
  useEffect(() => {
    if (!order) return;
    const isTerminal = order.status === "Delivered" || order.status === "Cancelled";
    if (isTerminal) return;

    const interval = setInterval(() => {
      if (document.visibilityState === "visible" && activeTermRef.current) {
        lookup(activeTermRef.current, true);
      }
    }, 18000);

    const onVisibilityOrFocus = () => {
      if (document.visibilityState === "visible" && activeTermRef.current) {
        lookup(activeTermRef.current, true);
      }
    };

    window.addEventListener("focus", onVisibilityOrFocus);
    document.addEventListener("visibilitychange", onVisibilityOrFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", onVisibilityOrFocus);
      document.removeEventListener("visibilitychange", onVisibilityOrFocus);
    };
  }, [order, lookup]);

  const currentIdx = order ? MAIN_STAGES.indexOf(order.status as any) : -1;
  const isHold = order?.status === "Hold";
  const isCancelled = order?.status === "Cancelled";
  const tracking = liveTracking || order?.courierTrackingData || null;
  const hasShipment = Boolean(
    order?.trackingId || order?.courier || (tracking && tracking.checkpoints && tracking.checkpoints.length > 0)
  );

  return (
    <Layout>
      <div className="container-app py-10 max-w-4xl">
        {/* Header */}
        <div className="text-center max-w-xl mx-auto">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#166F77]/10 text-[#166F77] text-xs font-semibold uppercase tracking-wider mb-3">
            <Sparkles className="w-3.5 h-3.5 text-[#166F77]" /> Live Sacred Tracking
          </div>
          <h1 className="font-serif text-3xl sm:text-4xl text-stone-900 tracking-tight">
            Track your sacred order
          </h1>
          <p className="text-sm text-stone-600 mt-2">
            Enter your 4-digit Order Number (e.g. <span className="font-mono font-semibold">#5007</span>) or AWB Tracking ID to view real-time fulfillment and transit updates.
          </p>
        </div>

        {/* Search Input */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            lookup(id);
          }}
          className="mt-8 max-w-xl mx-auto flex gap-2"
        >
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
            <input
              value={id}
              onChange={(e) => setId(e.target.value)}
              placeholder="e.g. 5007 or DTDC1234567"
              className="w-full h-12 pl-11 pr-4 rounded-full border border-stone-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#166F77]/30 focus:border-[#166F77] text-sm uppercase tracking-wider font-medium text-stone-800 shadow-sm"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="h-12 px-7 rounded-full bg-[#166F77] hover:bg-[#125B62] text-white text-sm font-medium transition shadow-md shadow-[#166F77]/20 disabled:opacity-50 inline-flex items-center gap-2"
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" /> Searching...
              </>
            ) : (
              "Track Order"
            )}
          </button>
        </form>

        {/* Error State */}
        {err && !order && (
          <div className="max-w-xl mx-auto mt-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-3">
            <XCircle className="w-5 h-5 shrink-0 text-red-500" />
            <div>
              <p className="font-semibold">Order not found</p>
              <p className="text-xs text-red-600 mt-0.5">
                Please double check your Order Number or Tracking ID. If you placed your order recently, it may take a few moments to sync.
              </p>
            </div>
          </div>
        )}

        {/* Loading Skeleton */}
        {loading && !order && (
          <div className="mt-10 space-y-6 animate-pulse">
            <div className="bg-white rounded-2xl p-6 border border-stone-200 shadow-sm space-y-4">
              <div className="h-6 bg-stone-200 rounded w-1/3" />
              <div className="h-4 bg-stone-100 rounded w-1/2" />
              <div className="h-20 bg-stone-100 rounded-xl mt-6" />
            </div>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="h-48 bg-white rounded-2xl border border-stone-200" />
              <div className="h-48 bg-white rounded-2xl border border-stone-200" />
            </div>
          </div>
        )}

        {/* Order Details Display */}
        {order && (
          <div className="mt-8 space-y-6">
            {/* Status Card & Stepper */}
            <div className="bg-white rounded-2xl p-6 sm:p-8 border border-stone-200 shadow-sm relative overflow-hidden">
              {/* Top Banner */}
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-stone-100 pb-6">
                <div>
                  <div className="flex items-center gap-2">
                    {order.orderNo && (
                      <span className="font-serif text-2xl sm:text-3xl font-bold text-stone-900">
                        Order #{order.orderNo}
                      </span>
                    )}
                    {isRefreshing && (
                      <span className="inline-flex items-center gap-1 text-[11px] text-[#166F77] font-medium bg-[#166F77]/10 px-2 py-0.5 rounded-full">
                        <RefreshCw className="w-3 h-3 animate-spin" /> Live sync
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-stone-500 mt-1">
                    Placed on {new Date(order.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                  </p>
                </div>

                <div className="text-right flex flex-col items-end">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-400">
                    Fulfillment Status
                  </span>
                  <div className="mt-1 flex items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                        isCancelled
                          ? "bg-red-50 text-red-700 border border-red-200"
                          : isHold
                          ? "bg-amber-50 text-amber-800 border border-amber-300 animate-pulse"
                          : order.status === "Delivered"
                          ? "bg-emerald-50 text-emerald-800 border border-emerald-300"
                          : "bg-teal-50 text-[#166F77] border border-teal-200"
                      }`}
                    >
                      {isHold ? (
                        <Clock className="w-3.5 h-3.5 text-amber-600" />
                      ) : isCancelled ? (
                        <XCircle className="w-3.5 h-3.5 text-red-600" />
                      ) : (
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75" />
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-[#166F77]" />
                        </span>
                      )}
                      {order.status}
                    </span>
                  </div>
                  {lastUpdated && (
                    <span className="text-[10px] text-stone-400 mt-1">
                      Updated {lastUpdated.toLocaleTimeString("en-IN", { timeStyle: "short" })}
                    </span>
                  )}
                </div>
              </div>

              {/* Hold Notice Banner */}
              {isHold && (
                <div className="mt-6 p-4 rounded-xl bg-amber-50/90 border border-amber-300 text-amber-900 space-y-2">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="font-semibold text-sm text-amber-950">
                        Your Order is on Temporary Hold
                      </p>
                      <p className="text-xs text-amber-800 mt-1 leading-relaxed">
                        <span className="font-semibold">Reason:</span>{" "}
                        {order.holdReason || "Order details or customization verification is currently in progress."}
                      </p>
                      <p className="text-xs text-amber-700 mt-2">
                        Our Vrindavan Dham customer care team is reviewing your order. If you have any questions or updates, please reach out to us directly:
                      </p>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <a
                          href="https://wa.me/917412589641?text=Hare%20Krishna!%20Inquiry%20regarding%20Order%20Hold%20status"
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium transition shadow-sm"
                        >
                          <MessageCircle className="w-3.5 h-3.5" /> Chat on WhatsApp
                        </a>
                        <a
                          href="tel:+917412589641"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-amber-300 text-amber-900 text-xs font-medium hover:bg-amber-100 transition shadow-sm"
                        >
                          <Phone className="w-3.5 h-3.5 text-amber-700" /> Call Support
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Cancelled Notice */}
              {isCancelled && (
                <div className="mt-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 flex items-start gap-3">
                  <XCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-sm text-red-900">This Order Has Been Cancelled</p>
                    <p className="text-xs text-red-700 mt-1">
                      For refund inquiries or assistance, please contact support at{" "}
                      <a href={`mailto:${supportEmail}`} className="font-semibold underline hover:text-red-950">
                        {supportEmail}
                      </a>.
                    </p>
                  </div>
                </div>
              )}

              {/* Progress Stepper (Hidden on Cancelled) */}
              {!isCancelled && (
                <div className="mt-8 pt-2">
                  {/* Delivered Celebration Notice */}
                  {order.status === "Delivered" && (
                    <div className="mb-6 p-4 rounded-xl bg-gradient-to-r from-emerald-50 via-teal-50/70 to-emerald-50 border border-emerald-200/80 text-emerald-950 flex items-center gap-3.5 shadow-sm">
                      <div className="w-10 h-10 rounded-full bg-emerald-600 text-white grid place-items-center shrink-0 shadow-md shadow-emerald-600/20">
                        <CheckCircle2 className="w-5 h-5 stroke-[2.5]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-sm text-emerald-950">
                            Sacred Order Successfully Delivered
                          </p>
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-800 bg-emerald-100/70 px-2 py-0.5 rounded-full">
                            <Sparkles className="w-3 h-3 text-amber-600" /> Sri Vrindavan Dham
                          </span>
                        </div>
                        <p className="text-xs text-emerald-800/90 mt-0.5 leading-relaxed">
                          Your package has safely arrived with divine blessings. May Thakur Ji & Sri Radha Rani bless your home with joy and prosperity.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Desktop Stepper */}
                  <div className="hidden md:block">
                    <div className="grid grid-cols-7 relative">
                      {MAIN_STAGES.map((stage, i) => {
                        const isDelivered = stage === "Delivered" && currentIdx >= i;
                        const isCompleted = currentIdx > i || isDelivered;
                        const isCurrent = currentIdx === i && !isHold && !isDelivered;
                        const isPastOrCurrent = currentIdx >= i;
                        const hasConnector = i < MAIN_STAGES.length - 1;

                        // Connector fill calculation from stage i to stage i+1 (NO connector exists after Delivered)
                        const isConnectorCompleted = currentIdx > i;
                        const isConnectorActive = currentIdx === i && !isHold;

                        return (
                          <div key={stage} className="relative flex flex-col items-center text-center group">
                            {/* Segmented Connector line to NEXT stage (strictly i < length - 1, NEVER after Delivered) */}
                            {hasConnector && (
                              <div className="absolute top-5 left-1/2 w-full h-1.5 bg-stone-100 rounded-full z-0 overflow-hidden shadow-inner">
                                <div
                                  className={`h-full rounded-full transition-all duration-700 ease-out ${
                                    isConnectorCompleted
                                      ? "w-full bg-gradient-to-r from-[#166F77] via-teal-500 to-[#166F77]"
                                      : isConnectorActive
                                      ? "w-1/2 bg-gradient-to-r from-[#166F77] to-teal-400 animate-pulse"
                                      : isHold && i === MAIN_STAGES.indexOf("Processing")
                                      ? "w-1/2 bg-amber-400 animate-pulse"
                                      : "w-0"
                                  }`}
                                />
                              </div>
                            )}

                            {/* Node Circle */}
                            <div
                              className={`relative z-10 h-10 w-10 rounded-full grid place-items-center transition-all duration-500 ${
                                isDelivered
                                  ? "bg-gradient-to-br from-emerald-600 via-teal-600 to-emerald-700 text-white shadow-lg shadow-emerald-600/30 ring-4 ring-emerald-100 font-bold"
                                  : isCompleted
                                  ? "bg-[#166F77] text-white shadow-md shadow-[#166F77]/20 ring-4 ring-teal-50"
                                  : isCurrent
                                  ? "bg-white border-2 border-[#166F77] text-[#166F77] ring-4 ring-[#166F77]/25 shadow-lg font-bold"
                                  : "bg-stone-50 border border-stone-200 text-stone-400"
                              }`}
                            >
                              {isDelivered ? (
                                <Check className="h-5 w-5 stroke-[3] text-white motion-safe:animate-scale-in" />
                              ) : isCompleted ? (
                                <Check className="h-4 w-4 stroke-[3] motion-safe:animate-scale-in" />
                              ) : isCurrent ? (
                                <span className="relative flex h-3 w-3">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#166F77] opacity-75" />
                                  <span className="relative inline-flex rounded-full h-3 w-3 bg-[#166F77]" />
                                </span>
                              ) : (
                                <span className="text-xs font-semibold">{i + 1}</span>
                              )}
                            </div>

                            {/* Stage Label */}
                            <p
                              className={`text-xs mt-2.5 px-1 leading-tight transition-colors ${
                                isDelivered
                                  ? "text-emerald-800 font-bold"
                                  : isCurrent
                                  ? "text-[#166F77] font-bold"
                                  : isPastOrCurrent
                                  ? "text-stone-900 font-semibold"
                                  : "text-stone-400 font-normal"
                              }`}
                            >
                              {stage}
                            </p>

                            {/* Status Micro-badge */}
                            {isDelivered && (
                              <span className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 rounded-full shadow-xs">
                                <Sparkles className="w-2.5 h-2.5 text-amber-500 shrink-0" /> Blessed
                              </span>
                            )}
                            {isCurrent && (
                              <span className="mt-1 text-[10px] font-semibold text-[#166F77] bg-teal-50 border border-teal-200/70 px-2 py-0.5 rounded-full">
                                In Progress
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Mobile Stepper (Vertical Timeline) */}
                  <div className="md:hidden mt-4 space-y-0">
                    {MAIN_STAGES.map((stage, i) => {
                      const isDelivered = stage === "Delivered" && currentIdx >= i;
                      const isCompleted = currentIdx > i || isDelivered;
                      const isCurrent = currentIdx === i && !isHold && !isDelivered;
                      const isPastOrCurrent = currentIdx >= i;
                      const isLast = i === MAIN_STAGES.length - 1;

                      return (
                        <div key={stage} className="relative flex items-start gap-3.5 pb-5 last:pb-0">
                          {/* Vertical Connector Line (strictly !isLast, NEVER after Delivered) */}
                          {!isLast && (
                            <div
                              className={`absolute left-[15px] top-8 bottom-0 w-0.5 transition-colors duration-500 ${
                                currentIdx > i
                                  ? "bg-[#166F77]"
                                  : currentIdx === i && !isHold
                                  ? "bg-gradient-to-b from-[#166F77] to-stone-200"
                                  : "bg-stone-200"
                              }`}
                            />
                          )}

                          {/* Node Circle */}
                          <div
                            className={`relative z-10 h-8 w-8 rounded-full grid place-items-center shrink-0 text-xs font-semibold transition-all duration-300 ${
                              isDelivered
                                ? "bg-gradient-to-br from-emerald-600 to-[#166F77] text-white ring-4 ring-emerald-100 shadow-sm"
                                : isCompleted
                                ? "bg-[#166F77] text-white shadow-sm ring-2 ring-teal-50"
                                : isCurrent
                                ? "bg-white border-2 border-[#166F77] text-[#166F77] ring-4 ring-[#166F77]/20 font-bold"
                                : "bg-stone-50 text-stone-400 border border-stone-200"
                            }`}
                          >
                            {isDelivered ? (
                              <Check className="h-4 w-4 stroke-[3] text-white" />
                            ) : isCompleted ? (
                              <Check className="h-3.5 w-3.5 stroke-[3]" />
                            ) : isCurrent ? (
                              <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#166F77] opacity-75" />
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#166F77]" />
                              </span>
                            ) : (
                              i + 1
                            )}
                          </div>

                          <div className="flex-1 min-w-0 pt-1">
                            <div className="flex items-center justify-between gap-2">
                              <p
                                className={`text-sm ${
                                  isDelivered
                                    ? "text-emerald-800 font-bold"
                                    : isPastOrCurrent
                                    ? "text-stone-900 font-semibold"
                                    : "text-stone-400"
                                }`}
                              >
                                {stage}
                              </p>
                              {isDelivered && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 rounded-full">
                                  <Sparkles className="w-2.5 h-2.5 text-amber-500" /> Delivered
                                </span>
                              )}
                              {isCurrent && (
                                <span className="text-[10px] font-semibold uppercase tracking-wider text-[#166F77] bg-teal-50 border border-teal-200/70 px-2 py-0.5 rounded-full">
                                  Active Stage
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Shipment / Courier Details */}
              <div className="mt-8 pt-6 border-t border-stone-100 flex flex-wrap items-center justify-between gap-4">
                <div className="space-y-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-stone-400">
                    Shipment Tracking ID (AWB)
                  </p>
                  {order.trackingId ? (
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-teal-50 border border-teal-200 text-teal-900 font-mono text-sm font-bold">
                      <span>{order.trackingId}</span>
                    </div>
                  ) : (
                    <p className="text-xs text-stone-500 italic">
                      Tracking ID will be assigned by warehouse team once packed & handed to courier.
                    </p>
                  )}
                  {order.courier && (
                    <p className="text-xs text-stone-600 pt-0.5">
                      Courier Partner: <span className="font-semibold text-stone-900">{order.courier}</span>
                    </p>
                  )}
                </div>

                {order.courierTrackingUrl && (
                  <a
                    href={order.courierTrackingUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="h-10 px-5 rounded-full border border-[#166F77] text-[#166F77] hover:bg-[#166F77]/10 text-xs font-semibold inline-flex items-center gap-1.5 transition"
                  >
                    Track on {order.courier || "Courier Website"} <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            </div>

            {/* Live Shipment Tracking Card */}
            {hasShipment && (
              <div className="bg-white rounded-2xl p-6 sm:p-8 border border-stone-200 shadow-sm space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 pb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
                      <h2 className="font-serif text-xl text-stone-900">Live Shipment Tracking</h2>
                    </div>
                    <p className="text-xs text-stone-500 mt-0.5">
                      Real-time package status and courier updates for your order.
                    </p>
                  </div>

                  {order.courierTrackingUrl && (
                    <a
                      href={order.courierTrackingUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-stone-200 bg-stone-50 hover:bg-stone-100 text-stone-700 text-xs font-semibold transition shadow-sm"
                    >
                      <span>Official {order.courier || "Courier"} Tracker</span>
                      <ExternalLink className="w-3.5 h-3.5 text-stone-500" />
                    </a>
                  )}
                </div>

                {/* Shipment Meta Overview Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-stone-50/80 p-4 rounded-xl border border-stone-200/70 text-xs">
                  <div>
                    <p className="text-stone-400 font-medium uppercase tracking-wider text-[10px]">Courier Partner</p>
                    <p className="font-bold text-stone-900 mt-0.5">{order.courier || "Assigned Partner"}</p>
                  </div>
                  <div>
                    <p className="text-stone-400 font-medium uppercase tracking-wider text-[10px]">AWB / Tracking Number</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="font-mono font-bold text-stone-900 truncate">{order.trackingId || "Pending"}</span>
                      {order.trackingId && (
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(order.trackingId!);
                            toast.success("AWB Number copied to clipboard");
                          }}
                          className="text-stone-400 hover:text-stone-700 p-0.5 rounded"
                          title="Copy AWB Number"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                  <div>
                    <p className="text-stone-400 font-medium uppercase tracking-wider text-[10px]">Courier Live Status</p>
                    <p className="font-bold text-[#166F77] mt-0.5">
                      {tracking?.latestStatus ||
                        (order.status === "Delivered"
                          ? "Delivered"
                          : order.status === "Out for delivery"
                          ? "Out for Delivery"
                          : order.status === "Shipped"
                          ? (tracking?.hasCarrierScans ? "In Transit" : "Awaiting Carrier Scan")
                          : order.status)}
                    </p>
                  </div>
                  <div>
                    <p className="text-stone-400 font-medium uppercase tracking-wider text-[10px]">Expected Delivery</p>
                    <p className="font-semibold text-stone-800 mt-0.5">
                      {tracking?.expectedDeliveryDate
                        ? new Date(tracking.expectedDeliveryDate).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })
                        : "Standard Delivery (3-5 Days)"}
                    </p>
                  </div>
                </div>

                {/* Route & Latest Update Card */}
                <div className="p-4 rounded-xl border border-teal-100 bg-teal-50/40 text-xs space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-stone-700">
                    <div className="flex items-center gap-2 font-medium">
                      <MapPin className="w-4 h-4 text-[#166F77] shrink-0" />
                      {tracking?.origin ? (
                        <span>
                          <span className="font-semibold text-stone-900">{tracking.origin}</span>
                          {" → "}
                          <span className="font-semibold text-stone-900">
                            {tracking.destination || `${order.address.city}, ${order.address.state}`}
                          </span>
                        </span>
                      ) : (
                        <span>
                          <span className="text-stone-500 font-normal">Delivery Destination: </span>
                          <span className="font-semibold text-stone-900">
                            {order.address.city ? `${order.address.city}, ${order.address.state}` : (tracking?.destination || "Destination")}
                          </span>
                        </span>
                      )}
                    </div>
                    {tracking?.lastUpdated && (
                      <span className="text-[11px] text-stone-500 font-mono">
                        Provider Checked: {new Date(tracking.lastUpdated).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true })}
                      </span>
                    )}
                  </div>

                  {/* Carrier Movement / Scan Status */}
                  <div className="pt-2 border-t border-teal-100/80 text-stone-800 space-y-1.5">
                    <div className="flex flex-wrap items-baseline gap-1.5">
                      <span className="font-semibold text-[#166F77]">Carrier Scan Status: </span>
                      {tracking?.hasCarrierScans && (tracking.latestMessage || tracking.checkpoints?.length) ? (
                        <span className="font-semibold text-stone-900">
                          {tracking.latestMessage || "In Transit"}
                          {tracking.lastCarrierScanAt && (
                            <span className="text-stone-500 font-normal text-[11px] ml-1">
                              ({new Date(tracking.lastCarrierScanAt).toLocaleString("en-IN", {
                                day: "numeric",
                                month: "short",
                                hour: "numeric",
                                minute: "2-digit",
                                hour12: true,
                              })})
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="font-medium text-amber-800 bg-amber-50 border border-amber-200/70 px-2 py-0.5 rounded text-[11px]">
                          Awaiting Carrier Scan (No physical scan recorded yet)
                        </span>
                      )}
                    </div>

                    {tracking?.hasCarrierScans && tracking?.currentLocation && (
                      <div className="flex items-center gap-1.5 text-xs text-stone-700 font-medium">
                        <MapPin className="w-3.5 h-3.5 text-[#166F77] shrink-0" />
                        <span>
                          Location: <span className="font-bold text-stone-900">{tracking.currentLocation}</span>
                        </span>
                      </div>
                    )}

                    {!tracking?.hasCarrierScans && (
                      <p className="text-stone-600 leading-relaxed text-[11px]">
                        Consignment booked with {order.courier || "courier partner"}. No physical hub scans or movement updates have been received from the carrier yet. Live transit checkpoints will update automatically once scanned at the origin sorting facility.
                      </p>
                    )}
                  </div>
                </div>

                {/* Tracking Checkpoints History */}
                {tracking?.checkpoints && tracking.checkpoints.length > 0 ? (
                  <div className="space-y-3 pt-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-stone-500 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-[#166F77]" /> Shipment Activity History ({tracking.checkpoints.length})
                    </h3>
                    <ol className="relative border-l border-stone-200 ml-3 space-y-4">
                      {[...tracking.checkpoints].reverse().map((cp, idx) => (
                        <li key={`${cp.time}-${idx}`} className="ml-5 relative">
                          <span
                            className={`absolute -left-[27px] top-1 h-3.5 w-3.5 rounded-full border-2 border-white ${
                              idx === 0
                                ? "bg-[#166F77] ring-4 ring-teal-100"
                                : "bg-stone-300"
                            }`}
                          />
                          <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-xs">
                            <p className={`font-semibold ${idx === 0 ? "text-stone-900" : "text-stone-700"}`}>
                              {cp.description}
                            </p>
                            <time className="text-[11px] text-stone-400 shrink-0">
                              {new Date(cp.time).toLocaleString("en-IN", {
                                day: "numeric",
                                month: "short",
                                hour: "numeric",
                                minute: "2-digit",
                                hour12: true,
                              })}
                            </time>
                          </div>
                          {cp.location && (
                            <p className="text-[11px] text-stone-500 flex items-center gap-1 mt-0.5">
                              <MapPin className="w-3 h-3 text-stone-400" /> {cp.location}
                            </p>
                          )}
                        </li>
                      ))}
                    </ol>
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-stone-50 border border-stone-200 text-stone-600 text-xs text-center space-y-1">
                    <p className="font-semibold text-stone-800">Tracking Number Assigned</p>
                    <p className="text-stone-500">
                      Real-time courier checkpoints will appear here once the parcel is scanned at the origin hub.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Items & Delivery Cards */}
            <div className="grid md:grid-cols-2 gap-6">
              {/* Items Card */}
              <div className="bg-white rounded-2xl p-6 border border-stone-200 shadow-sm">
                <h2 className="font-serif text-lg text-stone-900 mb-4 flex items-center gap-2">
                  <Package className="w-5 h-5 text-[#166F77]" /> Items Ordered ({order.items.length})
                </h2>
                <div className="space-y-2 divide-y divide-stone-100">
                  {order.items.map((item, idx) => {
                    const productTarget =
                      item.slug ||
                      (item.name ? slugify(item.name) : "") ||
                      item.productId ||
                      "";

                    const itemContent = (
                      <>
                        {item.image ? (
                          <img
                            src={item.image}
                            alt={item.name || "Sacred item"}
                            className="w-13 h-13 rounded-xl object-cover bg-stone-100 border border-stone-200 shrink-0 group-hover:scale-105 group-hover:shadow-sm transition-all duration-200"
                          />
                        ) : (
                          <div className="w-13 h-13 rounded-xl bg-stone-100 border border-stone-200 grid place-items-center text-stone-400 shrink-0 group-hover:border-[#166F77]/30 transition-colors">
                            <Package className="w-5 h-5" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-sm font-medium text-stone-900 group-hover:text-[#166F77] truncate transition-colors">
                              {item.name}
                            </p>
                            <ExternalLink className="w-3.5 h-3.5 text-stone-400 opacity-0 group-hover:opacity-100 group-hover:text-[#166F77] group-hover:translate-x-0.5 transition-all shrink-0" />
                          </div>
                          <div className="flex items-center gap-2.5 mt-0.5">
                            <p className="text-xs text-stone-500">Qty: {item.qty}</p>
                            {typeof item.price === "number" && item.price > 0 && (
                              <p className="text-xs font-semibold text-stone-700">
                                {formatINR(item.price * item.qty)}
                              </p>
                            )}
                            <span className="text-[11px] text-[#166F77] font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                              View product →
                            </span>
                          </div>
                        </div>
                      </>
                    );

                    return productTarget ? (
                      <Link
                        key={idx}
                        to="/product/$id"
                        params={{ id: productTarget }}
                        className="pt-3 first:pt-0 flex items-center gap-3.5 group rounded-xl p-2 -mx-2 hover:bg-stone-50/80 transition-all duration-200"
                        title="View sacred product details"
                      >
                        {itemContent}
                      </Link>
                    ) : (
                      <div key={idx} className="pt-3 first:pt-0 flex items-center gap-3.5 p-2 -mx-2">
                        {itemContent}
                      </div>
                    );
                  })}
                </div>
                <div className="border-t border-stone-100 mt-4 pt-3 flex justify-between items-center text-sm font-semibold text-stone-900">
                  <span>Total Amount</span>
                  <span>{formatINR(order.total)}</span>
                </div>
              </div>

              {/* Delivery Destination (Masked for Privacy) */}
              <div className="bg-white rounded-2xl p-6 border border-stone-200 shadow-sm flex flex-col justify-between">
                <div>
                  <h2 className="font-serif text-lg text-stone-900 mb-3 flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-[#166F77]" /> Delivery Destination
                  </h2>
                  <div className="space-y-1 text-sm text-stone-700">
                    <p className="font-semibold text-stone-900">{order.address.name || "Customer"}</p>
                    <p className="text-stone-600">
                      {[order.address.city, order.address.state].filter(Boolean).join(", ")}{" "}
                      <span className="font-mono text-xs font-medium text-stone-500">
                        {order.address.pincode}
                      </span>
                    </p>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-stone-100 flex items-center justify-between text-xs text-stone-500">
                  <span>Payment Method</span>
                  <span className="font-medium text-stone-800 uppercase">
                    {order.payment.method === "razorpay" ? "Online Payment" : "Cash on Delivery"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Footer Support Notice */}
        <div className="mt-12 max-w-xl mx-auto rounded-2xl border border-[#E7E1D6] bg-white/90 p-5 sm:p-6 text-center shadow-sm">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-[#166F77]/10 text-[#166F77] mb-3">
            <Mail className="w-5 h-5" />
          </div>
          <h3 className="font-serif text-base sm:text-lg font-semibold text-[#2B211C]">
            Have questions about your delivery?
          </h3>
          <p className="text-xs sm:text-sm text-stone-600 mt-1 max-w-md mx-auto leading-relaxed">
            Contact our Vrindavan Dham support team for any order assistance, delivery updates, or seva queries.
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
            <a
              href={`mailto:${supportEmail}`}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#166F77] px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-[#135E65] active:scale-[0.98]"
            >
              <Mail className="w-3.5 h-3.5" />
              <span>{supportEmail}</span>
            </a>
            <a
              href={`https://wa.me/${whatsappPhone.replace(/\D/g, "")}?text=${encodeURIComponent("Hare Krishna! I need assistance with my order.")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#E7E1D6] bg-[#F8F4EC] px-4 py-2 text-xs font-semibold text-[#166F77] transition hover:border-[#D9A441] hover:bg-white active:scale-[0.98]"
            >
              <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
              <span>WhatsApp Support</span>
            </a>
          </div>
          <p className="mt-4 pt-3 border-t border-[#E7E1D6]/70 text-[11px] sm:text-xs text-stone-500 font-serif tracking-wide">
            श्री राधा गोविंद कृपा • Blessed from Sri Vrindavan Dham
          </p>
        </div>
      </div>
    </Layout>
  );
}

