'use client'

import { useEffect, useRef, useState } from 'react'
import { normalizeCanonicalWorkspaceRole } from '@/features/auth/sessionTypes'
import type { BoardRealtimeAwarenessStatus } from '@/features/collaboration/boardRealtimeTransport'
import type { BoardCollaborationSessionRecord } from '@/features/boards/boardCollaborationTypes'
import { getCollaborationAccent } from '@/features/collaboration/collaborationAccent'
import {
  formatSessionPresenceActivity,
  formatSessionPresenceTitle,
  type KonvaPresencePageSummary,
} from './konvaCollaborationPresencePresentation'

type KonvaCanvasPresenceProps = {
  collaboration?: {
    activeSessions: BoardCollaborationSessionRecord[]
    error: string | null
    permission: string | null
    status: 'error' | 'idle' | 'loading' | 'ready'
    transportStatus: BoardRealtimeAwarenessStatus
  }
  currentPageId?: string | null
  pageSummaries?: KonvaPresencePageSummary[]
}

export function KonvaCanvasPresence({
  collaboration,
  currentPageId = null,
  pageSummaries = [],
}: KonvaCanvasPresenceProps) {
  const [isRosterOpen, setIsRosterOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const sessions = collaboration?.activeSessions ?? []
  const selfSession = sessions.find((session) => session.isSelf)
  const remoteSessions = sessions.filter((session) => !session.isSelf)
  const extraCount = Math.max(0, sessions.length - 4)
  const visibleSessions = [...(selfSession ? [selfSession] : []), ...remoteSessions].slice(0, 4)
  const visibleActivitySessions = remoteSessions.slice(0, 2)
  const orderedSessions = [...(selfSession ? [selfSession] : []), ...remoteSessions]
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

  useEffect(() => {
    if (!isRosterOpen) return

    const handlePointerDown = (event: PointerEvent) => {
      if (rootRef.current && event.target instanceof Node && !rootRef.current.contains(event.target)) {
        setIsRosterOpen(false)
      }
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsRosterOpen(false)
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isRosterOpen])

  return (
    <div className="konva-canvas-presence" ref={rootRef} role="status">
      <span className={`konva-canvas-presence-label${collaboration?.status === 'loading' ? ' is-loading' : ''}`}>{label}</span>
      <div className="konva-canvas-presence-list" aria-label="Board presence">
        {visibleSessions.map((session) => (
          <span
            className={`konva-canvas-presence-avatar${session.isSelf ? ' is-self' : ''}`}
            key={session.id}
            style={session.isSelf ? undefined : { ['--presence-accent' as string]: getCollaborationAccent(session.clientInstanceId) }}
            title={formatSessionPresenceTitle(session, { currentPageId, pageSummaries })}
          >
            {session.avatarInitials}
          </span>
        ))}
        {extraCount > 0 ? <span className="konva-canvas-presence-avatar is-overflow">+{extraCount}</span> : null}
      </div>
      {visibleActivitySessions.length ? (
        <div className="konva-canvas-presence-activity-list" aria-label="Collaborator activity">
          {visibleActivitySessions.map((session) => {
            const activity = formatSessionPresenceActivity(session, { currentPageId, pageSummaries })
            if (!activity) return null
            return (
              <span
                className="konva-canvas-presence-activity"
                key={`${session.id}:activity`}
                style={{ ['--presence-accent' as string]: getCollaborationAccent(session.clientInstanceId) }}
                title={formatSessionPresenceTitle(session, { currentPageId, pageSummaries })}
              >
                <strong>{session.displayName}</strong>
                <small>{activity}</small>
              </span>
            )
          })}
        </div>
      ) : null}
      <button
        aria-expanded={isRosterOpen}
        aria-haspopup="dialog"
        className="konva-canvas-presence-toggle"
        data-tooltip="Live collaborators"
        onClick={() => setIsRosterOpen((open) => !open)}
        type="button"
      >
        <span>{sessions.length}</span>
      </button>
      {isRosterOpen ? (
        <div aria-label="Live collaborators" className="konva-canvas-presence-roster" role="dialog">
          <div className="konva-canvas-presence-roster__header">
            <strong>{sessions.length <= 1 ? 'Solo workspace' : `${sessions.length} collaborators online`}</strong>
            <small>{collaboration?.permission === 'view' ? 'This board is view only for you.' : 'Live board presence and activity.'}</small>
          </div>
          <div className="konva-canvas-presence-roster__list">
            {orderedSessions.map((session) => {
              const activity = formatSessionPresenceActivity(session, { currentPageId, pageSummaries }) || 'Idle'
              const meta = [
                session.isSelf ? 'You' : null,
                formatWorkspaceRole(session.workspaceRole),
                formatPermission(session.permission),
              ].filter(Boolean).join(' · ')
              return (
                <div className="konva-canvas-presence-roster__row" key={`${session.id}:roster`}>
                  <span
                    className={`konva-canvas-presence-avatar konva-canvas-presence-avatar--roster${session.isSelf ? ' is-self' : ''}`}
                    style={session.isSelf ? undefined : { ['--presence-accent' as string]: getCollaborationAccent(session.clientInstanceId) }}
                  >
                    {session.avatarInitials}
                  </span>
                  <div className="konva-canvas-presence-roster__copy">
                    <strong title={formatSessionPresenceTitle(session, { currentPageId, pageSummaries })}>
                      {session.displayName}
                    </strong>
                    <small>{activity}</small>
                  </div>
                  <span className="konva-canvas-presence-roster__meta">{meta}</span>
                </div>
              )
            })}
          </div>
        </div>
      ) : null}
    </div>
  )
}

function formatWorkspaceRole(value: string) {
  const normalized = normalizeCanonicalWorkspaceRole(value)
  if (normalized === 'owner') return 'Owner'
  if (normalized === 'admin') return 'Workspace admin'
  if (normalized === 'editor') return 'Editor'
  return 'Viewer'
}

function formatPermission(value: string) {
  if (value === 'owner') return 'Board owner'
  if (value === 'manage') return 'Board admin'
  if (value === 'edit') return 'Can edit'
  if (value === 'view') return 'Can view'
  return value || 'Access'
}
