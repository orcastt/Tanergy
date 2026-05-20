'use client'

import { useEffect, useState, type FormEvent } from 'react'
import type { TangentWorkspace } from '@/features/auth/sessionTypes'
import { useTangentSession } from '@/features/auth/useTangentSession'
import {
  boardCardColorValues,
  type BoardCardColor,
  type BoardPersistenceSummary,
} from '@/features/boards/boardTypes'
import { normalizeUserLabelInput, sanitizeUserLabelInput } from '@/features/security/safeText'
import { getPublicOwnerLabel } from '@/features/shared/publicUserDisplay'
import { BoardManagementMembers } from './BoardManagementMembers'
import { BoardManagementThumbnailSection } from './BoardManagementThumbnailSection'
import { getBoardDisplayCardColor } from './workspaceBoardUtils'

type BoardManagementPanelProps = {
  board: BoardPersistenceSummary
  canCopyBoard: boolean
  canDeleteBoard: boolean
  canManageBoard: boolean
  isPending: boolean
  onClose: () => void
  onCopy: () => void
  onDelete: () => void
  onOpen: () => void
  onSave: (input: {
    cardColor: BoardCardColor
    description: string
    isPinned: boolean
    thumbnailUrl: string
    title: string
  }) => void
  onShare: () => void
  workspace?: TangentWorkspace
}

const colorLabels: Record<BoardCardColor, string> = {
  cream: 'Cream',
  mint: 'Mint',
  peach: 'Peach',
  soft: 'Soft',
  yellow: 'Yellow',
}
const sharedWorkspaceKinds = new Set(['group_workspace', 'team_workspace'])

