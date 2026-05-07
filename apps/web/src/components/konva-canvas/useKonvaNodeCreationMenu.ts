import { useCallback, useEffect, useRef, useState, type Dispatch, type RefObject, type SetStateAction } from 'react'
import {
  screenToWorld,
  withCanvasShapes,
  type CanvasCamera,
  type CanvasDocument,
  type CanvasNodeShape,
  type CanvasPoint,
} from '@/features/canvas-engine'
import { cancelAiRun } from '@/features/ai/aiClient'
import { streamAiChatCompletion } from '@/features/ai/chatClient'
import type { TangentWorkspace } from '@/features/auth/sessionTypes'
import { canRunNodeType, getNodeCardFields, getNodeDefinition } from '@/features/node-runtime/registry'
import {
  completeRuntimeGraphNodeRun,
  executeRuntimeGraphNodeRun,
  failRuntimeGraphNodeRun,
  startRuntimeGraphNodeRun,
  stopRuntimeGraphNodeRun,
  syncRuntimeGraphAcceptedRun,
} from '@/features/node-runtime/runtimeGraphRunAdapter'
import type { NodeType } from '@/types/nodeRuntime'
import { clearKonvaChatHistory, toggleKonvaChatMessageExport } from './konvaChatNodeActions'
import {
  appendKonvaChatAssistantDelta,
  completeKonvaChatRequest,
  failKonvaChatRequest,
  prepareKonvaChatRequest,
  setKonvaChatModelId,
} from './konvaChatNodeStreaming'
import {
  appendKonvaPromptOptimizerDelta,
  completeKonvaPromptOptimizerRequest,
  failKonvaPromptOptimizerRequest,
  prepareKonvaPromptOptimizerRequest,
} from './konvaPromptOptimizerStreaming'
import type { KonvaCanvasTool } from './konvaCanvasTypes'
import { createKonvaNodeCardShape } from './konvaNodeCardFactory'

type KonvaCanvasHistory = {
  checkpoint: (document?: CanvasDocument) => void
}

type UseKonvaNodeCreationMenuOptions = {
  boardId?: string
  camera: CanvasCamera
  document: CanvasDocument
  history: KonvaCanvasHistory
  lastPastePointRef: RefObject<CanvasPoint | null>
  size: { height: number; width: number }
  onDocumentChange: Dispatch<SetStateAction<CanvasDocument>>
  onEdgeSelectionChange: (edgeId: string | null) => void
  onSelectionChange: (shapeIds: string[]) => void
  onToolChange: (tool: KonvaCanvasTool) => void
  workspace?: TangentWorkspace
}

