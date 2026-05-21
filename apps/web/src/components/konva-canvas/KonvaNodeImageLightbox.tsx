'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { firstSafeImageDisplayUrl, safeExternalOpenUrl } from '@/features/security/safeUrl'
import type { RuntimeGraphImageAssetRef } from '@/features/node-runtime/runtimeGraphAssets'
import { copyKonvaPngBlobToClipboard, downloadKonvaBlob } from './konvaSelectionExport'

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
  const canNavigateBatch = state.batches.length > 1

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
          <div className="node-image-lightbox__title">
            <strong>{state.title}</strong>
            <span>{getBatchLabel(selectedBatchIndex)} · {selectedIndex + 1} / {selectedBatch.length}</span>
          </div>
          <div className="node-image-lightbox__actions">
            <LightboxActionButton
              icon={<LightboxCopyIcon />}
              label="Copy image"
              onClick={() => {
                void loadLightboxImageBlob(selectedSrc)
                  .then(copyKonvaPngBlobToClipboard)
                  .catch(() => {})
              }}
            />
            <LightboxActionButton
              icon={<LightboxDownloadIcon />}
              label="Download image"
              onClick={() => {
                void loadLightboxImageBlob(selectedSrc)
                  .then((blob) => downloadKonvaBlob(blob, getLightboxFileName(state.title, selectedImage)))
                  .catch(() => openLightboxImage(selectedSrc))
              }}
            />
            <LightboxActionButton
              icon={<LightboxOpenIcon />}
              label="Open image in new tab"
              onClick={() => openLightboxImage(selectedSrc)}
            />
            <LightboxActionButton
              icon={<LightboxCloseIcon />}
              label="Close image lightbox"
              onClick={onClose}
            />
          </div>
        </header>
        {canNavigateBatch ? (
          <div className="node-image-lightbox__batch-strip" aria-label="Image batches">
            {state.batches.map((batch, batchIndex) => (
              <button
                className={batchIndex === selectedBatchIndex ? 'is-selected' : undefined}
                key={`batch-${batchIndex}-${batch[0]?.assetId ?? batchIndex}`}
                onClick={() => {
                  setSelectedBatchIndex(batchIndex)
                  setSelectedIndex(0)
                }}
                type="button"
              >
                <strong>{getBatchBadgeLabel(batchIndex)}</strong>
                <span>{getBatchLabel(batchIndex)}</span>
              </button>
            ))}
          </div>
        ) : null}
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
        </div>
      </section>
    </div>
  )
}

function getLightboxImageUrl(image: RuntimeGraphImageAssetRef | null) {
  if (!image) return null
  return firstSafeImageDisplayUrl(image.originalUrl, image.thumbnail1024Url, image.thumbnail512Url, image.thumbnail256Url)
}

function getLightboxThumbUrl(image: RuntimeGraphImageAssetRef | null) {
  if (!image) return null
  return firstSafeImageDisplayUrl(image.thumbnail512Url, image.thumbnail256Url, image.thumbnail1024Url, image.originalUrl)
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

async function loadLightboxImageBlob(src: string) {
  const response = await fetch(src)
  if (!response.ok) throw new Error('Lightbox image download failed.')
  return response.blob()
}

function openLightboxImage(src: string) {
  const safeSrc = safeExternalOpenUrl(src)
  if (!safeSrc) return
  window.open(safeSrc, '_blank', 'noopener,noreferrer')
}

function getLightboxFileName(title: string, image: RuntimeGraphImageAssetRef) {
  const base = (image.title ?? title ?? 'image')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'image'
  return `${base}.png`
}

function LightboxActionButton({
  icon,
  label,
  onClick,
}: {
  icon: ReactNode
  label: string
  onClick: () => void
}) {
  return (
    <button
      aria-label={label}
      className="node-image-lightbox__action-button"
      data-tooltip={label}
      onClick={onClick}
      title={label}
      type="button"
    >
      {icon}
    </button>
  )
}

function LightboxCopyIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 20 20">
      <rect height="9" rx="2" stroke="currentColor" strokeWidth="1.6" width="9" x="7" y="7" />
      <path d="M5.5 13H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v.5" stroke="currentColor" strokeLinecap="round" strokeWidth="1.6" />
    </svg>
  )
}

function LightboxDownloadIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 20 20">
      <path d="M10 3.5v8" stroke="currentColor" strokeLinecap="round" strokeWidth="1.6" />
      <path d="M6.8 8.7 10 11.9l3.2-3.2" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" />
      <path d="M4 14.5h12" stroke="currentColor" strokeLinecap="round" strokeWidth="1.6" />
    </svg>
  )
}

function LightboxOpenIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 20 20">
      <path d="M11.5 4H16v4.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" />
      <path d="M9 11 16 4" stroke="currentColor" strokeLinecap="round" strokeWidth="1.6" />
      <rect height="9" rx="2" stroke="currentColor" strokeWidth="1.6" width="9" x="4" y="7" />
    </svg>
  )
}

function LightboxCloseIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 20 20">
      <path d="M5.5 5.5 14.5 14.5" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" />
      <path d="M14.5 5.5 5.5 14.5" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" />
    </svg>
  )
}
