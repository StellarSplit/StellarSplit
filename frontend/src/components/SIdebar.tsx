import { NavLink } from "react-router-dom";
import { getNavigationRoutes } from "../routes/routeCatalog";
import { LanguageSelector } from "./LanguageSelector";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  return (
    <>
      {/* Backdrop — mobile only, shown when sidebar is open */}
      {isOpen && (
        <div
          onClick={onClose}
          aria-hidden="true"
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(15, 17, 23, 0.4)",
            backdropFilter: "blur(4px)",
            zIndex: 39,
          }}
          className="lg:hidden"
        />
      )}

      <aside
        aria-label="Sidebar navigation"
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          bottom: 0,
          width: "14rem",
          backgroundColor: "var(--color-card)",
          borderRight: "1px solid var(--color-border)",
          display: "flex",
          flexDirection: "column",
          zIndex: 40,
          overflowY: "auto",
          transition: "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        }}
        className={`${isOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0`}
      >
        {/* Accent top line */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "2px",
            background: "linear-gradient(90deg, var(--color-accent), transparent)",
            opacity: 0.8,
          }}
        />

        {/* ── Brand Section with Logo Integration ── */}
        <div
          style={{
            padding: "1.25rem 1.25rem 1rem",
            display: "flex",
            alignItems: "center",
            justify-content: "space-between",
            borderBottom: "1px solid var(--color-border)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <img
              src="/stellarsplit-logo.png"
              alt="StellarSplit Logo"
              style={{
                height: "1.75rem",
                width: "auto",
                objectFit: "contain",
              }}
            />
            <span
              style={{
                fontWeight: 700,
                fontSize: "1rem",
                color: "var(--color-accent)",
                letterSpacing: "-0.02em",
                whiteSpace: "nowrap",
              }}
            >
              StellarSplit
            </span>
          </div>

          {/* Close button — visible on mobile only */}
          <button
            onClick={onClose}
            className="lg:hidden"
            aria-label="Close sidebar"
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: "var(--color-text-muted)",
              padding: "0.25rem",
              borderRadius: "0.375rem",
              display: "flex",
              alignItems: "center",
              justify-content: "center",
            }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path
                d="M6 18L18 6M6 6l12 12"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>

        {/* ── Nav Links Navigation Track ── */}
        <nav
          style={{
            flex: 1,
            padding: "1rem 0.75rem",
            display: "flex",
            flexDirection: "column",
            gap: "0.2rem",
          }}
        >
          <span
            style={{
              fontSize: "0.65rem",
              fontWeight: 600,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "var(--color-text-muted)",
              padding: "0 0.5rem",
              marginBottom: "0.4rem",
            }}
          >
            Navigation
          </span>

          {getNavigationRoutes().map((route) => (
            <NavLink
              key={route.id}
              to={route.path}
              onClick={onClose}
              style={({ isActive }) => ({
                display: "flex",
                alignItems: "center",
                gap: "0.65rem",
                padding: "0.6rem 0.75rem",
                borderRadius: "0.5rem",
                fontSize: "0.9rem",
                fontWeight: 500,
                textDecoration: "none",
                color: isActive ? "var(--color-accent)" : "var(--color-text-muted)",
                backgroundColor: isActive
                  ? "color-mix(in srgb, var(--color-accent) 12%, transparent)"
                  : "transparent",
                borderLeft: isActive
                  ? "2px solid var(--color-accent)"
                  : "2px solid transparent",
                transition: "all 0.15s ease",
              })}
              onMouseEnter={(e) => {
                if (!e.currentTarget.getAttribute("aria-current")) {
                  e.currentTarget.style.color = "var(--color-text)";
                  e.currentTarget.style.backgroundColor =
                    "color-mix(in srgb, var(--color-accent) 6%, transparent)";
                }
              }}
              onMouseLeave={(e) => {
                if (!e.currentTarget.getAttribute("aria-current")) {
                  e.currentTarget.style.color = "var(--color-text-muted)";
                  e.currentTarget.style.backgroundColor = "transparent";
                }
              }}
            >
              <span
                style={{
                  width: "6px",
                  height: "6px",
                  borderRadius: "50%",
                  backgroundColor: "currentColor",
                  opacity: 0.6,
                  flexShrink: 0,
                }}
              />
              {route.label}
            </NavLink>
          ))}

          {/* Open-Source Infrastructure Track */}
          <a
            href="https://github.com/OlufunbiIK/StellarSplit"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.65rem",
              padding: "0.6rem 0.75rem",
              borderRadius: "0.5rem",
              fontSize: "0.9rem",
              fontWeight: 500,
              textDecoration: "none",
              color: "var(--color-text-muted)",
              borderLeft: "2px solid transparent",
              transition: "all 0.15s ease",
              marginTop: "0.5rem",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "var(--color-text)";
              e.currentTarget.style.backgroundColor =
                "color-mix(in srgb, var(--color-accent) 6%, transparent)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "var(--color-text-muted)";
              e.currentTarget.style.backgroundColor = "transparent";
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
            </svg>
            GitHub
          </a>
        </nav>

        {/* ── Language Selector — pinned to bottom with safe area layout bottom inset ── */}
        <div
          style={{
            padding: "1rem 1.25rem calc(1rem + var(--sab, env(safe-area-inset-bottom)))",
            borderTop: "1px solid var(--color-border)",
            display: "flex",
            alignItems: "center",
            justify-content: "space-between",
            backgroundColor: "var(--color-card)",
          }}
        >
          <span
            style={{
              fontSize: "0.8rem",
              fontWeight: 500,
              color: "var(--color-text-muted)",
            }}
          >
            Language
          </span>
          <LanguageSelector />
        </div>
      </aside>
    </>
  );
}