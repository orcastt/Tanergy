import { AppShell } from '@/components/app-shell/AppShell'
import { WorkspaceDashboardView } from '@/components/workspaces/WorkspaceDashboardView'

type GroupDashboardPageProps = {
  params: Promise<{ groupId: string }>
}

export default async function GroupDashboardPage({ params }: GroupDashboardPageProps) {
  const resolvedParams = await params
  const groupId = decodeURIComponent(resolvedParams.groupId)

  return (
    <AppShell>
      <WorkspaceDashboardView kind="group" workspaceId={groupId} />
    </AppShell>
  )
}
