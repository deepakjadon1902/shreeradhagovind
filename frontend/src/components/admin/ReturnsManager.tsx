import { useState, useEffect, useCallback, useMemo } from "react";
import {
  RotateCcw,
  Search,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Package,
  IndianRupee,
  MessageCircle,
  Truck,
  AlertTriangle,
  Clock,
  ShieldAlert,
  Wallet,
  X,
  Eye,
  Check,
  Building2,
} from "lucide-react";
import { formatINR } from "@/lib/store";
import { api, isApiEnabled } from "@/lib/api";
import { toast } from "sonner";
import type { ReturnRequest, ReturnStatus, ReturnReason } from "@/lib/types/returns";

const STATUS_FILTERS: Array<{ id: "ALL" | ReturnStatus; label: string }> = [
  { id: "ALL", label: "All Returns" },
  { id: "PENDING", label: "Under Review" },
  { id: "APPROVED", label: "Approved" },
  { id: "RECEIVED", label: "Received (Restocked)" },
  { id: "REFUNDED", label: "Refunded" },
  { id: "REPLACED", label: "Replaced" },
  { id: "REJECTED", label: "Rejected" },
];

const REASON_NAMES: Record<ReturnReason, string> = {
  transit_damage: "Transit Damage / Broken",
  defective: "Defective / Quality Issue",
  missing_item: "Missing Item in Package",
  wrong_item: "Wrong Item Delivered",
  change_of_mind: "Change of Mind",
  other: "Other Customer Reason",
};

