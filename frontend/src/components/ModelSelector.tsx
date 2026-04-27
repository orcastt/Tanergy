import { useEffect, useMemo, useState } from "react"
import { getModelsByCategory, DEFAULT_MODELS, type ModelCategory } from "../nodes/modelDefs"
import { useCreditsStore } from "../store/creditsStore"
import { useTranslation } from "react-i18next"
import { tauri, type OfficialModel } from "../services/tauri"

interface Props {
  category: ModelCategory
  value: string | undefined
  onChange: (model: string) => void
}

export default function ModelSelector({ category, value, onChange }: Props) {
  const { t } = useTranslation()
  const [remoteModels, setRemoteModels] = useState<OfficialModel[] | null>(null)
  const isLoggedIn = useCreditsStore((s) => s.isLoggedIn)
  const models = useMemo(() => {
    const callType = category === "text" ? "chat" : category
    const fallbackModels = getModelsByCategory(category)
    const filtered = remoteModels
      ?.filter((m) => m.is_active && m.call_type === callType)
      .map((m) => ({
        id: m.model,
        name: m.display_name,
        provider: m.provider,
        category,
      }))
    return filtered && filtered.length > 0 ? filtered : fallbackModels
  }, [category, remoteModels])
  const selectedValue = models.some((m) => m.id === value) ? value : DEFAULT_MODELS[category]

  useEffect(() => {
    if (!isLoggedIn) {
      return
    }
    let cancelled = false
    tauri.listOfficialModels()
      .then((items) => {
        if (!cancelled) setRemoteModels(items)
      })
      .catch(() => {
        if (!cancelled) setRemoteModels(null)
      })
    return () => { cancelled = true }
  }, [isLoggedIn])

  return (
    <div style={{ position: "relative" }}>
      <select
        value={isLoggedIn ? selectedValue : ""}
        onChange={(e) => onChange(e.target.value)}
        disabled={!isLoggedIn}
        style={{
          fontSize: "0.6875rem",
          border: "1px solid var(--border-color)",
          borderRadius: "0.25rem",
          padding: "0.125rem 0.25rem",
          outline: "none",
          color: isLoggedIn ? "var(--text-primary)" : "var(--text-tertiary)",
          background: "var(--bg-input)",
          width: "100%",
          opacity: isLoggedIn ? 1 : 0.6,
          cursor: isLoggedIn ? "pointer" : "not-allowed",
        }}
      >
        {isLoggedIn ? (
          models.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))
        ) : (
          <option value="">{t("auth.loginToUseAi")}</option>
        )}
      </select>
    </div>
  )
}
