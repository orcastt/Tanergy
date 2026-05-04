'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as Y from 'yjs'
import {
  appendFrameSample,
  createEmptyCanvasDocument,
  createFrameSample,
  getCanvasDiagnosticsSnapshot,
  screenToWorld,
  withCanvasShapes,
  zoomCameraAtScreenPoint,
  type CanvasCamera,
  type CanvasDiagnosticsSnapshot,
  type CanvasDocument,
  type CanvasPoint,
  type CanvasShape,
  type CanvasShapeStyle,
} from '@/features/canvas-engine'
import { CanvasTooltipLayer } from '@/components/canvas/CanvasTooltipLayer'
import { KonvaCanvasDiagnostics } from './KonvaCanvasDiagnostics'
import { KonvaContextMenu, type KonvaContextMenuAction } from './KonvaContextMenu'
import { KonvaCanvasNavigator } from './KonvaCanvasNavigator'
import { KonvaCanvasProperties } from './KonvaCanvasProperties'
import { KonvaCanvasStage } from './KonvaCanvasStage'
import { isKonvaEditableTextShape, KonvaTextEditor, type KonvaEditableTextShape } from './KonvaTextEditor'
import { KonvaCanvasToolbar } from './KonvaCanvasToolbar'
import type { KonvaCanvasTool } from './konvaCanvasTypes'
import { konvaDefaultShapeStyle } from './konvaCanvasStyle'
import { runKonvaContextAction } from './konvaContextActions'
import { createSeedShapes, createStressStrokes } from './konvaSeedShapes'
import { updateTextShape } from './konvaShapeCommands'
import { useKonvaBrowserSelectionGuard } from './useKonvaBrowserSelectionGuard'
import { useKonvaCanvasHistory } from './useKonvaCanvasHistory'
import { useKonvaCanvasShortcuts } from './useKonvaCanvasShortcuts'
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
  const [nextStyle, setNextStyle] = useState<CanvasShapeStyle>(konvaDefaultShapeStyle)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [editingTextId, setEditingTextId] = useState<string | null>(null)
  const [contextMenu, setContextMenu] = useState<{ worldX: number; worldY: number; x: number; y: number } | null>(null)
  const [, setClipboardShapeCount] = useState(0)
  const [diagnostics, setDiagnostics] = useState<CanvasDiagnosticsSnapshot>(() => getCanvasDiagnosticsSnapshot(document))
  const clipboardRef = useRef<CanvasShape[]>([])
  const lastPastePointRef = useRef<CanvasPoint | null>(null)
  const frameSamplesRef = useRef<ReturnType<typeof appendFrameSample>>([])
  const lastFrameRef = useRef(0)
  useKonvaBrowserSelectionGuard(shellRef)
  const history = useKonvaCanvasHistory({
    document,
    onDocumentChange: setDocument,
    onSelectionChange: setSelectedIds,
    selectedIds,
  })

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

  useKonvaCanvasShortcuts({
    clipboardRef,
    document,
    history,
    onClipboardChange: setClipboardShapeCount,
    onDocumentChange: setDocument,
    getPastePoint: () => lastPastePointRef.current ?? screenToWorld({ x: size.width / 2, y: size.height / 2 }, camera),
    onPanningChange: setIsSpacePanning,
    onSelectionChange: setSelectedIds,
    onToolChange: setActiveTool,
    selectedIds,
  })

  const pointCount = useMemo(() => (
    document.shapes.reduce((total, shape) => total + (shape.type === 'stroke' ? shape.props.points.length : 0), 0)
  ), [document.shapes])

  const handleCameraPreview = useCallback((nextCamera: CanvasCamera) => {
    setCamera(nextCamera)
  }, [])

  const handleCameraCommit = useCallback((nextCamera: CanvasCamera) => {
    setCamera(nextCamera)
    setDocument((current) => ({ ...current, camera: nextCamera }))
  }, [])

  const zoomAtCenter = useCallback((factor: number) => {
    handleCameraCommit(zoomCameraAtScreenPoint(camera, { x: size.width / 2, y: size.height / 2 }, camera.zoom * factor, 0.2, 4))
  }, [camera, handleCameraCommit, size.height, size.width])

  const resetZoom = useCallback(() => {
    handleCameraCommit(zoomCameraAtScreenPoint(camera, { x: size.width / 2, y: size.height / 2 }, 1, 0.2, 4))
  }, [camera, handleCameraCommit, size.height, size.width])

  const addStressStrokes = useCallback(() => {
    history.checkpoint()
    setDocument((current) => withCanvasShapes(current, [...current.shapes, ...createStressStrokes(current.shapes.length)]))
  }, [history])

  const clearCanvas = useCallback(() => {
    history.checkpoint()
    setDocument((current) => withCanvasShapes(current, []))
    setSelectedIds([])
  }, [history])
  const editingTextShape = document.shapes.find((shape): shape is KonvaEditableTextShape => shape.id === editingTextId && isKonvaEditableTextShape(shape))
  const runContextAction = (action: KonvaContextMenuAction) => {
    const pastePoint = contextMenu ? { x: contextMenu.worldX, y: contextMenu.worldY } : undefined
    setContextMenu(null)
    void runKonvaContextAction({
      action,
      clipboardRef,
      document,
      history,
      onClipboardChange: setClipboardShapeCount,
      onDocumentChange: setDocument,
      onSelectionChange: setSelectedIds,
      pastePoint,
      selectedIds,
    })
  }

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
      <section
        className="konva-canvas-stage-wrap"
        data-space-panning={isSpacePanning}
        onContextMenu={(event) => {
          event.preventDefault()
          setActiveTool('select')
          const rect = event.currentTarget.getBoundingClientRect()
          const point = { x: event.clientX - rect.left, y: event.clientY - rect.top }
          const world = screenToWorld(point, camera)
          lastPastePointRef.current = world
          setContextMenu({ worldX: world.x, worldY: world.y, x: point.x, y: point.y })
        }}
        onPointerMoveCapture={(event) => {
          const rect = event.currentTarget.getBoundingClientRect()
          lastPastePointRef.current = screenToWorld({ x: event.clientX - rect.left, y: event.clientY - rect.top }, camera)
        }}
        ref={shellRef}
      >
        <KonvaCanvasStage
          activeTool={activeTool}
          camera={camera}
          document={document}
          height={size.height}
          isSpacePanning={isSpacePanning}
          nextStyle={nextStyle}
          onCameraCommit={handleCameraCommit}
          onCameraPreview={handleCameraPreview}
          onDocumentChange={setDocument}
          onDocumentPreview={setDocument}
          onHistoryCheckpoint={history.checkpoint}
          onSelectionChange={setSelectedIds}
          onTextEditStart={(shapeId) => {
            const shape = document.shapes.find((item) => item.id === shapeId)
            if (shape && isKonvaEditableTextShape(shape)) setEditingTextId(shapeId)
          }}
          onToolChange={setActiveTool}
          selectedIds={selectedIds}
          width={size.width}
        />
        {editingTextShape ? (
          <>
            <button aria-label="Finish text editing" className="konva-canvas-text-editor-backdrop" onClick={(event) => event.stopPropagation()} onPointerDown={(event) => event.stopPropagation()} type="button" />
            <KonvaTextEditor
              camera={camera}
              onCancel={() => setEditingTextId(null)}
              onCommit={(text) => {
                history.checkpoint(document)
                setDocument((current) => updateTextShape(current, editingTextShape.id, text))
                setEditingTextId(null)
              }}
              shape={editingTextShape}
            />
          </>
        ) : null}
        <KonvaCanvasProperties
          activeTool={activeTool}
          document={document}
          nextStyle={nextStyle}
          onDocumentChange={setDocument}
          onHistoryCheckpoint={history.checkpoint}
          onNextStyleChange={setNextStyle}
          onSelectionChange={setSelectedIds}
          selectedIds={selectedIds}
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
        {contextMenu ? (
          <KonvaContextMenu
            canPaste
            containerHeight={size.height}
            containerWidth={size.width}
            hasSelection={selectedIds.length > 0}
            multipleSelection={selectedIds.length > 1}
            onAction={runContextAction}
            onClose={() => setContextMenu(null)}
            x={contextMenu.x}
            y={contextMenu.y}
          />
        ) : null}
        <CanvasTooltipLayer />
      </section>
    </main>
  )
}
