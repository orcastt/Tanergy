import { useTranslation } from "react-i18next"

export function AboutTab() {
  const { t } = useTranslation()

  return (
    <div>
      <h2 style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: "1.25rem", fontWeight: 600, marginBottom: "1rem" }}>
        {t("settings.about")}
      </h2>

      <div style={{
        padding: "1.25rem", borderRadius: 8, border: "1px solid var(--border-color)",
        background: "var(--bg-surface)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}>
          <span style={{
            fontFamily: '"Space Grotesk", sans-serif', fontSize: "1.5rem",
            fontWeight: 700, color: "var(--text-primary)",
          }}>
            TANGENT AI
          </span>
          <span style={{
            fontSize: "0.6875rem", fontWeight: 500, color: "var(--text-secondary)",
            background: "var(--bg-hover)", padding: "0.125rem 0.5rem", borderRadius: 4,
          }}>
            v1.0.0
          </span>
        </div>
        <p style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: "1rem" }}>
          {t("settings.aboutDesc")}
        </p>
        <div style={{ display: "flex", gap: "1rem" }}>
          <a href="https://tangent.ai" target="_blank" rel="noreferrer"
            style={{ fontSize: "0.8125rem", color: "#6349EA", textDecoration: "none", fontWeight: 500 }}>
            Website
          </a>
          <a href="https://github.com/tangent-ai" target="_blank" rel="noreferrer"
            style={{ fontSize: "0.8125rem", color: "#6349EA", textDecoration: "none", fontWeight: 500 }}>
            GitHub
          </a>
          <a href="mailto:support@tangent.ai"
            style={{ fontSize: "0.8125rem", color: "#6349EA", textDecoration: "none", fontWeight: 500 }}>
            {t("settings.feedback")}
          </a>
        </div>
      </div>
    </div>
  )
}
