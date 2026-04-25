import { useCallback, useRef, useEffect, type ComponentType } from "react"
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  useReactFlow,
  SelectionMode,
  type OnConnect,
  type Connection,
  type NodeChange,
  type EdgeChange,
  type IsValidConnection,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"

import { useCanvasStore } from "../store/canvasStore"
import { useOverlayStore } from "../store/overlayStore"
import { nodeTypes } from "../nodes/index"
import { NODE_MAP } from "../nodes/nodeDefs"
import OverlayLayer from "./OverlayLayer"
import Toolbar from "./Toolbar"
import CanvasControls from "./CanvasControls"
import AgentPanel from "../agent/AgentPanel"
import NodePicker from "./NodePicker"
import ContextMenu from "./ContextMenu"
import LightboxOverlay from "./LightboxOverlay"
import ImageEditorModal from "../nodes/image/ImageEditorModal"
import HtmlEditorModal from "../nodes/image/HtmlEditorModal"
import DeletableEdge from "./DeletableEdge"
import type { NodeType } from "../types/node"

const edgeTypes = { default: DeletableEdge }

const SNAP_GRID = [20, 20] as [number, number]
const MAX_AUTO_INPUTS = 10

function getOutputPortType(nodeId: string, handleId: string | null | undefined, nodes: any[]) {
  const node = nodes.find((n) => n.id === nodeId)
  if (!node) return null
  const def = NODE_MAP[node.data.nodeType as NodeType]
  if (!def) return null
  if (!handleId) return def.outputs[0]?.type ?? null
  const staticPort = def.outputs.find((o) => o.id === handleId)
  if (staticPort) return staticPort.type
  if (node.data.nodeType === "image_list" && handleId.startsWith("image")) return "image_slot"
  return null
}

function getInputPortType(nodeId: string, handleId: string | null | undefined, nodes: any[]) {
  const node = nodes.find((n) => n.id === nodeId)
  if (!node) return null
  const def = NODE_MAP[node.data.nodeType as NodeType]
  if (!def) return null
  if (!handleId) return def.inputs[0]?.type ?? null
  const staticPort = def.inputs.find((i) => i.id === handleId)
  if (staticPort) return staticPort.type
  if (node.data.nodeType === "image_list" && handleId.startsWith("img_in_")) return "image_slot"
  if (node.data.nodeType === "html_formatter" && handleId.startsWith("text_")) return "text"
  if (node.data.nodeType === "html_formatter" && (handleId === "images" || handleId.startsWith("image_"))) return "image_slot"
  return null
}

function isInputOccupied(edges: any[], nodeId: string, handleId: string | null | undefined) {
  return edges.some((e) => e.target === nodeId && e.targetHandle === handleId)
}

function nextNumberedHandle(existing: string[], prefix: string) {
  const used = new Set(existing)
  for (let i = 1; i <= MAX_AUTO_INPUTS; i += 1) {
    const candidate = `${prefix}${i}`
    if (!used.has(candidate)) return candidate
  }
  return null
}

