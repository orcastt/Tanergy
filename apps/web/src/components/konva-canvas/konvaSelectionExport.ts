import type Konva from 'konva'
import { boundsToRect, expandBounds, getShapeBounds, type CanvasBounds, type CanvasDocument, type CanvasImageShape } from '@/features/canvas-engine'
import { getRuntimeGraphGeneratedOutputRefs } from '@/features/node-runtime/runtimeGraphAssets'

export type KonvaSelectionPngCapture = {
  bounds: CanvasBounds
  dataUrl: string
  height: number
  pixelRatio: number
  width: number
}

export type KonvaSelectionCaptureOptions = {
  maxPixelEdge?: number
  padding?: number
  pixelRatio?: number
}

const defaultPadding = 24
const defaultPixelRatio = 2
const defaultMaxPixelEdge = 4096
export const konvaCaptureExcludeName = 'konva-capture-exclude'
const shapeNodeName = 'konva-canvas-shape'
const shapeNodeIdPrefix = 'shape:'

export function getKonvaSelectionExportBounds(
  document: CanvasDocument,
  selectedIds: readonly string[],
  padding = defaultPadding
): CanvasBounds | null {
  const selected = new Set(selectedIds)
  const bounds = document.shapes
    .filter((shape) => selected.has(shape.id))
    .map(getShapeBounds)

  if (bounds.length === 0) return null
  return expandBounds(bounds.slice(1).reduce<CanvasBounds>((current, item) => ({
    maxX: Math.max(current.maxX, item.maxX),
    maxY: Math.max(current.maxY, item.maxY),
    minX: Math.min(current.minX, item.minX),
    minY: Math.min(current.minY, item.minY),
  }), bounds[0]), padding)
}

export async function captureKonvaSelectionPng({
  document,
  options = {},
  selectedIds,
  stage,
}: {
  document: CanvasDocument
  options?: KonvaSelectionCaptureOptions
  selectedIds: readonly string[]
  stage: Konva.Stage
}): Promise<KonvaSelectionPngCapture> {
  const bounds = getKonvaSelectionExportBounds(document, selectedIds, options.padding ?? defaultPadding)
  if (!bounds) throw new Error('Select at least one object to capture.')
  const rect = boundsToRect(bounds)
  if (rect.width <= 0 || rect.height <= 0) throw new Error('Selection bounds are empty.')

  const pixelRatio = getSafePixelRatio(
    rect.width,
    rect.height,
    options.pixelRatio ?? defaultPixelRatio,
    options.maxPixelEdge ?? defaultMaxPixelEdge
  )
  const captureStage = createOffscreenSelectionStage(stage, selectedIds)

  try {
    await hydrateOffscreenCaptureImages(captureStage.stage, document, selectedIds)
    await nextFrame()
    const dataUrl = captureStage.stage.toDataURL({
      height: rect.height,
      mimeType: 'image/png',
      pixelRatio,
      width: rect.width,
      x: rect.x,
      y: rect.y,
    })
    return {
      bounds,
      dataUrl,
      height: Math.max(1, Math.round(rect.height * pixelRatio)),
      pixelRatio,
      width: Math.max(1, Math.round(rect.width * pixelRatio)),
    }
  } catch (error) {
    throw new Error(getCaptureErrorMessage(error))
  } finally {
    captureStage.destroy()
  }
}

export async function copyKonvaPngDataUrlToClipboard(dataUrl: string) {
  if (typeof ClipboardItem === 'undefined' || !navigator.clipboard?.write) {
    throw new Error('PNG clipboard writing is not supported in this browser.')
  }
  const blob = await dataUrlToBlob(dataUrl)
  await navigator.clipboard.write([
    new ClipboardItem({ [blob.type || 'image/png']: blob }),
  ])
}

export async function copyKonvaSvgToClipboard(svg: string) {
  if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
    try {
      const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/svg+xml': blob, 'text/plain': new Blob([svg], { type: 'text/plain' }) }),
      ])
      return
    } catch {
      // Fall through to text clipboard. Some browsers reject image/svg+xml ClipboardItem.
    }
  }
  if (!navigator.clipboard?.writeText) throw new Error('SVG clipboard writing is not supported in this browser.')
  await navigator.clipboard.writeText(svg)
}

export function downloadKonvaDataUrl(dataUrl: string, fileName: string) {
  const anchor = document.createElement('a')
  anchor.download = fileName
  anchor.href = dataUrl
  anchor.rel = 'noreferrer'
  anchor.click()
}

export function downloadKonvaBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  try {
    downloadKonvaDataUrl(url, fileName)
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
}

