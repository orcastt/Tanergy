'use client'

import { useState } from 'react'
import { BoardThumbnail } from '@/components/boards/BoardThumbnail'
import { readImageFileAsDataUrl, validateImageFile } from '@/features/assets/imageAssetInputs'
import { uploadImageDataUrlAsset } from '@/features/assets/assetUploadClient'
import type { BoardPersistenceSummary } from '@/features/boards/boardTypes'

type BoardManagementThumbnailSectionProps = {
  board: BoardPersistenceSummary
  disabled: boolean
  onChange: (thumbnailUrl: string) => void
  thumbnailUrl: string
  title: string
}

export function BoardManagementThumbnailSection({
  board,
  disabled,
  onChange,
  thumbnailUrl,
  title,
}: BoardManagementThumbnailSectionProps) {
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  const uploadThumbnail = async (file: File | undefined) => {
    if (!file || disabled) return
    setError(null)
    setUploading(true)
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
      onChange(asset.thumbnail512Url ?? asset.thumbnail256Url ?? asset.originalUrl)
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Thumbnail upload failed.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <section className="board-panel-section board-panel-thumbnail-section">
      <div className="board-panel-section-heading">
        <div>
          <h3>Preview image</h3>
        </div>
        <button disabled={disabled || !thumbnailUrl} onClick={() => onChange('')} type="button">
          Remove
        </button>
      </div>
      <div className="board-panel-thumbnail">
        <BoardThumbnail board={{ ...board, thumbnailUrl: thumbnailUrl || null }} />
        <div>
          <label className="board-panel-thumbnail-upload" aria-disabled={disabled || uploading}>
            <span>{uploading ? 'Uploading...' : 'Upload image'}</span>
            <input
              accept="image/png,image/jpeg,image/webp"
              disabled={disabled || uploading}
              onChange={(event) => void uploadThumbnail(event.target.files?.[0])}
              type="file"
            />
          </label>
          <input
            aria-label="Thumbnail URL"
            disabled={disabled}
            maxLength={512}
            onChange={(event) => onChange(event.target.value)}
            placeholder="Optional thumbnail URL"
            value={thumbnailUrl}
          />
          {error ? <small className="board-panel-error" role="alert">{error}</small> : null}
        </div>
      </div>
    </section>
  )
}
