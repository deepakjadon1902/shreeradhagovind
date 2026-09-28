import { useState, useEffect } from "react";
import { formatINR } from "@/lib/store";
import { api } from "@/lib/api";
import {
  Award,
  Wallet,
  Users,
  TrendingUp,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  ShieldCheck,
  RefreshCw,
  X,
  ChevronRight,
  Coins,
  Settings as SettingsIcon,
  Package,
  ShoppingBag,
  ExternalLink,
  Plus,
  Minus,
} from "lucide-react";
import { toast } from "sonner";

export type RetentionOverview = {
  customerCounts: {
    total: number;
    registered: number;
    guests: number;
    repeatCustomers: number;
    repeatCustomerRate: number;
  };
  financials: {
    totalRevenue: number;
    totalPaidOrders: number;
    averageOrderValue: number;
    averageCustomerLifetimeValue: number;
  };
  loyalty: {
    totalPointsIssued: number;
    totalPointsRedeemed: number;
    activePointsInCirculation: number;
    totalDiscountProvided: number;
    pointsMonetaryValueInCirculation: number;
  };
  wallet: {
    totalWalletBalanceOutstanding: number;
  };
  segmentation: {
    New: number;
    Active: number;
    "At Risk": number;
    Lapsed: number;
    Dormant: number;
  };
  tierDistribution: Record<string, number>;
};

export type CustomerSummary = {
  identifier: {
    userId: string | null;
    email: string | null;
    phone: string | null;
    name: string;
    isRegistered: boolean;
  };
  metrics: {
    totalOrders: number;
    paidOrders: number;
    totalSpend: number;
    aov: number;
    firstOrderDate: string | null;
    lastOrderDate: string | null;
    daysSinceLastOrder: number | null;
  };
  rfm: {
    recencyScore: number;
    frequencyScore: number;
    monetaryScore: number;
    compositeScore: string;
    segment: string;
  };
  tier: {
    id: string;
    name: string;
    badgeColor: string;
    pointsMultiplier: number;
    perks: string[];
  };
  loyalty: {
    pointsBalance: number;
    rupeeValue: number;
  };
  wallet: {
    balance: number;
  };
};

const DEFAULT_OVERVIEW: RetentionOverview = {
  customerCounts: {
    total: 0,
    registered: 0,
    guests: 0,
    repeatCustomers: 0,
    repeatCustomerRate: 0,
  },
  financials: {
    totalRevenue: 0,
    totalPaidOrders: 0,
    averageOrderValue: 0,
    averageCustomerLifetimeValue: 0,
  },
  loyalty: {
    totalPointsIssued: 0,
    totalPointsRedeemed: 0,
    activePointsInCirculation: 0,
    totalDiscountProvided: 0,
    pointsMonetaryValueInCirculation: 0,
  },
  wallet: {
    totalWalletBalanceOutstanding: 0,
  },
  segmentation: {
    New: 0,
    Active: 0,
    "At Risk": 0,
    Lapsed: 0,
    Dormant: 0,
  },
  tierDistribution: {},
};

