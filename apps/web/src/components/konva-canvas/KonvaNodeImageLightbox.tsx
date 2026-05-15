'use client'

import { useEffect, useMemo, useState } from 'react'
import type { RuntimeGraphImageAssetRef } from '@/features/node-runtime/runtimeGraphAssets'

export type KonvaNodeImageLightboxState = {
  images: RuntimeGraphImageAssetRef[]
  selectedIndex?: number
  title: string
}

type KonvaNodeImageLightboxProps = {
  onClose: () => void
  state: KonvaNodeImageLightboxState
}

export function KonvaNodeImageLightbox({ onClose, state }: KonvaNodeImageLightboxProps) {
  const [selectedIndex, setSelectedIndex] = useState(() => clampIndex(state.selectedIndex ?? 0, state.images.length))

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
      if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
        setSelectedIndex((current) => clampIndex(current + 1, state.images.length))
      }
      if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
        setSelectedIndex((current) => clampIndex(current - 1, state.images.length))
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose, state.images.length])

  const selectedImage = state.images[selectedIndex] ?? state.images[0] ?? null
  const selectedSrc = useMemo(() => getLightboxImageUrl(selectedImage), [selectedImage])

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
            <span>{selectedIndex + 1} / {state.images.length}</span>
          </div>
          <button aria-label="Close image history" onClick={onClose} type="button">
            X
          </button>
        </header>
        <div className="node-image-lightbox__body">
        <div className="node-image-lightbox__viewer">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img alt={selectedImage.title ?? state.title} src={selectedSrc} />
        </div>
          <aside className="node-image-lightbox__history" aria-label="Image history">
            <strong>History</strong>
            <div className="node-image-lightbox__history-list">
              {state.images.map((image, index) => {
                const thumbSrc = getLightboxThumbUrl(image)
                if (!thumbSrc) return null
                return (
                  <button
                    className={index === selectedIndex ? 'is-selected' : undefined}
                    key={`${image.assetId || 'image'}-${index}`}
                    onClick={() => setSelectedIndex(index)}
                    type="button"
                  >
                    <span>{state.images.length - index}</span>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img alt={image.title ?? `${state.title} ${index + 1}`} src={thumbSrc} />
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
