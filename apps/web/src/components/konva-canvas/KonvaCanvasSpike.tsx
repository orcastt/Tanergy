'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as Y from 'yjs'
import {
  appendFrameSample,
  createEmptyCanvasDocument,
  createFrameSample,
  getCanvasDiagnosticsSnapshot,
  withCanvasShapes,
  zoomCameraAtScreenPoint,
  type CanvasCamera,
  type CanvasDiagnosticsSnapshot,
  type CanvasDocument,
  type CanvasShape,
} from '@/features/canvas-engine'
import { KonvaCanvasDiagnostics } from './KonvaCanvasDiagnostics'
import { KonvaCanvasNavigator } from './KonvaCanvasNavigator'
import { KonvaCanvasStage } from './KonvaCanvasStage'
import { KonvaCanvasToolbar } from './KonvaCanvasToolbar'
import { konvaToolShortcuts, type KonvaCanvasTool } from './konvaCanvasTypes'

export function KonvaCanvasSpike() {
  const shellRef = useRef<HTMLDivElement | null>(null)
  const [ydoc] = useState(() => new Y.Doc())
  const [size, setSize] = useState({ height: 720, width: 1280 })
  const [document, setDocument] = useState<CanvasDocument>(() => createEmptyCanvasDocument({
    camera: { x: 120, y: 112, zoom: 1 },
    name: 'Konva handfeel spike',
    shapes: createSeedShapes(),
  }))
  const [camera, setCamera] = useState<CanvasCamera>(document.camera)
  const [activeTool, setActiveTool] = useState<KonvaCanvasTool>('select')
  const [isSpacePanning, setIsSpacePanning] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [diagnostics, setDiagnostics] = useState<CanvasDiagnosticsSnapshot>(() => getCanvasDiagnosticsSnapshot(document))
  const frameSamplesRef = useRef<ReturnType<typeof appendFrameSample>>([])
  const lastFrameRef = useRef(0)

  useEffect(() => {
    const element = shellRef.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) => {
      setSize({
        height: Math.max(480, entry.contentRect.height),
        width: Math.max(720, entry.contentRect.width),
      })
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    let frame = 0
    const tick = (time: number) => {
      if (lastFrameRef.current > 0) {
        frameSamplesRef.current = appendFrameSample(frameSamplesRef.current, createFrameSample(lastFrameRef.current, time), 120)
      }
      lastFrameRef.current = time
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [])

  useEffect(() => {
    const timer = window.setInterval(() => {
      setDiagnostics(getCanvasDiagnosticsSnapshot(document, frameSamplesRef.current))
      ydoc.getMap('meta').set('lastObjectCount', document.shapes.length)
    }, 500)
    return () => window.clearInterval(timer)
  }, [document, ydoc])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) return
      if (event.code === 'Space') {
        event.preventDefault()
        setIsSpacePanning(true)
        return
      }
      if (event.key === 'Escape') {
        setActiveTool('select')
        setIsSpacePanning(false)
        return
      }
      const tool = getShortcutTool(event.key)
      if (tool && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault()
        setActiveTool(tool)
      }
    }

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.code === 'Space') setIsSpacePanning(false)
    }
    const handleBlur = () => setIsSpacePanning(false)

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    window.addEventListener('blur', handleBlur)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      window.removeEventListener('blur', handleBlur)
    }
  }, [])

  const pointCount = useMemo(() => (
    document.shapes.reduce((total, shape) => total + (shape.type === 'stroke' ? shape.props.points.length : 0), 0)
  ), [document.shapes])

  const handleCameraChange = useCallback((nextCamera: CanvasCamera) => {
    setCamera(nextCamera)
    setDocument((current) => ({ ...current, camera: nextCamera }))
  }, [])

  const zoomAtCenter = useCallback((factor: number) => {
    handleCameraChange(zoomCameraAtScreenPoint(camera, { x: size.width / 2, y: size.height / 2 }, camera.zoom * factor, 0.2, 4))
  }, [camera, handleCameraChange, size.height, size.width])

  const resetZoom = useCallback(() => {
    handleCameraChange(zoomCameraAtScreenPoint(camera, { x: size.width / 2, y: size.height / 2 }, 1, 0.2, 4))
  }, [camera, handleCameraChange, size.height, size.width])

  const addStressStrokes = useCallback(() => {
    setDocument((current) => withCanvasShapes(current, [...current.shapes, ...createStressStrokes(current.shapes.length)]))
  }, [])

  const clearCanvas = useCallback(() => {
    setDocument((current) => withCanvasShapes(current, []))
    setSelectedIds([])
  }, [])

  return (
    <main className="konva-canvas-shell">
      <header className="konva-canvas-header">
        <Link aria-label="Back to workspace" className="konva-canvas-back" href="/workspaces" title="Back to workspace" />
        <Link className="konva-canvas-logo" href="/home" title="TANGENT home">TANGENT</Link>
        <div className="konva-canvas-title">
          <span>S1X Konva handfeel spike</span>
          <small>tldraw parity reference, Yjs doc ready: {ydoc.guid.slice(0, 8)}</small>
        </div>
      </header>
      <KonvaCanvasToolbar
        activeTool={activeTool}
        onAddStressStrokes={addStressStrokes}
        onClear={clearCanvas}
        onToolChange={setActiveTool}
      />
      <section className="konva-canvas-stage-wrap" data-space-panning={isSpacePanning} ref={shellRef}>
        <KonvaCanvasStage
          activeTool={activeTool}
          camera={camera}
          document={document}
          height={size.height}
          isSpacePanning={isSpacePanning}
          onCameraChange={handleCameraChange}
          onDocumentChange={setDocument}
          onSelectionChange={setSelectedIds}
          selectedIds={selectedIds}
          width={size.width}
        />
        <KonvaCanvasNavigator
          camera={camera}
          document={document}
          onZoomIn={() => zoomAtCenter(1.12)}
          onZoomOut={() => zoomAtCenter(0.88)}
          onZoomReset={resetZoom}
          stageHeight={size.height}
          stageWidth={size.width}
        />
        <KonvaCanvasDiagnostics diagnostics={diagnostics} pointCount={pointCount} zoom={camera.zoom} />
      </section>
    </main>
  )
}

