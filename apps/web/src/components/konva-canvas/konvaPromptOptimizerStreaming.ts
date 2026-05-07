import { withCanvasShapes, type CanvasDocument, type CanvasNodeShape } from '@/features/canvas-engine'
import type { AiChatCompletionRequest } from '@/features/ai/aiTypes'
import { getDefaultChatModelId } from '@/features/ai/mockAiContracts'
import { resolveRuntimeGraphNodeInputs } from '@/features/node-runtime/runtimeGraphResolution'

const promptOptimizerSystemPrompt = [
  'You are a prompt optimizer for AI image generation.',
  'Rewrite the user prompt into one polished English image-generation prompt.',
  'Preserve the original intent while adding concrete visual details about subject, setting, composition, materials, lighting, color, mood, and style.',
  'Do not add explanations, markdown, quotes, headings, multiple options, or negative prompts.',
  'Return only the optimized prompt in 80 to 140 words.',
].join(' ')

type PreparedPromptOptimizerRequest = {
  document: CanvasDocument
  request?: AiChatCompletionRequest
  runId: string
  shapeId: string
  status: 'failed' | 'started'
}

export function prepareKonvaPromptOptimizerRequest(
  document: CanvasDocument,
  shapeId: string
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

  const modelId = getDefaultChatModelId()
  const sourcePrompt = inputResolution.textValues.join('\n\n').trim()
  const request = {
    messages: [
      { content: promptOptimizerSystemPrompt, role: 'system' },
      {
        content: `Optimize and enrich this image-generation prompt:\n\n${sourcePrompt}`,
        role: 'user',
      },
    ],
    model: modelId,
    stream: true,
  } satisfies AiChatCompletionRequest

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
          status: 'running',
          textOutput: '',
        },
      },
    }), false),
    request,
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
        runtimeSummary: {
          ...shape.props.runtimeSummary,
          costHint: 'Prompt optimized.',
          error: null,
          status: 'succeeded',
          textOutput: optimizedPrompt.slice(0, 4000),
        },
      },
    }
  })
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
