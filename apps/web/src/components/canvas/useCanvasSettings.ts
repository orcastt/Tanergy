'use client'

import { useEffect } from 'react'
import type { Editor } from 'tldraw'
import { useCanvasSettingsStore } from '@/features/canvas-settings/canvasSettingsStore'

type EditorWithMutableOptions = Editor & {
  options: { snapThreshold: number }
}

export function useCanvasSettings(editor: Editor | null) {
  const settings = useCanvasSettingsStore((state) => state.settings)

  useEffect(() => {
    if (!editor) return

    editor.updateInstanceState({ isGridMode: settings.gridRendering })
    editor.updateDocumentSettings({ gridSize: settings.gridUnit })
    editor.user.updateUserPreferences({ isSnapMode: settings.snapAlignment })
    setSnapThreshold(editor, settings.snapDistance)
    editor.setCameraOptions({ zoomSpeed: settings.zoomSensitivity })
  }, [
    editor,
    settings.gridRendering,
    settings.gridUnit,
    settings.snapAlignment,
    settings.snapDistance,
    settings.zoomSensitivity,
  ])
}

function setSnapThreshold(editor: Editor, snapThreshold: number) {
  Object.assign((editor as EditorWithMutableOptions).options, { snapThreshold })
}
