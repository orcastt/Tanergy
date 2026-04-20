import { useAuthStore } from "../store/authStore"
import { useNavigate } from "react-router-dom"

export default function TopNav() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()

  return (
    <header className="flex items-center justify-between px-6 h-14 bg-white sticky top-0 z-30" style={{ boxShadow: "rgba(34,42,53,0.05) 0px 4px 8px" }}>
      <button
        onClick={() => navigate("/dashboard")}
        className="bg-transparent border-none cursor-pointer p-0 flex items-center gap-2"
      >
        <span className="font-display" style={{ fontSize: "1.25rem", fontWeight: 600, color: "#242424", letterSpacing: "0px" }}>
          TANVAS
        </span>
      </button>

      <div className="flex items-center gap-4">
        {user && (
          <>
            <span className="text-sm hidden sm:block" style={{ color: "#898989" }}>{user.email}</span>
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold"
              style={{ background: "#242424", fontFamily: "'Cal Sans', sans-serif" }}
            >
              {user.displayName?.[0]?.toUpperCase() || "U"}
            </div>
            <button
              onClick={logout}
              className="text-sm font-medium bg-transparent border-none"
              style={{ color: "#898989" }}
            >
              Logout
            </button>
          </>
        )}
      </div>
    </header>
  )
}
