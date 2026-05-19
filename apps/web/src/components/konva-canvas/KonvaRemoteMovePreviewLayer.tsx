import { memo } from 'react'
import { Group } from 'react-konva'
import type { CanvasDocument } from '@/features/canvas-engine'
import { KonvaCanvasShape } from './KonvaCanvasShape'
import { KonvaNodeEdgeLayer } from './KonvaNodeEdgeLayer'
import type { KonvaRemoteMovePreview } from './konvaRemoteMovePreview'

type KonvaRemoteMovePreviewLayerProps = {
  document: CanvasDocument
  previews: readonly KonvaRemoteMovePreview[]
  zoom: number
}

const noop = () => undefined
const remoteMoveOpacity = 0.68

export const KonvaRemoteMovePreviewLayer = memo(function KonvaRemoteMovePreviewLayer({
  document,
  previews,
  zoom,
}: KonvaRemoteMovePreviewLayerProps) {
  return (
    <>
      {previews.map((preview) => (
        <Group key={preview.key} listening={false} opacity={remoteMoveOpacity}>
          {preview.edges.length > 0 ? (
            <KonvaNodeEdgeLayer
              edges={preview.edges}
              interactive={false}
              selectedEdgeId={null}
              shapes={preview.nodeShapes}
              zoom={zoom}
            />
          ) : null}
          {preview.shapes.map((shape) => (
            <KonvaCanvasShape
              document={document}
              editingNodeTextField={null}
              hideEditableText={false}
              interactive={false}
              isSelected={false}
              key={`${preview.key}:${shape.id}`}
              onDoubleClick={noop}
              onDragEnd={noop}
              onDragMove={noop}
              onDragStart={noop}
              onSelect={noop}
              panMode={false}
              previewMode={false}
              selectable={false}
              shape={shape}
              toolAllowsDrag={false}
              zoom={zoom}
            />
          ))}
        </Group>
      ))}
    </>
  )
})
