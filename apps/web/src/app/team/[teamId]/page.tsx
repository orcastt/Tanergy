import { AppShell } from '@/components/app-shell/AppShell'
import { WorkspaceDashboardView } from '@/components/workspaces/WorkspaceDashboardView'

type TeamDashboardPageProps = {
  params: Promise<{ teamId: string }>
}

export default async function TeamDashboardPage({ params }: TeamDashboardPageProps) {
  const resolvedParams = await params
  const teamId = decodeURIComponent(resolvedParams.teamId)

  return (
    <AppShell>
      <WorkspaceDashboardView kind="team" workspaceId={teamId} />
    </AppShell>
  )
}
