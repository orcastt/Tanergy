import { useNavigate } from "react-router-dom"
import { useLicenseStore } from "../store/licenseStore"
import { useThemeStore } from "../store/themeStore"
import { useLangStore } from "../store/langStore"
import CreditBalance from "./CreditBalance"

export default function TopNav() {
  const navigate = useNavigate()
  const { status } = useLicenseStore()
  const { theme, toggleTheme } = useThemeStore()
  const { lang, toggleLang } = useLangStore()

  const label = status === "active" ? "Pro" : status === "trial" ? "Trial" : "Free"
  const labelColor = status === "active" ? "#22c55e" : status === "trial" ? "#f59e0b" : "#737373"

  return (
    <header style={{
      background: "var(--bg-surface)",
      backdropFilter: "blur(12px)",
      position: "fixed", top: 0, right: 0, left: 0, zIndex: 50,
      boxShadow: "0 0 0 1px var(--border-subtle), var(--shadow-sm)",
      display: "flex", justifyContent: "space-between", alignItems: "center",
      width: "100%", padding: "0.75rem 1.5rem", height: "64px", boxSizing: "border-box",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "1.5rem" }}>
        <span style={{
          fontFamily: '"Space Grotesk", sans-serif',
          fontSize: "1.25rem", fontWeight: 600, letterSpacing: "-0.03em", color: "var(--text-primary)",
        }}>
          TANGENT AI
        </span>
        <nav style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <button
            onClick={() => navigate("/dashboard")}
            style={{
              fontFamily: '"Space Grotesk", sans-serif',
              fontWeight: 700, fontSize: "0.875rem", color: "var(--text-primary)",
              background: "none", border: "none", cursor: "pointer",
              borderBottom: "2px solid var(--text-primary)", paddingBottom: "0.25rem",
            }}
          >
            Main Workspace
          </button>
        </nav>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
        <CreditBalance />
        {/* Language toggle */}
        <button onClick={toggleLang} style={{
          background: "none", border: "none", cursor: "pointer",
          color: "var(--text-secondary)", fontSize: "0.75rem", fontWeight: 600,
          display: "flex", alignItems: "center", gap: "0.25rem",
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: "1rem" }}>translate</span>
          {lang.toUpperCase()}
        </button>
        {/* Theme toggle */}
        <button onClick={toggleTheme} style={{
          background: "none", border: "none", cursor: "pointer",
          color: "var(--text-secondary)", fontSize: "1.125rem", display: "flex",
        }}>
          <span className="material-symbols-outlined">
            {theme === "dark" ? "light_mode" : "dark_mode"}
          </span>
        </button>
        {/* License badge */}
        <button
          onClick={() => navigate("/settings")}
          style={{
            fontSize: "0.75rem", fontWeight: 600, color: labelColor,
            background: "transparent", border: `1px solid ${labelColor}`,
            borderRadius: 4, padding: "0.2rem 0.5rem", cursor: "pointer",
          }}
        >
          {label}
        </button>
        <button onClick={() => navigate("/settings")} style={{ background: "none", border: "none", color: "var(--text-secondary)", cursor: "pointer" }}>
          <span className="material-symbols-outlined">settings</span>
        </button>
      </div>
    </header>
  )
}
