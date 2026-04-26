import { useState } from "react"
import { tauri } from "../../services/tauri"

interface HtmlRewritePopupProps {
  selectedText: string
  onResult: (rewrittenHtml: string) => void
  onClose: () => void
}

type Status = "input" | "generating" | "done" | "error"

export default function HtmlRewritePopup({ selectedText, onResult, onClose }: HtmlRewritePopupProps) {
  const [instruction, setInstruction] = useState("")
  const [status, setStatus] = useState<Status>("input")
  const [error, setError] = useState<string | null>(null)
  const [generated, setGenerated] = useState<string | null>(null)

  async function handleSubmit() {
    if (!instruction.trim()) return
    setStatus("generating")
    setError(null)
    try {
      const result = await tauri.aiRewriteHtml(selectedText, instruction.trim())
      setGenerated(result)
      setStatus("done")
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setStatus("error")
    }
  }

  function handleInsert() {
    if (generated) {
      onResult(generated)
    }
  }

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        position: "fixed", inset: 0, zIndex: 10001,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "rgba(0,0,0,0.5)",
      }}
    >
      <div style={{
        width: 480, maxHeight: "80vh",
        background: "var(--bg-surface)",
        borderRadius: 12,
        boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
        display: "flex", flexDirection: "column",
        overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{
          padding: "0.75rem 1rem",
          borderBottom: "1px solid var(--border-color)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <span style={{ fontSize: "0.875rem", fontWeight: 600 }}>✨ AI 改写</span>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-secondary)", display: "flex", padding: "0.25rem" }}>
            <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>close</span>
          </button>
        </div>

        {/* Selected text preview */}
        {selectedText && (
          <div style={{
            padding: "0.5rem 1rem",
            background: "var(--bg-hover)",
            fontSize: "0.75rem", color: "var(--text-secondary)",
            borderBottom: "1px solid var(--border-color)",
            overflow: "hidden",
          }}>
            <span style={{ fontWeight: 600 }}>选中文本：</span>
            {selectedText.slice(0, 100)}{selectedText.length > 100 ? "..." : ""}
          </div>
        )}

        {/* Content */}
        <div style={{ padding: "1rem", overflow: "auto", flex: 1 }}>
          {status === "input" && (
            <>
              <textarea
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                placeholder="例如：把这段改得更活泼、加入更多数据、突出核心观点..."
                autoFocus
                style={{
                  width: "100%", minHeight: 100, padding: "0.625rem",
                  border: "1px solid var(--border-color)", borderRadius: 8,
                  fontSize: "0.8125rem", fontFamily: "inherit", resize: "vertical",
                  boxSizing: "border-box", outline: "none",
                  background: "var(--bg-input)", color: "var(--text-primary)",
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleSubmit()
                }}
              />
              <div style={{ marginTop: "0.5rem", fontSize: "0.6875rem", color: "var(--text-secondary)" }}>
                按 Ctrl+Enter 快速提交
              </div>
            </>
          )}

          {status === "generating" && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.75rem", padding: "1rem 0" }}>
              <span className="material-symbols-outlined" style={{ fontSize: "32px", animation: "spin 1s linear infinite", color: "#6349EA" }}>progress_activity</span>
              <span style={{ fontSize: "0.8125rem", color: "var(--text-secondary)" }}>AI 正在改写中...</span>
            </div>
          )}

          {status === "done" && generated && (
            <div>
              <div style={{ fontSize: "0.75rem", fontWeight: 600, marginBottom: "0.5rem", color: "#22c55e" }}>改写结果：</div>
              <div style={{
                padding: "0.75rem",
                background: "var(--bg-hover)",
                borderRadius: 8,
                fontSize: "0.8125rem",
                lineHeight: 1.6,
                maxHeight: 200,
                overflow: "auto",
                whiteSpace: "pre-wrap",
                color: "var(--text-primary)",
              }}>
                {generated}
              </div>
            </div>
          )}

          {status === "error" && (
            <div style={{ color: "#ef4444", fontSize: "0.8125rem" }}>
              错误：{error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: "0.75rem 1rem",
          borderTop: "1px solid var(--border-color)",
          display: "flex", gap: "0.5rem", justifyContent: "flex-end",
        }}>
          {status === "input" && (
            <>
              <button onClick={onClose} style={{ padding: "0.375rem 0.75rem", borderRadius: 6, border: "1px solid var(--border-color)", background: "transparent", cursor: "pointer", fontSize: "0.8125rem" }}>取消</button>
              <button
                onClick={handleSubmit}
                disabled={!instruction.trim()}
                style={{
                  padding: "0.375rem 0.75rem", borderRadius: 6, border: "none",
                  background: instruction.trim() ? "#6349EA" : "#9ca3af",
                  color: "#fff", cursor: instruction.trim() ? "pointer" : "not-allowed",
                  fontSize: "0.8125rem",
                }}
              >生成</button>
            </>
          )}
          {status === "generating" && null}
          {status === "done" && (
            <>
              <button onClick={() => { setStatus("input"); setGenerated(null) }} style={{ padding: "0.375rem 0.75rem", borderRadius: 6, border: "1px solid var(--border-color)", background: "transparent", cursor: "pointer", fontSize: "0.8125rem" }}>重新编辑</button>
              <button
                onClick={handleInsert}
                style={{ padding: "0.375rem 0.75rem", borderRadius: 6, border: "none", background: "#22c55e", color: "#fff", cursor: "pointer", fontSize: "0.8125rem" }}
              >插入到选中段落下方</button>
            </>
          )}
          {status === "error" && (
            <>
              <button onClick={onClose} style={{ padding: "0.375rem 0.75rem", borderRadius: 6, border: "1px solid var(--border-color)", background: "transparent", cursor: "pointer", fontSize: "0.8125rem" }}>关闭</button>
              <button onClick={handleSubmit} style={{ padding: "0.375rem 0.75rem", borderRadius: 6, border: "none", background: "#6349EA", color: "#fff", cursor: "pointer", fontSize: "0.8125rem" }}>重试</button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
