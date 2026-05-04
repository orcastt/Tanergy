import Link from 'next/link'

type KonvaCanvasHeaderProps = {
  ydocId: string
}

export function KonvaCanvasHeader({ ydocId }: KonvaCanvasHeaderProps) {
  return (
    <header className="konva-canvas-header">
      <Link aria-label="Back to workspace" className="konva-canvas-back" href="/workspaces" title="Back to workspace" />
      <Link className="konva-canvas-logo" href="/home" title="TANGENT home">TANGENT</Link>
      <div className="konva-canvas-title">
        <span>S1X Konva handfeel spike</span>
        <small>tldraw parity reference, Yjs doc ready: {ydocId}</small>
      </div>
    </header>
  )
}
