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

const FALLBACK_SPLITS: HistorySplit[] = [
  {
    id: "s-1001",
    title: "Dinner at Nobu",
    totalAmount: 450,
    currency: "USD",
    date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    status: "completed",
    participants: [
      { id: "1", name: "You" },
      { id: "2", name: "Sarah" },
      { id: "3", name: "Mike" },
    ],
    role: "participant",
  },
  {
    id: "s-1002",
    title: "Grocery Run",
    totalAmount: 120.5,
    currency: "USD",
    date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    status: "active",
    participants: [
      { id: "1", name: "You" },
      { id: "4", name: "Jess" },
    ],
    role: "creator",
  },
  {
    id: "s-1003",
    title: "Weekend Road Trip",
    totalAmount: 980,
    currency: "USD",
    date: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString(),
    status: "cancelled",
    participants: [
      { id: "1", name: "You" },
      { id: "5", name: "Adebayo" },
      { id: "6", name: "Lara" },
    ],
    role: "participant",
  },
];

 export interface HistoryFilters {
  statuses?: SplitStatus[];
  role?: SplitRole | "all";
  search?: string;
  sort?: string;
  page?: number;
  limit?: number;
}

export interface HistoryResponse {
  data: HistorySplit[];
  source: "api" | "fixture";
  meta: {
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
    totalCompleted: number;
    totalPending: number;
  };
}

export interface SplitHistoryRepository {
  fetchHistory(filters: HistoryFilters): Promise<HistoryResponse>;
}

class ApiSplitHistoryRepository implements SplitHistoryRepository {
  async list(): Promise<{ data: HistorySplit[]; source: "api" | "fixture" }> {
    try {
      const response = await apiClient.get<HistorySplit[]>("/splits/history");
      return { data: response.data, source: "api" };
    } catch {
      return { data: FALLBACK_SPLITS, source: "fixture" };
    }
  }
}

let singleton: SplitHistoryRepository | null = null;

export function getSplitHistoryRepository(): SplitHistoryRepository {
  if (!singleton) singleton = new ApiSplitHistoryRepository();
  return singleton;
}
