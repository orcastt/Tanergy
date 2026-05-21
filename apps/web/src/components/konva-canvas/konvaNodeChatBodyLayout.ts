export type ChatMessage = {
  id: string
  role: 'assistant' | 'user'
  text: string
}

export type ChatReferenceFile = {
  addedAt: string
  mime: string
  name: string
  size: number
}

export type ChatMessageLayout = {
  displayText: string
  height: number
  isAssistant: boolean
  message: ChatMessage
  textContentHeight: number
  textMaxScroll: number
  textViewportHeight: number
  textViewportWidth: number
  width: number
  x: number
  y: number
}

export function getChatMessageLayouts(messages: ChatMessage[], contentWidth: number, gap: number) {
  let y = 0
  const items: ChatMessageLayout[] = messages.map((message) => {
    const isAssistant = message.role === 'assistant'
    const width = isAssistant ? contentWidth : Math.max(128, contentWidth - 92)
    const displayText = message.text || (isAssistant ? 'Thinking...' : '')
    const textMetrics = getMessageTextMetrics(displayText, width, isAssistant)
    const layout = {
      displayText,
      height: textMetrics.height,
      isAssistant,
      message,
      textContentHeight: textMetrics.contentHeight,
      textMaxScroll: textMetrics.maxScroll,
      textViewportHeight: textMetrics.viewportHeight,
      textViewportWidth: textMetrics.viewportWidth,
      width,
      x: isAssistant ? 0 : contentWidth - width,
      y,
    }
    y += textMetrics.height + gap
    return layout
  })
  return { items, totalHeight: Math.max(0, y - gap) }
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

export function getShortModelLabel(label: string) {
  return label.replace(/\s+Preview$/i, '').slice(0, 14) || 'Model'
}

function getMessageTextMetrics(text: string, width: number, isAssistant: boolean) {
  const footerHeight = isAssistant ? 42 : 24
  const viewportWidth = Math.max(80, width - 30)
  const contentHeight = estimateWrappedTextHeight(text, viewportWidth)
  const height = clamp(footerHeight + 12 + contentHeight, 54, isAssistant ? 172 : 148)
  const viewportHeight = Math.max(18, height - footerHeight - 12)
  return {
    contentHeight,
    height,
    maxScroll: Math.max(0, contentHeight - viewportHeight),
    viewportHeight,
    viewportWidth,
  }
}

function estimateWrappedTextHeight(text: string, width: number) {
  const lines = text.split('\n').reduce(
    (total, line) => total + Math.max(1, Math.ceil(getVisualTextUnits(line) / Math.max(1, width / 12))),
    0,
  )
  return lines * 15.5
}

function getVisualTextUnits(text: string) {
  return Array.from(text).reduce((total, char) => {
    if (/\s/.test(char)) return total + 0.35
    if (/[\u3400-\u9fff\uff00-\uffef]/.test(char)) return total + 1
    if (/[A-Z0-9]/.test(char)) return total + 0.68
    return total + 0.56
  }, 0)
}
