// Auth temporarily disabled — bypass login check for local testing
export default function AuthGuard({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
