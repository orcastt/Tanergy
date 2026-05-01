import { AppShell } from '@/components/app-shell/AppShell'
import { AuthForm } from '@/components/auth/AuthForm'

export default function SignupPage() {
  return (
    <AppShell>
      <AuthForm mode="signup" />
    </AppShell>
  )
}
