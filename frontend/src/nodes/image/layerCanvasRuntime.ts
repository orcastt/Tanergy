import type { RefObject } from "react"
import { useLayerStore } from "./layerStore"

let canvasEl: HTMLCanvasElement | null = null
let canvasSize = { w: 800, h: 600 }
let imageCacheRef: RefObject<Map<string, HTMLImageElement>> | null = null

export function setCanvasElement(el: HTMLCanvasElement | null) {
  canvasEl = el
}

export function setCanvasSize(size: { w: number; h: number }) {
  canvasSize = size
}

export function setImageCacheRef(ref: RefObject<Map<string, HTMLImageElement>>) {
  imageCacheRef = ref
}

export function captureCanvasDisplay(): string | null {
  if (!canvasEl || canvasEl.width === 0 || canvasEl.height === 0) return null
  try {
    return canvasEl.toDataURL("image/png")
  } catch {
    return null
  }
}

export function rasterizeLayers(): string | null {
  const { w, h } = canvasSize
  if (w <= 0 || h <= 0) return null
  const offscreen = document.createElement("canvas")
  offscreen.width = w
  offscreen.height = h
  const ctx = offscreen.getContext("2d")
  if (!ctx) return null

  const { layers, activeLayerId, currentStroke } = useLayerStore.getState()
  ctx.fillStyle = "#ffffff"
  ctx.fillRect(0, 0, w, h)

  for (const layer of layers) {
    if (!layer.visible) continue
    ctx.save()
    ctx.globalAlpha = layer.opacity
    if (layer.imageSrc) {
      const img = imageCacheRef?.current.get(layer.imageSrc)
      if (img) {
        const scale = Math.min(layer.imgW / img.width, layer.imgH / img.height)
        const drawW = img.width * scale
        const drawH = img.height * scale
        ctx.drawImage(img, layer.imgX + (layer.imgW - drawW) / 2, layer.imgY + (layer.imgH - drawH) / 2, drawW, drawH)
      }
    }
    for (const stroke of layer.strokes) drawStroke(ctx, stroke)
    if (layer.id === activeLayerId && currentStroke) drawStroke(ctx, currentStroke)
    ctx.restore()
  }

  return offscreen.toDataURL("image/png")
}

function drawStroke(ctx: CanvasRenderingContext2D, stroke: { points: { x: number; y: number }[]; color: string; width: number; eraser: boolean }) {
  if (stroke.points.length < 2) return
  ctx.beginPath()
  ctx.strokeStyle = stroke.color
  ctx.lineWidth = stroke.width
  ctx.lineCap = "round"
  ctx.lineJoin = "round"
  ctx.globalCompositeOperation = stroke.eraser ? "destination-out" : "source-over"
  ctx.moveTo(stroke.points[0].x, stroke.points[0].y)
  for (let i = 1; i < stroke.points.length; i += 1) ctx.lineTo(stroke.points[i].x, stroke.points[i].y)
  ctx.stroke()
  ctx.globalCompositeOperation = "source-over"
}
