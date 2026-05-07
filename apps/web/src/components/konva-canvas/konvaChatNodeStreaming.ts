import { withCanvasShapes, type CanvasDocument, type CanvasNodeShape } from '@/features/canvas-engine'
import type { AiChatCompletionRequest, AiChatMessage, AiChatMessageContentPart } from '@/features/ai/aiTypes'
import { getDefaultChatModelId } from '@/features/ai/mockAiContracts'
import { resolveRuntimeGraphNodeInputs, type RuntimeGraphImageValue } from '@/features/node-runtime/runtimeGraphResolution'
import type { JsonObject } from '@/types/nodeRuntime'
import {
  getKonvaChatDraft,
  getKonvaChatMessages,
  getKonvaChatModelId,
  getKonvaChatReferenceFiles,
  getKonvaChatReferenceImages,
} from './konvaChatNodeActions'

const chatSystemPrompt = [
  'You are the AI assistant inside the TANGENT canvas.',
  'Use the provided text and image context when relevant.',
  'Be concrete, concise, and do not claim you read files unless file contents are actually attached.',
].join(' ')

const maxChatMessages = 12
const maxChatMessageTextLength = 1200

type PreparedKonvaChatRequest = {
  assistantMessageId: string
  document: CanvasDocument
  request: AiChatCompletionRequest
  runId: string
}

type ChatMessage = ReturnType<typeof getKonvaChatMessages>[number]

export function prepareKonvaChatRequest(
  document: CanvasDocument,
  shapeId: string,
  draftOverride?: string
): PreparedKonvaChatRequest | null {
  const node = getChatNode(document, shapeId)
  if (!node) return null

  const inputResolution = resolveRuntimeGraphNodeInputs(document, node)
  const allImages = getAllChatImages(node.props.data, inputResolution.imageValues)
  const draft = (draftOverride ?? getKonvaChatDraft(node.props.data)).trim()
  const userText = draft || inputResolution.primaryText || 'Continue with the connected context.'
  const runId = createChatRunId()
  const userMessage = createChatMessage('user', userText)
  const assistantMessage = createChatMessage('assistant', '')
  const modelId = getKonvaChatModelId(node.props.data) || getDefaultChatModelId()
  const request = {
    messages: createProviderMessages({
      files: getKonvaChatReferenceFiles(node.props.data),
      history: getKonvaChatMessages(node.props.data),
      images: allImages,
      promptValues: inputResolution.textValues,
      userText,
    }),
    model: modelId,
    stream: true,
  } satisfies AiChatCompletionRequest

  return {
    assistantMessageId: assistantMessage.id,
    document: withCanvasShapes(document, document.shapes.map((shape) => (
      shape.id === shapeId && isChatNodeShape(shape)
        ? {
            ...shape,
            props: {
              ...shape.props,
              data: {
                ...shape.props.data,
                chatDraft: '',
                chatMessages: [...getKonvaChatMessages(shape.props.data), userMessage, assistantMessage].slice(-maxChatMessages),
              },
              runtimeSummary: {
                ...shape.props.runtimeSummary,
                costHint: `Streaming via ${modelId}`,
                error: null,
                lastRunId: runId,
                status: 'running',
                textOutput: '',
              },
            },
          }
        : shape
    ))),
    request,
    runId,
  }
}

export function appendKonvaChatAssistantDelta(
  document: CanvasDocument,
  shapeId: string,
  runId: string,
  messageId: string,
  delta: string
) {
  if (!delta) return document
  return patchKonvaChatRun(document, shapeId, runId, (shape) => ({
    ...shape,
    props: {
      ...shape.props,
      data: {
        ...shape.props.data,
        chatMessages: getKonvaChatMessages(shape.props.data).map((message) => (
          message.id === messageId
            ? { ...message, text: `${message.text}${delta}`.slice(0, 4000) }
            : message
        )),
      },
    },
  }))
}

export function completeKonvaChatRequest(document: CanvasDocument, shapeId: string, runId: string) {
  return patchKonvaChatRun(document, shapeId, runId, (shape) => {
    const messages = getKonvaChatMessages(shape.props.data)
    const lastAssistant = [...messages].reverse().find((message) => message.role === 'assistant')
    return {
      ...shape,
      props: {
        ...shape.props,
        runtimeSummary: {
          ...shape.props.runtimeSummary,
          costHint: 'Chat complete.',
          error: null,
          status: 'succeeded',
          textOutput: lastAssistant?.text?.slice(0, 4000) ?? '',
        },
      },
    }
  })
}

