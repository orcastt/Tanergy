import type { CanvasShape, CanvasShapeStyle } from '@/features/canvas-engine'
import type { KonvaCanvasStyleSnapshot } from './konvaCanvasStyle'
import { isKonvaTextStyleShape, type KonvaCanvasTextAlign } from './konvaCanvasStyle'
import { IconButton, PropertyBlock, SegmentedButtons } from './KonvaPropertiesPrimitives'

type KonvaPropertiesFontProps = {
  selectedShapes: CanvasShape[]
  styleSnapshot: KonvaCanvasStyleSnapshot
  onApplyStyle: (patch: CanvasShapeStyle) => void
}

const textAlignOptions: Array<{ icon: string; label: string; value: KonvaCanvasTextAlign }> = [
  { icon: 'style-action-icon style-action-icon--align-left', label: 'Align text left', value: 'left' },
  { icon: 'style-action-icon style-action-icon--align-center-x', label: 'Align text center', value: 'center' },
  { icon: 'style-action-icon style-action-icon--align-right', label: 'Align text right', value: 'right' },
]

export function KonvaPropertiesFont({ onApplyStyle, selectedShapes, styleSnapshot }: KonvaPropertiesFontProps) {
  if (!selectedShapes.some(isKonvaTextStyleShape)) return null
  const fontSize = styleSnapshot.fontSize === 'mixed' ? 18 : styleSnapshot.fontSize ?? 18
  const textAlign = styleSnapshot.textAlign === 'mixed' ? null : styleSnapshot.textAlign ?? null

  return (
    <PropertyBlock label="Text">
      <div className="konva-canvas-properties__range-row">
        <input
          aria-label="Font size"
          max={72}
          min={10}
          onChange={(event) => onApplyStyle({ fontSize: Number(event.currentTarget.value) })}
          step={1}
          type="range"
          value={fontSize}
        />
        <span>{styleSnapshot.fontSize === 'mixed' ? 'Mixed' : fontSize}</span>
      </div>
      <SegmentedButtons>
        {textAlignOptions.map((item) => (
          <IconButton
            active={textAlign === item.value}
            icon={item.icon}
            key={item.value}
            label={item.label}
            onClick={() => onApplyStyle({ textAlign: item.value })}
          />
        ))}
      </SegmentedButtons>
    </PropertyBlock>
  )
}
