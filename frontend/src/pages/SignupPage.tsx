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
    const timer = setTimeout(() => setCountdown(countdown - 1), 1000)
    return () => clearTimeout(timer)
  }, [countdown])

  const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)

  async function handleSendCode() {
    if (!isValidEmail) { setError("Please enter a valid email"); return }
    setError("")
    try {
      const res = await sendOtp(email)
      setCodeSent(true)
      setCountdown(60)
      if (res.dev_code) setCode(res.dev_code)
    } catch (e: any) {
      setError(e.response?.data?.detail || "Failed to send code")
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!codeSent) { handleSendCode(); return }
    if (code.length !== 6) { setError("Please enter 6-digit code"); return }

    setError("")
    setLoading(true)
    try {
      const res = await verifyOtp(email, code)
      login(res.token, res.user)
      if (res.isNewUser) {
        setShowWelcome(true)
        setTimeout(() => navigate("/dashboard"), 2000)
      } else {
        navigate("/dashboard")
      }
    } catch (e: any) {
      setError(e.response?.data?.detail || "Signup failed")
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#f5f5f5] flex items-center justify-center p-4">
      {showWelcome && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white p-8 text-center" style={{ borderRadius: "16px", boxShadow: "rgba(19,19,22,0.7) 0px 1px 5px -4px, rgba(34,42,53,0.08) 0px 0px 0px 1px, rgba(34,42,53,0.12) 0px 16px 48px" }}>
            <h2 style={{ fontFamily: "'Cal Sans', sans-serif", fontSize: "1.5rem", fontWeight: 600 }}>
              Welcome to TANVAS!
            </h2>
            <p className="text-[#898989] mt-2">Redirecting to dashboard...</p>
          </div>
        </div>
      )}

      <div
        className="bg-white w-full max-w-[400px] p-8"
        style={{ borderRadius: "16px", boxShadow: "rgba(19,19,22,0.7) 0px 1px 5px -4px, rgba(34,42,53,0.08) 0px 0px 0px 1px, rgba(34,42,53,0.05) 0px 4px 8px" }}
      >
        <h1 className="text-center mb-2" style={{ fontFamily: "'Cal Sans', sans-serif", fontSize: "1.5rem", fontWeight: 600, lineHeight: 1.2 }}>
          Create your TANVAS account
        </h1>
        <p className="text-center text-[#898989] text-sm mb-6">Start your creative workflow</p>

        <form onSubmit={handleSubmit}>
          <label className="block mb-1 text-sm font-medium text-[#242424]">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full px-3 py-2.5 mb-4 text-[#242424] bg-white outline-none"
            style={{ borderRadius: "6px", boxShadow: "rgba(34,42,53,0.08) 0px 0px 0px 1px", fontSize: "1rem" }}
          />

          {codeSent && (
            <>
              <label className="block mb-1 text-sm font-medium text-[#242424]">Verification Code</label>
              <input
                type="text"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                placeholder="000000"
                className="w-full px-3 py-2.5 mb-4 text-center tracking-[0.3em] text-[#242424] bg-white outline-none"
                style={{ borderRadius: "6px", boxShadow: "rgba(34,42,53,0.08) 0px 0px 0px 1px", fontSize: "1rem" }}
              />
            </>
          )}

          {error && <p className="text-[#EF4444] text-sm mb-3">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 text-white font-medium disabled:opacity-50"
            style={{ background: "#242424", borderRadius: "6px", boxShadow: "rgba(19,19,22,0.7) 0px 1px 5px -4px, rgba(34,42,53,0.08) 0px 0px 0px 1px, rgba(34,42,53,0.05) 0px 4px 8px" }}
          >
            {loading ? "..." : codeSent ? "Sign Up" : "Send Code"}
          </button>
        </form>

        {codeSent && countdown > 0 && (
          <p className="text-center text-[#898989] text-sm mt-3">Resend in {countdown}s</p>
        )}
        {codeSent && countdown === 0 && (
          <button onClick={handleSendCode} className="w-full text-center text-sm text-[#0099ff] mt-3 bg-transparent border-none cursor-pointer">
            Resend code
          </button>
        )}

        <div className="flex items-center gap-3 my-6">
          <div className="flex-1 h-px bg-[#e5e5e5]" />
          <span className="text-[#898989] text-sm">or</span>
          <div className="flex-1 h-px bg-[#e5e5e5]" />
        </div>

        <a
          href={getGoogleAuthUrl()}
          className="flex items-center justify-center gap-2 w-full py-2.5 bg-white text-[#242424] font-medium no-underline"
          style={{ borderRadius: "6px", boxShadow: "rgba(34,42,53,0.08) 0px 0px 0px 1px" }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
          Continue with Google
        </a>

        <p className="text-center text-sm text-[#898989] mt-6">
          Already have an account?{" "}
          <a href="/login" className="text-[#0099ff] no-underline">Log in</a>
        </p>
      </div>
    </div>
  )
}
