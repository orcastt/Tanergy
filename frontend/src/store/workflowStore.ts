import { create } from "zustand"
import { listWorkflows, createWorkflow, deleteWorkflow as deleteApi } from "../services/workflow"
import type { Workflow } from "../types/workflow"

interface WorkflowState {
  workflows: Workflow[]
  total: number
  isLoading: boolean
  fetchWorkflows: () => Promise<void>
  createAndNavigate: () => Promise<string>
  deleteWorkflow: (id: string) => Promise<void>
}

export const useWorkflowStore = create<WorkflowState>((set, get) => ({
  workflows: [],
  total: 0,
  isLoading: true,

  fetchWorkflows: async () => {
    set({ isLoading: true })
    try {
      const res = await listWorkflows()
      set({ workflows: res.workflows, total: res.total, isLoading: false })
    } catch {
      set({ isLoading: false })
    }
  },

  createAndNavigate: async () => {
    const wf = await createWorkflow()
    set((s) => ({ workflows: [wf, ...s.workflows], total: s.total + 1 }))
    return wf.id
  },

  deleteWorkflow: async (id) => {
    await deleteApi(id)
    set((s) => ({
      workflows: s.workflows.filter((w) => w.id !== id),
      total: s.total - 1,
    }))
  },
}))
