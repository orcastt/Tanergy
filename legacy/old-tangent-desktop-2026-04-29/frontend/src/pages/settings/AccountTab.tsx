import { useCreditsStore } from "../../store/creditsStore"
import { useTranslation } from "react-i18next"
import CreditBalance from "../../components/CreditBalance"
import ProUpgradeModal from "../../components/ProUpgradeModal"
import { useState } from "react"

export function AccountTab() {
  const { t } = useTranslation()
  const { balance, isLoggedIn, logout } = useCreditsStore()
  const [showUpgrade, setShowUpgrade] = useState(false)

  return (
    <div>
      <h2 style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: "1.25rem", fontWeight: 600, marginBottom: "1rem" }}>
        {t("settings.account")}
      </h2>

      {/* Login status */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "1rem 1.25rem", borderRadius: 8, border: "1px solid var(--border-color)",
        background: "var(--bg-surface)", marginBottom: "1rem",
      }}>
        <div>
          <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--text-primary)" }}>
            {isLoggedIn ? t("settings.loggedIn") : t("settings.notLoggedIn")}
          </div>
          {isLoggedIn && (
            <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "0.25rem" }}>
              {t("settings.creditsBalance", { balance })}
            </div>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          {isLoggedIn ? (
            <>
              <CreditBalance />
              <button
                onClick={() => setShowUpgrade(true)}
                style={{
                  padding: "0.375rem 0.75rem", borderRadius: 6, border: "1px solid #6349EA",
                  background: "transparent", color: "#6349EA", fontSize: "0.8125rem",
                  fontWeight: 600, cursor: "pointer",
                }}
              >
                {t("credits.proMembership")}
              </button>
              <button
                onClick={logout}
                style={{
                  padding: "0.375rem 0.75rem", borderRadius: 6, border: "1px solid #fecaca",
                  background: "transparent", color: "#ef4444", fontSize: "0.8125rem",
                  fontWeight: 500, cursor: "pointer",
                }}
              >
                {t("credits.logout")}
              </button>
            </>
          ) : (
            <span style={{ fontSize: "0.8125rem", color: "var(--text-secondary)" }}>
              <a href="/credits" style={{ color: "#6349EA", textDecoration: "none", fontWeight: 500 }}>
                {t("credits.loginOfficial")}
              </a>
            </span>
          )}
        </div>
      </div>

      {showUpgrade && <ProUpgradeModal onClose={() => setShowUpgrade(false)} />}
    </div>
  )
}
