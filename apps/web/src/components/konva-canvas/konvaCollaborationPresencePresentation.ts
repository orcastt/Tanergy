import type {
  BoardCollaborationPresenceState,
  BoardCollaborationSessionRecord,
  BoardCollaborationTransformKind,
} from '@/features/boards/boardCollaborationTypes'

export type KonvaPresencePageSummary = {
  id: string
  title: string
}

const toolLabels: Record<string, string> = {
  arrow: 'Arrow',
  cloud: 'Cloud',
  diamond: 'Diamond',
  draw: 'Draw',
  ellipse: 'Circle',
  eraser: 'Eraser',
  frame: 'Frame',
  hand: 'Hand',
  line: 'Line',
  rect: 'Rectangle',
  select: 'Select',
  sticky: 'Sticky',
  text: 'Text',
  triangle: 'Triangle',
}

export function formatSessionPresenceActivity(
  session: BoardCollaborationSessionRecord,
  options: {
    currentPageId?: null | string
    pageSummaries?: KonvaPresencePageSummary[]
  } = {},
) {
  const parts: string[] = []
  const presence = session.presence
  const pageLabel = getPresencePageLabel(presence.activePageId ?? null, options.pageSummaries)
  const activityLabel = getPresenceActivityLabel(
    presence.connectionPreview ?? null,
    presence.selectedEdgeId ?? null,
    presence.tool ?? null,
    presence.state ?? null,
    presence.transformKind ?? null,
  )
  const selectionCount = presence.selectionIds?.length ?? 0

  if (pageLabel && presence.activePageId && presence.activePageId !== options.currentPageId) {
    parts.push(pageLabel)
  }
  if (activityLabel) {
    parts.push(activityLabel)
  }
  if (selectionCount > 0 && presence.state !== 'typing') {
    parts.push(selectionCount === 1 ? '1 selected' : `${selectionCount} selected`)
  }

  return parts.join(' · ')
}

export function formatSessionPresenceTitle(
  session: BoardCollaborationSessionRecord,
  options: {
    currentPageId?: null | string
    pageSummaries?: KonvaPresencePageSummary[]
  } = {},
) {
  const activity = formatSessionPresenceActivity(session, options)
  const suffix = session.isSelf ? ' (You)' : ''
  return activity ? `${session.displayName}${suffix} - ${activity}` : `${session.displayName}${suffix}`
}

function getPresenceActivityLabel(
  connectionPreview: BoardCollaborationSessionRecord['presence']['connectionPreview'],
  selectedEdgeId: BoardCollaborationSessionRecord['presence']['selectedEdgeId'],
  tool: null | string,
  state: BoardCollaborationPresenceState | null,
  transformKind: BoardCollaborationTransformKind | null,
) {
  if (connectionPreview) return 'Connecting'
  if (state === 'typing') return 'Editing'
  if (state === 'running') return 'Running'
  if (transformKind === 'move') return 'Moving'
  if (transformKind === 'resize') return 'Resizing'
  if (transformKind === 'rotate') return 'Rotating'
  if (selectedEdgeId) return 'Inspecting edge'
  if (tool && toolLabels[tool]) return toolLabels[tool]
  if (state === 'panning') return 'Hand'
  if (state === 'drawing') return 'Drawing'
  if (state === 'selecting') return 'Selecting'
  if (state === 'viewing') return 'Viewing'
  if (state === 'idle') return 'Idle'
  return null
}

function getPresencePageLabel(
  pageId: null | string,
  pageSummaries: KonvaPresencePageSummary[] | undefined,
) {
  if (!pageId) return null
  const page = pageSummaries?.find((entry) => entry.id === pageId)
  return page?.title?.trim() || 'Another page'
}
