import { useState, useEffect, useMemo } from "react";
import { useStore, formatINR, type AdminCoupon } from "@/lib/store";
import {
  Tag,
  Plus,
  Pencil,
  Trash2,
  Copy,
  Check,
  Search,
  AlertCircle,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Calendar,
  Percent,
  Truck,
  IndianRupee,
  X,
  Clock,
  Filter,
} from "lucide-react";
import { toast } from "sonner";

export function CouponsManager() {
  const {
    getCoupons,
    createCoupon,
    updateCoupon,
    toggleCoupon,
    deleteCoupon,
    adminProducts,
    categories,
  } = useStore();

  const [coupons, setCoupons] = useState<AdminCoupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive" | "expired">("all");
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Form State
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [discountType, setDiscountType] = useState<"percentage" | "flat" | "free_shipping">("percentage");
  const [discountValue, setDiscountValue] = useState<number>(10);
  const [maxDiscountAmount, setMaxDiscountAmount] = useState<string>("");
  const [minOrderValue, setMinOrderValue] = useState<number>(0);
  const [usageLimitTotal, setUsageLimitTotal] = useState<string>("");
  const [usageLimitPerUser, setUsageLimitPerUser] = useState<string>("1");
  const [startDate, setStartDate] = useState<string>("");
  const [expiryDate, setExpiryDate] = useState<string>("");
  const [targetScope, setTargetScope] = useState<"all" | "categories" | "products">("all");
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [allowedPaymentMethods, setAllowedPaymentMethods] = useState<"both" | "online" | "cod">("both");
  const [isActive, setIsActive] = useState(true);
  const [productSearch, setProductSearch] = useState("");

  const loadCoupons = async () => {
    setLoading(true);
    try {
      const data = await getCoupons();
      setCoupons(Array.isArray(data) ? data : data.coupons || []);
    } catch (err: any) {
      toast.error(err?.message || "Failed to load coupons");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCoupons();
  }, []);

  const openCreateModal = () => {
    setEditingId(null);
    setCode("");
    setDescription("");
    setDiscountType("percentage");
    setDiscountValue(10);
    setMaxDiscountAmount("");
    setMinOrderValue(0);
    setUsageLimitTotal("");
    setUsageLimitPerUser("1");
    setStartDate(new Date().toISOString().slice(0, 10));
    setExpiryDate("");
    setTargetScope("all");
    setSelectedCategoryIds([]);
    setSelectedProductIds([]);
    setAllowedPaymentMethods("both");
    setIsActive(true);
    setProductSearch("");
    setModalOpen(true);
  };

  const openEditModal = (c: AdminCoupon) => {
    setEditingId(c.id || c._id || null);
    setCode(c.code);
    setDescription(c.description || "");
    setDiscountType(c.discountType);
    setDiscountValue(c.discountValue || 0);
    setMaxDiscountAmount(c.maxDiscountAmount !== undefined && c.maxDiscountAmount !== null ? String(c.maxDiscountAmount) : "");
    setMinOrderValue(c.minOrderValue || 0);
    setUsageLimitTotal(c.usageLimitTotal !== undefined && c.usageLimitTotal !== null ? String(c.usageLimitTotal) : "");
    setUsageLimitPerUser(c.usageLimitPerUser !== undefined && c.usageLimitPerUser !== null ? String(c.usageLimitPerUser) : "1");
    setStartDate(c.startDate ? new Date(c.startDate).toISOString().slice(0, 10) : "");
    const exp = c.expiryDate || c.endDate;
    setExpiryDate(exp ? new Date(exp).toISOString().slice(0, 10) : "");
    setAllowedPaymentMethods(c.allowedPaymentMethods || "both");

    const hasCats = (c.applicableCategoryIds?.length || 0) > 0;
    const hasProds = (c.applicableProductIds?.length || 0) > 0;
    if (hasProds) {
      setTargetScope("products");
    } else if (hasCats) {
      setTargetScope("categories");
    } else {
      setTargetScope("all");
    }
    setSelectedCategoryIds(c.applicableCategoryIds || []);
    setSelectedProductIds(c.applicableProductIds || []);
    setIsActive(c.isActive);
    setProductSearch("");
    setModalOpen(true);
  };

  const handleCopyCode = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(text);
    toast.success(`Copied "${text}" to clipboard`);
    setTimeout(() => {
      setCopiedCode(null);
    }, 2000);
  };

  const handleToggle = async (c: AdminCoupon) => {
    const targetId = c.id || c._id;
    if (!targetId) return;
    try {
      const res = await toggleCoupon(targetId);
      setCoupons((prev) =>
        prev.map((item) => ((item.id || item._id) === targetId ? res.coupon : item))
      );
      toast.success(res.message || `Coupon ${c.code} is now ${res.coupon.isActive ? "Active" : "Inactive"}`);
    } catch (err: any) {
      toast.error(err?.message || "Failed to toggle coupon status");
    }
  };

  const handleDelete = async (c: AdminCoupon) => {
    if (!confirm(`Are you sure you want to delete coupon "${c.code}"?`)) return;
    try {
      const res = await deleteCoupon(c.id || c._id);
      if (res?.archived) {
        toast.info(res.message);
        setCoupons((prev) =>
          prev.map((item) => ((item.id || item._id) === (c.id || c._id) ? { ...item, isActive: false } : item))
        );
      } else {
        setCoupons((prev) => prev.filter((item) => (item.id || item._id) !== (c.id || c._id)));
        toast.success(`Coupon ${c.code} deleted`);
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete coupon");
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = code.trim().toUpperCase();
    if (!cleanCode) {
      toast.error("Coupon code is required");
      return;
    }

    if (discountType !== "free_shipping" && (!discountValue || discountValue <= 0)) {
      toast.error("Please enter a valid discount value greater than 0");
      return;
    }

    if (discountType === "percentage" && discountValue > 100) {
      toast.error("Percentage discount cannot exceed 100%");
      return;
    }

    setSaving(true);
    try {
      const payload: any = {
        code: cleanCode,
        description: description.trim() || undefined,
        discountType,
        discountValue: discountType === "free_shipping" ? 0 : Number(discountValue),
        maxDiscountAmount: maxDiscountAmount.trim() ? Number(maxDiscountAmount) : undefined,
        minOrderValue: Number(minOrderValue) || 0,
        usageLimitTotal: usageLimitTotal.trim() ? Number(usageLimitTotal) : undefined,
        usageLimitPerUser: usageLimitPerUser.trim() ? Number(usageLimitPerUser) : undefined,
        startDate: startDate ? new Date(startDate).toISOString() : new Date().toISOString(),
        endDate: expiryDate ? new Date(`${expiryDate}T23:59:59.999Z`).toISOString() : undefined,
        expiryDate: expiryDate ? new Date(`${expiryDate}T23:59:59.999Z`).toISOString() : undefined,
        applicableCategoryIds: targetScope === "categories" ? selectedCategoryIds : [],
        applicableProductIds: targetScope === "products" ? selectedProductIds : [],
        allowedPaymentMethods,
        isActive,
      };

      if (editingId) {
        const updated = await updateCoupon(editingId, payload);
        setCoupons((prev) => prev.map((item) => ((item.id || item._id) === editingId ? updated : item)));
        toast.success(`Coupon "${updated.code}" updated successfully`);
      } else {
        const created = await createCoupon(payload);
        setCoupons((prev) => [created, ...prev]);
        toast.success(`Coupon "${created.code}" created successfully`);
      }
      setModalOpen(false);
    } catch (err: any) {
      toast.error(err?.message || "Failed to save coupon");
    } finally {
      setSaving(false);
    }
  };

  // Filtered coupons
  const now = new Date();
  const filteredCoupons = useMemo(() => {
    return coupons.filter((c) => {
      const exp = c.expiryDate || c.endDate;
      const isExpired = exp && new Date(exp) < now;
      if (statusFilter === "active" && (!c.isActive || isExpired)) return false;
      if (statusFilter === "inactive" && c.isActive) return false;
      if (statusFilter === "expired" && !isExpired) return false;

      if (!search.trim()) return true;
      const q = search.trim().toLowerCase();
      return (
        c.code.toLowerCase().includes(q) ||
        (c.description || "").toLowerCase().includes(q)
      );
    });
  }, [coupons, statusFilter, search, now]);

  // Quick stats
  const totalCouponsCount = coupons.length;
  const activeCouponsCount = coupons.filter((c) => {
    const exp = c.expiryDate || c.endDate;
    return c.isActive && (!exp || new Date(exp) >= now);
  }).length;
  const totalRedemptions = coupons.reduce((sum, c) => sum + (c.usedCount || 0), 0);
  const freeShippingCouponsCount = coupons.filter((c) => c.discountType === "free_shipping").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-serif text-3xl font-bold text-stone-900">Promotions & Coupons</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#166F77]/10 text-[#166F77]">
              {coupons.length} Total
            </span>
          </div>
          <p className="mt-1 text-sm text-stone-500">
            Create discount codes, configure percentage / flat discounts, free shipping, and track usage.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={loadCoupons}
            disabled={loading}
            className="inline-flex items-center gap-1.5 h-10 px-3.5 rounded-xl border border-stone-200 bg-white text-stone-700 text-xs font-medium hover:bg-stone-50 transition shadow-xs disabled:opacity-50"
            title="Refresh coupons"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 h-10 px-5 rounded-xl bg-[#166F77] text-white text-sm font-semibold hover:bg-[#125B62] transition shadow-md shadow-[#166F77]/20"
          >
            <Plus className="h-4 w-4" />
            <span>Create Coupon</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-stone-200 p-4 shadow-xs">
          <div className="flex items-center justify-between text-stone-500 mb-2">
            <span className="text-xs font-medium">Total Coupons</span>
            <Tag className="h-4 w-4 text-[#166F77]" />
          </div>
          <p className="font-serif text-2xl font-bold text-stone-900">{totalCouponsCount}</p>
          <p className="text-[11px] text-stone-400 mt-1">Configured in store</p>
        </div>

        <div className="bg-white rounded-xl border border-stone-200 p-4 shadow-xs">
          <div className="flex items-center justify-between text-stone-500 mb-2">
            <span className="text-xs font-medium">Active Coupons</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="font-serif text-2xl font-bold text-emerald-700">{activeCouponsCount}</p>
          <p className="text-[11px] text-stone-400 mt-1">Ready for redemption</p>
        </div>

        <div className="bg-white rounded-xl border border-stone-200 p-4 shadow-xs">
          <div className="flex items-center justify-between text-stone-500 mb-2">
            <span className="text-xs font-medium">Total Redemptions</span>
            <Percent className="h-4 w-4 text-teal-600" />
          </div>
          <p className="font-serif text-2xl font-bold text-stone-900">{totalRedemptions}</p>
          <p className="text-[11px] text-stone-400 mt-1">Orders with coupons applied</p>
        </div>

        <div className="bg-white rounded-xl border border-stone-200 p-4 shadow-xs">
          <div className="flex items-center justify-between text-stone-500 mb-2">
            <span className="text-xs font-medium">Free Shipping Offers</span>
            <Truck className="h-4 w-4 text-amber-600" />
          </div>
          <p className="font-serif text-2xl font-bold text-stone-900">{freeShippingCouponsCount}</p>
          <p className="text-[11px] text-stone-400 mt-1">Zero-shipping promotions</p>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search coupon code or description..."
            className="w-full h-10 pl-9 pr-4 rounded-xl border border-stone-200 bg-white text-xs text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-1 focus:ring-[#166F77] focus:border-[#166F77] transition"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-stone-400 hover:text-stone-600"
            >
              Clear
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {(["all", "active", "inactive", "expired"] as const).map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`h-10 px-3.5 rounded-xl text-xs font-semibold capitalize whitespace-nowrap transition border ${
                statusFilter === st
                  ? "bg-[#166F77] text-white border-[#166F77] shadow-xs"
                  : "bg-white text-stone-600 border-stone-200 hover:bg-stone-50"
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Coupons Table */}
      <div className="bg-white rounded-xl border border-stone-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-20 text-center text-stone-400">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-[#166F77] mb-2" />
            <p className="text-sm">Loading promotions...</p>
          </div>
        ) : filteredCoupons.length === 0 ? (
          <div className="py-16 text-center text-stone-500">
            <Tag className="h-10 w-10 mx-auto text-stone-300 mb-3" />
            <p className="font-semibold text-stone-800 text-sm">No coupons found</p>
            <p className="text-xs text-stone-400 mt-1 max-w-sm mx-auto">
              {search || statusFilter !== "all"
                ? "No promo codes match your search criteria. Try resetting filters."
                : "No promo codes have been created yet. Click '+ Create Coupon' to launch your first promotional offer."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-stone-50 text-stone-500 uppercase tracking-wider font-semibold border-b border-stone-200">
                <tr>
                  <th className="py-3 px-4">Coupon Code</th>
                  <th className="py-3 px-4">Discount</th>
                  <th className="py-3 px-4">Conditions</th>
                  <th className="py-3 px-4">Usage</th>
                  <th className="py-3 px-4">Validity</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filteredCoupons.map((c) => {
                  const exp = c.expiryDate || c.endDate;
                  const isExpired = exp && new Date(exp) < now;
                  const couponKey = c.id || c._id || c.code;
                  return (
                    <tr key={couponKey} className="hover:bg-stone-50/60 transition">
                      <td className="py-3.5 px-4 font-medium">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-xs font-bold text-stone-900 bg-stone-100 px-2 py-0.5 rounded border border-stone-200">
                            {c.code}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopyCode(c.code)}
                            className="text-stone-400 hover:text-stone-600 p-1"
                            title="Copy code"
                          >
                            {copiedCode === c.code ? (
                              <Check className="h-3 w-3 text-emerald-600" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </button>
                        </div>
                        {c.description && (
                          <p className="text-[11px] text-stone-500 mt-1 max-w-xs truncate">
                            {c.description}
                          </p>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        {c.discountType === "percentage" && (
                          <div>
                            <span className="font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 text-xs">
                              {c.discountValue}% OFF
                            </span>
                            {c.maxDiscountAmount && (
                              <p className="text-[10px] text-stone-500 mt-0.5">
                                Up to {formatINR(c.maxDiscountAmount)}
                              </p>
                            )}
                          </div>
                        )}
                        {c.discountType === "flat" && (
                          <span className="font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 text-xs">
                            {formatINR(c.discountValue)} FLAT
                          </span>
                        )}
                        {c.discountType === "free_shipping" && (
                          <span className="font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200 text-xs flex items-center gap-1 w-fit">
                            <Truck className="h-3 w-3" /> FREE SHIPPING
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-stone-600">
                        <div>
                          {(c.minOrderValue ?? 0) > 0 ? (
                            <span>Min Order: <strong>{formatINR(c.minOrderValue!)}</strong></span>
                          ) : (
                            <span className="text-stone-400">No minimum</span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                          <p className="text-[11px] text-stone-400">
                            {c.applicableProductIds && c.applicableProductIds.length > 0
                              ? `${c.applicableProductIds.length} Products`
                              : c.applicableCategoryIds && c.applicableCategoryIds.length > 0
                              ? `${c.applicableCategoryIds.length} Categories`
                              : "All Store Items"}
                          </p>
                          {c.allowedPaymentMethods === "online" && (
                            <span className="text-[10px] font-medium bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.2 rounded">
                              Online Only
                            </span>
                          )}
                          {c.allowedPaymentMethods === "cod" && (
                            <span className="text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.2 rounded">
                              COD Only
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-stone-600">
                        <div>
                          <strong className="text-stone-900">{c.usedCount || 0}</strong>
                          <span className="text-stone-400">
                            {c.usageLimitTotal ? ` / ${c.usageLimitTotal} uses` : " / Unlimited"}
                          </span>
                        </div>
                        {c.usageLimitPerUser && (
                          <p className="text-[10px] text-stone-400 mt-0.5">
                            {c.usageLimitPerUser} per user
                          </p>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-stone-600">
                        {exp ? (
                          <div>
                            <span className="text-xs">
                              {new Date(exp).toLocaleDateString("en-IN", {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              })}
                            </span>
                            {isExpired && (
                              <p className="text-[10px] text-rose-600 font-semibold mt-0.5">Expired</p>
                            )}
                          </div>
                        ) : (
                          <span className="text-stone-400">Never expires</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        <button
                          type="button"
                          onClick={() => handleToggle(c)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold transition ${
                            !c.isActive
                              ? "bg-stone-100 text-stone-600 hover:bg-stone-200"
                              : isExpired
                              ? "bg-rose-50 text-rose-700 border border-rose-200"
                              : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          }`}
                          title="Click to toggle active state"
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              !c.isActive
                                ? "bg-stone-400"
                                : isExpired
                                ? "bg-rose-500"
                                : "bg-emerald-500"
                            }`}
                          />
                          <span>
                            {!c.isActive ? "Inactive" : isExpired ? "Expired" : "Active"}
                          </span>
                        </button>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => openEditModal(c)}
                            className="p-1.5 rounded-lg text-stone-500 hover:text-stone-900 hover:bg-stone-100 transition"
                            title="Edit coupon"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(c)}
                            className="p-1.5 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50 transition"
                            title="Delete coupon"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CREATE / EDIT MODAL */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl border border-stone-200 shadow-2xl max-w-2xl w-full my-8 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100 bg-[#FAF7F2]">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-[#166F77]/10 flex items-center justify-center text-[#166F77]">
                  <Tag className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="font-serif text-lg font-bold text-stone-900">
                    {editingId ? "Edit Promotion / Coupon" : "Create New Promotion"}
                  </h2>
                  <p className="text-xs text-stone-500">
                    {editingId ? "Modify coupon rules and limits" : "Define promotional discount rules for checkout"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="text-stone-400 hover:text-stone-600 p-1.5 rounded-lg hover:bg-stone-200/50 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSave} className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Coupon Code <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    placeholder="e.g. RADHE10, FESTIVE50"
                    className="w-full h-10 px-3 font-mono uppercase rounded-xl border border-stone-200 text-xs focus:ring-1 focus:ring-[#166F77] focus:border-[#166F77] transition"
                  />
                  <p className="text-[10px] text-stone-400 mt-1">Codes are automatically uppercase and trimmed.</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Status
                  </label>
                  <div className="flex items-center gap-3 h-10">
                    <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-stone-700">
                      <input
                        type="checkbox"
                        checked={isActive}
                        onChange={(e) => setIsActive(e.target.checked)}
                        className="w-4 h-4 rounded text-[#166F77] focus:ring-[#166F77] border-stone-300"
                      />
                      <span>Active & Available for checkout</span>
                    </label>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Description / Internal Notes
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. 10% discount on sacred Tulsi malas for Janmashtami festival"
                  className="w-full h-10 px-3 rounded-xl border border-stone-200 text-xs focus:ring-1 focus:ring-[#166F77] focus:border-[#166F77] transition"
                />
              </div>

              {/* Discount Type Selector */}
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                  Discount Type <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-3 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setDiscountType("percentage")}
                    className={`p-3 rounded-xl border text-center transition ${
                      discountType === "percentage"
                        ? "bg-[#166F77]/10 border-[#166F77] text-[#166F77] font-semibold"
                        : "bg-white border-stone-200 text-stone-600 hover:bg-stone-50"
                    }`}
                  >
                    <Percent className="h-4 w-4 mx-auto mb-1" />
                    <span className="text-xs block">Percentage</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDiscountType("flat")}
                    className={`p-3 rounded-xl border text-center transition ${
                      discountType === "flat"
                        ? "bg-[#166F77]/10 border-[#166F77] text-[#166F77] font-semibold"
                        : "bg-white border-stone-200 text-stone-600 hover:bg-stone-50"
                    }`}
                  >
                    <IndianRupee className="h-4 w-4 mx-auto mb-1" />
                    <span className="text-xs block">Flat Discount</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDiscountType("free_shipping")}
                    className={`p-3 rounded-xl border text-center transition ${
                      discountType === "free_shipping"
                        ? "bg-[#166F77]/10 border-[#166F77] text-[#166F77] font-semibold"
                        : "bg-white border-stone-200 text-stone-600 hover:bg-stone-50"
                    }`}
                  >
                    <Truck className="h-4 w-4 mx-auto mb-1" />
                    <span className="text-xs block">Free Shipping</span>
                  </button>
                </div>
              </div>

              {/* Discount Values */}
              {discountType !== "free_shipping" && (
                <div className="grid sm:grid-cols-2 gap-4 p-3.5 rounded-xl bg-stone-50 border border-stone-200/80">
                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">
                      {discountType === "percentage" ? "Discount Percentage (%)" : "Flat Amount (₹)"}{" "}
                      <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={discountType === "percentage" ? 100 : undefined}
                      required
                      value={discountValue}
                      onChange={(e) => setDiscountValue(Number(e.target.value))}
                      placeholder={discountType === "percentage" ? "10" : "100"}
                      className="w-full h-10 px-3 rounded-xl border border-stone-200 bg-white text-xs focus:ring-1 focus:ring-[#166F77] focus:border-[#166F77]"
                    />
                  </div>

                  {discountType === "percentage" && (
                    <div>
                      <label className="block text-xs font-semibold text-stone-700 mb-1">
                        Maximum Discount Cap (₹)
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={maxDiscountAmount}
                        onChange={(e) => setMaxDiscountAmount(e.target.value)}
                        placeholder="e.g. 500 (optional)"
                        className="w-full h-10 px-3 rounded-xl border border-stone-200 bg-white text-xs focus:ring-1 focus:ring-[#166F77] focus:border-[#166F77]"
                      />
                      <p className="text-[10px] text-stone-400 mt-1">Leave blank for uncapped percentage discount.</p>
                    </div>
                  )}
                </div>
              )}

              {/* Rules & Eligibility */}
              <div className="grid sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Minimum Order Value (₹)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={minOrderValue}
                    onChange={(e) => setMinOrderValue(Number(e.target.value))}
                    placeholder="0"
                    className="w-full h-10 px-3 rounded-xl border border-stone-200 text-xs focus:ring-1 focus:ring-[#166F77] focus:border-[#166F77]"
                  />
                  <p className="text-[10px] text-stone-400 mt-1">Gross subtotal required before discount applies.</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Total Usage Limit
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={usageLimitTotal}
                    onChange={(e) => setUsageLimitTotal(e.target.value)}
                    placeholder="e.g. 500 (blank = unlimited)"
                    className="w-full h-10 px-3 rounded-xl border border-stone-200 text-xs focus:ring-1 focus:ring-[#166F77] focus:border-[#166F77]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Per-User Limit
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={usageLimitPerUser}
                    onChange={(e) => setUsageLimitPerUser(e.target.value)}
                    placeholder="1"
                    className="w-full h-10 px-3 rounded-xl border border-stone-200 text-xs focus:ring-1 focus:ring-[#166F77] focus:border-[#166F77]"
                  />
                </div>
              </div>

              {/* Validity Window */}
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl border border-stone-200 text-xs focus:ring-1 focus:ring-[#166F77] focus:border-[#166F77]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Expiry Date
                  </label>
                  <input
                    type="date"
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl border border-stone-200 text-xs focus:ring-1 focus:ring-[#166F77] focus:border-[#166F77]"
                  />
                  <p className="text-[10px] text-stone-400 mt-1">Leave blank if coupon does not expire.</p>
                </div>
              </div>

              {/* Payment Method Eligibility */}
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                  Allowed Payment Methods <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-3 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setAllowedPaymentMethods("both")}
                    className={`p-2.5 rounded-xl border text-center transition ${
                      allowedPaymentMethods === "both"
                        ? "bg-[#166F77]/10 border-[#166F77] text-[#166F77] font-semibold"
                        : "bg-white border-stone-200 text-stone-600 hover:bg-stone-50"
                    }`}
                  >
                    <span className="text-xs font-medium block">Both</span>
                    <span className="text-[10px] text-stone-400 block">Online & COD</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAllowedPaymentMethods("online")}
                    className={`p-2.5 rounded-xl border text-center transition ${
                      allowedPaymentMethods === "online"
                        ? "bg-[#166F77]/10 border-[#166F77] text-[#166F77] font-semibold"
                        : "bg-white border-stone-200 text-stone-600 hover:bg-stone-50"
                    }`}
                  >
                    <span className="text-xs font-medium block">Online Only</span>
                    <span className="text-[10px] text-stone-400 block">Prepaid / Cards / UPI</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAllowedPaymentMethods("cod")}
                    className={`p-2.5 rounded-xl border text-center transition ${
                      allowedPaymentMethods === "cod"
                        ? "bg-[#166F77]/10 border-[#166F77] text-[#166F77] font-semibold"
                        : "bg-white border-stone-200 text-stone-600 hover:bg-stone-50"
                    }`}
                  >
                    <span className="text-xs font-medium block">COD Only</span>
                    <span className="text-[10px] text-stone-400 block">Cash on Delivery</span>
                  </button>
                </div>
              </div>

              {/* Target Scope */}
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                  Applies To
                </label>
                <div className="flex gap-4 mb-3">
                  <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-stone-700">
                    <input
                      type="radio"
                      name="targetScope"
                      checked={targetScope === "all"}
                      onChange={() => setTargetScope("all")}
                      className="text-[#166F77] focus:ring-[#166F77]"
                    />
                    <span>All Products</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-stone-700">
                    <input
                      type="radio"
                      name="targetScope"
                      checked={targetScope === "categories"}
                      onChange={() => setTargetScope("categories")}
                      className="text-[#166F77] focus:ring-[#166F77]"
                    />
                    <span>Specific Categories</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-stone-700">
                    <input
                      type="radio"
                      name="targetScope"
                      checked={targetScope === "products"}
                      onChange={() => setTargetScope("products")}
                      className="text-[#166F77] focus:ring-[#166F77]"
                    />
                    <span>Specific Products</span>
                  </label>
                </div>

                {targetScope === "categories" && (
                  <div className="p-3 rounded-xl border border-stone-200 bg-stone-50 max-h-40 overflow-y-auto space-y-1.5">
                    {categories.length === 0 ? (
                      <p className="text-xs text-stone-400">No categories found</p>
                    ) : (
                      categories.map((cat) => (
                        <label
                          key={cat}
                          className="flex items-center gap-2 text-xs text-stone-700 cursor-pointer select-none py-0.5"
                        >
                          <input
                            type="checkbox"
                            checked={selectedCategoryIds.includes(cat)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedCategoryIds((prev) => [...prev, cat]);
                              } else {
                                setSelectedCategoryIds((prev) => prev.filter((id) => id !== cat));
                              }
                            }}
                            className="rounded text-[#166F77] focus:ring-[#166F77] border-stone-300"
                          />
                          <span>{cat}</span>
                        </label>
                      ))
                    )}
                  </div>
                )}

                {targetScope === "products" && (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                      placeholder="Search products to add..."
                      className="w-full h-9 px-3 rounded-lg border border-stone-200 text-xs"
                    />
                    <div className="p-3 rounded-xl border border-stone-200 bg-stone-50 max-h-48 overflow-y-auto space-y-1.5">
                      {adminProducts
                        .filter((p) =>
                          !productSearch.trim() ||
                          p.name.toLowerCase().includes(productSearch.toLowerCase())
                        )
                        .slice(0, 30)
                        .map((p) => (
                          <label
                            key={p.id}
                            className="flex items-center gap-2 text-xs text-stone-700 cursor-pointer select-none py-1 border-b border-stone-100 last:border-0"
                          >
                            <input
                              type="checkbox"
                              checked={selectedProductIds.includes(p.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedProductIds((prev) => [...prev, p.id]);
                                } else {
                                  setSelectedProductIds((prev) => prev.filter((id) => id !== p.id));
                                }
                              }}
                              className="rounded text-[#166F77] focus:ring-[#166F77] border-stone-300"
                            />
                            <span className="font-medium truncate flex-1">{p.name}</span>
                            <span className="text-stone-400 font-mono text-[11px] shrink-0">
                              {formatINR(p.price)}
                            </span>
                          </label>
                        ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="pt-4 border-t border-stone-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  disabled={saving}
                  className="px-4 h-10 rounded-xl border border-stone-200 text-stone-700 text-xs font-semibold hover:bg-stone-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 h-10 rounded-xl bg-[#166F77] text-white text-xs font-semibold hover:bg-[#125B62] transition shadow-md shadow-[#166F77]/20 flex items-center gap-2 disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>{editingId ? "Update Coupon" : "Create Coupon"}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
