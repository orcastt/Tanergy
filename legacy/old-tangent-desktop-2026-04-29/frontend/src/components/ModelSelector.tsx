import { useEffect, useMemo } from "react"
import { getModelsByCategory, type ModelCategory } from "../nodes/modelDefs"
import { useCreditsStore } from "../store/creditsStore"
import { useTranslation } from "react-i18next"
import {
  getRemoteModelsByCategory,
  resolveDefaultModel,
  useOfficialModelsStore,
} from "../store/officialModelsStore"

interface Props {
  category: ModelCategory
  value: string | undefined
  onChange: (model: string) => void
}

export default function ModelSelector({ category, value, onChange }: Props) {
  const { t } = useTranslation()
  const isLoggedIn = useCreditsStore((s) => s.isLoggedIn)
  const remoteModels = useOfficialModelsStore((s) => s.models)
  const refreshModels = useOfficialModelsStore((s) => s.refresh)
  const models = useMemo(() => {
    const fallbackModels = getModelsByCategory(category)
    const filtered = getRemoteModelsByCategory(category, remoteModels)
    return filtered && filtered.length > 0 ? filtered : fallbackModels
  }, [category, remoteModels])
  const selectedValue = models.some((m) => m.id === value) ? value : resolveDefaultModel(category, remoteModels)

  useEffect(() => {
    if (isLoggedIn && remoteModels === null) void refreshModels()
  }, [isLoggedIn, remoteModels, refreshModels])

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
