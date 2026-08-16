/**
 * AnalyticsDashboard — Mobile-first optimized + consistent theming
 */
import { lazy, Suspense } from "react";
import { useAnalytics } from "../hooks/useAnalytics";
import { useWallet } from "../hooks/use-wallet";
import { BarChart3, RefreshCw } from "lucide-react";

const SpendingChart     = lazy(() => import("../components/Analytics/SpendingChart").then(m => ({ default: m.SpendingChart })));
const CategoryPieChart  = lazy(() => import("../components/Analytics/CategoryPieChart").then(m => ({ default: m.CategoryPieChart })));
const DebtTracker       = lazy(() => import("../components/Analytics/DebtTracker").then(m => ({ default: m.DebtTracker })));
const PaymentHeatmap    = lazy(() => import("../components/Analytics/PaymentHeatmap").then(m => ({ default: m.PaymentHeatmap })));
const TimeAnalysis      = lazy(() => import("../components/Analytics/TimeAnalysis").then(m => ({ default: m.TimeAnalysis })));
const ChartExportButton = lazy(() => import("../components/Analytics/ChartExportButton").then(m => ({ default: m.ChartExportButton })));
const DateRangePicker   = lazy(() => import("../components/Analytics/DateRangePicker").then(m => ({ default: m.DateRangePicker })));

// ── Skeleton card ────────────────────────────────────────────────────────────
interface SkeletonCardProps {
  wide?: boolean;
}
function SkeletonCard({ wide = false }: SkeletonCardProps) {
  return (
    <div
      className={`bg-card-theme border border-theme rounded-xl shadow-sm p-4 sm:p-6 overflow-hidden animate-pulse ${wide ? " col-span-full" : ""}`}
      aria-hidden="true"
    >
      <div className="h-4 w-1/3 bg-muted-theme/30 rounded mb-4" />
      <div className="w-full bg-muted-theme/20 rounded" style={{ aspectRatio: "16/7" }} />
    </div>
  );
}

// ── Chart card ───────────────────────────────────────────────────────────────
interface ChartCardProps {
  id: string;
  filename: string;
  children: React.ReactNode;
  wide?: boolean;
}
function ChartCard({ id, filename, children, wide = false }: ChartCardProps) {
  return (
    <div className={`bg-card-theme border border-theme rounded-xl shadow-sm p-4 sm:p-6 overflow-hidden ${wide ? " col-span-full" : ""}`}>
      <div className="flex justify-end min-h-[2rem] mb-2">
        <Suspense fallback={null}>
          <ChartExportButton targetId={id} filename={filename} />
        </Suspense>
      </div>
      <Suspense fallback={<div className="w-full bg-muted-theme/20 rounded" style={{ aspectRatio: "16/7" }} aria-busy="true" />}>
        {children}
      </Suspense>
    </div>
  );
}

