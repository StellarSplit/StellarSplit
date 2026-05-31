/**
 * NotificationCenter.tsx — Issue #509
 *
 * Production notification list with filtering and bulk-action controls.
 * Demo / simulation tooling has been extracted to NotificationDemoTools.tsx
 * and is rendered only when `import.meta.env.DEV` is true.
 */

import { lazy, Suspense, useMemo } from "react";
import { useNotificationsStore } from "../../store/notifications";
import type { NotificationType } from "../../types/notifications";
import { NOTIFICATION_TYPE_LABELS } from "../../types/notifications";
import { NotificationItem } from "./NotificationItem";
import { Button } from "../ui/button";

// Lazily import demo tools so they are tree-shaken out of production bundles.
const NotificationDemoTools = lazy(() =>
  import("./NotificationDemoTools").then((m) => ({ default: m.NotificationDemoTools }))
);

const FILTER_OPTIONS: (NotificationType | "all")[] = [
  "all",
  "split_invitation",
  "payment_reminder",
  "payment_received",
  "split_completed",
  "split_cancelled",
  "friend_request",
  "system_announcement",
];

export function NotificationCenter() {
  const notifications = useNotificationsStore((state) => state.notifications);
  const typeFilter = useNotificationsStore((state) => state.typeFilter);
  const setTypeFilter = useNotificationsStore((state) => state.setTypeFilter);
  const markAllAsRead = useNotificationsStore((state) => state.markAllAsRead);
  const clearAll = useNotificationsStore((state) => state.clearAll);

  const filteredList = useMemo(() => {
    if (typeFilter === "all") return [...notifications];
    return notifications.filter((n) => n.type === typeFilter);
  }, [notifications, typeFilter]);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  );

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 sm:py-8" data-testid="notification-center">
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-theme">Notifications</h1>
        <div className="flex flex-wrap gap-2">
          {unreadCount > 0 && (
            <Button
              type="button"
              onClick={markAllAsRead}
              className="!rounded-lg"
              data-testid="mark-all-read"
            >
              Mark all as read
            </Button>
          )}
          {notifications.length > 0 && (
            <Button
              type="button"
              onClick={clearAll}
              className="!rounded-lg border border-theme bg-card-theme text-theme hover:bg-surface"
              data-testid="clear-all"
            >
              Clear all
            </Button>
          )}
        </div>
      </header>

      {/* Demo tools — development only, lazy-loaded and tree-shaken in prod */}
      {import.meta.env.DEV && (
        <Suspense fallback={null}>
          <NotificationDemoTools className="mb-4" />
        </Suspense>
      )}

      <div className="mb-4">
        <p className="text-sm text-muted-theme mb-2">Filter by type</p>
        <div className="flex flex-wrap gap-2">
          {FILTER_OPTIONS.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setTypeFilter(type)}
              className={`
                px-3 py-1.5 rounded-full text-sm font-medium transition-colors
                ${typeFilter === type
                  ? "bg-accent text-white"
                  : "bg-card-theme border border-theme text-theme hover:bg-surface"}
              `}
              data-testid={`filter-${type}`}
            >
              {type === "all" ? "All" : NOTIFICATION_TYPE_LABELS[type]}
            </button>
          ))}
        </div>
      </div>

      <section className="space-y-2">
        {filteredList.length === 0 ? (
          <div
            className="rounded-xl border border-theme bg-card-theme p-8 text-center text-muted-theme"
            data-testid="empty-state"
          >
            {notifications.length === 0
              ? "No notifications yet."
              : `No ${typeFilter === "all" ? "" : NOTIFICATION_TYPE_LABELS[typeFilter].toLowerCase()} notifications.`}
          </div>
        ) : (
          <ul className="space-y-2">
            {filteredList.map((n) => (
              <li key={n.id}>
                <NotificationItem notification={n} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
