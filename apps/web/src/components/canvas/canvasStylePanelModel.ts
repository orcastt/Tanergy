'use client'

import { useEffect, useState } from 'react'
import type { Editor } from 'tldraw'
import type { SelectionAction } from './CanvasStylePanelGroups'

export type StylePanelTool = 'arrow' | 'draw' | 'frame' | 'geo' | 'line' | 'note' | 'text'

export const layerActions: SelectionAction[] = [
  { icon: 'layer-back', label: 'Send to back', run: (editor, ids) => editor.sendToBack(ids) },
  { icon: 'layer-down', label: 'Send backward', run: (editor, ids) => editor.sendBackward(ids) },
  { icon: 'layer-up', label: 'Bring forward', run: (editor, ids) => editor.bringForward(ids) },
  { icon: 'layer-front', label: 'Bring to front', run: (editor, ids) => editor.bringToFront(ids) },
]

export const alignActions: SelectionAction[] = [
  { icon: 'align-left', label: 'Align left', minSelected: 2, run: (editor, ids) => editor.alignShapes(ids, 'left') },
  { icon: 'align-center-x', label: 'Align center', minSelected: 2, run: (editor, ids) => editor.alignShapes(ids, 'center-horizontal') },
  { icon: 'align-right', label: 'Align right', minSelected: 2, run: (editor, ids) => editor.alignShapes(ids, 'right') },
  { icon: 'align-top', label: 'Align top', minSelected: 2, run: (editor, ids) => editor.alignShapes(ids, 'top') },
  { icon: 'align-center-y', label: 'Align middle', minSelected: 2, run: (editor, ids) => editor.alignShapes(ids, 'center-vertical') },
  { icon: 'align-bottom', label: 'Align bottom', minSelected: 2, run: (editor, ids) => editor.alignShapes(ids, 'bottom') },
]

export const operationActions: SelectionAction[] = [
  { icon: 'duplicate', label: 'Duplicate', run: (editor, ids) => editor.duplicateShapes(ids, { x: 24, y: 24 }) },
  { icon: 'delete', label: 'Delete', run: (editor, ids) => editor.deleteShapes(ids) },
  { icon: 'stretch-x', label: 'Stretch horizontal', run: (editor, ids) => editor.stretchShapes(ids, 'horizontal') },
  { icon: 'stretch-y', label: 'Stretch vertical', run: (editor, ids) => editor.stretchShapes(ids, 'vertical') },
]

export function useLastStylePanelTool(editor: Editor | null) {
  const [lastStyleTool, setLastStyleTool] = useState<StylePanelTool>('geo')

  useEffect(() => {
    if (!editor) return
    const activeEditor = editor

    let frame = window.requestAnimationFrame(syncTool)
    const scheduleSync = () => {
      if (frame) return
      frame = window.requestAnimationFrame(syncTool)
    }
    function syncTool() {
      frame = 0
      const nextTool = getStylePanelTool(activeEditor.getCurrentToolId())
      if (nextTool) setLastStyleTool((current) => current === nextTool ? current : nextTool)
    }

    const stopSessionListen = activeEditor.store.listen(scheduleSync, { scope: 'session', source: 'all' })
    activeEditor.on('event', scheduleSync)
    return () => {
      if (frame) window.cancelAnimationFrame(frame)
      stopSessionListen()
      activeEditor.off('event', scheduleSync)
    }
  }, [editor])

  return lastStyleTool
}

export function getSelectionTool(selectedShapes: Array<{ type: string }>): StylePanelTool | null {
  if (selectedShapes.length === 0) return null
  if (selectedShapes.every((shape) => shape.type === 'arrow')) return 'arrow'
  if (selectedShapes.every((shape) => shape.type === 'draw')) return 'draw'
  if (selectedShapes.every((shape) => shape.type === 'frame')) return 'frame'
  if (selectedShapes.every((shape) => shape.type === 'geo')) return 'geo'
  if (selectedShapes.every((shape) => shape.type === 'line')) return 'line'
  if (selectedShapes.every((shape) => shape.type === 'note')) return 'note'
  if (selectedShapes.every((shape) => shape.type === 'text')) return 'text'
  return null
}

export function getToolLabel(tool: StylePanelTool) {
  if (tool === 'arrow') return 'Arrow'
  if (tool === 'draw') return 'Draw'
  if (tool === 'frame') return 'Frame'
  if (tool === 'line') return 'Line'
  if (tool === 'note') return 'Note'
  if (tool === 'text') return 'Text'
  return 'Shape'
}

export function toolSupports(tool: StylePanelTool, group: 'arrow' | 'dash' | 'fill' | 'font' | 'spline') {
  if (group === 'arrow') return tool === 'arrow'
  if (group === 'font') return tool === 'text' || tool === 'note'
  if (group === 'spline') return tool === 'line' || tool === 'draw'
  if (group === 'fill') return tool === 'frame' || tool === 'geo' || tool === 'note'
  if (group === 'dash') return tool !== 'text'
  return true
}

function getStylePanelTool(currentToolId: string): StylePanelTool | null {
  if (currentToolId === 'arrow') return 'arrow'
  if (currentToolId === 'draw') return 'draw'
  if (currentToolId === 'frame') return 'frame'
  if (currentToolId === 'geo') return 'geo'
  if (currentToolId === 'line') return 'line'
  if (currentToolId === 'note') return 'note'
  if (currentToolId === 'text') return 'text'
  return null
}
