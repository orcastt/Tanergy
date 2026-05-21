import type { CanvasShape } from '@/features/canvas-engine'

const fallbackTextFontSize = 18
const textLineHeightRatio = 1.28
const textMinHeight = 24
const textMinWidth = 48
const textPaddingX = 4
const textPaddingY = 4

export function fitStandaloneTextShapeToContent(shape: CanvasShape): CanvasShape {
  if (shape.type !== 'text') return shape
  const fontSize = getShapeFontSize(shape)
  const width = Math.max(shape.props.width, getLongestWordWidth(shape.props.text, fontSize) + textPaddingX * 2, textMinWidth)
  const lineCount = measureWrappedLineCount(shape.props.text, width - textPaddingX * 2, fontSize)
  const height = Math.max(textMinHeight, Math.ceil(lineCount * fontSize * textLineHeightRatio + textPaddingY))
  return {
    ...shape,
    props: {
      ...shape.props,
      height,
      width,
    },
  }
}

export function getStandaloneTextEditorMetrics(shape: Extract<CanvasShape, { type: 'text' }>) {
  const fontSize = getShapeFontSize(shape)
  return {
    fontSize,
    lineHeight: Math.round(fontSize * textLineHeightRatio),
  }
}

export function scaleStandaloneTextStyle(shape: CanvasShape, scaleY: number): CanvasShape {
  if (shape.type !== 'text') return shape
  const fontSize = Math.max(8, Math.min(144, Math.round(getShapeFontSize(shape) * Math.max(0.1, Math.abs(scaleY)))))
  return {
    ...shape,
    style: {
      ...shape.style,
      fontSize,
    },
  }
}

function getShapeFontSize(shape: Extract<CanvasShape, { type: 'text' }>) {
  return shape.style?.fontSize ?? fallbackTextFontSize
}

function getLongestWordWidth(text: string, fontSize: number) {
  const longest = text.split(/\s+/).reduce((max, word) => Math.max(max, word.length), 0)
  return longest * fontSize * 0.58
}

function measureWrappedLineCount(text: string, availableWidth: number, fontSize: number) {
  const maxChars = Math.max(1, Math.floor(availableWidth / Math.max(1, fontSize * 0.58)))
  const paragraphs = text.split(/\n/)
  return Math.max(1, paragraphs.reduce((total, paragraph) => total + measureParagraphLines(paragraph, maxChars), 0))
}

function measureParagraphLines(paragraph: string, maxChars: number) {
  if (!paragraph.trim()) return 1
  let lines = 1
  let lineLength = 0
  for (const word of paragraph.split(/\s+/)) {
    const length = word.length
    if (lineLength === 0) {
      lineLength = length
      lines += Math.max(0, Math.ceil(length / maxChars) - 1)
      lineLength = length % maxChars
      continue
    }
    if (lineLength + 1 + length <= maxChars) {
      lineLength += 1 + length
      continue
    }
    lines += 1
    lineLength = length
    lines += Math.max(0, Math.ceil(length / maxChars) - 1)
    lineLength = length % maxChars
  }
  return lines
}
