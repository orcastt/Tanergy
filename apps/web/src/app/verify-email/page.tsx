import { AppShell } from '@/components/app-shell/AppShell'
import { AuthForm } from '@/components/auth/AuthForm'

export default function VerifyEmailPage() {
  return (
    <AppShell>
      <AuthForm mode="verify-email" />
    </AppShell>
  )
}
