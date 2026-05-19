'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { AdminAccessDashboard } from './AdminAccessDashboard'
import { AdminApiRoutesDashboard } from './AdminApiRoutesDashboard'
import { AdminConsoleTabs, type AdminConsoleTab } from './AdminConsoleTabs'
import { AdminFinanceDashboard } from './AdminFinanceDashboard'
import { AdminOverviewDashboard } from './AdminOverviewDashboard'
import { AdminUsersDashboard } from './AdminUsersDashboard'
import { discardStaleAdminLocalStorage } from './adminStorageCleanup'
import type {
  AdminAccess,
  AdminDirectoryUsersResource,
  AdminDirectoryWorkspacesResource,
  AdminOperatorUsersResource,
  AdminSummaryResource,
} from './adminTypes'

type AdminPageClientProps = {
  access: AdminAccess
  activeTab: AdminConsoleTab
  groupsSeed: AdminDirectoryWorkspacesResource
  operatorUsersSeed: AdminOperatorUsersResource
  summarySeed: AdminSummaryResource
  teamsSeed: AdminDirectoryWorkspacesResource
  usersSeed: AdminDirectoryUsersResource
}

export function AdminPageClient({
  access,
  activeTab,
  groupsSeed,
  operatorUsersSeed,
  summarySeed,
  teamsSeed,
  usersSeed,
}: AdminPageClientProps) {
  const resourcesEnabled = access.apiMode === 'remote' && access.canAccessAdmin
  const [clientTab, setClientTab] = useState<AdminConsoleTab>(activeTab)
  const [mountedTabs, setMountedTabs] = useState<AdminConsoleTab[]>([activeTab])

  useEffect(() => {
    discardStaleAdminLocalStorage()

    function handlePopState() {
      const nextTab = readAdminTabFromLocation()
      setClientTab(nextTab)
      setMountedTabs((current) => ensureMountedTab(current, nextTab))
    }

    window.addEventListener('popstate', handlePopState)
    return () => {
      window.removeEventListener('popstate', handlePopState)
    }
  }, [])

  const handleTabChange = useCallback((nextTab: AdminConsoleTab) => {
    setClientTab(nextTab)
    setMountedTabs((current) => ensureMountedTab(current, nextTab))
    const nextHref = hrefForAdminTab(nextTab)
    if (`${window.location.pathname}${window.location.search}` !== nextHref) {
      window.history.pushState({ tab: nextTab }, '', nextHref)
    }
  }, [])

  return (
    <div className="product-page management-page">
      <section className="product-page-header">
        <p className="product-kicker">Admin</p>
        <h1 className="product-page-title">Developer console</h1>
      </section>

      {access.apiMode === 'local-unavailable' ? (
        <Notice title="Admin API unavailable" body={access.error ?? 'Set NEXT_PUBLIC_API_BASE_URL so the web app can reach the protected admin routes.'} />
      ) : null}
      {access.apiMode === 'remote' && !access.canAccessAdmin ? (
        <Notice title="Admin access required" body={access.error ?? 'This account does not currently have admin access.'} />
      ) : null}

      {resourcesEnabled ? (
        <>
          <AdminConsoleTabs activeTab={clientTab} onTabChange={handleTabChange} />
          <div className="management-tab-panels">
            <AdminTabPanel active={clientTab === 'overview'} mounted={mountedTabs.includes('overview')}>
              <AdminOverviewDashboard
                enabled={resourcesEnabled}
                groupsSeed={groupsSeed}
                summarySeed={summarySeed}
                teamsSeed={teamsSeed}
                usersSeed={usersSeed}
              />
            </AdminTabPanel>
            <AdminTabPanel active={clientTab === 'users'} mounted={mountedTabs.includes('users')}>
              <AdminUsersDashboard enabled={resourcesEnabled} seedResource={operatorUsersSeed} />
            </AdminTabPanel>
            <AdminTabPanel active={clientTab === 'ai'} mounted={mountedTabs.includes('ai')}>
              <AdminApiRoutesDashboard enabled={resourcesEnabled} />
            </AdminTabPanel>
            <AdminTabPanel active={clientTab === 'finance'} mounted={mountedTabs.includes('finance')}>
              <AdminFinanceDashboard enabled={resourcesEnabled} />
            </AdminTabPanel>
            <AdminTabPanel active={clientTab === 'access'} mounted={mountedTabs.includes('access')}>
              <AdminAccessDashboard adminAccess={access} enabled={resourcesEnabled} usersSeed={usersSeed} />
            </AdminTabPanel>
          </div>
        </>
      ) : null}
    </div>
  )
}

function AdminTabPanel({
  active,
  children,
  mounted,
}: {
  active: boolean
  children: ReactNode
  mounted: boolean
}) {
  if (!mounted) return null
  return (
    <section className="management-tab-panel" hidden={!active}>
      {children}
    </section>
  )
}

function ensureMountedTab(current: AdminConsoleTab[], nextTab: AdminConsoleTab) {
  return current.includes(nextTab) ? current : [...current, nextTab]
}

function hrefForAdminTab(tab: AdminConsoleTab) {
  return tab === 'overview' ? '/admin' : `/admin?tab=${encodeURIComponent(tab)}`
}

function readAdminTabFromLocation(): AdminConsoleTab {
  const search = new URLSearchParams(window.location.search)
  const tab = search.get('tab')
  return tab === 'users' || tab === 'ai' || tab === 'finance' || tab === 'access'
    ? tab
    : 'overview'
}

function Notice({ body, title }: { body: string; title: string }) {
  return <section className="management-notice"><div><h2>{title}</h2><p>{body}</p></div><Link className="product-button product-button-secondary" href="/workspaces">Back to workspace</Link></section>
}
