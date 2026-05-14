import Link from 'next/link'
import { CanvasBoardSwitcher } from '@/components/canvas/CanvasBoardSwitcher'
import { CanvasBoardTitle } from '@/components/canvas/CanvasBoardTitle'
import type { BoardCollaborationSessionRecord } from '@/features/boards/boardCollaborationTypes'
import type { BoardRealtimeAwarenessStatus } from '@/features/collaboration/boardRealtimeTransport'
import type { KonvaLocalYjsSyncController } from './useKonvaLocalYjsSync'

type KonvaCanvasHeaderProps = {
  boardId?: string
  boardTitle?: string
  collaboration?: {
    activeSessions: BoardCollaborationSessionRecord[]
    error: string | null
    permission: string | null
    status: 'error' | 'idle' | 'loading' | 'ready'
    transportStatus: BoardRealtimeAwarenessStatus
  }
  localSync?: KonvaLocalYjsSyncController
  onBoardTitleRename?: (title: string) => Promise<string | void> | string | void
}

export function KonvaCanvasHeader({
  boardId,
  boardTitle = 'S1X Konva handfeel spike',
  collaboration,
  localSync,
  onBoardTitleRename,
}: KonvaCanvasHeaderProps) {
  const sessions = collaboration?.activeSessions ?? []
  const extraCount = Math.max(0, sessions.length - 4)
  const visibleSessions = sessions.slice(0, 4)
  const label = collaboration?.status === 'loading' || collaboration?.transportStatus === 'connecting'
    ? 'Connecting'
    : collaboration?.transportStatus === 'disconnected'
    ? 'Reconnecting'
    : collaboration?.transportStatus === 'error'
    ? 'Offline'
    : collaboration?.error
    ? 'Offline'
    : collaboration?.permission === 'view'
      ? 'View only'
      : sessions.length <= 1
        ? 'Solo'
        : `${sessions.length} online`
  const localSyncLabel = getLocalSyncLabel(localSync)
  const localSyncTitle = getLocalSyncTitle(localSync)
  const localSyncTone = getLocalSyncTone(localSync)
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
      {localSyncLabel ? (
        <span className={`konva-canvas-sync-pill is-${localSyncTone}`} title={localSyncTitle}>
          {localSyncLabel}
        </span>
      ) : null}
      <div className="konva-canvas-presence" role="status">
        <span className={`konva-canvas-presence-label${collaboration?.status === 'loading' ? ' is-loading' : ''}`}>{label}</span>
        <div className="konva-canvas-presence-list" aria-label="Board presence">
          {visibleSessions.map((session) => (
            <span
              className={`konva-canvas-presence-avatar${session.isSelf ? ' is-self' : ''}`}
              key={session.id}
              title={`${session.displayName}${session.isSelf ? ' (You)' : ''}`}
            >
              {session.avatarInitials}
            </span>
          ))}
          {extraCount > 0 ? <span className="konva-canvas-presence-avatar is-overflow">+{extraCount}</span> : null}
        </div>
      </div>
    </header>
  )
}

function getLocalSyncLabel(localSync?: KonvaLocalYjsSyncController) {
  if (!localSync || localSync.status === 'disabled') return null
  if (localSync.status === 'unsupported') return 'No live sync'
  if (localSync.status === 'disconnected') return 'Reconnecting'
  if (localSync.status === 'error') return 'Sync error'
  if (localSync.status === 'connecting') return 'Syncing'
  return null
}

function getLocalSyncTone(localSync?: KonvaLocalYjsSyncController) {
  if (!localSync || localSync.status === 'disabled' || localSync.status === 'connecting') return 'muted'
  if (
    localSync.status === 'unsupported'
    || localSync.status === 'disconnected'
    || localSync.hasPendingRemoteSnapshot
    || localSync.transportState?.outboundQueueState === 'queued'
  ) return 'warning'
  if (localSync.status === 'error') return 'danger'
  return 'success'
}

function getLocalSyncTitle(localSync?: KonvaLocalYjsSyncController) {
  if (!localSync || localSync.status === 'disabled') return ''
  if (localSync.status === 'unsupported') return 'BroadcastChannel is unavailable in this browser, so local realtime sync is disabled.'
  if (localSync.status === 'disconnected') return 'Local realtime room is temporarily disconnected and waiting to reconnect.'
  if (localSync.status === 'error') return localSync.transportState?.error ?? 'Local realtime room reported an error.'
  const details = [
    localSync.transportState?.lastActivityAt ? `Last room activity ${formatSyncTime(localSync.transportState.lastActivityAt)}` : null,
    localSync.transportState?.lastSyncedAt ? `Room synced ${formatSyncTime(localSync.transportState.lastSyncedAt)}` : null,
    localSync.transportState?.outboundQueueCount
      ? `${localSync.transportState.outboundQueueCount} queued update${localSync.transportState.outboundQueueCount === 1 ? '' : 's'}`
      : null,
    localSync.lastPublishedAt ? `Last publish ${formatSyncTime(localSync.lastPublishedAt)}` : null,
    localSync.lastRemoteAppliedAt ? `Last remote apply ${formatSyncTime(localSync.lastRemoteAppliedAt)}` : null,
    localSync.canUndo ? 'Collaborative undo ready' : null,
    localSync.canRedo ? 'Collaborative redo ready' : null,
    localSync.lastRemotePublishedAt && localSync.hasPendingRemoteSnapshot
      ? `Remote change waiting since ${formatSyncTime(localSync.lastRemotePublishedAt)}`
      : null,
  ].filter(Boolean)
  return details.join(' | ')
}

function formatSyncTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}
