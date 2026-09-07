import { createFileRoute, Link } from "@tanstack/react-router";
import { Layout } from "@/components/Layout";
import {
  displayOrderNumber,
  useStore,
  formatINR,
  type Order,
  type NormalizedTrackingData,
} from "@/lib/store";
import {
  Check,
  Package,
  Truck,
  Home,
  CreditCard,
  Phone,
  FileText,
  AlertTriangle,
  Clock,
  CheckCircle2,
  XCircle,
  MessageCircle,
  RefreshCw,
  ExternalLink,
  MapPin,
  Copy,
  Star,
  Sparkles,
  X as XIcon,
} from "lucide-react";
import { useEffect, useState, useCallback } from "react";
import { api, isApiEnabled } from "@/lib/api";
import { slugify } from "@/lib/seo";
import { toast } from "sonner";

type Search = { token?: string };

export const Route = createFileRoute("/orders/$id")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    token: typeof s.token === "string" ? s.token : undefined,
  }),
  component: OrderDetail,
  head: () => ({
    meta: [
      { title: "Order Details - Shri Radha Govind Store" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

const MAIN_STAGES: Order["status"][] = [
  "Placed",
  "Confirmed",
  "Processing",
  "Packed",
  "Shipped",
  "Out for delivery",
  "Delivered",
];

function OrderDetail() {
  const { id } = Route.useParams();
  const search = Route.useSearch();
  const { orders } = useStore();
  const [liveOrder, setLiveOrder] = useState<Order | null>(null);
  const [liveTracking, setLiveTracking] = useState<NormalizedTrackingData | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [reviewingProduct, setReviewingProduct] = useState<any | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);

  const submitProductReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewingProduct) return;
    if (reviewComment.trim().length < 3) {
      toast.error("Please provide a short review comment (at least 3 characters)");
      return;
    }
    setSubmittingReview(true);
    try {
      await api("/reviews", {
        method: "POST",
        body: {
          orderId: id,
          productId: reviewingProduct.id,
          rating: reviewRating,
          comment: reviewComment.trim(),
          guestAccessToken: search.token || undefined,
        },
      });
      toast.success("Hare Krishna! Your review has been submitted for moderation and will appear publicly once approved.");
      setReviewingProduct(null);
      setReviewComment("");
      setReviewRating(5);
    } catch (err: any) {
      toast.error(err?.message || "Failed to submit review");
    } finally {
      setSubmittingReview(false);
    }
  };

  const initialOrder = orders.find((o) => o.id === id);

  const fetchLiveOrder = useCallback(async () => {
    if (!isApiEnabled()) return;
    try {
      setIsRefreshing(true);
      const url = search.token ? `/orders/${id}?token=${encodeURIComponent(search.token)}` : `/orders/${id}`;
      const res = await api<{ order: any; tracking?: NormalizedTrackingData }>(url);
      if (res?.tracking) {
        setLiveTracking(res.tracking);
      }
      if (res?.order) {
        const o = res.order;
        setLiveOrder({
          id: o._id,
          orderNo: o.orderNo,
          customerEmail: o.customerEmail,
          trackingId: o.trackingId,
          courier: o.courier,
          courierTrackingUrl: o.courierTrackingUrl,
          items: o.items.map((it: any) => ({
            product: {
              id: it.productId,
              name: it.name,
              image: it.image,
              price: it.price,
              slug: "",
              category: "",
              description: "",
              features: [],
              inStock: true,
              rating: 5,
              reviewsCount: 1,
            },
            qty: it.qty,
            price: it.price,
          })),
          subtotal: o.subtotal,
          shipping: o.shipping,
          total: o.total,
          needsGstInvoice: o.needsGstInvoice,
          businessName: o.businessName,
          gstin: o.gstin,
          address: o.address,
          billingAddress: o.billingAddress,
          payment: o.payment,
          status: o.status,
          holdReason: o.holdReason,
          holdAt: o.holdAt,
          statusHistory: o.statusHistory,
          courierTrackingData: o.courierTrackingData || res?.tracking || null,
          createdAt: new Date(o.createdAt).getTime(),
        });
      }
    } catch {
      // ignore
    } finally {
      setIsRefreshing(false);
    }
  }, [id, search.token]);

  useEffect(() => {
    fetchLiveOrder();
  }, [fetchLiveOrder]);

  // Live polling every 20s
  useEffect(() => {
    const active = liveOrder || initialOrder;
    if (!active) return;
    if (active.status === "Delivered" || active.status === "Cancelled") return;

    const timer = setInterval(() => {
      if (document.visibilityState === "visible") {
        fetchLiveOrder();
      }
    }, 20000);

    const onVis = () => {
      if (document.visibilityState === "visible") {
        fetchLiveOrder();
      }
    };

    window.addEventListener("focus", onVis);
    document.addEventListener("visibilitychange", onVis);

    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", onVis);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [liveOrder, initialOrder, fetchLiveOrder]);

  const order = liveOrder || initialOrder;

  if (!order) {
    return (
      <Layout>
        <div className="container-app py-20 text-center">
          <h1 className="font-serif text-3xl text-stone-900">Order not found</h1>
          <p className="text-sm text-stone-500 mt-2">
            The order you requested could not be located. Please check your orders page.
          </p>
          <Link
            to="/orders"
            className="mt-6 inline-flex items-center justify-center h-10 px-6 rounded-full bg-[#166F77] text-white text-sm font-medium hover:bg-[#125B62] transition"
          >
            View All Orders
          </Link>
        </div>
      </Layout>
    );
  }

  const currentIdx = MAIN_STAGES.indexOf(order.status);
  const isHold = order.status === "Hold";
  const isCancelled = order.status === "Cancelled";

  // Derived courier tracking data — prefer live state over cached order data
  const tracking: NormalizedTrackingData | null =
    liveTracking || (order.courierTrackingData as NormalizedTrackingData | null) || null;
  const hasShipment = Boolean(order.trackingId && order.courier);

  return (
    <Layout>
      <div className="container-app py-10 max-w-5xl">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-2">
          <Link to="/orders" className="text-sm font-medium text-stone-500 hover:text-[#166F77] transition">
            ← All orders
          </Link>
          {isRefreshing && (
            <span className="inline-flex items-center gap-1.5 text-xs text-[#166F77] bg-teal-50 px-3 py-1 rounded-full border border-teal-200">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Live sync
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-baseline justify-between gap-4 mt-1">
          <div>
            <h1 className="font-serif text-3xl sm:text-4xl text-stone-900">
              Order #{displayOrderNumber(order)}
            </h1>
            <p className="text-xs text-stone-500 mt-1">
              Placed on {new Date(order.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {isApiEnabled() && (
              <a
                href={`/api/orders/${order.id}/invoice${search.token ? `?token=${encodeURIComponent(search.token)}` : ""}`}
                target="_blank"
                rel="noreferrer"
                className="h-10 px-4 rounded-full border border-stone-300 hover:border-[#166F77] text-stone-700 hover:text-[#166F77] text-xs font-semibold inline-flex items-center gap-1.5 transition bg-white shadow-sm"
              >
                <FileText className="w-4 h-4 text-[#166F77]" /> Download Invoice PDF
              </a>
            )}
            <Link
              to="/track"
              search={{ id: order.trackingId || displayOrderNumber(order) } as never}
              className="h-10 px-5 rounded-full bg-[#166F77] hover:bg-[#125B62] text-white text-xs font-semibold inline-flex items-center gap-1.5 transition shadow-sm"
            >
              Public Tracker <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Shipment Details Bar */}
        <div className="bg-white rounded-2xl p-5 mt-6 border border-stone-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
          <div className="flex-1 min-w-0 space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-stone-400">
              Shipment & Tracking
            </p>
            {order.trackingId ? (
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-teal-50 border border-teal-200 text-teal-900 font-mono text-sm font-bold">
                <span>AWB: {order.trackingId}</span>
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
              className="h-9 px-4 rounded-full border border-[#166F77] text-[#166F77] hover:bg-[#166F77]/10 text-xs font-semibold inline-flex items-center gap-1.5 transition"
            >
              Track on {order.courier || "Courier"} <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </div>

        {/* Hold Alert Banner */}
        {isHold && (
          <div className="mt-6 p-5 rounded-2xl bg-amber-50/90 border border-amber-300 text-amber-900 space-y-2">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold text-sm text-amber-950">
                  Your Order is on Temporary Hold
                </p>
                <p className="text-xs text-amber-800 mt-1 leading-relaxed">
                  <span className="font-semibold">Hold Reason:</span>{" "}
                  {order.holdReason || "Order details or warehouse verification is currently in progress."}
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

        {/* Cancelled Banner */}
        {isCancelled && (
          <div className="mt-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 flex items-start gap-3">
            <XCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-sm text-red-900">This Order Has Been Cancelled</p>
              <p className="text-xs text-red-700 mt-0.5">
                For assistance, please contact{" "}
                <a href="mailto:support@shriradhagovindstore.com" className="font-semibold underline hover:text-red-950">
                  support@shriradhagovindstore.com
                </a>.
              </p>
            </div>
          </div>
        )}

        {/* Stepper Card */}
        {!isCancelled && (
          <div className="bg-white rounded-2xl p-6 sm:p-8 border border-stone-200 shadow-sm mt-6">
            <h2 className="font-serif text-xl text-stone-900 mb-6">Track your order</h2>

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
                    Your package has safely arrived with divine blessings. May Thakur Ji & Sri Radha Rani bless your home with peace, joy, and devotion.
                  </p>
                </div>
              </div>
            )}

            {/* Desktop Stepper */}
            <div className="hidden md:block">
              <div className="grid grid-cols-7 relative">
                {MAIN_STAGES.map((s, i) => {
                  const isDelivered = s === "Delivered" && currentIdx >= i;
                  const isCompleted = currentIdx > i || isDelivered;
                  const isCurrent = currentIdx === i && !isHold && !isDelivered;
                  const isPastOrCurrent = currentIdx >= i;
                  const hasConnector = i < MAIN_STAGES.length - 1;

                  // Connector fill calculation from stage i to stage i+1 (NO connector exists after Delivered)
                  const isConnectorCompleted = currentIdx > i;
                  const isConnectorActive = currentIdx === i && !isHold;

                  return (
                    <div key={s} className="relative flex flex-col items-center text-center group">
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
                        {s}
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
              {MAIN_STAGES.map((s, i) => {
                const isDelivered = s === "Delivered" && currentIdx >= i;
                const isCompleted = currentIdx > i || isDelivered;
                const isCurrent = currentIdx === i && !isHold && !isDelivered;
                const isPastOrCurrent = currentIdx >= i;
                const isLast = i === MAIN_STAGES.length - 1;

                return (
                  <div key={s} className="relative flex items-start gap-3.5 pb-5 last:pb-0">
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
                          {s}
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

        {/* Live Shipment Tracking Card */}
        {hasShipment && (
          <div className="bg-white rounded-2xl p-6 sm:p-8 border border-stone-200 shadow-sm mt-6 space-y-6">
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
                <p className="text-stone-400 font-medium uppercase tracking-wider text-[10px]">Current Status</p>
                <p className="font-bold text-[#166F77] mt-0.5">
                  {tracking?.latestStatus ||
                    (order.status === "Delivered"
                      ? "Delivered"
                      : order.status === "Out for delivery"
                      ? "Out for Delivery"
                      : order.status === "Shipped"
                      ? "In Transit"
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
            <div className="p-4 rounded-xl border border-teal-100 bg-teal-50/40 text-xs space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2 text-stone-700">
                <div className="flex items-center gap-2 font-medium">
                  <MapPin className="w-4 h-4 text-[#166F77] shrink-0" />
                  <span>
                    {tracking?.origin ? (
                      <span className="font-semibold text-stone-900">{tracking.origin}</span>
                    ) : null}
                    {tracking?.origin && (tracking?.destination || order.address.city) ? " → " : null}
                    <span className="font-semibold text-stone-900">{tracking?.destination || order.address.city || "Destination"}</span>
                  </span>
                </div>
                {tracking?.lastUpdated && (
                  <span className="text-[11px] text-stone-500 font-mono">
                    Updated {new Date(tracking.lastUpdated).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true })}
                  </span>
                )}
              </div>

              {(tracking?.latestMessage || tracking?.currentLocation) && (
                <div className="pt-2 border-t border-teal-100/80 text-stone-800">
                  <span className="font-semibold text-[#166F77]">Latest Courier Update: </span>
                  <span>{tracking?.latestMessage}</span>
                  {tracking?.currentLocation && (
                    <span className="text-stone-500 font-medium"> ({tracking.currentLocation})</span>
                  )}
                </div>
              )}
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
              <div className="p-3 bg-stone-50 rounded-lg text-stone-500 text-xs text-center border border-stone-100">
                Tracking information is synchronized with {order.courier || "the courier partner"}. Detailed checkpoint scans will update automatically.
              </div>
            )}
          </div>
        )}

        {/* Details Grid */}
        <div className="grid lg:grid-cols-[1fr_360px] gap-6 mt-6">
          {/* Ordered Items */}
          <div className="bg-white rounded-2xl p-6 border border-stone-200 shadow-sm">
            <h2 className="font-serif text-lg text-stone-900 mb-4 flex items-center gap-2">
              <Package className="h-5 w-5 text-[#166F77]" /> Ordered Items ({order.items.length})
            </h2>
            <div className="space-y-4 divide-y divide-stone-100">
              {order.items.map((i, idx) => {
                const productTarget =
                  i.product.slug ||
                  (i.product.name ? slugify(i.product.name) : "") ||
                  i.product.id ||
                  "";

                return (
                  <div key={i.product.id || idx} className="pt-4 first:pt-0 flex items-center gap-4">
                    {productTarget ? (
                      <Link
                        to="/product/$id"
                        params={{ id: productTarget }}
                        className="group flex items-center gap-4 flex-1 min-w-0"
                      >
                        <div className="h-16 w-16 rounded-xl overflow-hidden bg-stone-100 border border-stone-200 shrink-0 group-hover:border-[#166F77]/30 transition-colors">
                          <img
                            src={i.product.image}
                            alt={i.product.name}
                            className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-200"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="font-medium text-sm text-stone-900 group-hover:text-[#166F77] truncate transition-colors">
                              {i.product.name}
                            </p>
                            <ExternalLink className="w-3.5 h-3.5 text-stone-400 opacity-0 group-hover:opacity-100 group-hover:text-[#166F77] transition-all shrink-0" />
                          </div>
                          <p className="text-xs text-stone-500 mt-0.5">
                            Qty: {i.qty} × {formatINR(i.product.price)}
                          </p>
                          <span className="text-[11px] text-[#166F77] font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                            View product →
                          </span>
                        </div>
                      </Link>
                    ) : (
                      <>
                        <div className="h-16 w-16 rounded-xl overflow-hidden bg-stone-100 border border-stone-200 shrink-0">
                          <img src={i.product.image} alt={i.product.name} className="h-full w-full object-cover" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm text-stone-900">{i.product.name}</p>
                          <p className="text-xs text-stone-500 mt-0.5">
                            Qty: {i.qty} × {formatINR(i.product.price)}
                          </p>
                        </div>
                      </>
                    )}
                  <div className="text-right shrink-0">
                    <span className="font-semibold text-sm text-stone-900 block">
                      {formatINR(i.product.price * i.qty)}
                    </span>
                    {order.status === "Delivered" && (
                      <button
                        type="button"
                        onClick={() => {
                          setReviewingProduct(i.product);
                          setReviewRating(5);
                          setReviewComment("");
                        }}
                        className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-[#166F77] hover:underline"
                      >
                        <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-400" />
                        Write a Review
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
            </div>
          </div>

          {/* Shipping & Payment Summary */}
          <aside className="space-y-6">
            <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-sm">
              <h3 className="font-serif text-base text-stone-900 mb-3 flex items-center gap-2">
                <Home className="h-4 w-4 text-[#166F77]" /> Shipping Address
              </h3>
              <p className="text-sm font-semibold text-stone-900">{order.address.name}</p>
              {order.businessName && (
                <p className="text-xs font-semibold text-stone-700 mt-0.5">
                  Business: {order.businessName}
                </p>
              )}
              {order.gstin && (
                <p className="text-xs font-mono font-medium text-stone-500 mt-0.5">
                  GSTIN: {order.gstin}
                </p>
              )}
              <p className="text-xs text-stone-600 mt-1 leading-relaxed">
                {[order.address.line1, order.address.line2, order.address.city, order.address.state]
                  .filter(Boolean)
                  .join(", ")}{" "}
                <span className="font-semibold">{order.address.pincode}</span>
              </p>
              <p className="mt-2 flex items-center gap-1.5 text-xs text-stone-600">
                <Phone className="h-3.5 w-3.5 text-stone-400" /> Phone: {order.address.phone}
              </p>
              {(order.address.alternatePhone || order.alternatePhone) && (
                <p className="mt-1 flex items-center gap-1.5 text-xs text-stone-600">
                  <Phone className="h-3.5 w-3.5 text-stone-400" /> Alt Phone:{" "}
                  {order.address.alternatePhone || order.alternatePhone}
                </p>
              )}
            </div>

            <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-sm">
              <h3 className="font-serif text-base text-stone-900 mb-3 flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-[#166F77]" /> Payment Summary
              </h3>
              <div className="flex items-center justify-between text-xs">
                <span className="text-stone-500">Method</span>
                <span className="font-semibold uppercase text-stone-900">
                  {order.payment.method === "razorpay" ? "Online Payment (Razorpay)" : "Cash on Delivery"}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs mt-2">
                <span className="text-stone-500">Payment Status</span>
                <span
                  className={`font-semibold uppercase text-xs px-2 py-0.5 rounded ${
                    order.payment.status === "paid"
                      ? "bg-emerald-50 text-emerald-800"
                      : "bg-amber-50 text-amber-800"
                  }`}
                >
                  {order.payment.status}
                </span>
              </div>
              <div className="border-t border-stone-100 my-3" />
              <div className="flex justify-between items-center font-semibold text-stone-900">
                <span>Grand Total</span>
                <span className="text-base text-[#166F77]">{formatINR(order.total)}</span>
              </div>
            </div>
          </aside>
        </div>

        {reviewingProduct && (
          <div className="fixed inset-0 bg-black/60 z-50 grid place-items-center p-4 animate-in fade-in duration-150">
            <div
              className="bg-white rounded-2xl border border-stone-200 p-6 w-full max-w-md shadow-2xl space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between border-b pb-3">
                <div>
                  <h3 className="font-serif text-xl font-bold text-stone-900">Write a Review</h3>
                  <p className="text-xs text-stone-500 mt-0.5">Share your experience with this sacred item</p>
                </div>
                <button
                  type="button"
                  onClick={() => setReviewingProduct(null)}
                  className="p-1 rounded-lg hover:bg-stone-100 text-stone-400 hover:text-stone-700"
                >
                  <XIcon className="w-4 h-4" />
                </button>
              </div>

              <div className="flex items-center gap-3 bg-stone-50 p-3 rounded-xl border border-stone-200">
                <img
                  src={reviewingProduct.image}
                  alt={reviewingProduct.name}
                  className="w-12 h-12 object-cover rounded-lg border bg-white shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-stone-900 truncate">{reviewingProduct.name}</p>
                  <span className="text-[11px] text-emerald-700 font-medium">Verified Purchase</span>
                </div>
              </div>

              <form onSubmit={submitProductReview} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                    Your Rating (रेटिंग)
                  </label>
                  <div className="flex items-center gap-1.5">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setReviewRating(star)}
                        className="p-1 rounded hover:scale-110 transition"
                      >
                        <Star
                          className={`w-6 h-6 ${
                            star <= reviewRating
                              ? "fill-amber-400 text-amber-400"
                              : "text-stone-300 fill-stone-100"
                          }`}
                        />
                      </button>
                    ))}
                    <span className="text-xs font-semibold text-stone-600 ml-2">
                      {reviewRating === 5
                        ? "5/5 - Outstanding"
                        : reviewRating === 4
                        ? "4/5 - Very Good"
                        : reviewRating === 3
                        ? "3/5 - Good"
                        : reviewRating === 2
                        ? "2/5 - Fair"
                        : "1/5 - Poor"}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Your Review (अनुभव / टिप्पणी)
                  </label>
                  <textarea
                    required
                    rows={4}
                    value={reviewComment}
                    onChange={(e) => setReviewComment(e.target.value)}
                    placeholder="How was the quality, craftsmanship, and devotional experience of this item?"
                    className="w-full rounded-xl border border-stone-300 p-3 text-sm focus:outline-none focus:border-[#166F77] focus:ring-1 focus:ring-[#166F77]"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t">
                  <button
                    type="button"
                    onClick={() => setReviewingProduct(null)}
                    className="h-10 px-4 rounded-xl border border-stone-200 text-xs font-semibold hover:bg-stone-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingReview}
                    className="h-10 px-5 rounded-xl bg-[#166F77] text-white text-xs font-semibold hover:bg-[#166F77]/90 disabled:opacity-50 transition shadow-sm"
                  >
                    {submittingReview ? "Submitting..." : "Submit Review"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
