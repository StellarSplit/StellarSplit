import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Notification, NotificationType } from "../types/notifications";
import { notificationPersistence } from "../utils/notificationPersistence";
import { getStoredActiveUserId } from "../utils/session";
import {
  fetchUserActivities,
  markActivitiesAsRead,
  markAllActivitiesAsRead,
  type ApiActivityRecord,
} from "../utils/api-client";

interface NotificationsState {
  notifications: Notification[];
  typeFilter: NotificationType | "all";
  hasHydrated: boolean;
  markAsRead: (id: string) => void;
  markAsUnread: (id: string) => void;
  markAllAsRead: () => void;
  setTypeFilter: (typeFilter: NotificationType | "all") => void;
  clearAll: () => void;
  addNotification: (notification: Omit<Notification, "id" | "read" | "createdAt">) => void;
  addServerNotifications: (notifications: Notification[]) => void;
  removeNotification: (id: string) => void;
  setHasHydrated: (value: boolean) => void;
  syncFromServer: () => Promise<void>;
}

export const selectUnreadCount = (state: NotificationsState): number =>
  state.notifications.filter((n) => !n.read).length;

function createNotification(
  input: Omit<Notification, "id" | "read" | "createdAt">
): Notification {
  return {
    ...input,
    id: crypto.randomUUID(),
    read: false,
    createdAt: new Date().toISOString(),
  };
}

const ACTIVITY_TYPE_TO_NOTIFICATION_TYPE: Partial<
  Record<string, NotificationType>
> = {
  split_created: "split_invitation",
  participant_added: "split_invitation",
  payment_made: "payment_reminder",
  payment_received: "payment_received",
  split_completed: "split_completed",
  reminder_sent: "payment_reminder",
  split_edited: "split_invitation",
};

const ACTIVITY_TYPE_TITLES: Record<string, string> = {
  split_created: "Split created",
  participant_added: "Participant added",
  payment_made: "Payment made",
  payment_received: "Payment received",
  split_completed: "Split completed",
  reminder_sent: "Reminder sent",
  split_edited: "Split updated",
};

function activityToNotification(activity: ApiActivityRecord): Notification {
  const type =
    ACTIVITY_TYPE_TO_NOTIFICATION_TYPE[activity.activityType] ??
    "system_announcement";
  const title =
    ACTIVITY_TYPE_TITLES[activity.activityType] ?? "Notification";
  return {
    id: activity.id,
    type,
    title,
    message: title,
    read: activity.isRead ?? false,
    createdAt: activity.createdAt,
    metadata: {
      ...(activity.metadata ?? {}),
      activityType: activity.activityType,
      ...(activity.splitId ? { splitId: activity.splitId } : {}),
    },
  };
}

export const useNotificationsStore = create<NotificationsState>()(
  persist(
    (set, get) => ({
      notifications: [],
      typeFilter: "all",
      hasHydrated: false,

      setHasHydrated: (value: boolean) => set({ hasHydrated: value }),

      markAsRead: (id) => {
        const previous = get().notifications;
        const target = previous.find((n) => n.id === id);
        if (!target) return;

        // 乐观更新本地状态
        set((state) => ({
          notifications: state.notifications.map((n) =>
            n.id === id ? { ...n, read: true } : n
          ),
        }));

        const userId = getStoredActiveUserId();
        // 仅有服务端对应的活动（id 匹配某个后端 activity）才需要同步到后端。
        // 本地生成的演示通知（crypto.randomUUID）无对应后端记录，只更新本地。
        if (userId && target.metadata?.activityType) {
          markActivitiesAsRead(userId, [id]).catch(() => {
            // 失败回滚
            set({ notifications: previous });
          });
        }
      },

      markAsUnread: (id) =>
        set((state) => ({
          notifications: state.notifications.map((n) =>
            n.id === id ? { ...n, read: false } : n
          ),
        })),

      markAllAsRead: () => {
        const previous = get().notifications;
        // 乐观更新本地状态
        set((state) => ({
          notifications: state.notifications.map((n) => ({ ...n, read: true })),
        }));

        const userId = getStoredActiveUserId();
        if (userId) {
          markAllActivitiesAsRead(userId).catch(() => {
            // 失败回滚
            set({ notifications: previous });
          });
        }
      },

      setTypeFilter: (typeFilter) => set({ typeFilter }),

      clearAll: () => set({ notifications: [] }),

      addNotification: (input) =>
        set((state) => {
          const newNotif = createNotification(input);
          return {
            notifications: [newNotif, ...state.notifications],
          };
        }),

      addServerNotifications: (serverNotifications) =>
        set((state) => ({
          notifications: notificationPersistence.merge(
            state.notifications,
            serverNotifications
          ),
        })),

      removeNotification: (id) =>
        set((state) => ({
          notifications: state.notifications.filter((n) => n.id !== id),
        })),

      syncFromServer: async () => {
        const userId = getStoredActiveUserId();
        if (!userId) return;
        try {
          const response = await fetchUserActivities(userId, { limit: 100 });
          if (!response?.data) return;
          const serverNotifications = response.data.map(activityToNotification);
          set((state) => ({
            notifications: notificationPersistence.merge(
              state.notifications,
              serverNotifications
            ),
          }));
        } catch (error) {
          // 静默失败：保持本地状态，下次再同步
          console.warn("Failed to sync notifications from server", error);
        }
      },
    }),
    {
      name: "stellarsplit.notifications-storage",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        notifications: state.notifications,
        typeFilter: state.typeFilter,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);
