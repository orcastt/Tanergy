import { memo, useMemo } from 'react'
import type { CanvasDocument, CanvasShape } from '@/features/canvas-engine'
import type { BoardCollaborationSessionRecord } from '@/features/boards/boardCollaborationTypes'
import { KonvaCanvasShape } from './KonvaCanvasShape'

type KonvaRemoteDraftLayerProps = {
  activePageId?: string | null
  document: CanvasDocument
  sessions?: readonly BoardCollaborationSessionRecord[]
  zoom: number
}

type RemoteDraftView = {
  key: string
  shape: CanvasShape
}

const noop = () => undefined

export const KonvaRemoteDraftLayer = memo(function KonvaRemoteDraftLayer({
  activePageId = null,
  document,
  sessions = [],
  zoom,
}: KonvaRemoteDraftLayerProps) {
  const drafts = useMemo(() => getRemoteDraftViews(sessions, activePageId), [activePageId, sessions])
  return (
    <>
      {drafts.map((draft) => (
        <KonvaCanvasShape
          document={document}
          hideEditableText={false}
          interactive={false}
          isSelected={false}
          key={draft.key}
          onDoubleClick={noop}
          onDragEnd={noop}
          onDragMove={noop}
          onDragStart={noop}
          onSelect={noop}
          panMode={false}
          previewMode={false}
          selectable={false}
          shape={draft.shape}
          toolAllowsDrag={false}
          zoom={zoom}
        />
      ))}
    </>
  )
})

function getRemoteDraftViews(
  sessions: readonly BoardCollaborationSessionRecord[],
  activePageId: string | null,
): RemoteDraftView[] {
  return sessions.flatMap((session) => {
    if (session.isSelf) return []
    const pageId = session.presence.activePageId ?? null
    if (activePageId && pageId && pageId !== activePageId) return []
    const draft = session.presence.draftPreview
    if (!draft) return []
    return [{
      key: `${session.id}:${draft.id}`,
      shape: {
        ...draft,
        style: {
          ...draft.style,
          opacity: Math.min(draft.style?.opacity ?? 1, 0.74),
        },
      },
    }]
  })
}
