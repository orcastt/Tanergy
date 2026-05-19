import type { CanvasDocument, CanvasShape } from '@/features/canvas-engine'
import { Group, Rect, Text } from 'react-konva'
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
  if (draft.type === 'text') {
    return (
      <Group x={draft.x} y={draft.y}>
        <Rect
          cornerRadius={4}
          dash={[6 / Math.max(zoom, 0.1), 4 / Math.max(zoom, 0.1)]}
          fill="rgba(255,255,255,0.72)"
          height={draft.props.height}
          stroke="rgba(17,24,39,0.38)"
          strokeWidth={1 / Math.max(zoom, 0.1)}
          width={draft.props.width}
        />
        <Text
          fill="rgba(17,24,39,0.36)"
          fontFamily="Inter, system-ui, sans-serif"
          fontSize={14 / Math.max(zoom, 0.1)}
          listening={false}
          text="Text"
          x={12 / Math.max(zoom, 0.1)}
          y={12 / Math.max(zoom, 0.1)}
        />
      </Group>
    )
  }

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
