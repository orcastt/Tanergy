import { useState, type CSSProperties, type Dispatch, type ReactNode, type SetStateAction, type SyntheticEvent } from 'react'
import type { CanvasDocument, CanvasShapeStyle } from '@/features/canvas-engine'
import type { KonvaCanvasTool } from './konvaCanvasTypes'
import { konvaToolLabels } from './konvaCanvasTypes'
import {
  applyKonvaStylePatch,
  deleteKonvaShapes,
  duplicateKonvaShapes,
  getKonvaSelectionStyleSnapshot,
  getWidthStyleToken,
  isKonvaDashShape,
  isKonvaFillShape,
  isKonvaStrokeShape,
  isKonvaWidthShape,
  konvaDashStyles,
  konvaFillStyles,
  konvaStrokeColors,
  konvaWidthStyles,
  reorderKonvaShapes,
  type KonvaCanvasWidthStyle,
} from './konvaCanvasStyle'

type KonvaCanvasPropertiesProps = {
  activeTool: KonvaCanvasTool
  document: CanvasDocument
  nextStyle: CanvasShapeStyle
  selectedIds: string[]
  onDocumentChange: Dispatch<SetStateAction<CanvasDocument>>
  onHistoryCheckpoint: (document: CanvasDocument) => void
  onNextStyleChange: Dispatch<SetStateAction<CanvasShapeStyle>>
  onSelectionChange: (shapeIds: string[]) => void
}

const widthValueByStyle: Record<KonvaCanvasWidthStyle, number> = {
  l: 4,
  m: 2,
  s: 1,
  xl: 6,
}

export function KonvaCanvasProperties({
  activeTool,
  document,
  onHistoryCheckpoint,
  nextStyle,
  onDocumentChange,
  onNextStyleChange,
  onSelectionChange,
  selectedIds,
}: KonvaCanvasPropertiesProps) {
  const [isOpen, setIsOpen] = useState(true)
  const selectedShapes = document.shapes.filter((shape) => selectedIds.includes(shape.id))
  const hasSelection = selectedShapes.length > 0
  const styleSnapshot = getKonvaSelectionStyleSnapshot(selectedShapes, nextStyle)
  const showStroke = hasSelection ? selectedShapes.some(isKonvaStrokeShape) : toolUsesStroke(activeTool)
  const showFill = hasSelection ? selectedShapes.some(isKonvaFillShape) : toolUsesFill(activeTool)
  const showDash = hasSelection ? selectedShapes.some(isKonvaDashShape) : toolUsesDash(activeTool)
  const showWidth = hasSelection ? selectedShapes.some(isKonvaWidthShape) : toolUsesWidth(activeTool)
  const headerNote = hasSelection ? `Selected · ${selectedShapes.length}` : `${konvaToolLabels[activeTool]} styles`
  const fillToken = styleSnapshot.fillStyle === 'mixed' ? null : styleSnapshot.fillStyle
  const dashToken = styleSnapshot.dash === 'mixed' ? null : styleSnapshot.dash
  const widthToken = styleSnapshot.strokeWidth === 'mixed' ? null : getWidthStyleToken(styleSnapshot.strokeWidth)
  const opacity = styleSnapshot.opacity === 'mixed' ? 100 : Math.round((styleSnapshot.opacity ?? 1) * 100)

  const applyStyle = (patch: CanvasShapeStyle) => {
    onNextStyleChange((current) => ({ ...current, ...patch }))
    if (selectedIds.length > 0) {
      onHistoryCheckpoint(document)
      onDocumentChange((current) => applyKonvaStylePatch(current, selectedIds, patch))
    }
  }

  const runDocumentAction = (action: 'delete' | 'duplicate' | 'layer-back' | 'layer-backward' | 'layer-forward' | 'layer-front') => {
    if (selectedIds.length === 0) return
    onHistoryCheckpoint(document)
    if (action === 'duplicate') {
      const result = duplicateKonvaShapes(document, selectedIds)
      onDocumentChange(result.document)
      onSelectionChange(result.selectedIds)
      return
    }
    if (action === 'delete') {
      const result = deleteKonvaShapes(document, selectedIds)
      onDocumentChange(result.document)
      onSelectionChange(result.selectedIds)
      return
    }
    const layerAction = action.replace('layer-', '') as 'back' | 'backward' | 'forward' | 'front'
    onDocumentChange((current) => reorderKonvaShapes(current, selectedIds, layerAction))
  }

  return (
    <aside
      aria-label="Konva canvas properties"
      className="konva-canvas-properties-drawer"
      data-open={isOpen ? 'true' : 'false'}
      onContextMenu={stopCanvasEvent}
      onDoubleClick={stopCanvasEvent}
      onPointerDown={stopCanvasEvent}
      onWheel={stopCanvasEvent}
    >
      <button
        aria-label={isOpen ? 'Collapse properties' : 'Expand properties'}
        className="konva-canvas-properties-drawer__handle"
        onClick={() => setIsOpen((open) => !open)}
        title={isOpen ? 'Collapse properties' : 'Expand properties'}
        type="button"
      >
        <span aria-hidden>{isOpen ? '‹' : '›'}</span>
      </button>
      {isOpen ? (
        <div className="konva-canvas-properties">
          <div className="konva-canvas-properties__header">
            <span>Properties</span>
            <small>{headerNote}</small>
          </div>

          {showStroke ? (
            <PropertyBlock label="Stroke">
              <div className="konva-canvas-properties__swatches">
                {konvaStrokeColors.map((item) => (
                  <button
                    aria-label={item.label}
                    className={styleSnapshot.stroke === item.value ? 'is-active' : undefined}
                    data-tooltip={item.label}
                    key={item.value}
                    onClick={() => applyStyle({ stroke: item.value })}
                    style={{ '--swatch': item.swatch } as CSSProperties}
                    type="button"
                  />
                ))}
              </div>
            </PropertyBlock>
          ) : null}

          {showFill ? (
            <PropertyBlock label="Fill">
              <SegmentedButtons>
                {konvaFillStyles.map((item) => (
                  <IconButton
                    active={fillToken === item.value}
                    icon={`style-icon style-icon--fill-${item.value}`}
                    key={item.value}
                    label={item.label}
                    onClick={() => applyStyle({ fillStyle: item.value })}
                  />
                ))}
              </SegmentedButtons>
            </PropertyBlock>
          ) : null}

          {showWidth ? (
            <PropertyBlock label="Width">
              <SegmentedButtons>
                {konvaWidthStyles.map((item) => (
                  <IconButton
                    active={widthToken === item.value}
                    icon="style-icon"
                    iconData={`size-${item.value}`}
                    key={item.value}
                    label={item.label}
                    onClick={() => applyStyle({ strokeWidth: widthValueByStyle[item.value] })}
                  />
                ))}
              </SegmentedButtons>
            </PropertyBlock>
          ) : null}

          {showDash ? (
            <PropertyBlock label="Dash">
              <SegmentedButtons>
                {konvaDashStyles.map((item) => (
                  <IconButton
                    active={dashToken === item.value}
                    icon="style-icon"
                    iconData={`dash-${item.value}`}
                    key={item.value}
                    label={item.label}
                    onClick={() => applyStyle({ dash: item.value })}
                  />
                ))}
              </SegmentedButtons>
            </PropertyBlock>
          ) : null}

          <PropertyBlock label="Opacity">
            <div className="konva-canvas-properties__range-row">
              <input
                aria-label="Opacity"
                max={100}
                min={10}
                onChange={(event) => applyStyle({ opacity: Number(event.currentTarget.value) / 100 })}
                type="range"
                value={opacity}
              />
              <span>{styleSnapshot.opacity === 'mixed' ? 'Mixed' : opacity}</span>
            </div>
          </PropertyBlock>

          {hasSelection ? (
            <>
              <PropertyBlock label="Layer">
                <IconGrid>
                  <IconButton icon="style-action-icon style-action-icon--layer-back" label="Send to back" onClick={() => runDocumentAction('layer-back')} />
                  <IconButton icon="style-action-icon style-action-icon--layer-down" label="Send backward" onClick={() => runDocumentAction('layer-backward')} />
                  <IconButton icon="style-action-icon style-action-icon--layer-up" label="Bring forward" onClick={() => runDocumentAction('layer-forward')} />
                  <IconButton icon="style-action-icon style-action-icon--layer-front" label="Bring to front" onClick={() => runDocumentAction('layer-front')} />
                </IconGrid>
              </PropertyBlock>

              <PropertyBlock label="Actions">
                <IconGrid>
                  <IconButton icon="style-action-icon style-action-icon--duplicate" label="Duplicate" onClick={() => runDocumentAction('duplicate')} />
                  <IconButton icon="style-action-icon style-action-icon--delete" label="Delete" onClick={() => runDocumentAction('delete')} />
                </IconGrid>
              </PropertyBlock>
            </>
          ) : null}
        </div>
      ) : null}
    </aside>
  )
}

