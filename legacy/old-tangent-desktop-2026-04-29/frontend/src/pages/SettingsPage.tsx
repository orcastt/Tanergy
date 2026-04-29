import { useState } from "react"
import { useTranslation } from "react-i18next"
import TopNav from "../components/TopNav"
import { AccountTab } from "./settings/AccountTab"
import { AdvancedTab } from "./settings/AdvancedTab"
import { AboutTab } from "./settings/AboutTab"
type Tab = "account" | "advanced" | "about"

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>("account")
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-canvas)" }}>
      <TopNav />
      <div style={{ display: "flex", paddingTop: "64px", minHeight: "100vh" }}>
        <Sidebar tab={tab} onTab={setTab} />
        <main style={{ flex: 1, padding: "2rem", maxWidth: 720 }}>
          {tab === "account" && <AccountTab />}
          {tab === "advanced" && <AdvancedTab />}
          {tab === "about" && <AboutTab />}
        </main>
      </div>
    </div>
  )
}

function Sidebar({ tab, onTab }: { tab: Tab; onTab: (t: Tab) => void }) {
  const { t } = useTranslation()
  const items: { id: Tab; label: string; icon: string }[] = [
    { id: "account", label: t("settings.account"), icon: "person" },
    { id: "advanced", label: t("settings.advanced"), icon: "tune" },
    { id: "about", label: t("settings.about"), icon: "info" },
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
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
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
          <span className="material-symbols-outlined" style={{ fontSize: "1.125rem" }}>
            {item.icon}
          </span>
          {item.label}
        </button>
      ))}
    </nav>
  )
}
