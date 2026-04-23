import { useCreditsStore } from "../store/creditsStore"

// Auth temporarily disabled — bypass login check for local testing
export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const _ = useCreditsStore((s) => s.isLoggedIn)
  return <>{children}</>
}
