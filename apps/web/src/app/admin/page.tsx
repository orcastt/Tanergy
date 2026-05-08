'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { AppShell } from '@/components/app-shell/AppShell'
import { AdminAccessDashboard } from '@/features/admin/AdminAccessDashboard'
import { AdminApiRoutesDashboard } from '@/features/admin/AdminApiRoutesDashboard'
import { AdminConsoleTabs, type AdminConsoleTab } from '@/features/admin/AdminConsoleTabs'
import { AdminFinanceDashboard } from '@/features/admin/AdminFinanceDashboard'
import { AdminOverviewDashboard } from '@/features/admin/AdminOverviewDashboard'
import { AdminUsersDashboard } from '@/features/admin/AdminUsersDashboard'
import { AdminWorkspacesDashboard } from '@/features/admin/AdminWorkspacesDashboard'
import { loadAdminSummary, type AdminSummaryResource } from '@/features/admin/adminClient'
import { useAdminDirectoryResources } from '@/features/admin/useAdminDirectoryResources'
import { useAdminAccess } from '@/features/auth/useAdminAccess'

const emptySummary: AdminSummaryResource = { ok: false }

export default function AdminPage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<AdminConsoleTab>('overview')
  const [summary, setSummary] = useState<AdminSummaryResource>(emptySummary)
  const [summaryStatus, setSummaryStatus] = useState<'error' | 'loading' | 'ready'>('loading')
  const [summaryError, setSummaryError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)
  const { adminAccess, error, status } = useAdminAccess()
  const resourcesEnabled = status === 'ready' && adminAccess.apiMode === 'remote' && adminAccess.canAccessAdmin
  const directory = useAdminDirectoryResources(resourcesEnabled, 100)
  const allDirectoryWorkspaces = useMemo(
    () => [...directory.teams.workspaces, ...directory.groups.workspaces],
    [directory.groups.workspaces, directory.teams.workspaces],
  )

  useEffect(() => {
    if (status !== 'ready' || adminAccess.apiMode === 'local-unavailable' || adminAccess.canAccessAdmin) return
    router.replace('/workspaces?admin=denied')
  }, [adminAccess.apiMode, adminAccess.canAccessAdmin, router, status])

  useEffect(() => {
    if (!resourcesEnabled) return
    let cancelled = false
    loadAdminSummary()
      .then((nextSummary) => {
        if (cancelled) return
        setSummary(nextSummary)
        setSummaryError(null)
        setSummaryStatus('ready')
      })
      .catch((nextError: unknown) => {
        if (cancelled) return
        setSummary(emptySummary)
        setSummaryError(nextError instanceof Error ? nextError.message : 'Admin summary failed to load.')
        setSummaryStatus('error')
      })
    return () => {
      cancelled = true
    }
  }, [resourcesEnabled, reloadToken])

  function reloadDirectory() {
    directory.reload()
    setReloadToken((value) => value + 1)
  }

  return (
    <AppShell>
      <div className="product-page management-page">
        <section className="product-page-header">
          <p className="product-kicker">Admin</p>
          <h1 className="product-page-title">Developer console</h1>
        </section>

        {status === 'loading' ? <Notice title="Checking access" body="We are confirming your admin roles." /> : null}
        {status === 'error' ? <ErrorNotice error={error ?? 'The admin contract could not be loaded right now.'} /> : null}
        {status === 'ready' && adminAccess.apiMode === 'local-unavailable' ? (
          <Notice title="Admin API unavailable" body="Set NEXT_PUBLIC_API_BASE_URL so the browser can call the protected admin routes." />
        ) : null}

        {resourcesEnabled ? (
          <>
            <AdminConsoleTabs activeTab={activeTab} onChange={setActiveTab} />
            {summaryError || directory.error ? <section className="management-notice"><div><h2>Admin data warning</h2><p>{summaryError ?? directory.error}</p></div></section> : null}
            {activeTab === 'overview' ? (
              <AdminOverviewDashboard
                groups={directory.groups.workspaces}
                status={summaryStatus}
                summary={summary}
                teams={directory.teams.workspaces}
                users={directory.users.users}
              />
            ) : null}
            {activeTab === 'users' ? (
              <AdminUsersDashboard
                enabled={resourcesEnabled}
                groups={directory.groups.workspaces}
                onMutated={reloadDirectory}
                status={directory.status}
                teams={directory.teams.workspaces}
                users={directory.users.users}
              />
            ) : null}
            {activeTab === 'teams' ? (
              <AdminWorkspacesDashboard
                enabled={resourcesEnabled}
                kind="team"
                label="Teams"
                onMutated={reloadDirectory}
                status={directory.status}
                workspaces={directory.teams.workspaces}
              />
            ) : null}
            {activeTab === 'groups' ? (
              <AdminWorkspacesDashboard
                enabled={resourcesEnabled}
                kind="group"
                label="Groups"
                onMutated={reloadDirectory}
                status={directory.status}
                workspaces={directory.groups.workspaces}
              />
            ) : null}
            {activeTab === 'ai' ? <AdminApiRoutesDashboard enabled={resourcesEnabled} /> : null}
            {activeTab === 'finance' ? <AdminFinanceDashboard enabled={resourcesEnabled} workspaces={allDirectoryWorkspaces} /> : null}
            {activeTab === 'access' ? (
              <AdminAccessDashboard adminAccess={adminAccess} enabled={resourcesEnabled} users={directory.users.users} />
            ) : null}
          </>
        ) : null}
      </div>
    </AppShell>
  )
}

function Notice({ body, title }: { body: string; title: string }) {
  return <section className="management-notice"><div><h2>{title}</h2><p>{body}</p></div><Link className="product-button product-button-secondary" href="/workspaces">Back to workspace</Link></section>
}

function ErrorNotice({ error }: { error: string }) {
  return <Notice body={error} title="Admin access check failed" />
}
