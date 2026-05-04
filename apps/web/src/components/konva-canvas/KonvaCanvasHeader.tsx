import Link from 'next/link'

type KonvaCanvasHeaderProps = {
  boardTitle?: string
  mode?: 'board' | 'dev'
  ydocId: string
}

export function KonvaCanvasHeader({ boardTitle = 'S1X Konva handfeel spike', mode = 'dev', ydocId }: KonvaCanvasHeaderProps) {
  return (
    <header className="konva-canvas-header">
      <Link aria-label="Back to workspace" className="konva-canvas-back" href="/workspaces" title="Back to workspace" />
      <Link className="konva-canvas-logo" href="/home" title="TANGENT home">TANGENT</Link>
      <div className="konva-canvas-title">
        <span>{boardTitle}</span>
        <small>{mode === 'board' ? 'Konva board persistence spike' : 'tldraw parity reference'}, Yjs doc ready: {ydocId}</small>
      </div>
    </header>
  )
}
