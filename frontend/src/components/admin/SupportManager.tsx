import { useState, useEffect, useCallback } from "react";
import {
  LifeBuoy,
  Search,
  RefreshCw,
  CheckCircle2,
  Clock,
  AlertCircle,
  MessageSquare,
  Send,
  Eye,
  X,
  Package,
  ExternalLink,
  ShieldAlert,
  Lock,
  User,
  Filter,
  Check,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
} from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";
import type {
  SupportTicket,
  SupportStatus,
  SupportPriority,
  SupportCategory,
  SupportAnalytics,
} from "@/lib/types/support";
import {
  SUPPORT_CATEGORY_LABELS,
  SUPPORT_STATUS_LABELS,
  SUPPORT_STATUS_COLORS,
} from "@/lib/types/support";

const PRIORITY_COLORS: Record<SupportPriority, { bg: string; text: string }> = {
  LOW: { bg: "bg-stone-100", text: "text-stone-700" },
  MEDIUM: { bg: "bg-blue-50", text: "text-blue-700" },
  HIGH: { bg: "bg-amber-100", text: "text-amber-800" },
  URGENT: { bg: "bg-rose-100", text: "text-rose-800" },
};

export function SupportManager() {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [priorityFilter, setPriorityFilter] = useState<string>("ALL");
  const [hasOrderFilter, setHasOrderFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Analytics
  const [analytics, setAnalytics] = useState<SupportAnalytics | null>(null);

  // Detail Modal
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [linkedOrder, setLinkedOrder] = useState<any | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Reply / Note Form states
  const [replyText, setReplyText] = useState("");
  const [replyNewStatus, setReplyNewStatus] = useState<SupportStatus | "">("");
  const [submittingReply, setSubmittingReply] = useState(false);

  const [internalNoteText, setInternalNoteText] = useState("");
  const [submittingNote, setSubmittingNote] = useState(false);

  // Auto-close trigger
  const [runningAutoClose, setRunningAutoClose] = useState(false);

  // Fetch Tickets List
  const fetchTickets = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", "15");
      if (statusFilter !== "ALL") params.set("status", statusFilter);
      if (categoryFilter !== "ALL") params.set("category", categoryFilter);
      if (priorityFilter !== "ALL") params.set("priority", priorityFilter);
      if (hasOrderFilter === "true") params.set("hasOrder", "true");
      if (hasOrderFilter === "false") params.set("hasOrder", "false");
      if (searchQuery.trim()) params.set("q", searchQuery.trim());

      const res = await api<{
        ok: boolean;
        tickets: SupportTicket[];
        total: number;
        page: number;
        totalPages: number;
      }>(`/admin/support/tickets?${params.toString()}`);

      if (res?.ok) {
        setTickets(res.tickets || []);
        setTotal(res.total || 0);
        setTotalPages(res.totalPages || 1);
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to load support tickets");
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, categoryFilter, priorityFilter, hasOrderFilter, searchQuery]);

  // Fetch Analytics
  const fetchAnalytics = useCallback(async () => {
    try {
      const res = await api<{ ok: boolean; metrics: SupportAnalytics }>("/admin/support/analytics");
      if (res?.ok && res.metrics) {
        setAnalytics(res.metrics);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  // Load Single Ticket Full Details
  const handleOpenDetail = async (ticketNo: string) => {
    try {
      setLoadingDetail(true);
      const res = await api<{
        ok: boolean;
        ticket: SupportTicket;
        linkedOrder: any;
      }>(`/admin/support/tickets/${ticketNo}`);

      if (res?.ok && res.ticket) {
        setSelectedTicket(res.ticket);
        setLinkedOrder(res.linkedOrder);
        setReplyNewStatus("");
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to load ticket details");
    } finally {
      setLoadingDetail(false);
    }
  };

  // Submit Admin Reply
  const handleSendAdminReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket || !replyText.trim()) return;

    try {
      setSubmittingReply(true);
      const res = await api<{ ok: boolean; ticket: SupportTicket; message: string }>(
        `/admin/support/tickets/${selectedTicket.ticketNo}/reply`,
        {
          method: "POST",
          body: {
            message: replyText.trim(),
            newStatus: replyNewStatus || undefined,
          },
        }
      );

      if (res?.ok && res.ticket) {
        toast.success("Reply dispatched to devotee via email!");
        setSelectedTicket(res.ticket);
        setReplyText("");
        setReplyNewStatus("");
        fetchTickets();
        fetchAnalytics();
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to send reply");
    } finally {
      setSubmittingReply(false);
    }
  };

  // Submit Internal Note
  const handleAddInternalNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket || !internalNoteText.trim()) return;

    try {
      setSubmittingNote(true);
      const res = await api<{ ok: boolean; ticket: SupportTicket }>(
        `/admin/support/tickets/${selectedTicket.ticketNo}/note`,
        {
          method: "POST",
          body: {
            note: internalNoteText.trim(),
          },
        }
      );

      if (res?.ok && res.ticket) {
        toast.success("Internal note added (private to admin team)");
        setSelectedTicket(res.ticket);
        setInternalNoteText("");
        fetchTickets();
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to add internal note");
    } finally {
      setSubmittingNote(false);
    }
  };

  // Update Status directly
  const handleUpdateStatus = async (newStatus: SupportStatus) => {
    if (!selectedTicket) return;

    try {
      const res = await api<{ ok: boolean; ticket: SupportTicket }>(
        `/admin/support/tickets/${selectedTicket.ticketNo}/status`,
        {
          method: "PATCH",
          body: { status: newStatus },
        }
      );

      if (res?.ok && res.ticket) {
        toast.success(`Status updated to ${SUPPORT_STATUS_LABELS[newStatus]}`);
        setSelectedTicket(res.ticket);
        fetchTickets();
        fetchAnalytics();
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to update status");
    }
  };

  // Update Priority directly
  const handleUpdatePriority = async (newPriority: SupportPriority) => {
    if (!selectedTicket) return;

    try {
      const res = await api<{ ok: boolean; ticket: SupportTicket }>(
        `/admin/support/tickets/${selectedTicket.ticketNo}/priority`,
        {
          method: "PATCH",
          body: { priority: newPriority },
        }
      );

      if (res?.ok && res.ticket) {
        toast.success(`Priority updated to ${newPriority}`);
        setSelectedTicket(res.ticket);
        fetchTickets();
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to update priority");
    }
  };

  // Run Auto-Close Manually
  const handleRunAutoClose = async () => {
    try {
      setRunningAutoClose(true);
      const res = await api<{ ok: boolean; closedCount: number; message: string }>(
        "/admin/support/auto-close",
        {
          method: "POST",
        }
      );
      toast.success(res?.message || `Auto-closed ${res?.closedCount || 0} tickets`);
      fetchTickets();
      fetchAnalytics();
    } catch (err: any) {
      toast.error(err?.message || "Auto-close process failed");
    } finally {
      setRunningAutoClose(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Title */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl font-bold text-stone-900 flex items-center gap-2">
            <LifeBuoy className="w-6 h-6 text-[#166F77]" />
            Customer Support & Seva Helpdesk
          </h1>
          <p className="text-xs sm:text-sm text-stone-500 mt-0.5">
            Manage devotee inquiries, order assistance, replies, and support workflows
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleRunAutoClose}
            disabled={runningAutoClose}
            className="px-3.5 py-2 rounded-xl border border-stone-200 bg-white hover:bg-stone-50 text-xs font-semibold text-stone-700 flex items-center gap-1.5 transition disabled:opacity-60 cursor-pointer shadow-xs"
            title="Automatically close tickets resolved for more than 72 hours"
          >
            <Clock className="w-3.5 h-3.5 text-stone-500" />
            <span>{runningAutoClose ? "Running..." : "Run 72h Auto-Close"}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              fetchTickets();
              fetchAnalytics();
            }}
            className="p-2 rounded-xl border border-stone-200 bg-white hover:bg-stone-50 text-stone-600 transition shadow-xs cursor-pointer"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Analytics Summary Cards */}
      {analytics && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="bg-white rounded-xl p-4 border border-stone-200 shadow-xs">
            <div className="text-[11px] font-bold uppercase tracking-wider text-stone-500">
              Total Tickets
            </div>
            <div className="text-2xl font-bold text-stone-900 mt-1">{analytics.totalTickets}</div>
          </div>
          <div className="bg-amber-50/60 rounded-xl p-4 border border-amber-200 shadow-xs">
            <div className="text-[11px] font-bold uppercase tracking-wider text-amber-700">
              Open / New
            </div>
            <div className="text-2xl font-bold text-amber-900 mt-1">
              {(analytics.statusCounts?.OPEN || 0) + (analytics.statusCounts?.IN_PROGRESS || 0)}
            </div>
          </div>
          <div className="bg-purple-50/60 rounded-xl p-4 border border-purple-200 shadow-xs">
            <div className="text-[11px] font-bold uppercase tracking-wider text-purple-700">
              Awaiting Reply
            </div>
            <div className="text-2xl font-bold text-purple-900 mt-1">
              {analytics.statusCounts?.WAITING_FOR_CUSTOMER || 0}
            </div>
          </div>
          <div className="bg-emerald-50/60 rounded-xl p-4 border border-emerald-200 shadow-xs">
            <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
              Resolved / Closed
            </div>
            <div className="text-2xl font-bold text-emerald-900 mt-1">
              {(analytics.statusCounts?.RESOLVED || 0) + (analytics.statusCounts?.CLOSED || 0)}
            </div>
          </div>
          <div className="bg-stone-50 rounded-xl p-4 border border-stone-200 shadow-xs">
            <div className="text-[11px] font-bold uppercase tracking-wider text-stone-500">
              Avg Resolution
            </div>
            <div className="text-2xl font-bold text-stone-800 mt-1">
              {analytics.avgResolutionHours !== null ? `${analytics.avgResolutionHours}h` : "—"}
            </div>
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-xl border border-stone-200 p-4 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
          {/* Search Input */}
          <div className="sm:col-span-4 relative">
            <Search className="w-4 h-4 text-stone-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Search ticket #, devotee name, email, order #..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-stone-200 text-xs focus:outline-none focus:border-[#166F77]"
            />
          </div>

          {/* Status Filter */}
          <div className="sm:col-span-2">
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="w-full py-2 px-2.5 rounded-lg border border-stone-200 text-xs focus:outline-none focus:border-[#166F77]"
            >
              <option value="ALL">All Statuses</option>
              <option value="OPEN">Open</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="WAITING_FOR_CUSTOMER">Awaiting Customer</option>
              <option value="RESOLVED">Resolved</option>
              <option value="CLOSED">Closed</option>
            </select>
          </div>

          {/* Category Filter */}
          <div className="sm:col-span-3">
            <select
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setPage(1);
              }}
              className="w-full py-2 px-2.5 rounded-lg border border-stone-200 text-xs focus:outline-none focus:border-[#166F77]"
            >
              <option value="ALL">All Categories</option>
              <option value="Order Status & Delivery">Order Status & Delivery</option>
              <option value="Cancellation & Modification">Cancellation & Modification</option>
              <option value="Returns & Replacements">Returns & Replacements</option>
              <option value="Payment & Billing">Payment & Billing</option>
              <option value="Product Inquiry & Poshak Sizing">Product Inquiry & Poshak Sizing</option>
              <option value="Loyalty & Coupons">Loyalty & Coupons</option>
              <option value="General & Seva Query">General & Seva Query</option>
            </select>
          </div>

          {/* Priority Filter */}
          <div className="sm:col-span-2">
            <select
              value={priorityFilter}
              onChange={(e) => {
                setPriorityFilter(e.target.value);
                setPage(1);
              }}
              className="w-full py-2 px-2.5 rounded-lg border border-stone-200 text-xs focus:outline-none focus:border-[#166F77]"
            >
              <option value="ALL">All Priorities</option>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="URGENT">Urgent</option>
            </select>
          </div>

          {/* Has Order Filter */}
          <div className="sm:col-span-1">
            <select
              value={hasOrderFilter}
              onChange={(e) => {
                setHasOrderFilter(e.target.value);
                setPage(1);
              }}
              className="w-full py-2 px-2 rounded-lg border border-stone-200 text-xs focus:outline-none focus:border-[#166F77]"
            >
              <option value="ALL">Order: All</option>
              <option value="true">Linked</option>
              <option value="false">None</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tickets Table */}
      <div className="bg-white rounded-xl border border-stone-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="text-center py-16">
            <RefreshCw className="w-6 h-6 animate-spin text-[#166F77] mx-auto mb-2" />
            <p className="text-xs text-stone-500">Loading support tickets...</p>
          </div>
        ) : tickets.length === 0 ? (
          <div className="text-center py-16">
            <LifeBuoy className="w-10 h-10 text-stone-300 mx-auto mb-2" />
            <p className="text-sm font-semibold text-stone-700">No support tickets found</p>
            <p className="text-xs text-stone-500 mt-1">
              Try adjusting your search criteria or filters
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-stone-50 border-b border-stone-200 text-stone-600 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">Ticket</th>
                  <th className="py-3 px-4">Devotee</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Subject</th>
                  <th className="py-3 px-4">Order</th>
                  <th className="py-3 px-4">Priority</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Last Activity</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {tickets.map((t) => (
                  <tr key={t._id} className="hover:bg-stone-50/80 transition">
                    <td className="py-3 px-4 font-mono font-bold text-stone-900">{t.ticketNo}</td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-stone-800">{t.customerName}</div>
                      <div className="text-stone-400 text-[11px]">{t.customerEmail}</div>
                    </td>
                    <td className="py-3 px-4 text-stone-600 font-medium">
                      {SUPPORT_CATEGORY_LABELS[t.category] || t.category}
                    </td>
                    <td className="py-3 px-4 max-w-xs truncate font-medium text-stone-900">
                      {t.subject}
                    </td>
                    <td className="py-3 px-4">
                      {t.orderNo ? (
                        <span className="font-mono text-[#166F77] bg-[#166F77]/10 px-2 py-0.5 rounded text-[11px] font-semibold">
                          #{t.orderNo}
                        </span>
                      ) : (
                        <span className="text-stone-400">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          PRIORITY_COLORS[t.priority]?.bg || "bg-stone-100"
                        } ${PRIORITY_COLORS[t.priority]?.text || "text-stone-700"}`}
                      >
                        {t.priority}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                          SUPPORT_STATUS_COLORS[t.status]?.bg || "bg-stone-100"
                        } ${SUPPORT_STATUS_COLORS[t.status]?.text || "text-stone-700"} ${
                          SUPPORT_STATUS_COLORS[t.status]?.border || "border-stone-200"
                        }`}
                      >
                        {SUPPORT_STATUS_LABELS[t.status] || t.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-stone-500 text-[11px]">
                      {new Date(t.updatedAt).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => handleOpenDetail(t.ticketNo)}
                        className="px-3 py-1.5 rounded-lg bg-[#166F77]/10 text-[#166F77] hover:bg-[#166F77] hover:text-white transition font-semibold cursor-pointer text-xs"
                      >
                        Manage
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-3 border-t border-stone-200 flex items-center justify-between text-xs text-stone-600 bg-stone-50/50">
            <div>
              Showing {tickets.length} of {total} tickets
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="p-1 rounded border border-stone-200 disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-2 font-semibold">
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="p-1 rounded border border-stone-200 disabled:opacity-40"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Ticket Management Drawer / Modal */}
      {selectedTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl border border-stone-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 border-b border-stone-200 bg-[#FAF8F5] flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono text-base font-bold text-stone-900">
                    {selectedTicket.ticketNo}
                  </span>
                  <span
                    className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${
                      SUPPORT_STATUS_COLORS[selectedTicket.status]?.bg || "bg-stone-100"
                    } ${SUPPORT_STATUS_COLORS[selectedTicket.status]?.text || "text-stone-700"} ${
                      SUPPORT_STATUS_COLORS[selectedTicket.status]?.border || "border-stone-200"
                    }`}
                  >
                    {SUPPORT_STATUS_LABELS[selectedTicket.status] || selectedTicket.status}
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      PRIORITY_COLORS[selectedTicket.priority]?.bg
                    } ${PRIORITY_COLORS[selectedTicket.priority]?.text}`}
                  >
                    {selectedTicket.priority} Priority
                  </span>
                </div>
                <h3 className="font-serif text-lg font-bold text-stone-900">
                  {selectedTicket.subject}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedTicket(null);
                  setLinkedOrder(null);
                }}
                className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-200 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              {/* Devotee & Order Info Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Devotee Info */}
                <div className="p-4 rounded-xl border border-stone-200 bg-stone-50/50 text-xs space-y-1.5">
                  <div className="font-bold uppercase tracking-wider text-stone-500 mb-2">
                    Customer Information
                  </div>
                  <div>
                    <span className="text-stone-500">Name:</span>{" "}
                    <b className="text-stone-900">{selectedTicket.customerName}</b>
                  </div>
                  <div>
                    <span className="text-stone-500">Email:</span>{" "}
                    <a
                      href={`mailto:${selectedTicket.customerEmail}`}
                      className="text-[#166F77] underline"
                    >
                      {selectedTicket.customerEmail}
                    </a>
                  </div>
                  {selectedTicket.customerPhone && (
                    <div>
                      <span className="text-stone-500">Phone:</span>{" "}
                      <b className="text-stone-900">{selectedTicket.customerPhone}</b>
                    </div>
                  )}
                  <div>
                    <span className="text-stone-500">Registered:</span>{" "}
                    <b>{selectedTicket.userId ? "Yes (Account Linked)" : "Guest Devotee"}</b>
                  </div>
                </div>

                {/* Linked Order Info */}
                <div className="p-4 rounded-xl border border-stone-200 bg-stone-50/50 text-xs space-y-1.5">
                  <div className="font-bold uppercase tracking-wider text-stone-500 mb-2">
                    Linked Order
                  </div>
                  {linkedOrder ? (
                    <>
                      <div className="flex justify-between">
                        <span className="text-stone-500">Order #:</span>
                        <span className="font-bold text-[#166F77]">#{linkedOrder.orderNo}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-stone-500">Status:</span>
                        <span className="font-semibold text-stone-800">{linkedOrder.status}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-stone-500">Total Amount:</span>
                        <span className="font-semibold text-stone-900">₹{linkedOrder.total}</span>
                      </div>
                      {linkedOrder.trackingId && (
                        <div className="flex justify-between">
                          <span className="text-stone-500">Courier / Tracking:</span>
                          <span className="font-medium text-stone-700">
                            {linkedOrder.courier || "Courier"} ({linkedOrder.trackingId})
                          </span>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-stone-400 py-3 italic">
                      No order linked to this support ticket
                    </div>
                  )}
                </div>
              </div>

              {/* Status & Priority Controls */}
              <div className="p-4 rounded-xl border border-stone-200 bg-white flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-bold uppercase tracking-wider text-stone-500">
                    Change Status:
                  </span>
                  {(["OPEN", "IN_PROGRESS", "WAITING_FOR_CUSTOMER", "RESOLVED", "CLOSED"] as const).map(
                    (st) => (
                      <button
                        key={st}
                        type="button"
                        onClick={() => handleUpdateStatus(st)}
                        className={`px-2.5 py-1 rounded-md font-semibold transition cursor-pointer ${
                          selectedTicket.status === st
                            ? "bg-[#166F77] text-white shadow-xs"
                            : "bg-stone-100 text-stone-700 hover:bg-stone-200"
                        }`}
                      >
                        {SUPPORT_STATUS_LABELS[st]}
                      </button>
                    )
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <span className="font-bold uppercase tracking-wider text-stone-500">
                    Priority:
                  </span>
                  {(["LOW", "MEDIUM", "HIGH", "URGENT"] as const).map((pr) => (
                    <button
                      key={pr}
                      type="button"
                      onClick={() => handleUpdatePriority(pr)}
                      className={`px-2.5 py-1 rounded-md font-semibold transition cursor-pointer ${
                        selectedTicket.priority === pr
                          ? "bg-stone-800 text-white shadow-xs"
                          : "bg-stone-100 text-stone-700 hover:bg-stone-200"
                      }`}
                    >
                      {pr}
                    </button>
                  ))}
                </div>
              </div>

              {/* Conversation Messages Thread */}
              <div>
                <h4 className="font-bold uppercase tracking-wider text-xs text-stone-500 mb-3">
                  Conversation & Internal Notes ({selectedTicket.messages.length})
                </h4>
                <div className="space-y-3">
                  {selectedTicket.messages.map((m, idx) => {
                    const isInternal = Boolean(m.isInternal);
                    const isAdmin = m.senderType === "admin";
                    const isSystem = m.senderType === "system";

                    if (isSystem) {
                      return (
                        <div
                          key={idx}
                          className="text-center py-2 px-4 rounded-xl bg-stone-50 text-[11px] text-stone-500 italic border border-stone-200/50"
                        >
                          {m.message}
                        </div>
                      );
                    }

                    if (isInternal) {
                      return (
                        <div
                          key={idx}
                          className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-300 text-amber-950 text-xs space-y-1"
                        >
                          <div className="flex items-center justify-between text-[11px] text-amber-800 font-semibold">
                            <span className="flex items-center gap-1.5">
                              <Lock className="w-3.5 h-3.5 text-amber-600" />
                              Internal Seva Note — {m.senderName}
                            </span>
                            <span>{new Date(m.createdAt).toLocaleString("en-IN")}</span>
                          </div>
                          <p className="leading-relaxed whitespace-pre-wrap">{m.message}</p>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={idx}
                        className={`p-4 rounded-xl border text-xs leading-relaxed space-y-1 ${
                          isAdmin
                            ? "bg-[#166F77]/5 border-[#166F77]/30 text-stone-900"
                            : "bg-white border-stone-200 text-stone-900 shadow-xs"
                        }`}
                      >
                        <div className="flex items-center justify-between text-[11px] text-stone-500">
                          <span className="font-semibold text-stone-800">
                            {isAdmin ? `🛡️ Seva Team (${m.senderName})` : `🙏 Customer (${m.senderName})`}
                          </span>
                          <span>{new Date(m.createdAt).toLocaleString("en-IN")}</span>
                        </div>
                        <p className="whitespace-pre-wrap">{m.message}</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Admin Actions: Reply & Internal Note */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                {/* Admin Reply Form */}
                <form
                  onSubmit={handleSendAdminReply}
                  className="p-4 rounded-xl border border-stone-200 bg-white space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-stone-900 flex items-center gap-1.5">
                      <Send className="w-3.5 h-3.5 text-[#166F77]" />
                      Reply to Customer
                    </span>
                    <span className="text-[10px] text-stone-400">Dispatches email</span>
                  </div>

                  <textarea
                    required
                    rows={4}
                    placeholder="Write a clear, helpful reply to the devotee..."
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    className="w-full p-2.5 rounded-lg border border-stone-200 text-xs focus:outline-none focus:border-[#166F77]"
                  />

                  <div className="flex items-center justify-between gap-2">
                    <select
                      value={replyNewStatus}
                      onChange={(e) => setReplyNewStatus(e.target.value as SupportStatus)}
                      className="py-1.5 px-2 rounded-lg border border-stone-200 text-xs focus:outline-none focus:border-[#166F77]"
                    >
                      <option value="">Keep current status</option>
                      <option value="WAITING_FOR_CUSTOMER">Set to Awaiting Customer</option>
                      <option value="RESOLVED">Set to Resolved</option>
                      <option value="CLOSED">Set to Closed</option>
                    </select>

                    <button
                      type="submit"
                      disabled={submittingReply}
                      className="px-4 py-1.5 rounded-lg bg-[#166F77] text-white text-xs font-semibold hover:bg-[#12585e] transition disabled:opacity-60 cursor-pointer"
                    >
                      {submittingReply ? "Sending..." : "Send Reply"}
                    </button>
                  </div>
                </form>

                {/* Internal Note Form */}
                <form
                  onSubmit={handleAddInternalNote}
                  className="p-4 rounded-xl border border-amber-200 bg-amber-50/40 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-amber-900 flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-amber-700" />
                      Add Internal Note
                    </span>
                    <span className="text-[10px] text-amber-700 font-semibold">
                      Private to Admin
                    </span>
                  </div>

                  <textarea
                    required
                    rows={4}
                    placeholder="Staff notes, courier followup references, verification notes..."
                    value={internalNoteText}
                    onChange={(e) => setInternalNoteText(e.target.value)}
                    className="w-full p-2.5 rounded-lg border border-amber-200 bg-white text-xs focus:outline-none focus:border-amber-500"
                  />

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={submittingNote}
                      className="px-4 py-1.5 rounded-lg bg-amber-700 text-white text-xs font-semibold hover:bg-amber-800 transition disabled:opacity-60 cursor-pointer"
                    >
                      {submittingNote ? "Adding..." : "Save Internal Note"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
