import { useState, useEffect } from "react"
import { useTranslation } from "react-i18next"
import { useThemeStore } from "../../store/themeStore"
import { useLangStore } from "../../store/langStore"
import { tauri } from "../../services/tauri"

export function AdvancedTab() {
  const { t } = useTranslation()
  const { theme, toggleTheme } = useThemeStore()
  const { lang, toggleLang } = useLangStore()
  const [mockMode, setMockMode] = useState(false)

  useEffect(() => {
    tauri.getAppConfig("mock_mode")
      .then((v) => setMockMode(v === "true"))
      .catch(() => setMockMode(false))
  }, [])

  async function toggleMock() {
    const next = !mockMode
    setMockMode(next)
    await tauri.setAppConfig("mock_mode", next ? "true" : "false")
  }

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
              {theme === "dark" ? t("settings.dark") : t("settings.light")}
            </div>
          </div>
          <button onClick={toggleTheme} style={{
            padding: "0.375rem 1rem", borderRadius: 6, border: "none",
            background: theme === "dark" ? "#1a1a1a" : "#f5f5f5",
            color: "var(--text-primary)", fontSize: "0.8125rem", fontWeight: 600,
            cursor: "pointer", minWidth: "60px",
          }}>
            {theme === "dark" ? t("settings.dark") : t("settings.light")}
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

      {/* Mock Mode */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0.75rem 1rem", borderRadius: 8, border: "1px solid var(--border-color)",
        background: "var(--bg-surface)", marginBottom: "1.5rem",
      }}>
        <div>
          <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--text-primary)" }}>{t("settings.mockMode")}</div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "0.125rem" }}>
            {t("settings.mockModeDesc")}
          </div>
        </div>
        <button
          onClick={toggleMock}
          style={{
            width: 44, height: 24, borderRadius: 12, border: "none",
            background: mockMode ? "#22c55e" : "var(--border-color)",
            position: "relative", cursor: "pointer", transition: "background 200ms",
          }}
        >
          <div style={{
            width: 20, height: 20, borderRadius: 10, background: "#fff",
            position: "absolute", top: 2,
            left: mockMode ? 22 : 2,
            transition: "left 200ms",
          }} />
        </button>
      </div>

      <div style={{
        padding: "1rem", borderRadius: 8, border: "1px solid var(--border-color)",
        background: "var(--bg-surface)",
      }}>
        <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--text-primary)" }}>
          {t("settings.officialRoute")}
        </div>
        <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "0.25rem", lineHeight: 1.6 }}>
          {t("settings.officialRouteDesc")}
        </div>
      </div>
    </div>
  )
}
