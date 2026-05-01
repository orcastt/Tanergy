import { AppShell } from '@/components/app-shell/AppShell'
import { AuthForm } from '@/components/auth/AuthForm'

export default function ForgotPasswordPage() {
  return (
    <AppShell>
      <AuthForm mode="forgot-password" />
    </AppShell>
  )
}
