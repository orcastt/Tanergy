'use client'

import type { CanvasDocument, CanvasNodeShape } from '@/features/canvas-engine'
import { withCanvasShapes } from '@/features/canvas-engine'
import { createAiRun } from '@/features/ai/aiClient'
import { getDefaultImageModelId } from '@/features/ai/mockAiContracts'
import type { AiRunRecord, AiRunRequest } from '@/features/ai/aiTypes'
import { uploadImageDataUrlAsset } from '@/features/assets/assetUploadClient'
import type { TangentAssetRecord } from '@/features/assets/assetTypes'
import type { JsonObject, NodeType } from '@/types/nodeRuntime'
import { canRunNodeType } from './registry'
import { reconcileRuntimeGraphDocument } from './runtimeGraph'
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

export function startRuntimeGraphNodeRun(document: CanvasDocument, shapeId: string): RuntimeGraphNodeRunStart {
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
      costHint: 'Mock run · no credits charged',
      error: null,
      lastRunId: clientRunId,
      resultAssetIds: [],
      status: 'running',
    }, shouldClearGeneratedOutputs(node.props.nodeType))),
    request: createRuntimeGraphAiRunRequest(node, inputResolution),
    shapeId,
    status: 'started',
  }
}

export function stopRuntimeGraphNodeRun(document: CanvasDocument, shapeId: string): CanvasDocument {
  return updateRuntimeNodeSummary(document, shapeId, {
    error: null,
    status: 'idle',
  })
}

export async function executeRuntimeGraphNodeRun(runInput: RuntimeGraphNodeRunStart): Promise<RuntimeGraphNodeRunCompletion> {
  if (runInput.status !== 'started' || !runInput.request) throw new Error('Runtime node run was not started.')
  const run = await createAiRun(runInput.request)
  const generatedAssets = run.runType === 'image_generation'
    ? await uploadMockGeneratedAssets(run, runInput.request)
    : []
  return { generatedAssets, run, runInput }
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
    resultAssetIds: resultAssetIds.length > 0 ? resultAssetIds : completion.run.outputAssetIds,
    status: 'succeeded',
    textOutput: completion.run.textOutput?.slice(0, 4000) ?? '',
  }, false, generatedOutputs))
}

export function failRuntimeGraphNodeRun(document: CanvasDocument, runInput: RuntimeGraphNodeRunStart, error: unknown): CanvasDocument {
  const node = getNodeShape(document, runInput.shapeId)
  if (!node || node.props.runtimeSummary.lastRunId !== runInput.clientRunId || node.props.runtimeSummary.status !== 'running') return document
  return updateRuntimeNodeSummary(document, runInput.shapeId, {
    costHint: 'Mock AI run failed',
    error: error instanceof Error ? error.message : 'AI run failed.',
    resultAssetIds: [],
    status: 'failed',
  })
}

function createRuntimeGraphAiRunRequest(node: CanvasNodeShape, inputResolution: RuntimeGraphInputResolution): AiRunRequest {
  const data = node.props.data
  const isGeneration = node.props.nodeType === 'image_gen' || node.props.nodeType === 'image_gen_4'
  return {
    boardId: null,
    inputAssetIds: inputResolution.imageValues.map((image) => image.assetId),
    nodeId: node.props.nodeId,
    nodeType: node.props.nodeType,
    params: {
      aspectRatio: data.aspectRatio ?? 'auto',
      count: node.props.nodeType === 'image_gen_4' ? 4 : node.props.nodeType === 'image_gen' ? 1 : 0,
      resolution: data.resolution ?? '1K',
    },
    prompt: getRunPrompt(data, inputResolution),
    runType: isGeneration ? 'image_generation' : 'image_analysis',
    selectedModelId: String(data.modelId ?? getDefaultImageModelId()),
  }
}

async function uploadMockGeneratedAssets(run: AiRunRecord, request: AiRunRequest) {
  const count = Math.max(1, Math.min(4, run.outputAssetIds.length || Number(request.params?.count ?? 1)))
  const size = getMockImageSize(request.params)
  return Promise.all(Array.from({ length: count }, (_, index) => {
    const dataUrl = createMockGeneratedImageDataUrl({
      count,
      height: size.height,
      index,
      modelId: run.modelId,
      prompt: request.prompt ?? 'Generated image',
      runId: run.runId,
      width: size.width,
    })
    return uploadImageDataUrlAsset({
      dataUrl,
      fileName: `mock-ai-run-${index + 1}.png`,
      height: size.height,
      origin: 'ai_run',
      title: count === 1 ? 'Generated image' : `Generated option ${index + 1}`,
      width: size.width,
    })
  }))
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
  return inputResolution.primaryText || String(data.prompt ?? data.analysisPrompt ?? 'Reverse prompt from the image.')
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

function getMockImageSize(params: JsonObject | undefined) {
  const longSide = params?.resolution === '0.5K' ? 256 : params?.resolution === '2K' ? 512 : params?.resolution === '4K' ? 640 : 384
  const aspect = typeof params?.aspectRatio === 'string' ? params.aspectRatio : '1:1'
  if (aspect === '16:9') return { height: Math.round(longSide * 9 / 16), width: longSide }
  if (aspect === '4:3') return { height: Math.round(longSide * 3 / 4), width: longSide }
  if (aspect === '3:2') return { height: Math.round(longSide * 2 / 3), width: longSide }
  return { height: longSide, width: longSide }
}

function createMockGeneratedImageDataUrl(input: { count: number; height: number; index: number; modelId: string; prompt: string; runId: string; width: number }) {
  const canvas = globalThis.document.createElement('canvas')
  canvas.width = input.width
  canvas.height = input.height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas preview generator is unavailable.')
  const hue = hashString(`${input.runId}:${input.index}`) % 360
  const gradient = context.createLinearGradient(0, 0, input.width, input.height)
  gradient.addColorStop(0, `hsl(${hue} 82% 56%)`)
  gradient.addColorStop(1, `hsl(${(hue + 54) % 360} 76% 38%)`)
  context.fillStyle = gradient
  context.fillRect(0, 0, input.width, input.height)
  context.fillStyle = 'rgba(255,255,255,0.18)'
  for (let i = 0; i < 8; i += 1) {
    context.beginPath()
    context.arc(input.width * (0.12 + i * 0.11), input.height * (0.2 + (i % 3) * 0.22), input.width * 0.12, 0, Math.PI * 2)
    context.fill()
  }
  context.fillStyle = 'rgba(15,23,42,0.72)'
  context.fillRect(0, input.height - 132, input.width, 132)
  context.fillStyle = '#ffffff'
  context.font = '700 34px Inter, system-ui, sans-serif'
  context.fillText(input.count === 1 ? 'Mock Image Gen' : `Mock Image ${input.index + 1}`, 36, input.height - 76)
  context.font = '500 22px Inter, system-ui, sans-serif'
  context.fillText(input.prompt.slice(0, 72), 36, input.height - 38)
  context.font = '600 16px Inter, system-ui, sans-serif'
  context.fillText(input.modelId, 36, 38)
  return canvas.toDataURL('image/png')
}

function hashString(value: string) {
  return Array.from(value).reduce((hash, char) => ((hash << 5) - hash + char.charCodeAt(0)) | 0, 0) >>> 0
}
