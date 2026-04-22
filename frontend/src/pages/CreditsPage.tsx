import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useCreditsStore } from "../store/creditsStore"

const PACKAGES = [
  { id: "starter", name: "Starter", credits: 100, price: "$4.99", proPrice: "$3.99" },
  { id: "standard", name: "Standard", credits: 500, price: "$19.99", proPrice: "$15.99" },
  { id: "pro_pack", name: "Pro Pack", credits: 2000, price: "$69.99", proPrice: "$55.99" },
]

export default function CreditsPage() {
  const navigate = useNavigate()
  const { balance, isLoggedIn, isLoading, error, login, verify, logout, refresh, clearError } = useCreditsStore()
  const [email, setEmail] = useState("")
  const [otp, setOtp] = useState("")
  const [otpSent, setOtpSent] = useState(false)

  const handleLogin = async () => {
    await login(email)
    setOtpSent(true)
  }

  const handleVerify = async () => {
    await verify(email, otp)
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f5f3f3", padding: "2rem" }}>
      <div style={{ maxWidth: "640px", margin: "0 auto" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "2rem" }}>
          <button onClick={() => navigate(-1)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1.25rem" }}>
            ←
          </button>
          <h1 style={{ fontSize: "1.25rem", fontWeight: 600, color: "#1b1c1c" }}>积分中心</h1>
        </div>

        {/* Balance Card */}
        <div style={{
          background: "#fff", borderRadius: "0.75rem", padding: "1.5rem",
          boxShadow: "0 1px 3px rgba(0,0,0,0.06)", marginBottom: "1.5rem", textAlign: "center",
        }}>
          <div style={{ fontSize: "0.75rem", color: "#747878", marginBottom: "0.5rem" }}>当前积分</div>
          <div style={{ fontSize: "2.5rem", fontWeight: 700, color: "#1b1c1c" }}>{balance}</div>
          {isLoggedIn && (
            <button onClick={refresh} style={{
              marginTop: "0.75rem", padding: "0.375rem 1rem", fontSize: "0.75rem",
              border: "1px solid #e3e2e2", borderRadius: "0.375rem", background: "#fff",
              cursor: "pointer", color: "#1b1c1c",
            }}>
              刷新
            </button>
          )}
        </div>

        {/* Auth Section */}
        {!isLoggedIn ? (
          <div style={{
            background: "#fff", borderRadius: "0.75rem", padding: "1.5rem",
            boxShadow: "0 1px 3px rgba(0,0,0,0.06)", marginBottom: "1.5rem",
          }}>
            <h2 style={{ fontSize: "0.875rem", fontWeight: 600, color: "#1b1c1c", marginBottom: "1rem" }}>
              登录官方账号
            </h2>
            <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem" }}>
              <input
                type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="输入邮箱"
                style={{
                  flex: 1, padding: "0.5rem 0.75rem", border: "1px solid #e3e2e2",
                  borderRadius: "0.375rem", fontSize: "0.8125rem", outline: "none", color: "#1b1c1c",
                }}
              />
              <button onClick={handleLogin} disabled={isLoading || !email}
                style={{
                  padding: "0.5rem 1rem", fontSize: "0.8125rem",
                  background: isLoading || !email ? "#e3e2e2" : "#242424", color: "#fff",
                  border: "none", borderRadius: "0.375rem", cursor: isLoading ? "default" : "pointer",
                }}
              >
                发送验证码
              </button>
            </div>
            {otpSent && (
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <input
                  type="text" value={otp} onChange={(e) => setOtp(e.target.value)}
                  placeholder="输入验证码"
                  style={{
                    flex: 1, padding: "0.5rem 0.75rem", border: "1px solid #e3e2e2",
                    borderRadius: "0.375rem", fontSize: "0.8125rem", outline: "none", color: "#1b1c1c",
                  }}
                />
                <button onClick={handleVerify} disabled={isLoading || !otp}
                  style={{
                    padding: "0.5rem 1rem", fontSize: "0.8125rem",
                    background: isLoading || !otp ? "#e3e2e2" : "#242424", color: "#fff",
                    border: "none", borderRadius: "0.375rem", cursor: isLoading ? "default" : "pointer",
                  }}
                >
                  验证
                </button>
              </div>
            )}
            {error && (
              <div style={{ marginTop: "0.5rem", fontSize: "0.75rem", color: "#991b1b" }} onClick={clearError}>
                {error}
              </div>
            )}
          </div>
        ) : (
          <div style={{
            background: "#fff", borderRadius: "0.75rem", padding: "1rem 1.5rem",
            boxShadow: "0 1px 3px rgba(0,0,0,0.06)", marginBottom: "1.5rem",
            display: "flex", justifyContent: "space-between", alignItems: "center",
          }}>
            <span style={{ fontSize: "0.8125rem", color: "#22C55E" }}>已登录</span>
            <button onClick={logout} style={{
              fontSize: "0.75rem", color: "#991b1b", background: "none", border: "none", cursor: "pointer",
            }}>
              退出登录
            </button>
          </div>
        )}

        {/* Package Cards */}
        <h2 style={{ fontSize: "0.875rem", fontWeight: 600, color: "#1b1c1c", marginBottom: "1rem" }}>
          购买积分
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.75rem" }}>
          {PACKAGES.map((pkg) => (
            <div key={pkg.id} style={{
              background: "#fff", borderRadius: "0.75rem", padding: "1.25rem",
              boxShadow: "0 1px 3px rgba(0,0,0,0.06)", textAlign: "center",
              display: "flex", flexDirection: "column", gap: "0.5rem",
            }}>
              <div style={{ fontSize: "0.75rem", color: "#747878" }}>{pkg.name}</div>
              <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#1b1c1c" }}>{pkg.credits}</div>
              <div style={{ fontSize: "0.6875rem", color: "#9ca3af" }}>积分</div>
              <div style={{ fontSize: "1.125rem", fontWeight: 600, color: "#1b1c1c" }}>{pkg.price}</div>
              <div style={{ fontSize: "0.625rem", color: "#6349EA" }}>Pro 会员 {pkg.proPrice}</div>
              <button disabled={!isLoggedIn}
                style={{
                  padding: "0.5rem", fontSize: "0.75rem",
                  background: isLoggedIn ? "#242424" : "#e3e2e2", color: "#fff",
                  border: "none", borderRadius: "0.375rem", cursor: isLoggedIn ? "pointer" : "default",
                  marginTop: "0.25rem",
                }}
              >
                购买
              </button>
            </div>
          ))}
        </div>

        {/* Pro Membership */}
        <div style={{
          background: "linear-gradient(135deg, #6349EA, #3B82F6)", borderRadius: "0.75rem",
          padding: "1.5rem", marginTop: "1.5rem", color: "#fff",
        }}>
          <div style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "0.375rem" }}>Pro 会员</div>
          <div style={{ fontSize: "0.75rem", opacity: 0.9, marginBottom: "0.75rem" }}>
            解锁所有 Skill 模板 · 赠送 200 积分 · 购积分享 8 折
          </div>
          <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
            <span style={{ fontSize: "1.25rem", fontWeight: 700 }}>$9.99/月</span>
            <span style={{ fontSize: "0.75rem", opacity: 0.7 }}>$79.99/年</span>
          </div>
        </div>
      </div>
    </div>
  )
}
