'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowShapeUtil, Tldraw, type Editor, type TLAnyShapeUtilConstructor, type TLComponents } from 'tldraw'
import { CanvasNodeInspector } from '@/components/inspector/CanvasNodeInspector'
import { NodeCardShapeUtil } from '@/components/nodes/NodeCardShape'
import { useCanvasPerformanceStore } from '@/features/canvas-performance/canvasPerformanceStore'
import { useCanvasPerformanceTracking } from '@/features/canvas-performance/useCanvasPerformanceTracking'
import { createNodeCard } from '@/features/node-runtime/createNodeCard'
import { createStep15MockGraph, createStep15StressNodes } from '@/features/node-runtime/createMockWorkflow'
import { spikeNodeImageMaxBytes } from '@/features/node-runtime/imageNodeAssets'
import { useNodeConnectionValidation } from '@/features/node-runtime/useNodeConnectionValidation'
import type { NodeType } from '@/types/nodeRuntime'
import { AiCardShapeUtil } from './AiCardShape'
import { CanvasArrowPortOverlay } from './CanvasArrowPortOverlay'
import { CanvasBoardSaveAudit } from './CanvasBoardSaveAudit'
import { CanvasImageShapeUtil } from './CanvasImageShapeUtil'
import { CanvasConnectionCutOverlay } from './CanvasConnectionCutOverlay'
import { CanvasConnectionLine } from './CanvasConnectionLine'
import { CanvasGrid } from './CanvasGrid'
import { CanvasNodeEdgeOverlay } from './CanvasNodeEdgeOverlay'
import { CanvasNodePicker } from './CanvasNodePicker'
import { CanvasRuntimeDiagnostics, CanvasRuntimeErrorBoundary } from './CanvasRuntimeDiagnostics'
import { CanvasSelectionToolbar } from './CanvasSelectionToolbar'
import { CanvasSettingsControl } from './CanvasSettingsControl'
import { CanvasSpikeNavigator } from './CanvasSpikeNavigator'
import { CanvasSpikeStylePanel } from './CanvasSpikeStylePanel'
import { CanvasSpikeToolbar } from './CanvasSpikeToolbar'
import {
  createAiCards,
  createBoardKit,
  createLinkCard,
  createSampleImage,
  createShapeSet,
  seedCanvasSpike,
} from './canvasSeed'
import { useArrowPortSnapping } from './useArrowPortSnapping'
import { useCanvasSettings } from './useCanvasSettings'
import { usePortConnectionCompletion } from './usePortConnectionCompletion'

const shapeUtils = [
  AiCardShapeUtil,
  CanvasImageShapeUtil,
  NodeCardShapeUtil,
  ArrowShapeUtil.configure({
    arcArrowCenterSnapDistance: 0,
    hoverPreciseTimeout: 0,
    pointingPreciseTimeout: 0,
  }),
] satisfies TLAnyShapeUtilConstructor[]
const spikeAcceptedImageMimeTypes = ['image/png', 'image/jpeg', 'image/webp']
const spikeMaxImageDimension = getAdaptiveImageMaxDimension()

const tldrawComponents = {
  ActionsMenu: null,
  DebugMenu: null,
  DebugPanel: null,
  Grid: CanvasGrid,
  HelpMenu: null,
  HelperButtons: null,
  ImageToolbar: null,
  MainMenu: null,
  MenuPanel: null,
  Minimap: null,
  NavigationPanel: null,
  PageMenu: null,
  QuickActions: null,
  RichTextToolbar: null,
  SharePanel: null,
  StylePanel: null,
  Toolbar: null,
  VideoToolbar: null,
  ZoomMenu: null,
} satisfies TLComponents

const canvasRuntimeDiagnosticsEnabled = process.env.NEXT_PUBLIC_CANVAS_RUNTIME_DIAGNOSTICS === '1'

type CanvasSpikeProps = {
  autoLoadBoard?: boolean
  boardId?: string
  boardTitle?: string
  checklistItems?: string[]
  headerEyebrow?: string
  headerTitle?: string
  seedOnMount?: boolean
}

const defaultChecklistItems = ['50%', '100%', '200%', 'Resize', 'Retina', 'Mixed select', 'S1.5 graph', 'Payload audit']

