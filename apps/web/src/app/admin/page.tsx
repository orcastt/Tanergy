import { AppShell } from '@/components/app-shell/AppShell'
import { AdminPageClient } from '@/features/admin/AdminPageClient'
import type { AdminConsoleTab } from '@/features/admin/AdminConsoleTabs'
import { loadAdminPageBootstrap } from '@/features/admin/adminServer'

export const dynamic = 'force-dynamic'

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const resolvedSearchParams = await searchParams
  const initialTab = resolveAdminConsoleTab(resolvedSearchParams.tab ?? null)
  const bootstrap = await loadAdminPageBootstrap(initialTab)

  return (
    <AppShell>
      <AdminPageClient
        access={bootstrap.access}
        activeTab={initialTab}
        groupsSeed={bootstrap.groups}
        operatorUsersSeed={bootstrap.operatorUsers}
        summarySeed={bootstrap.summary}
        teamsSeed={bootstrap.teams}
        usersSeed={bootstrap.users}
      />
    </AppShell>
  )
}

function resolveAdminConsoleTab(value: string | null): AdminConsoleTab {
  return value === 'users' || value === 'teams' || value === 'groups' || value === 'ai' || value === 'finance' || value === 'access'
    ? value
    : 'overview'
}