function getShortcutTool(key: string): KonvaCanvasTool | null {
  const normalizedKey = key.toUpperCase()
  return (Object.keys(konvaToolShortcuts) as KonvaCanvasTool[]).find((tool) => konvaToolShortcuts[tool] === normalizedKey) ?? null
}

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) return false
  return Boolean(target.closest('input, textarea, select, [contenteditable="true"], [contenteditable="plaintext-only"]'))
}

function createSeedShapes(): CanvasShape[] {
  return [
    { id: 'seed-rect', props: { height: 128, width: 188 }, style: { fill: '#ffffff', stroke: '#263342', strokeWidth: 2 }, type: 'rect', x: 80, y: 80 },
    { id: 'seed-cloud', props: { height: 124, width: 216 }, style: { fill: 'rgba(238, 243, 255, 0.9)', stroke: '#6b5cff', strokeWidth: 2 }, type: 'cloud', x: 340, y: 120 },
    { id: 'seed-arrow', props: { end: { x: 180, y: 80 } }, style: { stroke: '#243142', strokeWidth: 2 }, type: 'arrow', x: 610, y: 170 },
    { id: 'seed-text', props: { height: 80, text: 'Draw here', width: 220 }, style: { stroke: '#243142', strokeWidth: 2 }, type: 'text', x: 860, y: 160 },
  ]
}

function createStressStrokes(offset: number): CanvasShape[] {
  return Array.from({ length: 1000 }, (_, index) => {
    const x = 80 + (index % 50) * 28
    const y = 380 + Math.floor(index / 50) * 16
    return {
      id: `stress-${offset}-${index}`,
      props: {
        points: [
          { x: 0, y: 0, pressure: 0.42 },
          { x: 8, y: Math.sin(index) * 5, pressure: 0.56 },
          { x: 18, y: Math.cos(index * 0.6) * 7, pressure: 0.52 },
          { x: 32, y: Math.sin(index * 0.3) * 4, pressure: 0.46 },
        ],
      },
      style: { opacity: 0.82, stroke: index % 3 === 0 ? '#6b5cff' : '#243142', strokeWidth: 1.6 },
      type: 'stroke' as const,
      x,
      y,
    }
  })
}
