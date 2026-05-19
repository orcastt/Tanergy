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
  const canUpgradeForMorePages = pageLimit < 10
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
          <h2>{canUpgradeForMorePages ? 'Upgrade to add more pages' : `One board is limited to ${pageLimit} pages`}</h2>
          <p>
            {canUpgradeForMorePages
              ? `Free boards are limited to ${pageLimit} pages. Upgrade to create up to 10 pages per board.`
              : `This plan already uses the maximum board page limit. One board can contain up to ${pageLimit} pages.`}
          </p>
        </div>
        <div className="konva-canvas-page-limit-dialog__actions">
          <button onClick={onClose} type="button">{canUpgradeForMorePages ? 'Not now' : 'Got it'}</button>
          {canUpgradeForMorePages ? <Link href="/billing">See plans</Link> : null}
        </div>
      </section>
    </div>
  )
}
