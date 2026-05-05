import { withCanvasShapes, type CanvasDocument, type CanvasNodeShape } from '@/features/canvas-engine'
import { reconcileRuntimeGraphDocument } from '@/features/node-runtime/runtimeGraph'
import { resolveRuntimeGraphNodeInputs } from '@/features/node-runtime/runtimeGraphResolution'
import type { JsonObject } from '@/types/nodeRuntime'

type ChatMessage = {
  id: string
  role: 'assistant' | 'user'
  text: string
}

type ChatReferenceImage = {
  assetId: string
  originalUrl?: string
  thumbnail256Url?: string
  title?: string
}

type ChatReferenceFile = {
  addedAt: string
  mime: string
  name: string
  size: number
}

export const konvaChatDraftPlaceholder = 'Ask about the connected prompts and images...'

const maxChatMessages = 12
const maxChatMessageTextLength = 1200

export function sendKonvaChatMessage(document: CanvasDocument, shapeId: string, draftOverride?: string): CanvasDocument {
  const node = getChatNode(document, shapeId)
  if (!node) return document
  const draft = (draftOverride ?? getKonvaChatDraft(node.props.data)).trim()
  const inputResolution = resolveRuntimeGraphNodeInputs(document, node)
  const userText = draft || inputResolution.primaryText || 'Continue with the connected context.'
  const userMessage = createChatMessage('user', userText)
  const assistantMessage = createChatMessage('assistant', createAssistantReply(userText, inputResolution, node.props.data))
  return withCanvasShapes(document, document.shapes.map((shape) => (
    shape.id === shapeId && isChatNodeShape(shape)
      ? {
          ...shape,
          props: {
            ...shape.props,
            data: {
              ...shape.props.data,
              chatDraft: '',
              chatMessages: [...getChatMessages(shape.props.data), userMessage, assistantMessage].slice(-maxChatMessages),
            },
            runtimeSummary: {
              ...shape.props.runtimeSummary,
              error: null,
              status: 'succeeded',
              textOutput: assistantMessage.text,
            },
          },
        }
      : shape
  )))
}

export function toggleKonvaChatMessageExport(document: CanvasDocument, shapeId: string, messageId: string): CanvasDocument {
  const node = getChatNode(document, shapeId)
  if (!node) return document
  const messages = getChatMessages(node.props.data)
  if (!messages.some((message) => message.id === messageId && message.role === 'assistant')) return document
  const exported = getExportedMessageIds(node.props.data)
  const nextExported = exported.includes(messageId)
    ? exported.filter((id) => id !== messageId)
    : [...exported, messageId].slice(0, 8)
  return reconcileRuntimeGraphDocument(withCanvasShapes(document, document.shapes.map((shape) => (
    shape.id === shapeId && isChatNodeShape(shape)
      ? { ...shape, props: { ...shape.props, data: { ...shape.props.data, exportedMessageIds: nextExported } } }
      : shape
  ))))
}

export function clearKonvaChatHistory(document: CanvasDocument, shapeId: string): CanvasDocument {
  const node = getChatNode(document, shapeId)
  if (!node) return document
  if (getChatMessages(node.props.data).length === 0 && getExportedMessageIds(node.props.data).length === 0) return document
  return reconcileRuntimeGraphDocument(withCanvasShapes(document, document.shapes.map((shape) => (
    shape.id === shapeId && isChatNodeShape(shape)
      ? {
          ...shape,
          props: {
            ...shape.props,
            data: {
              ...shape.props.data,
              chatMessages: [],
              exportedMessageIds: [],
            },
            runtimeSummary: {
              ...shape.props.runtimeSummary,
              error: null,
              status: 'idle',
              textOutput: '',
            },
          },
        }
      : shape
  ))))
}

export function addKonvaChatReferenceImage(document: CanvasDocument, shapeId: string, image: ChatReferenceImage): CanvasDocument {
  const node = getChatNode(document, shapeId)
  if (!node) return document
  const current = getReferenceImages(node.props.data)
  return withCanvasShapes(document, document.shapes.map((shape) => (
    shape.id === shapeId && isChatNodeShape(shape)
      ? { ...shape, props: { ...shape.props, data: { ...shape.props.data, referenceImages: [...current, image].slice(-12) } } }
      : shape
  )))
}

export function addKonvaChatReferenceFile(document: CanvasDocument, shapeId: string, file: Omit<ChatReferenceFile, 'addedAt'>): CanvasDocument {
  const node = getChatNode(document, shapeId)
  if (!node) return document
  const current = getReferenceFiles(node.props.data)
  return withCanvasShapes(document, document.shapes.map((shape) => (
    shape.id === shapeId && isChatNodeShape(shape)
      ? { ...shape, props: { ...shape.props, data: { ...shape.props.data, referenceFiles: [...current, { ...file, addedAt: new Date().toISOString() }].slice(-12) } } }
      : shape
  )))
}

