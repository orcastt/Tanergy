import { useRef, useEffect } from "react"
import { useAgentStore } from "./agentStore"

export default function AgentChat() {
  const messages = useAgentStore((s) => s.messages)
  const loading = useAgentStore((s) => s.loading)
  const sendMessage = useAgentStore((s) => s.sendMessage)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages.length])

  function handleSend(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const input = form.querySelector("input") as HTMLInputElement
    const text = input.value.trim()
    if (!text || loading) return
    input.value = ""
    sendMessage(text)
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "0.75rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        {messages.length === 0 && (
          <div style={{ textAlign: "center", color: "var(--text-secondary)", fontSize: "0.8125rem", padding: "2rem 1rem" }}>
            Describe what you want to build, and I&apos;ll create the workflow for you.
          </div>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            style={{
              display: "flex",
              justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
            }}
          >
            <div style={{
              maxWidth: "85%",
              padding: "0.5rem 0.75rem",
              borderRadius: msg.role === "user" ? "0.75rem 0.75rem 0.25rem 0.75rem" : "0.75rem 0.75rem 0.75rem 0.25rem",
              background: msg.role === "user" ? "#242424" : "var(--bg-hover)",
              color: msg.role === "user" ? "#fff" : "var(--text-primary)",
              fontSize: "0.8125rem",
              lineHeight: 1.5,
              whiteSpace: "pre-wrap",
            }}>
              {msg.content}
              {msg.actions && msg.actions.length > 0 && (
                <div style={{ marginTop: "0.375rem", fontSize: "0.6875rem", opacity: 0.7 }}>
                  {msg.actions.length} action(s) executed
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display: "flex", justifyContent: "flex-start" }}>
            <div style={{
              padding: "0.5rem 0.75rem", borderRadius: "0.75rem 0.75rem 0.75rem 0.25rem",
              background: "var(--bg-hover)", fontSize: "0.8125rem", color: "var(--text-secondary)",
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: "14px", animation: "spin 1s linear infinite" }}>progress_activity</span>
              Thinking...
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSend} style={{
        padding: "0.75rem",
        borderTop: "1px solid var(--border-color)",
        display: "flex",
        gap: "0.5rem",
      }}>
        <input
          placeholder="Describe your workflow..."
          disabled={loading}
          style={{
            flex: 1, padding: "0.5rem 0.75rem", fontSize: "0.8125rem",
            border: "1px solid var(--border-color)", borderRadius: "0.5rem",
            background: "var(--bg-input)", color: "var(--text-primary)",
            outline: "none", fontFamily: '"Inter", sans-serif',
          }}
        />
        <button
          type="submit"
          disabled={loading}
          style={{
            width: "36px", height: "36px", borderRadius: "0.5rem",
            border: "none", background: "#242424", color: "#fff",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.5 : 1,
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>send</span>
        </button>
      </form>
    </div>
  )
}
