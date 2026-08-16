import { apiClient } from "../utils/api-client";
import { fetchDebtBalancesByWallet } from "./api/debtSimplificationApi";
import type {
  SpendingTrend,
  CategoryBreakdown,
  TopPartner,
  DebtBalance,
  HeatmapCell,
  TimeDistribution,
  DateRange,
  AnalyticsData,
} from "../types/analytics";

export type AnalyticsSource = "live" | "fixture";
export type AnalyticsMode = "hybrid" | "live-only" | "fixture-only";

export interface AnalyticsResult {
  data: AnalyticsData;
  source: AnalyticsSource;
}

const MOCK_SPENDING_TRENDS: SpendingTrend[] = [
  { period: "2025-09-01", totalSpent: 420, transactionCount: 8, avgTransactionAmount: 52.5 },
  { period: "2025-10-01", totalSpent: 580, transactionCount: 12, avgTransactionAmount: 48.33 },
  { period: "2025-11-01", totalSpent: 340, transactionCount: 6, avgTransactionAmount: 56.67 },
];
const MOCK_CATEGORY_BREAKDOWN: CategoryBreakdown[] = [
  { category: "Food & Dining", amount: 890 },
  { category: "Entertainment", amount: 420 },
  { category: "Transport", amount: 310 },
];
const MOCK_TOP_PARTNERS: TopPartner[] = [
  { partnerId: "u1", name: "Alice", totalAmount: 650, interactions: 14 },
  { partnerId: "u2", name: "Bob", totalAmount: 420, interactions: 9 },
];
// Keep MOCK_DEBT_BALANCES as a test/storybook fixture, not a runtime fallback.
const MOCK_DEBT_BALANCES: DebtBalance[] = [
  { userId: "u1", name: "Alice", amount: 45, direction: "owe" },
  { userId: "u2", name: "Bob", amount: 120.5, direction: "owed" },
];
const MOCK_HEATMAP: HeatmapCell[] = Array.from({ length: 30 }).map((_, i) => {
  const d = new Date();
  d.setDate(d.getDate() - (29 - i));
  const count = i % 6;
  return { date: d.toISOString().slice(0, 10), count, total: count * 22 };
});
const MOCK_TIME_DISTRIBUTION: TimeDistribution[] = [
  { label: "Mon", count: 12, amount: 340 },
  { label: "Tue", count: 8, amount: 210 },
  { label: "Wed", count: 15, amount: 480 },
];

function fixtureData(): AnalyticsData {
  return {
    spendingTrends: MOCK_SPENDING_TRENDS,
    categoryBreakdown: MOCK_CATEGORY_BREAKDOWN,
    topPartners: MOCK_TOP_PARTNERS,
    debtBalances: MOCK_DEBT_BALANCES,
    heatmapData: MOCK_HEATMAP,
    timeDistribution: MOCK_TIME_DISTRIBUTION,
  };
}

async function fetchLive(
  range?: DateRange,
  walletAddress?: string,
): Promise<AnalyticsData> {
  const params = {
    ...(range?.dateFrom && { dateFrom: range.dateFrom }),
    ...(range?.dateTo && { dateTo: range.dateTo }),
  };
  const [
    spendingTrends,
    categoryBreakdown,
    topPartners,
    debtBalances,
    heatmapData,
    timeDistribution,
  ] = await Promise.all([
    apiClient.get<SpendingTrend[]>("/api/analytics/spending-trends", { params }),
    apiClient.get<CategoryBreakdown[]>("/api/analytics/category-breakdown", { params }),
    apiClient.get<TopPartner[]>("/api/analytics/top-partners", { params }),
    // Wire debt balances to the live /debt-simplification API when a wallet
    // address is available; fall back to fixture data otherwise.
    walletAddress
      ? fetchDebtBalancesByWallet(walletAddress).then((data) => ({ data }))
      : Promise.resolve({ data: MOCK_DEBT_BALANCES }),
    Promise.resolve({ data: MOCK_HEATMAP }),
    Promise.resolve({ data: MOCK_TIME_DISTRIBUTION }),
  ]);
  return {
    spendingTrends: spendingTrends.data,
    categoryBreakdown: categoryBreakdown.data,
    topPartners: topPartners.data,
    debtBalances: debtBalances.data,
    heatmapData: heatmapData.data,
    timeDistribution: timeDistribution.data,
  };
}

export async function getAnalyticsData(
  range?: DateRange,
  mode: AnalyticsMode = "hybrid",
  walletAddress?: string,
): Promise<AnalyticsResult> {
  if (mode === "fixture-only") {
    return { data: fixtureData(), source: "fixture" };
  }
  if (mode === "live-only") {
    return { data: await fetchLive(range, walletAddress), source: "live" };
  }
  try {
    return { data: await fetchLive(range, walletAddress), source: "live" };
  } catch {
    return { data: fixtureData(), source: "fixture" };
  }
}