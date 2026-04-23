import { getModelsByCategory, DEFAULT_MODELS, type ModelCategory } from "../nodes/modelDefs"
import { useCreditsStore } from "../store/creditsStore"
import { useApiKeyStore } from "../store/apiKeyStore"

interface Props {
  category: ModelCategory
  value: string | undefined
  onChange: (model: string) => void
}

export default function ModelSelector({ category, value, onChange }: Props) {
  const models = getModelsByCategory(category)
  const isLoggedIn = useCreditsStore((s) => s.isLoggedIn)
  const isProviderReady = useApiKeyStore((s) => s.isProviderReady)
  const hasNoAccess = !isLoggedIn && models.length <= 1

  if (hasNoAccess) return null

  return (
    <div style={{ position: "relative" }}>
      <select
        value={value ?? DEFAULT_MODELS[category]}
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
          models.map((m) => {
            const ready = isProviderReady(m.provider)
            return (
              <option
                key={m.id}
                value={m.id}
                disabled={!ready}
                style={!ready ? { color: "#999" } : undefined}
              >
                {m.name}{!ready ? " (no key)" : ""}
              </option>
            )
          })
        ) : (
          <option value="">Log in to use AI</option>
        )}
      </select>
    </div>
  )
}
