import { useState, useEffect, useCallback, useMemo } from "react";
import {
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Clock,
  ShieldCheck,
  Package,
  Truck,
  IndianRupee,
  X,
  HelpCircle,
} from "lucide-react";
import { formatINR, type Order } from "@/lib/store";
import { api, isApiEnabled } from "@/lib/api";
import { toast } from "sonner";
import type {
  ReturnRequest,
  ReturnEligibility,
  ReturnReason,
} from "@/lib/types/returns";

const REASON_LABELS: Record<ReturnReason, { label: string; fault: "STORE_FAULT" | "CUSTOMER_FAULT" }> = {
  transit_damage: { label: "Transit Damage / Broken in Transit", fault: "STORE_FAULT" },
  defective: { label: "Manufacturing Defect / Quality Issue", fault: "STORE_FAULT" },
  missing_item: { label: "Missing Item in Package", fault: "STORE_FAULT" },
  wrong_item: { label: "Wrong Item Delivered", fault: "STORE_FAULT" },
  change_of_mind: { label: "Change of Mind / No Longer Needed", fault: "CUSTOMER_FAULT" },
  other: { label: "Other Personal / Choice Reason", fault: "CUSTOMER_FAULT" },
};

const STATUS_BADGES: Record<string, { label: string; bg: string; text: string; border: string }> = {
  PENDING: { label: "Under Review", bg: "bg-amber-50", text: "text-amber-800", border: "border-amber-200" },
  APPROVED: { label: "Return Approved", bg: "bg-blue-50", text: "text-blue-800", border: "border-blue-200" },
  REJECTED: { label: "Return Declined", bg: "bg-rose-50", text: "text-rose-800", border: "border-rose-200" },
  RECEIVED: { label: "Package Received", bg: "bg-purple-50", text: "text-purple-800", border: "border-purple-200" },
  REFUNDED: { label: "Refund Completed", bg: "bg-emerald-50", text: "text-emerald-800", border: "border-emerald-200" },
  REPLACED: { label: "Replacement Sent", bg: "bg-teal-50", text: "text-teal-800", border: "border-teal-200" },
};

interface CustomerReturnsSectionProps {
  order: Order;
  guestToken?: string;
  onReturnCreated?: () => void;
}

