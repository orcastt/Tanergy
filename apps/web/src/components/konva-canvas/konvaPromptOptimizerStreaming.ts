import { withCanvasShapes, type CanvasDocument, type CanvasNodeShape } from '@/features/canvas-engine'
import type { AiChatCompletionRequest, AiRunRequest } from '@/features/ai/aiTypes'
import { createPromptOptimizerUserPrompt, promptOptimizerSystemPrompt } from '@/features/ai/aiNodePrompts'
import { getDefaultPromptOptimizerModelId, getPromptOptimizerModelSelectOptions } from '@/features/ai/mockAiContracts'
import { resolveRuntimeGraphNodeInputs } from '@/features/node-runtime/runtimeGraphResolution'

type PreparedPromptOptimizerRequest = {
  document: CanvasDocument
  localRequest?: AiChatCompletionRequest
  remoteRequest?: AiRunRequest
  runId: string
  shapeId: string
  status: 'failed' | 'started'
}

export function prepareKonvaPromptOptimizerRequest(
  document: CanvasDocument,
  shapeId: string,
  boardId?: string | null,
): PreparedPromptOptimizerRequest {
  const node = getPromptOptimizerNode(document, shapeId)
  const runId = createPromptOptimizerRunId()
  if (!node) return { document, runId, shapeId, status: 'failed' }

  const inputResolution = resolveRuntimeGraphNodeInputs(document, node)
  if (!inputResolution.canRun) {
    return {
      document: updatePromptOptimizerNode(document, shapeId, runId, (shape) => ({
        ...shape,
        props: {
          ...shape.props,
          runtimeSummary: {
            ...shape.props.runtimeSummary,
            costHint: null,
            error: inputResolution.missingReasons[0] ?? 'Missing prompt input.',
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

  const modelId = getPromptOptimizerModelId(node)
  const sourcePrompt = inputResolution.textValues.join('\n\n').trim()
  const localRequest = {
    messages: [
      { content: promptOptimizerSystemPrompt, role: 'system' },
      {
        content: createPromptOptimizerUserPrompt(sourcePrompt),
        role: 'user',
      },
    ],
    max_completion_tokens: 600,
    model: modelId,
    stream: true,
  } satisfies AiChatCompletionRequest
  const remoteRequest = {
    boardId: boardId ?? null,
    inputAssetIds: [],
    nodeId: node.props.nodeId,
    nodeType: node.props.nodeType,
    params: {
      maxCompletionTokens: 600,
      systemPrompt: promptOptimizerSystemPrompt,
    },
    prompt: sourcePrompt,
    runType: 'text',
    selectedModelId: modelId,
    systemPrompt: promptOptimizerSystemPrompt,
  } satisfies AiRunRequest

  return {
    document: updatePromptOptimizerNode(document, shapeId, runId, (shape) => ({
      ...shape,
      props: {
        ...shape.props,
        data: {
          ...shape.props.data,
          optimizedPrompt: '',
        },
        runtimeSummary: {
          ...shape.props.runtimeSummary,
          costHint: `Optimizing via ${modelId}`,
          error: null,
          lastRunId: runId,
          resultAssetIds: [],
          serverRunId: null,
          status: 'running',
          textOutput: '',
        },
      },
    }), false),
    localRequest,
    remoteRequest,
    runId,
    shapeId,
    status: 'started',
  }
}

export function appendKonvaPromptOptimizerDelta(
  document: CanvasDocument,
  shapeId: string,
  runId: string,
  delta: string
) {
  if (!delta) return document
  return updatePromptOptimizerNode(document, shapeId, runId, (shape) => {
    const nextText = `${getString(shape.props.data.optimizedPrompt) ?? getString(shape.props.runtimeSummary.textOutput) ?? ''}${delta}`.slice(0, 4000)
    return {
      ...shape,
      props: {
        ...shape.props,
        data: {
          ...shape.props.data,
          optimizedPrompt: nextText,
        },
        runtimeSummary: {
          ...shape.props.runtimeSummary,
          textOutput: nextText,
        },
      },
    }
  })
}

export function completeKonvaPromptOptimizerRequest(document: CanvasDocument, shapeId: string, runId: string) {
  return updatePromptOptimizerNode(document, shapeId, runId, (shape) => {
    const optimizedPrompt = getString(shape.props.data.optimizedPrompt) ?? getString(shape.props.runtimeSummary.textOutput) ?? ''
    return {
      ...shape,
      props: {
        ...shape.props,
        data: {
          ...shape.props.data,
          optimizedPrompt: optimizedPrompt.slice(0, 4000),
        },
        runtimeSummary: {
          ...shape.props.runtimeSummary,
          costHint: 'Prompt optimized.',
          error: null,
          serverRunId: null,
          status: 'succeeded',
          textOutput: optimizedPrompt.slice(0, 4000),
        },
      },
    }
  })
}

export function syncKonvaPromptOptimizerAcceptedRun(
  document: CanvasDocument,
  shapeId: string,
  runId: string,
  serverRunId: string
) {
  return updatePromptOptimizerNode(document, shapeId, runId, (shape) => ({
    ...shape,
    props: {
      ...shape.props,
      runtimeSummary: {
        ...shape.props.runtimeSummary,
        serverRunId,
      },
    },
  }))
}

export function setKonvaPromptOptimizerResult(
  document: CanvasDocument,
  shapeId: string,
  runId: string,
  textOutput: string | null | undefined
) {
  const nextText = (textOutput ?? '').slice(0, 4000)
  return updatePromptOptimizerNode(document, shapeId, runId, (shape) => ({
    ...shape,
    props: {
      ...shape.props,
      data: {
        ...shape.props.data,
        optimizedPrompt: nextText,
      },
      runtimeSummary: {
        ...shape.props.runtimeSummary,
        textOutput: nextText,
      },
    },
  }))
}

export function failKonvaPromptOptimizerRequest(
  document: CanvasDocument,
  shapeId: string,
  runId: string,
  errorMessage: string
) {
  return updatePromptOptimizerNode(document, shapeId, runId, (shape) => ({
    ...shape,
    props: {
      ...shape.props,
      runtimeSummary: {
        ...shape.props.runtimeSummary,
        costHint: 'Prompt optimization failed.',
        error: errorMessage,
        serverRunId: null,
        status: 'failed',
      },
    },
  }))
}

function updatePromptOptimizerNode(
  document: CanvasDocument,
  shapeId: string,
  runId: string,
  updater: (shape: CanvasNodeShape) => CanvasNodeShape,
  requireRunMatch = true
) {
  return withCanvasShapes(document, document.shapes.map((shape) => {
    if (shape.id !== shapeId || !isPromptOptimizerNodeShape(shape)) return shape
    if (requireRunMatch && shape.props.runtimeSummary.lastRunId !== runId) return shape
    return updater(shape)
  }))
}

function getPromptOptimizerNode(document: CanvasDocument, shapeId: string) {
  return document.shapes.find((shape): shape is CanvasNodeShape => (
    shape.id === shapeId && isPromptOptimizerNodeShape(shape)
  )) ?? null
}

function isPromptOptimizerNodeShape(shape: CanvasDocument['shapes'][number]): shape is CanvasNodeShape {
  return shape.type === 'node_card' && shape.props.nodeType === 'prompt_optimizer'
}

function getString(value: unknown) {
  return typeof value === 'string' ? value : undefined
}

function createPromptOptimizerRunId() {
  if (typeof globalThis.crypto?.randomUUID === 'function') return `prompt_optimizer_run_${globalThis.crypto.randomUUID()}`
  return `prompt_optimizer_run_${Date.now()}_${Math.random().toString(36).slice(2)}`
}

function getPromptOptimizerModelId(node: CanvasNodeShape) {
  const allowed = new Set(
    getPromptOptimizerModelSelectOptions()
      .filter((option) => !option.disabled)
      .map((option) => String(option.value))
  )
  const value = typeof node.props.data.modelId === 'string' ? node.props.data.modelId.trim() : ''
  return allowed.has(value) ? value : getDefaultPromptOptimizerModelId()
}
