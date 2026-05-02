'use client'

import { useState, type SyntheticEvent } from 'react'
import { CanvasSettingsPanel } from './CanvasSettingsPanel'

function stopCanvasEvent(event: SyntheticEvent) {
  event.stopPropagation()
}

export function CanvasSettingsControl({ boardMode = false }: { boardMode?: boolean }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        aria-label="Open settings"
        className="canvas-settings-trigger"
        onClick={() => setOpen(true)}
        onDoubleClick={stopCanvasEvent}
        onPointerDown={stopCanvasEvent}
        onWheel={stopCanvasEvent}
        title="Canvas settings"
        type="button"
      >
        ⚙
      </button>
      {open ? <CanvasSettingsPanel boardMode={boardMode} onClose={() => setOpen(false)} /> : null}
    </>
  )
}
