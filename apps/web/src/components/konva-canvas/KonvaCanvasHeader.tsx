import Link from 'next/link'
import { CanvasBoardSwitcher } from '@/components/canvas/CanvasBoardSwitcher'
import { CanvasBoardTitle } from '@/components/canvas/CanvasBoardTitle'

type KonvaCanvasHeaderProps = {
  boardId?: string
  boardTitle?: string
  onBoardTitleRename?: (title: string) => Promise<string | void> | string | void
}

export function KonvaCanvasHeader({
  boardId,
  boardTitle = 'S1X Konva handfeel spike',
  onBoardTitleRename,
}: KonvaCanvasHeaderProps) {
  return (
    <header className="konva-canvas-header">
      <Link aria-label="Back to workspace" className="konva-canvas-back" href="/workspaces" title="Back to workspace" />
      <Link className="konva-canvas-logo" href="/home" title="TANGENT home">TANGENT</Link>
      <div className="konva-canvas-title">
        {boardId ? (
          <CanvasBoardSwitcher boardId={boardId} onRename={onBoardTitleRename} title={boardTitle} />
        ) : (
          <CanvasBoardTitle onRename={onBoardTitleRename} title={boardTitle} />
        )}
      </div>
    </header>
  )
}
