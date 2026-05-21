import type { CanvasShape } from '@/features/canvas-engine'

export function createSeedShapes(): CanvasShape[] {
  return [
    { id: 'seed-rect', props: { height: 128, width: 188 }, style: { fillStyle: 'solid', stroke: '#263342', strokeWidth: 2 }, type: 'rect', x: 80, y: 80 },
    { id: 'seed-cloud', props: { height: 124, width: 216 }, style: { fillStyle: 'semi', stroke: '#6b5cff', strokeWidth: 2 }, type: 'cloud', x: 340, y: 120 },
    { id: 'seed-arrow', props: { end: { x: 180, y: 80 } }, style: { stroke: '#243142', strokeWidth: 2 }, type: 'arrow', x: 610, y: 170 },
    { id: 'seed-text', props: { height: 80, text: 'Draw here', width: 220 }, style: { stroke: '#243142', strokeWidth: 2 }, type: 'text', x: 860, y: 160 },
    { id: 'seed-frame', props: { height: 170, title: 'Frame', width: 260 }, style: { dash: 'solid', fillStyle: 'solid', opacity: 1, stroke: '#1f1f1f', strokeWidth: 1 }, type: 'frame', x: 76, y: 280 },
    { id: 'seed-sticky', props: { authorName: 'You', height: 124, text: 'Sticky note', width: 156 }, style: { fillStyle: 'solid', stroke: '#c084fc', strokeWidth: 2 }, type: 'sticky', x: 380, y: 300 },
  ]
}

export function createStressStrokes(offset: number): CanvasShape[] {
  return Array.from({ length: 1000 }, (_, index) => ({
    id: `stress-${offset}-${index}`,
    props: {
      points: [
        { x: 0, y: 0, pressure: 0.42 },
        { x: 8, y: Math.sin(index) * 5, pressure: 0.56 },
        { x: 18, y: Math.cos(index * 0.6) * 7, pressure: 0.52 },
        { x: 32, y: Math.sin(index * 0.3) * 4, pressure: 0.46 },
      ],
    },
    style: { opacity: 0.82, stroke: index % 3 === 0 ? '#6b5cff' : '#243142', strokeWidth: 1.6 },
    type: 'stroke' as const,
    x: 80 + (index % 50) * 28,
    y: 380 + Math.floor(index / 50) * 16,
  }))
}
