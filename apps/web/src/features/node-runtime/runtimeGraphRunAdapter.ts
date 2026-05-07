'use client'

import type { CanvasDocument, CanvasNodeShape } from '@/features/canvas-engine'
import { withCanvasShapes } from '@/features/canvas-engine'
import { createAiRun } from '@/features/ai/aiClient'
import { getAiRunTerminalError, waitForAiRunCompletion } from '@/features/ai/aiRunLifecycle'
import { getDefaultAnalysisModelId, getDefaultImageModelId } from '@/features/ai/mockAiContracts'
import type { AiRunRecord, AiRunRequest } from '@/features/ai/aiTypes'
import { hasRemotePersistenceApi } from '@/features/api/persistenceApi'
import { loadAssetRecords } from '@/features/assets/assetClient'
import type { TangentAssetRecord } from '@/features/assets/assetTypes'
import type { TangentWorkspace } from '@/features/auth/sessionTypes'
import type { JsonObject, NodeType } from '@/types/nodeRuntime'
import { canRunNodeType, getNormalizedAnalysisData, getNormalizedImageGenerationData } from './registry'
import { reconcileRuntimeGraphDocument } from './runtimeGraph'
import { uploadMockGeneratedAssets } from './runtimeGraphMockAssets'
import { resolveRuntimeGraphNodeInputs, type RuntimeGraphInputResolution } from './runtimeGraphResolution'
import { runtimeGraphImageRefToPayload } from './runtimeGraphAssets'

export type RuntimeGraphNodeRunStart = {
  clientRunId: string
  document: CanvasDocument
  request?: AiRunRequest
  shapeId: string
  status: 'failed' | 'ignored' | 'started'
}

export type RuntimeGraphNodeRunCompletion = {
  generatedAssets: TangentAssetRecord[]
  run: AiRunRecord
  runInput: RuntimeGraphNodeRunStart
}

export function startRuntimeGraphNodeRun(document: CanvasDocument, shapeId: string, boardId?: string | null): RuntimeGraphNodeRunStart {
  const node = getNodeShape(document, shapeId)
  if (!node || !canRunNodeType(node.props.nodeType)) {
    return { clientRunId: '', document, shapeId, status: 'ignored' }
  }

  const clientRunId = createClientRunId()
  const inputResolution = resolveRuntimeGraphNodeInputs(document, node)
  if (!inputResolution.canRun) {
    return {
      clientRunId,
      document: updateRuntimeNodeSummary(document, shapeId, {
        costHint: null,
        error: inputResolution.missingReasons[0] ?? 'Missing required input.',
        lastRunId: clientRunId,
        resultAssetIds: [],
        status: 'failed',
      }),
      shapeId,
      status: 'failed',
    }
  }

  return {
    clientRunId,
    document: reconcileRuntimeGraphDocument(updateRuntimeNodeSummary(document, shapeId, {
      costHint: 'Submitting AI run…',
      error: null,
      lastRunId: clientRunId,
      progressEstimatedMs: getEstimatedNodeRunDurationMs(node),
      progressStartedAt: Date.now(),
      resultAssetIds: [],
      serverRunId: null,
      status: 'running',
    }, shouldClearGeneratedOutputs(node.props.nodeType))),
    request: createRuntimeGraphAiRunRequest(node, inputResolution, boardId),
    shapeId,
    status: 'started',
  }
}

export function stopRuntimeGraphNodeRun(document: CanvasDocument, shapeId: string): CanvasDocument {
  return updateRuntimeNodeSummary(document, shapeId, {
    costHint: 'AI run canceled.',
    error: null,
    progressEstimatedMs: null,
    progressStartedAt: null,
    serverRunId: null,
    status: 'idle',
  })
}

export async function executeRuntimeGraphNodeRun(
  runInput: RuntimeGraphNodeRunStart,
  options?: {
    onServerRunAccepted?: (run: AiRunRecord) => void
    workspace?: TangentWorkspace
  }
): Promise<RuntimeGraphNodeRunCompletion> {
  if (runInput.status !== 'started' || !runInput.request) throw new Error('Runtime node run was not started.')
  const createdRun = await createAiRun(runInput.request, { workspace: options?.workspace })
  options?.onServerRunAccepted?.(createdRun)

  if (!hasRemotePersistenceApi()) {
    const generatedAssets = createdRun.runType === 'image_generation'
      ? createdRun.outputAssetIds.length > 0
        ? await loadAssetRecords(createdRun.outputAssetIds, options?.workspace)
        : await uploadMockGeneratedAssets(createdRun, runInput.request)
      : []
    return { generatedAssets, run: createdRun, runInput }
  }

  const settledRun = await waitForAiRunCompletion(createdRun.runId, { workspace: options?.workspace })
  if (settledRun.status !== 'succeeded') {
    throw getAiRunTerminalError(settledRun)
  }

  const generatedAssets = settledRun.runType === 'image_generation'
    ? await loadAssetRecords(settledRun.outputAssetIds, options?.workspace)
    : []

  return { generatedAssets, run: settledRun, runInput }
}

