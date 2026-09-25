import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import { formatINR } from "@/lib/store";
import {
  TrendingUp,
  Users,
  Eye,
  ShoppingCart,
  CreditCard,
  PackageCheck,
  RefreshCw,
  Smartphone,
  Laptop,
  Tablet,
  Globe,
  ArrowRight,
  ArrowDown,
  Layers,
  ShoppingBag,
  Info,
  Calendar,
  IndianRupee,
  CheckCircle2,
  AlertTriangle,
  Mail,
} from "lucide-react";
import { toast } from "sonner";

type DateRange = "today" | "7d" | "30d" | "this_month" | "last_month";

interface IOverviewData {
  range: { startDateStr: string; endDateStr: string };
  kpis: {
    uniqueVisitors: number;
    pageViews: number;
    productViews: number;
    cartAdds: number;
    checkoutStarts: number;
    ordersPlaced: number;
    paidOrders: number;
    grossRevenue: number;
    aov: number;
    conversionRates: {
      visitorToPurchaseRate: number | null;
      productViewToCartRate: number | null;
      checkoutToPurchaseRate: number | null;
    };
  };
  abandonedCart: {
    totalCaptured: number;
    activeCheckouts: number;
    abandonedCheckouts: number;
    recoveredCheckouts: number;
    capturedAbandonmentRate: number | null;
    recoveryEmailsSent: number;
    recoveryRate: number | null;
    recoveredRevenue: number;
  };
}

interface IFunnelData {
  stages: { key: string; label: string; count: number }[];
  dropoffs: {
    visitorToProductView: number | null;
    productViewToCart: number | null;
    cartToCheckout: number | null;
    checkoutToPaid: number | null;
  };
}

interface ITrendItem {
  date: string;
  visitors: number;
  pageViews: number;
  productViews: number;
  cartAdds: number;
  checkoutStarts: number;
  orders: number;
  revenue: number;
}

interface IProductPerformanceItem {
  productId: string;
  name: string;
  image: string;
  category: string;
  price: number;
  stock: number;
  views: number;
  uniqueViews?: number;
  cartAdds: number;
  unitsSold: number;
  purchasingOrders?: number;
  revenue: number;
  viewToCartRate: number | null;
  conversionRate: number | null;
}

interface ISourcesData {
  sources: {
    name: string;
    count: number;
    visitors?: number;
    orders?: number;
    revenue?: number;
    conversionRate?: number | null;
    percentage: number;
  }[];
  mediums: { name: string; count: number; percentage: number }[];
  campaigns: { name: string; count: number; percentage: number }[];
}

interface IDevicesData {
  total: number;
  devices: {
    device: string;
    label: string;
    count: number;
    visitors?: number;
    orders?: number;
    revenue?: number;
    conversionRate?: number | null;
    percentage: number;
  }[];
}

interface IAbandonedDetails {
  totalCaptured: number;
  activeCount: number;
  abandonedCount: number;
  recoveredCount: number;
  cancelledCount: number;
  abandonedTotal: number;
  recoveredTotal: number;
  capturedAbandonmentRate: number | null;
  totalRecoveryEmails: number;
  emailRecoveryRate: number | null;
  modalDismissedCount: number;
  recentAbandoned: {
    sessionId: string;
    name: string;
    itemsCount: number;
    total: number;
    abandonedAt?: string;
    recoverySentCount: number;
    razorpayDismissed: boolean;
  }[];
}