export function getKonvaChatMessages(data: JsonObject) {
  return getChatMessages(data)
}

export function getKonvaChatExportedMessageIds(data: JsonObject) {
  return getExportedMessageIds(data)
}

export function getKonvaChatReferenceImages(data: JsonObject) {
  return getReferenceImages(data)
}

export function getKonvaChatReferenceFiles(data: JsonObject) {
  return getReferenceFiles(data)
}

export function getKonvaChatDraft(data: JsonObject) {
  const draft = getString(data.chatDraft)
  return draft === konvaChatDraftPlaceholder ? '' : draft
}

function getChatNode(document: CanvasDocument, shapeId: string): CanvasNodeShape | null {
  return document.shapes.find((shape): shape is CanvasNodeShape => shape.id === shapeId && isChatNodeShape(shape)) ?? null
}

function isChatNodeShape(shape: CanvasDocument['shapes'][number]): shape is CanvasNodeShape {
  return shape.type === 'node_card' && shape.props.nodeType === 'chat'
}

function createAssistantReply(userText: string, inputResolution: ReturnType<typeof resolveRuntimeGraphNodeInputs>, data: JsonObject) {
  const localImages = getReferenceImages(data).length
  const localFiles = getReferenceFiles(data).length
  const imageCount = inputResolution.imageValues.length + localImages
  const fileText = localFiles > 0 ? `, ${localFiles} file reference${localFiles === 1 ? '' : 's'}` : ''
  const context = `${inputResolution.textValues.length} text input${inputResolution.textValues.length === 1 ? '' : 's'}, ${imageCount} image reference${imageCount === 1 ? '' : 's'}${fileText}`
  return `${userText}\n\nContext received: ${context}.`
}

function createChatMessage(role: ChatMessage['role'], text: string): ChatMessage {
  return {
    id: `chat-${role}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    role,
    text: text.slice(0, maxChatMessageTextLength),
  }
}

function getChatMessages(data: JsonObject): ChatMessage[] {
  if (!Array.isArray(data.chatMessages)) return []
  return data.chatMessages.flatMap((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return []
    const value = item as Record<string, unknown>
    const role = value.role === 'assistant' ? 'assistant' : value.role === 'user' ? 'user' : null
    if (!role || typeof value.text !== 'string') return []
    if (isDeprecatedSeedChatMessage(value, role)) return []
    const message: ChatMessage = {
      id: typeof value.id === 'string' ? value.id : `chat-${role}`,
      role,
      text: value.text.slice(0, maxChatMessageTextLength),
    }
    return [message]
  }).slice(-maxChatMessages)
}

function isDeprecatedSeedChatMessage(value: Record<string, unknown>, role: ChatMessage['role']) {
  return (
    (role === 'user' && value.id === 'seed-user' && value.text === 'Use the connected context and answer clearly.') ||
    (role === 'assistant' && value.id === 'seed-assistant' && value.text === 'AI answer 1. Export this reply when it should become a downstream prompt.')
  )
}

function getExportedMessageIds(data: JsonObject) {
  return Array.isArray(data.exportedMessageIds)
    ? data.exportedMessageIds.filter((value): value is string => typeof value === 'string').slice(0, 8)
    : []
}

function getReferenceImages(data: JsonObject): ChatReferenceImage[] {
  if (!Array.isArray(data.referenceImages)) return []
  return data.referenceImages.flatMap((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return []
    const value = item as Record<string, unknown>
    if (typeof value.assetId !== 'string') return []
    return [{
      assetId: value.assetId,
      originalUrl: getString(value.originalUrl),
      thumbnail256Url: getString(value.thumbnail256Url),
      title: getString(value.title),
    }]
  })
}

function getReferenceFiles(data: JsonObject): ChatReferenceFile[] {
  if (!Array.isArray(data.referenceFiles)) return []
  return data.referenceFiles.flatMap((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return []
    const value = item as Record<string, unknown>
    if (typeof value.name !== 'string' || typeof value.mime !== 'string' || typeof value.size !== 'number') return []
    return [{
      addedAt: typeof value.addedAt === 'string' ? value.addedAt : '',
      mime: value.mime,
      name: value.name.slice(0, 180),
      size: value.size,
    }]
  })
}

function getString(value: unknown) {
  return typeof value === 'string' ? value : ''
}
