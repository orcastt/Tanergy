import { useCallback, useState, type Dispatch, type SetStateAction } from 'react'
import { withCanvasShapes, type CanvasDocument, type CanvasImageShape } from '@/features/canvas-engine'
import { removeBackgroundAsset } from '@/features/assets/imageOpsClient'

type KonvaHistory = {
  checkpoint: (document?: CanvasDocument) => void
}

type UseKonvaImageOpsActionsOptions = {
  document: CanvasDocument
  history: KonvaHistory
  selectedIds: string[]
  onActionError?: (message: string | null) => void
  onDocumentChange: Dispatch<SetStateAction<CanvasDocument>>
  onSelectionChange: (shapeIds: string[]) => void
}

export function useKonvaImageOpsActions({
  document,
  history,
  onActionError,
  onDocumentChange,
  onSelectionChange,
  selectedIds,
}: UseKonvaImageOpsActionsOptions) {
  const [isRemovingBackground, setIsRemovingBackground] = useState(false)
  const selectedImage = getSingleImageSelection(document, selectedIds)

  const removeBackground = useCallback(() => {
    const image = getSingleImageSelection(document, selectedIds)
    if (!image || isRemovingBackground) return
    onActionError?.(null)
    setIsRemovingBackground(true)
    void removeBackgroundAsset(image.props.assetId)
      .then((asset) => {
        history.checkpoint(document)
        const result = createCutoutImageShape(image, asset)
        onDocumentChange((current) => withCanvasShapes(current, [...current.shapes, result]))
        onSelectionChange([result.id])
      })
      .catch((error) => {
        reportActionError(error, 'Remove background failed.', onActionError)
      })
      .finally(() => setIsRemovingBackground(false))
  }, [document, history, isRemovingBackground, onActionError, onDocumentChange, onSelectionChange, selectedIds])

  return {
    canRemoveBackground: Boolean(selectedImage) && !isRemovingBackground,
    canStartObjectCutout: Boolean(selectedImage),
    isRemovingBackground,
    removeBackground,
  }
}

function reportActionError(error: unknown, fallback: string, onActionError?: (message: string | null) => void) {
  const message = error instanceof Error && error.message ? error.message : fallback
  console.warn(message)
  onActionError?.(message)
}

function getSingleImageSelection(document: CanvasDocument, selectedIds: string[]) {
  if (selectedIds.length !== 1) return null
  const shape = document.shapes.find((item): item is CanvasImageShape => item.id === selectedIds[0] && item.type === 'image')
  return shape && !shape.props.assetId.startsWith('remote-') ? shape : null
}

function createCutoutImageShape(source: CanvasImageShape, asset: {
  height: number
  id: string
  mime: string
  originalUrl: string
  thumbnail1024Url?: string
  thumbnail256Url?: string
  thumbnail512Url?: string
  title: string
  width: number
}): CanvasImageShape {
  return {
    id: `image-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    props: {
      assetId: asset.id,
      crop: source.props.crop,
      height: source.props.height,
      mime: asset.mime,
      originalUrl: asset.originalUrl,
      thumbnail1024Url: asset.thumbnail1024Url,
      thumbnail256Url: asset.thumbnail256Url,
      thumbnail512Url: asset.thumbnail512Url,
      title: asset.title || 'Background removed',
      width: source.props.width,
    },
    rotation: source.rotation,
    style: source.style,
    type: 'image',
    x: source.x + 24,
    y: source.y + 24,
  }
}
