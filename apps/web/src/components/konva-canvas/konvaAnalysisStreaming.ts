import { withCanvasShapes, type CanvasDocument, type CanvasNodeShape } from '@/features/canvas-engine'
import type { AiChatCompletionRequest, AiChatMessageContentPart } from '@/features/ai/aiTypes'
import { defaultAnalysisPrompt } from '@/features/ai/aiNodePrompts'
import { getAnalysisModelSelectOptions, getDefaultAnalysisModelId } from '@/features/ai/mockAiContracts'
import { resolveRuntimeGraphNodeInputs, type RuntimeGraphImageValue } from '@/features/node-runtime/runtimeGraphResolution'

type PreparedAnalysisRequest = {
  document: CanvasDocument
  localRequest?: AiChatCompletionRequest
  runId: string
  shapeId: string
  status: 'failed' | 'started'
}

export function prepareKonvaAnalysisRequest(
  document: CanvasDocument,
  shapeId: string,
): PreparedAnalysisRequest {
  const node = getAnalysisNode(document, shapeId)
  const runId = createAnalysisRunId()
  if (!node) return { document, runId, shapeId, status: 'failed' }

  const inputResolution = resolveRuntimeGraphNodeInputs(document, node)
  if (!inputResolution.canRun || inputResolution.imageValues.length === 0) {
    return {
      document: updateAnalysisNode(document, shapeId, runId, (shape) => ({
        ...shape,
        props: {
          ...shape.props,
          runtimeSummary: {
            ...shape.props.runtimeSummary,
            costHint: null,
            error: inputResolution.missingReasons[0] ?? 'Missing analysis image input.',
            lastRunId: runId,
            resultAssetIds: [],
            serverRunId: null,
            status: 'failed',
            textOutput: '',
          },
        },
      }), false),
      runId,
      shapeId,
      status: 'failed',
    }
  }

  const prompt = getAnalysisPrompt(node)
  const modelId = getAnalysisModelId(node)
  const imageParts = inputResolution.imageValues
    .map(createImagePart)
    .filter((part): part is AiChatMessageContentPart => part !== null)

  return {
    document: updateAnalysisNode(document, shapeId, runId, (shape) => ({
      ...shape,
      props: {
        ...shape.props,
        runtimeSummary: {
          ...shape.props.runtimeSummary,
          costHint: `Streaming analysis via ${modelId}`,
          error: null,
          lastRunId: runId,
          resultAssetIds: [],
          serverRunId: null,
          status: 'running',
          textOutput: '',
        },
      },
    }), false),
    localRequest: {
      messages: [
        {
          content: 'You analyze canvas image references and return concise plain text only.',
          role: 'system',
        },
        {
          content: [{ text: prompt, type: 'text' }, ...imageParts],
          role: 'user',
        },
      ],
      max_completion_tokens: 900,
      model: modelId,
      stream: true,
    },
    runId,
    shapeId,
    status: 'started',
  }
}

export function appendKonvaAnalysisDelta(
  document: CanvasDocument,
  shapeId: string,
  runId: string,
  delta: string,
) {
  if (!delta) return document
  return updateAnalysisNode(document, shapeId, runId, (shape) => {
    const textOutput = `${getString(shape.props.runtimeSummary.textOutput)}${delta}`.slice(0, 4000)
    return {
      ...shape,
      props: {
        ...shape.props,
        runtimeSummary: {
          ...shape.props.runtimeSummary,
          textOutput,
        },
      },
    }
  })
}

export function completeKonvaAnalysisRequest(document: CanvasDocument, shapeId: string, runId: string) {
  return updateAnalysisNode(document, shapeId, runId, (shape) => ({
    ...shape,
    props: {
      ...shape.props,
      runtimeSummary: {
        ...shape.props.runtimeSummary,
        costHint: 'Analysis complete.',
        error: null,
        serverRunId: null,
        status: 'succeeded',
      },
    },
  }))
}

export function failKonvaAnalysisRequest(
  document: CanvasDocument,
  shapeId: string,
  runId: string,
  errorMessage: string,
) {
  return updateAnalysisNode(document, shapeId, runId, (shape) => ({
    ...shape,
    props: {
      ...shape.props,
      runtimeSummary: {
        ...shape.props.runtimeSummary,
        costHint: 'Analysis failed.',
        error: errorMessage,
        serverRunId: null,
        status: 'failed',
      },
    },
  }))
}

function updateAnalysisNode(
  document: CanvasDocument,
  shapeId: string,
  runId: string,
  updater: (shape: CanvasNodeShape) => CanvasNodeShape,
  requireRunMatch = true,
) {
  return withCanvasShapes(document, document.shapes.map((shape) => {
    if (shape.id !== shapeId || !isAnalysisNodeShape(shape)) return shape
    if (requireRunMatch && shape.props.runtimeSummary.lastRunId !== runId) return shape
    return updater(shape)
  }))
}

function getAnalysisNode(document: CanvasDocument, shapeId: string) {
  return document.shapes.find((shape): shape is CanvasNodeShape => (
    shape.id === shapeId && isAnalysisNodeShape(shape)
  )) ?? null
}

function isAnalysisNodeShape(shape: CanvasDocument['shapes'][number]): shape is CanvasNodeShape {
  return shape.type === 'node_card' && shape.props.nodeType === 'analysis'
}

function getAnalysisPrompt(node: CanvasNodeShape) {
  const prompt = getString(node.props.data.analysisPrompt).trim()
  return prompt || defaultAnalysisPrompt
}

function getAnalysisModelId(node: CanvasNodeShape) {
  const allowed = new Set(
    getAnalysisModelSelectOptions()
      .filter((option) => !option.disabled)
      .map((option) => String(option.value)),
  )
  const value = getString(node.props.data.modelId).trim()
  return allowed.has(value) ? value : getDefaultAnalysisModelId()
}

function createImagePart(image: RuntimeGraphImageValue): AiChatMessageContentPart | null {
  const url = image.originalUrl ?? image.thumbnail1024Url ?? image.thumbnail512Url ?? image.thumbnail256Url ?? ''
  return url ? { image_url: { url }, type: 'image_url' } : null
}

function getString(value: unknown) {
  return typeof value === 'string' ? value : ''
}

function createAnalysisRunId() {
  if (typeof globalThis.crypto?.randomUUID === 'function') return `analysis_run_${globalThis.crypto.randomUUID()}`
  return `analysis_run_${Date.now()}_${Math.random().toString(36).slice(2)}`
}