export function ConversionAnalyticsPanel() {
  const [range, setRange] = useState<DateRange>("7d");
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<IOverviewData | null>(null);
  const [funnel, setFunnel] = useState<IFunnelData | null>(null);
  const [trends, setTrends] = useState<ITrendItem[]>([]);
  const [products, setProducts] = useState<IProductPerformanceItem[]>([]);
  const [sources, setSources] = useState<ISourcesData | null>(null);
  const [devices, setDevices] = useState<IDevicesData | null>(null);
  const [abandoned, setAbandoned] = useState<IAbandonedDetails | null>(null);
  const [productSearch, setProductSearch] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [ovRes, fnRes, trRes, prRes, scRes, dvRes, abRes] = await Promise.allSettled([
        api<IOverviewData>(`/admin/analytics/overview?range=${range}`),
        api<IFunnelData>(`/admin/analytics/funnel?range=${range}`),
        api<{ trends: ITrendItem[] }>(`/admin/analytics/trends?range=${range}`),
        api<{ products: IProductPerformanceItem[] }>(`/admin/analytics/products?range=${range}`),
        api<ISourcesData>(`/admin/analytics/sources?range=${range}`),
        api<IDevicesData>(`/admin/analytics/devices?range=${range}`),
        api<IAbandonedDetails>(`/admin/analytics/abandoned?range=${range}`),
      ]);

      if (ovRes.status === "fulfilled") setOverview(ovRes.value);
      if (fnRes.status === "fulfilled") setFunnel(fnRes.value);
      if (trRes.status === "fulfilled") setTrends(trRes.value?.trends || []);
      if (prRes.status === "fulfilled") setProducts(prRes.value?.products || []);
      if (scRes.status === "fulfilled") setSources(scRes.value);
      if (dvRes.status === "fulfilled") setDevices(dvRes.value);
      if (abRes.status === "fulfilled") setAbandoned(abRes.value);
    } catch {
      toast.error("Failed to load conversion analytics data");
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const kpis = overview?.kpis;
  const rates = kpis?.conversionRates;

  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
      p.category.toLowerCase().includes(productSearch.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header and Date Range Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-stone-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <TrendingUp className="h-6 w-6 text-[#166F77]" />
            <h1 className="text-xl font-bold font-serif text-stone-900">Conversion Analytics</h1>
          </div>
          <p className="text-xs text-stone-500 mt-1">
            Privacy-safe storefront visitor telemetry, micro-conversions & funnel drop-offs
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex rounded-lg border border-stone-200 p-1 bg-stone-50 text-xs">
            {(
              [
                ["today", "Today"],
                ["7d", "Last 7 Days"],
                ["30d", "Last 30 Days"],
                ["this_month", "This Month"],
                ["last_month", "Last Month"],
              ] as [DateRange, string][]
            ).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setRange(key)}
                className={`px-3 py-1.5 rounded-md font-medium transition ${
                  range === key
                    ? "bg-white text-stone-900 shadow-xs font-semibold"
                    : "text-stone-600 hover:text-stone-900"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-stone-200 rounded-lg hover:bg-stone-50 text-stone-700 transition"
            title="Refresh Data"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin text-stone-500" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Top Line KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-xs">
          <div className="flex items-center justify-between text-stone-500 mb-1">
            <span className="text-xs font-medium">Unique Visitors</span>
            <Users className="h-4 w-4 text-blue-600" />
          </div>
          <div className="text-xl font-bold text-stone-900">
            {kpis?.uniqueVisitors?.toLocaleString() ?? "0"}
          </div>
          <div className="text-[10px] text-stone-400 mt-1">{kpis?.pageViews?.toLocaleString() ?? "0"} pageviews</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-xs">
          <div className="flex items-center justify-between text-stone-500 mb-1">
            <span className="text-xs font-medium">Product Views</span>
            <Eye className="h-4 w-4 text-indigo-600" />
          </div>
          <div className="text-xl font-bold text-stone-900">
            {kpis?.productViews?.toLocaleString() ?? "0"}
          </div>
          <div className="text-[10px] text-stone-400 mt-1">Item impressions</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-xs">
          <div className="flex items-center justify-between text-stone-500 mb-1">
            <span className="text-xs font-medium">Add to Cart</span>
            <ShoppingCart className="h-4 w-4 text-amber-600" />
          </div>
          <div className="text-xl font-bold text-stone-900">
            {kpis?.cartAdds?.toLocaleString() ?? "0"}
          </div>
          <div className="text-[10px] text-stone-500 mt-1">
            {rates && rates.productViewToCartRate !== null
              ? `${rates.productViewToCartRate}% view-to-cart`
              : "Unavailable"}
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-xs">
          <div className="flex items-center justify-between text-stone-500 mb-1">
            <span className="text-xs font-medium">Checkout Starts</span>
            <Layers className="h-4 w-4 text-purple-600" />
          </div>
          <div className="text-xl font-bold text-stone-900">
            {kpis?.checkoutStarts?.toLocaleString() ?? "0"}
          </div>
          <div className="text-[10px] text-stone-400 mt-1">Funnel stage 4</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-xs">
          <div className="flex items-center justify-between text-stone-500 mb-1">
            <span className="text-xs font-medium">Paid Orders</span>
            <PackageCheck className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="text-xl font-bold text-emerald-700">
            {kpis?.paidOrders?.toLocaleString() ?? "0"}
          </div>
          <div className="text-[10px] text-stone-400 mt-1">{kpis?.ordersPlaced ?? 0} total placed</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-xs">
          <div className="flex items-center justify-between text-stone-500 mb-1">
            <span className="text-xs font-medium">Conversion Rate</span>
            <TrendingUp className="h-4 w-4 text-[#166F77]" />
          </div>
          <div className="text-xl font-bold text-[#166F77]">
            {rates && rates.visitorToPurchaseRate !== null
              ? `${rates.visitorToPurchaseRate}%`
              : "Unavailable"}
          </div>
          <div className="text-[10px] text-stone-400 mt-1">Visitor → Paid Sale</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-xs">
          <div className="flex items-center justify-between text-stone-500 mb-1">
            <span className="text-xs font-medium">Gross Revenue</span>
            <IndianRupee className="h-4 w-4 text-stone-700" />
          </div>
          <div className="text-xl font-bold text-stone-900 truncate">
            {formatINR(kpis?.grossRevenue ?? 0)}
          </div>
          <div className="text-[10px] text-stone-400 mt-1">Paid sales only</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-xs">
          <div className="flex items-center justify-between text-stone-500 mb-1">
            <span className="text-xs font-medium">Average Order</span>
            <CreditCard className="h-4 w-4 text-teal-600" />
          </div>
          <div className="text-xl font-bold text-stone-900 truncate">
            {formatINR(kpis?.aov ?? 0)}
          </div>
          <div className="text-[10px] text-stone-400 mt-1">AOV per paid order</div>
        </div>
      </div>

      {/* Conversion Funnel Visualization */}
      <div className="bg-white p-5 rounded-xl border border-stone-200 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-bold text-stone-900 uppercase tracking-wider flex items-center gap-1.5">
              <Layers className="h-4 w-4 text-[#166F77]" />
              Storefront Conversion Funnel
            </h2>
            <p className="text-xs text-stone-500">
              Progression from discovery to completed transaction across each critical stage
            </p>
          </div>
          <div className="text-xs font-medium text-stone-500">
            Overall Conversion:{" "}
            <span className="font-bold text-[#166F77]">
              {rates && rates.visitorToPurchaseRate !== null
                ? `${rates.visitorToPurchaseRate}%`
                : "Unavailable"}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 pt-2">
          {funnel?.stages?.map((stage, idx) => {
            const maxVal = Math.max(...(funnel.stages.map((s) => s.count) || [1]), 1);
            const pctOfTop = Math.round((stage.count / maxVal) * 100);

            let dropText: string | null = null;
            if (idx === 1 && funnel.dropoffs.visitorToProductView !== null) {
              dropText = `${funnel.dropoffs.visitorToProductView}% drop`;
            } else if (idx === 2 && funnel.dropoffs.productViewToCart !== null) {
              dropText = `${funnel.dropoffs.productViewToCart}% drop`;
            } else if (idx === 3 && funnel.dropoffs.cartToCheckout !== null) {
              dropText = `${funnel.dropoffs.cartToCheckout}% drop`;
            } else if (idx === 4 && funnel.dropoffs.checkoutToPaid !== null) {
              dropText = `${funnel.dropoffs.checkoutToPaid}% drop`;
            }

            return (
              <div key={stage.key} className="relative flex flex-col">
                <div className="bg-stone-50 p-4 rounded-xl border border-stone-200 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between text-xs text-stone-500 mb-1">
                      <span className="font-semibold text-stone-400">Step {idx + 1}</span>
                      {dropText && (
                        <span className="text-[11px] font-semibold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-100 flex items-center gap-0.5">
                          <ArrowDown className="h-3 w-3" />
                          {dropText}
                        </span>
                      )}
                    </div>
                    <div className="font-serif text-sm font-bold text-stone-800">{stage.label}</div>
                    <div className="text-2xl font-bold text-stone-900 mt-2">
                      {stage.count.toLocaleString()}
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-stone-200/60">
                    <div className="flex items-center justify-between text-[11px] text-stone-500 mb-1">
                      <span>Funnel share</span>
                      <span className="font-medium text-stone-700">{pctOfTop}%</span>
                    </div>
                    <div className="w-full bg-stone-200 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-[#166F77] h-1.5 rounded-full transition-all duration-500"
                        style={{ width: `${pctOfTop}%` }}
                      />
                    </div>
                  </div>
                </div>

                {idx < (funnel?.stages?.length ?? 0) - 1 && (
                  <div className="hidden md:flex absolute -right-3 top-1/2 -translate-y-1/2 z-10 w-6 h-6 rounded-full bg-white border border-stone-200 items-center justify-center text-stone-400 shadow-xs">
                    <ArrowRight className="h-3.5 w-3.5" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Daily Performance Trend Chart & Breakdown */}
      <div className="bg-white p-5 rounded-xl border border-stone-200 shadow-xs">
        <h2 className="text-sm font-bold text-stone-900 uppercase tracking-wider mb-3">
          Daily Conversion Trends
        </h2>
        {trends.length === 0 ? (
          <div className="text-xs text-stone-400 py-6 text-center">No trend data for this period.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-stone-50 text-stone-500 font-semibold border-b border-stone-200">
                <tr>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3 text-right">Unique Visitors</th>
                  <th className="py-2.5 px-3 text-right">Page Views</th>
                  <th className="py-2.5 px-3 text-right">Product Views</th>
                  <th className="py-2.5 px-3 text-right">Cart Adds</th>
                  <th className="py-2.5 px-3 text-right">Checkout Starts</th>
                  <th className="py-2.5 px-3 text-right">Paid Orders</th>
                  <th className="py-2.5 px-3 text-right">Revenue</th>
                  <th className="py-2.5 px-3 text-right">Daily Conversion</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {trends.map((t) => {
                  const dailyConv =
                    t.visitors > 0 ? `${((t.orders / t.visitors) * 100).toFixed(1)}%` : "-";
                  return (
                    <tr key={t.date} className="hover:bg-stone-50/50">
                      <td className="py-2.5 px-3 font-medium text-stone-900">{t.date}</td>
                      <td className="py-2.5 px-3 text-right text-stone-700">{t.visitors.toLocaleString()}</td>
                      <td className="py-2.5 px-3 text-right text-stone-500">{t.pageViews.toLocaleString()}</td>
                      <td className="py-2.5 px-3 text-right text-stone-700">{t.productViews.toLocaleString()}</td>
                      <td className="py-2.5 px-3 text-right text-stone-700">{t.cartAdds.toLocaleString()}</td>
                      <td className="py-2.5 px-3 text-right text-stone-700">{t.checkoutStarts.toLocaleString()}</td>
                      <td className="py-2.5 px-3 text-right font-semibold text-emerald-700">{t.orders}</td>
                      <td className="py-2.5 px-3 text-right font-medium text-stone-900">{formatINR(t.revenue)}</td>
                      <td className="py-2.5 px-3 text-right font-bold text-[#166F77]">{dailyConv}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Two Column Grid: Traffic Sources & Device Classification */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Traffic Sources */}
        <div className="bg-white p-5 rounded-xl border border-stone-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Globe className="h-4 w-4 text-[#166F77]" />
              <h2 className="text-sm font-bold text-stone-900 uppercase tracking-wider">
                Traffic & Campaign Attribution
              </h2>
            </div>
            <p className="text-xs text-stone-500 mb-4">
              Breakdown by marketing sources, campaign mediums, and UTM tags
            </p>

            <div className="space-y-4">
              <div>
                <span className="text-xs font-bold text-stone-700 block mb-2">Top Sources</span>
                {(!sources?.sources || sources.sources.length === 0) ? (
                  <div className="text-xs text-stone-400 py-2">No traffic source data available</div>
                ) : (
                  <div className="space-y-2">
                    {sources.sources.slice(0, 6).map((src) => (
                      <div key={src.name} className="flex items-center justify-between text-xs">
                        <span className="font-medium text-stone-800 capitalize truncate max-w-[150px]">
                          {src.name === "direct" ? "Direct / None" : src.name}
                        </span>
                        <div className="flex items-center gap-3">
                          <span className="text-stone-500">{(src.visitors ?? src.count).toLocaleString()} visits</span>
                          <span className="text-stone-600 font-medium">
                            {src.orders ?? 0} orders
                            {src.conversionRate !== null && src.conversionRate !== undefined ? ` (${src.conversionRate}%)` : ""}
                          </span>
                          <span className="font-semibold text-stone-900 w-10 text-right">
                            {src.percentage}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {sources?.campaigns && sources.campaigns.length > 0 && (
                <div className="pt-3 border-t border-stone-100">
                  <span className="text-xs font-bold text-stone-700 block mb-2">Campaigns</span>
                  <div className="space-y-2">
                    {sources.campaigns.slice(0, 4).map((c) => (
                      <div key={c.name} className="flex items-center justify-between text-xs">
                        <span className="font-medium text-stone-800 truncate max-w-[200px]">
                          {c.name}
                        </span>
                        <span className="text-stone-500">{c.count} clicks ({c.percentage}%)</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Device Categories */}
        <div className="bg-white p-5 rounded-xl border border-stone-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Smartphone className="h-4 w-4 text-[#166F77]" />
              <h2 className="text-sm font-bold text-stone-900 uppercase tracking-wider">
                Device Categories
              </h2>
            </div>
            <p className="text-xs text-stone-500 mb-4">
              Visitor distribution across mobile, desktop, and tablet devices
            </p>

            <div className="space-y-4">
              {devices?.devices?.map((d) => {
                const Icon =
                  d.device === "mobile"
                    ? Smartphone
                    : d.device === "desktop"
                    ? Laptop
                    : Tablet;

                return (
                  <div key={d.device} className="p-3 rounded-lg border border-stone-100 bg-stone-50">
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-stone-600" />
                        <span className="font-semibold text-stone-900">{d.label}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-stone-500">{(d.visitors ?? d.count).toLocaleString()} visits</span>
                        <span className="text-stone-600 font-medium">
                          {d.orders ?? 0} orders
                          {d.conversionRate !== null && d.conversionRate !== undefined ? ` (${d.conversionRate}%)` : ""}
                        </span>
                        <span className="font-bold text-stone-900 w-10 text-right">{d.percentage}%</span>
                      </div>
                    </div>
                    <div className="w-full bg-stone-200 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-[#166F77] h-2 rounded-full transition-all duration-500"
                        style={{ width: `${d.percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Product Performance Table */}
      <div className="bg-white p-5 rounded-xl border border-stone-200 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-sm font-bold text-stone-900 uppercase tracking-wider">
              Product Performance & Conversion
            </h2>
            <p className="text-xs text-stone-500">
              Views, cart adds, sales volume, and conversion rates per item
            </p>
          </div>
          <input
            type="text"
            placeholder="Search product..."
            value={productSearch}
            onChange={(e) => setProductSearch(e.target.value)}
            className="h-8 px-3 text-xs border border-stone-200 rounded-lg focus:outline-none focus:border-[#166F77] w-full sm:w-56"
          />
        </div>

        {filteredProducts.length === 0 ? (
          <div className="text-xs text-stone-400 py-8 text-center">No product performance data found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-stone-50 text-stone-500 font-semibold border-b border-stone-200">
                <tr>
                  <th className="py-2.5 px-3">Product</th>
                  <th className="py-2.5 px-3">Category</th>
                  <th className="py-2.5 px-3 text-right">Price</th>
                  <th className="py-2.5 px-3 text-right">Views</th>
                  <th className="py-2.5 px-3 text-right">Unique Viewers</th>
                  <th className="py-2.5 px-3 text-right">Cart Adds</th>
                  <th className="py-2.5 px-3 text-right">View-to-Cart %</th>
                  <th className="py-2.5 px-3 text-right">Units Sold</th>
                  <th className="py-2.5 px-3 text-right">Orders</th>
                  <th className="py-2.5 px-3 text-right">Revenue</th>
                  <th className="py-2.5 px-3 text-right">Viewer-to-Purchase %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filteredProducts.map((p) => (
                  <tr key={p.productId} className="hover:bg-stone-50/50">
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-2">
                        {p.image ? (
                          <img
                            src={p.image}
                            alt=""
                            className="w-8 h-8 rounded-md object-cover border border-stone-100"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-md bg-stone-100 flex items-center justify-center text-stone-400">
                            <ShoppingBag className="h-4 w-4" />
                          </div>
                        )}
                        <span className="font-medium text-stone-900 truncate max-w-[200px]" title={p.name}>
                          {p.name}
                        </span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-stone-500">{p.category || "-"}</td>
                    <td className="py-2.5 px-3 text-right font-medium text-stone-800">{formatINR(p.price)}</td>
                    <td className="py-2.5 px-3 text-right text-stone-700">{p.views.toLocaleString()}</td>
                    <td className="py-2.5 px-3 text-right text-stone-700">{(p.uniqueViews ?? p.views).toLocaleString()}</td>
                    <td className="py-2.5 px-3 text-right text-stone-700">{p.cartAdds.toLocaleString()}</td>
                    <td className="py-2.5 px-3 text-right font-medium text-stone-900">
                      {p.viewToCartRate !== null ? `${p.viewToCartRate}%` : "-"}
                    </td>
                    <td className="py-2.5 px-3 text-right font-medium text-stone-800">{p.unitsSold}</td>
                    <td className="py-2.5 px-3 text-right font-bold text-emerald-700">{p.purchasingOrders ?? p.unitsSold}</td>
                    <td className="py-2.5 px-3 text-right font-semibold text-stone-900">{formatINR(p.revenue)}</td>
                    <td className="py-2.5 px-3 text-right font-bold text-[#166F77]">
                      {p.conversionRate !== null ? `${p.conversionRate}%` : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Captured Abandoned Checkout Performance Section */}
      <div className="bg-white p-5 rounded-xl border border-stone-200 shadow-xs">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            <h2 className="text-sm font-bold text-stone-900 uppercase tracking-wider">
              Captured Checkout Abandonment & Recovery
            </h2>
          </div>
          <span className="text-xs bg-amber-50 text-amber-800 font-semibold px-2.5 py-1 rounded-full border border-amber-200">
            Authoritative CheckoutSession Data
          </span>
        </div>

        <div className="flex items-start gap-2 bg-amber-50/50 p-3 rounded-lg border border-amber-200/60 mb-5 text-xs text-amber-900">
          <Info className="h-4 w-4 shrink-0 text-amber-700 mt-0.5" />
          <span>
            <strong>Note:</strong> Captured Abandonment Rate reflects shoppers who reached checkout and entered their email or phone. Visitors who added products to cart but never entered checkout contact details are not stored as captured sessions.
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
          <div className="p-3 bg-stone-50 rounded-lg border border-stone-200">
            <span className="text-xs text-stone-500 block">Captured Sessions</span>
            <span className="text-lg font-bold text-stone-900">{abandoned?.totalCaptured ?? 0}</span>
          </div>
          <div className="p-3 bg-stone-50 rounded-lg border border-stone-200">
            <span className="text-xs text-stone-500 block">Active In Checkout</span>
            <span className="text-lg font-bold text-blue-700">{abandoned?.activeCount ?? 0}</span>
          </div>
          <div className="p-3 bg-stone-50 rounded-lg border border-stone-200">
            <span className="text-xs text-stone-500 block">Abandoned</span>
            <span className="text-lg font-bold text-amber-700">{abandoned?.abandonedCount ?? 0}</span>
          </div>
          <div className="p-3 bg-stone-50 rounded-lg border border-stone-200">
            <span className="text-xs text-stone-500 block">Recovered</span>
            <span className="text-lg font-bold text-emerald-700">{abandoned?.recoveredCount ?? 0}</span>
          </div>
          <div className="p-3 bg-stone-50 rounded-lg border border-stone-200">
            <span className="text-xs text-stone-500 block">Abandonment Rate</span>
            <span className="text-lg font-bold text-stone-900">
              {abandoned?.capturedAbandonmentRate !== null ? `${abandoned?.capturedAbandonmentRate}%` : "Unavailable"}
            </span>
          </div>
          <div className="p-3 bg-stone-50 rounded-lg border border-stone-200">
            <span className="text-xs text-stone-500 block">Recovery Emails Sent</span>
            <span className="text-lg font-bold text-purple-700">{abandoned?.totalRecoveryEmails ?? 0}</span>
          </div>
          <div className="p-3 bg-stone-50 rounded-lg border border-stone-200">
            <span className="text-xs text-stone-500 block">Recovered Revenue</span>
            <span className="text-lg font-bold text-emerald-800">{formatINR(abandoned?.recoveredTotal ?? 0)}</span>
          </div>
        </div>

        {/* Recent Abandoned Sessions */}
        {abandoned?.recentAbandoned && abandoned.recentAbandoned.length > 0 && (
          <div>
            <h3 className="text-xs font-bold text-stone-800 mb-2">Recent Captured Abandoned Sessions</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-stone-50 text-stone-500 font-semibold border-b border-stone-200">
                  <tr>
                    <th className="py-2 px-3">Session ID</th>
                    <th className="py-2 px-3">Customer</th>
                    <th className="py-2 px-3 text-right">Items</th>
                    <th className="py-2 px-3 text-right">Cart Total</th>
                    <th className="py-2 px-3 text-center">Razorpay Closed?</th>
                    <th className="py-2 px-3 text-center">Recovery Emails</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {abandoned.recentAbandoned.map((s) => (
                    <tr key={s.sessionId} className="hover:bg-stone-50/50">
                      <td className="py-2 px-3 font-mono text-[11px] text-stone-500 truncate max-w-[150px]">
                        {s.sessionId}
                      </td>
                      <td className="py-2 px-3 font-medium text-stone-900">{s.name}</td>
                      <td className="py-2 px-3 text-right text-stone-700">{s.itemsCount}</td>
                      <td className="py-2 px-3 text-right font-semibold text-stone-900">{formatINR(s.total)}</td>
                      <td className="py-2 px-3 text-center">
                        {s.razorpayDismissed ? (
                          <span className="text-[10px] bg-rose-50 text-rose-700 px-2 py-0.5 rounded-full border border-rose-200 font-medium">
                            Modal Dismissed
                          </span>
                        ) : (
                          <span className="text-stone-400">-</span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-center font-medium text-stone-700">
                        {s.recoverySentCount > 0 ? (
                          <span className="text-[10px] bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full border border-purple-200">
                            {s.recoverySentCount} sent
                          </span>
                        ) : (
                          <span className="text-stone-400">0</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
