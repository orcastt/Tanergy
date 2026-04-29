import { useRef, useEffect, useCallback } from "react"
import { useDrawingStore } from "./drawingStore"

interface Props {
  backgroundImage: string | null
  width: number
  height: number
}

export default function DrawingCanvas({ backgroundImage, width, height }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { strokes, currentStroke, startStroke, addPoint, endStroke } = useDrawingStore()

  const draw = useCallback((ctx: CanvasRenderingContext2D) => {
    ctx.clearRect(0, 0, width, height)

    // Draw background image
    if (backgroundImage) {
      const img = new Image()
      img.src = backgroundImage
      ctx.drawImage(img, 0, 0, width, height)
    }

    // Draw completed strokes
    for (const stroke of strokes) {
      drawStroke(ctx, stroke)
    }

    // Draw current stroke
    if (currentStroke) {
      drawStroke(ctx, currentStroke)
    }
  }, [strokes, currentStroke, backgroundImage, width, height])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    draw(ctx)
  }, [draw])

  // Load background image and redraw
  useEffect(() => {
    if (!backgroundImage) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    const img = new Image()
    img.onload = () => {
      ctx.drawImage(img, 0, 0, width, height)
    }
    img.src = backgroundImage
  }, [backgroundImage, width, height])

  function getPos(e: React.MouseEvent | React.TouchEvent) {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    const scaleX = width / rect.width
    const scaleY = height / rect.height
    if ("touches" in e) {
      const t = e.touches[0]
      return { x: (t.clientX - rect.left) * scaleX, y: (t.clientY - rect.top) * scaleY }
    }
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY }
  }

  function handleDown(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault()
    const pos = getPos(e)
    startStroke(pos.x, pos.y)
  }

  function handleMove(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault()
    const pos = getPos(e)
    addPoint(pos.x, pos.y)
  }

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{ width: "100%", height: "100%", cursor: useDrawingStore.getState().eraser ? "cell" : "crosshair", touchAction: "none" }}
      onMouseDown={handleDown}
      onMouseMove={handleMove}
      onMouseUp={endStroke}
      onMouseLeave={endStroke}
      onTouchStart={handleDown}
      onTouchMove={handleMove}
      onTouchEnd={endStroke}
    />
  )
}

function drawStroke(ctx: CanvasRenderingContext2D, stroke: { points: { x: number; y: number }[]; color: string; width: number; eraser: boolean }) {
  if (stroke.points.length < 2) return
  ctx.beginPath()
  ctx.strokeStyle = stroke.color
  ctx.lineWidth = stroke.width
  ctx.lineCap = "round"
  ctx.lineJoin = "round"
  if (stroke.eraser) ctx.globalCompositeOperation = "destination-out"
  else ctx.globalCompositeOperation = "source-over"
  ctx.moveTo(stroke.points[0].x, stroke.points[0].y)
  for (let i = 1; i < stroke.points.length; i++) {
    ctx.lineTo(stroke.points[i].x, stroke.points[i].y)
  }
  ctx.stroke()
  ctx.globalCompositeOperation = "source-over"
}
