import { useAgentStore } from "./agentStore"
import AgentChat from "./AgentChat"
import { Z } from "../canvas/OverlayLayer"

export default function AgentPanel() {
  const open = useAgentStore((s) => s.open)
  const setOpen = useAgentStore((s) => s.setOpen)
  const resetChat = useAgentStore((s) => s.resetChat)

  return (
    <>
      {/* Toggle button */}
      <button
        onClick={() => setOpen(!open)}
        title={open ? "Close Agent" : "Open Agent"}
        style={{
          position: "fixed",
          right: open ? "340px" : "12px",
          top: "68px",
          width: "36px",
          height: "36px",
          borderRadius: "0.5rem",
          border: "none",
          background: "var(--bg-surface)",
          color: open ? "#6349EA" : "var(--text-secondary)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          boxShadow: "0 0 0 1px var(--border-subtle), var(--shadow-sm)",
          zIndex: Z.AGENT_TOGGLE,
          transition: "right 200ms ease, color 150ms ease",
          pointerEvents: "auto",
        }}
      >
        <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>
          {open ? "close" : "smart_toy"}
        </span>
      </button>

      {/* Slide panel */}
      <div style={{
        position: "fixed",
        right: 0,
        top: 56,
        bottom: 0,
        width: "340px",
        background: "var(--bg-surface)",
        borderLeft: "1px solid var(--border-color)",
        zIndex: Z.AGENT_PANEL,
        display: "flex",
        flexDirection: "column",
        transform: open ? "translateX(0)" : "translateX(100%)",
        transition: "transform 200ms ease",
        boxShadow: open ? "-4px 0 12px rgba(0,0,0,0.08)" : "none",
        pointerEvents: "auto",
      }}>
        {/* Header */}
        <div style={{
          padding: "0.75rem 1rem",
          borderBottom: "1px solid var(--border-color)",
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          flexShrink: 0,
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: "20px", color: "#6349EA" }}>smart_toy</span>
          <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--text-primary)", flex: 1 }}>AI Agent</span>
          <button
            onClick={resetChat}
            title="New chat"
            style={{
              background: "none", border: "none", cursor: "pointer",
              color: "var(--text-secondary)", display: "flex", padding: "0.25rem",
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>add_comment</span>
          </button>
          <button
            onClick={resetChat}
            title="Clear chat"
            style={{
              background: "none", border: "none", cursor: "pointer",
              color: "var(--text-secondary)", display: "flex", padding: "0.25rem",
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>delete_sweep</span>
          </button>
        </div>

        {/* Chat */}
        <AgentChat />
      </div>
    </>
  )
}
