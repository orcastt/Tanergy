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
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "linear-gradient(145deg, #f0f0ff 0%, #fafafe 40%, #f5f0ff 100%)" }}>
      {showWelcome && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.3)", backdropFilter: "blur(4px)" }}>
          <div className="card p-10 text-center max-w-sm shadow-soft-lg">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full mb-4" style={{ background: "#DCFCE7" }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="#22C55E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
            <h2 className="font-display" style={{ fontSize: "1.5rem", fontWeight: 600 }}>Welcome to TANVAS!</h2>
            <p className="mt-2 text-sm" style={{ color: "#71717a" }}>Redirecting to dashboard...</p>
          </div>
        </div>
      )}

      <div className="card w-full max-w-[440px] p-10 shadow-soft-lg">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-5" style={{ background: "linear-gradient(135deg, #6366F1, #8B5CF6)" }}>
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none"><rect x="3" y="8" width="9" height="7" rx="2" fill="white" opacity="0.9"/><rect x="16" y="13" width="9" height="7" rx="2" fill="white" opacity="0.9"/><line x1="12" y1="11.5" x2="16" y2="16.5" stroke="white" strokeWidth="1.5" strokeDasharray="2 2"/></svg>
          </div>
          <h1 className="font-display" style={{ fontSize: "1.5rem", fontWeight: 600, lineHeight: 1.2, color: "#1a1a2e" }}>
            Create your account
          </h1>
          <p className="mt-2 text-sm" style={{ color: "#71717a" }}>Start your AI creative workflow</p>
        </div>

        <form onSubmit={handleSubmit}>
          <label className="block mb-1.5 text-sm font-semibold" style={{ color: "#3f3f46" }}>Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="input-field mb-5" />

          {codeSent && (
            <>
              <label className="block mb-1.5 text-sm font-semibold" style={{ color: "#3f3f46" }}>Verification Code</label>
              <input type="text" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} placeholder="000000" className="input-field mb-5 text-center" style={{ letterSpacing: "0.5em", fontSize: "1.25rem" }} />
            </>
          )}

          {error && <div className="mb-4 px-4 py-2.5 rounded-xl text-sm font-medium" style={{ background: "#FEF2F2", color: "#DC2626", border: "1px solid #FECACA" }}>{error}</div>}

          <button type="submit" disabled={loading} className="btn-primary w-full py-3 text-sm">
            {loading ? "Loading..." : codeSent ? "Sign Up" : "Send Verification Code"}
          </button>
        </form>

        {codeSent && (
          <div className="text-center mt-4">
            {countdown > 0
              ? <span className="text-xs" style={{ color: "#a1a1aa" }}>Resend in {countdown}s</span>
              : <button onClick={handleSendCode} className="text-xs font-semibold bg-transparent border-none" style={{ color: "#6366F1" }}>Resend code</button>
            }
          </div>
        )}

        <div className="flex items-center gap-4 my-7">
          <div className="flex-1 h-px" style={{ background: "#e4e4e7" }} />
          <span className="text-xs font-medium" style={{ color: "#a1a1aa" }}>OR</span>
          <div className="flex-1 h-px" style={{ background: "#e4e4e7" }} />
        </div>

        <a href={getGoogleAuthUrl()} className="btn-ghost flex items-center justify-center gap-3 w-full py-3 text-sm no-underline">
          <svg width="18" height="18" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
          Continue with Google
        </a>

        <p className="text-center text-sm mt-8" style={{ color: "#71717a" }}>
          Already have an account? <a href="/login" className="font-semibold no-underline" style={{ color: "#6366F1" }}>Log in</a>
        </p>
      </div>
    </div>
  )
}
