import { afterEach, describe, expect, it, vi } from "vitest";
import { getSplitHistoryRepository } from "./splitHistoryRepository";
import { apiClient } from "../utils/api-client";

describe("splitHistoryRepository", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches every server page and deduplicates before requested pagination", async () => {
    const getSpy = vi
      .spyOn(apiClient, "get")
      .mockResolvedValueOnce({
        data: apiResponse(
          [
            apiItem({
              id: "history-new",
              description: "API Split New",
              totalAmount: 20,
              completionTime: "2026-01-03T00:00:00.000Z",
            }),
            apiItem({
              id: "history-old",
              description: "API Split Old",
              totalAmount: 12,
              completionTime: "2026-01-01T00:00:00.000Z",
            }),
          ],
          { total: 101, page: 1, limit: 100, hasMore: true },
        ),
      })
      .mockResolvedValueOnce({
        data: apiResponse(
          [
            apiItem({
              id: "history-middle",
              description: "API Split Middle",
              totalAmount: 16,
              completionTime: "2026-01-02T00:00:00.000Z",
            }),
            apiItem({
              id: "history-old",
              description: "API Split Old",
              totalAmount: 12,
              completionTime: "2026-01-01T00:00:00.000Z",
            }),
          ],
          { total: 101, page: 2, limit: 100, hasMore: false },
        ),
      });

    const result = await getSplitHistoryRepository().fetchHistory({
      statuses: ["active"],
      role: "creator",
      search: " API Split ",
      page: 2,
      limit: 1,
    });

    expect(getSpy).toHaveBeenNthCalledWith(1, "/splits/history", {
      params: {
        page: 1,
        limit: 100,
        role: "creator",
        search: "API Split",
        status: "active",
      },
    });
    expect(getSpy).toHaveBeenNthCalledWith(2, "/splits/history", {
      params: {
        page: 2,
        limit: 100,
        role: "creator",
        search: "API Split",
        status: "active",
      },
    });
    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toMatchObject({
      id: "history-middle",
      title: "API Split Middle",
      currency: "EUR",
      status: "active",
      role: "creator",
    });
    expect(result.meta).toEqual({
      page: 2,
      limit: 1,
      totalItems: 3,
      totalPages: 3,
      hasMore: true,
    });
    expect(result.summary).toEqual({
      totalAmount: 48,
      average: 16,
      counts: { active: 3, completed: 0, cancelled: 0 },
    });
  });

  it("combines multi-status results before global sorting and pagination", async () => {
    const getSpy = vi
      .spyOn(apiClient, "get")
      .mockResolvedValueOnce({
        data: apiResponse([
          apiItem({ id: "active", status: "active", totalAmount: 10 }),
        ]),
      })
      .mockResolvedValueOnce({
        data: apiResponse([
          apiItem({
            id: "completed",
            status: "completed",
            totalAmount: 40,
          }),
        ]),
      });

    const result = await getSplitHistoryRepository().fetchHistory({
      statuses: ["active", "completed"],
      sort: "amount-desc",
      page: 1,
      limit: 1,
    });

    expect(getSpy).toHaveBeenNthCalledWith(1, "/splits/history", {
      params: { page: 1, limit: 100, status: "active" },
    });
    expect(getSpy).toHaveBeenNthCalledWith(2, "/splits/history", {
      params: { page: 1, limit: 100, status: "completed" },
    });
    expect(result.data.map((split) => split.id)).toEqual(["completed"]);
    expect(result.meta).toEqual({
      page: 1,
      limit: 1,
      totalItems: 2,
      totalPages: 2,
      hasMore: true,
    });
    expect(result.summary.counts).toEqual({
      active: 1,
      completed: 1,
      cancelled: 0,
    });
  });

  it("maps cancelled UI filters to archived API records", async () => {
    const getSpy = vi.spyOn(apiClient, "get").mockResolvedValueOnce({
      data: apiResponse([
        apiItem({
          id: "history-2",
          splitId: "split-2",
          role: "participant",
          finalAmount: -24,
          status: "archived",
          description: undefined,
          preferredCurrency: undefined,
          totalAmount: 24,
          isArchived: true,
        }),
      ]),
    });

    const result = await getSplitHistoryRepository().fetchHistory({
      statuses: ["cancelled"],
    });

    expect(getSpy).toHaveBeenCalledWith("/splits/history", {
      params: { page: 1, limit: 100, status: "archived" },
    });
    expect(result.data[0]).toMatchObject({
      title: "Split split-2",
      status: "cancelled",
      totalAmount: 24,
    });
  });

  it("propagates API failures so the page can render its error state", async () => {
    vi.spyOn(apiClient, "get").mockRejectedValueOnce(new Error("boom"));

    await expect(
      getSplitHistoryRepository().fetchHistory({ statuses: ["active"] }),
    ).rejects.toThrow("boom");
  });

  it("returns an empty page without an API call when no statuses are selected", async () => {
    const getSpy = vi.spyOn(apiClient, "get");

    const result = await getSplitHistoryRepository().fetchHistory({
      statuses: [],
      page: 3,
      limit: 10,
    });

    expect(getSpy).not.toHaveBeenCalled();
    expect(result.data).toEqual([]);
    expect(result.meta).toEqual({
      page: 3,
      limit: 10,
      totalItems: 0,
      totalPages: 1,
      hasMore: false,
    });
    expect(result.summary).toEqual({
      totalAmount: 0,
      average: 0,
      counts: { active: 0, completed: 0, cancelled: 0 },
    });
  });
});

function apiResponse(
  data: ReturnType<typeof apiItem>[],
  overrides: Partial<{
    total: number;
    page: number;
    limit: number;
    hasMore: boolean;
  }> = {},
) {
  return {
    data,
    total: data.length,
    page: 1,
    limit: 100,
    hasMore: false,
    ...overrides,
  };
}

function apiItem(overrides: Record<string, unknown> = {}) {
  return {
    id: "history-1",
    splitId: "split-1",
    role: "creator",
    finalAmount: 12,
    status: "active",
    description: "API Split",
    preferredCurrency: "EUR",
    totalAmount: 12,
    completionTime: "2026-01-01T00:00:00.000Z",
    isArchived: false,
    ...overrides,
  };
}
