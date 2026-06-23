import { useEffect } from "react";
import { registerServiceWorker } from "./utils/sw-register";
import { useServiceWorkerStore } from "./store/serviceWorkerStore";

// Component Isolation for the UpdateBanner
function UpdateNotificationBanner() {
  const { updateAvailable, applyUpdate } = useServiceWorkerStore();

  if (!updateAvailable) return null;

  return (
    <div
      role="alert"
      aria-live="assertive"
      style={{
        position: "fixed",
        bottom: "1.5rem",
        right: "1.5rem",
        zIndex: 100,
        backgroundColor: "var(--color-card)",
        border: "1px solid var(--color-accent)",
        borderRadius: "0.75rem",
        padding: "1rem 1.25rem",
        boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.3), 0 8px 10px -6px rgba(0, 0, 0, 0.3)",
        display: "flex",
        alignItems: "center",
        gap: "1rem",
        maxWidth: "24rem",
      }}
    >
      <div style={{ flex: 1 }}>
        <h4 style={{ margin: 0, fontSize: "0.9375rem", fontWeight: 600, color: "var(--color-text)" }}>
          Update Available
        </h4>
        <p style={{ margin: "0.125rem 0 0 0", fontSize: "0.8125rem", color: "var(--color-text-muted)" }}>
          A new version of StellarSplit is waiting. Reload to optimize synchronization.
        </p>
      </div>
      <button
        onClick={applyUpdate}
        style={{
          backgroundColor: "var(--color-accent)",
          color: "#ffffff",
          border: "none",
          borderRadius: "0.375rem",
          padding: "0.5rem 0.875rem",
          fontSize: "0.8125rem",
          fontWeight: 600,
          cursor: "pointer",
          whiteSpace: "nowrap",
          transition: "opacity 0.2s",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.9")}
        onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
      >
        Reload Now
      </button>
    </div>
  );
}

export default function App() {
  useEffect(() => {
    // Fired cleanly exactly once across dev environments and strict rendering tests
    registerServiceWorker();
  }, []);

  return (
    <div className="dashboard-root">
      {/* Your primary dashboard layout sub-components sit here */}
      <UpdateNotificationBanner />
    </div>
  );
}