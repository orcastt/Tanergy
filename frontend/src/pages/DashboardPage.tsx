import { useEffect, useState } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import { useTranslation } from "react-i18next"
import SideNav from "../components/SideNav"
import TopNav from "../components/TopNav"
import SkillPicker from "../components/SkillPicker"
import { useWorkflowStore } from "../store/workflowStore"
import { useApiKeyStore } from "../store/apiKeyStore"
import { SKILL_DEFS } from "../nodes/skillDefs"
import { NODE_MAP } from "../nodes/nodeDefs"
import { tauri } from "../services/tauri"
import { open } from "@tauri-apps/plugin-dialog"
import { readFile } from "@tauri-apps/plugin-fs"
import { TrashCard, WorkflowCardInline } from "./dashboard/WorkflowCards"

export default function DashboardPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { t } = useTranslation()
  const filter = new URLSearchParams(location.search).get("filter")
  const isTrashView = filter === "trash"
  const [showSkillPicker, setShowSkillPicker] = useState(false)

  const {
    workflows, trashedWorkflows, isLoading,
    fetchWorkflows, createAndNavigate, moveToTrash,
    restoreFromTrash, permanentlyDelete, copyWorkflow,
  } = useWorkflowStore()

  useEffect(() => { fetchWorkflows() }, [fetchWorkflows])

  const { providers, loadProviders } = useApiKeyStore()
  useEffect(() => { loadProviders() }, [loadProviders])
  const noKeys = providers.length > 0 && providers.every((p) => !p.is_set)

  async function handleSkillSelect(skillId: string) {
    setShowSkillPicker(false)
    const skill = SKILL_DEFS.find((s) => s.id === skillId)
    if (!skill) return

    try {
      const wf = await tauri.createWorkflow(t(skill.labelKey))

      if (skill.nodes.length > 0) {
        const nodes = skill.nodes.map((n, i) => {
          const def = NODE_MAP[n.type]
          return {
            id: `node_${i}`,
            type: n.type,
            position: n.position,
            data: { nodeType: n.type, ...(def?.defaultData ?? {}) },
          }
        })
        const edges = skill.edges.map(([from, to], i) => ({
          id: `edge_${i}`,
          source: `node_${from}`,
          target: `node_${to}`,
        }))
        await tauri.updateWorkflow(wf.id, { graph_json: JSON.stringify({ nodes, edges }) })
      }

      navigate(`/canvas/${wf.id}`)
    } catch (e) {
      // Fallback: plain blank workflow
      const id = await createAndNavigate()
      if (id) navigate(`/canvas/${id}`)
    }
  }

  async function handleCreateBlank() {
    const id = await createAndNavigate()
    if (id) navigate(`/canvas/${id}`)
  }

  async function handleRename(id: string, name: string) {
    await tauri.updateWorkflow(id, { name })
    fetchWorkflows()
  }

  async function handleCopy(id: string) {
    await copyWorkflow(id)
  }

  async function handleImport() {
    try {
      const filePath = await open({
        filters: [{ name: "Tangent Workflow", extensions: ["tangent.json", "json"] }],
        multiple: false,
      })
      if (!filePath) return
      const bytes = await readFile(filePath as string)
      const graphJson = new TextDecoder().decode(bytes)
      const name = (filePath as string).split("/").pop()?.replace(/\.tangent\.json$/, "").replace(/\.json$/, "") ?? "Imported Workflow"
      await tauri.importWorkflow(name, graphJson)
      await fetchWorkflows()
    } catch (e) {
      console.error("import failed", e)
    }
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", fontFamily: '"Inter", sans-serif', color: "var(--text-primary)", background: "var(--bg-canvas)" }}>
      <TopNav />

      <div style={{ display: "flex", flex: 1, overflow: "hidden", height: "calc(100vh - 64px)", marginTop: 64 }}>
        <SideNav />

        <main style={{ flex: 1, overflowY: "auto", background: "var(--bg-canvas)", padding: "2rem" }}>
          <div style={{ maxWidth: "72rem", margin: "0 auto" }}>

            {noKeys && (
              <div
                onClick={() => navigate("/settings")}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "0.75rem 1.25rem",
                  marginBottom: "1.5rem",
                  background: "#fef3c7",
                  border: "1px solid #fde68a",
                  borderRadius: 8,
                  cursor: "pointer",
                  fontSize: "0.875rem",
                  color: "#92400e",
                }}
              >
                <span>{t("dashboard.setupPrompt")}</span>
                <span style={{ color: "#b45309", fontWeight: 600 }}>{t("dashboard.goToSettings")}</span>
              </div>
            )}

            <header style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", paddingBottom: "1rem", marginBottom: "2rem" }}>
              <div>
                <h1 style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: "1.875rem", fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
                  {isTrashView ? "Trash" : "Workspace"}
                </h1>
                <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)", marginTop: "0.25rem" }}>
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
                <span style={{ fontSize: "0.875rem", color: "var(--text-secondary)" }}>Loading...</span>
              </div>
            ) : isTrashView ? (
              trashedWorkflows.length === 0 ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "6rem 0", gap: "0.75rem" }}>
                  <span className="material-symbols-outlined" style={{ fontSize: "3rem", color: "var(--text-placeholder)" }}>delete</span>
                  <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)" }}>Trash is empty</p>
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
                {/* Create New — opens Skill Picker */}
                <button
                  onClick={() => setShowSkillPicker(true)}
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
                      {t("dashboard.createNew")}
                    </h3>
                    <p style={{ fontSize: "0.875rem", color: "rgba(255,255,255,0.6)", marginTop: "0.25rem" }}>
                      {t("dashboard.createDescription")}
                    </p>
                  </div>
                </button>

                {/* Import */}
                <button
                  onClick={handleImport}
                  style={{
                    display: "flex", flexDirection: "column", justifyContent: "space-between",
                    height: "14rem", background: "var(--bg-surface)",
                    borderRadius: "0.5rem", padding: "1.5rem", textAlign: "left",
                    border: "none", cursor: "pointer", transition: "transform 150ms ease",
                    boxShadow: "0 0 0 1px rgba(0,0,0,0.05), 0 1px 2px 0 rgba(0,0,0,0.05)",
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.transform = "scale(1.02)"}
                  onMouseLeave={(e) => e.currentTarget.style.transform = "scale(1)"}
                  onMouseDown={(e) => e.currentTarget.style.transform = "scale(0.98)"}
                  onMouseUp={(e) => e.currentTarget.style.transform = "scale(1)"}
                >
                  <div style={{
                    width: "3rem", height: "3rem", borderRadius: "50%",
                    background: "var(--bg-hover)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <span className="material-symbols-outlined" style={{ fontSize: "1.5rem", color: "var(--text-secondary)" }}>download</span>
                  </div>
                  <div>
                    <h3 style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: "1.25rem", fontWeight: 600, color: "var(--text-primary)" }}>
                      {t("dashboard.importWorkflow")}
                    </h3>
                    <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)", marginTop: "0.25rem" }}>
                      {t("dashboard.importDescription")}
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

      {showSkillPicker && (
        <SkillPicker onSelect={handleSkillSelect} onClose={() => setShowSkillPicker(false)} />
      )}
    </div>
  )
}
