import { useAuthStore } from "../store/authStore"
import { useNavigate } from "react-router-dom"

export default function TopNav() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()

  return (
    <header
      className="flex items-center justify-between px-6 h-14 bg-white sticky top-0 z-30"
      style={{ boxShadow: "rgba(34,42,53,0.05) 0px 4px 8px" }}
    >
      <button onClick={() => navigate("/dashboard")} className="bg-transparent border-none cursor-pointer p-0">
        <span style={{ fontFamily: "'Cal Sans', sans-serif", fontSize: "1.25rem", fontWeight: 600, color: "#242424" }}>
          TANVAS
        </span>
      </button>

      <div className="flex items-center gap-3">
        {user && (
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium"
              style={{ background: "#242424" }}
            >
              {user.displayName?.[0]?.toUpperCase() || "U"}
            </div>
            <button
              onClick={() => { logout() }}
              className="text-sm text-[#898989] hover:text-[#242424] bg-transparent border-none cursor-pointer"
            >
              Logout
            </button>
          </div>
        )}
      </div>
    </header>
  )
}
