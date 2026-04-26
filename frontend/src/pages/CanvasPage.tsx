import { useParams, useNavigate } from "react-router-dom"
import { ReactFlowProvider } from "@xyflow/react"
import { Component } from "react"
import { useCanvas } from "../hooks/useCanvas"
import { useWorkflowStore } from "../store/workflowStore"
import { useOverlayStore } from "../store/overlayStore"
import { tauri } from "../services/tauri"
import Canvas from "../canvas/Canvas"
import { useState } from "react"
import { save } from "@tauri-apps/plugin-dialog"
import { writeFile } from "@tauri-apps/plugin-fs"
import LibraryDrawer from "../library/LibraryDrawer"

export default function CanvasPage() {
  return (
    <ReactFlowProvider>
      <ErrorBoundary>
        <CanvasPageInner />
      </ErrorBoundary>
    </ReactFlowProvider>
  )
}

class ErrorBoundary extends Component<{ children: React.ReactNode }, { error: string | null }> {
  state = { error: null as string | null }
  static getDerivedStateFromError(e: Error) {
    return { error: e.message + "\n" + e.stack?.slice(0, 500) }
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ height: "100vh", background: "#1a1a1a", padding: "2rem", color: "#EF4444", fontFamily: "monospace", whiteSpace: "pre-wrap", fontSize: "0.875rem" }}>
          Canvas Error:\n{this.state.error}
        </div>
      )
    }
    return this.props.children
  }
}

function CanvasPageInner() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { currentWorkflow, isDirty } = useCanvas(id!)
  const editorNodeId = useOverlayStore((s) => s.editorNodeId)
  const htmlEditorNodeId = useOverlayStore((s) => s.htmlEditorNodeId)
  const { saveWorkflow, isSaving, toast, clearToast } = useWorkflowStore()
  const [editingName, setEditingName] = useState(false)
  const [nameDraft, setNameDraft] = useState("")

  if (!currentWorkflow) {
    return (
      <div style={{ height: "100vh", background: "#1a1a1a", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: "1.25rem" }}>
        Loading workflow...
      </div>
    )
  }

  function startEditName() {
    setNameDraft(currentWorkflow!.name)
    setEditingName(true)
  }

  function finishEditName() {
    if (nameDraft.trim()) {
      useWorkflowStore.getState().markDirty()
      useWorkflowStore.setState((state) => ({
        currentWorkflow: state.currentWorkflow
          ? { ...state.currentWorkflow, name: nameDraft.trim() }
          : state.currentWorkflow,
      }))
    }
    setEditingName(false)
  }

  return (
    <div style={{
      height: "100vh",
      display: "flex",
      flexDirection: "column",
      background: "var(--bg-canvas)",
      fontFamily: '"Inter", sans-serif',
      color: "var(--text-primary)",
    }}>
      {/* Top Bar */}
      <header style={{
        background: "var(--bg-header)",
        backdropFilter: "blur(12px)",
        boxShadow: "0 0 0 1px var(--border-subtle), 0 1px 2px 0 rgba(0,0,0,0.05)",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "0 1.5rem",
        height: "56px",
        flexShrink: 0,
        zIndex: 50,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          {/* Back */}
          <button
            onClick={() => {
              if (editorNodeId) {
                useOverlayStore.getState().closeEditor()
                return
              }
              if (htmlEditorNodeId) {
                useOverlayStore.getState().closeHtmlEditor()
                return
              }
              if (isDirty) saveWorkflow()
              navigate("/dashboard")
            }}
            style={{
              display: "flex", alignItems: "center", gap: "0.375rem",
              background: "none", border: "none", cursor: "pointer",
              color: "var(--text-secondary)", fontSize: "0.875rem", fontWeight: 500,
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>arrow_back</span>
            Back
          </button>

          <div style={{ width: "1px", height: "24px", background: "var(--border-color)" }} />

          {/* Workflow name */}
          {editingName ? (
            <input
              autoFocus
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onBlur={finishEditName}
              onKeyDown={(e) => { if (e.key === "Enter") finishEditName(); if (e.key === "Escape") setEditingName(false) }}
              style={{
                border: "none", borderBottom: "2px solid #242424",
                padding: "0.25rem 0", fontSize: "0.875rem", fontWeight: 600,
                fontFamily: '"Space Grotesk", sans-serif',
                color: "var(--text-primary)", outline: "none", background: "transparent",
              }}
            />
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span
                onDoubleClick={startEditName}
                style={{
                  fontFamily: '"Space Grotesk", sans-serif',
                  fontWeight: 600, fontSize: "0.875rem", color: "var(--text-primary)",
                  cursor: "text",
                }}
              >
                {currentWorkflow.name}
              </span>
              {isDirty && <span style={{ color: "var(--color-error)", fontSize: "0.75rem" }}>●</span>}
            </div>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <button
            onClick={async () => {
              if (!currentWorkflow) return
              try {
                const json = await tauri.exportWorkflow(currentWorkflow.id)
                const filePath = await save({
                  defaultPath: `${currentWorkflow.name}.tangent.json`,
                  filters: [{ name: "Tangent Workflow", extensions: ["tangent.json"] }],
                })
                if (filePath) {
                  await writeFile(filePath, new TextEncoder().encode(json))
                  useWorkflowStore.setState({ toast: "Exported!" })
                  setTimeout(() => useWorkflowStore.setState({ toast: null }), 2000)
                }
              } catch (e) {
                console.error("export failed", e)
              }
            }}
            style={{
              background: "var(--bg-hover)", color: "var(--text-primary)",
              padding: "0.375rem 1rem", borderRadius: "0.375rem",
              fontSize: "0.875rem", fontWeight: 500, border: "none", cursor: "pointer",
              display: "flex", alignItems: "center", gap: "0.25rem",
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>upload</span>
            Export
          </button>
          <button
            onClick={() => saveWorkflow()}
            disabled={isSaving}
            style={{
              background: "#242424", color: "#ffffff",
              padding: "0.375rem 1rem", borderRadius: "0.375rem",
              fontSize: "0.875rem", fontWeight: 500, border: "none",
              cursor: isSaving ? "not-allowed" : "pointer",
              opacity: isSaving ? 0.6 : 1,
            }}
          >
            {isSaving ? "Saving..." : "Save"}
          </button>
        </div>
      </header>

      {/* Canvas */}
      <div style={{ flex: 1, position: "relative" }}>
        <Canvas />
        <LibraryDrawer />
      </div>

      {/* Toast */}
      {toast && (
        <div
          onClick={clearToast}
          style={{
            position: "fixed", bottom: "2rem", left: "50%", transform: "translateX(-50%)",
            background: "#242424", color: "#ffffff", padding: "0.5rem 1.5rem",
            borderRadius: "9999px", fontSize: "0.8125rem", fontWeight: 500,
            cursor: "pointer", zIndex: 100,
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
          }}
        >
          {toast}
        </div>
      )}
    </div>
  )
}