function resolveAutoInputExpansion(connection: Connection, nodes: any[], edges: any[]) {
  if (!connection.source || !connection.target || !connection.targetHandle) return null
  const sourceType = getOutputPortType(connection.source, connection.sourceHandle, nodes)
  const targetType = getInputPortType(connection.target, connection.targetHandle, nodes)
  if (!sourceType || !targetType || sourceType !== targetType) return null

  const targetNode = nodes.find((n) => n.id === connection.target)
  if (!targetNode) return null

  const nodeType = targetNode.data.nodeType as NodeType
  const targetHandle = connection.targetHandle

  if (nodeType === "html_formatter" && targetType === "text" && targetHandle.startsWith("text_")) {
    const textInputs = (targetNode.data.textInputs as string[] | undefined) ?? ["text_1"]
    const existing = new Set(textInputs)
    for (let i = 1; i <= MAX_AUTO_INPUTS; i += 1) {
      const candidate = `text_${i}`
      if (!existing.has(candidate) || !isInputOccupied(edges, targetNode.id, candidate)) {
        return {
          targetHandle: candidate,
          data: existing.has(candidate) ? undefined : { textInputs: [...textInputs, candidate] },
        }
      }
    }
  }

  if (nodeType === "html_formatter" && targetType === "image_slot" && (targetHandle === "images" || targetHandle.startsWith("image_"))) {
    const imageInputs = (targetNode.data.imageInputs as string[] | undefined) ?? ["images"]
    const used = new Set(imageInputs)
    let candidate: string | null = null
    for (let i = 2; i <= MAX_AUTO_INPUTS; i += 1) {
      const handle = `image_${i}`
      if (!used.has(handle)) {
        candidate = handle
        break
      }
    }
    if (!candidate) return null
    return { targetHandle: candidate, data: { imageInputs: [...imageInputs, candidate] } }
  }

  if (nodeType === "image_list" && targetType === "image_slot" && targetHandle.startsWith("img_in_")) {
    const imageInputs = (targetNode.data.imageInputs as string[] | undefined) ?? ["img_in_1"]
    const candidate = nextNumberedHandle(imageInputs, "img_in_")
    if (!candidate) return null
    return { targetHandle: candidate, data: { imageInputs: [...imageInputs, candidate] } }
  }

  return null
}

