import type { CanvasDocument, CanvasNodeShape } from '@/features/canvas-engine'
import type { JsonObject, NodeRuntimeSummary } from '@/types/nodeRuntime'
import { getIncomingRuntimeGraphEdges } from './runtimeGraph'
import { getRuntimeGraphGeneratedOutputRefs, getRuntimeGraphImageCrop, type RuntimeGraphImageCrop } from './runtimeGraphAssets'

export type RuntimeGraphImageValue = {
  assetId: string
  crop?: RuntimeGraphImageCrop
  imageHeight?: number
  imageWidth?: number
  sourceNodeId: string
  title: string
}

export type RuntimeGraphInputResolution = {
  canRun: boolean
  imageValues: RuntimeGraphImageValue[]
  incomingCount: number
  missingReasons: string[]
  primaryText: string | null
  runHint: string
  textValues: string[]
}

type RuntimeGraphOutput = {
  imageValues: RuntimeGraphImageValue[]
  textValues: string[]
}

export function resolveRuntimeGraphNodeInputs(document: CanvasDocument, node: CanvasNodeShape): RuntimeGraphInputResolution {
  const incomingEdges = getIncomingRuntimeGraphEdges(document, node.id)
  const textValues: string[] = []
  const imageValues: RuntimeGraphImageValue[] = []

  for (const edge of incomingEdges) {
    const source = getNodeShape(document, edge.sourceShapeId)
    if (!source) continue
    const output = getRuntimeGraphNodeOutput(document, source, edge.sourcePortId, new Set([node.id]))
    if (edge.dataType === 'text') textValues.push(...output.textValues.filter(Boolean))
    if (edge.dataType === 'image') imageValues.push(...output.imageValues)
  }

  const missingReasons = getMissingReasons(node, textValues, imageValues)
  return {
    canRun: missingReasons.length === 0,
    imageValues,
    incomingCount: incomingEdges.length,
    missingReasons,
    primaryText: textValues[0] ?? null,
    runHint: missingReasons[0] ?? getReadyHint(node, textValues, imageValues),
    textValues,
  }
}

export function getRuntimeGraphNodeOutput(
  document: CanvasDocument,
  node: CanvasNodeShape,
  portId: string,
  visited: Set<string> = new Set()
): RuntimeGraphOutput {
  const visitKey = `${node.id}:${portId}`
  if (visited.has(visitKey)) return emptyOutput()
  visited.add(visitKey)

  const data = asJsonObject(node.props.data)
  const summary = asRuntimeSummary(node.props.runtimeSummary)

  if (node.props.nodeType === 'prompt' && portId === 'text_out') {
    const inputText = getIncomingText(document, node, visited)
    return { imageValues: [], textValues: [inputText || String(data.prompt ?? '')].filter(Boolean) }
  }

  if (node.props.nodeType === 'analysis' && portId === 'text_out') {
    const textOutput = getShortTextOutput(summary)
    return { imageValues: [], textValues: textOutput ? [textOutput] : [] }
  }

  if (node.props.nodeType === 'image_gen' && portId === 'image_out') {
    const outputRefs = getRuntimeGraphGeneratedOutputRefs(data)
    if (outputRefs.length > 0) return { imageValues: outputRefs.map((ref) => toImageValue(ref, node.props.nodeId)), textValues: [] }
    return {
      imageValues: summary.resultAssetIds.map((assetId, index) => ({
        assetId,
        sourceNodeId: node.props.nodeId,
        title: `Generated image ${index + 1}`,
      })),
      textValues: [],
    }
  }

  if (node.props.nodeType === 'image_gen_4' && portId.startsWith('image_out_')) {
    const outputIndex = Number(portId.replace('image_out_', '')) - 1
    const outputRef = getRuntimeGraphGeneratedOutputRefs(data)[outputIndex]
    if (outputRef) return { imageValues: [toImageValue(outputRef, node.props.nodeId)], textValues: [] }
    const assetId = summary.resultAssetIds[outputIndex]
    return {
      imageValues: assetId ? [{
        assetId,
        sourceNodeId: node.props.nodeId,
        title: `Generated option ${outputIndex + 1}`,
      }] : [],
      textValues: [],
    }
  }

  if (node.props.nodeType === 'image_gen_4' && portId === 'image_out') {
    const outputRefs = getRuntimeGraphGeneratedOutputRefs(data)
    if (outputRefs.length > 0) return { imageValues: outputRefs.map((ref) => toImageValue(ref, node.props.nodeId)), textValues: [] }
    return {
      imageValues: summary.resultAssetIds.map((assetId, index) => ({
        assetId,
        sourceNodeId: node.props.nodeId,
        title: `Generated option ${index + 1}`,
      })),
      textValues: [],
    }
  }

  if (node.props.nodeType === 'image' && portId === 'image_out') {
    const incomingImages = getIncomingImages(document, node, visited)
    if (incomingImages.length > 0) return { imageValues: incomingImages, textValues: [] }
    const assetId = getOwnAssetId(data)
    if (!assetId) return emptyOutput()
    return {
      imageValues: [{
        assetId,
        crop: getRuntimeGraphImageCrop(data.crop),
        imageHeight: getNumber(data.imageHeight),
        imageWidth: getNumber(data.imageWidth),
        sourceNodeId: node.props.nodeId,
        title: String(data.title ?? 'Image'),
      }],
      textValues: [],
    }
  }

  return emptyOutput()
}

