import { useState, useCallback } from "react";
import type { AnalyticsData, DateRange } from "../types/analytics";
import { fetchAnalyticsBundle } from "../utils/analytics-api";
import type { AnalyticsMode, AnalyticsSource } from "../services/analyticsDataProvider";
import { useAbortableRequest } from "./useAbortableRequest";

interface UseAnalyticsReturn {
  data: AnalyticsData | null;
  source: AnalyticsSource | null;
  loading: boolean;
  error: string | null;
  dateRange: DateRange;
  setDateRange: (range: DateRange) => void;
  refetch: () => void;
}

function defaultDateRange(): DateRange {
  const to = new Date();
  const from = new Date();
  from.setMonth(from.getMonth() - 6);
  return {
    dateFrom: from.toISOString().slice(0, 10),
    dateTo: to.toISOString().slice(0, 10),
  };
}

export function useAnalytics(
  mode: AnalyticsMode = "hybrid",
  walletAddress?: string,
): UseAnalyticsReturn {
  const [dateRange, setDateRange] = useState<DateRange>(defaultDateRange);
  const [source, setSource] = useState<AnalyticsSource | null>(null);

  const { data, loading, error, refetch } = useAbortableRequest(
    async (_signal: AbortSignal) => {
      const result = await fetchAnalyticsBundle(dateRange, mode, walletAddress);
      setSource(result.source);
      return result.data;
    },
    [dateRange, mode, walletAddress],
  );

  return { data, source, loading, error, dateRange, setDateRange, refetch };
}