import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { SplitTimeline } from "../components/SplitHistory/SplitTimeline";
import {
  HistoryFilters,
  type FiltersState,
} from "../components/SplitHistory/HistoryFilters";
import { HistorySummary } from "../components/SplitHistory/HistorySummary";
import { formatCurrency } from "../utils/format";
import {
  getSplitHistoryRepository,
  type HistorySplit,
  type SplitStatus,
} from "../services/splitHistoryRepository";
import { exportHistoryCsv } from "../utils/exportHistoryCsv";

function useSplitHistory() {
  const [splits, setSplits] = useState<HistorySplit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error] = useState<string | null>(null);
  const [source, setSource] = useState<"api" | "fixture">("api");

  useEffect(() => {
    let mounted = true;
    async function fetchData() {
      setLoading(true);
      try {
        const result = await getSplitHistoryRepository().list();
        if (mounted) {
          setSplits(result.data);
          setSource(result.source);
        }
      } catch {
        if (mounted) setSource("fixture");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    fetchData();
    return () => {
      mounted = false;
    };
  }, []);

  return { splits, loading, error, source };
}

export default function SplitHistoryPage() {
  const { t } = useTranslation();
  const repository = getSplitHistoryRepository();

const [splits, setSplits] = useState<HistorySplit[]>([]);
const [loading, setLoading] = useState(true);
const [source, setSource] = useState<"api" | "fixture">("api");

const [searchParams, setSearchParams] = useSearchParams();
  const [filters, setFilters] = useState<FiltersState>({
    statuses: new Set<SplitStatus>(["active", "completed", "cancelled"]),
    role: "all",
    search: "",
    sort: "date-desc",
  });
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const filtered = useMemo(() => {
    const byStatus = splits.filter((s) => filters.statuses.has(s.status));
    const byRole =
      filters.role === "all"
        ? byStatus
        : byStatus.filter((s) => s.role === filters.role);
    const search = filters.search.trim().toLowerCase();
    const bySearch = !search
      ? byRole
      : byRole.filter((s) => {
          const selfMatch = (p: (typeof s.participants)[0]) => {
            if (p.name === "You") {
              return (
                t("common.you").toLowerCase().includes(search) ||
                p.name.toLowerCase().includes(search)
              );
            }
            return p.name.toLowerCase().includes(search);
          };
          return (
            s.title.toLowerCase().includes(search) || s.participants.some(selfMatch)
          );
        });

    const sorted = [...bySearch].sort((a, b) => {
      switch (filters.sort) {
        case "date-asc":
          return new Date(a.date).getTime() - new Date(b.date).getTime();
        case "date-desc":
          return new Date(b.date).getTime() - new Date(a.date).getTime();
        case "amount-asc":
          return a.totalAmount - b.totalAmount;
        case "amount-desc":
          return b.totalAmount - a.totalAmount;
        case "status":
          return a.status.localeCompare(b.status);
        default:
          return 0;
      }
    });

    return sorted;
  }, [splits, filters, t]);

  useEffect(() => {
    setPage(1);
  }, [filters.search, filters.role, filters.sort, filters.statuses]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageItems = filtered.slice((page - 1) * pageSize, page * pageSize);

  const summary = useMemo(() => {
    const totalAmount = filtered.reduce((sum, s) => sum + s.totalAmount, 0);
    const counts = filtered.reduce(
      (acc, s) => {
        acc[s.status] += 1;
        return acc;
      },
      { active: 0, completed: 0, cancelled: 0 } as Record<SplitStatus, number>,
    );
    const avg = filtered.length ? totalAmount / filtered.length : 0;
    return { total: filtered.length, totalAmount, counts, avg };
  }, [filtered]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pt-6 pb-20 px-4">
      <div className="mx-auto max-w-6xl">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">{t("history.title")}</h1>
          <div className="flex items-center gap-2">
            <span className="rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-600 dark:border-gray-700 dark:text-gray-300">
              {source === "api" ? "Live data" : "Fixture data"}
            </span>
            <button
              type="button"
              onClick={() => exportHistoryCsv(filtered)}
              className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium"
            >
              {t("history.exportCsv")}
            </button>
          </div>
        </div>

        <HistoryFilters value={filters} onChange={setFilters} />

        <div className="mt-6 grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3">
            {loading ? (
              <LoadingSkeleton />
            ) : pageItems.length === 0 ? (
              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-8 text-center">
                <p className="text-gray-600 dark:text-gray-300">
                  {t("history.noSplits")}
                </p>
              </div>
            ) : (
              <SplitTimeline splits={pageItems} />
            )}

            {/* Pagination */}
            <div className="mt-6 flex items-center justify-between">
              <p className="text-sm text-gray-600 dark:text-gray-300">
                {t("history.showing", {
                  count: pageItems.length,
                  total: filtered.length,
                })}
              </p>
              <div className="flex gap-2">
                <button
                  className="px-3 py-1 rounded-md border border-gray-300 dark:border-gray-700 text-sm disabled:opacity-50"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  {t("history.prev")}
                </button>
                <span className="text-sm text-gray-700 dark:text-gray-200">
                  {t("history.pageN", { current: page, total: totalPages })}
                </span>
                <button
                  className="px-3 py-1 rounded-md border border-gray-300 dark:border-gray-700 text-sm disabled:opacity-50"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  {t("history.next")}
                </button>
              </div>
            </div>
          </div>

          <div className="lg:col-span-1">
            <HistorySummary
              total={summary.total}
              totalAmountLabel={formatCurrency(summary.totalAmount)}
              active={summary.counts.active}
              completed={summary.counts.completed}
              cancelled={summary.counts.cancelled}
              averageLabel={formatCurrency(summary.avg)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="h-24 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl animate-pulse"
        />
      ))}
    </div>
  );
}
