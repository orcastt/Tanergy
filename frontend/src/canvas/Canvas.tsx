import { useCallback, useRef, useEffect, type CSSProperties } from "react"
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  useReactFlow,
  useViewport,
  SelectionMode,
  type OnConnect,
  type Connection,
  type NodeChange,
  type EdgeChange,
  type IsValidConnection,
  type NodeMouseHandler,
  type NodeTypes,
  type OnNodeDrag,
  type Viewport,
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
import { getCrispViewport, isSameViewport } from "./viewportQuality"
import { getInputPortType, getOutputPortType, resolveAutoInputExpansion } from "./canvasConnectionRules"
import { buildCanvasContextMenuItems } from "./canvasContextMenu"
import { useCanvasKeyboardShortcuts } from "./useCanvasKeyboardShortcuts"
import { useLibraryDrop } from "./useLibraryDrop"

const edgeTypes = { default: DeletableEdge }

const SNAP_GRID = [20, 20] as [number, number]

export default function Canvas() {
  const {
    nodes, edges, addNode, addEdge, onNodesChange, onEdgesChange, removeNode,
    copySelected, pasteNodes, deleteSelected, duplicateNode, clipboard,
    groupSelected, ungroupSelected,
    undo, canUndo, getGraphJson, setGraphFromJson, updateNodeData,
    nodeStatuses,
  } = useCanvasStore()

  const { pickerOpen, pickerScreenPos, ctxMenu, editorNodeId, htmlEditorNodeId, lightboxImage } = useOverlayStore()
  const lastClickRef = useRef<{ time: number; x: number; y: number } | null>(null)
  const wasRunningRef = useRef(false)
  const { screenToFlowPosition, getViewport, setViewport } = useReactFlow()
  const viewport = useViewport()
  const alignedViewport = getCrispViewport(viewport)
  const useCrispZoom = viewport.zoom > 1.001
  const reactFlowStyle = {
    background: "var(--bg-canvas)",
    "--rf-crisp-translate-x": `${alignedViewport.x / alignedViewport.zoom}px`,
    "--rf-crisp-translate-y": `${alignedViewport.y / alignedViewport.zoom}px`,
    "--rf-crisp-zoom": alignedViewport.zoom,
  } as CSSProperties

  const snapViewport = useCallback((viewport?: Viewport) => {
    const currentViewport = viewport ?? getViewport()
    const crispViewport = getCrispViewport(currentViewport)
    if (!isSameViewport(currentViewport, crispViewport)) {
      void setViewport(crispViewport, { duration: 0 })
    }
  }, [getViewport, setViewport])

  // Clear overlays on unmount so they don't persist across navigations
  useEffect(() => {
    return () => {
      useOverlayStore.getState().closeEditor()
      useOverlayStore.getState().closeHtmlEditor()
      useOverlayStore.getState().closeLightbox()
    }
  }, [])

  useEffect(() => {
    requestAnimationFrame(() => snapViewport())
  }, [snapViewport])

  const hasRunningNodes = Object.values(nodeStatuses).some((status) => status === "running")

  useEffect(() => {
    if (hasRunningNodes && !wasRunningRef.current) {
      requestAnimationFrame(() => snapViewport())
    }
    wasRunningRef.current = hasRunningNodes
  }, [hasRunningNodes, snapViewport])

  useCanvasKeyboardShortcuts({ nodes, copySelected, pasteNodes, deleteSelected, groupSelected, ungroupSelected })

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

  const handleNodeContextMenu: NodeMouseHandler = useCallback((event, node) => {
    event.preventDefault()
    useOverlayStore.getState().openCtxMenu(event.clientX, event.clientY, node.id)
  }, [])

  const handlePaneContextMenu = useCallback((event: MouseEvent | React.MouseEvent) => {
    event.preventDefault()
    useOverlayStore.getState().openCtxMenu(event.clientX, event.clientY)
  }, [])

  const handleNodeClick: NodeMouseHandler = useCallback((event, node) => {
    if (event.altKey) {
      event.preventDefault()
      duplicateNode(node.id)
    }
  }, [duplicateNode])

  // Alt/Option + drag to duplicate
  const dragStartRef = useRef<{ nodeId: string; origPos: { x: number; y: number } } | null>(null)

  const handleNodeDragStart: OnNodeDrag = useCallback((event, node) => {
    if (event.altKey) {
      dragStartRef.current = { nodeId: node.id, origPos: { ...node.position } }
    }
  }, [])

  const handleNodeDragStop: OnNodeDrag = useCallback((_event, node) => {
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

  const { handleLibraryDrop, handleCanvasDragOver } = useLibraryDrop({ addNode, screenToFlowPosition })

  const isValidConnection: IsValidConnection = useCallback((connection) => {
    if (connection.source === connection.target) return false
    const sourceType = getOutputPortType(connection.source, connection.sourceHandle, nodes)
    const targetType = getInputPortType(connection.target, connection.targetHandle, nodes)
    if (sourceType === null || targetType === null) return false
    if (sourceType !== targetType) return false
    if (!edges.some((e) => e.target === connection.target && e.targetHandle === connection.targetHandle)) return true
    return Boolean(resolveAutoInputExpansion(connection as Connection, nodes, edges))
  }, [nodes, edges])

  const nodeTypesMap: NodeTypes = nodeTypes

  const selectedCount = useCanvasStore.getState().selectedNodeIds.length
  const ctxMenuItems = buildCanvasContextMenuItems({
    ctxNodeId: ctxMenu?.nodeId,
    nodes,
    clipboard,
    selectedCount,
    canUndo,
    undo,
    copySelected,
    pasteNodes,
    deleteSelected,
    groupSelected,
    ungroupSelected,
    setSelectedNodes: useCanvasStore.getState().setSelectedNodes,
    setGraphFromJson,
    getGraphJson,
  })

  return (
    <>
      {/* Canvas layer — clean, only ReactFlow */}
      <div style={{ width: "100%", height: "100%", position: "relative" }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          className={useCrispZoom ? "react-flow--crisp-zoom" : undefined}
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
          onDrop={handleLibraryDrop}
          onDragOver={handleCanvasDragOver}
          onMoveEnd={(_event, viewport) => snapViewport(viewport)}
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
          style={reactFlowStyle}
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
        {htmlEditorNodeId && <HtmlEditorModal key={htmlEditorNodeId} />}
        {lightboxImage && <LightboxOverlay />}
      </OverlayLayer>
    </>
  )
}
