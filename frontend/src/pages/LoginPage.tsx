import { useState, useEffect, type FormEvent } from "react"
import { useNavigate, useLocation, useSearchParams } from "react-router-dom"
import { useAuthStore } from "../store/authStore"
import { sendOtp, verifyOtp } from "../services/auth"
import { getGoogleAuthUrl, handleGoogleCallback } from "../services/googleAuth"

export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const { login } = useAuthStore()

  const [email, setEmail] = useState("")
  const [code, setCode] = useState("")
  const [codeSent, setCodeSent] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || "/dashboard"

  useEffect(() => {
    const googleCode = searchParams.get("code")
    if (googleCode) {
      setLoading(true)
      handleGoogleCallback(googleCode)
        .then(() => navigate(from, { replace: true }))
        .catch((e) => { setError(e.response?.data?.detail || "Google login failed"); setLoading(false) })
    }
  }, [searchParams, navigate, from])

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
      const res = verifyOtp(email, code)
      // handle async
      const result = await res
      login(result.token, result.user)
      navigate(from, { replace: true })
    } catch (e: any) { setError(e.response?.data?.detail || "Login failed"); setLoading(false) }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: "#f5f3f3", color: "#1b1c1c", fontFamily: '"Inter", sans-serif', WebkitFontSmoothing: "antialiased" }}
    >
      <main className="w-full" style={{ maxWidth: "28rem" }}>
        {/* Login Card */}
        <div
          className="rounded-xl flex flex-col items-center"
          style={{
            background: "#ffffff",
            boxShadow: "0 0 0 1px rgba(0,0,0,0.05), 0 1px 2px 0 rgba(0,0,0,0.05)",
            padding: "2rem",
          }}
        >
          {/* md:p-12 via media query */}
          <style>{`
            @media (min-width: 48rem) {
              .login-card-inner { padding: 3rem !important; }
            }
          `}</style>
          <div className="login-card-inner w-full flex flex-col items-center" style={{ padding: "2rem" }}>

            {/* Brand */}
            <div className="text-center" style={{ marginBottom: "2.5rem" }}>
              <h1 style={{
                fontFamily: '"Space Grotesk", sans-serif',
                fontSize: "1.875rem",
                fontWeight: 700,
                color: "#242424",
                letterSpacing: "-0.025em",
                lineHeight: 1,
              }}>
                TANGENT
              </h1>
            </div>

            {/* Header */}
            <div className="w-full text-center" style={{ marginBottom: "2rem" }}>
              <h2 style={{
                fontFamily: '"Space Grotesk", sans-serif',
                fontSize: "1.25rem",
                fontWeight: 600,
                color: "#0e0f0f",
                marginBottom: "0.5rem",
                letterSpacing: "-0.02em",
              }}>
                Welcome back
              </h2>
              <p style={{ fontSize: "0.875rem", fontWeight: 500, color: "#5e5e5e" }}>
                Log in to your workspace
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="w-full" style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
              {/* Email */}
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <label
                  htmlFor="email"
                  style={{
                    fontFamily: '"Inter", sans-serif',
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    color: "#5e5e5e",
                  }}
                >
                  Email Address
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  style={{
                    border: "none",
                    boxShadow: "0 1px 0 0 rgba(0,0,0,0.1)",
                    borderRadius: 0,
                    backgroundColor: "transparent",
                    fontFamily: '"Inter", sans-serif',
                    fontSize: "0.938rem",
                    fontWeight: 500,
                    color: "#0e0f0f",
                    outline: "none",
                    width: "100%",
                    padding: "0.5rem 0",
                    transition: "box-shadow 200ms ease",
                  }}
                  onFocus={(e) => { e.target.style.boxShadow = "0 0 0 1px rgba(0,0,0,0.05), 0 1px 2px 0 rgba(0,0,0,0.05)"; e.target.style.borderRadius = "0.125rem" }}
                  onBlur={(e) => { e.target.style.boxShadow = "0 1px 0 0 rgba(0,0,0,0.1)"; e.target.style.borderRadius = "0" }}
                />
              </div>

              {/* Code input (shown after sending) */}
              {codeSent && (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  <label
                    htmlFor="code"
                    style={{
                      fontFamily: '"Inter", sans-serif',
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      color: "#5e5e5e",
                    }}
                  >
                    Verification Code
                  </label>
                  <input
                    id="code"
                    type="text"
                    maxLength={6}
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                    placeholder="000000"
                    style={{
                      border: "none",
                      boxShadow: "0 1px 0 0 rgba(0,0,0,0.1)",
                      borderRadius: 0,
                      backgroundColor: "transparent",
                      fontFamily: '"Inter", sans-serif',
                      fontSize: "0.938rem",
                      fontWeight: 500,
                      color: "#0e0f0f",
                      outline: "none",
                      width: "100%",
                      padding: "0.5rem 0",
                      textAlign: "center",
                      letterSpacing: "0.5em",
                      transition: "box-shadow 200ms ease",
                    }}
                    onFocus={(e) => { e.target.style.boxShadow = "0 0 0 1px rgba(0,0,0,0.05), 0 1px 2px 0 rgba(0,0,0,0.05)"; e.target.style.borderRadius = "0.125rem" }}
                    onBlur={(e) => { e.target.style.boxShadow = "0 1px 0 0 rgba(0,0,0,0.1)"; e.target.style.borderRadius = "0" }}
                  />
                </div>
              )}

              {error && (
                <p style={{ fontSize: "0.875rem", fontWeight: 500, color: "#ba1a1a" }}>{error}</p>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                style={{
                  width: "100%",
                  background: "#242424",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "0.25rem",
                  padding: "0.75rem 0",
                  fontFamily: '"Inter", sans-serif',
                  fontWeight: 600,
                  fontSize: "0.875rem",
                  cursor: loading ? "not-allowed" : "pointer",
                  opacity: loading ? 0.5 : 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "0.5rem",
                  marginTop: "0.5rem",
                  transition: "transform 150ms ease",
                }}
                onMouseDown={(e) => { if (!loading) e.currentTarget.style.transform = "scale(0.95)" }}
                onMouseUp={(e) => { e.currentTarget.style.transform = "scale(1)" }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)" }}
              >
                {loading ? "Loading..." : codeSent ? "Sign In" : "Send Verification Code"}
                {!codeSent && !loading && (
                  <span className="material-symbols-outlined" style={{ fontSize: "1rem" }}>arrow_forward</span>
                )}
              </button>
            </form>

            {/* Resend */}
            {codeSent && (
              <div className="text-center" style={{ marginTop: "1rem" }}>
                {countdown > 0
                  ? <span style={{ fontSize: "0.75rem", fontWeight: 500, color: "#5e5e5e" }}>Resend in {countdown}s</span>
                  : <button onClick={handleSendCode} style={{ fontSize: "0.75rem", fontWeight: 600, background: "transparent", border: "none", color: "#0e0f0f", cursor: "pointer" }}>Resend code</button>
                }
              </div>
            )}

            {/* Divider */}
            <div className="w-full flex items-center" style={{ margin: "2rem 0", gap: "1rem" }}>
              <div style={{ height: "1px", flex: 1, background: "#e3e2e2" }} />
              <span style={{ fontSize: "0.75rem", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.05em", color: "#5e5e5e" }}>Or</span>
              <div style={{ height: "1px", flex: 1, background: "#e3e2e2" }} />
            </div>

            {/* Google */}
            <button
              onClick={() => window.location.href = getGoogleAuthUrl()}
              style={{
                width: "100%",
                background: "#ffffff",
                color: "#0e0f0f",
                border: "none",
                borderRadius: "0.25rem",
                padding: "0.75rem 0",
                fontFamily: '"Inter", sans-serif',
                fontWeight: 600,
                fontSize: "0.875rem",
                cursor: "pointer",
                boxShadow: "0 0 0 1px rgba(0,0,0,0.05), 0 1px 2px 0 rgba(0,0,0,0.05)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.75rem",
                transition: "background-color 200ms ease",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "#faf9f9" }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "#ffffff" }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
              Continue with Google
            </button>

            {/* Footer */}
            <div className="w-full text-center" style={{ marginTop: "2rem" }}>
              <p style={{ fontSize: "0.75rem", color: "#5e5e5e" }}>
                By continuing, you agree to our{" "}
                <a href="#" style={{ color: "#0e0f0f", textDecoration: "none" }}
                  onMouseEnter={(e) => e.currentTarget.style.textDecoration = "underline"}
                  onMouseLeave={(e) => e.currentTarget.style.textDecoration = "none"}>
                  Terms of Service
                </a>{" "}and{" "}
                <a href="#" style={{ color: "#0e0f0f", textDecoration: "none" }}
                  onMouseEnter={(e) => e.currentTarget.style.textDecoration = "underline"}
                  onMouseLeave={(e) => e.currentTarget.style.textDecoration = "none"}>
                  Privacy Policy
                </a>.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
