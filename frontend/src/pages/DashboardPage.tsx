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

  useEffect(() => {
    fetchWorkflows()
  }, [fetchWorkflows])

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
    <div className="min-h-screen bg-[#f5f5f5]">
      <TopNav />

      <main className="max-w-[1200px] mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 style={{ fontFamily: "'Cal Sans', sans-serif", fontSize: "1.5rem", fontWeight: 600, color: "#242424" }}>
            My Workflows
          </h1>
          {total > 0 && (
            <button
              onClick={handleCreate}
              className="text-white text-sm font-medium"
              style={{
                background: "#242424",
                borderRadius: "6px",
                padding: "8px 20px",
                boxShadow: "rgba(19,19,22,0.7) 0px 1px 5px -4px, rgba(34,42,53,0.08) 0px 0px 0px 1px, rgba(34,42,53,0.05) 0px 4px 8px",
              }}
            >
              + New Workflow
            </button>
          )}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-24">
            <div className="text-[#898989]">Loading...</div>
          </div>
        ) : total === 0 ? (
          <EmptyState onCreate={handleCreate} />
        ) : (
          <div className="grid gap-6" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
            {workflows.map((wf) => (
              <WorkflowCard
                key={wf.id}
                workflow={wf}
                onClick={() => navigate(`/canvas/${wf.id}`)}
                onRename={handleRename}
                onDelete={(id, name) => setDeleteTarget({ id, name })}
              />
            ))}
          </div>
        )}
      </main>

      {deleteTarget && (
        <DeleteConfirmModal
          name={deleteTarget.name}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}
