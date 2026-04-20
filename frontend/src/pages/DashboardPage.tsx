import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import TopNav from "../components/TopNav"
import EmptyState from "../components/EmptyState"
import WorkflowCard from "../components/WorkflowCard"
import DeleteConfirmModal from "../components/DeleteConfirmModal"
import { useWorkflowStore } from "../store/workflowStore"
import { updateWorkflow } from "../services/workflow"

export default function DashboardPage() {
  const navigate = useNavigate()
  const { workflows, total, isLoading, fetchWorkflows, createAndNavigate, deleteWorkflow } = useWorkflowStore()
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null)

  useEffect(() => { fetchWorkflows() }, [fetchWorkflows])

  async function handleCreate() {
    const id = await createAndNavigate()
    navigate(`/canvas/${id}`)
  }

  async function handleRename(id: string, name: string) {
    await updateWorkflow(id, { name })
    fetchWorkflows()
  }

  async function handleDelete() {
    if (!deleteTarget) return
    await deleteWorkflow(deleteTarget.id)
    setDeleteTarget(null)
  }

  return (
    <div className="min-h-screen" style={{ background: "#fafafe" }}>
      <TopNav />

      <main className="max-w-[1200px] mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-display" style={{ fontSize: "1.75rem", fontWeight: 600, color: "#1a1a2e", lineHeight: 1.2 }}>
              My Workflows
            </h1>
            <p className="mt-1 text-sm" style={{ color: "#a1a1aa" }}>{total} workflow{total !== 1 ? "s" : ""}</p>
          </div>
          {total > 0 && (
            <button onClick={handleCreate} className="btn-primary text-sm" style={{ padding: "10px 22px" }}>
              + New Workflow
            </button>
          )}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-24">
            <div className="text-sm" style={{ color: "#a1a1aa" }}>Loading...</div>
          </div>
        ) : total === 0 ? (
          <EmptyState onCreate={handleCreate} />
        ) : (
          <div className="grid gap-6" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
            {workflows.map((wf) => (
              <WorkflowCard key={wf.id} workflow={wf}
                onClick={() => navigate(`/canvas/${wf.id}`)}
                onRename={handleRename}
                onDelete={(id, name) => setDeleteTarget({ id, name })}
              />
            ))}
          </div>
        )}
      </main>

      {deleteTarget && (
        <DeleteConfirmModal name={deleteTarget.name} onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} />
      )}
    </div>
  )
}
