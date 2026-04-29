'use client'

import dynamic from 'next/dynamic'

const CanvasSpike = dynamic(
  () => import('@/components/canvas/CanvasSpike').then((module) => module.CanvasSpike),
  {
    ssr: false,
  }
)

export default function CanvasSpikePage() {
  return <CanvasSpike />
}
