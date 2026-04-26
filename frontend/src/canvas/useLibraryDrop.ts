import { useCallback } from "react"
import type { Node } from "@xyflow/react"
import { getLibraryDragData } from "../library/libraryDrag"

interface UseLibraryDropParams {
  addNode: (node: Node) => void
  screenToFlowPosition: (position: { x: number; y: number }) => { x: number; y: number }
}

export function useLibraryDrop({ addNode, screenToFlowPosition }: UseLibraryDropParams) {
  const handleLibraryDrop = useCallback((event: React.DragEvent) => {
    const item = getLibraryDragData(event)
    if (!item) return
    event.preventDefault()
    const pos = screenToFlowPosition({ x: event.clientX, y: event.clientY })
    const position = { x: Math.round(pos.x / 20) * 20, y: Math.round(pos.y / 20) * 20 }
    if (item.kind === "text") {
      addNode({
        id: crypto.randomUUID(),
        type: "text_input",
        position,
        data: { nodeType: "text_input", text: item.plain_text ?? item.content_html?.replace(/<[^>]*>/g, "") ?? "" },
      })
      return
    }
    addNode({
      id: crypto.randomUUID(),
      type: "image_asset",
      position,
      data: {
        nodeType: "image_asset",
        title: item.title,
        filePath: item.file_path ?? "",
        description: item.plain_text ?? item.title,
        libraryItemId: item.id,
        width: 320,
        height: 240,
      },
    })
  }, [addNode, screenToFlowPosition])

  const handleCanvasDragOver = useCallback((event: React.DragEvent) => {
    if (event.dataTransfer.types.includes("application/tanvas-library-item")) {
      event.preventDefault()
      event.dataTransfer.dropEffect = "copy"
    }
  }, [])

  return { handleLibraryDrop, handleCanvasDragOver }
}
