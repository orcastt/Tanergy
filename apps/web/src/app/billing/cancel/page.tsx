import { AppShell } from '@/components/app-shell/AppShell'
import { BillingCheckoutReturnView } from '@/features/billing/BillingCheckoutReturnView'

export default function BillingCancelPage() {
  return (
    <AppShell>
      <BillingCheckoutReturnView kind="cancel" />
    </AppShell>
  )
}