function PropertyBlock({ children, label }: { children: ReactNode; label: string }) {
  return (
    <section className="konva-canvas-properties__block">
      <p>{label}</p>
      {children}
    </section>
  )
}

function SegmentedButtons({ children }: { children: ReactNode }) {
  return <div className="konva-canvas-properties__segmented">{children}</div>
}

function IconGrid({ children }: { children: ReactNode }) {
  return <div className="konva-canvas-properties__icon-grid">{children}</div>
}

function IconButton({
  active,
  icon,
  iconData,
  label,
  onClick,
}: {
  active?: boolean
  icon: string
  iconData?: string
  label: string
  onClick: () => void
}) {
  return (
    <button aria-label={label} className={active ? 'is-active' : undefined} data-tooltip={label} onClick={onClick} type="button">
      <span aria-hidden className={icon} data-style-icon={iconData} />
    </button>
  )
}

function toolUsesFill(tool: KonvaCanvasTool) {
  return tool === 'rect' || tool === 'diamond' || tool === 'ellipse' || tool === 'triangle' || tool === 'cloud' || tool === 'sticky'
}

function toolUsesStroke(tool: KonvaCanvasTool) {
  return tool !== 'hand' && tool !== 'select' && tool !== 'eraser'
}

function toolUsesWidth(tool: KonvaCanvasTool) {
  return toolUsesStroke(tool) && tool !== 'text'
}

function toolUsesDash(tool: KonvaCanvasTool) {
  return toolUsesWidth(tool) && tool !== 'draw'
}

function stopCanvasEvent(event: SyntheticEvent) {
  event.stopPropagation()
}