export function ReturnsManager() {
  const [returnRequests, setReturnRequests] = useState<ReturnRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<"ALL" | ReturnStatus>("ALL");
  const [search, setSearch] = useState("");

  // Detail / Action modal states
  const [activeReturn, setActiveReturn] = useState<ReturnRequest | null>(null);

  // Approve dialog
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [approveResolution, setApproveResolution] = useState<"refund" | "replacement">("refund");
  const [approveNote, setApproveNote] = useState("");
  const [actionInProgress, setActionInProgress] = useState(false);

  // Reject dialog
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  // Refund dialog
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [refundMethod, setRefundMethod] = useState<"upi" | "wallet">("upi");
  const [upiReference, setUpiReference] = useState("");
  const [refundNotes, setRefundNotes] = useState("");

  // Replacement dialog
  const [showReplacementModal, setShowReplacementModal] = useState(false);
  const [replacementNote, setReplacementNote] = useState("");

  const loadReturns = useCallback(async () => {
    if (!isApiEnabled()) return;
    try {
      setLoading(true);
      const queryParam = statusFilter !== "ALL" ? `?status=${statusFilter}` : "";
      const res = await api<{ returnRequests: ReturnRequest[] }>(`/admin/returns${queryParam}`);
      if (res?.returnRequests) {
        setReturnRequests(res.returnRequests);
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to load return requests");
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    loadReturns();
  }, [loadReturns]);

  // Filtered returns list
  const filteredReturns = useMemo(() => {
    let list = returnRequests;
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      list = list.filter((r) => {
        const orderNum = String(r.orderNo || (r.orderId as any)?.orderNo || "");
        const email = (r.customerEmail || "").toLowerCase();
        const id = r._id.toLowerCase();
        return orderNum.includes(q) || email.includes(q) || id.includes(q);
      });
    }
    return list;
  }, [returnRequests, search]);

  // Handler: Approve
  const handleApprove = async () => {
    if (!activeReturn) return;
    try {
      setActionInProgress(true);
      const res = await api<{ ok: boolean; returnRequest: ReturnRequest }>(
        `/admin/returns/${activeReturn._id}/approve`,
        {
          method: "PATCH",
          body: {
            resolution: approveResolution,
            adminNote: approveNote.trim() || undefined,
          },
        }
      );
      if (res?.ok) {
        toast.success("Return approved successfully. Customer has been notified.");
        setShowApproveModal(false);
        setActiveReturn(res.returnRequest);
        loadReturns();
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to approve return");
    } finally {
      setActionInProgress(false);
    }
  };

  // Handler: Reject
  const handleReject = async () => {
    if (!activeReturn) return;
    if (rejectReason.trim().length < 5) {
      toast.error("Please provide a rejection reason (at least 5 characters).");
      return;
    }
    try {
      setActionInProgress(true);
      const res = await api<{ ok: boolean; returnRequest: ReturnRequest }>(
        `/admin/returns/${activeReturn._id}/reject`,
        {
          method: "PATCH",
          body: {
            rejectionReason: rejectReason.trim(),
          },
        }
      );
      if (res?.ok) {
        toast.success("Return marked as rejected. Customer has been notified.");
        setShowRejectModal(false);
        setActiveReturn(res.returnRequest);
        loadReturns();
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to reject return");
    } finally {
      setActionInProgress(false);
    }
  };

  // Handler: Mark Received (Restocks inventory)
  const handleMarkReceived = async () => {
    if (!activeReturn) return;
    if (
      !window.confirm(
        "Confirm Package Received?\n\nThis will automatically restock the returned quantities back into product inventory. This action cannot be undone."
      )
    ) {
      return;
    }
    try {
      setActionInProgress(true);
      const res = await api<{ ok: boolean; returnRequest: ReturnRequest }>(
        `/admin/returns/${activeReturn._id}/received`,
        {
          method: "PATCH",
        }
      );
      if (res?.ok) {
        toast.success("Package marked received! Product stock has been safely restored.");
        setActiveReturn(res.returnRequest);
        loadReturns();
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to mark received");
    } finally {
      setActionInProgress(false);
    }
  };

  // Handler: Record Refund
  const handleRecordRefund = async () => {
    if (!activeReturn) return;
    if (refundMethod === "upi" && !upiReference.trim()) {
      toast.error("UPI Reference / Transaction ID is required for UPI refunds.");
      return;
    }
    try {
      setActionInProgress(true);
      const res = await api<{ ok: boolean; returnRequest: ReturnRequest }>(
        `/admin/returns/${activeReturn._id}/refund`,
        {
          method: "POST",
          body: {
            method: refundMethod,
            upiReference: upiReference.trim() || undefined,
            notes: refundNotes.trim() || undefined,
          },
        }
      );
      if (res?.ok) {
        toast.success(
          refundMethod === "wallet"
            ? `Store wallet credited ₹${activeReturn.totalEligibleRefund} successfully!`
            : "UPI refund recorded and customer notified!"
        );
        setShowRefundModal(false);
        setActiveReturn(res.returnRequest);
        loadReturns();
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to record refund");
    } finally {
      setActionInProgress(false);
    }
  };

  // Handler: Mark Replacement Dispatched
  const handleMarkReplaced = async () => {
    if (!activeReturn) return;
    try {
      setActionInProgress(true);
      const res = await api<{ ok: boolean; returnRequest: ReturnRequest }>(
        `/admin/returns/${activeReturn._id}/replacement-shipped`,
        {
          method: "PATCH",
          body: {
            replacementNote: replacementNote.trim() || undefined,
          },
        }
      );
      if (res?.ok) {
        toast.success("Replacement marked as dispatched!");
        setShowReplacementModal(false);
        setActiveReturn(res.returnRequest);
        loadReturns();
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to update replacement status");
    } finally {
      setActionInProgress(false);
    }
  };

  // Build pre-filled WhatsApp link for customer
  const getWhatsAppLink = (r: ReturnRequest) => {
    const orderData = r.orderId as any;
    const phone = orderData?.address?.phone;
    if (!phone) return null;
    const cleanDigits = phone.replace(/\D/g, "");
    const formatted = cleanDigits.length === 10 ? `91${cleanDigits}` : cleanDigits;
    const name = orderData?.address?.name || "Customer";
    const orderNum = r.orderNo || orderData?.orderNo || "N/A";
    const msg = `Hare Krishna ${name} ji, regarding your return request for Order #${orderNum} on Shri Radha Govind Store: `;
    return `https://wa.me/${formatted}?text=${encodeURIComponent(msg)}`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl text-stone-900">Returns & Refund Management</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Process item returns, review defects, safely restock inventory, and record manual UPI or Store Wallet refunds.
          </p>
        </div>
        <button
          onClick={loadReturns}
          disabled={loading}
          className="inline-flex items-center gap-2 h-10 px-4 rounded-xl border border-border bg-white text-xs font-semibold hover:bg-muted transition shadow-xs"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Filter Tabs & Search */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 max-w-full">
          {STATUS_FILTERS.map((f) => {
            const count =
              f.id === "ALL"
                ? returnRequests.length
                : returnRequests.filter((r) => r.status === f.id).length;
            return (
              <button
                key={f.id}
                onClick={() => setStatusFilter(f.id)}
                className={`h-9 px-3.5 rounded-lg text-xs font-semibold whitespace-nowrap transition border ${
                  statusFilter === f.id
                    ? "bg-[#166F77] text-white border-[#166F77] shadow-xs"
                    : "bg-white text-muted-foreground border-border hover:border-[#166F77]/50 hover:text-foreground"
                }`}
              >
                {f.label} ({count})
              </button>
            );
          })}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by Order # or Email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 pl-9 pr-3 w-full rounded-lg border bg-white text-xs focus:outline-none focus:border-[#166F77]"
          />
        </div>
      </div>

      {/* Returns Table */}
      {loading ? (
        <div className="p-16 text-center text-muted-foreground">Loading return requests...</div>
      ) : filteredReturns.length === 0 ? (
        <div className="bg-white rounded-xl border border-border p-12 text-center text-muted-foreground">
          <RotateCcw className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
          <p className="font-semibold text-foreground">No return requests found</p>
          <p className="text-xs mt-1">There are no return requests matching your filter.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-border overflow-hidden shadow-xs">
          <table className="w-full text-xs">
            <thead className="bg-muted/40 border-b border-border text-muted-foreground uppercase tracking-wider text-left">
              <tr>
                <th className="px-4 py-3">Return ID / Order</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Returned Item(s)</th>
                <th className="px-4 py-3">Reason & Fault</th>
                <th className="px-4 py-3">Eligible Refund</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {filteredReturns.map((r) => {
                const orderData = r.orderId as any;
                const orderNum = r.orderNo || orderData?.orderNo || "N/A";
                const customerName = orderData?.address?.name || "Customer";
                const waLink = getWhatsAppLink(r);
                const hasStoreFault = r.items.some((i) => i.faultType === "STORE_FAULT");

                return (
                  <tr key={r._id} className="hover:bg-slate-50/70 transition">
                    <td className="px-4 py-3 font-medium">
                      <div className="font-bold text-stone-900">#{r._id.slice(-6).toUpperCase()}</div>
                      <div className="text-[11px] text-[#166F77] font-semibold">Order #{orderNum}</div>
                    </td>

                    <td className="px-4 py-3">
                      <div className="font-semibold text-stone-900">{customerName}</div>
                      <div className="text-[11px] text-muted-foreground">{r.customerEmail}</div>
                      {waLink && (
                        <a
                          href={waLink}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[10px] text-emerald-700 hover:underline mt-0.5"
                        >
                          <MessageCircle className="h-3 w-3" /> WhatsApp
                        </a>
                      )}
                    </td>

                    <td className="px-4 py-3 max-w-[180px]">
                      <div className="space-y-1">
                        {r.items.map((it, idx) => (
                          <div key={idx} className="truncate">
                            <span className="font-semibold text-stone-800">{it.qty}x</span> {it.name}
                          </div>
                        ))}
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      <div className="space-y-1">
                        <div className="font-medium text-stone-800">
                          {REASON_NAMES[r.items[0]?.reason] || r.items[0]?.reason}
                        </div>
                        <span
                          className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                            hasStoreFault
                              ? "bg-blue-50 text-blue-800 border border-blue-200"
                              : "bg-amber-50 text-amber-800 border border-amber-200"
                          }`}
                        >
                          {hasStoreFault ? "Store Fault (Free Return)" : "Customer Fault (Customer Pays)"}
                        </span>
                      </div>
                    </td>

                    <td className="px-4 py-3 font-semibold text-stone-900 text-sm">
                      {formatINR(r.totalEligibleRefund)}
                    </td>

                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                          r.status === "REFUNDED"
                            ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                            : r.status === "APPROVED"
                            ? "bg-blue-50 text-blue-800 border border-blue-200"
                            : r.status === "RECEIVED"
                            ? "bg-purple-50 text-purple-800 border border-purple-200"
                            : r.status === "REPLACED"
                            ? "bg-teal-50 text-teal-800 border border-teal-200"
                            : r.status === "REJECTED"
                            ? "bg-rose-50 text-rose-800 border border-rose-200"
                            : "bg-amber-50 text-amber-800 border border-amber-200"
                        }`}
                      >
                        {r.status}
                      </span>
                    </td>

                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                      {new Date(r.requestedAt).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>

                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button
                        onClick={() => setActiveReturn(r)}
                        className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-border bg-white text-xs font-semibold text-stone-700 hover:bg-stone-50 transition shadow-2xs"
                      >
                        <Eye className="h-3.5 w-3.5 text-[#166F77]" />
                        Manage
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Return Request Details & Action Drawer / Modal */}
      {activeReturn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-2xl p-6 shadow-xl border border-stone-200 space-y-5 my-8">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div>
                <h3 className="font-serif text-xl font-bold text-stone-900 flex items-center gap-2">
                  <RotateCcw className="h-5 w-5 text-[#166F77]" />
                  Return #{activeReturn._id.slice(-6).toUpperCase()}
                </h3>
                <p className="text-xs text-muted-foreground">
                  Order #{activeReturn.orderNo || (activeReturn.orderId as any)?.orderNo} · Requested on{" "}
                  {new Date(activeReturn.requestedAt).toLocaleString("en-IN", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveReturn(null)}
                className="h-8 w-8 rounded-lg hover:bg-stone-100 grid place-items-center text-stone-400 hover:text-stone-700 transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Customer & Shipping Summary */}
            <div className="grid sm:grid-cols-2 gap-3 text-xs bg-stone-50 p-3.5 rounded-xl border border-stone-200/80">
              <div>
                <span className="text-muted-foreground block">Customer:</span>
                <span className="font-semibold text-stone-900 block">
                  {(activeReturn.orderId as any)?.address?.name || "Customer"}
                </span>
                <span className="text-stone-600 block">{activeReturn.customerEmail}</span>
                <span className="text-stone-600 block">
                  Phone: {(activeReturn.orderId as any)?.address?.phone || "N/A"}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block">Status:</span>
                <span className="font-bold text-stone-900 text-sm">{activeReturn.status}</span>
                {activeReturn.resolution && (
                  <span className="text-stone-600 block capitalize">
                    Resolution: <b className="text-[#166F77]">{activeReturn.resolution}</b>
                  </span>
                )}
                <span className="text-stone-600 block">
                  Inventory Restocked:{" "}
                  <b>{activeReturn.inventory?.restocked ? "Yes (Restored)" : "Not Restocked"}</b>
                </span>
              </div>
            </div>

            {/* Items details */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Returned Products Breakdown
              </h4>
              <div className="divide-y border border-stone-200 rounded-xl overflow-hidden text-xs">
                {activeReturn.items.map((it, idx) => (
                  <div key={idx} className="p-3 bg-white flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      {it.image && (
                        <img
                          src={it.image}
                          alt={it.name}
                          className="w-12 h-12 rounded object-cover border border-stone-100 shrink-0"
                        />
                      )}
                      <div>
                        <p className="font-bold text-stone-900">{it.name}</p>
                        <p className="text-muted-foreground">
                          Returning: <span className="font-semibold text-stone-800">{it.qty}</span> of {it.originalQty} ordered
                        </p>
                        <p className="text-muted-foreground">
                          Reason: <span className="font-medium text-stone-800">{REASON_NAMES[it.reason] || it.reason}</span>
                        </p>
                        {it.description && (
                          <p className="text-stone-500 italic mt-0.5">"{it.description}"</p>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-bold text-stone-900 text-sm">
                        {formatINR(it.eligibleRefundAmount || it.price * it.qty)}
                      </div>
                      <span
                        className={`inline-block text-[10px] font-semibold px-2 py-0.2 rounded mt-1 ${
                          it.faultType === "STORE_FAULT"
                            ? "bg-blue-50 text-blue-700"
                            : "bg-amber-50 text-amber-700"
                        }`}
                      >
                        {it.faultType === "STORE_FAULT" ? "Store Fault" : "Customer Fault"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Refund & Financial summary */}
            <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl text-xs space-y-1.5">
              <div className="flex justify-between items-center text-sm font-bold text-stone-900">
                <span>Calculated Item Refund Value:</span>
                <span className="text-[#166F77] text-base">{formatINR(activeReturn.totalEligibleRefund)}</span>
              </div>
              <p className="text-stone-500 text-[11px]">
                * Calculated proportionally net of coupon and loyalty points discounts. Original shipping fee (₹{activeReturn.originalShipping || 0}) is non-refundable.
              </p>
            </div>

            {/* Refund Result if already refunded */}
            {activeReturn.status === "REFUNDED" && activeReturn.refund && (
              <div className="bg-emerald-50 border border-emerald-200 p-3.5 rounded-xl text-xs text-emerald-900 space-y-1">
                <p className="font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4" /> Refund Executed
                </p>
                <p>
                  Amount: <b>{formatINR(activeReturn.refund.amount || activeReturn.totalEligibleRefund)}</b> via{" "}
                  <b className="uppercase">{activeReturn.refund.method}</b>
                </p>
                {activeReturn.refund.upiReference && (
                  <p>
                    UPI Reference: <code className="font-mono bg-white px-1.5 py-0.5 rounded">{activeReturn.refund.upiReference}</code>
                  </p>
                )}
                {activeReturn.loyalty?.pointsReversed ? (
                  <p>Loyalty Points Reversed: <b>{activeReturn.loyalty.pointsReversed} pts</b></p>
                ) : null}
              </div>
            )}

            {/* Action Bar */}
            <div className="pt-3 border-t border-stone-100 flex flex-wrap items-center justify-end gap-2.5">
              {activeReturn.status === "PENDING" && (
                <>
                  <button
                    onClick={() => {
                      setRejectReason("");
                      setShowRejectModal(true);
                    }}
                    className="h-9 px-4 rounded-xl border border-rose-300 text-rose-700 hover:bg-rose-50 text-xs font-semibold transition"
                  >
                    Reject Request
                  </button>
                  <button
                    onClick={() => {
                      setApproveResolution("refund");
                      setApproveNote("");
                      setShowApproveModal(true);
                    }}
                    className="h-9 px-4 rounded-xl bg-[#166F77] hover:bg-[#125B62] text-white text-xs font-semibold transition shadow-xs"
                  >
                    Approve Request
                  </button>
                </>
              )}

              {activeReturn.status === "APPROVED" && (
                <>
                  <button
                    onClick={handleMarkReceived}
                    disabled={actionInProgress}
                    className="h-9 px-4 rounded-xl bg-purple-700 hover:bg-purple-800 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition shadow-xs"
                  >
                    <Package className="h-3.5 w-3.5" />
                    Mark Package Received (Restock Stock)
                  </button>
                  {activeReturn.resolution === "replacement" && (
                    <button
                      onClick={() => setShowReplacementModal(true)}
                      className="h-9 px-4 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold transition shadow-xs"
                    >
                      Mark Replacement Dispatched
                    </button>
                  )}
                  {activeReturn.resolution === "refund" && (
                    <button
                      onClick={() => {
                        setRefundMethod("upi");
                        setUpiReference("");
                        setRefundNotes("");
                        setShowRefundModal(true);
                      }}
                      className="h-9 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold transition shadow-xs"
                    >
                      Record Refund
                    </button>
                  )}
                </>
              )}

              {activeReturn.status === "RECEIVED" && (
                <button
                  onClick={() => {
                    setRefundMethod("upi");
                    setUpiReference("");
                    setRefundNotes("");
                    setShowRefundModal(true);
                  }}
                  className="h-9 px-5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition shadow-xs"
                >
                  <IndianRupee className="h-3.5 w-3.5" />
                  Record Refund
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Approve Dialog */}
      {showApproveModal && activeReturn && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl border border-stone-200 space-y-4">
            <h3 className="font-serif text-lg font-bold text-stone-900">Approve Return Request</h3>
            <p className="text-xs text-muted-foreground">
              Select how to resolve this return for Order #{activeReturn.orderNo || (activeReturn.orderId as any)?.orderNo}.
            </p>

            <div className="space-y-3 text-xs">
              <label className="block font-semibold text-stone-800">Choose Resolution:</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setApproveResolution("refund")}
                  className={`p-3 rounded-xl border text-left font-semibold transition ${
                    approveResolution === "refund"
                      ? "border-[#166F77] bg-teal-50 text-[#166F77]"
                      : "border-border bg-white text-stone-700"
                  }`}
                >
                  Refund
                  <span className="block font-normal text-[11px] text-muted-foreground mt-0.5">
                    UPI / Store Wallet
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setApproveResolution("replacement")}
                  className={`p-3 rounded-xl border text-left font-semibold transition ${
                    approveResolution === "replacement"
                      ? "border-[#166F77] bg-teal-50 text-[#166F77]"
                      : "border-border bg-white text-stone-700"
                  }`}
                >
                  Replacement
                  <span className="block font-normal text-[11px] text-muted-foreground mt-0.5">
                    Ship new unit
                  </span>
                </button>
              </div>

              <label className="block font-semibold text-stone-800 pt-1">
                Admin Note for Customer (optional):
              </label>
              <textarea
                rows={2}
                placeholder="Return shipping instructions or verification notes..."
                value={approveNote}
                onChange={(e) => setApproveNote(e.target.value)}
                className="w-full p-2.5 rounded-lg border text-xs bg-white"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-100">
              <button
                type="button"
                onClick={() => setShowApproveModal(false)}
                className="h-9 px-4 rounded-xl border border-border text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApprove}
                disabled={actionInProgress}
                className="h-9 px-4 rounded-xl bg-[#166F77] hover:bg-[#125B62] text-white text-xs font-semibold transition"
              >
                {actionInProgress ? "Approving..." : "Confirm Approval"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Dialog */}
      {showRejectModal && activeReturn && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl border border-stone-200 space-y-4">
            <h3 className="font-serif text-lg font-bold text-rose-900">Decline Return Request</h3>
            <p className="text-xs text-muted-foreground">
              Please provide the official reason for declining this request. This will be sent to the customer via email.
            </p>

            <div className="space-y-2 text-xs">
              <label className="block font-semibold text-stone-800">
                Reason for Rejection <span className="text-rose-600">*</span>
              </label>
              <textarea
                rows={3}
                placeholder="e.g. Return request is beyond the 48-hour delivery window / missing unboxing video / product altered."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="w-full p-2.5 rounded-lg border text-xs bg-white focus:outline-none focus:border-rose-600"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-100">
              <button
                type="button"
                onClick={() => setShowRejectModal(false)}
                className="h-9 px-4 rounded-xl border border-border text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleReject}
                disabled={actionInProgress}
                className="h-9 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold transition"
              >
                {actionInProgress ? "Declining..." : "Decline Return"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Record Refund Dialog */}
      {showRefundModal && activeReturn && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl border border-stone-200 space-y-4">
            <h3 className="font-serif text-lg font-bold text-stone-900 flex items-center gap-2">
              <IndianRupee className="h-5 w-5 text-emerald-600" />
              Record Completed Refund
            </h3>
            <p className="text-xs text-muted-foreground">
              Refunds are processed manually by store administrators. Enter the audit details below.
            </p>

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs flex justify-between items-center">
              <span className="font-medium text-stone-600">Calculated Refund Amount:</span>
              <span className="font-bold text-emerald-700 text-base">
                {formatINR(activeReturn.totalEligibleRefund)}
              </span>
            </div>

            <div className="space-y-3 text-xs">
              <label className="block font-semibold text-stone-800">Refund Method:</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setRefundMethod("upi")}
                  className={`p-3 rounded-xl border text-left font-semibold transition ${
                    refundMethod === "upi"
                      ? "border-emerald-600 bg-emerald-50 text-emerald-800"
                      : "border-border bg-white text-stone-700"
                  }`}
                >
                  Manual UPI
                  <span className="block font-normal text-[11px] text-muted-foreground mt-0.5">
                    Direct bank / UPI transfer
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setRefundMethod("wallet")}
                  className={`p-3 rounded-xl border text-left font-semibold transition ${
                    refundMethod === "wallet"
                      ? "border-emerald-600 bg-emerald-50 text-emerald-800"
                      : "border-border bg-white text-stone-700"
                  }`}
                >
                  Store Wallet
                  <span className="block font-normal text-[11px] text-muted-foreground mt-0.5">
                    Instant devotee store credit
                  </span>
                </button>
              </div>

              {refundMethod === "upi" && (
                <div>
                  <label className="block font-semibold text-stone-800 mb-1">
                    UPI Reference / UTR Number <span className="text-rose-600">*</span>:
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 412345678901 or UPI/12345"
                    value={upiReference}
                    onChange={(e) => setUpiReference(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg border text-xs bg-white focus:outline-none focus:border-emerald-600"
                  />
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    Enter the genuine UTR/bank reference from your UPI payment app.
                  </p>
                </div>
              )}

              {refundMethod === "wallet" && (
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 text-[11px]">
                  <p className="font-semibold flex items-center gap-1">
                    <Wallet className="h-3.5 w-3.5" /> Devotee Store Credit
                  </p>
                  <p className="mt-0.5">
                    This will credit ₹{activeReturn.totalEligibleRefund} directly to the registered customer's store wallet account for immediate use on future orders.
                  </p>
                </div>
              )}

              <div>
                <label className="block font-semibold text-stone-800 mb-1">Audit Notes (optional):</label>
                <input
                  type="text"
                  placeholder="e.g. Refunded to customer's GPay account"
                  value={refundNotes}
                  onChange={(e) => setRefundNotes(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg border text-xs bg-white"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-100">
              <button
                type="button"
                onClick={() => setShowRefundModal(false)}
                className="h-9 px-4 rounded-xl border border-border text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRecordRefund}
                disabled={actionInProgress}
                className="h-9 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold transition"
              >
                {actionInProgress ? "Processing..." : "Complete Refund"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Replacement Shipped Dialog */}
      {showReplacementModal && activeReturn && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl border border-stone-200 space-y-4">
            <h3 className="font-serif text-lg font-bold text-stone-900">Mark Replacement Dispatched</h3>
            <p className="text-xs text-muted-foreground">
              Record replacement shipment tracking or courier notes for Order #{activeReturn.orderNo || (activeReturn.orderId as any)?.orderNo}.
            </p>

            <div className="space-y-2 text-xs">
              <label className="block font-semibold text-stone-800">Replacement Dispatch Notes:</label>
              <textarea
                rows={3}
                placeholder="e.g. Dispatched via DTDC AWB #123456789 on [Date]"
                value={replacementNote}
                onChange={(e) => setReplacementNote(e.target.value)}
                className="w-full p-2.5 rounded-lg border text-xs bg-white"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-100">
              <button
                type="button"
                onClick={() => setShowReplacementModal(false)}
                className="h-9 px-4 rounded-xl border border-border text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleMarkReplaced}
                disabled={actionInProgress}
                className="h-9 px-4 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold transition"
              >
                {actionInProgress ? "Updating..." : "Confirm Replacement Sent"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
