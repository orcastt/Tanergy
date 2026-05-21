import { AppShell } from '@/components/app-shell/AppShell'
import { SubscriptionPlansView } from '@/features/billing/SubscriptionPlansView'

export default function BillingPage() {
  return (
    <AppShell>
      <SubscriptionPlansView />
    </AppShell>
  )
}
