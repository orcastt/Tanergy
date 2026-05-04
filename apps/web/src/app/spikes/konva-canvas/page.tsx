'use client'

import dynamic from 'next/dynamic'

const KonvaCanvasSpike = dynamic(
  () => import('@/components/konva-canvas/KonvaCanvasSpike').then((module) => module.KonvaCanvasSpike),
  { ssr: false }
)

export default function KonvaCanvasSpikePage() {
  return <KonvaCanvasSpike boardId="konva-spike-local" boardTitle="Konva Spike Local" mode="board" />
}
