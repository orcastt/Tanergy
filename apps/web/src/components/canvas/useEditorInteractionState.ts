'use client'

import { useEffect, useState } from 'react'
import type { Editor } from 'tldraw'

type EditorInteractionState = {
  cameraState: 'idle' | 'moving'
  currentToolId: string
  isDragging: boolean
  isPanning: boolean
  isPointing: boolean
}

const idleInteractionState: EditorInteractionState = {
  cameraState: 'idle',
  currentToolId: 'select',
  isDragging: false,
  isPanning: false,
  isPointing: false,
}

export function useEditorInteractionState(editor: Editor | null) {
  const [state, setState] = useState<EditorInteractionState>(idleInteractionState)

  useEffect(() => {
    if (!editor) return

    let frame = 0
    const syncState = () => {
      frame = 0
      const next = getInteractionState(editor)
      setState((current) => (isSameInteractionState(current, next) ? current : next))
    }
    const scheduleSync = () => {
      if (frame) return
      frame = window.requestAnimationFrame(syncState)
    }

    scheduleSync()
    const stopSessionListen = editor.store.listen(scheduleSync, { scope: 'session', source: 'all' })
    editor.on('event', scheduleSync)
    editor.on('resize', scheduleSync)

    return () => {
      if (frame) window.cancelAnimationFrame(frame)
      stopSessionListen()
      editor.off('event', scheduleSync)
      editor.off('resize', scheduleSync)
    }
  }, [editor])

  return state
}

function getInteractionState(editor: Editor): EditorInteractionState {
  return {
    cameraState: editor.getCameraState(),
    currentToolId: editor.getCurrentToolId(),
    isDragging: editor.inputs.getIsDragging(),
    isPanning: editor.inputs.getIsPanning(),
    isPointing: editor.inputs.getIsPointing(),
  }
}

function isSameInteractionState(a: EditorInteractionState, b: EditorInteractionState) {
  return (
    a.cameraState === b.cameraState &&
    a.currentToolId === b.currentToolId &&
    a.isDragging === b.isDragging &&
    a.isPanning === b.isPanning &&
    a.isPointing === b.isPointing
  )
}
