import { useEffect, useState, useRef } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import SideNav from "../components/SideNav"
import TopNav from "../components/TopNav"
import { useWorkflowStore } from "../store/workflowStore"
import { updateWorkflow } from "../services/workflow"
import type { Workflow } from "../types/workflow"

const CARD_COLORS = ["#6349EA", "#22C55E", "#3B82F6", "#F59E0B", "#EF4444"]

function hashCode(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0
  return h
}

export default function DashboardPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const filter = new URLSearchParams(location.search).get("filter")
  const isTrashView = filter === "trash"

  const {
    workflows, trashedWorkflows, total, isLoading,
    fetchWorkflows, createAndNavigate, moveToTrash,
    restoreFromTrash, permanentlyDelete, copyWorkflow,
  } = useWorkflowStore()

  useEffect(() => { fetchWorkflows() }, [fetchWorkflows])

  async function handleCreate() {
    const id = await createAndNavigate()
    if (id) navigate(`/canvas/${id}`)
  }

  async function handleRename(id: string, name: string) {
    await updateWorkflow(id, { name })
    fetchWorkflows()
  }

  async function handleCopy(id: string) {
    await copyWorkflow(id)
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", fontFamily: '"Inter", sans-serif', color: "#1b1c1c", background: "#f5f3f3" }}>
      <TopNav />

      <div style={{ display: "flex", flex: 1, overflow: "hidden", height: "calc(100vh - 64px)", marginTop: 64 }}>
        <SideNav />

        <main style={{ flex: 1, overflowY: "auto", background: "#f5f3f3", padding: "2rem" }}>
          <div style={{ maxWidth: "72rem", margin: "0 auto" }}>

            <header style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", paddingBottom: "1rem", marginBottom: "2rem" }}>
              <div>
                <h1 style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: "1.875rem", fontWeight: 700, color: "#0e0f0f", letterSpacing: "-0.02em" }}>
                  {isTrashView ? "Trash" : "Workspace"}
                </h1>
                <p style={{ fontSize: "0.875rem", color: "#444748", marginTop: "0.25rem" }}>
                  {isTrashView
                    ? "Workflows moved to trash. Restore or permanently delete them."
                    : "Manage and orchestrate your active workflows."}
                </p>
              </div>
              {isTrashView && trashedWorkflows.length > 0 && (
                <button
                  onClick={async () => {
                    if (confirm(`Permanently delete all ${trashedWorkflows.length} trashed workflows?`)) {
                      for (const wf of trashedWorkflows) await permanentlyDelete(wf.id)
                    }
                  }}
                  style={{
                    padding: "0.5rem 1rem", fontSize: "0.8125rem", fontWeight: 500,
                    background: "transparent", border: "1px solid #e2bdbd", color: "#ba1a1a",
                    borderRadius: "0.375rem", cursor: "pointer",
                  }}
                >
                  Empty Trash
                </button>
              )}
            </header>

            {isLoading ? (
              <div style={{ display: "flex", justifyContent: "center", padding: "6rem 0" }}>
                <span style={{ fontSize: "0.875rem", color: "#747878" }}>Loading...</span>
              </div>
            ) : isTrashView ? (
              trashedWorkflows.length === 0 ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "6rem 0", gap: "0.75rem" }}>
                  <span className="material-symbols-outlined" style={{ fontSize: "3rem", color: "#c4c4c4" }}>delete</span>
                  <p style={{ fontSize: "0.875rem", color: "#747878" }}>Trash is empty</p>
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1.5rem" }}>
                  {trashedWorkflows.map((wf) => (
                    <TrashCard
                      key={wf.id}
                      workflow={wf}
                      onRestore={() => restoreFromTrash(wf.id)}
                      onDelete={() => permanentlyDelete(wf.id)}
                    />
                  ))}
                </div>
              )
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1.5rem" }}>
                {/* Create New */}
                <button
                  onClick={handleCreate}
                  style={{
                    display: "flex", flexDirection: "column", justifyContent: "space-between",
                    height: "14rem", background: "#242424", color: "#ffffff",
                    borderRadius: "0.5rem", padding: "1.5rem", textAlign: "left",
                    border: "none", cursor: "pointer", transition: "transform 150ms ease",
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.transform = "scale(1.02)"}
                  onMouseLeave={(e) => e.currentTarget.style.transform = "scale(1)"}
                  onMouseDown={(e) => e.currentTarget.style.transform = "scale(0.98)"}
                  onMouseUp={(e) => e.currentTarget.style.transform = "scale(1)"}
                >
                  <div style={{
                    width: "3rem", height: "3rem", borderRadius: "50%",
                    background: "rgba(255,255,255,0.1)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <span className="material-symbols-outlined" style={{ fontSize: "1.5rem", color: "#ffffff" }}>add</span>
                  </div>
                  <div>
                    <h3 style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: "1.25rem", fontWeight: 600, color: "#ffffff" }}>
                      Create New Workflow
                    </h3>
                    <p style={{ fontSize: "0.875rem", color: "rgba(255,255,255,0.6)", marginTop: "0.25rem" }}>
                      Start a blank canvas or import data.
                    </p>
                  </div>
                </button>

                {workflows.map((wf) => (
                  <WorkflowCardInline
                    key={wf.id}
                    workflow={wf}
                    onClick={() => navigate(`/canvas/${wf.id}`)}
                    onRename={handleRename}
                    onCopy={() => handleCopy(wf.id)}
                    onTrash={() => moveToTrash(wf.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}

/* ── Trash Card ── */
function TrashCard({ workflow, onRestore, onDelete }: {
  workflow: Workflow
  onRestore: () => void
  onDelete: () => void
}) {
  const colorIdx = Math.abs(hashCode(workflow.id)) % CARD_COLORS.length
  const color = CARD_COLORS[colorIdx]

  return (
    <div style={{
      background: "#ffffff", borderRadius: "0.5rem", padding: "1.25rem",
      height: "14rem", display: "flex", flexDirection: "column", justifyContent: "space-between",
      boxShadow: "0 0 0 1px rgba(0,0,0,0.05), 0 1px 2px 0 rgba(0,0,0,0.05)",
      opacity: 0.75,
    }}>
      <div style={{
        width: "100%", height: "6rem", background: "#f5f3f3",
        borderRadius: "0.5rem", marginBottom: "1rem", overflow: "hidden", position: "relative",
      }}>
        <div style={{ position: "absolute", inset: 0, background: `linear-gradient(to bottom right, ${color}10, transparent)` }} />
        <div style={{
          position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: "2rem", color: "#c4c4c4" }}>delete</span>
        </div>
      </div>
      <div>
        <h4 style={{ fontFamily: '"Space Grotesk", sans-serif', fontWeight: 600, fontSize: "0.875rem", color: "#747878" }}>
          {workflow.name}
        </h4>
        <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.625rem" }}>
          <button
            onClick={onRestore}
            style={{
              flex: 1, padding: "0.375rem 0", fontSize: "0.75rem", fontWeight: 500,
              background: "#f5f3f3", border: "none", borderRadius: "0.25rem",
              color: "#0e0f0f", cursor: "pointer",
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = "#e8e8e8"}
            onMouseLeave={(e) => e.currentTarget.style.background = "#f5f3f3"}
          >
            Restore
          </button>
          <button
            onClick={() => { if (confirm(`Permanently delete "${workflow.name}"?`)) onDelete() }}
            style={{
              flex: 1, padding: "0.375rem 0", fontSize: "0.75rem", fontWeight: 500,
              background: "#fff0f0", border: "none", borderRadius: "0.25rem",
              color: "#ba1a1a", cursor: "pointer",
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = "#ffdad6"}
            onMouseLeave={(e) => e.currentTarget.style.background = "#fff0f0"}
          >
            Delete Forever
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Workflow Card ── */
function WorkflowCardInline({ workflow, onClick, onRename, onCopy, onTrash }: {
  workflow: Workflow
  onClick: () => void
  onRename: (id: string, name: string) => void
  onCopy: () => void
  onTrash: () => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(workflow.name)
  const [hovered, setHovered] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const colorIdx = Math.abs(hashCode(workflow.id)) % CARD_COLORS.length
  const color = CARD_COLORS[colorIdx]

  useEffect(() => { if (editing) inputRef.current?.focus() }, [editing])
  useEffect(() => {
    if (!menuOpen) return
    const h = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false) }
    document.addEventListener("mousedown", h)
    return () => document.removeEventListener("mousedown", h)
  }, [menuOpen])

  function finishRename() {
    const t = draft.trim()
    if (t && t !== workflow.name) onRename(workflow.id, t)
    setEditing(false)
  }

  const updated = new Date(workflow.updated_at)
  const timeAgo = getTimeAgo(updated)

  return (
    <div
      onClick={() => { if (!editing && !menuOpen) onClick() }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: "#ffffff",
        borderRadius: "0.5rem",
        padding: "1.25rem",
        height: "14rem",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        boxShadow: "0 0 0 1px rgba(0,0,0,0.05), 0 1px 2px 0 rgba(0,0,0,0.05)",
        cursor: editing ? "default" : "pointer",
        transition: "background-color 200ms",
        position: "relative",
        backgroundColor: hovered ? "#faf9f9" : "#ffffff",
      }}
    >
      {/* Thumbnail */}
      <div style={{
        width: "100%", height: "6rem", background: "#f5f3f3",
        borderRadius: "0.5rem", marginBottom: "1rem", overflow: "hidden", position: "relative",
      }}>
        <div style={{ position: "absolute", inset: 0, background: `linear-gradient(to bottom right, ${color}10, transparent)` }} />
        <div style={{
          position: "absolute", top: "0.5rem", left: "0.5rem", width: "4rem", height: "2rem",
          background: "#ffffff", borderRadius: "0.25rem",
          boxShadow: "0 0 0 1px rgba(0,0,0,0.05), 0 1px 2px 0 rgba(0,0,0,0.05)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "8px", fontWeight: 600, color: "#0e0f0f",
        }}>Input</div>
        <div style={{
          position: "absolute", top: "2rem", left: "2.5rem", width: "4rem", height: "2rem",
          background: "#ffffff", borderRadius: "0.25rem",
          boxShadow: "0 0 0 1px rgba(0,0,0,0.05), 0 1px 2px 0 rgba(0,0,0,0.05)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "8px", fontWeight: 600, color: "#0e0f0f",
        }}>Process</div>
      </div>

      {/* Info */}
      <div style={{ position: "relative" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          {editing ? (
            <input
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={finishRename}
              onKeyDown={(e) => { if (e.key === "Enter") finishRename(); if (e.key === "Escape") { setDraft(workflow.name); setEditing(false) } }}
              onClick={(e) => e.stopPropagation()}
              style={{
                flex: 1, padding: "0.25rem 0.5rem", fontSize: "0.875rem", fontWeight: 600,
                color: "#0e0f0f", background: "#f5f3f3", borderRadius: "0.25rem",
                border: "1.5px solid #6349EA", outline: "none",
              }}
            />
          ) : (
            <h4
              onDoubleClick={(e) => { e.stopPropagation(); setEditing(true) }}
              style={{
                fontFamily: '"Space Grotesk", sans-serif',
                fontWeight: 600, fontSize: "0.875rem",
                color: hovered ? color : "#0e0f0f",
                transition: "color 200ms",
                flex: 1, marginRight: "0.25rem",
                userSelect: "none",
              }}
              title="Double-click to rename"
            >
              {workflow.name}
            </h4>
          )}

          {/* Three-dot menu */}
          <div ref={menuRef} style={{ position: "relative", flexShrink: 0 }}>
            <button
              onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen) }}
              style={{
                padding: "0.25rem",
                opacity: hovered || menuOpen ? 1 : 0,
                background: menuOpen ? "#f5f3f3" : "transparent",
                border: "none", color: "#747878", cursor: "pointer",
                borderRadius: "0.25rem",
                transition: "opacity 200ms, background 150ms",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>more_vert</span>
            </button>

            {menuOpen && (
              <div style={{
                position: "absolute", right: 0, top: "calc(100% + 4px)",
                background: "#ffffff",
                padding: "0.375rem 0", zIndex: 50, minWidth: "160px",
                borderRadius: "0.75rem",
                boxShadow: "0 4px 16px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.06)",
              }}>
                <MenuItem
                  icon="edit"
                  label="Rename"
                  onClick={(e) => { e.stopPropagation(); setEditing(true); setMenuOpen(false) }}
                />
                <MenuItem
                  icon="content_copy"
                  label="Make a copy"
                  onClick={(e) => { e.stopPropagation(); onCopy(); setMenuOpen(false) }}
                />
                <div style={{ height: "1px", background: "#f0f0f0", margin: "0.375rem 0" }} />
                <MenuItem
                  icon="delete"
                  label="Move to Trash"
                  danger
                  onClick={(e) => { e.stopPropagation(); onTrash(); setMenuOpen(false) }}
                />
              </div>
            )}
          </div>
        </div>

        <p style={{ fontSize: "0.75rem", color: "#444748", marginTop: "0.25rem" }}>
          Edited {timeAgo}
        </p>
      </div>
    </div>
  )
}

function MenuItem({ icon, label, danger, onClick }: {
  icon: string
  label: string
  danger?: boolean
  onClick: (e: React.MouseEvent) => void
}) {
  const [hov, setHov] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        width: "100%", display: "flex", alignItems: "center", gap: "0.625rem",
        padding: "0.5rem 1rem", fontSize: "0.8125rem",
        background: hov ? (danger ? "#fff0f0" : "#f5f3f3") : "transparent",
        border: "none", cursor: "pointer",
        color: danger ? "#ba1a1a" : "#0e0f0f",
        textAlign: "left",
      }}
    >
      <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>{icon}</span>
      {label}
    </button>
  )
}

function getTimeAgo(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  if (diffMins < 60) return `${diffMins} mins ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours} hr${diffHours !== 1 ? "s" : ""} ago`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays === 1) return "yesterday"
  if (diffDays < 7) return `${diffDays} days ago`
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}
