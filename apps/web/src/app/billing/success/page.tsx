import { AppShell } from '@/components/app-shell/AppShell'
import { BillingCheckoutReturnView } from '@/features/billing/BillingCheckoutReturnView'

export default function BillingSuccessPage() {
  return (
    <AppShell>
      <BillingCheckoutReturnView kind="success" />
    </AppShell>
  )
}
