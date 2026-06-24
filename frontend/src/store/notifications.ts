import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Notification, NotificationType } from "../types/notifications";
import { notificationPersistence } from "../utils/notificationPersistence";

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

export const useNotificationsStore = create<NotificationsState>()(
  persist(
    (set) => ({
      notifications: [],
      typeFilter: "all",
      hasHydrated: false,

      setHasHydrated: (value: boolean) => set({ hasHydrated: value }),

      markAsRead: (id) =>
        set((state) => ({
          notifications: state.notifications.map((n) =>
            n.id === id ? { ...n, read: true } : n
          ),
        })),

      markAsUnread: (id) =>
        set((state) => ({
          notifications: state.notifications.map((n) =>
            n.id === id ? { ...n, read: false } : n
          ),
        })),

      markAllAsRead: () =>
        set((state) => ({
          notifications: state.notifications.map((n) => ({ ...n, read: true })),
        })),

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