export function CustomerReturnsSection({
  order,
  guestToken,
  onReturnCreated,
}: CustomerReturnsSectionProps) {
  const [returnRequests, setReturnRequests] = useState<ReturnRequest[]>([]);
  const [eligibility, setEligibility] = useState<ReturnEligibility | null>(null);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);

  // Form state
  const [selectedItems, setSelectedItems] = useState<
    Record<
      string,
      {
        selected: boolean;
        qty: number;
        reason: ReturnReason;
        description: string;
      }
    >
  >({});
  const [submitting, setSubmitting] = useState(false);

  const fetchReturnsData = useCallback(async () => {
    if (!isApiEnabled() || !order?.id) return;
    try {
      setLoading(true);
      const tokenParam = guestToken ? `?token=${encodeURIComponent(guestToken)}` : "";
      const [historyRes, eligRes] = await Promise.all([
        api<{ returnRequests: ReturnRequest[] }>(`/returns/order/${order.id}${tokenParam}`).catch(() => ({ returnRequests: [] })),
        order.status === "Delivered"
          ? api<ReturnEligibility>(`/returns/order/${order.id}/eligibility${tokenParam}`).catch(() => null)
          : Promise.resolve(null),
      ]);

      if (historyRes?.returnRequests) {
        setReturnRequests(historyRes.returnRequests);
      }
      if (eligRes) {
        setEligibility(eligRes);
      }
    } catch {
      // Non-critical, ignore
    } finally {
      setLoading(false);
    }
  }, [order?.id, order?.status, guestToken]);

  useEffect(() => {
    fetchReturnsData();
  }, [fetchReturnsData]);

  // Initialise item selection for modal
  const openReturnModal = () => {
    const initial: Record<string, { selected: boolean; qty: number; reason: ReturnReason; description: string }> = {};
    const alreadyReturnedMap = eligibility?.alreadyReturnedQty || {};

    for (const item of order.items || []) {
      const pid = item.product?.id || (item as any).productId;
      const alreadyReturned = alreadyReturnedMap[pid] || 0;
      const maxAvailable = Math.max(0, item.qty - alreadyReturned);

      if (maxAvailable > 0) {
        initial[pid] = {
          selected: false,
          qty: maxAvailable,
          reason: "transit_damage",
          description: "",
        };
      }
    }
    setSelectedItems(initial);
    setShowModal(true);
  };

  // Check remaining return time
  const remainingHours = useMemo(() => {
    if (!eligibility || eligibility.remainingMs <= 0) return 0;
    return Math.ceil(eligibility.remainingMs / (3600 * 1000));
  }, [eligibility]);

  // Any items selected
  const hasSelectedItems = useMemo(() => {
    return Object.values(selectedItems).some((i) => i.selected && i.qty > 0);
  }, [selectedItems]);

  // Estimated refund
  const estimatedRefund = useMemo(() => {
    let sum = 0;
    for (const item of order.items || []) {
      const pid = item.product?.id || (item as any).productId;
      const sel = selectedItems[pid];
      if (sel && sel.selected && sel.qty > 0) {
        const itemPrice = typeof item.price === "number" ? item.price : item.product?.price || 0;
        const discountAmt = (item as any).discountAmount || 0;
        const propDiscount = item.qty > 0 ? (discountAmt * sel.qty) / item.qty : 0;
        const itemRefund = Math.max(0, itemPrice * sel.qty - propDiscount);
        sum += itemRefund;
      }
    }
    return Math.round(sum * 100) / 100;
  }, [order.items, selectedItems]);

  // Fault determination for currently selected items
  const faultSummary = useMemo(() => {
    const selected = Object.values(selectedItems).filter((i) => i.selected);
    if (selected.length === 0) return null;
    const hasStoreFault = selected.some((i) => REASON_LABELS[i.reason]?.fault === "STORE_FAULT");
    return hasStoreFault ? "STORE_FAULT" : "CUSTOMER_FAULT";
  }, [selectedItems]);

  // Handle return submission
  const handleSubmitReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    const itemsToSubmit = Object.entries(selectedItems)
      .filter(([_, data]) => data.selected && data.qty > 0)
      .map(([productId, data]) => ({
        productId,
        qty: data.qty,
        reason: data.reason,
        description: data.description.trim(),
      }));

    if (itemsToSubmit.length === 0) {
      toast.error("Please select at least one item to return.");
      return;
    }

    try {
      setSubmitting(true);
      const tokenParam = guestToken ? `?token=${encodeURIComponent(guestToken)}` : "";
      const res = await api<{ ok: boolean; returnRequest?: ReturnRequest }>(
        `/returns/order/${order.id}${tokenParam}`,
        {
          method: "POST",
          body: {
            token: guestToken || undefined,
            items: itemsToSubmit,
          },
        }
      );

      if (res?.ok) {
        toast.success("Hare Krishna! Your return request has been submitted for review.");
        setShowModal(false);
        fetchReturnsData();
        if (onReturnCreated) onReturnCreated();
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to submit return request");
    } finally {
      setSubmitting(false);
    }
  };

  const isDelivered = order.status === "Delivered";

  if (!isDelivered && returnRequests.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      {/* Return Requests Card (if any exist) */}
      {returnRequests.length > 0 && (
        <div className="bg-white rounded-xl sm:rounded-2xl p-4 sm:p-6 border border-stone-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-stone-100 pb-3">
            <h3 className="font-serif text-lg font-bold text-stone-900 flex items-center gap-2">
              <RotateCcw className="h-4 w-4 text-[#166F77]" /> Returns & Refunds History
            </h3>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-stone-100 text-stone-700">
              {returnRequests.length} {returnRequests.length === 1 ? "Request" : "Requests"}
            </span>
          </div>

          <div className="space-y-4">
            {returnRequests.map((rr) => {
              const statusCfg = STATUS_BADGES[rr.status] || {
                label: rr.status,
                bg: "bg-stone-100",
                text: "text-stone-800",
                border: "border-stone-200",
              };

              return (
                <div
                  key={rr._id}
                  className="rounded-xl border border-stone-200 p-4 bg-stone-50/50 space-y-3 text-xs"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-200/60 pb-2.5">
                    <div>
                      <span className="font-semibold text-stone-900">
                        Return Request #{rr._id.slice(-6).toUpperCase()}
                      </span>
                      <span className="text-stone-500 ml-2">
                        {new Date(rr.requestedAt).toLocaleDateString("en-IN", {
                          dateStyle: "medium",
                        })}
                      </span>
                    </div>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${statusCfg.bg} ${statusCfg.text} ${statusCfg.border}`}
                    >
                      {statusCfg.label}
                    </span>
                  </div>

                  {/* Items list */}
                  <div className="space-y-2">
                    {rr.items.map((it, idx) => {
                      const reasonInfo = REASON_LABELS[it.reason];
                      return (
                        <div
                          key={idx}
                          className="flex items-center justify-between gap-3 bg-white p-2.5 rounded-lg border border-stone-200/60"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            {it.image && (
                              <img
                                src={it.image}
                                alt={it.name}
                                className="w-10 h-10 rounded object-cover border border-stone-100 shrink-0"
                              />
                            )}
                            <div className="min-w-0">
                              <p className="font-semibold text-stone-900 truncate">{it.name}</p>
                              <p className="text-[11px] text-stone-500">
                                Qty: <span className="font-medium text-stone-800">{it.qty}</span> ·{" "}
                                {reasonInfo?.label || it.reason}
                              </p>
                              <span
                                className={`inline-block text-[10px] font-semibold px-1.5 py-0.2 rounded mt-0.5 ${
                                  it.faultType === "STORE_FAULT"
                                    ? "bg-blue-50 text-blue-700 border border-blue-200"
                                    : "bg-amber-50 text-amber-700 border border-amber-200"
                                }`}
                              >
                                {it.faultType === "STORE_FAULT"
                                  ? "Store Mistake (Free Return)"
                                  : "Customer Return (Customer Ships)"}
                              </span>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="font-semibold text-stone-900 text-sm">
                              {formatINR(it.eligibleRefundAmount || it.price * it.qty)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Refund / Resolution details */}
                  <div className="pt-2 border-t border-stone-200/60 flex flex-wrap items-center justify-between gap-2 text-stone-600">
                    <div>
                      <span>Total Eligible Refund: </span>
                      <span className="font-bold text-stone-900 text-sm">
                        {formatINR(rr.totalEligibleRefund)}
                      </span>
                      <span className="text-[10px] text-stone-400 ml-1.5">(Original shipping non-refundable)</span>
                    </div>

                    {rr.status === "REFUNDED" && rr.refund && (
                      <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2 text-emerald-800 w-full mt-1">
                        <div className="flex items-center gap-1.5 font-semibold text-xs">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Refund of {formatINR(rr.refund.amount || rr.totalEligibleRefund)} Completed
                        </div>
                        <p className="text-[11px] mt-0.5">
                          Method:{" "}
                          <span className="font-semibold uppercase">
                            {rr.refund.method === "wallet" ? "Store Credit / Wallet" : "Manual UPI"}
                          </span>
                          {rr.refund.upiReference && (
                            <> · UPI Ref: <code className="font-mono bg-white/70 px-1 rounded">{rr.refund.upiReference}</code></>
                          )}
                        </p>
                      </div>
                    )}

                    {rr.status === "REPLACED" && (
                      <div className="bg-teal-50 border border-teal-200 rounded-lg p-2 text-teal-800 w-full mt-1">
                        <div className="flex items-center gap-1.5 font-semibold text-xs">
                          <Truck className="h-3.5 w-3.5" />
                          Replacement Dispatched
                        </div>
                        {rr.replacementNote && (
                          <p className="text-[11px] mt-0.5">{rr.replacementNote}</p>
                        )}
                      </div>
                    )}

                    {rr.status === "REJECTED" && (
                      <div className="bg-rose-50 border border-rose-200 rounded-lg p-2 text-rose-800 w-full mt-1">
                        <div className="flex items-center gap-1.5 font-semibold text-xs">
                          <AlertCircle className="h-3.5 w-3.5" />
                          Return Not Approved
                        </div>
                        <p className="text-[11px] mt-0.5">
                          Reason: {rr.rejectionReason || "Does not meet store return policy criteria."}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Eligible Return Request Trigger Card */}
      {isDelivered && (
        <div className="bg-white rounded-xl sm:rounded-2xl p-4 sm:p-5 border border-stone-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h4 className="font-serif font-bold text-stone-900 text-sm sm:text-base flex items-center gap-1.5">
                <RotateCcw className="h-4 w-4 text-[#166F77]" /> Return or Replacement
              </h4>
              {eligibility?.eligible ? (
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-800 border border-emerald-200">
                  Window Active ({remainingHours}h left)
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-stone-100 text-stone-600 border border-stone-200">
                  Window Closed
                </span>
              )}
            </div>
            <p className="text-xs text-stone-500">
              {eligibility?.eligible
                ? "Report transit damage, missing items, or defects within the policy window."
                : "The return window for this order has expired (policy limit reached)."}
            </p>
          </div>

          {eligibility?.eligible && (
            <button
              type="button"
              onClick={openReturnModal}
              className="h-10 px-4 rounded-xl sm:rounded-full bg-[#166F77] hover:bg-[#125B62] text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition shadow-xs cursor-pointer active:scale-[0.98] w-full sm:w-auto shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Request Return / Replacement
            </button>
          )}
        </div>
      )}

      {/* Return Request Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-xl p-5 sm:p-6 shadow-xl border border-stone-200 space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div>
                <h3 className="font-serif text-lg font-bold text-stone-900 flex items-center gap-2">
                  <RotateCcw className="h-4 w-4 text-[#166F77]" /> Return / Replacement Request
                </h3>
                <p className="text-xs text-stone-500">Order #{order.orderNo || order.id}</p>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="h-8 w-8 rounded-lg hover:bg-stone-100 grid place-items-center text-stone-400 hover:text-stone-700 transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitReturn} className="space-y-4">
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-stone-700">
                  Select Item(s) to Return & Reason:
                </label>
                <div className="divide-y divide-stone-100 border border-stone-200 rounded-xl overflow-hidden max-h-72 overflow-y-auto">
                  {(order.items || []).map((it) => {
                    const pid = it.product?.id || (it as any).productId;
                    const alreadyReturned = eligibility?.alreadyReturnedQty[pid] || 0;
                    const maxQty = Math.max(0, it.qty - alreadyReturned);

                    if (maxQty === 0) return null;

                    const currentSel = selectedItems[pid] || {
                      selected: false,
                      qty: maxQty,
                      reason: "transit_damage",
                      description: "",
                    };

                    return (
                      <div key={pid} className="p-3 bg-stone-50/40 hover:bg-stone-50 transition space-y-2 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <label className="flex items-center gap-2.5 font-medium text-stone-900 cursor-pointer flex-1">
                            <input
                              type="checkbox"
                              checked={currentSel.selected}
                              onChange={(e) =>
                                setSelectedItems((prev) => ({
                                  ...prev,
                                  [pid]: { ...currentSel, selected: e.target.checked },
                                }))
                              }
                              className="h-4 w-4 rounded border-stone-300 text-[#166F77] focus:ring-[#166F77]"
                            />
                            <span>{it.product?.name || (it as any).name}</span>
                          </label>
                          <span className="font-semibold text-stone-800">
                            {formatINR((it.price || it.product?.price || 0) * currentSel.qty)}
                          </span>
                        </div>

                        {currentSel.selected && (
                          <div className="pl-6 space-y-2 pt-1 border-t border-stone-200/60 mt-2">
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="block text-[11px] font-medium text-stone-600 mb-0.5">
                                  Return Qty (Max {maxQty}):
                                </label>
                                <input
                                  type="number"
                                  min={1}
                                  max={maxQty}
                                  value={currentSel.qty}
                                  onChange={(e) => {
                                    const val = Math.min(maxQty, Math.max(1, parseInt(e.target.value, 10) || 1));
                                    setSelectedItems((prev) => ({
                                      ...prev,
                                      [pid]: { ...currentSel, qty: val },
                                    }));
                                  }}
                                  className="w-full h-8 px-2 rounded-lg border border-stone-300 text-xs bg-white"
                                />
                              </div>

                              <div>
                                <label className="block text-[11px] font-medium text-stone-600 mb-0.5">
                                  Reason for Return:
                                </label>
                                <select
                                  value={currentSel.reason}
                                  onChange={(e) =>
                                    setSelectedItems((prev) => ({
                                      ...prev,
                                      [pid]: {
                                        ...currentSel,
                                        reason: e.target.value as ReturnReason,
                                      },
                                    }))
                                  }
                                  className="w-full h-8 px-2 rounded-lg border border-stone-300 text-xs bg-white"
                                >
                                  {Object.entries(REASON_LABELS).map(([k, v]) => (
                                    <option key={k} value={k}>
                                      {v.label}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>

                            <input
                              type="text"
                              placeholder="Brief description of the defect or issue (optional)..."
                              value={currentSel.description}
                              onChange={(e) =>
                                setSelectedItems((prev) => ({
                                  ...prev,
                                  [pid]: { ...currentSel, description: e.target.value },
                                }))
                              }
                              className="w-full h-8 px-2.5 rounded-lg border border-stone-200 text-xs bg-white focus:outline-none focus:border-[#166F77]"
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Shipping Responsibility Notice */}
              {faultSummary && (
                <div
                  className={`p-3 rounded-xl border text-xs leading-relaxed ${
                    faultSummary === "STORE_FAULT"
                      ? "bg-blue-50/80 border-blue-200 text-blue-900"
                      : "bg-amber-50/80 border-amber-200 text-amber-900"
                  }`}
                >
                  <p className="font-semibold flex items-center gap-1.5">
                    <ShieldCheck className="h-4 w-4" />
                    {faultSummary === "STORE_FAULT"
                      ? "Store Responsibility (Store Mistake)"
                      : "Customer Responsibility (Customer Reason)"}
                  </p>
                  <p className="mt-1 text-[11px]">
                    {faultSummary === "STORE_FAULT"
                      ? "Because this claim is for transit damage, defective goods, or wrong item delivered, our store will arrange or bear return shipping. A replacement or refund will be issued upon receipt."
                      : "For customer-side reasons, the customer must safely courier the product back to our Vrindavan store address at their own cost. Return courier fees are not reimbursed."}
                  </p>
                </div>
              )}

              {/* Policy Reminders */}
              <div className="bg-stone-50 border border-stone-200/80 p-3 rounded-xl text-[11px] text-stone-600 space-y-1">
                <p className="flex items-center gap-1 font-semibold text-stone-800">
                  <HelpCircle className="h-3.5 w-3.5 text-[#166F77]" /> Policy Reminders
                </p>
                <p>· Original order shipping fee (if paid) is non-refundable.</p>
                <p>· Replacement is prioritized first; refunds are provided if replacement is unavailable.</p>
                <p>· Refunds are manually recorded via UPI or Store Credit (no automated card reversals).</p>
              </div>

              {/* Estimated Refund Summary */}
              {hasSelectedItems && (
                <div className="flex items-center justify-between text-xs pt-1 px-1">
                  <span className="font-medium text-stone-600">Estimated Item Refund Value:</span>
                  <span className="font-bold text-stone-900 text-base">{formatINR(estimatedRefund)}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="h-10 px-4 rounded-xl border border-stone-300 text-xs font-semibold text-stone-700 hover:bg-stone-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!hasSelectedItems || submitting}
                  className="h-10 px-5 rounded-xl bg-[#166F77] hover:bg-[#125B62] text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? "Submitting..." : "Submit Return Request"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
