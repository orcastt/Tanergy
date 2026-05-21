import type { CanvasDiagnosticsSnapshot } from '@/features/canvas-engine'

type KonvaCanvasDiagnosticsProps = {
  diagnostics: CanvasDiagnosticsSnapshot
  pointCount: number
  zoom: number
}

export function KonvaCanvasDiagnostics({ diagnostics, pointCount, zoom }: KonvaCanvasDiagnosticsProps) {
  return (
    <div className="konva-canvas-diagnostics" aria-label="Canvas diagnostics">
      <div>
        <span>Frame avg</span>
        <strong>{diagnostics.averageFrameTimeMs.toFixed(1)}ms</strong>
      </div>
      <div>
        <span>Frame max</span>
        <strong>{diagnostics.maxFrameTimeMs.toFixed(1)}ms</strong>
      </div>
      <div>
        <span>Objects</span>
        <strong>{diagnostics.shapeCount}</strong>
      </div>
      <div>
        <span>Strokes</span>
        <strong>{diagnostics.strokeCount}</strong>
      </div>
      <div>
        <span>Points</span>
        <strong>{pointCount}</strong>
      </div>
      <div>
        <span>Zoom</span>
        <strong>{Math.round(zoom * 100)}%</strong>
      </div>
    </div>
  )
}