export default function Canvas() {
  const {
    nodes, edges, addNode, addEdge, onNodesChange, onEdgesChange, removeNode,
    copySelected, pasteNodes, deleteSelected, duplicateNode, clipboard,
    groupSelected, ungroupSelected,
    undo, canUndo, getGraphJson, setGraphFromJson, updateNodeData,
  } = useCanvasStore()

  const { pickerOpen, pickerScreenPos, ctxMenu, editorNodeId, htmlEditorNodeId, lightboxImage } = useOverlayStore()
  const lastClickRef = useRef<{ time: number; x: number; y: number } | null>(null)
  const { screenToFlowPosition } = useReactFlow()

  // Clear overlays on unmount so they don't persist across navigations
  useEffect(() => {
    return () => {
      useOverlayStore.getState().closeEditor()
      useOverlayStore.getState().closeHtmlEditor()
      useOverlayStore.getState().closeLightbox()
    }
  }, [])

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return

      if (e.key === "c" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        copySelected()
      } else if (e.key === "v" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        pasteNodes()
      } else if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault()
        deleteSelected()
      } else if (e.key === "Escape") {
        useOverlayStore.getState().closePicker()
        useOverlayStore.getState().closeCtxMenu()
        useOverlayStore.getState().closeHtmlEditor()
      } else if (e.key === "g" && !e.metaKey && !e.ctrlKey) {
        const { selectedNodeIds } = useCanvasStore.getState()
        const isGroup = selectedNodeIds.length === 1 && nodes.find((n) => n.id === selectedNodeIds[0])?.type === "group"
        if (isGroup) ungroupSelected()
        else groupSelected()
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [copySelected, pasteNodes, deleteSelected, groupSelected, ungroupSelected, nodes])

  const handleConnect: OnConnect = useCallback((connection: Connection) => {
    if (!connection.source || !connection.target) return
    let targetHandle = connection.targetHandle
    const existing = edges.find((e) => e.target === connection.target && e.targetHandle === targetHandle)
    if (existing) {
      const expanded = resolveAutoInputExpansion(connection, nodes, edges)
      if (!expanded) return
      targetHandle = expanded.targetHandle
      if (expanded.data) updateNodeData(connection.target, expanded.data)
    }
    addEdge({
      id: `e-${connection.source}-${connection.sourceHandle}-${connection.target}-${targetHandle}`,
      source: connection.source,
      target: connection.target,
      sourceHandle: connection.sourceHandle,
      targetHandle,
    })
  }, [nodes, edges, addEdge, updateNodeData])

  const handleNodesChange = useCallback((changes: NodeChange[]) => {
    for (const c of changes) {
      if (c.type === "remove") removeNode(c.id)
    }
    onNodesChange(changes)
  }, [onNodesChange, removeNode])

  const handleEdgesChange = useCallback((changes: EdgeChange[]) => {
    onEdgesChange(changes)
  }, [onEdgesChange])

  // Double-click detection — stores screen coords
  const handlePaneClick = useCallback((event: React.MouseEvent) => {
    const overlay = useOverlayStore.getState()
    overlay.closeCtxMenu()
    if (overlay.pickerOpen) { overlay.closePicker(); return }
    const now = Date.now()
    const last = lastClickRef.current
    if (last && now - last.time < 350 && Math.abs(event.clientX - last.x) < 10 && Math.abs(event.clientY - last.y) < 10) {
      overlay.openPicker({ x: event.clientX, y: event.clientY })
      lastClickRef.current = null
    } else {
      lastClickRef.current = { time: now, x: event.clientX, y: event.clientY }
    }
  }, [])

  const handleNodeContextMenu = useCallback((event: React.MouseEvent, node: any) => {
    event.preventDefault()
    useOverlayStore.getState().openCtxMenu(event.clientX, event.clientY, node.id)
  }, [])

  const handlePaneContextMenu = useCallback((event: MouseEvent | React.MouseEvent) => {
    event.preventDefault()
    useOverlayStore.getState().openCtxMenu(event.clientX, event.clientY)
  }, [])

  const handleNodeClick = useCallback((event: React.MouseEvent, node: any) => {
    if (event.altKey) {
      event.preventDefault()
      duplicateNode(node.id)
    }
  }, [duplicateNode])

  // Alt/Option + drag to duplicate
  const dragStartRef = useRef<{ nodeId: string; origPos: { x: number; y: number } } | null>(null)

  const handleNodeDragStart = useCallback((event: React.MouseEvent, node: any) => {
    if (event.altKey) {
      dragStartRef.current = { nodeId: node.id, origPos: { ...node.position } }
    }
  }, [])

  const handleNodeDragStop = useCallback((_event: React.MouseEvent, node: any) => {
    if (dragStartRef.current && dragStartRef.current.nodeId === node.id) {
      const orig = dragStartRef.current.origPos
      onNodesChange([{ id: node.id, type: "position", position: orig }])
      duplicateNode(node.id)
      dragStartRef.current = null
    }
  }, [onNodesChange, duplicateNode])

  // Convert screen coords to flow coords when placing node
  const handleNodeSelect = useCallback((type: NodeType) => {
    const def = NODE_MAP[type]
    if (!def) return
    const id = crypto.randomUUID()
    const screenPos = useOverlayStore.getState().pickerScreenPos
    let pos: { x: number; y: number }
    if (screenPos) {
      const flowPos = screenToFlowPosition({ x: screenPos.x, y: screenPos.y })
      pos = { x: Math.round(flowPos.x / 20) * 20, y: Math.round(flowPos.y / 20) * 20 }
    } else {
      pos = { x: 200 + Math.random() * 300, y: 200 + Math.random() * 200 }
    }
    addNode({ id, type, position: pos, data: { nodeType: type, ...def.defaultData } })
  }, [addNode, screenToFlowPosition])

  const isValidConnection: IsValidConnection = useCallback((connection) => {
    if (connection.source === connection.target) return false
    const sourceType = getOutputPortType(connection.source, connection.sourceHandle, nodes)
    const targetType = getInputPortType(connection.target, connection.targetHandle, nodes)
    if (sourceType === null || targetType === null) return false
    if (sourceType !== targetType) return false
    if (!edges.some((e) => e.target === connection.target && e.targetHandle === connection.targetHandle)) return true
    return Boolean(resolveAutoInputExpansion(connection as Connection, nodes, edges))
  }, [nodes, edges])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const nodeTypesMap: Record<string, ComponentType<any>> = nodeTypes as any

  const selectedCount = useCanvasStore.getState().selectedNodeIds.length
  const isGroupNode = ctxMenu?.nodeId ? nodes.find((n) => n.id === ctxMenu.nodeId)?.type === "group" : false
  const ctxMenuItems = ctxMenu?.nodeId
    ? [
        { label: "复制", shortcut: "⌘C", action: () => { useCanvasStore.getState().setSelectedNodes([ctxMenu.nodeId!]); copySelected() } },
        ...(clipboard ? [{ label: "粘贴", shortcut: "⌘V", action: pasteNodes }] : []),
        ...(selectedCount >= 2 && !isGroupNode ? [{ label: "打组", shortcut: "G", action: () => { useCanvasStore.getState().setSelectedNodes([ctxMenu.nodeId!]); groupSelected() } }] : []),
        ...(isGroupNode ? [{ label: "取消打组", shortcut: "G", action: () => { useCanvasStore.getState().setSelectedNodes([ctxMenu.nodeId!]); ungroupSelected() } }] : []),
        { label: "删除", shortcut: "Del", action: () => { useCanvasStore.getState().setSelectedNodes([ctxMenu.nodeId!]); deleteSelected() } },
      ]
    : [
        { label: "撤销", shortcut: "⌘Z", action: () => { if (canUndo()) undo() } },
        { label: "导出 JSON", shortcut: "", action: () => {
          const json = JSON.stringify(getGraphJson(), null, 2)
          const blob = new Blob([json], { type: "application/json" })
          const url = URL.createObjectURL(blob)
          const a = document.createElement("a")
          a.href = url; a.download = "canvas.json"; a.click()
          URL.revokeObjectURL(url)
        }},
        { label: "清除画布", shortcut: "", action: () => { setGraphFromJson({ nodes: [], edges: [] }) } },
        ...(clipboard ? [{ label: "粘贴", shortcut: "⌘V", action: pasteNodes }] : []),
      ]

  return (
    <>
      {/* Canvas layer — clean, only ReactFlow */}
      <div style={{ width: "100%", height: "100%", position: "relative" }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypesMap}
          edgeTypes={edgeTypes}
          onConnect={handleConnect}
          onNodesChange={handleNodesChange}
          onEdgesChange={handleEdgesChange}
          onPaneClick={handlePaneClick}
          onNodeContextMenu={handleNodeContextMenu}
          onPaneContextMenu={handlePaneContextMenu}
          onNodeClick={handleNodeClick}
          onNodeDragStart={handleNodeDragStart}
          onNodeDragStop={handleNodeDragStop}
          isValidConnection={isValidConnection}
          selectionMode={SelectionMode.Partial}
          selectionOnDrag={true}
          panOnDrag={[1, 2]}
          snapToGrid={true}
          snapGrid={SNAP_GRID}
          minZoom={0.2}
          maxZoom={2}
          defaultViewport={{ x: 0, y: 0, zoom: 1 }}
          proOptions={{ hideAttribution: true }}
          style={{ background: "var(--bg-canvas)" }}
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#d4d4d4" />
        </ReactFlow>
      </div>

      {/* Overlay layer — all floating UI, one portal */}
      <OverlayLayer>
        <Toolbar onAddNode={() => useOverlayStore.getState().openPicker()} />
        <CanvasControls />
        <AgentPanel />
        <NodePicker
          open={pickerOpen}
          screenPos={pickerScreenPos}
          onSelect={handleNodeSelect}
          onClose={() => useOverlayStore.getState().closePicker()}
        />
        {ctxMenu && ctxMenuItems.length > 0 && (
          <ContextMenu
            x={ctxMenu.x}
            y={ctxMenu.y}
            items={ctxMenuItems}
            onClose={() => useOverlayStore.getState().closeCtxMenu()}
          />
        )}
        {editorNodeId && <ImageEditorModal nodeId={editorNodeId} onClose={() => useOverlayStore.getState().closeEditor()} />}
        {htmlEditorNodeId && <HtmlEditorModal />}
        {lightboxImage && <LightboxOverlay />}
      </OverlayLayer>
    </>
  )
}
