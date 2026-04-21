import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { useLicenseStore } from "../store/licenseStore"
import { useApiKeyStore } from "../store/apiKeyStore"
import TopNav from "../components/TopNav"
import type { ProviderInfo } from "../types/license"

type Tab = "keys" | "license" | "general"

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>("keys")
  return (
    <div style={{ minHeight: "100vh", background: "#f5f3f3" }}>
      <TopNav />
      <div style={{ display: "flex", paddingTop: "64px", minHeight: "100vh" }}>
        <Sidebar tab={tab} onTab={setTab} />
        <main style={{ flex: 1, padding: "2rem", maxWidth: 720 }}>
          {tab === "keys" && <KeysTab />}
          {tab === "license" && <LicenseTab />}
          {tab === "general" && <GeneralTab />}
        </main>
      </div>
    </div>
  )
}

function Sidebar({ tab, onTab }: { tab: Tab; onTab: (t: Tab) => void }) {
  const items: { id: Tab; label: string }[] = [
    { id: "keys", label: "API Keys" },
    { id: "license", label: "License" },
    { id: "general", label: "General" },
  ]
  return (
    <nav
      style={{
        width: 200,
        borderRight: "1px solid #e5e5e5",
        padding: "2rem 0.75rem",
        background: "#fff",
        flexShrink: 0,
      }}
    >
      {items.map((item) => (
        <button
          key={item.id}
          onClick={() => onTab(item.id)}
          style={{
            display: "block",
            width: "100%",
            textAlign: "left",
            padding: "0.5rem 0.75rem",
            marginBottom: 4,
            border: "none",
            borderRadius: 6,
            cursor: "pointer",
            fontFamily: '"Inter", sans-serif',
            fontSize: "0.875rem",
            fontWeight: tab === item.id ? 600 : 400,
            color: tab === item.id ? "#171717" : "#737373",
            background: tab === item.id ? "#f5f5f5" : "transparent",
          }}
        >
          {item.label}
        </button>
      ))}
    </nav>
  )
}

function KeysTab() {
  const { providers, testing, loadProviders, setKey, testKey, removeKey } =
    useApiKeyStore()

  useEffect(() => {
    loadProviders()
  }, [loadProviders])

  return (
    <div>
      <h2
        style={{
          fontFamily: '"Space Grotesk", sans-serif',
          fontSize: "1.25rem",
          fontWeight: 600,
          marginBottom: "0.5rem",
        }}
      >
        AI Provider
      </h2>
      <p style={{ fontSize: "0.8125rem", color: "#737373", marginBottom: "1.5rem" }}>
        TANGENT 使用你自己的 API Key，密钥经本地加密存储，不会发送到任何第三方服务器。
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        {providers.map((p) => (
          <ProviderCard
            key={p.id}
            provider={p}
            isTesting={!!testing[p.id]}
            onSet={(key) => setKey(p.id, key)}
            onTest={() => testKey(p.id)}
            onRemove={() => removeKey(p.id)}
          />
        ))}
      </div>
    </div>
  )
}

function ProviderCard({
  provider,
  isTesting,
  onSet,
  onTest,
  onRemove,
}: {
  provider: ProviderInfo
  isTesting: boolean
  onSet: (key: string) => void
  onTest: () => Promise<boolean>
  onRemove: () => void
}) {
  const [input, setInput] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [showConfirm, setShowConfirm] = useState(false)

  const handleSet = () => {
    if (!input.trim()) return
    onSet(input.trim())
    setInput("")
    setError(null)
  }

  const handleTest = async () => {
    setError(null)
    const ok = await onTest()
    if (!ok) setError("验证失败，请检查 Key")
  }

  const dotColor =
    provider.is_valid === true
      ? "#22c55e"
      : provider.is_valid === false
        ? "#ef4444"
        : "#d4d4d4"

  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 8,
        border: "1px solid #e5e5e5",
        padding: "1rem 1.25rem",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "0.75rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: dotColor,
              display: "inline-block",
            }}
          />
          <span
            style={{
              fontFamily: '"Space Grotesk", sans-serif',
              fontWeight: 600,
              fontSize: "0.9375rem",
            }}
          >
            {provider.name}
          </span>
        </div>
        <span style={{ fontSize: "0.75rem", color: "#a3a3a3" }}>
          {provider.base_url}
        </span>
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input
          type="password"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={
            provider.is_set
              ? "•••••••••••• (已保存)"
              : `${provider.key_prefix || "输入 API Key"}`
          }
          onKeyDown={(e) => e.key === "Enter" && handleSet()}
          style={{
            flex: 1,
            padding: "0.5rem 0.75rem",
            borderRadius: 6,
            border: "1px solid #e5e5e5",
            fontSize: "0.8125rem",
            fontFamily: '"Inter", sans-serif',
            outline: "none",
          }}
        />
        <button
          onClick={handleSet}
          disabled={!input.trim()}
          style={{
            ...btnBase,
            opacity: input.trim() ? 1 : 0.4,
          }}
        >
          保存
        </button>
        {provider.is_set && (
          <button
            onClick={handleTest}
            disabled={isTesting}
            style={{ ...btnBase, background: "#f5f5f5", color: "#171717" }}
          >
            {isTesting ? "..." : "测试"}
          </button>
        )}
        {provider.is_set && !showConfirm && (
          <button
            onClick={() => setShowConfirm(true)}
            style={{
              ...btnBase,
              background: "transparent",
              color: "#ef4444",
              border: "1px solid #fecaca",
            }}
          >
            删除
          </button>
        )}
        {showConfirm && (
          <div style={{ display: "flex", gap: 4 }}>
            <button
              onClick={() => {
                onRemove()
                setShowConfirm(false)
              }}
              style={{
                ...btnBase,
                background: "#ef4444",
                color: "#fff",
                fontSize: "0.75rem",
              }}
            >
              确认
            </button>
            <button
              onClick={() => setShowConfirm(false)}
              style={{
                ...btnBase,
                background: "#f5f5f5",
                color: "#171717",
                fontSize: "0.75rem",
              }}
            >
              取消
            </button>
          </div>
        )}
      </div>

      {error && (
        <p style={{ color: "#ef4444", fontSize: "0.75rem", marginTop: 8 }}>
          {error}
        </p>
      )}
    </div>
  )
}

