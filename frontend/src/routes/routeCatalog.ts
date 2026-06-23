/**
 * Canonical route catalog for the entire application.
 * This is the single source of truth for all routes, labels, and navigation visibility.
 * Both the router and navigation components consume this catalog to stay in sync.
 */

export interface RouteCatalogEntry {
  /** Unique identifier for the route */
  id: string;
  /** Path pattern for the route (supports React Router patterns like :id) */
  path: string;
  /** Display label for navigation */
  label: string;
  /** Whether this route should appear in navigation surfaces (sidebar, navbar) */
  showInNavigation: boolean;
  /** Optional group for secondary navigation surfaces (e.g. sidebar Tools section) */
  group?: 'tools';
  /** Optional description or context for the route */
  description?: string;
  /** Import paths or lazy loading function for the page component */
  component?: {
    path: string;
    exportName?: string;
  };
}

/**
 * Complete catalog of all application routes.
 * Maintain this as the authoritative list for router configuration and navigation.
 */
export const routeCatalog: RouteCatalogEntry[] = [
  {
    id: "home",
    path: "/",
    label: "Home",
    showInNavigation: true,
    description: "Landing and home page",
    component: {
      path: "./pages/Home",
      exportName: "default",
    },
  },
  {
    id: "dashboard",
    path: "/dashboard",
    label: "Dashboard",
    showInNavigation: true,
    description: "Main dashboard view",
    component: {
      path: "./pages/Dashboard",
      exportName: "default",
    },
  },
  {
    id: "analytics",
    path: "/analytics",
    label: "Analytics",
    showInNavigation: true,
    description: "Analytics and insights view",
    component: {
      path: "./pages/AnalyticsDashboard",
      exportName: "default",
    },
  },
  {
    id: "split-groups",
    path: "/split-groups",
    label: "Split Groups",
    showInNavigation: true,
    description: "View and manage split groups",
    component: {
      path: "./pages/SplitGroup",
      exportName: "default",
    },
  },
  {
    id: "history",
    path: "/history",
    label: "History",
    showInNavigation: true,
    description: "View transaction and split history",
    component: {
      path: "./pages/SplitHistoryPage",
      exportName: "default",
    },
  },
  {
    id: "drafts",
    path: "/drafts",
    label: "Drafts",
    showInNavigation: true,
    description: "View draft splits and pending items",
    component: {
      path: "./pages/DraftsPage",
      exportName: "default",
    },
  },
  {
    id: "notifications",
    path: "/notifications",
    label: "Notifications",
    showInNavigation: true,
    description: "Notification center",
    component: {
      path: "./pages/NotificationCenterPage",
      exportName: "default",
    },
  },
  {
    id: "split-detail",
    path: "/split/:id",
    label: "Split Detail",
    showInNavigation: false,
    description: "Detailed view of a specific split",
    component: {
      path: "./pages/SplitView/SplitDetailPage",
      exportName: "SplitDetailPage",
    },
  },
  {
    id: "payment-uri",
    path: "/pay",
    label: "Payment",
    showInNavigation: false,
    description: "Payment URI page",
    component: {
      path: "./pages/PaymentURIPage",
      exportName: "default",
    },
  },
  {
    id: "create-split",
    path: "/create-split",
    label: "Create Split",
    showInNavigation: false,
    group: "tools",
    description: "Create a new split",
    component: {
      path: "./components/SplitWizard",
      exportName: "SplitCreationWizard",
    },
  },
  {
    id: "calculator",
    path: "/calculator",
    label: "Calculator",
    showInNavigation: false,
    group: "tools",
    description: "Split calculator tool",
    component: {
      path: "./pages/SplitCalculatorPage",
      exportName: "default",
    },
  },
];

/**
 * Get routes in the "tools" group for the sidebar Tools section.
 */
export function getToolRoutes(): RouteCatalogEntry[] {
  return routeCatalog.filter((route) => route.group === 'tools');
}

/**
 * Get all visible navigation routes.
 * These are the routes that should appear in the sidebar/navbar.
 */
export function getNavigationRoutes(): RouteCatalogEntry[] {
  return routeCatalog.filter((route) => route.showInNavigation);
}

/**
 * Get a specific route by ID.
 */
export function getRouteById(id: string): RouteCatalogEntry | undefined {
  return routeCatalog.find((route) => route.id === id);
}

/**
 * Get a specific route by path.
 */
export function getRouteByPath(path: string): RouteCatalogEntry | undefined {
  // Handle exact path matches
  let match = routeCatalog.find((route) => route.path === path);
  if (match) return match;

  // Handle dynamic routes like /split/:id
  for (const route of routeCatalog) {
    if (route.path.startsWith("/split/:")) {
      if (path.startsWith("/split/")) return route;
    }
  }

  return undefined;
}

/**
 * Get all routes that should be registered in the router.
 */
export function getAllRoutes(): RouteCatalogEntry[] {
  return routeCatalog;
}

/**
 * Validate that the catalog covers all expected primary pages.
 * Returns validation errors if any exist.
 */
export function validateRouteCatalog(): string[] {
  const errors: string[] = [];

  // Check for duplicate paths
  const paths = new Set<string>();
  routeCatalog.forEach((route) => {
    if (paths.has(route.path)) {
      errors.push(`Duplicate path: ${route.path}`);
    }
    paths.add(route.path);
  });

  // Check for duplicate IDs
  const ids = new Set<string>();
  routeCatalog.forEach((route) => {
    if (ids.has(route.id)) {
      errors.push(`Duplicate route ID: ${route.id}`);
    }
    ids.add(route.id);
  });

  // Warn if no routes are in navigation
  const navRoutes = getNavigationRoutes();
  if (navRoutes.length === 0) {
    errors.push("No routes are marked as visible in navigation");
  }

  return errors;
}
