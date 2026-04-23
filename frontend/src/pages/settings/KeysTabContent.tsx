import { useState, useEffect } from "react"
import { useTranslation } from "react-i18next"
import { useApiKeyStore } from "../../store/apiKeyStore"
import type { ProviderInfo } from "../../types/license"

const btnBase: React.CSSProperties = {
  padding: "0.5rem 1rem", borderRadius: 6, border: "none",
  background: "#242424", color: "#fff", fontSize: "0.8125rem",
  fontWeight: 500, cursor: "pointer", fontFamily: '"Inter", sans-serif', whiteSpace: "nowrap",
}

export function KeysTab() {
  const { providers, testing, loadProviders, setKey, testKey, removeKey } = useApiKeyStore()
  const { t } = useTranslation()
  useEffect(() => { loadProviders() }, [loadProviders])

  return (
    <div>
      <h2 style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: "1.25rem", fontWeight: 600, marginBottom: "0.5rem" }}>
        {t("settings.provider")}
      </h2>
      <p style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", marginBottom: "1.5rem" }}>
        {t("settings.apiKeyDesc")}
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        {providers.map((p) => (
          <ProviderCard key={p.id} provider={p} isTesting={!!testing[p.id]}
            onSet={(key) => setKey(p.id, key)} onTest={() => testKey(p.id)} onRemove={() => removeKey(p.id)}
          />
        ))}
      </div>
    </div>
  )
}

function ProviderCard({ provider, isTesting, onSet, onTest, onRemove }: {
  provider: ProviderInfo; isTesting: boolean; onSet: (key: string) => void
  onTest: () => Promise<boolean>; onRemove: () => void
}) {
  const [input, setInput] = useState("")
  const { t } = useTranslation()
  const [error, setError] = useState<string | null>(null)
  const [showConfirm, setShowConfirm] = useState(false)

  const handleSet = () => { if (!input.trim()) return; onSet(input.trim()); setInput(""); setError(null) }
  const handleTest = async () => { setError(null); const ok = await onTest(); if (!ok) setError(t("settings.keyInvalid")) }
  const dotColor = provider.is_valid === true ? "#22c55e" : provider.is_valid === false ? "#ef4444" : "#d4d4d4"

  return (
    <div style={{ background: "var(--bg-surface)", borderRadius: 8, border: "1px solid var(--border-color)", padding: "1rem 1.25rem" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: dotColor, display: "inline-block" }} />
          <span style={{ fontFamily: '"Space Grotesk", sans-serif', fontWeight: 600, fontSize: "0.9375rem" }}>{provider.name}</span>
        </div>
        <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>{provider.base_url}</span>
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input type="password" value={input} onChange={(e) => setInput(e.target.value)}
          placeholder={provider.is_set ? t("settings.keySaved") : `${provider.key_prefix || t("settings.enterApiKey")}`}
          onKeyDown={(e) => e.key === "Enter" && handleSet()}
          style={{ flex: 1, padding: "0.5rem 0.75rem", borderRadius: 6, border: "1px solid var(--border-color)", fontSize: "0.8125rem", fontFamily: '"Inter", sans-serif', outline: "none" }}
        />
        <button onClick={handleSet} disabled={!input.trim()} style={{ ...btnBase, opacity: input.trim() ? 1 : 0.4 }}>{t("settings.save")}</button>
        {provider.is_set && (
          <button onClick={handleTest} disabled={isTesting}
            style={{ ...btnBase, background: "var(--bg-hover)", color: "var(--text-primary)" }}>
            {isTesting ? "..." : t("settings.test")}
          </button>
        )}
        {provider.is_set && !showConfirm && (
          <button onClick={() => setShowConfirm(true)}
            style={{ ...btnBase, background: "transparent", color: "#ef4444", border: "1px solid #fecaca" }}>{t("settings.delete")}</button>
        )}
        {showConfirm && (
          <div style={{ display: "flex", gap: 4 }}>
            <button onClick={() => { onRemove(); setShowConfirm(false) }}
              style={{ ...btnBase, background: "#ef4444", color: "#fff", fontSize: "0.75rem" }}>{t("settings.confirm")}</button>
            <button onClick={() => setShowConfirm(false)}
              style={{ ...btnBase, background: "var(--bg-hover)", color: "var(--text-primary)", fontSize: "0.75rem" }}>{t("settings.cancel")}</button>
          </div>
        )}
      </div>
      {error && <p style={{ color: "#ef4444", fontSize: "0.75rem", marginTop: 8 }}>{error}</p>}
    </div>
  )
}
