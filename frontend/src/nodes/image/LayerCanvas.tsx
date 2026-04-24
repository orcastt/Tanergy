import { useRef, useEffect, useCallback, useState } from "react"
import { useLayerStore, type Layer, GRID_SIZE } from "./layerStore"
import { imageCache } from "./SourcePanel"

let _canvasEl: HTMLCanvasElement | null = null
export function getCanvasElement(): HTMLCanvasElement | null { return _canvasEl }
let _canvasSize = { w: 800, h: 600 }
export function getCanvasSize() { return _canvasSize }

function drawStroke(ctx: CanvasRenderingContext2D, stroke: { points: { x: number; y: number }[]; color: string; width: number; eraser: boolean }) {
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

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

// Hit test: check if point is inside a layer's image rect
function hitTestLayer(layer: Layer, x: number, y: number): boolean {
  if (!layer.imageSrc) return false
  return x >= layer.imgX && x <= layer.imgX + layer.imgW && y >= layer.imgY && y <= layer.imgY + layer.imgH
}

// Check if point is on resize handle (bottom-right corner)
function hitTestResizeHandle(layer: Layer, x: number, y: number): boolean {
  if (!layer.imageSrc) return false
  const hx = layer.imgX + layer.imgW
  const hy = layer.imgY + layer.imgH
  return Math.abs(x - hx) < 10 && Math.abs(y - hy) < 10
}

export default function LayerCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [canvasSize, setCanvasSize] = useState({ w: 800, h: 600 })
  const {
    layers, activeLayerId, currentStroke, tool, showGrid,
    startStroke, addPoint, endStroke,
    addImageLayer, setActive,
    startDrag, updateDrag, endDrag,
  } = useLayerStore()
  const imageCacheRef = useRef<Map<string, HTMLImageElement>>(new Map())

  // Track natural dimensions of loaded images
  useEffect(() => {
    for (const layer of layers) {
      if (layer.imageSrc && !imageCacheRef.current.has(layer.imageSrc)) {
        loadImage(layer.imageSrc).then((img) => {
          imageCacheRef.current.set(layer.imageSrc!, img)
          // Update natural dimensions
          if (layer.naturalW === 0) {
            useLayerStore.getState().updateLayerImage(layer.id, {
              naturalW: img.width, naturalH: img.height,
            })
          }
        })
      }
    }
  }, [layers])

  // Sync refs
  useEffect(() => {
    _canvasEl = canvasRef.current
    return () => { _canvasEl = null }
  })

  // Responsive
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect
      if (width > 0 && height > 0) {
        const size = { w: Math.floor(width), h: Math.floor(height) }
        setCanvasSize(size)
        _canvasSize = size
      }
    })
    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  // Render
  const render = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    const { w, h } = canvasSize
    ctx.clearRect(0, 0, w, h)

    // White background
    ctx.fillStyle = "#ffffff"
    ctx.fillRect(0, 0, w, h)

    // Grid
    if (showGrid) {
      ctx.strokeStyle = "#e5e5e5"
      ctx.lineWidth = 0.5
      for (let x = 0; x <= w; x += GRID_SIZE) {
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, h)
        ctx.stroke()
      }
      for (let y = 0; y <= h; y += GRID_SIZE) {
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(w, y)
        ctx.stroke()
      }
    }

    // Render layers bottom to top
    for (const layer of layers) {
      if (!layer.visible) continue
      ctx.save()
      ctx.globalAlpha = layer.opacity

      // Draw image at its position/size (contain within rect, no stretch)
      if (layer.imageSrc) {
        const img = imageCacheRef.current.get(layer.imageSrc)
        if (img) {
          const scale = Math.min(layer.imgW / img.width, layer.imgH / img.height)
          const drawW = img.width * scale
          const drawH = img.height * scale
          const drawX = layer.imgX + (layer.imgW - drawW) / 2
          const drawY = layer.imgY + (layer.imgH - drawH) / 2
          ctx.drawImage(img, drawX, drawY, drawW, drawH)
        }
      }

      // Draw strokes (offset by layer image position if needed)
      for (const stroke of layer.strokes) drawStroke(ctx, stroke)
      if (layer.id === activeLayerId && currentStroke) drawStroke(ctx, currentStroke)

      ctx.restore()
    }

    // Selection indicator for active layer with image
    if (activeLayerId && tool === "select") {
      const active = layers.find((l) => l.id === activeLayerId)
      if (active && active.imageSrc) {
        ctx.save()
        ctx.strokeStyle = "#3B82F6"
        ctx.lineWidth = 2
        ctx.setLineDash([6, 3])
        ctx.strokeRect(active.imgX, active.imgY, active.imgW, active.imgH)
        ctx.setLineDash([])

        // Resize handle (bottom-right)
        const hx = active.imgX + active.imgW
        const hy = active.imgY + active.imgH
        ctx.fillStyle = "#3B82F6"
        ctx.fillRect(hx - 5, hy - 5, 10, 10)

        ctx.restore()
      }
    }
  }, [layers, activeLayerId, currentStroke, canvasSize, tool, showGrid])

  useEffect(() => { render() }, [render])

  // Re-render after image load
  useEffect(() => {
    const load = async () => {
      for (const layer of layers) {
        if (layer.imageSrc && !imageCacheRef.current.has(layer.imageSrc)) {
          try { imageCacheRef.current.set(layer.imageSrc, await loadImage(layer.imageSrc)) } catch {}
        }
      }
      render()
    }
    load()
  }, [layers, render])

  function getPos(e: React.MouseEvent | React.TouchEvent) {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvasSize.w / rect.width
    const scaleY = canvasSize.h / rect.height
    if ("touches" in e) {
      const t = e.touches[0]
      return { x: (t.clientX - rect.left) * scaleX, y: (t.clientY - rect.top) * scaleY }
    }
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY }
  }

  function handleDown(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault()
    const pos = getPos(e)

    if (tool === "select") {
      // Check resize handle first (active layer)
      const active = layers.find((l) => l.id === activeLayerId)
      if (active && hitTestResizeHandle(active, pos.x, pos.y)) {
        startDrag({ type: "resize", startX: pos.x, startY: pos.y, origX: active.imgX, origY: active.imgY, origW: active.imgW, origH: active.imgH })
        return
      }
      // Check move (active layer image area)
      if (active && active.imageSrc && hitTestLayer(active, pos.x, pos.y)) {
        startDrag({ type: "move", startX: pos.x, startY: pos.y, origX: active.imgX, origY: active.imgY, origW: active.imgW, origH: active.imgH })
        return
      }
      // Check other layers (top-most first) to select
      for (let i = layers.length - 1; i >= 0; i--) {
        if (hitTestLayer(layers[i], pos.x, pos.y)) {
          setActive(layers[i].id)
          startDrag({ type: "move", startX: pos.x, startY: pos.y, origX: layers[i].imgX, origY: layers[i].imgY, origW: layers[i].imgW, origH: layers[i].imgH })
          return
        }
      }
      return
    }

    // Draw mode
    startStroke(pos.x, pos.y)
  }

  function handleMove(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault()
    const pos = getPos(e)
    const { dragState } = useLayerStore.getState()
    if (dragState) {
      updateDrag(pos.x, pos.y)
      return
    }
    if (tool === "draw") addPoint(pos.x, pos.y)
  }

  function handleUp(_e?: React.MouseEvent | React.TouchEvent) {
    const { dragState } = useLayerStore.getState()
    if (dragState) { endDrag(); return }
    if (tool === "draw") endStroke()
  }

  // Drop — use imageCache lookup instead of transferring base64
  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    const imageId = e.dataTransfer.getData("text/image-id")
    const src = imageId ? imageCache.get(imageId) : e.dataTransfer.getData("text/image-src")
    if (src) {
      const { w, h } = canvasSize
      addImageLayer(src, undefined, w, h)
    }
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    e.dataTransfer.dropEffect = "copy"
  }

  const isDragMode = useLayerStore.getState().dragState !== null

  return (
    <div
      ref={containerRef}
      style={{ flex: 1, overflow: "hidden", background: "#ffffff", position: "relative" }}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
    >
      <canvas
        ref={canvasRef}
        width={canvasSize.w}
        height={canvasSize.h}
        style={{
          width: "100%", height: "100%", display: "block",
          cursor: tool === "select" ? (isDragMode ? "grabbing" : "default") : (useLayerStore.getState().eraser ? "cell" : "crosshair"),
          touchAction: "none",
        }}
        onMouseDown={handleDown}
        onMouseMove={handleMove}
        onMouseUp={handleUp}
        onMouseLeave={handleUp}
        onTouchStart={handleDown}
        onTouchMove={handleMove}
        onTouchEnd={handleUp}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragEnter={(e) => { e.preventDefault() }}
      />
    </div>
  )
}
