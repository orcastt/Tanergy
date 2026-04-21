import { useEffect, useCallback } from "react"
import { useCanvasStore } from "../store/canvasStore"
import { useWorkflowStore } from "../store/workflowStore"

export function useCanvas(workflowId: string) {
  const { setGraphFromJson, setOnDirty, undo, redo } = useCanvasStore()
  const { currentWorkflow, loadWorkflow, saveWorkflow, isDirty } = useWorkflowStore()

  // Load workflow on mount
  useEffect(() => {
    if (workflowId) loadWorkflow(workflowId)
  }, [workflowId, loadWorkflow])

  // Set graph when workflow loads
  useEffect(() => {
    if (currentWorkflow?.graph_json) {
      setGraphFromJson(JSON.parse(currentWorkflow.graph_json))
    }
  }, [currentWorkflow, setGraphFromJson])

  // Dirty callback
  useEffect(() => {
    setOnDirty(() => useWorkflowStore.setState({ isDirty: true }))
    return () => setOnDirty(undefined)
  }, [setOnDirty])

  // Keyboard shortcuts
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const mod = e.metaKey || e.ctrlKey

    if (mod && e.key === "z" && !e.shiftKey) {
      e.preventDefault()
      undo()
    }
    if (mod && e.key === "z" && e.shiftKey) {
      e.preventDefault()
      redo()
    }
    if (mod && e.key === "s") {
      e.preventDefault()
      saveWorkflow()
    }
    if (e.key === "n" && !mod && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
      // NodePicker opening handled in Canvas component
    }
  }, [undo, redo, saveWorkflow])

  // Beforeunload warning
  const handleBeforeUnload = useCallback((e: BeforeUnloadEvent) => {
    if (useWorkflowStore.getState().isDirty) {
      e.preventDefault()
      e.returnValue = ""
    }
  }, [])

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown)
    window.addEventListener("beforeunload", handleBeforeUnload)
    return () => {
      document.removeEventListener("keydown", handleKeyDown)
      window.removeEventListener("beforeunload", handleBeforeUnload)
      // Auto-save on unmount if dirty
      const { isDirty } = useWorkflowStore.getState()
      if (isDirty) useWorkflowStore.getState().saveWorkflow()
    }
  }, [handleKeyDown, handleBeforeUnload])

  return { currentWorkflow, isDirty }
}
