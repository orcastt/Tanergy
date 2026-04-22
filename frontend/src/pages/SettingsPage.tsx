import { useState } from "react"
import TopNav from "../components/TopNav"
import { KeysTab, LicenseTab, GeneralTab } from "./settings/SettingsTabs"

type Tab = "keys" | "license" | "general"

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
