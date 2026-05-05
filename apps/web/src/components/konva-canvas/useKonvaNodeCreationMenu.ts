import { useCallback, useState, type Dispatch, type RefObject, type SetStateAction } from 'react'
import {
  screenToWorld,
  withCanvasShapes,
  type CanvasCamera,
  type CanvasDocument,
  type CanvasNodeShape,
  type CanvasPoint,
} from '@/features/canvas-engine'
import { canRunNodeType, getNodeDefinition } from '@/features/node-runtime/registry'
import {
  completeRuntimeGraphNodeRun,
  executeRuntimeGraphNodeRun,
  failRuntimeGraphNodeRun,
  startRuntimeGraphNodeRun,
  stopRuntimeGraphNodeRun,
} from '@/features/node-runtime/runtimeGraphRunAdapter'
import type { NodeType } from '@/types/nodeRuntime'
import { clearKonvaChatHistory, sendKonvaChatMessage, toggleKonvaChatMessageExport } from './konvaChatNodeActions'
import type { KonvaCanvasTool } from './konvaCanvasTypes'
import { createKonvaNodeCardShape } from './konvaNodeCardFactory'

type KonvaCanvasHistory = {
  checkpoint: (document?: CanvasDocument) => void
}

type UseKonvaNodeCreationMenuOptions = {
  camera: CanvasCamera
  document: CanvasDocument
  history: KonvaCanvasHistory
  lastPastePointRef: RefObject<CanvasPoint | null>
  size: { height: number; width: number }
  onDocumentChange: Dispatch<SetStateAction<CanvasDocument>>
  onEdgeSelectionChange: (edgeId: string | null) => void
  onSelectionChange: (shapeIds: string[]) => void
  onToolChange: (tool: KonvaCanvasTool) => void
}

export function useKonvaNodeCreationMenu({
  camera,
  document,
  history,
  lastPastePointRef,
  onDocumentChange,
  onEdgeSelectionChange,
  onSelectionChange,
  onToolChange,
  size,
}: UseKonvaNodeCreationMenuOptions) {
  const [nodeMenu, setNodeMenu] = useState<{ world: CanvasPoint; x: number; y: number } | null>(null)

  const createNodeCard = useCallback((type: NodeType, position?: CanvasPoint) => {
    const nodePosition = position ?? lastPastePointRef.current ?? screenToWorld({ x: size.width / 2, y: size.height / 2 }, camera)
    const shape = createKonvaNodeCardShape({ position: nodePosition, type })
    history.checkpoint()
    onDocumentChange((current) => withCanvasShapes(current, [...current.shapes, shape]))
    onSelectionChange([shape.id])
    onEdgeSelectionChange(null)
    onToolChange('select')
    setNodeMenu(null)
  }, [camera, history, lastPastePointRef, onDocumentChange, onEdgeSelectionChange, onSelectionChange, onToolChange, size.height, size.width])

  const setNodeField = useCallback((shapeId: string, fieldName: string, value: string | number) => {
    const node = document.shapes.find((shape): shape is CanvasNodeShape => shape.id === shapeId && shape.type === 'node_card')
    if (!node) return
    const field = getNodeDefinition(node.props.nodeType).cardFields.find((item) => item.name === fieldName)
    if (!field?.options?.some((option) => option.value === value)) return
    history.checkpoint(document)
    onDocumentChange((current) => withCanvasShapes(current, current.shapes.map((shape) => (
      shape.id === shapeId && shape.type === 'node_card'
        ? { ...shape, props: { ...shape.props, data: { ...shape.props.data, [fieldName]: value } } }
        : shape
    ))))
  }, [document, history, onDocumentChange])

  const setNodeTextField = useCallback((shapeId: string, fieldName: string, value: string) => {
    const node = document.shapes.find((shape): shape is CanvasNodeShape => shape.id === shapeId && shape.type === 'node_card')
    if (!node) return
    const field = getNodeDefinition(node.props.nodeType).cardFields.find((item) => item.name === fieldName)
    if (field?.type !== 'text' && field?.type !== 'textarea') return
    const nextValue = value.slice(0, 4000)
    if (node.props.data[fieldName] === nextValue) return
    history.checkpoint(document)
    onDocumentChange((current) => withCanvasShapes(current, current.shapes.map((shape) => (
      shape.id === shapeId && shape.type === 'node_card'
        ? { ...shape, props: { ...shape.props, data: { ...shape.props.data, [fieldName]: nextValue } } }
        : shape
    ))))
  }, [document, history, onDocumentChange])

  const toggleNodeRun = useCallback((shapeId: string) => {
    const node = document.shapes.find((shape): shape is CanvasNodeShape => shape.id === shapeId && shape.type === 'node_card')
    if (!node || !canRunNode(node)) return
    history.checkpoint(document)
    if (node.props.runtimeSummary.status === 'running') {
      onDocumentChange((current) => stopRuntimeGraphNodeRun(current, shapeId))
      return
    }

    const runInput = startRuntimeGraphNodeRun(document, shapeId)
    onDocumentChange(runInput.document)
    if (runInput.status !== 'started') return
    void executeRuntimeGraphNodeRun(runInput)
      .then((completion) => onDocumentChange((current) => completeRuntimeGraphNodeRun(current, completion)))
      .catch((error) => onDocumentChange((current) => failRuntimeGraphNodeRun(current, runInput, error)))
  }, [document, history, onDocumentChange])

  const sendChatMessage = useCallback((shapeId: string, draftOverride?: string) => {
    const node = document.shapes.find((shape): shape is CanvasNodeShape => shape.id === shapeId && shape.type === 'node_card' && shape.props.nodeType === 'chat')
    if (!node) return
    history.checkpoint(document)
    onDocumentChange((current) => sendKonvaChatMessage(current, shapeId, draftOverride))
  }, [document, history, onDocumentChange])

  const toggleChatMessageExport = useCallback((shapeId: string, messageId: string) => {
    const node = document.shapes.find((shape): shape is CanvasNodeShape => shape.id === shapeId && shape.type === 'node_card' && shape.props.nodeType === 'chat')
    if (!node) return
    history.checkpoint(document)
    onDocumentChange((current) => toggleKonvaChatMessageExport(current, shapeId, messageId))
  }, [document, history, onDocumentChange])

  const cleanChatHistory = useCallback((shapeId: string) => {
    const node = document.shapes.find((shape): shape is CanvasNodeShape => shape.id === shapeId && shape.type === 'node_card' && shape.props.nodeType === 'chat')
    if (!node) return
    history.checkpoint(document)
    onDocumentChange((current) => clearKonvaChatHistory(current, shapeId))
  }, [document, history, onDocumentChange])

  const openNodeMenu = useCallback((screenPoint: CanvasPoint, worldPoint: CanvasPoint) => {
    onToolChange('select')
    setNodeMenu({ world: worldPoint, x: screenPoint.x, y: screenPoint.y - 12 })
  }, [onToolChange])

  return {
    closeNodeMenu: () => setNodeMenu(null),
    cleanChatHistory,
    createNodeCard,
    nodeMenu,
    openNodeMenu,
    sendChatMessage,
    setNodeField,
    setNodeTextField,
    toggleChatMessageExport,
    toggleNodeRun,
  }
}

function canRunNode(node: CanvasNodeShape) {
  return canRunNodeType(node.props.nodeType)
}