export function useKonvaNodeCreationMenu({
  boardId,
  camera,
  document,
  history,
  lastPastePointRef,
  onDocumentChange,
  onEdgeSelectionChange,
  onSelectionChange,
  onToolChange,
  size,
  workspace,
}: UseKonvaNodeCreationMenuOptions) {
  const [nodeMenu, setNodeMenu] = useState<{ world: CanvasPoint; x: number; y: number } | null>(null)
  const latestDocumentRef = useRef(document)
  const activeChatControllersRef = useRef(new Map<string, AbortController>())

  useEffect(() => {
    latestDocumentRef.current = document
  }, [document])

  useEffect(() => () => {
    activeChatControllersRef.current.forEach((controller) => controller.abort())
    activeChatControllersRef.current.clear()
  }, [])

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
    const field = getNodeCardFields(node.props.nodeType, node.props.data).find((item) => item.name === fieldName)
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

    if (node.props.nodeType === 'prompt_optimizer') {
      if (node.props.runtimeSummary.status === 'running') {
        activeChatControllersRef.current.get(shapeId)?.abort()
        activeChatControllersRef.current.delete(shapeId)
        const stoppedDocument = stopRuntimeGraphNodeRun(document, shapeId)
        latestDocumentRef.current = stoppedDocument
        onDocumentChange(stoppedDocument)
        return
      }

      activeChatControllersRef.current.get(shapeId)?.abort()
      const controller = new AbortController()
      activeChatControllersRef.current.set(shapeId, controller)
      const prepared = prepareKonvaPromptOptimizerRequest(document, shapeId)
      latestDocumentRef.current = prepared.document
      onDocumentChange(prepared.document)
      if (prepared.status !== 'started' || !prepared.request) {
        activeChatControllersRef.current.delete(shapeId)
        return
      }

      void streamAiChatCompletion(prepared.request, {
        onComplete: () => {
          const next = completeKonvaPromptOptimizerRequest(latestDocumentRef.current, shapeId, prepared.runId)
          latestDocumentRef.current = next
          onDocumentChange(next)
          if (activeChatControllersRef.current.get(shapeId) === controller) {
            activeChatControllersRef.current.delete(shapeId)
          }
        },
        onDelta: (delta) => {
          const next = appendKonvaPromptOptimizerDelta(latestDocumentRef.current, shapeId, prepared.runId, delta)
          latestDocumentRef.current = next
          onDocumentChange(next)
        },
        signal: controller.signal,
      }).catch((error) => {
        if (controller.signal.aborted) return
        const message = error instanceof Error ? error.message : 'Prompt optimization failed.'
        const next = failKonvaPromptOptimizerRequest(latestDocumentRef.current, shapeId, prepared.runId, message)
        latestDocumentRef.current = next
        onDocumentChange(next)
        if (activeChatControllersRef.current.get(shapeId) === controller) {
          activeChatControllersRef.current.delete(shapeId)
        }
      })
      return
    }

    if (node.props.runtimeSummary.status === 'running') {
      const serverRunId = typeof node.props.runtimeSummary.serverRunId === 'string' && node.props.runtimeSummary.serverRunId.trim()
        ? node.props.runtimeSummary.serverRunId
        : null
      const stoppedDocument = stopRuntimeGraphNodeRun(document, shapeId)
      latestDocumentRef.current = stoppedDocument
      onDocumentChange(stoppedDocument)
      if (serverRunId) {
        void cancelAiRun(serverRunId, { workspace }).catch(() => {})
      }
      return
    }

    const runInput = startRuntimeGraphNodeRun(document, shapeId, boardId)
    latestDocumentRef.current = runInput.document
    onDocumentChange(runInput.document)
    if (runInput.status !== 'started') return
    void executeRuntimeGraphNodeRun(runInput, {
      onServerRunAccepted: (run) => {
        const next = syncRuntimeGraphAcceptedRun(latestDocumentRef.current, runInput, run)
        latestDocumentRef.current = next.document
        onDocumentChange(next.document)
        if (!next.accepted && (run.status === 'queued' || run.status === 'running')) {
          void cancelAiRun(run.runId, { workspace }).catch(() => {})
        }
      },
      workspace,
    })
      .then((completion) => onDocumentChange((current) => completeRuntimeGraphNodeRun(current, completion)))
      .catch((error) => onDocumentChange((current) => failRuntimeGraphNodeRun(current, runInput, error)))
  }, [boardId, document, history, onDocumentChange, workspace])

  const sendChatMessage = useCallback((shapeId: string, draftOverride?: string) => {
    const snapshot = latestDocumentRef.current
    const node = snapshot.shapes.find((shape): shape is CanvasNodeShape => shape.id === shapeId && shape.type === 'node_card' && shape.props.nodeType === 'chat')
    if (!node) return
    history.checkpoint(snapshot)

    activeChatControllersRef.current.get(shapeId)?.abort()
    const controller = new AbortController()
    activeChatControllersRef.current.set(shapeId, controller)

    const prepared = prepareKonvaChatRequest(snapshot, shapeId, draftOverride)
    if (!prepared) {
      activeChatControllersRef.current.delete(shapeId)
      return
    }
    latestDocumentRef.current = prepared.document
    onDocumentChange(prepared.document)

    void streamAiChatCompletion(prepared.request, {
      onComplete: () => {
        const next = completeKonvaChatRequest(latestDocumentRef.current, shapeId, prepared.runId)
        latestDocumentRef.current = next
        onDocumentChange(next)
        if (activeChatControllersRef.current.get(shapeId) === controller) {
          activeChatControllersRef.current.delete(shapeId)
        }
      },
      onDelta: (delta) => {
        const next = appendKonvaChatAssistantDelta(
          latestDocumentRef.current,
          shapeId,
          prepared.runId,
          prepared.assistantMessageId,
          delta
        )
        latestDocumentRef.current = next
        onDocumentChange(next)
      },
      signal: controller.signal,
    }).catch((error) => {
      if (controller.signal.aborted) return
      const message = error instanceof Error ? error.message : 'Chat request failed.'
      const next = failKonvaChatRequest(
        latestDocumentRef.current,
        shapeId,
        prepared.runId,
        prepared.assistantMessageId,
        message
      )
      latestDocumentRef.current = next
      onDocumentChange(next)
      if (activeChatControllersRef.current.get(shapeId) === controller) {
        activeChatControllersRef.current.delete(shapeId)
      }
    })
  }, [history, onDocumentChange])

  const setChatModel = useCallback((shapeId: string, modelId: string) => {
    const snapshot = latestDocumentRef.current
    const node = snapshot.shapes.find((shape): shape is CanvasNodeShape => shape.id === shapeId && shape.type === 'node_card' && shape.props.nodeType === 'chat')
    if (!node || node.props.data.modelId === modelId) return
    history.checkpoint(snapshot)
    onDocumentChange((current) => setKonvaChatModelId(current, shapeId, modelId))
  }, [history, onDocumentChange])

  const toggleChatMessageExport = useCallback((shapeId: string, messageId: string) => {
    const node = document.shapes.find((shape): shape is CanvasNodeShape => shape.id === shapeId && shape.type === 'node_card' && shape.props.nodeType === 'chat')
    if (!node) return
    history.checkpoint(document)
    onDocumentChange((current) => toggleKonvaChatMessageExport(current, shapeId, messageId))
  }, [document, history, onDocumentChange])

  const cleanChatHistory = useCallback((shapeId: string) => {
    const node = document.shapes.find((shape): shape is CanvasNodeShape => shape.id === shapeId && shape.type === 'node_card' && shape.props.nodeType === 'chat')
    if (!node) return
    activeChatControllersRef.current.get(shapeId)?.abort()
    activeChatControllersRef.current.delete(shapeId)
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
    setChatModel,
    setNodeField,
    setNodeTextField,
    toggleChatMessageExport,
    toggleNodeRun,
  }
}

function canRunNode(node: CanvasNodeShape) {
  return canRunNodeType(node.props.nodeType)
}
