'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { BoardThumbnail } from '@/components/boards/BoardThumbnail'
import { readImageFileAsDataUrl, validateImageFile } from '@/features/assets/imageAssetInputs'
import { uploadImageDataUrlAsset } from '@/features/assets/assetUploadClient'
import {
  boardCardColorValues,
  type BoardCardColor,
  type BoardPersistenceSummary,
  type BoardVisibility,
} from '@/features/boards/boardTypes'
import { BoardManagementMembers } from './BoardManagementMembers'

type BoardManagementPanelProps = {
  board: BoardPersistenceSummary
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
  isPending,
  onClose,
  onCopy,
  onDelete,
  onOpen,
  onSave,
  onShare,
}: BoardManagementPanelProps) {
  const [cardColor, setCardColor] = useState<BoardCardColor>(board.cardColor ?? 'cream')
  const [description, setDescription] = useState(board.description ?? '')
  const [isPinned, setIsPinned] = useState(Boolean(board.isPinned))
  const [isStarred, setIsStarred] = useState(Boolean(board.isStarred))
  const [thumbnailError, setThumbnailError] = useState<string | null>(null)
  const [thumbnailUrl, setThumbnailUrl] = useState(board.thumbnailUrl ?? '')
  const [title, setTitle] = useState(board.title)
  const [uploadingThumbnail, setUploadingThumbnail] = useState(false)
  const [visibility, setVisibility] = useState<BoardVisibility>(board.visibility ?? 'private')

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    onSave({ cardColor, description, isPinned, isStarred, thumbnailUrl, title, visibility })
  }

  const uploadThumbnail = async (file: File | undefined) => {
    if (!file) return
    setThumbnailError(null)
    setUploadingThumbnail(true)
    try {
      validateImageFile(file)
      const image = await readImageFileAsDataUrl(file)
      const asset = await uploadImageDataUrlAsset({
        dataUrl: image.url,
        fileName: file.name,
        height: image.height,
        origin: 'upload',
        title: `${title || board.title} thumbnail`,
        width: image.width,
      })
      setThumbnailUrl(asset.thumbnail512Url ?? asset.thumbnail256Url ?? asset.originalUrl)
    } catch (error) {
      setThumbnailError(error instanceof Error ? error.message : 'Thumbnail upload failed.')
    } finally {
      setUploadingThumbnail(false)
    }
  }

  return (
    <div className="board-panel-backdrop" onMouseDown={onClose} role="presentation">
      <aside
        aria-label="Board management"
        aria-modal="true"
        className="board-panel"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
      >
        <header className="board-panel-header">
          <div>
            <p className="product-kicker">Board panel</p>
            <h2>Manage board</h2>
          </div>
          <button aria-label="Close board panel" onClick={onClose} type="button">Close</button>
        </header>

        <form className="board-panel-form" onSubmit={submit}>
          <section className="board-panel-thumbnail">
            <BoardThumbnail board={{ ...board, thumbnailUrl: thumbnailUrl || null }} />
            <div>
              <label className="board-panel-thumbnail-upload">
                <span>Change thumbnail</span>
                <input
                  accept="image/png,image/jpeg,image/webp"
                  disabled={uploadingThumbnail || isPending}
                  onChange={(event) => void uploadThumbnail(event.target.files?.[0])}
                  type="file"
                />
              </label>
              <input
                aria-label="Thumbnail URL"
                maxLength={512}
                onChange={(event) => setThumbnailUrl(event.target.value)}
                placeholder="Paste thumbnail URL"
                value={thumbnailUrl}
              />
              {thumbnailError ? <small role="alert">{thumbnailError}</small> : null}
            </div>
          </section>

          <label>
            <span>Board name</span>
            <input maxLength={80} onChange={(event) => setTitle(event.target.value)} required value={title} />
          </label>
          <label>
            <span>Description</span>
            <textarea
              maxLength={280}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Add a short note for this board."
              rows={4}
              value={description}
            />
          </label>
          <fieldset>
            <legend>Card color</legend>
            <div className="board-panel-swatches">
              {boardCardColorValues.map((value) => (
                <button
                  aria-pressed={cardColor === value}
                  className={cardColor === value ? 'is-active' : undefined}
                  data-card-color={value}
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

          <fieldset>
            <legend>Board access</legend>
            <div className="board-panel-access">
              {(['private', 'workspace', 'public'] satisfies BoardVisibility[]).map((value) => (
                <button
                  aria-pressed={visibility === value}
                  className={visibility === value ? 'is-active' : undefined}
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
              <input checked={isStarred} onChange={(event) => setIsStarred(event.target.checked)} type="checkbox" />
              Star this board
            </label>
            <label>
              <input checked={isPinned} onChange={(event) => setIsPinned(event.target.checked)} type="checkbox" />
              Pin in workspace
            </label>
          </div>

          <dl className="board-panel-details">
            <div><dt>Owner</dt><dd>{formatOwner(board.ownerId)}</dd></div>
            <div><dt>Created</dt><dd>{formatDate(board.createdAt ?? board.savedAt)}</dd></div>
            <div><dt>Last modified</dt><dd>{formatDate(board.savedAt)}</dd></div>
            <div><dt>Last opened</dt><dd>{board.lastOpenedAt ? formatDate(board.lastOpenedAt) : 'Not opened yet'}</dd></div>
            <div><dt>Location</dt><dd>{board.workspaceId}</dd></div>
            <div><dt>Objects</dt><dd>{board.shapeCount} shapes / {board.assetCount} assets</dd></div>
          </dl>

          <footer className="board-panel-footer">
            <button className="product-button product-button-primary" disabled={isPending} type="submit">
              Save changes
            </button>
            <button className="product-button product-button-secondary" onClick={onOpen} type="button">
              Open board
            </button>
          </footer>
        </form>

        <BoardManagementMembers board={board} />

        <section className="board-panel-danger" aria-label="Board actions">
          <button disabled={isPending} onClick={onCopy} type="button">Copy board</button>
          <button disabled={isPending} onClick={onShare} type="button">Share link</button>
          <button disabled={isPending} onClick={onDelete} type="button">Delete board</button>
        </section>
      </aside>
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
