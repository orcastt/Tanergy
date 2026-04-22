import { useNavigate } from "react-router-dom"
import { useLicenseStore } from "../store/licenseStore"
import CreditBalance from "./CreditBalance"

export default function TopNav() {
  const navigate = useNavigate()
  const { status } = useLicenseStore()

  const label =
    status === "active"
      ? "Pro"
      : status === "trial"
        ? "Trial"
        : "Free"

  const labelColor =
    status === "active"
      ? "#22c55e"
      : status === "trial"
        ? "#f59e0b"
        : "#737373"

  return (
    <header
      style={{
        background: "rgba(255,255,255,0.8)",
        backdropFilter: "blur(12px)",
        position: "fixed",
        top: 0,
        right: 0,
        left: 0,
        zIndex: 50,
        boxShadow: "0 0 0 1px rgba(0,0,0,0.05), 0 1px 2px 0 rgba(0,0,0,0.05)",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        width: "100%",
        padding: "0.75rem 1.5rem",
        height: "64px",
        boxSizing: "border-box",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "1.5rem" }}>
        <span style={{
          fontFamily: '"Space Grotesk", sans-serif',
          fontSize: "1.25rem", fontWeight: 600, letterSpacing: "-0.03em", color: "#171717",
        }}>
          TANGENT AI
        </span>
        <nav style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <button
            onClick={() => navigate("/dashboard")}
            style={{
              fontFamily: '"Space Grotesk", sans-serif',
              fontWeight: 700, fontSize: "0.875rem", color: "#171717",
              background: "none", border: "none", cursor: "pointer",
              borderBottom: "2px solid #171717", paddingBottom: "0.25rem",
            }}
          >
            Main Workspace
          </button>
        </nav>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
        <CreditBalance />
        <button
          onClick={() => navigate("/settings")}
          style={{
            fontSize: "0.75rem",
            fontWeight: 600,
            color: labelColor,
            background: "transparent",
            border: `1px solid ${labelColor}`,
            borderRadius: 4,
            padding: "0.2rem 0.5rem",
            cursor: "pointer",
          }}
        >
          {label}
        </button>
        <button onClick={() => navigate("/settings")} style={{ background: "none", border: "none", color: "#737373", cursor: "pointer" }}>
          <span className="material-symbols-outlined">settings</span>
        </button>
      </div>
    </header>
  )
}
