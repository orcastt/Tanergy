import type { Layer, Stroke } from "./layerStore"

export function drawStroke(ctx: CanvasRenderingContext2D, stroke: Stroke) {
  if (stroke.points.length < 2) return
  ctx.beginPath()
  ctx.strokeStyle = stroke.color
  ctx.lineWidth = stroke.width
  ctx.lineCap = "round"
  ctx.lineJoin = "round"
  ctx.globalCompositeOperation = stroke.eraser ? "destination-out" : "source-over"
  ctx.moveTo(stroke.points[0].x, stroke.points[0].y)
  for (let i = 1; i < stroke.points.length; i++) ctx.lineTo(stroke.points[i].x, stroke.points[i].y)
  ctx.stroke()
  ctx.globalCompositeOperation = "source-over"
}

export function loadCanvasImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

export function hitTestLayer(layer: Layer, x: number, y: number): boolean {
  if (!layer.imageSrc) return false
  return x >= layer.imgX && x <= layer.imgX + layer.imgW && y >= layer.imgY && y <= layer.imgY + layer.imgH
}

export function hitTestResizeHandle(layer: Layer, x: number, y: number): boolean {
  if (!layer.imageSrc) return false
  const hx = layer.imgX + layer.imgW
  const hy = layer.imgY + layer.imgH
  return Math.abs(x - hx) < 10 && Math.abs(y - hy) < 10
}
