import { AppShell } from '@/components/app-shell/AppShell'
import { WorkspaceDirectoryPage } from '@/components/workspaces/WorkspaceDirectoryPage'

export default function TeamPage() {
  return (
    <AppShell>
      <WorkspaceDirectoryPage
        createLabel="Create a Team"
        emptyCreatedLabel="No teams created."
        emptyJoinedLabel="No joined teams."
        joinLabel="Join Team"
        kind="team_workspace"
        title="Team"
      />
    </AppShell>
  )
}