export function failKonvaChatRequest(
  document: CanvasDocument,
  shapeId: string,
  runId: string,
  messageId: string,
  errorMessage: string
) {
  return patchKonvaChatRun(document, shapeId, runId, (shape) => ({
    ...shape,
    props: {
      ...shape.props,
      data: {
        ...shape.props.data,
        chatMessages: getKonvaChatMessages(shape.props.data).map((message) => (
          message.id === messageId && !message.text.trim()
            ? { ...message, text: `Error: ${errorMessage}`.slice(0, 4000) }
            : message
        )),
      },
      runtimeSummary: {
        ...shape.props.runtimeSummary,
        costHint: 'Chat failed.',
        error: errorMessage,
        status: 'failed',
      },
    },
  }))
}

export function setKonvaChatModelId(document: CanvasDocument, shapeId: string, modelId: string) {
  return withCanvasShapes(document, document.shapes.map((shape) => (
    shape.id === shapeId && isChatNodeShape(shape)
      ? { ...shape, props: { ...shape.props, data: { ...shape.props.data, modelId } } }
      : shape
  )))
}

function createProviderMessages(input: {
  files: ReturnType<typeof getKonvaChatReferenceFiles>
  history: ChatMessage[]
  images: RuntimeGraphImageValue[]
  promptValues: string[]
  userText: string
}): AiChatMessage[] {
  const history = input.history
    .filter((message) => message.text.trim())
    .map((message) => ({ content: message.text, role: message.role }))
  const promptContext = input.promptValues.length > 0
    ? `Connected prompts:\n${input.promptValues.map((value, index) => `${index + 1}. ${value}`).join('\n')}`
    : ''
  const fileContext = input.files.length > 0
    ? `File refs present but not attached in this alpha build: ${input.files.map((file) => file.name).join(', ')}`
    : ''
  const textBlock = [promptContext, fileContext, `User request:\n${input.userText}`].filter(Boolean).join('\n\n')
  const imageParts = input.images
    .map((image): AiChatMessageContentPart | null => {
      const url = getChatImageUrl(image)
      return url ? { image_url: { url }, type: 'image_url' } : null
    })
    .filter((part): part is AiChatMessageContentPart => part !== null)

  return [
    { content: chatSystemPrompt, role: 'system' },
    ...history,
    {
      content: imageParts.length > 0
        ? [{ text: textBlock, type: 'text' }, ...imageParts]
        : textBlock,
      role: 'user',
    },
  ]
}

function patchKonvaChatRun(
  document: CanvasDocument,
  shapeId: string,
  runId: string,
  updater: (shape: CanvasNodeShape) => CanvasNodeShape
) {
  return withCanvasShapes(document, document.shapes.map((shape) => {
    if (shape.id !== shapeId || !isChatNodeShape(shape) || shape.props.runtimeSummary.lastRunId !== runId) return shape
    return updater(shape)
  }))
}

function getAllChatImages(data: JsonObject, connectedImages: RuntimeGraphImageValue[]) {
  const localImages = getKonvaChatReferenceImages(data).map((reference, index): RuntimeGraphImageValue => ({
    assetId: reference.assetId,
    originalUrl: reference.originalUrl,
    sourceNodeId: 'chat-local',
    thumbnail256Url: reference.thumbnail256Url,
    title: reference.title ?? `Reference image ${index + 1}`,
  }))
  return [...connectedImages, ...localImages]
}

function getChatImageUrl(image: RuntimeGraphImageValue) {
  return image.originalUrl ?? image.thumbnail1024Url ?? image.thumbnail512Url ?? image.thumbnail256Url ?? ''
}

function getChatNode(document: CanvasDocument, shapeId: string) {
  return document.shapes.find((shape): shape is CanvasNodeShape => shape.id === shapeId && isChatNodeShape(shape)) ?? null
}

function isChatNodeShape(shape: CanvasDocument['shapes'][number]): shape is CanvasNodeShape {
  return shape.type === 'node_card' && shape.props.nodeType === 'chat'
}

function createChatMessage(role: ChatMessage['role'], text: string): ChatMessage {
  return {
    id: `chat-${role}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    role,
    text: text.slice(0, maxChatMessageTextLength),
  }
}

function createChatRunId() {
  if (typeof globalThis.crypto?.randomUUID === 'function') return `chat_run_${globalThis.crypto.randomUUID()}`
  return `chat_run_${Date.now()}_${Math.random().toString(36).slice(2)}`
}
