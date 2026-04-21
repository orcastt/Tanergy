import { create } from "zustand"
import { tauri } from "../services/tauri"
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
  isLoading: boolean
  isDirty: boolean
  isSaving: boolean
  currentWorkflow: WorkflowDetail | null
  toast: string | null

  fetchWorkflows: () => Promise<void>
  createAndNavigate: () => Promise<string | undefined>
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
  isLoading: true,
  isDirty: false,
  isSaving: false,
  currentWorkflow: null,
  toast: null,

  fetchWorkflows: async () => {
    set({ isLoading: true })
    try {
      const wfs = await tauri.listWorkflows()
      const trashedIds = new Set(get().trashedWorkflows.map((w) => w.id))
      const filtered = wfs.filter((w) => !trashedIds.has(w.id))
      set({ workflows: filtered, isLoading: false })
    } catch {
      set({ isLoading: false })
    }
  },

  createAndNavigate: async () => {
    try {
      const wf = await tauri.createWorkflow()
      set((s) => ({ workflows: [wf, ...s.workflows] }))
      return wf.id
    } catch (e) {
      if (String(e).includes("FREE_PLAN_LIMIT")) {
        set({ toast: "Free 计划最多 3 个工作流，升级 Pro 解锁无限" })
        setTimeout(() => set({ toast: null }), 4000)
      }
      return undefined
    }
  },

  deleteWorkflow: async (id) => {
    await tauri.deleteWorkflow(id)
    set((s) => ({
      workflows: s.workflows.filter((w) => w.id !== id),
    }))
  },

  moveToTrash: (id) => {
    const { workflows, trashedWorkflows } = get()
    const wf = workflows.find((w) => w.id === id)
    if (!wf) return
    const newTrash = [wf, ...trashedWorkflows]
    saveTrash(newTrash)
    set((s) => ({
      workflows: s.workflows.filter((w) => w.id !== id),
      trashedWorkflows: newTrash,
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
    }))
  },

  permanentlyDelete: async (id) => {
    try { await tauri.deleteWorkflow(id) } catch { /* already gone */ }
    const newTrash = get().trashedWorkflows.filter((w) => w.id !== id)
    saveTrash(newTrash)
    set({ trashedWorkflows: newTrash })
  },

  copyWorkflow: async (id) => {
    const original = await tauri.getWorkflow(id)
    const copy = await tauri.createWorkflow(`${original.name} (copy)`)
    await tauri.updateWorkflow(copy.id, { graph_json: original.graph_json })
    const fresh = await tauri.getWorkflow(copy.id)
    set((s) => ({ workflows: [fresh, ...s.workflows] }))
  },

  loadWorkflow: async (id) => {
    try {
      const wf = await tauri.getWorkflow(id)
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
      const graph = useCanvasStore.getState().getGraphJson()
      const graphJson = JSON.stringify(graph)
      await tauri.updateWorkflow(currentWorkflow.id, { graph_json: graphJson })
      set({ isSaving: false, isDirty: false, toast: "Saved" })
      setTimeout(() => set({ toast: null }), 3000)
    } catch {
      set({ isSaving: false, toast: "Save failed — retry" })
    }
  },

  markDirty: () => set({ isDirty: true }),
  clearToast: () => set({ toast: null }),
}))