function LicenseTab() {
  const { status, expiresAt, trialEndsAt, checkStatus, activate, deactivate } =
    useLicenseStore()
  const [input, setInput] = useState("")
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  useEffect(() => {
    checkStatus()
  }, [checkStatus])

  const handleActivate = async () => {
    if (!input.trim()) return
    const ok = await activate(input.trim())
    setMsg(ok ? { ok: true, text: "激活成功" } : { ok: false, text: "密钥无效" })
    if (ok) setInput("")
  }

  const handleDeactivate = async () => {
    await deactivate()
    setMsg({ ok: true, text: "已停用" })
  }

  const statusLabel =
    status === "active"
      ? `Pro — 到期 ${expiresAt ?? ""}`
      : status === "trial"
        ? `免费试用 — 剩余 ${trialEndsAt ?? "?"} 天`
        : status === "expired"
          ? "已过期"
          : "Free"

  return (
    <div>
      <h2
        style={{
          fontFamily: '"Space Grotesk", sans-serif',
          fontSize: "1.25rem",
          fontWeight: 600,
          marginBottom: "1rem",
        }}
      >
        License
      </h2>

      <div
        style={{
          background: "#fff",
          borderRadius: 8,
          border: "1px solid #e5e5e5",
          padding: "1rem 1.25rem",
          marginBottom: "1rem",
        }}
      >
        <span style={{ fontSize: "0.875rem", color: "#171717" }}>
          当前状态：
        </span>
        <span
          style={{
            fontSize: "0.875rem",
            fontWeight: 600,
            color: status === "active" ? "#22c55e" : "#a3a3a3",
          }}
        >
          {statusLabel}
        </span>
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="输入 License Key"
          onKeyDown={(e) => e.key === "Enter" && handleActivate()}
          style={{
            flex: 1,
            padding: "0.5rem 0.75rem",
            borderRadius: 6,
            border: "1px solid #e5e5e5",
            fontSize: "0.8125rem",
            fontFamily: '"Inter", sans-serif',
            outline: "none",
          }}
        />
        <button
          onClick={handleActivate}
          disabled={!input.trim()}
          style={{ ...btnBase, opacity: input.trim() ? 1 : 0.4 }}
        >
          激活
        </button>
        {status === "active" && (
          <button
            onClick={handleDeactivate}
            style={{
              ...btnBase,
              background: "transparent",
              color: "#ef4444",
              border: "1px solid #fecaca",
            }}
          >
            停用
          </button>
        )}
      </div>

      {msg && (
        <p
          style={{
            fontSize: "0.8125rem",
            color: msg.ok ? "#22c55e" : "#ef4444",
            marginTop: 8,
          }}
        >
          {msg.text}
        </p>
      )}
    </div>
  )
}

function GeneralTab() {
  const navigate = useNavigate()
  return (
    <div>
      <h2
        style={{
          fontFamily: '"Space Grotesk", sans-serif',
          fontSize: "1.25rem",
          fontWeight: 600,
          marginBottom: "1rem",
        }}
      >
        通用
      </h2>
      <div
        style={{
          background: "#fff",
          borderRadius: 8,
          border: "1px solid #e5e5e5",
          padding: "1rem 1.25rem",
        }}
      >
        <p style={{ fontSize: "0.875rem", color: "#a3a3a3" }}>
          主题 / 语言设置将在后续版本中提供。
        </p>
        <button
          onClick={() => navigate("/dashboard")}
          style={{ ...btnBase, marginTop: "1rem" }}
        >
          返回 Dashboard
        </button>
      </div>
    </div>
  )
}

const btnBase: React.CSSProperties = {
  padding: "0.5rem 1rem",
  borderRadius: 6,
  border: "none",
  background: "#242424",
  color: "#fff",
  fontSize: "0.8125rem",
  fontWeight: 500,
  cursor: "pointer",
  fontFamily: '"Inter", sans-serif',
  whiteSpace: "nowrap",
}
