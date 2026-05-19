'use client'

export const adminConsoleTabs = [
  { id: 'overview', label: 'Overview' },
  { id: 'users', label: 'Users' },
  { id: 'ai', label: 'AI API Routes' },
  { id: 'finance', label: 'Finance' },
  { id: 'access', label: 'Access' },
] as const

export type AdminConsoleTab = (typeof adminConsoleTabs)[number]['id']

export function AdminConsoleTabs({
  activeTab,
  onTabChange,
}: {
  activeTab: AdminConsoleTab
  onTabChange: (tab: AdminConsoleTab) => void
}) {
  return (
    <nav className="management-segmented management-console-tabs" aria-label="Admin sections" role="tablist">
      {adminConsoleTabs.map((tab) => (
        <button
          aria-selected={tab.id === activeTab}
          key={tab.id}
          role="tab"
          className={[
            tab.id === activeTab ? 'is-active' : '',
          ].filter(Boolean).join(' ')}
          onClick={() => {
            if (tab.id !== activeTab) onTabChange(tab.id)
          }}
          type="button"
        >
          <span>{tab.label}</span>
        </button>
      ))}
    </nav>
  )
}