// ── Main dashboard ───────────────────────────────────────────────────────────
export default function AnalyticsDashboard() {
  const { publicKey } = useWallet();
  const { data, source, loading, error, dateRange, setDateRange, refetch } = useAnalytics("hybrid", publicKey ?? undefined);

  // ── Loading state ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <main
        className="min-h-dvh bg-theme px-[clamp(0.75rem,4vw,1.5rem)] py-[clamp(1rem,3vw,1.5rem)] [padding-top:calc(clamp(1rem,3vw,1.5rem)+env(safe-area-inset-top))] [padding-right:calc(clamp(0.75rem,4vw,1.5rem)+env(safe-area-inset-right))] [padding-bottom:calc(clamp(1rem,3vw,1.5rem)+env(safe-area-inset-bottom))] [padding-left:calc(clamp(0.75rem,4vw,1.5rem)+env(safe-area-inset-left))]"
        aria-label="Analytics dashboard loading"
      >
        <div className="max-w-7xl mx-auto">
          <header className="mb-[clamp(1.25rem,4vw,2rem)]">
            <h1 className="text-[clamp(1.375rem,5vw,1.875rem)] font-bold leading-tight text-theme">
              Analytics
            </h1>
            <p className="text-sm text-muted-theme mt-0.5" aria-live="polite">
              Loading your insights…
            </p>
          </header>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-6">
            <SkeletonCard wide />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard wide />
            <SkeletonCard wide />
          </div>
        </div>
      </main>
    );
  }

  // ── Error state ────────────────────────────────────────────────────────────
  if (error) {
    return (
      <main
        className="min-h-dvh bg-theme px-[clamp(0.75rem,4vw,1.5rem)] py-[clamp(1rem,3vw,1.5rem)] [padding-top:calc(clamp(1rem,3vw,1.5rem)+env(safe-area-inset-top))] [padding-right:calc(clamp(0.75rem,4vw,1.5rem)+env(safe-area-inset-right))] [padding-bottom:calc(clamp(1rem,3vw,1.5rem)+env(safe-area-inset-bottom))] [padding-left:calc(clamp(0.75rem,4vw,1.5rem)+env(safe-area-inset-left))]"
        aria-label="Analytics dashboard error"
      >
        <div className="max-w-7xl mx-auto">
          <div
            className="bg-card-theme border border-theme rounded-xl p-[clamp(1.5rem,5vw,2.5rem)] text-center flex flex-col items-center gap-4"
            role="alert"
          >
            <p className="text-red-500 dark:text-red-400 text-[0.9375rem]">{error}</p>
            <button
              onClick={refetch}
              className="inline-flex items-center justify-center min-h-[2.75rem] px-6 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-[0.9375rem] font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 focus-visible:outline-offset-[3px] active:scale-[0.97] [-webkit-tap-highlight-color:transparent]"
            >
              Try again
            </button>
          </div>
        </div>
      </main>
    );
  }

  if (!data) return null;

  return (
    <main
      className="min-h-dvh bg-theme [padding-top:calc(clamp(1rem,3vw,1.5rem)+env(safe-area-inset-top))] [padding-right:calc(clamp(0.75rem,4vw,1.5rem)+env(safe-area-inset-right))] [padding-bottom:calc(clamp(1rem,3vw,1.5rem)+env(safe-area-inset-bottom))] [padding-left:calc(clamp(0.75rem,4vw,1.5rem)+env(safe-area-inset-left))]"
      aria-label="Analytics dashboard"
    >
      <div className="max-w-7xl mx-auto">
        <header className="flex flex-col gap-4 mb-[clamp(1.25rem,4vw,2rem)] sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div
              className="flex items-center justify-center bg-blue-500 rounded-lg w-10 h-10 shrink-0"
              aria-hidden="true"
            >
              <BarChart3 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-[clamp(1.375rem,5vw,1.875rem)] font-bold leading-tight text-theme">
                Analytics
              </h1>
              <p className="text-sm text-muted-theme mt-0.5">
                Your spending insights and patterns
              </p>
              {source ? (
                <p className="text-xs text-muted-theme mt-1">
                  Source: {source === "live" ? "Live API" : "Fixture fallback"}
                </p>
              ) : null}
            </div>
          </div>

          {/* Right: date picker + refresh */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="flex-1 sm:flex-none">
              <Suspense fallback={<div className="h-[2.75rem] bg-muted-theme/30 rounded-lg animate-pulse" aria-busy="true" />}>
                <DateRangePicker value={dateRange} onChange={setDateRange} />
              </Suspense>
            </div>

            <button
              onClick={refetch}
              className="inline-flex items-center justify-center gap-1.5 min-h-[2.75rem] min-w-[2.75rem] px-3 rounded-lg border border-theme bg-card-theme text-muted-theme text-sm cursor-pointer transition-colors hover:bg-theme/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 focus-visible:outline-offset-[2px] active:scale-[0.97] select-none [-webkit-tap-highlight-color:transparent] whitespace-nowrap"
              aria-label="Refresh data"
              title="Refresh data"
            >
              <RefreshCw className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span className="sm:hidden">Refresh</span>
            </button>
          </div>
        </header>

        {/* ── Charts Grid ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-6">
          <ChartCard id="spending-chart" filename="spending-trends" wide>
            <SpendingChart data={data.spendingTrends} />
          </ChartCard>

          <ChartCard id="category-pie-chart" filename="category-breakdown">
            <CategoryPieChart data={data.categoryBreakdown} />
          </ChartCard>

          <ChartCard id="debt-tracker" filename="debt-tracker">
            <DebtTracker data={data.debtBalances} />
          </ChartCard>

          {/* Heatmap */}
          <div className="col-span-full">
            <div className="bg-card-theme border border-theme rounded-xl shadow-sm p-4 sm:p-6 overflow-hidden">
              <div className="flex justify-end min-h-[2rem] mb-2">
                <Suspense fallback={null}>
                  <ChartExportButton targetId="payment-heatmap" filename="payment-activity" />
                </Suspense>
              </div>
              <div
                className="overflow-x-auto [-webkit-overflow-scrolling:touch] [scroll-snap-type:x_proximity] pb-2 outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 focus-visible:outline-offset-[2px] focus-visible:rounded-md [mask-image:linear-gradient(to_right,transparent_0,black_1.5rem,black_calc(100%-1.5rem),transparent_100%)] [-webkit-mask-image:linear-gradient(to_right,transparent_0,black_1.5rem,black_calc(100%-1.5rem),transparent_100%)]"
                role="region"
                aria-label="Payment heatmap (scroll horizontally)"
                tabIndex={0}
              >
                <div className="min-w-[36rem]">
                  <Suspense fallback={<div className="w-full bg-muted-theme/20 rounded" style={{ aspectRatio: "16/7" }} aria-busy="true" />}>
                    <PaymentHeatmap data={data.heatmapData} />
                  </Suspense>
                </div>
              </div>
            </div>
          </div>

          <ChartCard id="time-analysis" filename="time-analysis" wide>
            <TimeAnalysis data={data.timeDistribution} />
          </ChartCard>
        </div>
      </div>
    </main>
  );
}