export function syncRuntimeGraphAcceptedRun(
  document: CanvasDocument,
  runInput: RuntimeGraphNodeRunStart,
  run: AiRunRecord
): { accepted: boolean; document: CanvasDocument } {
  const node = getNodeShape(document, runInput.shapeId)
  if (!node || node.props.runtimeSummary.lastRunId !== runInput.clientRunId || node.props.runtimeSummary.status !== 'running') {
    return { accepted: false, document }
  }
  return {
    accepted: true,
    document: updateRuntimeNodeSummary(document, runInput.shapeId, {
      costHint: run.costHint,
      serverRunId: run.runId,
    }),
  }
}

export function completeRuntimeGraphNodeRun(document: CanvasDocument, completion: RuntimeGraphNodeRunCompletion): CanvasDocument {
  const node = getNodeShape(document, completion.runInput.shapeId)
  if (!node || node.props.runtimeSummary.lastRunId !== completion.runInput.clientRunId || node.props.runtimeSummary.status !== 'running') return document

  const generatedOutputs = completion.generatedAssets.map((asset) => runtimeGraphImageRefToPayload({
    assetId: asset.id,
    imageHeight: asset.height,
    imageWidth: asset.width,
    originalUrl: asset.originalUrl,
    thumbnail1024Url: asset.thumbnail1024Url,
    thumbnail256Url: asset.thumbnail256Url,
    thumbnail512Url: asset.thumbnail512Url,
    title: asset.title,
  }))
  const resultAssetIds = generatedOutputs.map((asset) => String(asset.assetId ?? '')).filter(Boolean)
  return reconcileRuntimeGraphDocument(updateRuntimeNodeSummary(document, node.id, {
    costHint: completion.run.costHint,
    error: null,
    lastRunId: completion.run.runId,
    modelId: completion.run.modelId,
    progressEstimatedMs: null,
    progressStartedAt: null,
    resultAssetIds: resultAssetIds.length > 0 ? resultAssetIds : completion.run.outputAssetIds,
    serverRunId: null,
    status: 'succeeded',
    textOutput: completion.run.textOutput?.slice(0, 4000) ?? '',
  }, false, generatedOutputs))
}

export function failRuntimeGraphNodeRun(document: CanvasDocument, runInput: RuntimeGraphNodeRunStart, error: unknown): CanvasDocument {
  const node = getNodeShape(document, runInput.shapeId)
  if (!node || node.props.runtimeSummary.lastRunId !== runInput.clientRunId || node.props.runtimeSummary.status !== 'running') return document
  return updateRuntimeNodeSummary(document, runInput.shapeId, {
    costHint: 'AI run failed.',
    error: error instanceof Error ? error.message : 'AI run failed.',
    progressEstimatedMs: null,
    progressStartedAt: null,
    resultAssetIds: [],
    serverRunId: null,
    status: 'failed',
  })
}

function createRuntimeGraphAiRunRequest(node: CanvasNodeShape, inputResolution: RuntimeGraphInputResolution, boardId?: string | null): AiRunRequest {
  const isGeneration = node.props.nodeType === 'image_gen' || node.props.nodeType === 'image_gen_4'
  const data = isGeneration
    ? getNormalizedImageGenerationData(node.props.data)
    : node.props.nodeType === 'analysis'
      ? getNormalizedAnalysisData(node.props.data)
      : node.props.data
  return {
    boardId: boardId ?? null,
    inputAssetIds: inputResolution.imageValues.map((image) => image.assetId),
    nodeId: node.props.nodeId,
    nodeType: node.props.nodeType,
    params: isGeneration
      ? {
          aspectRatio: String(data.aspectRatio ?? '1:1'),
          count: node.props.nodeType === 'image_gen_4' ? 4 : 1,
          imageSize: String(data.imageSize ?? '1K'),
          jimengSize: String(data.jimengSize ?? '2048x2048'),
          jimengStrength: String(data.jimengStrength ?? '0.5'),
          quality: String(data.quality ?? 'medium'),
          seedreamOutputFormat: String(data.seedreamOutputFormat ?? 'png'),
          seedreamSize: String(data.seedreamSize ?? '2K'),
          size: String(data.size ?? '1024x1024'),
        }
      : {},
    prompt: getRunPrompt(data, inputResolution),
    runType: isGeneration ? 'image_generation' : 'image_analysis',
    selectedModelId: String(data.modelId ?? (node.props.nodeType === 'analysis' ? getDefaultAnalysisModelId() : getDefaultImageModelId())),
  }
}

