'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import * as Y from 'yjs'
import { createEmptyCanvasDocument, screenToWorld, type CanvasCamera, type CanvasDocument, type CanvasNodeShape, type CanvasPoint, type CanvasShape, type CanvasShapeStyle } from '@/features/canvas-engine'
import { CanvasTooltipLayer } from '@/components/canvas/CanvasTooltipLayer'
import { KonvaCanvasHeader } from './KonvaCanvasHeader'
import { KonvaCanvasDiagnostics } from './KonvaCanvasDiagnostics'
import type { KonvaContextMenuAction } from './KonvaContextMenu'
import { KonvaContextMenuHost } from './KonvaContextMenuHost'
import { KonvaCanvasNavigator } from './KonvaCanvasNavigator'
import { KonvaCanvasProperties } from './KonvaCanvasProperties'
import { KonvaCanvasStage } from './KonvaCanvasStage'
import { isKonvaEditableTextShape, KonvaTextEditor, type KonvaEditableTextShape } from './KonvaTextEditor'
import { getEditableKonvaNodeTextField, KonvaNodeTextEditor, type KonvaNodeTextFieldName } from './KonvaNodeTextEditor'
import { KonvaCanvasToolbar } from './KonvaCanvasToolbar'
import { KonvaNodeCreateMenu } from './KonvaNodeCreateMenu'
import type { KonvaCanvasTool } from './konvaCanvasTypes'
import { konvaDefaultShapeStyle } from './konvaCanvasStyle'
import { runKonvaContextAction } from './konvaContextActions'
import { createSeedShapes } from './konvaSeedShapes'
import { KonvaSelectionToolbar } from './KonvaSelectionToolbar'
import { updateTextShape } from './konvaShapeCommands'
import { useKonvaBrowserSelectionGuard } from './useKonvaBrowserSelectionGuard'
import { useKonvaCanvasControls } from './useKonvaCanvasControls'
import { useKonvaCanvasHistory } from './useKonvaCanvasHistory'
import { useKonvaCanvasMetrics } from './useKonvaCanvasMetrics'
import { useKonvaCanvasShortcuts } from './useKonvaCanvasShortcuts'
import { useKonvaImageNodeActions } from './useKonvaImageNodeActions'
import { useKonvaImageNodeUpload } from './useKonvaImageNodeUpload'
import { useKonvaNodeCreationMenu } from './useKonvaNodeCreationMenu'
import { useKonvaStageDomEvents } from './useKonvaStageDomEvents'
import { removeKonvaRuntimeEdge } from './konvaRuntimeEdges'
export function KonvaCanvasSpike() {
  const shellRef = useRef<HTMLDivElement | null>(null)
  const [ydoc] = useState(() => new Y.Doc())
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
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null)
  const [editingTextId, setEditingTextId] = useState<string | null>(null)
  const [editingNodeText, setEditingNodeText] = useState<{ fieldName: KonvaNodeTextFieldName; shapeId: string } | null>(null)
  const [contextMenu, setContextMenu] = useState<{ worldX: number; worldY: number; x: number; y: number } | null>(null)
  const [, setClipboardShapeCount] = useState(0)
  const clipboardRef = useRef<CanvasShape[]>([])
  const lastPastePointRef = useRef<CanvasPoint | null>(null)
  const handleSelectionChange = useCallback((shapeIds: string[]) => {
    setSelectedIds(shapeIds)
    if (shapeIds.length > 0) setSelectedEdgeId(null)
  }, [])
  useKonvaBrowserSelectionGuard(shellRef)
  const { diagnostics, setShellRect, shellRect, size } = useKonvaCanvasMetrics({
    document,
    shellRef,
    ydoc,
  })
  const history = useKonvaCanvasHistory({
    document,
    onDocumentChange: setDocument,
    onSelectionChange: handleSelectionChange,
    selectedIds,
  })
  const { closeNodeMenu, createNodeCard, nodeMenu, openNodeMenu, setNodeField, setNodeTextField, toggleNodeRun } = useKonvaNodeCreationMenu({
    camera,
    document,
    history,
    lastPastePointRef,
    onDocumentChange: setDocument,
    onEdgeSelectionChange: setSelectedEdgeId,
    onSelectionChange: handleSelectionChange,
    onToolChange: setActiveTool,
    size,
  })
  const { fileInput, promptImageNodeUpload, uploadDropFileAtPoint } = useKonvaImageNodeUpload({
    document,
    history,
    onDocumentChange: setDocument,
    onSelectionChange: handleSelectionChange,
    selectedIds,
  })
  const stageDomEvents = useKonvaStageDomEvents({
    camera,
    document,
    lastPastePointRef,
    nodeMenuOpen: Boolean(nodeMenu),
    onCanvasDoubleClick: openNodeMenu,
    onContextMenuChange: setContextMenu,
    onNodeMenuClose: closeNodeMenu,
    onSelectionChange: handleSelectionChange,
    onShellRectChange: setShellRect,
    onToolChange: setActiveTool,
    onUploadDropFileAtPoint: uploadDropFileAtPoint,
    selectedIds,
  })

  useKonvaCanvasShortcuts({
    clipboardRef,
    document,
    history,
    onClipboardChange: setClipboardShapeCount,
    onDocumentChange: setDocument,
    getPastePoint: () => lastPastePointRef.current ?? screenToWorld({ x: size.width / 2, y: size.height / 2 }, camera),
    onPanningChange: setIsSpacePanning,
    onSelectionChange: handleSelectionChange,
    onToolChange: setActiveTool,
    selectedIds,
  })

  const pointCount = useMemo(() => (
    document.shapes.reduce((total, shape) => total + (shape.type === 'stroke' ? shape.props.points.length : 0), 0)
  ), [document.shapes])
  const selectedShapes = useMemo(() => {
    const selected = new Set(selectedIds)
    return document.shapes.filter((shape) => selected.has(shape.id))
  }, [document.shapes, selectedIds])
  const canLockSelection = selectedShapes.some((shape) => !shape.isLocked)
  const canUnlockSelection = selectedShapes.some((shape) => shape.isLocked)
  const { canConvertImageToNode, canNodeToCanvas, convertImageToNode, sendImageNodeToCanvas } = useKonvaImageNodeActions({
    document,
    history,
    onDocumentChange: setDocument,
    onSelectionChange: handleSelectionChange,
    selectedIds,
  })
  const { addStressStrokes, clearCanvas, handleCameraCommit, handleCameraPreview, resetZoom, zoomAtCenter } = useKonvaCanvasControls({
    camera,
    history,
    onCameraChange: setCamera,
    onDocumentChange: setDocument,
    onEdgeSelectionChange: setSelectedEdgeId,
    onSelectionChange: handleSelectionChange,
    size,
  })

  const editingTextShape = document.shapes.find((shape): shape is KonvaEditableTextShape => shape.id === editingTextId && isKonvaEditableTextShape(shape))
  const editingNodeTextShape = editingNodeText
    ? document.shapes.find((shape): shape is CanvasNodeShape => shape.id === editingNodeText.shapeId && shape.type === 'node_card')
    : null
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
      onSelectionChange: handleSelectionChange,
      pastePoint,
      selectedIds,
    })
  }

  return (
    <main className="konva-canvas-shell">
      <KonvaCanvasHeader ydocId={ydoc.guid.slice(0, 8)} />
      <KonvaCanvasToolbar
        activeTool={activeTool}
        onAddStressStrokes={addStressStrokes}
        onClear={clearCanvas}
        onCreateNode={createNodeCard}
        onToolChange={setActiveTool}
      />
      <section
        className="konva-canvas-stage-wrap"
        data-space-panning={isSpacePanning}
        onContextMenu={stageDomEvents.handleContextMenu}
        onDoubleClick={stageDomEvents.handleDoubleClick}
        onDragOver={stageDomEvents.handleDragOver}
        onDrop={stageDomEvents.handleDrop}
        onPointerDownCapture={stageDomEvents.handlePointerDownCapture}
        onPointerMoveCapture={stageDomEvents.handlePointerMoveCapture}
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
          onEdgeDisconnect={(edgeId) => {
            history.checkpoint(document)
            setDocument((current) => removeKonvaRuntimeEdge(current, edgeId))
            setSelectedEdgeId(null)
          }}
          onEdgeSelect={(edgeId) => {
            setSelectedEdgeId(edgeId)
            handleSelectionChange([])
          }}
          onHistoryCheckpoint={history.checkpoint}
          onNodeFieldChange={setNodeField}
          onNodeRunToggle={toggleNodeRun}
          onSelectionChange={handleSelectionChange}
          onTextEditStart={(shapeId) => {
            const shape = document.shapes.find((item) => item.id === shapeId)
            if (shape?.type === 'node_card' && shape.props.nodeType === 'image') {
              promptImageNodeUpload(shapeId)
              return
            }
            if (shape?.type === 'node_card') {
              const fieldName = getEditableKonvaNodeTextField(shape)
              if (fieldName) {
                setEditingNodeText({ fieldName, shapeId })
                return
              }
            }
            if (shape && isKonvaEditableTextShape(shape)) setEditingTextId(shapeId)
          }}
          onToolChange={setActiveTool}
          selectedIds={selectedIds}
          selectedEdgeId={selectedEdgeId}
          width={size.width}
        />
        {nodeMenu ? (
          <KonvaNodeCreateMenu
            onCreateNode={(type) => createNodeCard(type, nodeMenu.world)}
            style={{ left: nodeMenu.x, top: nodeMenu.y }}
          />
        ) : null}
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
        {editingNodeText && editingNodeTextShape ? (
          <>
            <button aria-label="Finish node text editing" className="konva-canvas-text-editor-backdrop" onClick={(event) => event.stopPropagation()} onPointerDown={(event) => event.stopPropagation()} type="button" />
            <KonvaNodeTextEditor
              camera={camera}
              fieldName={editingNodeText.fieldName}
              onCancel={() => setEditingNodeText(null)}
              onCommit={(value) => {
                setNodeTextField(editingNodeTextShape.id, editingNodeText.fieldName, value)
                setEditingNodeText(null)
              }}
              shape={editingNodeTextShape}
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
          onSelectionChange={handleSelectionChange}
          selectedIds={selectedIds}
        />
        <KonvaSelectionToolbar
          camera={camera}
          canConvertImageToNode={canConvertImageToNode}
          canNodeToCanvas={canNodeToCanvas}
          document={document}
          onCaptureSelection={() => undefined}
          onConvertImageToNode={convertImageToNode}
          onNodeToCanvas={sendImageNodeToCanvas}
          selectedIds={selectedIds}
          shellRect={shellRect}
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
        <KonvaContextMenuHost
          canLockSelection={canLockSelection}
          canUnlockSelection={canUnlockSelection}
          contextMenu={contextMenu}
          document={document}
          height={size.height}
          onAction={runContextAction}
          onClose={() => setContextMenu(null)}
          selectedIds={selectedIds}
          width={size.width}
        />
        <CanvasTooltipLayer />
        {fileInput}
      </section>
    </main>
  )
}
