import type { CanvasDocument, CanvasShape } from '@/features/canvas-engine'
import { KonvaCanvasShape } from './KonvaCanvasShape'

type KonvaLocalDraftLayerProps = {
  document: CanvasDocument
  draft: CanvasShape
  panMode: boolean
  zoom: number
}

const noop = () => undefined

export function KonvaLocalDraftLayer({
  document,
  draft,
  panMode,
  zoom,
}: KonvaLocalDraftLayerProps) {
  return (
    <KonvaCanvasShape
      document={document}
      editingNodeTextField={null}
      hideEditableText={false}
      interactive={false}
      isSelected={false}
      onDoubleClick={noop}
      onDragEnd={noop}
      onDragMove={noop}
      onDragStart={noop}
      onSelect={noop}
      panMode={panMode}
      previewMode={false}
      selectable={false}
      shape={draft}
      toolAllowsDrag={false}
      zoom={zoom}
    />
  )
}