function getIncomingText(document: CanvasDocument, node: CanvasNodeShape, visited: Set<string>) {
  return getIncomingRuntimeGraphEdges(document, node.id)
    .filter((edge) => edge.dataType === 'text')
    .flatMap((edge) => {
      const source = getNodeShape(document, edge.sourceShapeId)
      return source ? getRuntimeGraphNodeOutput(document, source, edge.sourcePortId, visited).textValues : []
    })
    .filter(Boolean)
    .join('\n\n')
}

function getIncomingImages(document: CanvasDocument, node: CanvasNodeShape, visited: Set<string>) {
  return getIncomingRuntimeGraphEdges(document, node.id)
    .filter((edge) => edge.dataType === 'image')
    .flatMap((edge) => {
      const source = getNodeShape(document, edge.sourceShapeId)
      return source ? getRuntimeGraphNodeOutput(document, source, edge.sourcePortId, visited).imageValues : []
    })
}

function getMissingReasons(node: CanvasNodeShape, textValues: string[], imageValues: RuntimeGraphImageValue[]) {
  if ((node.props.nodeType === 'image_gen' || node.props.nodeType === 'image_gen_4') && textValues.length === 0) return ['Connect a prompt first.']
  if (node.props.nodeType === 'analysis' && imageValues.length === 0) return ['Connect an image first.']
  return []
}

function getReadyHint(node: CanvasNodeShape, textValues: string[], imageValues: RuntimeGraphImageValue[]) {
  if (node.props.nodeType === 'analysis') return `Ready: ${imageValues.length} image input${imageValues.length === 1 ? '' : 's'}`
  if (node.props.nodeType === 'image_gen' || node.props.nodeType === 'image_gen_4') {
    return `Ready: ${textValues.length} prompt, ${imageValues.length} image reference${imageValues.length === 1 ? '' : 's'}`
  }
  return 'Ready'
}

function getNodeShape(document: CanvasDocument, shapeId: string): CanvasNodeShape | null {
  return document.shapes.find((shape): shape is CanvasNodeShape => shape.id === shapeId && shape.type === 'node_card') ?? null
}

function emptyOutput(): RuntimeGraphOutput {
  return { imageValues: [], textValues: [] }
}

function toImageValue(ref: ReturnType<typeof getRuntimeGraphGeneratedOutputRefs>[number], sourceNodeId: string): RuntimeGraphImageValue {
  return {
    assetId: ref.assetId,
    crop: ref.crop,
    imageHeight: ref.imageHeight,
    imageWidth: ref.imageWidth,
    sourceNodeId,
    title: ref.title ?? 'Generated image',
  }
}

function asJsonObject(value: unknown): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonObject) : {}
}

function asRuntimeSummary(value: unknown): NodeRuntimeSummary {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as NodeRuntimeSummary)
    : { costHint: null, error: null, lastRunId: null, resultAssetIds: [], status: 'idle' }
}

function getOwnAssetId(data: JsonObject) {
  return typeof data.assetId === 'string' && !data.assetId.startsWith('input:') ? data.assetId : null
}

function getNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function getShortTextOutput(summary: NodeRuntimeSummary) {
  return typeof summary.textOutput === 'string' ? summary.textOutput.slice(0, 4000) : ''
}
