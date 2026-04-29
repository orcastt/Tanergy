import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useCreditsStore } from "../store/creditsStore"
import ProUpgradeModal from "./ProUpgradeModal"

export default function CreditBalance() {
  const navigate = useNavigate()
  const { balance, isLoggedIn } = useCreditsStore()
  const [showUpgrade, setShowUpgrade] = useState(false)

  if (!isLoggedIn) return null

  const lowBalance = balance < 20

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <div
          onClick={() => navigate("/credits")}
          style={{
            display: "flex", alignItems: "center", gap: "0.25rem",
            padding: "0.25rem 0.625rem",
            background: lowBalance ? "rgba(153,27,27,0.08)" : "var(--bg-input)",
            borderRadius: "1rem", cursor: "pointer", fontSize: "0.6875rem",
            color: lowBalance ? "#991b1b" : "var(--text-primary)", fontWeight: 500,
            border: lowBalance ? "1px solid #fecaca" : "1px solid var(--border-color)",
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>bolt</span>
          {balance}
        </div>
        {lowBalance && (
          <button
            onClick={() => setShowUpgrade(true)}
            style={{
              fontSize: "0.625rem", fontWeight: 600, color: "#6349EA",
              background: "transparent", border: "1px solid #6349EA",
              borderRadius: "0.25rem", padding: "0.125rem 0.375rem",
              cursor: "pointer", whiteSpace: "nowrap",
            }}
          >
            Upgrade
          </button>
        )}
      </div>
      {showUpgrade && <ProUpgradeModal onClose={() => setShowUpgrade(false)} />}
    </>
  )
}
