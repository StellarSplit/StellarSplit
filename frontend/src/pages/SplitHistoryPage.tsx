import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { History as HistoryIcon } from "lucide-react";
import { useSearchParams } from "react-router-dom";
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
  type HistoryResponse,
  type HistorySummaryData,
  type SplitRole,
  type SplitStatus,
} from "../services/splitHistoryRepository";
import { exportHistoryCsv } from "../utils/exportHistoryCsv";

const ALL_STATUSES: SplitStatus[] = ["active", "completed", "cancelled"];
const PAGE_SIZE = 20;
const SORT_OPTIONS: FiltersState["sort"][] = [
  "date-desc",
  "date-asc",
  "amount-desc",
  "amount-asc",
  "status",
];
const EMPTY_META: HistoryResponse["meta"] = {
  page: 1,
  limit: PAGE_SIZE,
  totalItems: 0,
  totalPages: 1,
  hasMore: false,
};
const EMPTY_SUMMARY: HistorySummaryData = {
  totalAmount: 0,
  average: 0,
  counts: { active: 0, completed: 0, cancelled: 0 },
};

export default function SplitHistoryPage() {
  const { t } = useTranslation();
  const repository = useMemo(() => getSplitHistoryRepository(), []);
  const [searchParams, setSearchParams] = useSearchParams();
  const queryString = searchParams.toString();
  const { filters, page } = useMemo(
    () => readHistoryState(new URLSearchParams(queryString)),
    [queryString],
  );
  const [splits, setSplits] = useState<HistorySplit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<HistoryResponse["meta"]>(EMPTY_META);
  const [summary, setSummary] = useState<HistorySummaryData>(EMPTY_SUMMARY);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);

    void repository
      .fetchHistory({
        statuses: Array.from(filters.statuses),
        role: filters.role,
        search: filters.search,
        sort: filters.sort,
        page,
        limit: PAGE_SIZE,
      })
      .then((result) => {
        if (!mounted) return;
        setSplits(result.data);
        setMeta(result.meta);
        setSummary(result.summary);
      })
      .catch((reason: unknown) => {
        if (!mounted) return;
        setSplits([]);
        setMeta(EMPTY_META);
        setSummary(EMPTY_SUMMARY);
        setError(
          reason instanceof Error ? reason.message : "Unable to load split history.",
        );
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [filters, page, repository]);

  const updateFilters = (nextFilters: FiltersState) => {
    setSearchParams(writeFilters(searchParams, nextFilters));
  };

  const updatePage = (nextPage: number) => {
    const next = new URLSearchParams(searchParams);
    if (nextPage <= 1) next.delete("page");
    else next.set("page", String(nextPage));
    setSearchParams(next);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pt-6 pb-20 px-4">
      <div className="mx-auto max-w-6xl">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">{t("history.title")}</h1>
          <div className="flex items-center gap-2">
            <span className="rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-600 dark:border-gray-700 dark:text-gray-300">
              Live data
            </span>
            <button
              type="button"
              onClick={() => exportHistoryCsv(splits)}
              className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium"
            >
              {t("history.exportCsv")}
            </button>
          </div>
        </div>

        <HistoryFilters value={filters} onChange={updateFilters} />

        <div className="mt-6 grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3">
            {error ? (
              <div
                role="alert"
                className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-xl p-8 text-center text-red-700 dark:text-red-200"
              >
                {error}
              </div>
            ) : loading ? (
              <LoadingSkeleton />
            ) : splits.length === 0 ? (
              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-8 text-center">
                <HistoryIcon
                  aria-hidden="true"
                  className="mx-auto mb-3 h-10 w-10 text-gray-400 dark:text-gray-500"
                />
                <p className="text-gray-600 dark:text-gray-300">
                  {t("history.noSplits")}
                </p>
              </div>
            ) : (
              <SplitTimeline splits={splits} />
            )}

            {/* Pagination */}
            <div className="mt-6 flex items-center justify-between">
              <p className="text-sm text-gray-600 dark:text-gray-300">
                {t("history.showing", {
                  count: splits.length,
                  total: meta.totalItems,
                })}
              </p>
              <div className="flex gap-2">
                <button
                  className="px-3 py-1 rounded-md border border-gray-300 dark:border-gray-700 text-sm disabled:opacity-50"
                  onClick={() => updatePage(Math.max(1, page - 1))}
                  disabled={page === 1}
                >
                  {t("history.prev")}
                </button>
                <span className="text-sm text-gray-700 dark:text-gray-200">
                  {t("history.pageN", { current: page, total: meta.totalPages })}
                </span>
                <button
                  className="px-3 py-1 rounded-md border border-gray-300 dark:border-gray-700 text-sm disabled:opacity-50"
                  onClick={() => updatePage(Math.min(meta.totalPages, page + 1))}
                  disabled={!meta.hasMore || page >= meta.totalPages}
                >
                  {t("history.next")}
                </button>
              </div>
            </div>
          </div>

          <div className="lg:col-span-1">
            <HistorySummary
              total={meta.totalItems}
              totalAmountLabel={formatCurrency(summary.totalAmount)}
              active={summary.counts.active}
              completed={summary.counts.completed}
              cancelled={summary.counts.cancelled}
              averageLabel={formatCurrency(summary.average)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function readHistoryState(searchParams: URLSearchParams): {
  filters: FiltersState;
  page: number;
} {
  const statusParam = searchParams.get("status");
  const statuses = new Set<SplitStatus>(
    statusParam === null
      ? ALL_STATUSES
      : statusParam
          .split(",")
          .filter((status): status is SplitStatus =>
            ALL_STATUSES.includes(status as SplitStatus),
          ),
  );
  const roleParam = searchParams.get("role");
  const role: "all" | SplitRole =
    roleParam === "creator" || roleParam === "participant" ? roleParam : "all";
  const sortParam = searchParams.get("sort");
  const sort = SORT_OPTIONS.includes(sortParam as FiltersState["sort"])
    ? (sortParam as FiltersState["sort"])
    : "date-desc";
  const parsedPage = Number.parseInt(searchParams.get("page") || "1", 10);

  return {
    filters: {
      statuses,
      role,
      search: searchParams.get("search") || "",
      sort,
    },
    page: Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1,
  };
}

function writeFilters(
  current: URLSearchParams,
  filters: FiltersState,
): URLSearchParams {
  const next = new URLSearchParams(current);
  const selectedStatuses = ALL_STATUSES.filter((status) =>
    filters.statuses.has(status),
  );

  if (selectedStatuses.length === ALL_STATUSES.length) next.delete("status");
  else next.set("status", selectedStatuses.join(",") || "none");

  if (filters.role === "all") next.delete("role");
  else next.set("role", filters.role);

  if (filters.search.trim()) next.set("search", filters.search);
  else next.delete("search");

  if (filters.sort === "date-desc") next.delete("sort");
  else next.set("sort", filters.sort);

  next.delete("page");
  return next;
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
