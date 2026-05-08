import { AppShell } from '@/components/app-shell/AppShell'
import { WorkspaceDirectoryView } from '@/components/workspaces/WorkspaceDirectoryView'
import { getWorkspaceDirectoryItems } from '@/features/workspaces/workspaceDirectoryMock'

export default function GroupPage() {
  return (
    <AppShell>
      <WorkspaceDirectoryView
        createLabel="Create a Group"
        emptyCreatedLabel="No groups created."
        emptyJoinedLabel="No joined groups."
        joinLabel="Join Group"
        kind="group_workspace"
        items={getWorkspaceDirectoryItems('group_workspace').map((item) => ({
          ...item,
          href: `/group/${encodeURIComponent(item.id)}`,
        }))}
        title="Group"
      />
    </AppShell>
  )
}
