import { apiClient } from "../utils/api-client";

export type SplitStatus = "active" | "completed" | "cancelled";
export type SplitRole = "creator" | "participant";

export interface HistoryParticipant {
  id: string;
  name: string;
}

export interface HistorySplit {
  id: string;
  title: string;
  totalAmount: number;
  currency: string;
  date: string;
  status: SplitStatus;
  participants: HistoryParticipant[];
  role: SplitRole;
}

export type HistorySort =
  | "date-desc"
  | "date-asc"
  | "amount-desc"
  | "amount-asc"
  | "status";

const API_PAGE_SIZE = 100;
const ALL_STATUSES: SplitStatus[] = ["active", "completed", "cancelled"];

export interface HistoryFilters {
  statuses?: SplitStatus[];
  role?: SplitRole | "all";
  search?: string;
  sort?: HistorySort;
  page?: number;
  limit?: number;
}

export interface HistoryResponse {
  data: HistorySplit[];
  source: "api";
  meta: {
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
    hasMore: boolean;
  };
  summary: HistorySummaryData;
}

export interface HistorySummaryData {
  totalAmount: number;
  average: number;
  counts: Record<SplitStatus, number>;
}

export interface SplitHistoryRepository {
  fetchHistory(filters: HistoryFilters): Promise<HistoryResponse>;
}

class ApiSplitHistoryRepository implements SplitHistoryRepository {
  async fetchHistory(filters: HistoryFilters): Promise<HistoryResponse> {
    const page = positiveInteger(filters.page, 1);
    const limit = positiveInteger(filters.limit, 20);

    if (filters.statuses?.length === 0) {
      return emptyResponse(page, limit);
    }

    const statusQueries = apiStatusQueries(filters.statuses);
    const resultSets = await Promise.all(
      statusQueries.map((status) => fetchAllApiPages(filters, status)),
    );
    const uniqueSplits = new Map<string, HistorySplit>();
    resultSets.flat().map(mapApiHistoryItem).forEach((split) => {
      uniqueSplits.set(split.id, split);
    });
    const filtered = sortHistory(
      filterHistory(Array.from(uniqueSplits.values()), filters),
      filters.sort,
    );
    const offset = (page - 1) * limit;

    return {
      data: filtered.slice(offset, offset + limit),
      source: "api",
      meta: {
        page,
        limit,
        totalItems: filtered.length,
        totalPages: Math.max(1, Math.ceil(filtered.length / limit)),
        hasMore: offset + limit < filtered.length,
      },
      summary: summarizeHistory(filtered),
    };
  }
}

interface ApiHistoryItem {
  id: string;
  splitId: string;
  role: SplitRole;
  finalAmount: number;
  status: string;
  description?: string;
  preferredCurrency?: string;
  totalAmount: number;
  completionTime: string;
  isArchived: boolean;
}

interface ApiHistoryResponse {
  data: ApiHistoryItem[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

function positiveInteger(value: number | undefined, fallback: number): number {
  return Number.isInteger(value) && Number(value) > 0 ? Number(value) : fallback;
}

async function fetchAllApiPages(
  filters: HistoryFilters,
  status: string | undefined,
): Promise<ApiHistoryItem[]> {
  const items: ApiHistoryItem[] = [];
  let page = 1;

  while (true) {
    const response = await apiClient.get<ApiHistoryResponse>("/splits/history", {
      params: buildApiParams(filters, page, API_PAGE_SIZE, status),
    });
    const payload = response.data;
    items.push(...payload.data);

    const responsePage = positiveInteger(payload.page, page);
    const responseLimit = positiveInteger(payload.limit, API_PAGE_SIZE);
    const totalPages = Math.max(1, Math.ceil(Math.max(0, payload.total) / responseLimit));
    if (!payload.hasMore || responsePage >= totalPages) break;
    page = responsePage + 1;
  }

  return items;
}

function buildApiParams(
  filters: HistoryFilters,
  page: number,
  limit: number,
  status: string | undefined,
) {
  const params: Record<string, string | number> = { page, limit };
  const search = filters.search?.trim();

  if (filters.role && filters.role !== "all") params.role = filters.role;
  if (search) params.search = search;
  if (status) params.status = status;

  return params;
}

function apiStatusQueries(statuses: SplitStatus[] | undefined): Array<string | undefined> {
  if (!statuses || statuses.length === ALL_STATUSES.length) return [undefined];
  return statuses.map((status) => (status === "cancelled" ? "archived" : status));
}

function mapApiHistoryItem(item: ApiHistoryItem): HistorySplit {
  return {
    id: item.id,
    title: item.description?.trim() || `Split ${item.splitId}`,
    totalAmount: Number(item.totalAmount) || Math.abs(Number(item.finalAmount)) || 0,
    currency: item.preferredCurrency || "USD",
    date: item.completionTime,
    status: mapApiStatus(item.status, item.isArchived),
    participants: [],
    role: item.role,
  };
}

function mapApiStatus(status: string, isArchived: boolean): SplitStatus {
  if (isArchived || status === "archived" || status === "cancelled") return "cancelled";
  if (status === "completed") return "completed";
  return "active";
}

function filterHistory(splits: HistorySplit[], filters: HistoryFilters): HistorySplit[] {
  if (!filters.statuses) return splits;
  return splits.filter((split) => filters.statuses?.includes(split.status));
}

function sortHistory(splits: HistorySplit[], sort: HistorySort = "date-desc") {
  return [...splits].sort((left, right) => {
    switch (sort) {
      case "date-asc":
        return new Date(left.date).getTime() - new Date(right.date).getTime();
      case "amount-desc":
        return right.totalAmount - left.totalAmount;
      case "amount-asc":
        return left.totalAmount - right.totalAmount;
      case "status":
        return left.status.localeCompare(right.status);
      case "date-desc":
      default:
        return new Date(right.date).getTime() - new Date(left.date).getTime();
    }
  });
}

function summarizeHistory(splits: HistorySplit[]): HistorySummaryData {
  const totalAmount = splits.reduce((sum, split) => sum + split.totalAmount, 0);
  const counts = splits.reduce(
    (result, split) => {
      result[split.status] += 1;
      return result;
    },
    { active: 0, completed: 0, cancelled: 0 } as Record<SplitStatus, number>,
  );

  return {
    totalAmount,
    average: splits.length ? totalAmount / splits.length : 0,
    counts,
  };
}

function emptyResponse(page: number, limit: number): HistoryResponse {
  return {
    data: [],
    source: "api",
    meta: { page, limit, totalItems: 0, totalPages: 1, hasMore: false },
    summary: summarizeHistory([]),
  };
}

let singleton: SplitHistoryRepository | null = null;

export function getSplitHistoryRepository(): SplitHistoryRepository {
  if (!singleton) singleton = new ApiSplitHistoryRepository();
  return singleton;
}
