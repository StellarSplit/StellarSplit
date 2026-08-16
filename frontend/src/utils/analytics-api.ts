import type {
  DateRange,
  AnalyticsData,
} from "../types/analytics";
import { getAnalyticsData, type AnalyticsMode, type AnalyticsSource } from "../services/analyticsDataProvider";

export async function fetchAnalyticsBundle(
  range?: DateRange,
  mode: AnalyticsMode = "hybrid",
  walletAddress?: string,
): Promise<{ data: AnalyticsData; source: AnalyticsSource }> {
  return getAnalyticsData(range, mode, walletAddress);
}