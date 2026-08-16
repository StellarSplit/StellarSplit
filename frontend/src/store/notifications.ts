import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Notification, NotificationType } from "../types/notifications";
import { notificationPersistence } from "../utils/notificationPersistence";
import {
  fetchUserActivities,
  markActivitiesRead,
  markAllActivitiesRead,
  type ApiActivityRecord,
} from "../utils/api-client";
import { getStoredActiveUserId } from "../utils/session";

interface NotificationsState {
  notifications: Notification[];
  typeFilter: NotificationType | "all";
  hasHydrated: boolean;
  markAsRead: (id: string) => void;
  markAsUnread: (id: string) => void;
  markAllAsRead: () => void;
  setTypeFilter: (type: NotificationType | "all") => void;
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

// Map backend activity types onto the frontend notification vocabulary so
// server-fetched activity can be merged into the store without dropping items.
const ACTIVITY_TYPE_TO_NOTIFICATION: Record<string, NotificationType> = {
  split_created: "system_announcement",
  participant_added: "split_invitation",
  payment_made: "payment_reminder",
  payment_received: "payment_received",
  split_completed: "split_completed",
  reminder_sent: "payment_reminder",
  split_edited: "system_announcement",
};

function activityToNotification(activity: ApiActivityRecord): Notification {
  const metadata = activity.metadata ?? {};
  const title =
    typeof metadata.title === "string"
      ? metadata.title
      : `Activity: ${activity.activityType.replace(/_/g, " ")}`;
  const amount =
    typeof metadata.amount === "number" || typeof metadata.amount === "string"
      ? ` ${metadata.amount}`
      : "";
  return {
    id: activity.id,
    type: ACTIVITY_TYPE_TO_NOTIFICATION[activity.activityType] ?? "system_announcement",
    title,
    message: `${activity.activityType.replace(/_/g, " ")}${amount}`,
    read: activity.isRead,
    createdAt: activity.createdAt,
  };
}

export const useNotificationsStore = create<NotificationsState>()(
  persist(
    (set, get) => ({
      notifications: [],
      typeFilter: "all",
      hasHydrated: false,

      setHasHydrated: (value: boolean) => set({ hasHydrated: value }),

      markAsRead: async (id) => {
        const previous = get().notifications;
        // Optimistic local update
        set((state) => ({
          notifications: state.notifications.map((n) =>
            n.id === id ? { ...n, read: true } : n
          ),
        }));
        // Persist read state to the backend Activity entity
        const userId = getStoredActiveUserId();
        if (!userId) return;
        try {
          await markActivitiesRead(userId, [id]);
        } catch (error) {
          // Roll back on failure so the UI never claims a read state the
          // server did not accept.
          console.error("Failed to sync markAsRead to server", error);
          set({ notifications: previous });
        }
      },

      markAsUnread: (id) =>
        set((state) => ({
          notifications: state.notifications.map((n) =>
            n.id === id ? { ...n, read: false } : n
          ),
        })),

      markAllAsRead: async () => {
        const previous = get().notifications;
        // Optimistic local update
        set((state) => ({
          notifications: state.notifications.map((n) => ({ ...n, read: true })),
        }));
        // Persist to the backend so the dashboard unread badge (computed
        // server-side from the Activity entity) drops to zero on reload.
        const userId = getStoredActiveUserId();
        if (!userId) return;
        try {
          await markAllActivitiesRead(userId);
        } catch (error) {
          console.error("Failed to sync markAllAsRead to server", error);
          set({ notifications: previous });
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

      // Reconcile the local notifications array with server-fetched activity on
      // app load, rather than trusting localStorage as the sole source of truth.
      // Server is authoritative for read state: clearing localStorage must not
      // resurrect already-read notifications as unread.
      syncFromServer: async () => {
        const userId = getStoredActiveUserId();
        if (!userId) return;
        try {
          const response = await fetchUserActivities(userId, { limit: 50 });
          const serverNotifications = response.data.map(activityToNotification);
          set((state) => ({
            notifications: notificationPersistence.merge(
              state.notifications,
              serverNotifications
            ),
          }));
        } catch (error) {
          console.error("Failed to sync notifications from server", error);
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
        // Reconcile local notifications with server-fetched activity so that
        // read state survives a localStorage clear.
        state?.syncFromServer();
      },
    }
  )
);