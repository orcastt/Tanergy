import { useNavigate } from "react-router-dom"
import { useCreditsStore } from "../store/creditsStore"

export default function CreditBalance() {
  const navigate = useNavigate()
  const { balance, isLoggedIn } = useCreditsStore()

  if (!isLoggedIn) return null

  return (
    <div
      onClick={() => navigate("/credits")}
      style={{
        display: "flex", alignItems: "center", gap: "0.25rem",
        padding: "0.25rem 0.625rem", background: balance < 20 ? "#fef2f2" : "#f5f3f3",
        borderRadius: "1rem", cursor: "pointer", fontSize: "0.6875rem",
        color: balance < 20 ? "#991b1b" : "#1b1c1c", fontWeight: 500,
        border: balance < 20 ? "1px solid #fecaca" : "1px solid #e3e2e2",
      }}
    >
      <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>bolt</span>
      {balance}
    </div>
  )
}
