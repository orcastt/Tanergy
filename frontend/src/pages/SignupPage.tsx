import { useState, useEffect, type FormEvent } from "react"
import { useNavigate } from "react-router-dom"
import { useAuthStore } from "../store/authStore"
import { sendOtp, verifyOtp } from "../services/auth"
import { getGoogleAuthUrl } from "../services/googleAuth"

export default function SignupPage() {
  const navigate = useNavigate()
  const { login } = useAuthStore()
  const [email, setEmail] = useState("")
  const [code, setCode] = useState("")
  const [codeSent, setCodeSent] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [showWelcome, setShowWelcome] = useState(false)

  useEffect(() => {
    if (countdown <= 0) return
    const t = setTimeout(() => setCountdown(countdown - 1), 1000)
    return () => clearTimeout(t)
  }, [countdown])

  const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)

  async function handleSendCode() {
    if (!isValidEmail) { setError("Please enter a valid email"); return }
    setError("")
    try {
      const res = await sendOtp(email)
      setCodeSent(true); setCountdown(60)
      if (res.dev_code) setCode(res.dev_code)
    } catch (e: any) { setError(e.response?.data?.detail || "Failed to send code") }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!codeSent) { handleSendCode(); return }
    if (code.length !== 6) { setError("Please enter 6-digit code"); return }
    setError(""); setLoading(true)
    try {
      const res = await verifyOtp(email, code)
      login(res.token, res.user)
      if (res.isNewUser) { setShowWelcome(true); setTimeout(() => navigate("/dashboard"), 2000) }
      else navigate("/dashboard")
    } catch (e: any) { setError(e.response?.data?.detail || "Signup failed"); setLoading(false) }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "#f5f3f3" }}>
      {showWelcome && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.3)", backdropFilter: "blur(4px)" }}>
          <div className="bg-white rounded-xl ring-shadow p-10 text-center max-w-sm">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full mb-4" style={{ background: "#e3e2e2" }}>
              <span className="material-symbols-outlined" style={{ color: "#22C55E" }}>check</span>
            </div>
            <h2 className="font-headline" style={{ fontSize: "1.5rem", fontWeight: 600 }}>Welcome to TANGENT!</h2>
            <p className="mt-2 text-sm" style={{ color: "#5e5e5e" }}>Redirecting to dashboard...</p>
          </div>
        </div>
      )}

      <main className="w-full max-w-md">
        <div className="bg-white rounded-xl ring-shadow p-8 md:p-12 flex flex-col items-center">
          <div className="mb-10 text-center">
            <h1 className="font-headline" style={{ fontSize: "1.875rem", fontWeight: 700, color: "#242424", letterSpacing: "-0.02em" }}>TANGENT</h1>
          </div>

          <div className="w-full text-center mb-8">
            <h2 className="font-headline" style={{ fontSize: "1.25rem", fontWeight: 600, color: "#0e0f0f", marginBottom: "0.5rem" }}>Create your account</h2>
            <p className="text-sm font-medium" style={{ color: "#5e5e5e" }}>Start your AI creative workflow</p>
          </div>

          <form onSubmit={handleSubmit} className="w-full flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <label htmlFor="signup-email">Email Address</label>
              <input id="signup-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" className="input-ghost w-full py-2 font-medium" />
            </div>

            {codeSent && (
              <div className="flex flex-col gap-2">
                <label htmlFor="signup-code">Verification Code</label>
                <input id="signup-code" type="text" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} placeholder="000000" className="input-ghost w-full py-2 text-center" style={{ letterSpacing: "0.5em" }} />
              </div>
            )}

            {error && <p className="text-sm font-medium" style={{ color: "#ba1a1a" }}>{error}</p>}

            <button type="submit" disabled={loading} className="btn-primary w-full py-3 flex items-center justify-center gap-2 mt-2">
              {loading ? "Loading..." : codeSent ? "Sign Up" : "Send Verification Code"}
              {!codeSent && !loading && <span className="material-symbols-outlined" style={{ fontSize: "1rem" }}>arrow_forward</span>}
            </button>
          </form>

          {codeSent && (
            <div className="text-center mt-4">
              {countdown > 0
                ? <span className="text-xs font-medium" style={{ color: "#5e5e5e" }}>Resend in {countdown}s</span>
                : <button onClick={handleSendCode} className="text-xs font-semibold bg-transparent border-none" style={{ color: "#0e0f0f" }}>Resend code</button>
              }
            </div>
          )}

          <div className="w-full flex items-center my-8 gap-4">
            <div className="h-px flex-1" style={{ background: "#e3e2e2" }} />
            <span className="text-xs font-medium uppercase" style={{ color: "#5e5e5e", letterSpacing: "0.05em" }}>Or</span>
            <div className="h-px flex-1" style={{ background: "#e3e2e2" }} />
          </div>

          <button onClick={() => window.location.href = getGoogleAuthUrl()} className="btn-secondary w-full py-3 flex items-center justify-center gap-3">
            <svg width="18" height="18" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
            Continue with Google
          </button>

          <div className="mt-8 text-center w-full">
            <p className="text-xs" style={{ color: "#5e5e5e" }}>
              Already have an account? <a href="/login" className="font-semibold hover:underline" style={{ color: "#0e0f0f" }}>Log in</a>
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}