function createOffscreenSelectionStage(stage: Konva.Stage, selectedIds: readonly string[]) {
  const container = document.createElement('div')
  container.style.cssText = 'position:fixed;left:-100000px;top:-100000px;width:1px;height:1px;overflow:hidden;pointer-events:none;opacity:0;'
  document.body.appendChild(container)
  const clone = stage.clone({ container }) as Konva.Stage
  prepareStageForSelectionCapture(clone, selectedIds)
  return {
    destroy: () => {
      clone.destroy()
      container.remove()
    },
    stage: clone,
  }
}

function prepareStageForSelectionCapture(stage: Konva.Stage, selectedIds: readonly string[]) {
  const selected = new Set(selectedIds)
  const shapeNodes = stage.find(`.${shapeNodeName}`)

  stage.find(`.${konvaCaptureExcludeName}`).forEach((node) => node.visible(false))
  for (const node of shapeNodes) {
    const shapeId = node.id().startsWith(shapeNodeIdPrefix) ? node.id().slice(shapeNodeIdPrefix.length) : ''
    node.visible(selected.has(shapeId))
  }
  stage.position({ x: 0, y: 0 })
  stage.scale({ x: 1, y: 1 })
  stage.batchDraw()
}

async function hydrateOffscreenCaptureImages(stage: Konva.Stage, document: CanvasDocument, selectedIds: readonly string[]) {
  const selected = new Set(selectedIds)
  const tasks = document.shapes
    .filter((shape) => selected.has(shape.id))
    .flatMap((shape) => getOriginalCaptureImageSources(shape).map((src, index) => ({ index, shapeId: shape.id, src })))
  if (tasks.length === 0) return
  await Promise.all(tasks.map(async (task) => {
    const group = findShapeNode(stage, task.shapeId)
    const imageNode = group ? findImageNodes(group)[task.index] : null
    if (!imageNode) return
    const image = await loadCaptureImage(task.src).catch(() => null)
    if (!image) return
    imageNode.setAttr('image', image)
  }))
  stage.batchDraw()
}

function getOriginalCaptureImageSources(shape: CanvasDocument['shapes'][number]) {
  if (shape.type === 'image') return [getCanvasImageOriginalSource(shape)].filter(isString)
  if (shape.type !== 'node_card') return []
  if (shape.props.nodeType === 'image') return [getString(shape.props.data.originalUrl)].filter(isString)
  return getRuntimeGraphGeneratedOutputRefs(shape.props.data)
    .map((ref) => ref.originalUrl ?? ref.thumbnail1024Url ?? ref.thumbnail512Url ?? ref.thumbnail256Url)
    .filter(isString)
}

function getCanvasImageOriginalSource(shape: CanvasImageShape) {
  return shape.props.originalUrl ?? shape.props.thumbnail1024Url ?? shape.props.thumbnail512Url ?? shape.props.thumbnail256Url
}

function findShapeNode(stage: Konva.Stage, shapeId: string) {
  return stage.find(`.${shapeNodeName}`).find((node) => node.id() === `${shapeNodeIdPrefix}${shapeId}`)
}

function findImageNodes(node: Konva.Node) {
  if (!hasKonvaFind(node)) return []
  return node.find('Image')
}

function hasKonvaFind(node: Konva.Node): node is Konva.Container {
  return typeof (node as { find?: unknown }).find === 'function'
}

function loadCaptureImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new window.Image()
    image.decoding = 'async'
    if (src.startsWith('/') || src.startsWith(window.location.origin)) image.crossOrigin = 'anonymous'
    image.onerror = () => reject(new Error('Capture image load failed.'))
    image.onload = () => resolve(image)
    image.src = src
  })
}

function getString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value : undefined
}

function isString(value: string | undefined): value is string {
  return typeof value === 'string' && value.length > 0
}

function getSafePixelRatio(width: number, height: number, preferred: number, maxPixelEdge: number) {
  const safePreferred = Number.isFinite(preferred) && preferred > 0 ? preferred : defaultPixelRatio
  const maxEdge = Math.max(width, height, 1)
  return Math.max(0.5, Math.min(safePreferred, maxPixelEdge / maxEdge))
}

async function dataUrlToBlob(dataUrl: string) {
  const response = await fetch(dataUrl)
  return response.blob()
}

function nextFrame() {
  return new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()))
}

function getCaptureErrorMessage(error: unknown) {
  if (error instanceof DOMException && error.name === 'SecurityError') {
    return 'Selection contains an image that cannot be exported by the browser. Upload it as an asset first, then try again.'
  }
  if (error instanceof Error && error.message) return error.message
  return 'Selection capture failed.'
}
