/**
 * NotificationDemoTools.tsx — Issue #509
 *
 * Development-only harness for triggering simulated notifications.
 * Must NOT be imported by production components directly — gate it with
 * `process.env.NODE_ENV !== 'production'` or a feature flag at the usage site.
 *
 * Usage:
 * ```tsx
 * {process.env.NODE_ENV !== 'production' && <NotificationDemoTools />}
 * ```
 */

import { useNotificationsStore } from '../../store/notifications';
import type { NotificationType } from '../../types/notifications';

// Stable demo messages — no Math.random() in production code paths
const DEMO_MESSAGES: Array<{ type: NotificationType; title: string; message: string }> = [
  { type: 'split_invitation',    title: 'Split invitation',   message: 'You were invited to a new split.'  },
  { type: 'payment_received',    title: 'Payment received',   message: 'A payment was received.'           },
  { type: 'system_announcement', title: 'Update',             message: 'New feature available.'            },
  { type: 'payment_reminder',    title: 'Reminder',           message: 'You have a pending payment.'       },
  { type: 'split_completed',     title: 'Split completed',    message: 'A split has been settled.'         },
];

let demoIndex = 0;

/** Cycle through DEMO_MESSAGES deterministically (no Math.random). */
function nextDemoMessage() {
  const msg = DEMO_MESSAGES[demoIndex % DEMO_MESSAGES.length];
  demoIndex += 1;
  return msg;
}

export interface NotificationDemoToolsProps {
  className?: string;
}

export function NotificationDemoTools({ className }: NotificationDemoToolsProps) {
  const addNotification = useNotificationsStore((state) => state.addNotification);
  const clearAll = useNotificationsStore((state) => state.clearAll);

  const handleSimulate = () => {
    addNotification(nextDemoMessage());
  };

  return (
    <div
      className={`flex flex-wrap gap-2 p-2 rounded-lg border border-dashed border-yellow-500/50 bg-yellow-500/5 ${className ?? ''}`}
      data-testid="notification-demo-tools"
      role="region"
      aria-label="Notification demo controls (development only)"
    >
      <span className="text-xs text-yellow-600 dark:text-yellow-400 font-medium self-center">
        DEV
      </span>
      <button
        type="button"
        onClick={handleSimulate}
        className="px-3 py-1 text-xs rounded bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-700 dark:text-yellow-300 transition-colors"
        data-testid="simulate-notification"
      >
        Simulate notification
      </button>
      <button
        type="button"
        onClick={clearAll}
        className="px-3 py-1 text-xs rounded bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 transition-colors"
        data-testid="demo-clear-all"
      >
        Clear all
      </button>
    </div>
  );
}

export default NotificationDemoTools;
