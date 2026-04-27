import { useEffect } from "react"
import type { Node } from "@xyflow/react"
import { useCanvasStore } from "../store/canvasStore"
import { useOverlayStore } from "../store/overlayStore"

interface CanvasKeyboardShortcuts {
  nodes: Node[]
  copySelected: () => void
  pasteNodes: () => void
  deleteSelected: () => void
  groupSelected: () => void
  ungroupSelected: () => void
}

export function useCanvasKeyboardShortcuts({
  nodes,
  copySelected,
  pasteNodes,
  deleteSelected,
  groupSelected,
  ungroupSelected,
}: CanvasKeyboardShortcuts) {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const tag = (event.target as HTMLElement).tagName
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return

      if (event.key === "c" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        copySelected()
      } else if (event.key === "v" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        pasteNodes()
      } else if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault()
        deleteSelected()
      } else if (event.key === "Escape") {
        useOverlayStore.getState().closePicker()
        useOverlayStore.getState().closeCtxMenu()
        useOverlayStore.getState().closeHtmlEditor()
        useOverlayStore.getState().closeWriterEditor()
      } else if (event.key === "g" && !event.metaKey && !event.ctrlKey) {
        const { selectedNodeIds } = useCanvasStore.getState()
        const isGroup = selectedNodeIds.length === 1 && nodes.find((node) => node.id === selectedNodeIds[0])?.type === "group"
        if (isGroup) ungroupSelected()
        else groupSelected()
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [copySelected, pasteNodes, deleteSelected, groupSelected, ungroupSelected, nodes])
}
