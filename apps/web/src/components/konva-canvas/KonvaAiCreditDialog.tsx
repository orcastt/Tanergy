'use client'

import { useEffect } from 'react'
import Link from 'next/link'

type KonvaAiCreditDialogProps = {
  message?: string
  onClose: () => void
}

export function KonvaAiCreditDialog({
  message,
  onClose,
}: KonvaAiCreditDialogProps) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <div className="konva-canvas-page-limit-dialog-backdrop" onMouseDown={onClose} role="presentation">
      <section
        aria-label="Insufficient credits"
        aria-modal="true"
        className="konva-canvas-page-limit-dialog"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
      >
        <div className="konva-canvas-page-limit-dialog__copy">
          <span>AI run</span>
          <h2>Insufficient credits</h2>
          <p>{message ?? 'Top up, upgrade plan, or contact an administrator to continue.'}</p>
        </div>
        <div className="konva-canvas-page-limit-dialog__actions">
          <button onClick={onClose} type="button">Contact administrator</button>
          <Link href="/billing">Top up / upgrade plan</Link>
        </div>
      </section>
    </div>
  )
}
