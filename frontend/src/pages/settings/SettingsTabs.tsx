import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { useLicenseStore } from "../../store/licenseStore"
export { KeysTab } from "./KeysTabContent"

export const btnBase: React.CSSProperties = {
  padding: "0.5rem 1rem", borderRadius: 6, border: "none",
  background: "#242424", color: "#fff", fontSize: "0.8125rem",
  fontWeight: 500, cursor: "pointer", fontFamily: '"Inter", sans-serif', whiteSpace: "nowrap",
}

export function LicenseTab() {
  const { status, expiresAt, trialEndsAt, checkStatus, activate, deactivate } = useLicenseStore()
  const { t } = useTranslation()
  const [input, setInput] = useState("")
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  useEffect(() => { checkStatus() }, [checkStatus])

  const handleActivate = async () => {
    if (!input.trim()) return
    const ok = await activate(input.trim())
    setMsg(ok ? { ok: true, text: t("settings.activated") } : { ok: false, text: t("settings.invalidKey") })
    if (ok) setInput("")
  }

  const handleDeactivate = async () => { await deactivate(); setMsg({ ok: true, text: t("settings.deactivated") }) }

  const statusLabel =
    status === "active" ? t("settings.proExpires", { date: expiresAt ?? "" })
      : status === "trial" ? t("settings.trialDays", { days: trialEndsAt ?? "?" })
        : status === "expired" ? t("settings.expired") : t("settings.free")

  return (
    <div>
      <h2 style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: "1.25rem", fontWeight: 600, marginBottom: "1rem" }}>
        {t("settings.license")}
      </h2>
      <div style={{ background: "var(--bg-surface)", borderRadius: 8, border: "1px solid var(--border-color)", padding: "1rem 1.25rem", marginBottom: "1rem" }}>
        <span style={{ fontSize: "0.875rem", color: "var(--text-primary)" }}>{t("settings.currentStatus")}</span>
        <span style={{ fontSize: "0.875rem", fontWeight: 600, color: status === "active" ? "#22c55e" : "var(--text-secondary)" }}>
          {statusLabel}
        </span>
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder={t("settings.enterLicenseKey")}
          onKeyDown={(e) => e.key === "Enter" && handleActivate()}
          style={{ flex: 1, padding: "0.5rem 0.75rem", borderRadius: 6, border: "1px solid var(--border-color)", fontSize: "0.8125rem", fontFamily: '"Inter", sans-serif', outline: "none" }}
        />
        <button onClick={handleActivate} disabled={!input.trim()} style={{ ...btnBase, opacity: input.trim() ? 1 : 0.4 }}>{t("settings.activate")}</button>
        {status === "active" && (
          <button onClick={handleDeactivate} style={{ ...btnBase, background: "transparent", color: "#ef4444", border: "1px solid #fecaca" }}>{t("settings.deactivate")}</button>
        )}
      </div>
      {msg && <p style={{ fontSize: "0.8125rem", color: msg.ok ? "#22c55e" : "#ef4444", marginTop: 8 }}>{msg.text}</p>}
    </div>
  )
}

export function GeneralTab() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  return (
    <div>
      <h2 style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: "1.25rem", fontWeight: 600, marginBottom: "1rem" }}>{t("settings.general")}</h2>
      <div style={{ background: "var(--bg-surface)", borderRadius: 8, border: "1px solid var(--border-color)", padding: "1rem 1.25rem" }}>
        <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)" }}>{t("settings.generalNote")}</p>
        <button onClick={() => navigate("/dashboard")} style={{ ...btnBase, marginTop: "1rem" }}>{t("settings.backDashboard")}</button>
      </div>
    </div>
  )
}
