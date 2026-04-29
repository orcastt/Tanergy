'use client'

import { useCallback, useEffect, useRef, useState, type MouseEvent, type SyntheticEvent } from 'react'
import { GeoShapeGeoStyle, type Editor, type TLShapeId } from 'tldraw'
import {
  directTools,
  shapeTools,
  type ToolAction,
} from './canvasToolbarConfig'
import { CanvasSpikeInsertMenu } from './CanvasSpikeInsertMenu'
import { useEditorRevision } from './useEditorRevision'

type CanvasSpikeToolbarProps = {
  editor: Editor | null
  onCreateAiCards: () => void
  onCreateAnalysisNode: () => void
  onCreateBoardKit: () => void
  onCreateImage: () => void
  onCreateImageGen4Node: () => void
  onCreateImageGenNode: () => void
  onCreateImageNode: () => void
  onCreateLinkCard: () => void
  onCreatePromptNode: () => void
  onCreateShapeSet: () => void
  onCreateStep15Graph: () => void
  onCreateStressNodes: () => void
}

function stopCanvasEvent(event: SyntheticEvent) {
  event.stopPropagation()
}

export function CanvasSpikeToolbar({
  editor,
  onCreateAiCards,
  onCreateAnalysisNode,
  onCreateBoardKit,
  onCreateImage,
  onCreateImageGen4Node,
  onCreateImageGenNode,
  onCreateImageNode,
  onCreateLinkCard,
  onCreatePromptNode,
  onCreateShapeSet,
  onCreateStep15Graph,
  onCreateStressNodes,
}: CanvasSpikeToolbarProps) {
  useEditorRevision(editor)

  const continuousShapeIds = useRef<TLShapeId[]>([])
  const isContinuousDrawing = useRef(false)
  const [continuousToolId, setContinuousToolId] = useState<string | null>(null)
  const [openMenu, setOpenMenu] = useState<'insert' | 'shape' | null>(null)
  const [selectedShapeTool, setSelectedShapeTool] = useState(shapeTools[0])

  const disabled = editor === null
  const currentToolId = editor?.getCurrentToolId() ?? 'select'
  const currentGeo = editor?.getStyleForNextShape(GeoShapeGeoStyle)
  const isToolLocked = editor?.getInstanceState().isToolLocked ?? false

  const finishContinuousDrawing = useCallback((selectCreatedShapes: boolean) => {
    if (!editor) return
    const shapeIds = [...continuousShapeIds.current]
    isContinuousDrawing.current = false
    continuousShapeIds.current = []
    setContinuousToolId(null)
    editor.updateInstanceState({ isToolLocked: false })
    editor.cancel()
    editor.setCurrentTool('select.idle')
    if (selectCreatedShapes && shapeIds.length > 0) {
      requestAnimationFrame(() => editor.select(...shapeIds))
    }
  }, [editor])

  useEffect(() => {
    if (!editor) return

    return editor.store.listen(({ changes }) => {
      if (!isContinuousDrawing.current) return

      const newShapeIds = Object.values(changes.added)
        .filter((record) => record.typeName === 'shape')
        .map((record) => record.id as TLShapeId)

      if (newShapeIds.length === 0) return
      continuousShapeIds.current = [...continuousShapeIds.current, ...newShapeIds]
      requestAnimationFrame(() => editor.select(...continuousShapeIds.current))
    })
  }, [editor])

  useEffect(() => {
    if (!editor) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (!isContinuousDrawing.current && openMenu === null) return
      event.preventDefault()
      event.stopPropagation()
      setOpenMenu(null)
      if (isContinuousDrawing.current) finishContinuousDrawing(true)
    }

    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [editor, finishContinuousDrawing, openMenu])

  const clearContinuousSession = () => {
    isContinuousDrawing.current = false
    continuousShapeIds.current = []
    setContinuousToolId(null)
    editor?.updateInstanceState({ isToolLocked: false })
  }

  const setPrimaryTool = (tool: 'hand' | 'select') => {
    if (!editor) return
    if (isContinuousDrawing.current) finishContinuousDrawing(true)
    else clearContinuousSession()
    setOpenMenu(null)
    editor.setCurrentTool(tool)
  }

  const setDrawTool = (action: ToolAction, continuous: boolean) => {
    if (!editor) return

    isContinuousDrawing.current = continuous
    continuousShapeIds.current = []
    setContinuousToolId(continuous ? action.id : null)
    editor.updateInstanceState({ isToolLocked: continuous })

    if (action.kind === 'geo') {
      setSelectedShapeTool(action)
      editor.setStyleForNextShapes(GeoShapeGeoStyle, action.geo)
      editor.setCurrentTool('geo')
      return
    }

    editor.setCurrentTool(action.tool)
  }

  const runInsertAction = (action: () => void) => {
    if (!editor) return
    clearContinuousSession()
    setOpenMenu(null)
    editor.setCurrentTool('select')
    action()
  }

  const runInsertDrawTool = (action: ToolAction) => {
    setOpenMenu(null)
    setDrawTool(action, false)
  }

  const handleContinuousTool = (event: MouseEvent<HTMLButtonElement>, action: ToolAction) => {
    event.preventDefault()
    event.stopPropagation()
    setOpenMenu(null)
    setDrawTool(action, true)
  }

  const shapeActive = currentToolId === 'geo'

  return (
    <div
      className="canvas-spike-toolbar"
      aria-label="Canvas spike tools"
      onContextMenu={(event) => event.preventDefault()}
      onDoubleClick={stopCanvasEvent}
      onPointerDown={stopCanvasEvent}
      onWheel={stopCanvasEvent}
    >
      <div className="canvas-spike-toolbar__group" aria-label="Primary tools">
        <button
          aria-label="Pan"
          className={currentToolId === 'hand' ? 'is-active' : undefined}
          disabled={disabled}
          onClick={() => setPrimaryTool('hand')}
          title="Pan"
          type="button"
        >
          <span aria-hidden>✋</span>
        </button>
        <button
          aria-label="Select"
          className={currentToolId === 'select' ? 'is-active' : undefined}
          disabled={disabled}
          onClick={() => setPrimaryTool('select')}
          title="Select"
          type="button"
        >
          <span aria-hidden>↖</span>
        </button>
      </div>

      <div className="canvas-spike-toolbar__divider" />

      <div className="canvas-spike-toolbar__group" aria-label="Drawing tools">
        <div className="canvas-spike-toolbar__menu-wrap">
          <button
            aria-label="Shape"
            className={shapeActive ? 'is-active' : undefined}
            data-continuous={continuousToolId === selectedShapeTool.id && isToolLocked ? 'true' : undefined}
            disabled={disabled}
            onClick={() => {
              setOpenMenu(openMenu === 'shape' ? null : 'shape')
            }}
            onContextMenu={(event) => handleContinuousTool(event, selectedShapeTool)}
            title="Shape · click to choose, right-click continuous"
            type="button"
          >
            <span aria-hidden>{shapeActive ? shapeTools.find((tool) => tool.geo === currentGeo)?.icon : selectedShapeTool.icon}</span>
          </button>
          {openMenu === 'shape' ? (
            <div className="canvas-spike-toolbar__popover" role="menu">
              {shapeTools.map((tool) => (
                <button
                  aria-label={tool.label}
                  className={currentGeo === tool.geo ? 'is-active' : undefined}
                  disabled={disabled}
                  key={tool.id}
                  onClick={() => {
                    setOpenMenu(null)
                    setDrawTool(tool, false)
                  }}
                  onContextMenu={(event) => handleContinuousTool(event, tool)}
                  title={`${tool.label} · right-click continuous`}
                  type="button"
                >
                  <span aria-hidden>{tool.icon}</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>

        {directTools.map((tool) => {
          const isActive = currentToolId === tool.tool
          const isContinuous = continuousToolId === tool.id && isToolLocked
          return (
            <button
              aria-label={tool.label}
              className={isActive ? 'is-active' : undefined}
              data-continuous={isContinuous ? 'true' : undefined}
              disabled={disabled}
              key={tool.id}
              onClick={() => setDrawTool(tool, false)}
              onContextMenu={(event) => handleContinuousTool(event, tool)}
              title={`${tool.label} · right-click continuous`}
              type="button"
            >
              <span aria-hidden>{tool.icon}</span>
            </button>
          )
        })}
      </div>

      <div className="canvas-spike-toolbar__divider" />

      <div className="canvas-spike-toolbar__menu-wrap">
        <button
          aria-label="Insert"
          disabled={disabled}
          onClick={() => setOpenMenu(openMenu === 'insert' ? null : 'insert')}
          title="Insert"
          type="button"
        >
          <span aria-hidden>＋</span>
        </button>
        {openMenu === 'insert' ? (
          <CanvasSpikeInsertMenu
            disabled={disabled}
            onCreateAiCards={onCreateAiCards}
            onCreateAnalysisNode={onCreateAnalysisNode}
            onCreateBoardKit={onCreateBoardKit}
            onCreateImage={onCreateImage}
            onCreateImageGen4Node={onCreateImageGen4Node}
            onCreateImageGenNode={onCreateImageGenNode}
            onCreateImageNode={onCreateImageNode}
            onCreateLinkCard={onCreateLinkCard}
            onCreatePromptNode={onCreatePromptNode}
            onCreateShapeSet={onCreateShapeSet}
            onCreateStep15Graph={onCreateStep15Graph}
            onCreateStressNodes={onCreateStressNodes}
            onDrawTool={runInsertDrawTool}
            onRunInsertAction={runInsertAction}
          />
        ) : null}
      </div>

      {continuousToolId ? <div className="canvas-spike-toolbar__mode">连续绘制 · Esc</div> : null}
    </div>
  )
}
