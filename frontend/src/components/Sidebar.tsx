import { NavLink } from "react-router-dom";
import {
  Home,
  BarChart2,
  TrendingUp,
  Users,
  Clock,
  FileText,
  Bell,
  PlusCircle,
  Calculator,
} from "lucide-react";
import { getNavigationRoutes, getToolRoutes } from "../routes/routeCatalog";
import { LanguageSelector } from "./LanguageSelector";
import type { ReactNode } from "react";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const routeIcons: Record<string, ReactNode> = {
  home: <Home size={16} strokeWidth={1.75} />,
  dashboard: <BarChart2 size={16} strokeWidth={1.75} />,
  analytics: <TrendingUp size={16} strokeWidth={1.75} />,
  "split-groups": <Users size={16} strokeWidth={1.75} />,
  history: <Clock size={16} strokeWidth={1.75} />,
  drafts: <FileText size={16} strokeWidth={1.75} />,
  notifications: <Bell size={16} strokeWidth={1.75} />,
  "create-split": <PlusCircle size={16} strokeWidth={1.75} />,
  calculator: <Calculator size={16} strokeWidth={1.75} />,
};

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const navRoutes = getNavigationRoutes();
  const toolRoutes = getToolRoutes();

  return (
    <>
      {/* Backdrop — mobile only */}
      {isOpen && (
        <div
          onClick={onClose}
          aria-hidden="true"
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.45)",
            backdropFilter: "blur(2px)",
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
            background:
              "linear-gradient(90deg, var(--color-accent), transparent)",
            opacity: 0.8,
          }}
        />

        {/* ── Brand ── */}
        <div
          style={{
            padding: "1.25rem 1.25rem 1rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottom: "1px solid var(--color-border)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <polygon
                points="12,2 22,20 2,20"
                stroke="var(--color-accent)"
                strokeWidth="2"
                fill="color-mix(in srgb, var(--color-accent) 15%, transparent)"
              />
            </svg>
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

          {/* Close button — mobile only */}
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
              justifyContent: "center",
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

        {/* ── Nav links ── */}
        <nav
          style={{
            flex: 1,
            padding: "1rem 0.75rem",
            display: "flex",
            flexDirection: "column",
            gap: "0.2rem",
          }}
        >
          {/* Main navigation */}
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

          {navRoutes.map((route) => (
            <NavLink
              key={route.id}
              to={route.path}
              onClick={onClose}
              className="sidebar-link"
              style={({ isActive }) =>
                isActive
                  ? {
                      color: "var(--color-accent)",
                      backgroundColor:
                        "color-mix(in srgb, var(--color-accent) 12%, transparent)",
                      borderLeftColor: "var(--color-accent)",
                    }
                  : {}
              }
            >
              {routeIcons[route.id]}
              {route.label}
            </NavLink>
          ))}

          {/* ── Divider ── */}
          <hr
            style={{
              border: "none",
              borderTop: "1px solid var(--color-border)",
              margin: "0.75rem 0.5rem",
            }}
          />

          {/* Tools section */}
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
            Tools
          </span>

          {toolRoutes.map((route) => (
            <NavLink
              key={route.id}
              to={route.path}
              onClick={onClose}
              className="sidebar-link"
              style={({ isActive }) =>
                isActive
                  ? {
                      color: "var(--color-accent)",
                      backgroundColor:
                        "color-mix(in srgb, var(--color-accent) 12%, transparent)",
                      borderLeftColor: "var(--color-accent)",
                    }
                  : {}
              }
            >
              {routeIcons[route.id]}
              {route.label}
            </NavLink>
          ))}

          {/* GitHub link */}
          <a
            href="https://github.com/OlufunbiIK/StellarSplit"
            target="_blank"
            rel="noopener noreferrer"
            className="sidebar-link"
            style={{ marginTop: "0.5rem" }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
            </svg>
            GitHub
          </a>
        </nav>

        {/* ── Language selector ── */}
        <div
          style={{
            padding: "1rem 1.25rem",
            borderTop: "1px solid var(--color-border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
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
