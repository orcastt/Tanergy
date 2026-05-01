import { AppShell } from '@/components/app-shell/AppShell'
import { AuthForm } from '@/components/auth/AuthForm'

export default function LoginPage() {
  return (
    <AppShell>
      <AuthForm mode="login" />
    </AppShell>
  )
}
