'use client'

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
        disabled={disabled}
        onClick={() => onSelectTool('hand')}
        title="Pan"
        type="button"
      >
        <span aria-hidden>✋</span>
      </button>
      <button
        aria-label="Select"
        className={currentToolId === 'select' ? 'is-active' : undefined}
        disabled={disabled}
        onClick={() => onSelectTool('select')}
        title="Select"
        type="button"
      >
        <span aria-hidden>↖</span>
      </button>
    </div>
  )
}
