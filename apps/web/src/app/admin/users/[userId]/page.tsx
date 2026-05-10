import { AppShell } from '@/components/app-shell/AppShell'
import { AdminUserDetailPage } from '@/features/admin/AdminUserDetailPage'
import { loadAdminOperatorUserDetailBootstrap } from '@/features/admin/adminServer'

export const dynamic = 'force-dynamic'

export default async function AdminUserDetailRoute({
  params,
}: {
  params: Promise<{ userId: string }>
}) {
  const { userId } = await params
  const resolvedUserId = decodeURIComponent(userId)
  const bootstrap = await loadAdminOperatorUserDetailBootstrap(resolvedUserId)

  return (
    <AppShell>
      <AdminUserDetailPage
        key={resolvedUserId}
        seedAccess={bootstrap.access}
        seedDetail={bootstrap.detail}
        seedError={bootstrap.error}
        userId={resolvedUserId}
      />
    </AppShell>
  )
}
