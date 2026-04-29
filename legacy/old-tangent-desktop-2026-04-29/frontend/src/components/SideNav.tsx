import { useNavigate, useLocation } from "react-router-dom"
import { useWorkflowStore } from "../store/workflowStore"

export default function SideNav() {
  const navigate = useNavigate()
  const location = useLocation()
  const currentPath = location.pathname
  const currentFilter = new URLSearchParams(location.search).get("filter")
  const trashedCount = useWorkflowStore((s) => s.trashedWorkflows.length)

  const items = [
    { icon: "dashboard", label: "All Workflows", path: "/dashboard", search: "" },
    { icon: "schedule", label: "Recent", path: "/dashboard", search: "?filter=recent" },
    { icon: "auto_awesome_motion", label: "Templates", path: "/dashboard", search: "?filter=templates" },
    { icon: "delete", label: "Trash", path: "/dashboard", search: "?filter=trash", badge: trashedCount },
  ]

  return (
    <aside style={{
      background: "var(--bg-surface)",
      color: "var(--text-primary)",
      height: "100%",
      width: "16rem",
      display: "flex",
      flexDirection: "column",
      zIndex: 40,
      padding: "1rem",
      gap: "0.5rem",
      flexShrink: 0,
    }}>
      {/* Brand */}
      <div style={{ marginBottom: "2rem", padding: "0 0.5rem", display: "flex", alignItems: "center", gap: "0.75rem" }}>
        <div style={{
          width: "2.5rem", height: "2.5rem", borderRadius: "0.5rem",
          background: "var(--accent)", color: "var(--text-on-accent)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontWeight: 700, fontFamily: '"Space Grotesk", sans-serif', fontSize: "1.25rem",
        }}>
          T
        </div>
        <div>
          <h2 style={{
            fontFamily: '"Space Grotesk", sans-serif',
            fontWeight: 900, fontSize: "1.125rem", letterSpacing: "-0.03em",
            color: "var(--text-primary)", lineHeight: 1, margin: 0,
          }}>
            TANGENT
          </h2>
          <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)", fontWeight: 500, marginTop: "0.125rem" }}>
            Creative Engine
          </p>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, display: "flex", flexDirection: "column", gap: "0.25rem" }}>
        {items.map((item) => {
          const active =
            currentPath === item.path &&
            (item.search === "" ? !currentFilter : item.search === `?filter=${currentFilter}`)

          return (
            <button
              key={item.label}
              onClick={() => navigate(item.path + item.search)}
              style={{
                display: "flex", alignItems: "center", gap: "0.75rem",
                padding: "0.5rem 0.75rem", borderRadius: "0.375rem",
                fontSize: "0.75rem", fontWeight: 600, textTransform: "uppercase",
                letterSpacing: "0.05em",
                color: active ? "var(--text-primary)" : "var(--text-secondary)",
                background: active ? "var(--bg-hover)" : "transparent",
                boxShadow: active ? "0 0 0 1px var(--border)" : "none",
                border: "none", cursor: "pointer",
                transition: "all 200ms ease",
                textAlign: "left", width: "100%",
                justifyContent: "flex-start",
              }}
              onMouseEnter={(e) => {
                if (!active) e.currentTarget.style.background = "var(--bg-hover)"
              }}
              onMouseLeave={(e) => {
                if (!active) e.currentTarget.style.background = "transparent"
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>{item.icon}</span>
              <span style={{ flex: 1 }}>{item.label}</span>
              {item.badge != null && item.badge > 0 && (
                <span style={{
                  background: "var(--text-secondary)", color: "var(--text-on-accent)",
                  fontSize: "0.625rem", fontWeight: 700,
                  borderRadius: "999px", padding: "0.1rem 0.45rem",
                  lineHeight: 1.4, letterSpacing: "0.02em",
                }}>
                  {item.badge}
                </span>
              )}
            </button>
          )
        })}
      </nav>

      {/* New Workflow */}
      <div style={{ marginTop: "auto", paddingTop: "1rem" }}>
        <button
          onClick={() => navigate("/dashboard?action=new")}
          style={{
            width: "100%",
            display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem",
            background: "var(--accent)", color: "var(--text-on-accent)",
            padding: "0.625rem 1rem", borderRadius: "0.5rem",
            fontWeight: 500, fontSize: "0.875rem",
            border: "none", cursor: "pointer",
            fontFamily: '"Inter", sans-serif',
            transition: "opacity 150ms ease",
          }}
          onMouseEnter={(e) => e.currentTarget.style.opacity = "0.9"}
          onMouseLeave={(e) => e.currentTarget.style.opacity = "1"}
        >
          <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>add</span>
          New Workflow
        </button>
      </div>
    </aside>
  )
}
