'use client'

import { useEffect, useMemo, useState } from 'react'
import type { RuntimeGraphImageAssetRef } from '@/features/node-runtime/runtimeGraphAssets'

export type KonvaNodeImageLightboxState = {
  batches: RuntimeGraphImageAssetRef[][]
  selectedBatchIndex?: number
  selectedIndex?: number
  title: string
}

type KonvaNodeImageLightboxProps = {
  onClose: () => void
  state: KonvaNodeImageLightboxState
}

export function KonvaNodeImageLightbox({ onClose, state }: KonvaNodeImageLightboxProps) {
  const [selectedBatchIndex, setSelectedBatchIndex] = useState(() => clampIndex(state.selectedBatchIndex ?? 0, state.batches.length))
  const [selectedIndex, setSelectedIndex] = useState(() => {
    const batch = state.batches[clampIndex(state.selectedBatchIndex ?? 0, state.batches.length)] ?? []
    return clampIndex(state.selectedIndex ?? 0, batch.length)
  })

  const selectedBatch = state.batches[selectedBatchIndex] ?? state.batches[0] ?? []
  const selectedImage = selectedBatch[selectedIndex] ?? selectedBatch[0] ?? null
  const selectedSrc = useMemo(() => getLightboxImageUrl(selectedImage), [selectedImage])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
      if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
        setSelectedIndex((current) => {
          if (current < selectedBatch.length - 1) return current + 1
          if (selectedBatchIndex >= state.batches.length - 1) return current
          setSelectedBatchIndex((batchIndex) => clampIndex(batchIndex + 1, state.batches.length))
          return 0
        })
      }
      if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
        setSelectedIndex((current) => {
          if (current > 0) return current - 1
          if (selectedBatchIndex <= 0) return current
          const previousBatch = state.batches[selectedBatchIndex - 1] ?? []
          setSelectedBatchIndex((batchIndex) => clampIndex(batchIndex - 1, state.batches.length))
          return Math.max(0, previousBatch.length - 1)
        })
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose, selectedBatch.length, selectedBatchIndex, state.batches])

  if (!selectedImage || !selectedSrc) return null

  return (
    <div className="node-image-lightbox" onMouseDown={onClose} role="presentation">
      <section
        aria-label={state.title}
        aria-modal="true"
        className="node-image-lightbox__panel"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
      >
        <header className="node-image-lightbox__header">
          <div>
            <strong>{state.title}</strong>
            <span>{getBatchLabel(selectedBatchIndex)} · {selectedIndex + 1} / {selectedBatch.length}</span>
          </div>
          <button aria-label="Close image history" onClick={onClose} type="button">
            X
          </button>
        </header>
        <div className="node-image-lightbox__body">
          <div className="node-image-lightbox__viewer-stack">
            <div className="node-image-lightbox__viewer">
              {selectedBatch.length > 1 ? (
                <>
                  <button
                    aria-label="Previous image"
                    className="node-image-lightbox__nav node-image-lightbox__nav--prev"
                    onClick={() => {
                      if (selectedIndex > 0) {
                        setSelectedIndex(selectedIndex - 1)
                        return
                      }
                      if (selectedBatchIndex <= 0) return
                      const previousBatch = state.batches[selectedBatchIndex - 1] ?? []
                      setSelectedBatchIndex(selectedBatchIndex - 1)
                      setSelectedIndex(Math.max(0, previousBatch.length - 1))
                    }}
                    type="button"
                  >
                    ‹
                  </button>
                  <button
                    aria-label="Next image"
                    className="node-image-lightbox__nav node-image-lightbox__nav--next"
                    onClick={() => {
                      if (selectedIndex < selectedBatch.length - 1) {
                        setSelectedIndex(selectedIndex + 1)
                        return
                      }
                      if (selectedBatchIndex >= state.batches.length - 1) return
                      setSelectedBatchIndex(selectedBatchIndex + 1)
                      setSelectedIndex(0)
                    }}
                    type="button"
                  >
                    ›
                  </button>
                </>
              ) : null}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img alt={selectedImage.title ?? state.title} src={selectedSrc} />
            </div>
            <div className="node-image-lightbox__filmstrip" aria-label="Selected batch images">
              {selectedBatch.map((image, index) => {
                const thumbSrc = getLightboxThumbUrl(image)
                if (!thumbSrc) return null
                return (
                  <button
                    className={index === selectedIndex ? 'is-selected' : undefined}
                    key={`${image.assetId || 'batch-image'}-${index}`}
                    onClick={() => setSelectedIndex(index)}
                    type="button"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img alt={image.title ?? `${state.title} ${index + 1}`} src={thumbSrc} />
                  </button>
                )
              })}
            </div>
          </div>
          <aside className="node-image-lightbox__history" aria-label="Image history">
            <strong>History</strong>
            <div className="node-image-lightbox__history-list">
              {state.batches.map((batch, batchIndex) => {
                const previewImages = batch.slice(0, 4)
                if (previewImages.length === 0) return null
                return (
                  <button
                    className={batchIndex === selectedBatchIndex ? 'is-selected' : undefined}
                    key={`batch-${batchIndex}-${previewImages.map((image) => image.assetId).join('-')}`}
                    onClick={() => {
                      setSelectedBatchIndex(batchIndex)
                      setSelectedIndex((current) => clampIndex(current, batch.length))
                    }}
                    type="button"
                  >
                    <span>{getBatchBadgeLabel(batchIndex)}</span>
                    <small>{batchIndex === 0 ? 'Current batch' : `History ${batchIndex}`}</small>
                    <div className="node-image-lightbox__history-grid">
                      {previewImages.map((image, imageIndex) => {
                        const thumbSrc = getLightboxThumbUrl(image)
                        if (!thumbSrc) return null
                        return (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img alt={image.title ?? `${state.title} ${imageIndex + 1}`} key={`${image.assetId || 'history'}-${imageIndex}`} src={thumbSrc} />
                        )
                      })}
                    </div>
                  </button>
                )
              })}
            </div>
          </aside>
        </div>
      </section>
    </div>
  )
}

function getLightboxImageUrl(image: RuntimeGraphImageAssetRef | null) {
  if (!image) return null
  return image.originalUrl ?? image.thumbnail1024Url ?? image.thumbnail512Url ?? image.thumbnail256Url ?? null
}

function getLightboxThumbUrl(image: RuntimeGraphImageAssetRef | null) {
  if (!image) return null
  return image.thumbnail512Url ?? image.thumbnail256Url ?? image.thumbnail1024Url ?? image.originalUrl ?? null
}

function clampIndex(value: number, length: number) {
  if (length <= 0) return 0
  return Math.min(length - 1, Math.max(0, value))
}

function getBatchLabel(batchIndex: number) {
  return batchIndex === 0 ? 'Current batch' : `History ${batchIndex}`
}

function getBatchBadgeLabel(batchIndex: number) {
  return batchIndex === 0 ? 'Now' : String(batchIndex)
}