export function CanvasSpike({
  autoLoadBoard = false,
  boardId,
  boardTitle,
  checklistItems = defaultChecklistItems,
  headerEyebrow = 'Sprint S1 · Canvas coordinate spike',
  headerTitle = 'Whiteboard base + S1.5 node runtime spike',
  seedOnMount = true,
}: CanvasSpikeProps = {}) {
  const [editor, setEditor] = useState<Editor | null>(null)
  const [connectionMessage, setConnectionMessage] = useState<{
    text: string
    tone: 'error' | 'success'
  } | null>(null)
  const imagePreviewMode = useCanvasPerformanceStore((state) => state.imagePreviewMode)
  useCanvasPerformanceTracking(editor)
  useArrowPortSnapping(editor)
  useCanvasSettings(editor)
  useNodeConnectionValidation(editor, setConnectionMessage)
  usePortConnectionCompletion(editor, setConnectionMessage)

  useEffect(() => {
    const clearUnexpectedSelection = () => {
      const selection = window.getSelection()
      if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return

      const anchorElement = getSelectionElement(selection.anchorNode)
      const focusElement = getSelectionElement(selection.focusNode)
      if (!anchorElement || !focusElement) return
      if (!anchorElement.closest('.canvas-spike-shell') && !focusElement.closest('.canvas-spike-shell')) return
      if (isEditableSelectionTarget(anchorElement) || isEditableSelectionTarget(focusElement)) return

      selection.removeAllRanges()
    }

    document.addEventListener('selectionchange', clearUnexpectedSelection)
    return () => document.removeEventListener('selectionchange', clearUnexpectedSelection)
  }, [])

  const handleMount = useCallback((mountedEditor: Editor) => {
    setEditor(mountedEditor)
    if (seedOnMount) seedCanvasSpike(mountedEditor)
    return () => setEditor(null)
  }, [seedOnMount])

  const createNodeAtViewport = useCallback((type: NodeType) => {
    if (!editor) return
    const viewport = editor.getViewportPageBounds()
    const id = createNodeCard(editor, {
      type,
      x: viewport.midX - 170,
      y: viewport.midY - 140,
    })
    editor.select(id)
  }, [editor])

  const toolbarActions = useMemo(
    () => ({
      createAiCards: () => editor && createAiCards(editor, 80, 740),
      createBoardKit: () => editor && createBoardKit(editor, 80, 120),
      createImage: () => editor && createSampleImage(editor, 760, 140),
      createLinkCard: () => editor && createLinkCard(editor, 760, 520),
      createShapeSet: () => editor && createShapeSet(editor, 80, 360),
      createStep15Graph: () => editor && createStep15MockGraph(editor),
      createStressNodes: () => editor && createStep15StressNodes(editor),
      createAnalysisNode: () => createNodeAtViewport('analysis'),
      createImageGen4Node: () => createNodeAtViewport('image_gen_4'),
      createImageGenNode: () => createNodeAtViewport('image_gen'),
      createImageNode: () => createNodeAtViewport('image'),
      createPromptNode: () => createNodeAtViewport('prompt'),
    }),
    [createNodeAtViewport, editor]
  )

  const tldrawCanvas = (
    <Tldraw
      acceptedImageMimeTypes={spikeAcceptedImageMimeTypes}
      autoFocus
      components={tldrawComponents}
      inferDarkMode={false}
      maxAssetSize={spikeNodeImageMaxBytes}
      maxImageDimension={spikeMaxImageDimension}
      onMount={handleMount}
      shapeUtils={shapeUtils}
    />
  )

  return (
    <div className="canvas-spike-shell" data-image-preview-mode={imagePreviewMode}>
      <div className="canvas-spike-header">
        <div>
          <p className="eyebrow">{headerEyebrow}</p>
          <h1>{headerTitle}</h1>
        </div>
        <div className="canvas-spike-checklist">
          {checklistItems.map((item) => <span key={item}>{item}</span>)}
        </div>
      </div>
      <div className="canvas-spike-stage">
        {canvasRuntimeDiagnosticsEnabled ? (
          <CanvasRuntimeErrorBoundary>{tldrawCanvas}</CanvasRuntimeErrorBoundary>
        ) : (
          tldrawCanvas
        )}
        <CanvasArrowPortOverlay editor={editor} />
        <CanvasNodeEdgeOverlay editor={editor} />
        <CanvasConnectionCutOverlay editor={editor} />
        <CanvasConnectionLine editor={editor} />
        <CanvasNodePicker editor={editor} onSelect={createNodeAtViewport} />
        <CanvasSpikeNavigator editor={editor} />
        <CanvasSpikeToolbar
          editor={editor}
          onCreateAiCards={toolbarActions.createAiCards}
          onCreateBoardKit={toolbarActions.createBoardKit}
          onCreateImage={toolbarActions.createImage}
          onCreateImageGen4Node={toolbarActions.createImageGen4Node}
          onCreateImageGenNode={toolbarActions.createImageGenNode}
          onCreateImageNode={toolbarActions.createImageNode}
          onCreateLinkCard={toolbarActions.createLinkCard}
          onCreateAnalysisNode={toolbarActions.createAnalysisNode}
          onCreatePromptNode={toolbarActions.createPromptNode}
          onCreateShapeSet={toolbarActions.createShapeSet}
          onCreateStep15Graph={toolbarActions.createStep15Graph}
          onCreateStressNodes={toolbarActions.createStressNodes}
        />
        <CanvasNodeInspector connectionMessage={connectionMessage} editor={editor} />
        <CanvasSelectionToolbar editor={editor} />
        <CanvasBoardSaveAudit
          autoLoad={autoLoadBoard}
          boardId={boardId}
          boardTitle={boardTitle}
          editor={editor}
          mode={boardId ? 'board' : 'dev'}
        />
        <CanvasSettingsControl />
        <CanvasSpikeStylePanel editor={editor} />
        {canvasRuntimeDiagnosticsEnabled ? <CanvasRuntimeDiagnostics editorReady={editor !== null} /> : null}
      </div>
    </div>
  )
}

function getSelectionElement(node: Node | null) {
  if (!node) return null
  return node instanceof Element ? node : node.parentElement
}

function isEditableSelectionTarget(element: Element) {
  return Boolean(element.closest('input, textarea, select, [contenteditable="true"], [contenteditable="plaintext-only"]'))
}

function getAdaptiveImageMaxDimension() {
  if (typeof window === 'undefined') return 960
  if (window.innerWidth < 1200) return 768
  if (window.innerWidth < 1800) return 960
  return 1152
}
