import { KeysTab } from "./KeysTabContent"
import { useTranslation } from "react-i18next"
import { useThemeStore } from "../../store/themeStore"
import { useLangStore } from "../../store/langStore"

export function AdvancedTab() {
  const { t } = useTranslation()
  const { theme, toggleTheme } = useThemeStore()
  const { lang, toggleLang } = useLangStore()

  return (
    <div>
      <h2 style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: "1.25rem", fontWeight: 600, marginBottom: "1rem" }}>
        {t("settings.advanced")}
      </h2>

      {/* Theme & Language */}
      <div style={{
        display: "flex", gap: "1rem", marginBottom: "1.5rem",
      }}>
        <div style={{
          flex: 1, display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "0.75rem 1rem", borderRadius: 8, border: "1px solid var(--border-color)",
          background: "var(--bg-surface)",
        }}>
          <div>
            <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--text-primary)" }}>{t("settings.theme")}</div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "0.125rem" }}>
              {theme === "dark" ? "Dark" : "Light"}
            </div>
          </div>
          <button onClick={toggleTheme} style={{
            padding: "0.375rem 1rem", borderRadius: 6, border: "none",
            background: theme === "dark" ? "#1a1a1a" : "#f5f5f5",
            color: "var(--text-primary)", fontSize: "0.8125rem", fontWeight: 600,
            cursor: "pointer", minWidth: "60px",
          }}>
            {theme === "dark" ? "Dark" : "Light"}
          </button>
        </div>
        <div style={{
          flex: 1, display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "0.75rem 1rem", borderRadius: 8, border: "1px solid var(--border-color)",
          background: "var(--bg-surface)",
        }}>
          <div>
            <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--text-primary)" }}>{t("settings.language")}</div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "0.125rem" }}>
              {lang === "en" ? "English" : "中文"}
            </div>
          </div>
          <button onClick={toggleLang} style={{
            padding: "0.375rem 1rem", borderRadius: 6, border: "none",
            background: "var(--bg-hover)", color: "var(--text-primary)",
            fontSize: "0.8125rem", fontWeight: 600, cursor: "pointer", minWidth: "60px",
          }}>
            {lang.toUpperCase()}
          </button>
        </div>
      </div>

      {/* API Keys (reuse existing component) */}
      <KeysTab />
    </div>
  )
}
