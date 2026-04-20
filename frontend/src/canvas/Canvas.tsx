import { useCallback, useState, useRef, type ComponentType } from "react"
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  useReactFlow,
  type OnConnect,
  type Connection,
  type NodeChange,
  type EdgeChange,
  type IsValidConnection,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"

import { useCanvasStore } from "../store/canvasStore"
import { nodeTypes } from "../nodes/index"
import { NODE_MAP } from "../nodes/nodeDefs"
import NodePicker from "./NodePicker"
import Toolbar from "./Toolbar"
import CanvasControls from "./CanvasControls"
import type { NodeType } from "../types/node"

const SNAP_GRID = [20, 20] as [number, number]

function getOutputPortType(nodeId: string, handleId: string | null | undefined, nodes: any[]) {
  const node = nodes.find((n) => n.id === nodeId)
  if (!node) return null
  const def = NODE_MAP[node.data.nodeType as NodeType]
  if (!def) return null
  if (!handleId) return def.outputs[0]?.type ?? null
  return def.outputs.find((o) => o.id === handleId)?.type ?? null
}

function getInputPortType(nodeId: string, handleId: string | null | undefined, nodes: any[]) {
  const node = nodes.find((n) => n.id === nodeId)
  if (!node) return null
  const def = NODE_MAP[node.data.nodeType as NodeType]
  if (!def) return null
  if (!handleId) return def.inputs[0]?.type ?? null
  return def.inputs.find((i) => i.id === handleId)?.type ?? null
}

export default function Canvas() {
  const { nodes, edges, addNode, addEdge, onNodesChange, onEdgesChange, removeNode } = useCanvasStore()
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerPos, setPickerPos] = useState<{ x: number; y: number } | null>(null)
  const lastClickRef = useRef<{ time: number; x: number; y: number } | null>(null)
  const { screenToFlowPosition } = useReactFlow()

  const handleConnect: OnConnect = useCallback((connection: Connection) => {
    if (!connection.source || !connection.target) return
    const existing = edges.find((e) => e.target === connection.target && e.targetHandle === connection.targetHandle)
    if (existing) return
    addEdge({
      id: `e-${connection.source}-${connection.sourceHandle}-${connection.target}-${connection.targetHandle}`,
      source: connection.source,
      target: connection.target,
      sourceHandle: connection.sourceHandle,
      targetHandle: connection.targetHandle,
    })
  }, [edges, addEdge])

  const handleNodesChange = useCallback((changes: NodeChange[]) => {
    for (const c of changes) {
      if (c.type === "remove") removeNode(c.id)
    }
    onNodesChange(changes)
  }, [onNodesChange, removeNode])

  const handleEdgesChange = useCallback((changes: EdgeChange[]) => {
    onEdgesChange(changes)
  }, [onEdgesChange])

  // Double-click detection via onPaneClick
  const handlePaneClick = useCallback((event: React.MouseEvent) => {
    const now = Date.now()
    const last = lastClickRef.current
    if (last && now - last.time < 350 && Math.abs(event.clientX - last.x) < 10 && Math.abs(event.clientY - last.y) < 10) {
      // Double click detected
      const flowPos = screenToFlowPosition({ x: event.clientX, y: event.clientY })
      setPickerPos({ x: flowPos.x, y: flowPos.y })
      setPickerOpen(true)
      lastClickRef.current = null
    } else {
      lastClickRef.current = { time: now, x: event.clientX, y: event.clientY }
    }
  }, [screenToFlowPosition])

  const handleNodeSelect = useCallback((type: NodeType, position?: { x: number; y: number }) => {
    const def = NODE_MAP[type]
    if (!def) return
    const id = crypto.randomUUID()
    const pos = position
      ? { x: Math.round(position.x / 20) * 20, y: Math.round(position.y / 20) * 20 }
      : { x: 200 + Math.random() * 300, y: 200 + Math.random() * 200 }
    addNode({ id, type, position: pos, data: { nodeType: type, ...def.defaultData } })
  }, [addNode])

  const isValidConnection: IsValidConnection = useCallback((connection) => {
    if (connection.source === connection.target) return false
    // Port type compatibility check
    const sourceType = getOutputPortType(connection.source, connection.sourceHandle, nodes)
    const targetType = getInputPortType(connection.target, connection.targetHandle, nodes)
    if (sourceType === null || targetType === null) return false
    if (sourceType !== targetType) return false
    // Each input port accepts only one connection
    return !edges.some((e) => e.target === connection.target && e.targetHandle === connection.targetHandle)
  }, [nodes, edges])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
const nodeTypesMap: Record<string, ComponentType<any>> = nodeTypes as any

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypesMap}
        onConnect={handleConnect}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onPaneClick={handlePaneClick}
        isValidConnection={isValidConnection}
        snapToGrid={true}
        snapGrid={SNAP_GRID}
        minZoom={0.2}
        maxZoom={2}
        deleteKeyCode="Delete"
        fitView
        proOptions={{ hideAttribution: true }}
        style={{ background: "#f5f3f3" }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#d4d4d4" />
      </ReactFlow>

      <Toolbar onAddNode={() => { setPickerPos(null); setPickerOpen(true) }} />
      <CanvasControls />

      <NodePicker
        open={pickerOpen}
        position={pickerPos}
        onSelect={handleNodeSelect}
        onClose={() => setPickerOpen(false)}
      />
    </div>
  )
}
