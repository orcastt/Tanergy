import { AppShell } from '@/components/app-shell/AppShell'
import { BillingWorkspaceUsageView } from '@/features/billing/BillingWorkspaceUsageView'

export default function UsagePage() {
  return (
    <AppShell>
      <BillingWorkspaceUsageView />
    </AppShell>
  )
}
