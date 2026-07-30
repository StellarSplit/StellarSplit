import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation, useNavigate } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SplitHistoryPage from "./SplitHistoryPage";

const repositoryMocks = vi.hoisted(() => ({
  fetchHistory: vi.fn(),
}));

vi.mock("../services/splitHistoryRepository", () => ({
  getSplitHistoryRepository: () => ({
    fetchHistory: repositoryMocks.fetchHistory,
  }),
}));

const emptyResponse = {
  data: [],
  source: "api" as const,
  meta: {
    page: 1,
    limit: 20,
    totalItems: 0,
    totalPages: 1,
    hasMore: false,
  },
  summary: {
    totalAmount: 0,
    average: 0,
    counts: { active: 0, completed: 0, cancelled: 0 },
  },
};

describe("SplitHistoryPage", () => {
  beforeEach(() => {
    repositoryMocks.fetchHistory.mockReset();
    repositoryMocks.fetchHistory.mockResolvedValue(emptyResponse);
  });

  it("reads filters and pagination from the URL and fetches that page", async () => {
    renderPage(
      "/history?status=completed&role=creator&search=taxi&sort=amount-desc&page=2",
    );

    await waitFor(() =>
      expect(repositoryMocks.fetchHistory).toHaveBeenCalledWith({
        statuses: ["completed"],
        role: "creator",
        search: "taxi",
        sort: "amount-desc",
        page: 2,
        limit: 20,
      }),
    );
    expect(screen.getByLabelText("Search")).toHaveValue("taxi");
    expect(screen.getByLabelText("Role")).toHaveValue("creator");
    expect(screen.getByLabelText("Sort")).toHaveValue("amount-desc");
  });

  it("writes filter changes to the URL, resets the page, and restores state on Back", async () => {
    renderPage("/history?role=creator&page=2", true);
    await waitFor(() => expect(repositoryMocks.fetchHistory).toHaveBeenCalledTimes(1));

    fireEvent.change(screen.getByLabelText("Role"), {
      target: { value: "participant" },
    });

    await waitFor(() => {
      expect(screen.getByTestId("location")).toHaveTextContent("role=participant");
      expect(screen.getByTestId("location")).not.toHaveTextContent("page=");
    });
    expect(repositoryMocks.fetchHistory).toHaveBeenLastCalledWith(
      expect.objectContaining({ role: "participant", page: 1 }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Back" }));

    await waitFor(() => {
      expect(screen.getByLabelText("Role")).toHaveValue("creator");
      expect(screen.getByTestId("location")).toHaveTextContent(
        "role=creator&page=2",
      );
    });
    expect(repositoryMocks.fetchHistory).toHaveBeenLastCalledWith(
      expect.objectContaining({ role: "creator", page: 2 }),
    );
  });

  it("updates the page query parameter and fetches the next page", async () => {
    repositoryMocks.fetchHistory.mockResolvedValue({
      ...emptyResponse,
      meta: {
        ...emptyResponse.meta,
        totalItems: 21,
        totalPages: 2,
        hasMore: true,
      },
    });
    renderPage("/history");
    await waitFor(() => expect(repositoryMocks.fetchHistory).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    await waitFor(() =>
      expect(screen.getByTestId("location")).toHaveTextContent("?page=2"),
    );
    expect(repositoryMocks.fetchHistory).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 2, limit: 20 }),
    );
  });

  it("shows the translated empty state when the API returns no rows", async () => {
    renderPage("/history");

    expect(await screen.findByText("No splits found")).toBeInTheDocument();
  });

  it("shows an API error instead of substituting fixture history", async () => {
    repositoryMocks.fetchHistory.mockRejectedValueOnce(
      new Error("Unable to load history"),
    );
    renderPage("/history");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Unable to load history",
    );
    expect(screen.queryByText("No splits found")).not.toBeInTheDocument();
  });
});

function renderPage(initialEntry: string, includeBackButton = false) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      {includeBackButton ? <BackButton /> : null}
      <SplitHistoryPage />
      <LocationProbe />
    </MemoryRouter>,
  );
}

function BackButton() {
  const navigate = useNavigate();
  return <button onClick={() => navigate(-1)}>Back</button>;
}

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.search}</output>;
}
