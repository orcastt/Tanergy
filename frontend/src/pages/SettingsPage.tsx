import { useState } from "react"
import TopNav from "../components/TopNav"
import { KeysTab, LicenseTab, GeneralTab } from "./settings/SettingsTabs"
import { tauri } from "../services/tauri"

type Tab = "keys" | "license" | "general" | "debug"

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>("keys")
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-canvas)" }}>
      <TopNav />
      <div style={{ display: "flex", paddingTop: "64px", minHeight: "100vh" }}>
        <Sidebar tab={tab} onTab={setTab} />
        <main style={{ flex: 1, padding: "2rem", maxWidth: 720 }}>
          {tab === "keys" && <KeysTab />}
          {tab === "license" && <LicenseTab />}
          {tab === "general" && <GeneralTab />}
          {tab === "debug" && <DebugTab />}
        </main>
      </div>
    </div>
  )
}

function DebugTab() {
  const [mockOn, setMockOn] = useState(false)
  const [loaded, setLoaded] = useState(false)

  if (!loaded) {
    tauri.getConfig("mock_mode").then((v) => {
      setMockOn(v === "true")
      setLoaded(true)
    })
    return <div style={{ color: "var(--text-secondary)", fontSize: "0.875rem" }}>Loading...</div>
  }

  async function toggleMock() {
    const next = !mockOn
    await tauri.setConfig("mock_mode", next ? "true" : "false")
    setMockOn(next)
  }

  return (
    <div>
      <h2 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: "1rem", color: "var(--text-primary)" }}>Debug</h2>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "1rem", borderRadius: "0.5rem", border: "1px solid var(--border-color)",
        background: "var(--bg-surface)",
      }}>
        <div>
          <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--text-primary)" }}>Mock Mode</div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "0.25rem" }}>
            Skip AI API calls, return simulated data. No API keys needed for testing.
          </div>
        </div>
        <button onClick={toggleMock} style={{
          padding: "0.375rem 1rem", borderRadius: "0.375rem", border: "none",
          background: mockOn ? "#22C55E" : "var(--bg-hover)",
          color: mockOn ? "#fff" : "var(--text-primary)",
          fontSize: "0.8125rem", fontWeight: 600, cursor: "pointer",
          minWidth: "80px",
        }}>
          {mockOn ? "ON" : "OFF"}
        </button>
      </div>
    </div>
  )
}

function Sidebar({ tab, onTab }: { tab: Tab; onTab: (t: Tab) => void }) {
  const items: { id: Tab; label: string }[] = [
    { id: "keys", label: "API Keys" },
    { id: "license", label: "License" },
    { id: "general", label: "General" },
    { id: "debug", label: "Debug" },
  ]
  return (
    <nav
      style={{
        width: 200,
        borderRight: "1px solid var(--border-color)",
        padding: "2rem 0.75rem",
        background: "var(--bg-surface)",
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
            color: tab === item.id ? "var(--text-primary)" : "var(--text-secondary)",
            background: tab === item.id ? "var(--bg-hover)" : "transparent",
          }}
        >
          {item.label}
        </button>
      ))}
    </nav>
  )
}
