/**
 * Explicit API route registry.
 *
 * Every endpoint is declared as an explicit named constant rather than
 * being guessed or inferred from fallback path variants. This makes the
 * request behavior transparent and allows frontend code to discover all
 * available endpoints.
 *
 * Usage:
 *   const path = ApiRoutes.splits.byId(splitId)
 *   await request<ApiSplitRecord>({ method: 'get', endpoint: path })
 */

export const ApiRoutes = {
  splits: {
    byId: (id: string) => `/splits/${id}`,
    create: () => '/splits',
    list: () => '/splits',
  },

  payments: {
    bySplit: (splitId: string) => `/payments/split/${splitId}`,
    stats: (splitId: string) => `/payments/stats/${splitId}`,
    submit: () => '/payments/submit',
  },

  receipts: {
    bySplit: (splitId: string) => `/receipts/split/${splitId}`,
    upload: (splitId: string) => `/receipts/upload/${splitId}`,
    signedUrl: (receiptId: string) => `/receipts/${receiptId}/signed-url`,
    ocrData: (receiptId: string) => `/receipts/${receiptId}/ocr-data`,
  },

  items: {
    create: () => '/items',
    byId: (itemId: string) => `/items/${itemId}`,
  },

  profile: {
    byWallet: (walletAddress: string) => `/profile/${walletAddress}`,
  },

  dashboard: {
    summary: () => '/dashboard/summary',
    activity: () => '/dashboard/activity',
  },

  activities: {
    byUser: (userId: string) => `/activities/${userId}`,
    create: () => '/activities',
    markRead: (userId: string) => `/activities/${userId}/mark-read`,
    markAllRead: (userId: string) => `/activities/${userId}/mark-all-read`,
  },

  analytics: {
    overview: () => '/analytics/overview',
    payments: () => '/analytics/payments',
    splits: () => '/analytics/splits',
  },
} as const;

/**
 * Get the path for a given route function or endpoint string.
 * This allows routes to be referenced either as functions or strings
 * in a type-safe way.
 */
export function getRoutePath(
  routeOrPath: string | (() => string),
): string {
  return typeof routeOrPath === 'function' ? routeOrPath() : routeOrPath;
}
