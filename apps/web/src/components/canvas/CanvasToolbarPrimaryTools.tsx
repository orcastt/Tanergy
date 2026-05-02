'use client'

import { CanvasLineIcon } from './CanvasLineIcon'

type CanvasToolbarPrimaryToolsProps = {
  currentToolId: string
  disabled: boolean
  onSelectTool: (tool: 'hand' | 'select') => void
}

export function CanvasToolbarPrimaryTools({ currentToolId, disabled, onSelectTool }: CanvasToolbarPrimaryToolsProps) {
  return (
    <div className="canvas-spike-toolbar__group" aria-label="Primary tools">
      <button
        aria-label="Pan"
        className={currentToolId === 'hand' ? 'is-active' : undefined}
        data-tooltip="Pan"
        disabled={disabled}
        onClick={() => onSelectTool('hand')}
        type="button"
      >
        <CanvasLineIcon name="hand" />
      </button>
      <button
        aria-label="Select"
        className={currentToolId === 'select' ? 'is-active' : undefined}
        data-tooltip="Select"
        disabled={disabled}
        onClick={() => onSelectTool('select')}
        type="button"
      >
        <CanvasLineIcon name="select" />
      </button>
    </div>
  )
}
