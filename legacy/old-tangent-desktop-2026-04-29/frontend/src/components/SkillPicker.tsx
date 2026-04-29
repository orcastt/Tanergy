import { useTranslation } from "react-i18next"
import { SKILL_DEFS } from "../nodes/skillDefs"

interface Props {
  onSelect: (skillId: string) => void
  onClose: () => void
}

export default function SkillPicker({ onSelect, onClose }: Props) {
  const { t } = useTranslation()

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
          padding: "1.5rem", maxWidth: "560px", width: "100%",
          boxShadow: "0 25px 50px rgba(0,0,0,0.25)",
        }}
      >
        <h2 style={{
          fontFamily: '"Space Grotesk", sans-serif',
          fontSize: "1.125rem", fontWeight: 700,
          color: "var(--text-primary)", marginBottom: "0.25rem",
        }}>
          {t("skills.title")}
        </h2>
        <p style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", marginBottom: "1.25rem" }}>
          {t("skills.subtitle")}
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
          {SKILL_DEFS.map((skill) => (
            <button
              key={skill.id}
              onClick={() => onSelect(skill.id)}
              style={{
                display: "flex", flexDirection: "column", alignItems: "flex-start",
                padding: "1rem", borderRadius: "0.5rem",
                border: "1px solid var(--border-color)", background: "var(--bg-surface)",
                cursor: "pointer", textAlign: "left", gap: "0.375rem",
                transition: "border-color 150ms ease",
              }}
              onMouseEnter={(e) => e.currentTarget.style.borderColor = skill.color}
              onMouseLeave={(e) => e.currentTarget.style.borderColor = "var(--border-color)"}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <div style={{
                  width: "2rem", height: "2rem", borderRadius: "0.375rem",
                  background: `${skill.color}15`, display: "flex",
                  alignItems: "center", justifyContent: "center",
                }}>
                  <span className="material-symbols-outlined" style={{ fontSize: "1.125rem", color: skill.color }}>
                    {skill.icon}
                  </span>
                </div>
                <span style={{
                  fontFamily: '"Space Grotesk", sans-serif',
                  fontSize: "0.9375rem", fontWeight: 600, color: "var(--text-primary)",
                }}>
                  {t(skill.labelKey)}
                </span>
              </div>
              <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)", lineHeight: 1.4, paddingLeft: "2.5rem" }}>
                {t(skill.descKey)}
              </span>
            </button>
          ))}
        </div>

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