function updateRuntimeNodeSummary(
  document: CanvasDocument,
  shapeId: string,
  summaryPatch: JsonObject,
  clearGeneratedOutputs = false,
  generatedOutputs?: JsonObject[]
) {
  return withCanvasShapes(document, document.shapes.map((shape) => {
    if (shape.id !== shapeId || shape.type !== 'node_card') return shape
    const nextData = {
      ...shape.props.data,
      ...(clearGeneratedOutputs ? { generatedOutputs: [] } : null),
      ...(generatedOutputs ? { generatedOutputs } : null),
    }
    return {
      ...shape,
      props: {
        ...shape.props,
        data: nextData as JsonObject,
        runtimeSummary: {
          ...shape.props.runtimeSummary,
          ...summaryPatch,
        },
      },
    }
  }))
}

function getRunPrompt(data: JsonObject, inputResolution: RuntimeGraphInputResolution) {
  return inputResolution.primaryText || String(data.prompt ?? data.analysisPrompt ?? 'Analyze this image in detail and write one clean image prompt.')
}

function shouldClearGeneratedOutputs(nodeType: NodeType) {
  return nodeType === 'image_gen' || nodeType === 'image_gen_4'
}

function getNodeShape(document: CanvasDocument, shapeId: string): CanvasNodeShape | null {
  return document.shapes.find((shape): shape is CanvasNodeShape => shape.id === shapeId && shape.type === 'node_card') ?? null
}

function createClientRunId() {
  if (typeof globalThis.crypto?.randomUUID === 'function') return `run_client_${globalThis.crypto.randomUUID()}`
  return `run_client_${Date.now()}_${Math.random().toString(36).slice(2)}`
}

function getEstimatedNodeRunDurationMs(node: CanvasNodeShape) {
  if (node.props.nodeType !== 'image_gen' && node.props.nodeType !== 'image_gen_4') return 45_000
  const data = getNormalizedImageGenerationData(node.props.data)
  const count = node.props.nodeType === 'image_gen_4' ? 4 : 1
  const modelId = String(data.modelId ?? getDefaultImageModelId())

  if (modelId === 'gemini-3.1-flash-image-preview') {
    const imageSize = String(data.imageSize ?? '1K')
    const baseMs = imageSize === '0.5K'
      ? 28_000
      : imageSize === '2K'
        ? 58_000
        : imageSize === '4K'
          ? 84_000
          : 42_000
    return Math.round(baseMs * (1 + (count - 1) * 0.5))
  }

  if (modelId === 'doubao-seedream-5.0-lite') {
    const size = String(data.seedreamSize ?? '2K')
    const baseMs = size.startsWith('4K') || size.includes('4096') || size.includes('5504') || size.includes('6240')
      ? 96_000
      : size.startsWith('3K') || size.includes('3072') || size.includes('3456') || size.includes('4704')
        ? 78_000
        : 58_000
    return Math.round(baseMs * (count > 1 ? 1.45 : 1))
  }

  if (modelId === 'jimeng_t2i_v40') {
    const size = String(data.jimengSize ?? '2048x2048')
    const baseMs = size.includes('4096') || size.includes('4694') || size.includes('4992') || size.includes('5404') || size.includes('6198')
      ? 92_000
      : size === '1024x1024'
        ? 42_000
        : 62_000
    return Math.round(baseMs * (1 + (count - 1) * 0.55))
  }

  const quality = String(data.quality ?? 'medium')
  const size = String(data.size ?? '1024x1024')
  const baseMs = quality === 'low'
    ? 42_000
    : quality === 'high'
      ? 82_000
      : 58_000
  const sizeMultiplier = size === '1024x1024' ? 1 : 1.15
  return Math.round(baseMs * sizeMultiplier * (1 + (count - 1) * 0.55))
}
