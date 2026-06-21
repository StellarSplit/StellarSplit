import { ThemeToggle } from "./ThemeToggle";
import { WalletButton } from "./wallet-button";

interface NavbarProps {
  onMenuOpen?: () => void;
}

export default function Navbar({ onMenuOpen }: NavbarProps) {
  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 30,
        width: "100%",
        backgroundColor: "color-mix(in srgb, var(--color-surface) 85%, transparent)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        borderBottom: "1px solid var(--color-border)",
        /* Hardware Safe-Area Notch Guard padding-top layout update */
        paddingTop: "var(--sat, env(safe-area-inset-top, 0px))",
      }}
    >
      {/* Accent top line */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "2px",
          background: "linear-gradient(90deg, transparent, var(--color-accent), transparent)",
          opacity: 0.6,
        }}
      />

      <div
        style={{
          padding: "0 1.25rem",
          height: "3.5rem",
          display: "flex",
          alignItems: "center",
          justify-content: "space-between",
        }}
      >
        {/* ── Left: hamburger (mobile only) + brand asset image update ── */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          {/* Hamburger — hidden on lg+ since sidebar is always visible there */}
          <button
            onClick={() => onMenuOpen?.()}
            className="lg:hidden"
            aria-label="Open navigation menu"
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: "var(--color-text-muted)",
              padding: "0.35rem",
              borderRadius: "0.375rem",
              display: "flex",
              alignItems: "center",
              justify-content: "center",
              transition: "color 0.15s, background-color 0.15s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "var(--color-text)";
              e.currentTarget.style.backgroundColor =
                "color-mix(in srgb, var(--color-accent) 10%, transparent)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "var(--color-text-muted)";
              e.currentTarget.style.backgroundColor = "transparent";
            }}
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path
                d="M4 6h16M4 12h16M4 18h16"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>

          {/* Brand — Real logo asset integration replaces the placeholder SVG paths */}
          <div
            className="lg:hidden"
            style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
          >
            <img
              src="/stellarsplit-logo.png"
              alt="StellarSplit Mobile Brand Logo"
              style={{
                height: "1.5rem",
                width: "auto",
                objectFit: "contain",
              }}
            />
            <span
              style={{
                fontWeight: 700,
                fontSize: "0.95rem",
                color: "var(--color-accent)",
                letterSpacing: "-0.02em",
              }}
            >
              StellarSplit
            </span>
          </div>
        </div>

        {/* ── Right: ThemeToggle + divider + WalletButton ── */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <ThemeToggle />

          <div
            style={{
              width: "1px",
              height: "1.4rem",
              backgroundColor: "var(--color-border)",
            }}
          />

          <WalletButton
            style={{
              background:
                "linear-gradient(135deg, var(--color-accent), color-mix(in srgb, var(--color-accent) 70%, #a78bfa))",
              color: "#ffffff",
              border: "none",
              borderRadius: "0.5rem",
              padding: "0.45rem 1rem",
              fontWeight: 600,
              fontSize: "0.875rem",
              cursor: "pointer",
              boxShadow: "0 0 12px color-mix(in srgb, var(--color-accent) 25%, transparent)",
              transition: "opacity 0.2s, box-shadow 0.2s",
              whiteSpace: "nowrap",
            }}
          >
            <span className="hidden sm:inline">Connect Wallet</span>
            <span className="sm:hidden">Connect</span>
          </WalletButton>
        </div>
      </div>
    </header>
  );
}