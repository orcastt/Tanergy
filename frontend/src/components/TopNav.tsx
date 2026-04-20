import { useAuthStore } from "../store/authStore"
import { useNavigate } from "react-router-dom"

export default function TopNav() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()

  return (
    <header className="flex items-center justify-between px-6 h-14 bg-white/80 sticky top-0 z-30" style={{ backdropFilter: "blur(12px)", borderBottom: "1px solid #f4f4f5" }}>
      <button onClick={() => navigate("/dashboard")} className="bg-transparent border-none cursor-pointer p-0 flex items-center gap-2.5">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg" style={{ background: "linear-gradient(135deg, #6366F1, #8B5CF6)" }}>
          <svg width="16" height="16" viewBox="0 0 28 28" fill="none"><rect x="3" y="8" width="9" height="7" rx="2" fill="white" opacity="0.9"/><rect x="16" y="13" width="9" height="7" rx="2" fill="white" opacity="0.9"/><line x1="12" y1="11.5" x2="16" y2="16.5" stroke="white" strokeWidth="1.5" strokeDasharray="2 2"/></svg>
        </div>
        <span className="font-display" style={{ fontSize: "1.1rem", fontWeight: 600, color: "#1a1a2e" }}>TANVAS</span>
      </button>

      <div className="flex items-center gap-3">
        {user && (
          <>
            <span className="text-xs hidden sm:block" style={{ color: "#a1a1aa" }}>{user.email}</span>
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ background: "linear-gradient(135deg, #6366F1, #8B5CF6)" }}>
              {user.displayName?.[0]?.toUpperCase() || "U"}
            </div>
            <button onClick={logout} className="text-xs font-medium bg-transparent border-none" style={{ color: "#a1a1aa" }}>Logout</button>
          </>
        )}
      </div>
    </header>
  )
}
