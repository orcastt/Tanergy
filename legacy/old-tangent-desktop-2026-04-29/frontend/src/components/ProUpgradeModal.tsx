import { useState } from "react"
import { tauri } from "../services/tauri"
import { useTranslation } from "react-i18next"

interface Props {
  onClose: () => void
}

export default function ProUpgradeModal({ onClose }: Props) {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleCheckout = async (plan: "monthly" | "yearly") => {
    setLoading(true)
    setError(null)
    try {
      const { url } = await tauri.createCheckout(plan)
      window.open(url, "_blank")
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 100,
        background: "rgba(0,0,0,0.5)", display: "flex",
        alignItems: "center", justifyContent: "center",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--bg-surface)", borderRadius: "0.75rem",
          padding: "2rem", maxWidth: "480px", width: "100%",
          boxShadow: "0 25px 50px rgba(0,0,0,0.25)",
        }}
      >
        <h2 style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: "0.5rem" }}>
          {t("credits.proMembership")}
        </h2>
        <p style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", marginBottom: "1.5rem" }}>
          {t("credits.proBenefits")}
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
          <button
            onClick={() => handleCheckout("monthly")}
            disabled={loading}
            style={{
              padding: "1rem", borderRadius: "0.5rem",
              border: "1px solid var(--border-color)", background: "var(--bg-input)",
              cursor: loading ? "default" : "pointer", textAlign: "center",
            }}
          >
            <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginBottom: "0.25rem" }}>Monthly</div>
            <div style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--text-primary)" }}>{t("credits.monthly")}</div>
            <div style={{ fontSize: "0.6875rem", color: "var(--text-secondary)", marginTop: "0.25rem" }}>500 credits/month</div>
          </button>
          <button
            onClick={() => handleCheckout("yearly")}
            disabled={loading}
            style={{
              padding: "1rem", borderRadius: "0.5rem",
              border: "2px solid #6349EA", background: "rgba(99,73,234,0.05)",
              cursor: loading ? "default" : "pointer", textAlign: "center",
            }}
          >
            <div style={{ fontSize: "0.75rem", color: "#6349EA", marginBottom: "0.25rem" }}>Best Value</div>
            <div style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--text-primary)" }}>{t("credits.yearly")}</div>
            <div style={{ fontSize: "0.6875rem", color: "var(--text-secondary)", marginTop: "0.25rem" }}>6000 credits/year</div>
          </button>
        </div>

        {error && (
          <div style={{ marginTop: "0.75rem", fontSize: "0.75rem", color: "#991b1b" }}>{error}</div>
        )}

        <button
          onClick={onClose}
          style={{
            marginTop: "1rem", width: "100%", padding: "0.5rem",
            background: "none", border: "1px solid var(--border-color)",
            borderRadius: "0.375rem", cursor: "pointer", color: "var(--text-secondary)",
            fontSize: "0.8125rem",
          }}
        >
          {t("common.cancel")}
        </button>
      </div>
    </div>
  )
}
