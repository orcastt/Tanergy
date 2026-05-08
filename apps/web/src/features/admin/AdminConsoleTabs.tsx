'use client'

const tabs = [
  { id: 'overview', label: 'Overview' },
  { id: 'users', label: 'Users' },
  { id: 'teams', label: 'Teams' },
  { id: 'groups', label: 'Groups' },
  { id: 'ai', label: 'AI API Routes' },
  { id: 'finance', label: 'Finance' },
  { id: 'access', label: 'Access' },
] as const

export type AdminConsoleTab = (typeof tabs)[number]['id']

export function AdminConsoleTabs({
  activeTab,
  onChange,
}: {
  activeTab: AdminConsoleTab
  onChange: (tab: AdminConsoleTab) => void
}) {
  return (
    <div className="management-segmented management-console-tabs" role="tablist" aria-label="Admin sections">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          className={tab.id === activeTab ? 'is-active' : undefined}
          onClick={() => onChange(tab.id)}
          role="tab"
          type="button"
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