export function RetentionLoyaltyManager() {
  const [activeTab, setActiveTab] = useState<"crm" | "settings">("crm");
  const [overview, setOverview] = useState<RetentionOverview>(DEFAULT_OVERVIEW);
  const [overviewLoading, setOverviewLoading] = useState(true);

  // CRM State
  const [customers, setCustomers] = useState<CustomerSummary[]>([]);
  const [crmLoading, setCrmLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedSegment, setSelectedSegment] = useState<string>("all");
  const [selectedTier, setSelectedTier] = useState<string>("all");
  const [registeredFilter, setRegisteredFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Customer 360 Detail Drawer
  const [selectedCustomerIdentifier, setSelectedCustomerIdentifier] = useState<string | null>(null);
  const [detailData, setDetailData] = useState<any | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Manual Adjustments inside Drawer
  const [adjustPointsDelta, setAdjustPointsDelta] = useState<string>("");
  const [adjustPointsReason, setAdjustPointsReason] = useState<string>("");
  const [adjustPointsSubmitting, setAdjustPointsSubmitting] = useState(false);

  const [adjustWalletAmount, setAdjustWalletAmount] = useState<string>("");
  const [adjustWalletDirection, setAdjustWalletDirection] = useState<"credit" | "debit">("credit");
  const [adjustWalletReason, setAdjustWalletReason] = useState<string>("");
  const [adjustWalletSubmitting, setAdjustWalletSubmitting] = useState(false);

  // Settings State
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [loyaltyConfig, setLoyaltyConfig] = useState({
    enabled: true,
    pointsEarningRate: 1,
    pointsEarningSpendUnit: 100,
    pointMonetaryValue: 0.25,
    minPointsRedemption: 100,
    maxPointsRedemptionPercent: 50,
    pointsCombineWithCoupons: true,
    pointsExpirationDays: 180,
    earnPointsOnShipping: false,
    earnPointsOnDiscountedSubtotal: true,
  });
  const [tiersConfig, setTiersConfig] = useState<any[]>([]);

  // 1. Load Overview KPIs
  const loadOverview = async () => {
    setOverviewLoading(true);
    try {
      const data = await api<any>("/admin/retention/overview");
      if (data) {
        setOverview({
          customerCounts: {
            total: data.customerCounts?.total ?? data.kpis?.totalCustomers ?? 0,
            registered: data.customerCounts?.registered ?? data.kpis?.registeredCustomers ?? 0,
            guests: data.customerCounts?.guests ?? data.kpis?.guestCustomers ?? 0,
            repeatCustomers: data.customerCounts?.repeatCustomers ?? data.kpis?.repeatCustomers ?? 0,
            repeatCustomerRate: data.customerCounts?.repeatCustomerRate ?? data.kpis?.repeatPurchaseRate ?? 0,
          },
          financials: {
            totalRevenue: data.financials?.totalRevenue ?? data.kpis?.totalQualifiedRevenue ?? 0,
            totalPaidOrders: data.financials?.totalPaidOrders ?? data.kpis?.totalQualifiedOrders ?? 0,
            averageOrderValue: data.financials?.averageOrderValue ?? data.kpis?.aov ?? 0,
            averageCustomerLifetimeValue: data.financials?.averageCustomerLifetimeValue ?? data.kpis?.ltv ?? 0,
          },
          loyalty: {
            totalPointsIssued: data.loyalty?.totalPointsIssued ?? data.loyalty?.pointsIssued ?? 0,
            totalPointsRedeemed: data.loyalty?.totalPointsRedeemed ?? data.loyalty?.pointsRedeemed ?? 0,
            activePointsInCirculation: data.loyalty?.activePointsInCirculation ?? data.loyalty?.activePointsBalance ?? 0,
            totalDiscountProvided: data.loyalty?.totalDiscountProvided ?? 0,
            pointsMonetaryValueInCirculation: data.loyalty?.pointsMonetaryValueInCirculation ?? 0,
          },
          wallet: {
            totalWalletBalanceOutstanding: data.wallet?.totalWalletBalanceOutstanding ?? data.wallet?.activeWalletBalance ?? 0,
          },
          segmentation: {
            New: data.segmentation?.New ?? data.segmentDistribution?.New ?? 0,
            Active: data.segmentation?.Active ?? data.segmentDistribution?.Active ?? 0,
            "At Risk": data.segmentation?.["At Risk"] ?? data.segmentDistribution?.["At Risk"] ?? 0,
            Lapsed: data.segmentation?.Lapsed ?? data.segmentDistribution?.Lapsed ?? 0,
            Dormant: data.segmentation?.Dormant ?? data.segmentDistribution?.Dormant ?? 0,
          },
          tierDistribution: data.tierDistribution || {},
        });
      }
    } catch (e: any) {
      toast.error(e?.message || "Failed to load retention metrics");
    } finally {
      setOverviewLoading(false);
    }
  };

  // 2. Load CRM Customers
  const loadCustomers = async () => {
    setCrmLoading(true);
    try {
      const q = new URLSearchParams();
      if (search.trim()) q.set("search", search.trim());
      if (selectedSegment !== "all") q.set("segment", selectedSegment);
      if (selectedTier !== "all") q.set("tier", selectedTier);
      if (registeredFilter === "registered") q.set("isRegistered", "true");
      if (registeredFilter === "guest") q.set("isRegistered", "false");
      q.set("page", String(page));
      q.set("limit", "25");

      const res = await api<any>(`/admin/retention/customers?${q.toString()}`);
      const rawCustomers = res?.customers || [];
      const formattedCustomers: CustomerSummary[] = rawCustomers.map((c: any) => ({
        identifier: {
          userId: c.identifier?.userId ?? c.userId ?? null,
          email: c.identifier?.email ?? c.email ?? null,
          phone: c.identifier?.phone ?? c.phone ?? null,
          name: c.identifier?.name ?? c.name ?? "Devotee",
          isRegistered: c.identifier?.isRegistered ?? c.isRegistered ?? false,
        },
        metrics: {
          totalOrders: c.metrics?.totalOrders ?? c.totalOrdersCount ?? 0,
          paidOrders: c.metrics?.paidOrders ?? c.qualifiedOrdersCount ?? 0,
          totalSpend: c.metrics?.totalSpend ?? c.lifetimeRevenue ?? 0,
          aov: c.metrics?.aov ?? c.aov ?? 0,
          firstOrderDate: c.metrics?.firstOrderDate ?? (c.firstPurchaseDate ? String(c.firstPurchaseDate) : null),
          lastOrderDate: c.metrics?.lastOrderDate ?? (c.lastPurchaseDate ? String(c.lastPurchaseDate) : null),
          daysSinceLastOrder: c.metrics?.daysSinceLastOrder ?? c.daysSinceLastOrder ?? null,
        },
        rfm: {
          recencyScore: c.rfm?.recencyScore ?? 1,
          frequencyScore: c.rfm?.frequencyScore ?? 1,
          monetaryScore: c.rfm?.monetaryScore ?? 1,
          compositeScore: c.rfm?.compositeScore ?? c.rfm?.rfmScore ?? "111",
          segment: c.rfm?.segment ?? c.rfm?.rfmSegment ?? "Recent Customers",
        },
        tier: {
          id: c.tier?.id ?? "tier_bronze",
          name: c.tier?.name ?? "Sevak (Bronze)",
          badgeColor: c.tier?.badgeColor ?? "#b45309",
          pointsMultiplier: c.tier?.pointsMultiplier ?? c.tier?.extraPointsMultiplier ?? 1.0,
          perks: c.tier?.perks ?? [],
        },
        loyalty: {
          pointsBalance: c.loyalty?.pointsBalance ?? c.loyaltyPointsBalance ?? 0,
          rupeeValue: c.loyalty?.rupeeValue ?? c.loyaltyPointsBalance ?? 0,
        },
        wallet: {
          balance: c.wallet?.balance ?? c.walletBalance ?? 0,
        },
      }));

      setCustomers(formattedCustomers);
      setTotalPages(res?.pagination?.pages ?? res?.totalPages ?? 1);
      setTotalCount(res?.pagination?.total ?? res?.total ?? 0);
    } catch (e: any) {
      toast.error(e?.message || "Failed to load customers");
    } finally {
      setCrmLoading(false);
    }
  };

  // 3. Load Retention & Loyalty Settings
  const loadSettings = async () => {
    setSettingsLoading(true);
    try {
      const data = await api<{ loyalty: any; tiers: any[] }>("/admin/retention/settings");
      if (data.loyalty) {
        setLoyaltyConfig((prev) => ({ ...prev, ...data.loyalty }));
      }
      if (data.tiers) {
        setTiersConfig(data.tiers);
      }
    } catch (e: any) {
      toast.error(e?.message || "Failed to load loyalty settings");
    } finally {
      setSettingsLoading(false);
    }
  };

  // 4. Load Customer 360 Detail
  const loadCustomerDetail = async (identifier: string) => {
    setSelectedCustomerIdentifier(identifier);
    setDetailLoading(true);
    try {
      const data = await api<any>(`/admin/retention/customers/${encodeURIComponent(identifier)}`);
      const m = data?.metrics || {};
      const normalizedMetrics = {
        identifier: {
          userId: m.identifier?.userId ?? m.userId ?? null,
          email: m.identifier?.email ?? m.email ?? null,
          phone: m.identifier?.phone ?? m.phone ?? null,
          name: m.identifier?.name ?? m.name ?? "Devotee",
          isRegistered: m.identifier?.isRegistered ?? m.isRegistered ?? false,
        },
        tier: {
          name: m.tier?.name ?? "Sevak (Bronze)",
          badgeColor: m.tier?.badgeColor ?? "#b45309",
        },
        rfm: {
          recencyScore: m.rfm?.recencyScore ?? 1,
          frequencyScore: m.rfm?.frequencyScore ?? 1,
          monetaryScore: m.rfm?.monetaryScore ?? 1,
          segment: m.rfm?.segment ?? m.rfm?.rfmSegment ?? "Recent Customers",
        },
        metrics: {
          daysSinceLastOrder: m.metrics?.daysSinceLastOrder ?? m.daysSinceLastOrder ?? null,
          paidOrders: m.metrics?.paidOrders ?? m.qualifiedOrderCount ?? 0,
          totalOrders: m.metrics?.totalOrders ?? m.totalOrdersPlaced ?? 0,
          totalSpend: m.metrics?.totalSpend ?? m.lifetimeQualifiedRevenue ?? 0,
          aov: m.metrics?.aov ?? m.aov ?? 0,
        },
        loyalty: {
          pointsBalance: m.loyalty?.pointsBalance ?? m.loyaltyPointsBalance ?? 0,
        },
        wallet: {
          balance: m.wallet?.balance ?? m.walletBalance ?? 0,
        },
      };
      setDetailData({
        ...data,
        metrics: normalizedMetrics,
      });
    } catch (e: any) {
      toast.error(e?.message || "Failed to load customer details");
      setSelectedCustomerIdentifier(null);
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    loadOverview();
    loadCustomers();
    loadSettings();
  }, []);

  useEffect(() => {
    loadCustomers();
  }, [page, selectedSegment, selectedTier, registeredFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadCustomers();
  };

  // Handle Manual Points Adjustment
  const handlePointsAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    const delta = parseInt(adjustPointsDelta, 10);
    if (isNaN(delta) || delta === 0) {
      toast.error("Please enter a valid non-zero points adjustment");
      return;
    }
    if (!adjustPointsReason.trim() || adjustPointsReason.trim().length < 3) {
      toast.error("Mandatory reason must be at least 3 characters");
      return;
    }
    const userId = detailData?.metrics?.identifier?.userId;
    if (!userId) {
      toast.error("Points can only be adjusted for registered accounts");
      return;
    }

    setAdjustPointsSubmitting(true);
    try {
      await api("/admin/retention/loyalty/adjust", {
        method: "POST",
        body: {
          userId,
          pointsDelta: delta,
          reason: adjustPointsReason.trim(),
        },
      });
      toast.success("Points successfully adjusted!");
      setAdjustPointsDelta("");
      setAdjustPointsReason("");
      loadCustomerDetail(selectedCustomerIdentifier!);
      loadCustomers();
      loadOverview();
    } catch (e: any) {
      toast.error(e?.message || "Failed to adjust points");
    } finally {
      setAdjustPointsSubmitting(false);
    }
  };

  // Handle Manual Wallet Adjustment
  const handleWalletAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(adjustWalletAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Please enter a valid positive amount");
      return;
    }
    if (!adjustWalletReason.trim() || adjustWalletReason.trim().length < 3) {
      toast.error("Mandatory reason must be at least 3 characters");
      return;
    }
    const userId = detailData?.metrics?.identifier?.userId;
    if (!userId) {
      toast.error("Wallet credit can only be adjusted for registered accounts");
      return;
    }

    setAdjustWalletSubmitting(true);
    try {
      await api("/admin/retention/wallet/adjust", {
        method: "POST",
        body: {
          userId,
          amount,
          direction: adjustWalletDirection,
          reason: adjustWalletReason.trim(),
        },
      });
      toast.success(`Wallet successfully ${adjustWalletDirection}ed!`);
      setAdjustWalletAmount("");
      setAdjustWalletReason("");
      loadCustomerDetail(selectedCustomerIdentifier!);
      loadCustomers();
      loadOverview();
    } catch (e: any) {
      toast.error(e?.message || "Failed to adjust wallet");
    } finally {
      setAdjustWalletSubmitting(false);
    }
  };

  // Save Settings
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      await api("/admin/retention/settings", {
        method: "PATCH",
        body: {
          loyalty: loyaltyConfig,
          tiers: tiersConfig,
        },
      });
      toast.success("Retention & Loyalty settings saved successfully!");
      loadOverview();
    } catch (e: any) {
      toast.error(e?.message || "Failed to save settings");
    } finally {
      setSavingSettings(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl sm:text-3xl text-stone-900 flex items-center gap-2.5">
            <Award className="h-7 w-7 text-amber-600" />
            Customer Retention & Loyalty
          </h2>
          <p className="text-sm text-stone-600 mt-1">
            Omnichannel devotee retention, VIP loyalty tiers, and wallet store credits.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              loadOverview();
              loadCustomers();
              loadSettings();
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-stone-200 bg-white text-xs font-medium text-stone-700 hover:bg-stone-50 transition"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-stone-200/90 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between text-stone-500">
            <span className="text-xs uppercase font-semibold tracking-wider">Total Devotees</span>
            <Users className="h-4 w-4 text-[#166F77]" />
          </div>
          <p className="mt-2 font-display text-3xl font-bold text-stone-900">
            {overviewLoading ? "..." : overview?.customerCounts?.total ?? 0}
          </p>
          <div className="mt-2 text-xs text-stone-500 flex items-center gap-2">
            <span>{overview?.customerCounts?.registered ?? 0} Registered</span>
            <span>•</span>
            <span>{overview?.customerCounts?.guests ?? 0} Guests</span>
          </div>
        </div>

        <div className="rounded-2xl border border-stone-200/90 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between text-stone-500">
            <span className="text-xs uppercase font-semibold tracking-wider">Repeat Devotees</span>
            <TrendingUp className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="mt-2 font-display text-3xl font-bold text-emerald-700">
            {overviewLoading ? "..." : `${overview?.customerCounts?.repeatCustomerRate ?? 0}%`}
          </p>
          <p className="mt-2 text-xs text-stone-500">
            {overview?.customerCounts?.repeatCustomers ?? 0} devotees with 2+ purchases
          </p>
        </div>

        <div className="rounded-2xl border border-stone-200/90 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between text-stone-500">
            <span className="text-xs uppercase font-semibold tracking-wider">Points in Circulation</span>
            <Coins className="h-4 w-4 text-amber-600" />
          </div>
          <p className="mt-2 font-display text-3xl font-bold text-amber-700">
            {overviewLoading ? "..." : `${overview?.loyalty?.activePointsInCirculation ?? 0} pts`}
          </p>
          <p className="mt-2 text-xs text-stone-500">
            Worth {formatINR(overview?.loyalty?.pointsMonetaryValueInCirculation ?? 0)}
          </p>
        </div>

        <div className="rounded-2xl border border-stone-200/90 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between text-stone-500">
            <span className="text-xs uppercase font-semibold tracking-wider">Outstanding Wallet Credits</span>
            <Wallet className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="mt-2 font-display text-3xl font-bold text-emerald-700">
            {overviewLoading ? "..." : formatINR(overview?.wallet?.totalWalletBalanceOutstanding ?? 0)}
          </p>
          <p className="mt-2 text-xs text-stone-500">Store credits across accounts</p>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex border-b border-stone-200 space-x-6">
        <button
          onClick={() => setActiveTab("crm")}
          className={`pb-3 text-sm font-semibold border-b-2 flex items-center gap-2 transition ${
            activeTab === "crm"
              ? "border-[#166F77] text-[#166F77]"
              : "border-transparent text-stone-500 hover:text-stone-800"
          }`}
        >
          <Users className="h-4 w-4" />
          Devotee CRM & Segments ({totalCount})
        </button>
        <button
          onClick={() => setActiveTab("settings")}
          className={`pb-3 text-sm font-semibold border-b-2 flex items-center gap-2 transition ${
            activeTab === "settings"
              ? "border-[#166F77] text-[#166F77]"
              : "border-transparent text-stone-500 hover:text-stone-800"
          }`}
        >
          <SettingsIcon className="h-4 w-4" />
          Loyalty Rules & VIP Tiers
        </button>
      </div>

      {/* TAB 1: CRM & CUSTOMERS */}
      {activeTab === "crm" && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="bg-white rounded-2xl border border-stone-200/90 p-4 shadow-sm flex flex-wrap items-center justify-between gap-3">
            <form onSubmit={handleSearchSubmit} className="flex-1 min-w-[240px] max-w-md relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search devotees by name, email, or phone..."
                className="w-full pl-10 pr-4 py-2 rounded-xl border border-stone-200 text-xs text-stone-900 focus:outline-none focus:ring-1 focus:ring-[#166F77] focus:border-[#166F77]"
              />
            </form>

            <div className="flex flex-wrap items-center gap-2.5">
              <select
                value={selectedSegment}
                onChange={(e) => {
                  setSelectedSegment(e.target.value);
                  setPage(1);
                }}
                className="px-3 py-2 rounded-xl border border-stone-200 bg-white text-xs text-stone-700 focus:outline-none focus:ring-1 focus:ring-[#166F77]"
              >
                <option value="all">All Segments</option>
                <option value="New">New</option>
                <option value="Active">Active</option>
                <option value="At Risk">At Risk</option>
                <option value="Lapsed">Lapsed</option>
                <option value="Dormant">Dormant</option>
              </select>

              <select
                value={registeredFilter}
                onChange={(e) => {
                  setRegisteredFilter(e.target.value);
                  setPage(1);
                }}
                className="px-3 py-2 rounded-xl border border-stone-200 bg-white text-xs text-stone-700 focus:outline-none focus:ring-1 focus:ring-[#166F77]"
              >
                <option value="all">All Account Types</option>
                <option value="registered">Registered Devotees</option>
                <option value="guest">Guest Orders</option>
              </select>
            </div>
          </div>

          {/* Devotees Table */}
          <div className="bg-white rounded-2xl border border-stone-200/90 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#FAF7F2] border-b border-stone-200/70 text-stone-600 font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Devotee</th>
                    <th className="py-3 px-3">Account</th>
                    <th className="py-3 px-3">VIP Tier</th>
                    <th className="py-3 px-3">Segment</th>
                    <th className="py-3 px-3 text-right">Orders</th>
                    <th className="py-3 px-3 text-right">Paid Spend</th>
                    <th className="py-3 px-3 text-right">Points</th>
                    <th className="py-3 px-3 text-right">Wallet</th>
                    <th className="py-3 px-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {crmLoading ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-stone-400">
                        Loading devotees...
                      </td>
                    </tr>
                  ) : customers.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-stone-500">
                        No devotees found matching your search and filter criteria.
                      </td>
                    </tr>
                  ) : (
                    customers.map((c, i) => (
                      <tr key={i} className="hover:bg-stone-50/70 transition">
                        <td className="py-3 px-4">
                          <p className="font-semibold text-stone-900">{c.identifier.name || "Devotee"}</p>
                          <p className="text-[11px] text-stone-500">{c.identifier.email || c.identifier.phone || "-"}</p>
                        </td>
                        <td className="py-3 px-3">
                          {c.identifier.isRegistered ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100/70 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                              <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                              Registered
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-medium text-stone-600">
                              Guest
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10px] font-semibold text-amber-900">
                            <Sparkles className="h-2.5 w-2.5 text-amber-600" />
                            {c.tier?.name || "Bronze"}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                              c.rfm.segment === "Active"
                                ? "bg-emerald-100 text-emerald-800"
                                : c.rfm.segment === "New"
                                ? "bg-blue-100 text-blue-800"
                                : c.rfm.segment === "At Risk"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-stone-100 text-stone-700"
                            }`}
                          >
                            {c.rfm.segment}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right font-medium text-stone-800">{c.metrics.totalOrders}</td>
                        <td className="py-3 px-3 text-right font-semibold text-stone-900">
                          {formatINR(c.metrics.totalSpend)}
                        </td>
                        <td className="py-3 px-3 text-right font-semibold text-amber-700">
                          {c.loyalty.pointsBalance}
                        </td>
                        <td className="py-3 px-3 text-right font-semibold text-emerald-700">
                          {formatINR(c.wallet.balance)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <button
                            onClick={() =>
                              loadCustomerDetail(c.identifier.userId || c.identifier.email || "")
                            }
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-stone-200 bg-white text-[11px] font-semibold text-[#166F77] hover:bg-[#166F77]/10 transition"
                          >
                            View 360
                            <ChevronRight className="h-3 w-3" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="py-3 px-4 border-t border-stone-100 flex items-center justify-between text-xs text-stone-600">
                <span>
                  Showing page {page} of {totalPages}
                </span>
                <div className="flex gap-1.5">
                  <button
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="px-2.5 py-1 rounded-lg border border-stone-200 disabled:opacity-40"
                  >
                    Previous
                  </button>
                  <button
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className="px-2.5 py-1 rounded-lg border border-stone-200 disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: SETTINGS FORM */}
      {activeTab === "settings" && (
        <form onSubmit={handleSaveSettings} className="space-y-6">
          <div className="bg-white rounded-2xl border border-stone-200/90 p-6 shadow-sm space-y-5">
            <div className="flex items-center justify-between border-b border-stone-100 pb-4">
              <div>
                <h3 className="font-display text-lg font-bold text-stone-900">Loyalty Points Program Rules</h3>
                <p className="text-xs text-stone-500 mt-0.5">
                  Define point earning ratios, rupee monetary valuation, minimums, and redemption caps.
                </p>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <span className="text-xs font-semibold text-stone-700">Program Active</span>
                <input
                  type="checkbox"
                  checked={loyaltyConfig.enabled}
                  onChange={(e) => setLoyaltyConfig({ ...loyaltyConfig, enabled: e.target.checked })}
                  className="w-4 h-4 rounded text-[#166F77] focus:ring-[#166F77]"
                />
              </label>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">
                  Points Earned per Unit Spend
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    required
                    value={loyaltyConfig.pointsEarningRate}
                    onChange={(e) =>
                      setLoyaltyConfig({ ...loyaltyConfig, pointsEarningRate: parseFloat(e.target.value) || 1 })
                    }
                    className="w-24 px-3 py-2 rounded-xl border border-stone-200 text-sm font-medium"
                  />
                  <span className="text-xs text-stone-500">point(s) per ₹</span>
                  <input
                    type="number"
                    min="1"
                    required
                    value={loyaltyConfig.pointsEarningSpendUnit}
                    onChange={(e) =>
                      setLoyaltyConfig({
                        ...loyaltyConfig,
                        pointsEarningSpendUnit: parseInt(e.target.value, 10) || 100,
                      })
                    }
                    className="w-24 px-3 py-2 rounded-xl border border-stone-200 text-sm font-medium"
                  />
                  <span className="text-xs text-stone-500">spent</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">
                  Point Monetary Value (in ₹)
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-stone-500">1 pt = ₹</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={loyaltyConfig.pointMonetaryValue}
                    onChange={(e) =>
                      setLoyaltyConfig({
                        ...loyaltyConfig,
                        pointMonetaryValue: parseFloat(e.target.value) || 0.25,
                      })
                    }
                    className="w-28 px-3 py-2 rounded-xl border border-stone-200 text-sm font-medium"
                  />
                  <span className="text-xs text-stone-400">(e.g. ₹0.25)</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">
                  Minimum Points to Redeem
                </label>
                <input
                  type="number"
                  min="0"
                  required
                  value={loyaltyConfig.minPointsRedemption}
                  onChange={(e) =>
                    setLoyaltyConfig({
                      ...loyaltyConfig,
                      minPointsRedemption: parseInt(e.target.value, 10) || 0,
                    })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-stone-200 text-sm font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">
                  Max Redemption (% of Order)
                </label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  required
                  value={loyaltyConfig.maxPointsRedemptionPercent}
                  onChange={(e) =>
                    setLoyaltyConfig({
                      ...loyaltyConfig,
                      maxPointsRedemptionPercent: parseInt(e.target.value, 10) || 50,
                    })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-stone-200 text-sm font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">
                  Points Expiration (Days)
                </label>
                <input
                  type="number"
                  min="1"
                  max="1000"
                  required
                  value={loyaltyConfig.pointsExpirationDays}
                  onChange={(e) =>
                    setLoyaltyConfig({
                      ...loyaltyConfig,
                      pointsExpirationDays: parseInt(e.target.value, 10) || 180,
                    })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-stone-200 text-sm font-medium"
                />
              </div>

              <div className="space-y-2 pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={loyaltyConfig.pointsCombineWithCoupons}
                    onChange={(e) =>
                      setLoyaltyConfig({ ...loyaltyConfig, pointsCombineWithCoupons: e.target.checked })
                    }
                    className="w-4 h-4 rounded text-[#166F77]"
                  />
                  <span className="text-xs font-medium text-stone-700">Allow Combining with Coupons</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={loyaltyConfig.earnPointsOnDiscountedSubtotal}
                    onChange={(e) =>
                      setLoyaltyConfig({
                        ...loyaltyConfig,
                        earnPointsOnDiscountedSubtotal: e.target.checked,
                      })
                    }
                    className="w-4 h-4 rounded text-[#166F77]"
                  />
                  <span className="text-xs font-medium text-stone-700">Earn on Discounted Subtotal</span>
                </label>
              </div>
            </div>
          </div>

          {/* VIP Tiers Editor */}
          <div className="bg-white rounded-2xl border border-stone-200/90 p-6 shadow-sm space-y-4">
            <h3 className="font-display text-lg font-bold text-stone-900">VIP Devotee Tiers</h3>
            <p className="text-xs text-stone-500">
              Configure spending thresholds, qualification criteria, points multipliers, and tier perks.
            </p>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
              {tiersConfig.map((t, idx) => (
                <div key={t.id || idx} className="rounded-xl border border-stone-200 p-4 space-y-3 bg-stone-50/50">
                  <div className="flex items-center justify-between">
                    <span className="font-display font-bold text-stone-900">{t.name}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-amber-100 text-amber-800">
                      {t.extraPointsMultiplier}x Pts
                    </span>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-stone-500">Min Spend (₹)</label>
                    <input
                      type="number"
                      min="0"
                      value={t.minSpend}
                      onChange={(e) => {
                        const next = [...tiersConfig];
                        next[idx].minSpend = parseFloat(e.target.value) || 0;
                        setTiersConfig(next);
                      }}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-stone-200 bg-white text-xs font-semibold"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-stone-500">Min Paid Orders</label>
                    <input
                      type="number"
                      min="0"
                      value={t.minOrders}
                      onChange={(e) => {
                        const next = [...tiersConfig];
                        next[idx].minOrders = parseInt(e.target.value, 10) || 0;
                        setTiersConfig(next);
                      }}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-stone-200 bg-white text-xs font-semibold"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-stone-500">Points Multiplier</label>
                    <input
                      type="number"
                      step="0.05"
                      min="1"
                      max="10"
                      value={t.extraPointsMultiplier}
                      onChange={(e) => {
                        const next = [...tiersConfig];
                        next[idx].extraPointsMultiplier = parseFloat(e.target.value) || 1;
                        setTiersConfig(next);
                      }}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-stone-200 bg-white text-xs font-semibold"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={savingSettings}
              className="px-6 py-2.5 rounded-full bg-[#166F77] text-white font-semibold text-sm hover:bg-[#125B62] transition disabled:opacity-50"
            >
              {savingSettings ? "Saving Settings..." : "Save Retention & Loyalty Rules"}
            </button>
          </div>
        </form>
      )}

      {/* CUSTOMER 360 DETAIL DRAWER / MODAL */}
      {selectedCustomerIdentifier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6 sm:p-8 space-y-6 shadow-2xl relative">
            <button
              onClick={() => setSelectedCustomerIdentifier(null)}
              className="absolute right-5 top-5 p-2 rounded-full hover:bg-stone-100 text-stone-400 hover:text-stone-700 transition"
            >
              <X className="h-5 w-5" />
            </button>

            {detailLoading || !detailData ? (
              <div className="py-20 text-center text-stone-400">Loading Devotee 360 Details...</div>
            ) : (
              <>
                {/* Devotee Header */}
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-stone-100 pb-5">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-display text-2xl font-bold text-stone-900">
                        {detailData.metrics.identifier.name || "Devotee"}
                      </span>
                      {detailData.metrics.identifier.isRegistered ? (
                        <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                          Registered Account
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-stone-100 text-stone-600">
                          Guest Order History
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-stone-500 mt-1">
                      {detailData.metrics.identifier.email || "-"} • {detailData.metrics.identifier.phone || "-"}
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-xs uppercase font-medium text-stone-400">VIP Tier</p>
                      <p className="font-display text-base font-bold text-amber-900">
                        {detailData.metrics.tier.name}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs uppercase font-medium text-stone-400">Lifecycle</p>
                      <p className="font-semibold text-sm text-stone-800">
                        {detailData.metrics.rfm.segment}
                      </p>
                    </div>
                  </div>
                </div>

                {/* RFM & Metrics Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-stone-50 p-4 rounded-2xl">
                  <div>
                    <p className="text-[11px] text-stone-500">Recency (Score {detailData.metrics.rfm.recencyScore}/5)</p>
                    <p className="font-bold text-stone-900 text-sm">
                      {detailData.metrics.metrics.daysSinceLastOrder !== null
                        ? `${detailData.metrics.metrics.daysSinceLastOrder} days ago`
                        : "N/A"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] text-stone-500">Frequency (Score {detailData.metrics.rfm.frequencyScore}/5)</p>
                    <p className="font-bold text-stone-900 text-sm">
                      {detailData.metrics.metrics.paidOrders} paid orders
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] text-stone-500">Monetary (Score {detailData.metrics.rfm.monetaryScore}/5)</p>
                    <p className="font-bold text-stone-900 text-sm">
                      {formatINR(detailData.metrics.metrics.totalSpend)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] text-stone-500">Average Order Value</p>
                    <p className="font-bold text-stone-900 text-sm">
                      {formatINR(detailData.metrics.metrics.aov)}
                    </p>
                  </div>
                </div>

                {/* Manual Adjustments Section */}
                {detailData.metrics.identifier.userId && (
                  <div className="grid sm:grid-cols-2 gap-4">
                    {/* Points Adjustment Card */}
                    <div className="rounded-2xl border border-amber-200/80 bg-amber-50/40 p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-xs text-amber-900 flex items-center gap-1.5">
                          <Award className="h-4 w-4 text-amber-700" />
                          Adjust Loyalty Points
                        </span>
                        <span className="text-xs font-bold text-amber-950">
                          Balance: {detailData.metrics.loyalty.pointsBalance} pts
                        </span>
                      </div>
                      <form onSubmit={handlePointsAdjust} className="space-y-2">
                        <input
                          type="number"
                          placeholder="Points Delta (e.g. +50 or -25)"
                          value={adjustPointsDelta}
                          onChange={(e) => setAdjustPointsDelta(e.target.value)}
                          className="w-full text-xs px-3 py-1.5 rounded-lg border border-amber-300 bg-white"
                        />
                        <input
                          type="text"
                          placeholder="Mandatory audit reason..."
                          value={adjustPointsReason}
                          onChange={(e) => setAdjustPointsReason(e.target.value)}
                          className="w-full text-xs px-3 py-1.5 rounded-lg border border-amber-300 bg-white"
                        />
                        <button
                          type="submit"
                          disabled={adjustPointsSubmitting}
                          className="w-full py-1.5 rounded-lg bg-amber-600 text-white font-semibold text-xs hover:bg-amber-700 disabled:opacity-50"
                        >
                          {adjustPointsSubmitting ? "Adjusting..." : "Apply Points Adjustment"}
                        </button>
                      </form>
                    </div>

                    {/* Wallet Adjustment Card */}
                    <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/40 p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-xs text-emerald-900 flex items-center gap-1.5">
                          <Wallet className="h-4 w-4 text-emerald-700" />
                          Adjust Store Credit / Wallet
                        </span>
                        <span className="text-xs font-bold text-emerald-950">
                          Balance: {formatINR(detailData.metrics.wallet.balance)}
                        </span>
                      </div>
                      <form onSubmit={handleWalletAdjust} className="space-y-2">
                        <div className="flex gap-2">
                          <select
                            value={adjustWalletDirection}
                            onChange={(e) => setAdjustWalletDirection(e.target.value as any)}
                            className="text-xs px-2 py-1.5 rounded-lg border border-emerald-300 bg-white"
                          >
                            <option value="credit">Credit (+)</option>
                            <option value="debit">Debit (-)</option>
                          </select>
                          <input
                            type="number"
                            step="0.01"
                            min="0.01"
                            placeholder="Amount (₹)"
                            value={adjustWalletAmount}
                            onChange={(e) => setAdjustWalletAmount(e.target.value)}
                            className="flex-1 text-xs px-3 py-1.5 rounded-lg border border-emerald-300 bg-white"
                          />
                        </div>
                        <input
                          type="text"
                          placeholder="Mandatory audit reason..."
                          value={adjustWalletReason}
                          onChange={(e) => setAdjustWalletReason(e.target.value)}
                          className="w-full text-xs px-3 py-1.5 rounded-lg border border-emerald-300 bg-white"
                        />
                        <button
                          type="submit"
                          disabled={adjustWalletSubmitting}
                          className="w-full py-1.5 rounded-lg bg-emerald-600 text-white font-semibold text-xs hover:bg-emerald-700 disabled:opacity-50"
                        >
                          {adjustWalletSubmitting ? "Adjusting..." : "Apply Wallet Adjustment"}
                        </button>
                      </form>
                    </div>
                  </div>
                )}

                {/* Orders History Table */}
                <div className="space-y-2">
                  <h4 className="font-display font-semibold text-stone-900 text-sm flex items-center gap-1.5">
                    <Package className="h-4 w-4 text-[#166F77]" />
                    Associated Orders ({detailData.orders?.length || 0})
                  </h4>
                  <div className="rounded-xl border border-stone-200 overflow-hidden max-h-48 overflow-y-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-[#FAF7F2] text-stone-600">
                        <tr>
                          <th className="py-2 px-3">Order No</th>
                          <th className="py-2 px-3">Date</th>
                          <th className="py-2 px-3">Status</th>
                          <th className="py-2 px-3">Payment</th>
                          <th className="py-2 px-3 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100">
                        {detailData.orders?.map((o: any) => (
                          <tr key={o.id}>
                            <td className="py-2 px-3 font-semibold text-stone-900">
                              #{o.orderNo || o.id.slice(-6)}
                            </td>
                            <td className="py-2 px-3 text-stone-500">
                              {new Date(o.createdAt).toLocaleDateString("en-IN")}
                            </td>
                            <td className="py-2 px-3">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-stone-100">
                                {o.status}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-stone-600">
                              {o.payment?.method} ({o.payment?.status})
                            </td>
                            <td className="py-2 px-3 text-right font-semibold text-stone-900">
                              {formatINR(o.total)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Ledgers Tabs inside drawer */}
                <div className="grid sm:grid-cols-2 gap-4">
                  {/* Points Ledger */}
                  <div className="space-y-2">
                    <h4 className="font-semibold text-xs text-stone-700 flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-amber-600" />
                      Points Ledger History
                    </h4>
                    <div className="rounded-xl border border-stone-200 overflow-hidden max-h-40 overflow-y-auto divide-y divide-stone-100 text-xs">
                      {detailData.pointsLedger?.length === 0 ? (
                        <p className="p-3 text-stone-400 text-center">No points transactions</p>
                      ) : (
                        detailData.pointsLedger?.map((tx: any) => (
                          <div key={tx._id} className="p-2.5 flex items-center justify-between">
                            <div>
                              <p className="font-medium">{tx.reason}</p>
                              <p className="text-[10px] text-stone-400">
                                {new Date(tx.createdAt).toLocaleDateString("en-IN")} • {tx.type}
                              </p>
                            </div>
                            <span
                              className={`font-semibold ${
                                tx.pointsDelta > 0 ? "text-emerald-700" : "text-red-600"
                              }`}
                            >
                              {tx.pointsDelta > 0 ? `+${tx.pointsDelta}` : tx.pointsDelta}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Wallet Ledger */}
                  <div className="space-y-2">
                    <h4 className="font-semibold text-xs text-stone-700 flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-emerald-600" />
                      Wallet Ledger History
                    </h4>
                    <div className="rounded-xl border border-stone-200 overflow-hidden max-h-40 overflow-y-auto divide-y divide-stone-100 text-xs">
                      {detailData.walletLedger?.length === 0 ? (
                        <p className="p-3 text-stone-400 text-center">No wallet transactions</p>
                      ) : (
                        detailData.walletLedger?.map((tx: any) => (
                          <div key={tx._id} className="p-2.5 flex items-center justify-between">
                            <div>
                              <p className="font-medium">{tx.reason}</p>
                              <p className="text-[10px] text-stone-400">
                                {new Date(tx.createdAt).toLocaleDateString("en-IN")} • {tx.type}
                              </p>
                            </div>
                            <span
                              className={`font-semibold ${
                                tx.type === "CREDIT" || tx.type === "REFUND"
                                  ? "text-emerald-700"
                                  : "text-blue-700"
                              }`}
                            >
                              {tx.type === "CREDIT" || tx.type === "REFUND" ? "+" : "-"}
                              {formatINR(tx.amount)}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
