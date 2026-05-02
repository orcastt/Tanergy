import type { ReactNode } from 'react'
import type { Editor, TLShapeId } from 'tldraw'

export type SelectionAction = {
  icon: string
  label: string
  minSelected?: number
  run: (editor: Editor, ids: TLShapeId[]) => void
}

export function StyleButtonGroup({ children, label }: { children: ReactNode; label: string }) {
  return (
    <section className="canvas-style-panel__block">
      <p>{label}</p>
      <div className="canvas-style-panel__segmented">{children}</div>
    </section>
  )
}

export function StyleButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean
  icon: string
  label: string
  onClick: () => void
}) {
  return (
    <button aria-label={label} className={active ? 'is-active' : undefined} onClick={onClick} title={label} type="button">
      <span className={`style-icon style-icon--${icon}`} aria-hidden />
    </button>
  )
}

export function ActionButtonGroup({
  actions,
  editor,
  label,
  selectedCount,
  selectedIds,
}: {
  actions: SelectionAction[]
  editor: Editor
  label: string
  selectedCount: number
  selectedIds: TLShapeId[]
}) {
  return (
    <section className="canvas-style-panel__block">
      <p>{label}</p>
      <div className="canvas-style-panel__icon-grid">
        {actions.map((action) => (
          <button
            aria-label={action.label}
            disabled={selectedCount < (action.minSelected ?? 1)}
            key={action.icon}
            onClick={() => action.run(editor, selectedIds)}
            title={action.label}
            type="button"
          >
            <span className={`style-action-icon style-action-icon--${action.icon}`} aria-hidden />
          </button>
        ))}
      </div>
    </section>
  )
}
