import { create } from "zustand"
import { listWorkflows, createWorkflow, deleteWorkflow as deleteApi, getWorkflow, updateWorkflow } from "../services/workflow"
import { useCanvasStore } from "./canvasStore"
import type { Workflow, WorkflowDetail } from "../types/workflow"

const TRASH_KEY = "tangent_trash"

function loadTrash(): Workflow[] {
  try { return JSON.parse(localStorage.getItem(TRASH_KEY) || "[]") } catch { return [] }
}
function saveTrash(trash: Workflow[]) {
  localStorage.setItem(TRASH_KEY, JSON.stringify(trash))
}

interface WorkflowState {
  workflows: Workflow[]
  trashedWorkflows: Workflow[]
  total: number
  isLoading: boolean
  isDirty: boolean
  isSaving: boolean
  currentWorkflow: WorkflowDetail | null
  toast: string | null

  fetchWorkflows: () => Promise<void>
  createAndNavigate: () => Promise<string>
  deleteWorkflow: (id: string) => Promise<void>
  moveToTrash: (id: string) => void
  restoreFromTrash: (id: string) => void
  permanentlyDelete: (id: string) => Promise<void>
  copyWorkflow: (id: string) => Promise<void>
  loadWorkflow: (id: string) => Promise<void>
  saveWorkflow: () => Promise<void>
  markDirty: () => void
  clearToast: () => void
}

export const useWorkflowStore = create<WorkflowState>((set, get) => ({
  workflows: [],
  trashedWorkflows: loadTrash(),
  total: 0,
  isLoading: true,
  isDirty: false,
  isSaving: false,
  currentWorkflow: null,
  toast: null,

  fetchWorkflows: async () => {
    set({ isLoading: true })
    try {
      const res = await listWorkflows()
      const trashedIds = new Set(get().trashedWorkflows.map((w) => w.id))
      const filtered = res.workflows.filter((w) => !trashedIds.has(w.id))
      set({ workflows: filtered, total: filtered.length, isLoading: false })
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

  moveToTrash: (id) => {
    const { workflows, trashedWorkflows } = get()
    const wf = workflows.find((w) => w.id === id)
    if (!wf) return
    const newTrash = [{ ...wf, _trashedAt: new Date().toISOString() } as Workflow, ...trashedWorkflows]
    saveTrash(newTrash)
    set((s) => ({
      workflows: s.workflows.filter((w) => w.id !== id),
      trashedWorkflows: newTrash,
      total: s.total - 1,
    }))
  },

  restoreFromTrash: (id) => {
    const { trashedWorkflows } = get()
    const wf = trashedWorkflows.find((w) => w.id === id)
    if (!wf) return
    const newTrash = trashedWorkflows.filter((w) => w.id !== id)
    saveTrash(newTrash)
    set((s) => ({
      workflows: [wf, ...s.workflows],
      trashedWorkflows: newTrash,
      total: s.total + 1,
    }))
  },

  permanentlyDelete: async (id) => {
    try { await deleteApi(id) } catch { /* already gone */ }
    const newTrash = get().trashedWorkflows.filter((w) => w.id !== id)
    saveTrash(newTrash)
    set({ trashedWorkflows: newTrash })
  },

  copyWorkflow: async (id) => {
    const original = await getWorkflow(id)
    const copy = await createWorkflow(`${original.name} (copy)`)
    await updateWorkflow(copy.id, { graph_json: original.graph_json })
    const fresh = await getWorkflow(copy.id)
    set((s) => ({ workflows: [fresh, ...s.workflows], total: s.total + 1 }))
  },

  loadWorkflow: async (id) => {
    try {
      const wf = await getWorkflow(id)
      set({ currentWorkflow: wf, isDirty: false })
    } catch {
      set({ currentWorkflow: null })
    }
  },

  saveWorkflow: async () => {
    const { currentWorkflow, isDirty } = get()
    if (!currentWorkflow || !isDirty) return
    set({ isSaving: true })
    try {
      const graphJson = useCanvasStore.getState().getGraphJson()
      await updateWorkflow(currentWorkflow.id, { graph_json: graphJson })
      set({ isSaving: false, isDirty: false, toast: "Saved" })
      setTimeout(() => set({ toast: null }), 3000)
    } catch {
      set({ isSaving: false, toast: "Save failed — retry" })
    }
  },

  markDirty: () => set({ isDirty: true }),
  clearToast: () => set({ toast: null }),
}))
