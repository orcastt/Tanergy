'use client'

import { useEffect } from 'react'
import type { WorkspaceBoardLimitDialogState } from './workspaceBoardPlanLimits'

type WorkspaceBoardLimitDialogProps = {
  notice: WorkspaceBoardLimitDialogState
  onClose: () => void
  onOpenBilling: () => void
}

export function WorkspaceBoardLimitDialog({
  notice,
  onClose,
  onOpenBilling,
}: WorkspaceBoardLimitDialogProps) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <div className="workspace-limit-dialog-backdrop" onMouseDown={onClose} role="presentation">
      <section
        aria-label="Board plan limit"
        aria-modal="true"
        className="workspace-limit-dialog"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
      >
        <div className="workspace-limit-dialog-copy">
          <span className="workspace-limit-dialog-eyebrow">{notice.planName}</span>
          <h2>Board limit reached</h2>
          <p>{notice.message}</p>
          <small>{notice.workspaceName}</small>
        </div>
        <div className="workspace-limit-dialog-actions">
          <button className="product-button product-button-secondary" onClick={onClose} type="button">
            Not now
          </button>
          <button className="product-button product-button-primary" onClick={onOpenBilling} type="button">
            See plans
          </button>
        </div>
      </section>
    </div>
  )
}
