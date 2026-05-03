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
  type CanvasFrameShape,
  type CanvasShape,
  type CanvasShapeStyle,
  type CanvasStickyShape,
  type CanvasTextShape,
} from '@/features/canvas-engine'
import { CanvasTooltipLayer } from '@/components/canvas/CanvasTooltipLayer'
import { KonvaCanvasDiagnostics } from './KonvaCanvasDiagnostics'
import { KonvaContextMenu, type KonvaContextMenuAction } from './KonvaContextMenu'
import { KonvaCanvasNavigator } from './KonvaCanvasNavigator'
import { KonvaCanvasProperties } from './KonvaCanvasProperties'
import { KonvaCanvasStage } from './KonvaCanvasStage'
import { KonvaTextEditor } from './KonvaTextEditor'
import { KonvaCanvasToolbar } from './KonvaCanvasToolbar'
import type { KonvaCanvasTool } from './konvaCanvasTypes'
import { deleteKonvaShapes, duplicateKonvaShapes, konvaDefaultShapeStyle, reorderKonvaShapes } from './konvaCanvasStyle'
import { createSeedShapes, createStressStrokes } from './konvaSeedShapes'
import { copyKonvaShapes, pasteKonvaShapes, updateTextShape } from './konvaShapeCommands'
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
  const [clipboardShapeCount, setClipboardShapeCount] = useState(0)
  const [diagnostics, setDiagnostics] = useState<CanvasDiagnosticsSnapshot>(() => getCanvasDiagnosticsSnapshot(document))
  const clipboardRef = useRef<CanvasShape[]>([])
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
    camera,
    clipboardRef,
    document,
    history,
    onClipboardChange: setClipboardShapeCount,
    onDocumentChange: setDocument,
    onPanningChange: setIsSpacePanning,
    onSelectionChange: setSelectedIds,
    onToolChange: setActiveTool,
    selectedIds,
    size,
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
  const editingTextShape = document.shapes.find((shape): shape is CanvasFrameShape | CanvasStickyShape | CanvasTextShape => (
    shape.id === editingTextId && (shape.type === 'text' || shape.type === 'sticky' || shape.type === 'frame')
  ))
  const runContextAction = (action: KonvaContextMenuAction) => {
    setContextMenu(null)
    if (action === 'select-all') {
      setSelectedIds(document.shapes.map((shape) => shape.id))
      return
    }
    if (action === 'copy') {
      clipboardRef.current = copyKonvaShapes(document, selectedIds)
      setClipboardShapeCount(clipboardRef.current.length)
      return
    }
    if (action === 'paste') {
      history.checkpoint(document)
      const result = pasteKonvaShapes(document, clipboardRef.current, contextMenu ? { x: contextMenu.worldX, y: contextMenu.worldY } : undefined)
      setDocument(result.document)
      setSelectedIds(result.selectedIds)
      return
    }
    if (selectedIds.length === 0) return
    history.checkpoint(document)
    if (action === 'delete') {
      const result = deleteKonvaShapes(document, selectedIds)
      setDocument(result.document)
      setSelectedIds(result.selectedIds)
    } else if (action === 'duplicate') {
      const result = duplicateKonvaShapes(document, selectedIds)
      setDocument(result.document)
      setSelectedIds(result.selectedIds)
    } else {
      const layerAction = getContextLayerAction(action)
      if (layerAction) setDocument(reorderKonvaShapes(document, selectedIds, layerAction))
    }
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
          setContextMenu({ worldX: world.x, worldY: world.y, x: point.x, y: point.y })
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
            if (shape?.type === 'text' || shape?.type === 'sticky' || shape?.type === 'frame') setEditingTextId(shapeId)
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
            canPaste={clipboardShapeCount > 0}
            hasSelection={selectedIds.length > 0}
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

function getContextLayerAction(action: KonvaContextMenuAction): Parameters<typeof reorderKonvaShapes>[2] | null {
  if (action === 'layer-back') return 'back'
  if (action === 'layer-backward') return 'backward'
  if (action === 'layer-forward') return 'forward'
  if (action === 'layer-front') return 'front'
  return null
}