export function BoardManagementPanel({
  board,
  canCopyBoard,
  canDeleteBoard,
  canManageBoard,
  isPending,
  onClose,
  onCopy,
  onDelete,
  onOpen,
  onSave,
  onShare,
  workspace,
}: BoardManagementPanelProps) {
  const { session } = useTangentSession()
  const [cardColor, setCardColor] = useState<BoardCardColor>(getBoardDisplayCardColor(board))
  const [description, setDescription] = useState(board.description ?? '')
  const [isPinned, setIsPinned] = useState(Boolean(board.isPinned))
  const [thumbnailUrl, setThumbnailUrl] = useState(board.thumbnailUrl ?? '')
  const [title, setTitle] = useState(board.title)
  const editDisabled = !canManageBoard || isPending
  const isSharedWorkspace = Boolean(workspace && sharedWorkspaceKinds.has(workspace.kind))
  const canShareBoard = canManageBoard && isSharedWorkspace

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (editDisabled) return
    onSave({ cardColor, description, isPinned, thumbnailUrl, title: normalizeUserLabelInput(title) })
  }

  return (
    <div className="board-panel-backdrop" onMouseDown={onClose} role="presentation">
      <section
        aria-label="Board management"
        aria-modal="true"
        className="board-panel"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
      >
        <aside className="board-panel-sidebar">
          <p className="product-kicker">Board management</p>
          <h2>{board.title}</h2>
          <div className="board-panel-summary">
            <span>{workspace?.name ?? board.workspaceId}</span>
            <span>{board.isPinned ? 'Pinned' : 'Not pinned'}</span>
          </div>
          <dl className="board-panel-details">
            <div><dt>Owner</dt><dd>{getPublicOwnerLabel(board.ownerId, session.user.id)}</dd></div>
            <div><dt>Access</dt><dd>{getBoardAccessLabel(workspace, canManageBoard)}</dd></div>
            <div><dt>Updated</dt><dd>{formatDate(board.savedAt)}</dd></div>
            <div><dt>Opened</dt><dd>{board.lastOpenedAt ? formatDate(board.lastOpenedAt) : 'Not opened yet'}</dd></div>
            <div><dt>Objects</dt><dd>{board.shapeCount} shapes / {board.assetCount} assets</dd></div>
          </dl>
        </aside>

        <main className="board-panel-main">
          <header className="board-panel-header">
            <div>
              <h2>Board settings</h2>
              <p>{canManageBoard ? getBoardSettingsDescription(isSharedWorkspace) : getBoardViewDescription(isSharedWorkspace)}</p>
            </div>
            <div className="board-panel-top-actions">
              <button className="product-button product-button-primary" disabled={editDisabled} form="board-management-form" type="submit">
                Save
              </button>
              {isSharedWorkspace ? (
                <>
                  <button className="product-button product-button-secondary" disabled={isPending || !canShareBoard} onClick={onShare} type="button">
                    Copy link
                  </button>
                  <button
                    className="product-button product-button-secondary"
                    disabled={!canManageBoard}
                    onClick={() => document.getElementById('board-members-lookup')?.focus()}
                    type="button"
                  >
                    Add member
                  </button>
                </>
              ) : null}
              <button className="product-button product-button-secondary" onClick={onOpen} type="button">
                Open
              </button>
              <button aria-label="Close board panel" className="board-panel-close" onClick={onClose} type="button">×</button>
            </div>
          </header>

          {!canManageBoard ? (
            <p className="board-panel-permission-note">Read only.</p>
          ) : null}

          <div className={isSharedWorkspace ? 'board-panel-content' : 'board-panel-content board-panel-content--personal'}>
            <form className="board-panel-form board-panel-editor-column" id="board-management-form" onSubmit={submit}>
              <BoardManagementThumbnailSection
                board={board}
                disabled={editDisabled}
                onChange={setThumbnailUrl}
                thumbnailUrl={thumbnailUrl}
                title={title}
                workspace={workspace}
              />

              <section className="board-panel-section">
                <div className="board-panel-section-heading">
                  <div>
                    <h3>Profile</h3>
                  </div>
                </div>
                <label>
                  <span>Name</span>
                  <input disabled={editDisabled} maxLength={80} onChange={(event) => setTitle(sanitizeUserLabelInput(event.target.value))} required value={title} />
                </label>
                <label>
                  <span>Note</span>
                  <textarea
                    disabled={editDisabled}
                    maxLength={280}
                    onChange={(event) => setDescription(sanitizeUserLabelInput(event.target.value, 280))}
                    placeholder="Short note"
                    rows={3}
                    value={description}
                  />
                </label>
              </section>

              <section className="board-panel-section board-panel-customization">
                <div className="board-panel-section-heading">
                  <div>
                    <h3>Appearance</h3>
                  </div>
                </div>

                <fieldset disabled={editDisabled}>
                  <legend>Card color</legend>
                  <div className="board-panel-swatches">
                    {boardCardColorValues.map((value) => (
                      <button
                        aria-pressed={cardColor === value}
                        className={cardColor === value ? 'is-active' : undefined}
                        data-card-color={value}
                        disabled={editDisabled}
                        key={value}
                        onClick={() => setCardColor(value)}
                        type="button"
                      >
                        <span />
                        {colorLabels[value]}
                      </button>
                    ))}
                  </div>
                </fieldset>

                <div className="board-panel-toggles">
                  <label>
                    <input checked={isPinned} disabled={editDisabled} onChange={(event) => setIsPinned(event.target.checked)} type="checkbox" />
                    Pin
                  </label>
                </div>

                <div className="board-panel-inline-actions">
                  <button className="product-button product-button-secondary" disabled={isPending || !canCopyBoard} onClick={onCopy} type="button">
                    Copy board
                  </button>
                  <button className="product-button product-button-secondary" disabled={isPending || !canDeleteBoard} onClick={onDelete} type="button">
                    Delete
                  </button>
                </div>
              </section>
            </form>

            {isSharedWorkspace ? (
              <div className="board-panel-members-column">
                <BoardManagementMembers board={board} canManageBoard={canManageBoard} disabled={isPending} workspace={workspace} />
              </div>
            ) : null}
          </div>
        </main>
      </section>
    </div>
  )
}

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date)
}

function getBoardAccessLabel(workspace: BoardManagementPanelProps['workspace'], canManageBoard: boolean) {
  if (!workspace) return canManageBoard ? 'Can manage' : 'View only'
  if (workspace.kind === 'solo_workspace') return 'Personal board'
  const scope = workspace.kind === 'team_workspace' ? 'Team' : workspace.kind === 'group_workspace' ? 'Group' : 'Personal'
  return canManageBoard ? `${scope} manager or assigned board access` : 'Assigned board access'
}

function getBoardSettingsDescription(isSharedWorkspace: boolean) {
  return isSharedWorkspace ? 'Edit metadata, appearance and members.' : 'Edit metadata and appearance.'
}

function getBoardViewDescription(isSharedWorkspace: boolean) {
  return isSharedWorkspace ? 'View the board summary and members.' : 'View your personal board summary.'
}
