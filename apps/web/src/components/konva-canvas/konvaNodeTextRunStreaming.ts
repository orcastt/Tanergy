import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
import type { CanvasDocument } from '@/features/canvas-engine'
import { streamAiChatCompletion } from '@/features/ai/chatClient'
import type { TangentWorkspace } from '@/features/auth/sessionTypes'
import { stopRuntimeGraphNodeRun } from '@/features/node-runtime/runtimeGraphRunAdapter'
import {
  appendKonvaAnalysisDelta,
  completeKonvaAnalysisRequest,
  failKonvaAnalysisRequest,
  prepareKonvaAnalysisRequest,
} from './konvaAnalysisStreaming'

type RunKonvaAnalysisStreamInput = {
  activeControllersRef: MutableRefObject<Map<string, AbortController>>
  document: CanvasDocument
  latestDocumentRef: MutableRefObject<CanvasDocument>
  normalizeRunError: (error: unknown, fallback: string) => string
  onDocumentChange: Dispatch<SetStateAction<CanvasDocument>>
  shapeId: string
  workspace?: TangentWorkspace
}

type ToggleKonvaAnalysisStreamInput = RunKonvaAnalysisStreamInput & {
  runtimeStatus: unknown
}

export function toggleKonvaAnalysisStream(input: ToggleKonvaAnalysisStreamInput) {
  if (input.runtimeStatus === 'running') {
    input.activeControllersRef.current.get(input.shapeId)?.abort()
    input.activeControllersRef.current.delete(input.shapeId)
    const stoppedDocument = stopRuntimeGraphNodeRun(input.document, input.shapeId)
    input.latestDocumentRef.current = stoppedDocument
    input.onDocumentChange(stoppedDocument)
    return
  }
  runKonvaAnalysisStream(input)
}

export function runKonvaAnalysisStream({
  activeControllersRef,
  document,
  latestDocumentRef,
  normalizeRunError,
  onDocumentChange,
  shapeId,
  workspace,
}: RunKonvaAnalysisStreamInput) {
  activeControllersRef.current.get(shapeId)?.abort()
  const controller = new AbortController()
  activeControllersRef.current.set(shapeId, controller)
  const prepared = prepareKonvaAnalysisRequest(document, shapeId)
  latestDocumentRef.current = prepared.document
  onDocumentChange(prepared.document)
  if (prepared.status !== 'started' || !prepared.localRequest) {
    activeControllersRef.current.delete(shapeId)
    return
  }

  void streamAiChatCompletion(prepared.localRequest, {
    maxOutputChars: 4000,
    onComplete: () => {
      const next = completeKonvaAnalysisRequest(latestDocumentRef.current, shapeId, prepared.runId)
      latestDocumentRef.current = next
      onDocumentChange(next)
      clearController(activeControllersRef, shapeId, controller)
    },
    onDelta: (delta) => {
      const next = appendKonvaAnalysisDelta(latestDocumentRef.current, shapeId, prepared.runId, delta)
      latestDocumentRef.current = next
      onDocumentChange(next)
    },
    signal: controller.signal,
    workspace,
  }).catch((error) => {
    if (controller.signal.aborted) return
    const message = normalizeRunError(error, 'Image analysis failed.')
    const next = failKonvaAnalysisRequest(latestDocumentRef.current, shapeId, prepared.runId, message)
    latestDocumentRef.current = next
    onDocumentChange(next)
    clearController(activeControllersRef, shapeId, controller)
  })
}

function clearController(
  activeControllersRef: MutableRefObject<Map<string, AbortController>>,
  shapeId: string,
  controller: AbortController,
) {
  if (activeControllersRef.current.get(shapeId) === controller) {
    activeControllersRef.current.delete(shapeId)
  }
}
