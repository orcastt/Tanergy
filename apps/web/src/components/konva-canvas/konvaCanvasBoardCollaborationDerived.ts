'use client'

import type { BoardCollaborationSessionRecord } from '@/features/boards/boardCollaborationTypes'
import type { SerializedKonvaBoardPage } from '@/features/boards/konvaBoardPageContract'
import type { KonvaCollaborationEdgeSession } from './KonvaNodeEdgeLayer'
import { isKonvaCreateTool, type KonvaCanvasTool } from './konvaCanvasTypes'

export function createCollaborationPageSummaries(pages: SerializedKonvaBoardPage[]) {
  return pages.map((page) => ({
    id: page.id,
    title: page.title || page.canvasDocument.metadata.name || 'Untitled page',
  }))
}

export function createRemoteEdgeSessions(
  sessions: BoardCollaborationSessionRecord[],
  activePageId: string,
): KonvaCollaborationEdgeSession[] {
  return sessions
    .filter((session) => !session.isSelf)
    .filter((session) => {
      const sessionPageId = session.presence.activePageId ?? null
      return !sessionPageId || sessionPageId === activePageId
    })
    .filter((session) => Boolean(session.presence.selectedEdgeId || session.presence.connectionPreview))
    .map((session) => ({
      clientInstanceId: session.clientInstanceId,
      connectionPreview: session.presence.connectionPreview ?? null,
      displayName: session.displayName,
      selectedEdgeId: session.presence.selectedEdgeId ?? null,
      sessionId: session.id,
    }))
}

export function resolveKonvaCollaborationMode(options: {
  activeToolPreference: KonvaCanvasTool
  canEdit: boolean
  readOnly: boolean
  status: string
}) {
  const effectiveReadOnly = options.readOnly || (options.status === 'ready' && !options.canEdit)
  const activeTool = effectiveReadOnly ? 'hand' : options.activeToolPreference
  return {
    activeTool,
    effectiveReadOnly,
    stageToolMode: effectiveReadOnly ? 'view' : isKonvaCreateTool(activeTool) ? 'create' : activeTool,
  }
}
