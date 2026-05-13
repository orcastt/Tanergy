import { AppShell } from '@/components/app-shell/AppShell'
import { WorkspaceDirectoryPage } from '@/components/workspaces/WorkspaceDirectoryPage'

export default function GroupPage() {
  return (
    <AppShell>
      <WorkspaceDirectoryPage
        createLabel="Create a Group"
        emptyCreatedLabel="No groups created."
        emptyJoinedLabel="No joined groups."
        joinLabel="Join Group"
        kind="group_workspace"
        title="Group"
      />
    </AppShell>
  )
}
