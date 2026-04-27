type WorkspaceTab = "workflows" | "library"

interface Props {
  value: WorkspaceTab
  onChange: (value: WorkspaceTab) => void
}

const TABS: Array<{ id: WorkspaceTab; label: string; icon: string }> = [
  { id: "workflows", label: "Workflows", icon: "account_tree" },
  { id: "library", label: "Library", icon: "folder_open" },
]

export default function WorkspaceTabs({ value, onChange }: Props) {
  return (
    <div
      style={{
        display: "flex",
        gap: "0.25rem",
        padding: "0.25rem",
        borderRadius: "0.625rem",
        background: "var(--bg-surface)",
        boxShadow: "0 0 0 1px rgba(0,0,0,0.05), 0 1px 2px rgba(0,0,0,0.05)",
      }}
    >
      {TABS.map((tab) => {
        const active = value === tab.id
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.375rem",
              padding: "0.5rem 0.75rem",
              borderRadius: "0.5rem",
              border: "none",
              background: active ? "#242424" : "transparent",
              color: active ? "#ffffff" : "var(--text-secondary)",
              cursor: "pointer",
              fontSize: "0.75rem",
              fontWeight: 700,
              transition: "background 150ms ease, color 150ms ease",
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 17 }}>{tab.icon}</span>
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}

export type { WorkspaceTab }
