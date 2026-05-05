'use client'

import dynamic from 'next/dynamic'
import { isTldrawReferenceEnabled } from '@/features/boards/boardCanvasEngine'

const CanvasSpike = dynamic(
  () => import('@/components/canvas/CanvasSpike').then((module) => module.CanvasSpike),
  {
    ssr: false,
  }
)

export default function CanvasSpikePage() {
  if (!isTldrawReferenceEnabled()) {
    return (
      <main className="canvas-board-route-state">
        <strong>tldraw Reference Disabled</strong>
        <span>This reference canvas is available in development only. Production Boards use the Konva engine.</span>
      </main>
    )
  }
  return <CanvasSpike />
}
