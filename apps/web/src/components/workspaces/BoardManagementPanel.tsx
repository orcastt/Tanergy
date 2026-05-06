'use client'

import { useEffect, useState, type FormEvent } from 'react'
import {
  boardCardColorValues,
  type BoardCardColor,
  type BoardPersistenceSummary,
  type BoardVisibility,
} from '@/features/boards/boardTypes'
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
    isStarred: boolean
    thumbnailUrl: string
    title: string
    visibility: BoardVisibility
  }) => void
  onShare: () => void
}

const colorLabels: Record<BoardCardColor, string> = {
  cream: 'Cream',
  mint: 'Mint',
  peach: 'Peach',
  soft: 'Soft',
  yellow: 'Yellow',
}

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
}: BoardManagementPanelProps) {
  const [cardColor, setCardColor] = useState<BoardCardColor>(getBoardDisplayCardColor(board))
  const [description, setDescription] = useState(board.description ?? '')
  const [isPinned, setIsPinned] = useState(Boolean(board.isPinned))
  const [isStarred, setIsStarred] = useState(Boolean(board.isStarred))
  const [thumbnailUrl, setThumbnailUrl] = useState(board.thumbnailUrl ?? '')
  const [title, setTitle] = useState(board.title)
  const [visibility, setVisibility] = useState<BoardVisibility>(board.visibility ?? 'private')
  const editDisabled = !canManageBoard || isPending

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
    onSave({ cardColor, description, isPinned, isStarred, thumbnailUrl, title, visibility })
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
          <dl>
            <div><dt>Owner</dt><dd>{formatOwner(board.ownerId)}</dd></div>
            <div><dt>Role</dt><dd>{canCopyBoard ? 'Owner' : canManageBoard ? 'Can manage' : 'Can view / edit'}</dd></div>
            <div><dt>Visibility</dt><dd>{getVisibilityLabel(board.visibility ?? 'private')}</dd></div>
            <div><dt>Created</dt><dd>{formatDate(board.createdAt ?? board.savedAt)}</dd></div>
            <div><dt>Last modified</dt><dd>{formatDate(board.savedAt)}</dd></div>
            <div><dt>Last opened</dt><dd>{board.lastOpenedAt ? formatDate(board.lastOpenedAt) : 'Not opened yet'}</dd></div>
            <div><dt>Location</dt><dd>{board.workspaceId}</dd></div>
            <div><dt>Objects</dt><dd>{board.shapeCount} shapes / {board.assetCount} assets</dd></div>
          </dl>
        </aside>

        <main className="board-panel-main">
          <header className="board-panel-header">
            <div>
              <h2>Board Panel</h2>
            </div>
            <div className="board-panel-top-actions">
              <button className="product-button product-button-primary" disabled={editDisabled} form="board-management-form" type="submit">
                Save
              </button>
              <button className="product-button product-button-secondary" disabled={isPending || !canManageBoard} onClick={onShare} type="button">
                Copy link
              </button>
              <button
                className="product-button product-button-secondary"
                disabled={!canManageBoard}
                onClick={() => document.getElementById('board-members-lookup')?.focus()}
                type="button"
              >
                Invite
              </button>
              <button className="product-button product-button-secondary" onClick={onOpen} type="button">
                Open
              </button>
              <button aria-label="Close board panel" className="board-panel-close" onClick={onClose} type="button">×</button>
            </div>
          </header>

          {!canManageBoard ? (
            <p className="board-panel-permission-note">
              Only a Board owner or manager can rename the board, invite people, share links or change board metadata.
            </p>
          ) : null}

          <div className="board-panel-content">
            <form className="board-panel-form board-panel-editor-column" id="board-management-form" onSubmit={submit}>
              <BoardManagementThumbnailSection
                board={board}
                disabled={editDisabled}
                onChange={setThumbnailUrl}
                thumbnailUrl={thumbnailUrl}
                title={title}
              />

              <section className="board-panel-section">
                <div className="board-panel-section-heading">
                  <div>
                    <h3>Board profile</h3>
                  </div>
                </div>
                <label>
                  <span>Board name</span>
                  <input disabled={editDisabled} maxLength={80} onChange={(event) => setTitle(event.target.value)} required value={title} />
                </label>
                <label>
                  <span>Description</span>
                  <textarea
                    disabled={editDisabled}
                    maxLength={280}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder="Add a short note for this board."
                    rows={3}
                    value={description}
                  />
                </label>
              </section>

              <section className="board-panel-section board-panel-customization">
                <div className="board-panel-section-heading">
                  <div>
                    <h3>Appearance & access</h3>
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

                <fieldset disabled={editDisabled}>
                  <legend>Board access</legend>
                  <div className="board-panel-access">
                    {(['private', 'workspace', 'public'] satisfies BoardVisibility[]).map((value) => (
                      <button
                        aria-pressed={visibility === value}
                        className={visibility === value ? 'is-active' : undefined}
                        disabled={editDisabled}
                        key={value}
                        onClick={() => setVisibility(value)}
                        type="button"
                      >
                        {getVisibilityLabel(value)}
                      </button>
                    ))}
                  </div>
                </fieldset>

                <div className="board-panel-toggles">
                  <label>
                    <input checked={isStarred} disabled={editDisabled} onChange={(event) => setIsStarred(event.target.checked)} type="checkbox" />
                    Star this board
                  </label>
                  <label>
                    <input checked={isPinned} disabled={editDisabled} onChange={(event) => setIsPinned(event.target.checked)} type="checkbox" />
                    Pin in workspace
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

            <div className="board-panel-members-column">
              <BoardManagementMembers board={board} canManageBoard={canManageBoard} disabled={isPending} />
            </div>
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

function formatOwner(ownerId: string) {
  return ownerId === 'dev-user' ? 'TANGENT Dev' : ownerId
}

function getVisibilityLabel(value: BoardVisibility) {
  if (value === 'public') return 'Public'
  if (value === 'workspace') return 'Workspace'
  return 'Private'
}
