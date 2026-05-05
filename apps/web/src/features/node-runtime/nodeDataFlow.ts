import type { Editor, TLShapeId } from 'tldraw'
import type { NodeCardShape } from '@/types/nodeCardShape'
import type { JsonObject, NodeRuntimeSummary } from '@/types/nodeRuntime'
import { getOwnImageAssetId } from './imageNodeEffectiveAsset'
import { getNodeEdgesSnapshot } from './nodeEdges'

export type RuntimeImageValue = {
  assetId: string
  imageHeight?: number
  imageWidth?: number
  sourceNodeId: string
  title: string
}

export type RuntimeInputResolution = {
  canRun: boolean
  imageValues: RuntimeImageValue[]
  incomingCount: number
  missingReasons: string[]
  primaryText: string | null
  runHint: string
  textValues: string[]
}

type RuntimeOutput = {
  imageValues: RuntimeImageValue[]
  textValues: string[]
}

export function resolveNodeInputs(editor: Editor, node: NodeCardShape): RuntimeInputResolution {
  const incomingEdges = getNodeEdgesSnapshot().filter((edge) => edge.targetShapeId === node.id)
  const textValues: string[] = []
  const imageValues: RuntimeImageValue[] = []

  for (const edge of incomingEdges) {
    const source = editor.getShape<NodeCardShape>(edge.sourceShapeId as TLShapeId)
    if (!isNodeCard(source)) continue

    const output = getNodeOutput(editor, source, edge.sourcePortId, new Set([node.id]))
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

export function getNodeOutput(
  editor: Editor,
  node: NodeCardShape,
  portId: string,
  visited: Set<string> = new Set()
): RuntimeOutput {
  const visitKey = `${node.id}:${portId}`
  if (visited.has(visitKey)) return emptyOutput()
  visited.add(visitKey)

  const data = asJsonObject(node.props.data)
  const summary = asRuntimeSummary(node.props.runtimeSummary)

  if (node.props.nodeType === 'prompt' && portId === 'text_out') {
    const inputText = getIncomingText(editor, node, visited)
    return { imageValues: [], textValues: [inputText || String(data.prompt ?? '')].filter(Boolean) }
  }

  if (node.props.nodeType === 'analysis' && portId === 'text_out') {
    const textOutput = String(summary.textOutput ?? '')
    return { imageValues: [], textValues: textOutput ? [textOutput] : [] }
  }

  if (node.props.nodeType === 'chat' && portId.startsWith('text_out_')) {
    const messageId = portId.replace('text_out_', '')
    const text = getChatMessageText(data, messageId)
    return { imageValues: [], textValues: text ? [text] : [] }
  }

  if (node.props.nodeType === 'image_gen' && portId === 'image_out') {
    return {
      imageValues: (summary.resultAssetIds ?? []).map((assetId, index) => ({
        assetId,
        sourceNodeId: node.props.nodeId,
        title: `Generated image ${index + 1}`,
      })),
      textValues: [],
    }
  }

  if (node.props.nodeType === 'image_gen_4' && portId.startsWith('image_out_')) {
    const outputIndex = Number(portId.replace('image_out_', '')) - 1
    const assetId = summary.resultAssetIds?.[outputIndex]
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
    return {
      imageValues: (summary.resultAssetIds ?? []).map((assetId, index) => ({
        assetId,
        sourceNodeId: node.props.nodeId,
        title: `Generated option ${index + 1}`,
      })),
      textValues: [],
    }
  }

  if (node.props.nodeType === 'image' && portId === 'image_out') {
    const incomingImages = getIncomingImages(editor, node, visited)
    if (incomingImages.length > 0) return { imageValues: incomingImages, textValues: [] }
    const assetId = getOwnImageAssetId(data.assetId)
    if (!assetId) return emptyOutput()
    return {
      imageValues: [{
        assetId,
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

function getIncomingText(editor: Editor, node: NodeCardShape, visited: Set<string>) {
  return getNodeEdgesSnapshot()
    .filter((edge) => edge.targetShapeId === node.id && edge.dataType === 'text')
    .flatMap((edge) => {
      const source = editor.getShape<NodeCardShape>(edge.sourceShapeId as TLShapeId)
      return isNodeCard(source) ? getNodeOutput(editor, source, edge.sourcePortId, visited).textValues : []
    })
    .filter(Boolean)
    .join('\n\n')
}

function getIncomingImages(editor: Editor, node: NodeCardShape, visited: Set<string>) {
  return getNodeEdgesSnapshot()
    .filter((edge) => edge.targetShapeId === node.id && edge.dataType === 'image')
    .flatMap((edge) => {
      const source = editor.getShape<NodeCardShape>(edge.sourceShapeId as TLShapeId)
      return isNodeCard(source) ? getNodeOutput(editor, source, edge.sourcePortId, visited).imageValues : []
    })
}

function getMissingReasons(node: NodeCardShape, textValues: string[], imageValues: RuntimeImageValue[]) {
  if ((node.props.nodeType === 'image_gen' || node.props.nodeType === 'image_gen_4') && textValues.length === 0) {
    return ['Connect a prompt first.']
  }
  if (node.props.nodeType === 'analysis' && imageValues.length === 0) {
    return ['Connect an image first.']
  }
  return []
}

function getReadyHint(node: NodeCardShape, textValues: string[], imageValues: RuntimeImageValue[]) {
  if (node.props.nodeType === 'analysis') return `Ready: ${imageValues.length} image input${imageValues.length === 1 ? '' : 's'}`
  if (node.props.nodeType === 'image_gen' || node.props.nodeType === 'image_gen_4') {
    return `Ready: ${textValues.length} prompt, ${imageValues.length} image reference${imageValues.length === 1 ? '' : 's'}`
  }
  return 'Ready'
}

function emptyOutput(): RuntimeOutput {
  return { imageValues: [], textValues: [] }
}

function asJsonObject(value: unknown): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonObject) : {}
}

function getNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function asRuntimeSummary(value: unknown): NodeRuntimeSummary {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as NodeRuntimeSummary)
    : { costHint: null, error: null, lastRunId: null, resultAssetIds: [], status: 'idle' }
}

function getChatMessageText(data: JsonObject, messageId: string) {
  if (!Array.isArray(data.exportedMessageIds) || !data.exportedMessageIds.includes(messageId)) return ''
  if (!Array.isArray(data.chatMessages)) return ''
  const message = data.chatMessages.find((item) => (
    item &&
    typeof item === 'object' &&
    !Array.isArray(item) &&
    (item as Record<string, unknown>).id === messageId
  )) as Record<string, unknown> | undefined
  return typeof message?.text === 'string' ? message.text.slice(0, 4000) : ''
}

function isNodeCard(shape: unknown): shape is NodeCardShape {
  return Boolean(shape && typeof shape === 'object' && 'type' in shape && shape.type === 'node_card')
}
