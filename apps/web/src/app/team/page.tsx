import { AppShell } from '@/components/app-shell/AppShell'
import { WorkspaceDirectoryView } from '@/components/workspaces/WorkspaceDirectoryView'
import { getWorkspaceDirectoryItems } from '@/features/workspaces/workspaceDirectoryMock'

export default function TeamPage() {
  return (
    <AppShell>
      <WorkspaceDirectoryView
        createLabel="Create a Team"
        emptyCreatedLabel="No teams created."
        emptyJoinedLabel="No joined teams."
        joinLabel="Join Team"
        items={getWorkspaceDirectoryItems('team_workspace').map((item) => ({
          ...item,
          href: `/team/${encodeURIComponent(item.id)}`,
        }))}
        title="Team"
      />
    </AppShell>
  )
}
