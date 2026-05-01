import { AppShell } from '@/components/app-shell/AppShell'
import { BoardDashboard } from '@/components/boards/BoardDashboard'

export default function BoardsPage() {
  return (
    <AppShell>
      <BoardDashboard />
    </AppShell>
  )
}
