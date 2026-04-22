import { useState } from "react"

interface Props {
  onSubmit: (instruction: string) => void
  onClose: () => void
}

export default function AiEditPopup({ onSubmit, onClose }: Props) {
  const [text, setText] = useState("")

  return (
    <div style={{
      position: "absolute", inset: 0, background: "rgba(0,0,0,0.4)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10,
    }} onClick={onClose}>
      <div style={{
        background: "var(--bg-surface)", borderRadius: "0.75rem", padding: "1.5rem",
        width: "360px", boxShadow: "var(--shadow-md)",
      }} onClick={(e) => e.stopPropagation()}>
        <div style={{ fontSize: "0.875rem", fontWeight: 600, marginBottom: "0.75rem", color: "var(--text-primary)" }}>
          AI Edit Image
        </div>
        <textarea
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Describe how you want to modify the image..."
          style={{
            width: "100%", height: "80px", padding: "0.5rem 0.75rem",
            border: "1px solid var(--border-color)", borderRadius: "0.375rem",
            fontSize: "0.8125rem", resize: "none", outline: "none",
            fontFamily: '"Inter", sans-serif', color: "var(--text-primary)",
            background: "var(--bg-input)",
          }}
        />
        <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end", marginTop: "0.75rem" }}>
          <button onClick={onClose} style={{
            padding: "0.375rem 1rem", borderRadius: "0.375rem", border: "none",
            background: "var(--bg-hover)", color: "var(--text-primary)",
            fontSize: "0.8125rem", cursor: "pointer",
          }}>Cancel</button>
          <button onClick={() => { if (text.trim()) { onSubmit(text.trim()); onClose() } }} style={{
            padding: "0.375rem 1rem", borderRadius: "0.375rem", border: "none",
            background: "#6349EA", color: "#fff", fontSize: "0.8125rem",
            cursor: text.trim() ? "pointer" : "not-allowed", opacity: text.trim() ? 1 : 0.5,
          }}>Generate</button>
        </div>
      </div>
    </div>
  )
}
