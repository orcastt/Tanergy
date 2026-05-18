'use client'

import { useEffect } from 'react'
import Link from 'next/link'

type KonvaCanvasPageLimitDialogProps = {
  pageLimit: number
  planName?: string
  onClose: () => void
}

export function KonvaCanvasPageLimitDialog({
  onClose,
  pageLimit,
  planName,
}: KonvaCanvasPageLimitDialogProps) {
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
        aria-label="Page plan limit"
        aria-modal="true"
        className="konva-canvas-page-limit-dialog"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
      >
        <div className="konva-canvas-page-limit-dialog__copy">
          <span>{planName ?? 'Current plan'}</span>
          <h2>Upgrade to add more pages</h2>
          <p>This board is limited to {pageLimit} pages on the current plan.</p>
        </div>
        <div className="konva-canvas-page-limit-dialog__actions">
          <button onClick={onClose} type="button">Not now</button>
          <Link href="/billing">See plans</Link>
        </div>
      </section>
    </div>
  )
}
