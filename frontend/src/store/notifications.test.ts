import { describe, it, expect, vi, beforeEach } from "vitest";
import { useNotificationsStore } from "./notifications";
import { resetNotificationsForTesting } from "../test-utils/notifications";
import { notificationPersistence } from "../utils/notificationPersistence";
import type { Notification } from "../types/notifications";

// Mock API 模块
vi.mock("../utils/api-client", () => ({
  fetchUserActivities: vi.fn(),
  markActivitiesAsRead: vi.fn().mockResolvedValue({ updated: 1 }),
  markAllActivitiesAsRead: vi.fn().mockResolvedValue({ updated: 3 }),
  createActivityRecord: vi.fn(),
  fetchUserActivitiesRaw: vi.fn(),
}));

// Mock session（无登录用户时不调用 API）
vi.mock("../utils/session", () => ({
  getStoredActiveUserId: vi.fn().mockReturnValue(null),
}));

import {
  fetchUserActivities,
  markActivitiesAsRead,
  markAllActivitiesAsRead,
} from "../utils/api-client";
import { getStoredActiveUserId } from "../utils/session";

describe("notifications store sync", () => {
  beforeEach(() => {
    resetNotificationsForTesting();
    vi.clearAllMocks();
  });

  it("markAsRead still updates local state when no user is logged in", () => {
    useNotificationsStore.getState().markAsRead("demo-1");
    const updated = useNotificationsStore
      .getState()
      .notifications.find((n) => n.id === "demo-1");
    expect(updated?.read).toBe(true);
  });

  it("markAllAsRead marks all local notifications read even without a user", () => {
    useNotificationsStore.getState().markAllAsRead();
    const allRead = useNotificationsStore
      .getState()
      .notifications.every((n) => n.read);
    expect(allRead).toBe(true);
  });

  it("calls the backend mark-all-read endpoint when a user is logged in", async () => {
    vi.mocked(getStoredActiveUserId).mockReturnValue("GATESTUSER");
    useNotificationsStore.getState().markAllAsRead();
    await vi.waitFor(() => {
      expect(markAllActivitiesAsRead).toHaveBeenCalledWith("GATESTUSER");
    });
  });

  it("calls the backend mark-read endpoint for server-backed notifications when logged in", async () => {
    vi.mocked(getStoredActiveUserId).mockReturnValue("GATESTUSER");
    const serverNotification: Notification = {
      id: "server-1",
      type: "payment_received",
      title: "Payment received",
      message: "You received $10.",
      read: false,
      createdAt: new Date().toISOString(),
      metadata: { activityType: "payment_received" },
    };
    useNotificationsStore.setState({
      notifications: [serverNotification, ...DEMO_NOTIFICATIONS()],
    });
    useNotificationsStore.getState().markAsRead("server-1");
    await vi.waitFor(() => {
      expect(markActivitiesAsRead).toHaveBeenCalledWith("GATESTUSER", [
        "server-1",
      ]);
    });
  });

  it("does not call backend mark-read for local-only demo notifications", () => {
    vi.mocked(getStoredActiveUserId).mockReturnValue("GATESTUSER");
    useNotificationsStore.getState().markAsRead("demo-1");
    expect(markActivitiesAsRead).not.toHaveBeenCalled();
  });

  it("syncFromServer merges server activities into the store", async () => {
    vi.mocked(getStoredActiveUserId).mockReturnValue("GATESTUSER");
    vi.mocked(fetchUserActivities).mockResolvedValue({
      data: [
        {
          id: "act-1",
          userId: "GATESTUSER",
          activityType: "payment_received",
          metadata: {},
          isRead: false,
          createdAt: new Date().toISOString(),
        },
      ],
      total: 1,
      page: 1,
      limit: 100,
      totalPages: 1,
      hasMore: false,
      unreadCount: 1,
    });

    useNotificationsStore.setState({ notifications: [] });
    await useNotificationsStore.getState().syncFromServer();

    const notifications = useNotificationsStore.getState().notifications;
    expect(notifications.some((n) => n.id === "act-1")).toBe(true);
  });

  it("syncFromServer is a no-op when no user is logged in", async () => {
    vi.mocked(getStoredActiveUserId).mockReturnValue(null);
    useNotificationsStore.setState({ notifications: [] });
    await useNotificationsStore.getState().syncFromServer();
    expect(fetchUserActivities).not.toHaveBeenCalled();
  });

  it("notificationPersistence.merge preserves local read state over incoming server state", () => {
    const local: Notification[] = [
      {
        id: "n1",
        type: "payment_received",
        title: "t",
        message: "m",
        read: true,
        createdAt: "2026-08-01T00:00:00.000Z",
      },
    ];
    const incoming: Notification[] = [
      {
        id: "n1",
        type: "payment_received",
        title: "t",
        message: "m",
        read: false,
        createdAt: "2026-08-01T00:00:00.000Z",
      },
    ];
    const merged = notificationPersistence.merge(local, incoming);
    expect(merged[0].read).toBe(true);
  });
});

function DEMO_NOTIFICATIONS(): Notification[] {
  return [
    {
      id: "demo-1",
      type: "payment_reminder",
      title: "Payment reminder",
      message: "You have a pending payment.",
      read: false,
      createdAt: new Date(Date.now() - 3600000).toISOString(),
    },
  ];
}
