'use client'

import { useCallback, useMemo, useState } from 'react'
import { ArrowShapeUtil, Tldraw, type Editor, type TLAnyShapeUtilConstructor, type TLComponents } from 'tldraw'
import { CanvasNodeInspector } from '@/components/inspector/CanvasNodeInspector'
import { NodeCardShapeUtil } from '@/components/nodes/NodeCardShape'
import { createNodeCard } from '@/features/node-runtime/createNodeCard'
import { createStep15MockGraph, createStep15StressNodes } from '@/features/node-runtime/createMockWorkflow'
import { useNodeConnectionValidation } from '@/features/node-runtime/useNodeConnectionValidation'
import type { NodeType } from '@/types/nodeRuntime'
import { AiCardShapeUtil } from './AiCardShape'
import { CanvasArrowPortOverlay } from './CanvasArrowPortOverlay'
import { CanvasConnectionCutOverlay } from './CanvasConnectionCutOverlay'
import { CanvasMergeCapturePanel } from './CanvasMergeCapturePanel'
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

const shapeUtils = [
  AiCardShapeUtil,
  NodeCardShapeUtil,
  ArrowShapeUtil.configure({
    arcArrowCenterSnapDistance: 0,
    hoverPreciseTimeout: 0,
    pointingPreciseTimeout: 0,
  }),
] satisfies TLAnyShapeUtilConstructor[]
const spikeAcceptedImageMimeTypes = ['image/png', 'image/jpeg', 'image/webp']
const spikeMaxAssetSizeBytes = 3 * 1024 * 1024
const spikeMaxImageDimension = 1280

const tldrawComponents = {
  ActionsMenu: null,
  DebugMenu: null,
  DebugPanel: null,
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

export function CanvasSpike() {
  const [editor, setEditor] = useState<Editor | null>(null)
  const [connectionMessage, setConnectionMessage] = useState<{
    text: string
    tone: 'error' | 'success'
  } | null>(null)
  useArrowPortSnapping(editor)
  useNodeConnectionValidation(editor, setConnectionMessage)

  const handleMount = useCallback((mountedEditor: Editor) => {
    setEditor(mountedEditor)
    seedCanvasSpike(mountedEditor)
    return () => setEditor(null)
  }, [])

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

  return (
    <div className="canvas-spike-shell">
      <div className="canvas-spike-header">
        <div>
          <p className="eyebrow">Sprint S1 · Canvas coordinate spike</p>
          <h1>Whiteboard base + S1.5 node runtime spike</h1>
        </div>
        <div className="canvas-spike-checklist">
          <span>50%</span>
          <span>100%</span>
          <span>200%</span>
          <span>Resize</span>
          <span>Retina</span>
          <span>Mixed select</span>
          <span>S1.5 graph</span>
          <span>Payload audit</span>
        </div>
      </div>
      <div className="canvas-spike-stage">
        <Tldraw
          acceptedImageMimeTypes={spikeAcceptedImageMimeTypes}
          autoFocus
          components={tldrawComponents}
          inferDarkMode={false}
          maxAssetSize={spikeMaxAssetSizeBytes}
          maxImageDimension={spikeMaxImageDimension}
          onMount={handleMount}
          shapeUtils={shapeUtils}
        />
        <CanvasArrowPortOverlay editor={editor} />
        <CanvasConnectionCutOverlay editor={editor} />
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
        <CanvasMergeCapturePanel editor={editor} />
        <CanvasSpikeStylePanel editor={editor} />
      </div>
    </div>
  )
}
