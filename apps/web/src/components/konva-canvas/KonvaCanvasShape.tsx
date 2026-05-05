import { memo, useMemo, useRef } from 'react'
import type Konva from 'konva'
import type { KonvaEventObject } from 'konva/lib/Node'
import { Circle, Ellipse, Group, Line, Path, Rect, Text } from 'react-konva'
import type { CanvasDocument, CanvasShape } from '@/features/canvas-engine'
import { getKonvaShapeFontSize, getKonvaShapeTextAlign, getStickyFillColor, getStrokeDash, resolveKonvaShapeStyle } from './konvaCanvasStyle'
import { getLineArrowHeadAnchor, getLineHead, getLinePathData, getLineStartHeadAnchor, type KonvaLineShape } from './konvaLineRouteUtils'
import { KonvaImageShape } from './KonvaImageShape'
import { KonvaNodeCardShape } from './KonvaNodeCardShape'
import type { KonvaNodeTextFieldName } from './KonvaNodeTextEditor'
import { KonvaShapeLabel } from './KonvaShapeLabel'
import { getPatternTile } from './konvaPatternUtils'
import { getArrowHeadPoints, getCloudPath, getFreehandPath } from './konvaPathUtils'
import { isBoxCanvasShape } from './konvaRotationUtils'
import { canKonvaShapeFlip, canKonvaShapeRotate } from './konvaShapeCapabilities'
type KonvaCanvasShapeProps = {
  interactive?: boolean
  isSelected: boolean
  isDragSelected?: boolean
  panMode: boolean
  selectable?: boolean
  document: CanvasDocument
  editingNodeTextField?: KonvaNodeTextFieldName | null
  hideEditableText?: boolean
  directDrag?: boolean
  shape: CanvasShape
  toolAllowsDrag: boolean
  zoom: number
  onDragMove: (shapeId: string, x: number, y: number) => void
  onDragStart: (shapeId: string, config?: { duplicate?: boolean }) => { lockSource?: boolean } | void
  onDragEnd: (shapeId: string, x: number, y: number) => void
  onDoubleClick: (shapeId: string) => void
  onNodeChatClean?: (shapeId: string) => void
  onNodeChatExportToggle?: (shapeId: string, messageId: string) => void
  onNodeChatSend?: (shapeId: string) => void
  onNodeChatUpload?: (shapeId: string) => void
  onNodeFieldChange?: (shapeId: string, fieldName: string, value: string | number) => void
  onImageNodeToCanvas?: (shapeId: string) => void
  onNodePortPointerDown?: (shapeId: string, portId: string, event: KonvaEventObject<PointerEvent>) => void
  onNodeRunToggle?: (shapeId: string) => void
  onNodeTextEditStart?: (shapeId: string, fieldName: KonvaNodeTextFieldName) => void
  onSelect: (shapeId: string, options?: { additive?: boolean }) => void
  previewMode?: boolean
}

function KonvaCanvasShapeComponent({
  interactive = true,
  isSelected,
  isDragSelected = isSelected,
  document,
  directDrag = false,
  editingNodeTextField = null,
  hideEditableText = false,
  onDragMove,
  onDragStart,
  onDragEnd,
  onDoubleClick,
  onImageNodeToCanvas,
  onNodeChatClean,
  onNodeChatExportToggle,
  onNodeChatSend,
  onNodeChatUpload,
  onNodeFieldChange,
  onNodePortPointerDown,
  onNodeRunToggle,
  onNodeTextEditStart,
  onSelect,
  panMode,
  previewMode = false,
  selectable = true,
  shape,
  toolAllowsDrag,
  zoom,
}: KonvaCanvasShapeProps) {
  const style = useMemo(() => resolveKonvaShapeStyle(shape.style), [shape.style])
  const renderedShape = useMemo(
    () => renderShape(document, shape, style, isSelected, zoom, previewMode, hideEditableText, editingNodeTextField, onNodeFieldChange, onImageNodeToCanvas, onNodePortPointerDown, onNodeRunToggle, onNodeChatSend, onNodeChatClean, onNodeChatExportToggle, onNodeChatUpload, onNodeTextEditStart),
    [document, editingNodeTextField, hideEditableText, isSelected, onImageNodeToCanvas, onNodeChatClean, onNodeChatExportToggle, onNodeChatSend, onNodeChatUpload, onNodeFieldChange, onNodePortPointerDown, onNodeRunToggle, onNodeTextEditStart, previewMode, shape, style, zoom]
  )
  const canInteract = interactive && !panMode
  const canSelect = canInteract && selectable
  const transform = getGroupTransform(shape)
  const canDragShape = canInteract && toolAllowsDrag && (directDrag || isDragSelected) && !shape.isLocked
  const selectOnPointerDown = canSelect && (directDrag || (toolAllowsDrag && isDragSelected))
  const selectOnClick = canSelect && !selectOnPointerDown
  const lockDragSourceRef = useRef(false)
  const lockedDragRef = useRef<LockedDragState | null>(null)
  return (
    <Group
      draggable={canDragShape}
      id={`shape:${shape.id}`}
      key={shape.id}
      listening={interactive}
      name="konva-canvas-shape"
      onClick={selectOnClick ? (event) => {
        if (event.evt.button !== 0) return
        event.cancelBubble = true
        onSelect(shape.id, { additive: event.evt.shiftKey })
      } : undefined}
      onDragMove={canInteract ? (event) => {
        const point = lockDragSourceRef.current
          ? getLockedDragPoint(event.target, lockedDragRef.current) ?? getDragPoint(event.target, transform)
          : getDragPoint(event.target, transform)
        if (lockDragSourceRef.current && lockedDragRef.current) lockedDragRef.current.lastPoint = point
        onDragMove(shape.id, point.x, point.y)
        if (lockDragSourceRef.current) resetDragSource(event.target, transform)
      } : undefined}
      onDragStart={canInteract ? (event) => {
        lockDragSourceRef.current = Boolean(onDragStart(shape.id, { duplicate: event.evt.altKey })?.lockSource)
        lockedDragRef.current = lockDragSourceRef.current ? createLockedDragState(event.target, shape) : null
        if (lockDragSourceRef.current) resetDragSource(event.target, transform)
      } : undefined}
      onDragEnd={canInteract ? (event) => {
        const point = lockDragSourceRef.current
          ? lockedDragRef.current?.lastPoint ?? getLockedDragPoint(event.target, lockedDragRef.current) ?? getDragPoint(event.target, transform)
          : getDragPoint(event.target, transform)
        onDragEnd(shape.id, point.x, point.y)
        if (lockDragSourceRef.current) resetDragSource(event.target, transform)
        lockDragSourceRef.current = false
        lockedDragRef.current = null
      } : undefined}
      onDblClick={canSelect ? (event) => {
        event.cancelBubble = true
        onDoubleClick(shape.id)
      } : undefined}
      onPointerDown={selectOnPointerDown ? (event) => {
        if (event.evt.button !== 0) return
        event.cancelBubble = true
        onSelect(shape.id, { additive: event.evt.shiftKey })
      } : undefined}
      offsetX={transform.offsetX}
      offsetY={transform.offsetY}
      rotation={transform.rotation}
      scaleX={transform.scaleX}
      scaleY={transform.scaleY}
      x={transform.x}
      y={transform.y}
    >
      {renderedShape}
    </Group>
  )
}
export const KonvaCanvasShape = memo(KonvaCanvasShapeComponent, areShapePropsEqual)
function areShapePropsEqual(previous: KonvaCanvasShapeProps, next: KonvaCanvasShapeProps) {
  if (previous.interactive !== next.interactive) return false
  if (previous.document !== next.document) return false
  if (previous.directDrag !== next.directDrag) return false
  if (previous.editingNodeTextField !== next.editingNodeTextField) return false
  if (previous.hideEditableText !== next.hideEditableText) return false
  if (previous.shape !== next.shape) return false
  if (previous.isSelected !== next.isSelected) return false
  if (previous.isDragSelected !== next.isDragSelected) return false
  if (previous.panMode !== next.panMode) return false
  if (previous.selectable !== next.selectable) return false
  if (previous.toolAllowsDrag !== next.toolAllowsDrag) return false
  if (previous.onDoubleClick !== next.onDoubleClick) return false
  if (previous.onNodeChatClean !== next.onNodeChatClean) return false
  if (previous.onNodeChatExportToggle !== next.onNodeChatExportToggle) return false
  if (previous.onNodeChatSend !== next.onNodeChatSend) return false
  if (previous.onNodeChatUpload !== next.onNodeChatUpload) return false
  if (previous.onNodeFieldChange !== next.onNodeFieldChange) return false
  if (previous.onImageNodeToCanvas !== next.onImageNodeToCanvas) return false
  if (previous.onNodePortPointerDown !== next.onNodePortPointerDown) return false
  if (previous.onNodeRunToggle !== next.onNodeRunToggle) return false
  if (previous.onNodeTextEditStart !== next.onNodeTextEditStart) return false
  if (previous.previewMode !== next.previewMode) return false
  if (usesZoomPreviewTier(next.shape) && getZoomPreviewTier(previous.zoom) !== getZoomPreviewTier(next.zoom)) return false
  if (next.isSelected && previous.zoom !== next.zoom) return false
  return true
}

function usesZoomPreviewTier(shape: CanvasShape) {
  return shape.type === 'image' || shape.type === 'node_card'
}

function getZoomPreviewTier(zoom: number) {
  if (zoom <= 0.25) return 'tiny'
  if (zoom <= 0.5) return 'small'
  if (zoom <= 1) return 'medium'
  return 'full'
}

function renderShape(
  document: CanvasDocument,
  shape: CanvasShape,
  style: ReturnType<typeof resolveKonvaShapeStyle>,
  isSelected: boolean,
  zoom: number,
  previewMode: boolean,
  hideEditableText: boolean,
  editingNodeTextField: KonvaNodeTextFieldName | null,
  onNodeFieldChange?: KonvaCanvasShapeProps['onNodeFieldChange'],
  onImageNodeToCanvas?: KonvaCanvasShapeProps['onImageNodeToCanvas'],
  onNodePortPointerDown?: KonvaCanvasShapeProps['onNodePortPointerDown'],
  onNodeRunToggle?: KonvaCanvasShapeProps['onNodeRunToggle'],
  onNodeChatSend?: KonvaCanvasShapeProps['onNodeChatSend'],
  onNodeChatClean?: KonvaCanvasShapeProps['onNodeChatClean'],
  onNodeChatExportToggle?: KonvaCanvasShapeProps['onNodeChatExportToggle'],
  onNodeChatUpload?: KonvaCanvasShapeProps['onNodeChatUpload'],
  onNodeTextEditStart?: KonvaCanvasShapeProps['onNodeTextEditStart']
) {
  const highlightStroke = '#6b5cff'
  const { dash, fill, fillStyle, opacity, stroke, strokeWidth } = style
  const strokeDash = getStrokeDash(dash, strokeWidth)
  const highlightWidth = Math.max(strokeWidth + 4 / zoom, strokeWidth * 2.4)
  const closedFillProps = getClosedFillProps(fill, fillStyle, stroke)
  const strokeLineCap = dash === 'dotted' ? 'round' : 'butt'
  const fontSize = getKonvaShapeFontSize(shape)
  const textAlign = getKonvaShapeTextAlign(shape)
  if (shape.type === 'rect') {
    return (
      <>
        <Rect {...closedFillProps} cornerRadius={10} dash={strokeDash} height={shape.props.height} opacity={opacity} stroke={stroke} strokeWidth={strokeWidth} width={shape.props.width} />
        {hideEditableText ? null : <KonvaShapeLabel fill={stroke} fontSize={fontSize} height={shape.props.height} opacity={opacity} text={shape.props.text} textAlign={textAlign} width={shape.props.width} />}
      </>
    )
  }
  if (shape.type === 'ellipse') {
    return (
      <>
        <Ellipse {...closedFillProps} dash={strokeDash} opacity={opacity} radiusX={shape.props.width / 2} radiusY={shape.props.height / 2} stroke={stroke} strokeWidth={strokeWidth} x={shape.props.width / 2} y={shape.props.height / 2} />
        {hideEditableText ? null : <KonvaShapeLabel fill={stroke} fontSize={fontSize} height={shape.props.height} opacity={opacity} text={shape.props.text} textAlign={textAlign} width={shape.props.width} />}
      </>
    )
  }
  if (shape.type === 'diamond') {
    const { height, width } = shape.props
    return (
      <>
        <Line {...closedFillProps} closed dash={strokeDash} lineCap={strokeLineCap} opacity={opacity} points={[width / 2, 0, width, height / 2, width / 2, height, 0, height / 2]} stroke={stroke} strokeWidth={strokeWidth} />
        {hideEditableText ? null : <KonvaShapeLabel fill={stroke} fontSize={fontSize} height={height} opacity={opacity} text={shape.props.text} textAlign={textAlign} width={width} />}
      </>
    )
  }
  if (shape.type === 'triangle') {
    const { height, width } = shape.props
    return (
      <>
        <Line {...closedFillProps} closed dash={strokeDash} lineCap={strokeLineCap} opacity={opacity} points={[width / 2, 0, width, height, 0, height]} stroke={stroke} strokeWidth={strokeWidth} />
        {hideEditableText ? null : <KonvaShapeLabel fill={stroke} fontSize={fontSize} height={height} opacity={opacity} text={shape.props.text} textAlign={textAlign} width={width} />}
      </>
    )
  }
  if (shape.type === 'cloud') {
    return (
      <>
        <Path {...closedFillProps} dash={strokeDash} data={getCloudPath(shape.props.width, shape.props.height)} opacity={opacity} stroke={stroke} strokeWidth={strokeWidth} />
        {hideEditableText ? null : <KonvaShapeLabel fill={stroke} fontSize={fontSize} height={shape.props.height} opacity={opacity} text={shape.props.text} textAlign={textAlign} width={shape.props.width} />}
      </>
    )
  }
  if (shape.type === 'frame') {
    return (
      <>
        <Rect dash={strokeDash} fill="#ffffff" height={shape.props.height} hitStrokeWidth={16} opacity={opacity} stroke={stroke} strokeWidth={strokeWidth} width={shape.props.width} />
        {hideEditableText ? null : <Text fill="#111827" fontFamily="Inter, system-ui, sans-serif" fontSize={14} fontStyle="500" opacity={opacity} text={shape.props.title ?? 'Frame'} width={shape.props.width} y={-22} />}
      </>
    )
  }
  if (shape.type === 'sticky') {
    const fillColor = getStickyFillColor(stroke)
    return (
      <>
        <Text fill="#6b7280" fontFamily="Inter, system-ui, sans-serif" fontSize={12} listening={false} opacity={opacity} text={shape.props.authorName ?? 'You'} width={shape.props.width} y={-20} />
        <Rect cornerRadius={2} fill={fillColor} height={shape.props.height} opacity={opacity} shadowBlur={10} shadowColor="rgba(36, 49, 66, 0.22)" shadowOffsetY={4} stroke="rgba(31, 42, 55, 0.12)" strokeWidth={1} width={shape.props.width} />
        {hideEditableText ? null : <Text align={textAlign} fill="#2f2a1f" fontFamily="Inter, system-ui, sans-serif" fontSize={fontSize} height={shape.props.height} listening={false} opacity={opacity} padding={14} text={shape.props.text} verticalAlign="middle" width={shape.props.width} />}
      </>
    )
  }
  if (shape.type === 'line') {
    return renderLineLikeShape(shape, { dash: strokeDash, highlightStroke, highlightWidth, isSelected, opacity, stroke, strokeWidth })
  }
  if (shape.type === 'arrow') {
    return renderLineLikeShape(shape, { dash: strokeDash, highlightStroke, highlightWidth, isSelected, opacity, stroke, strokeWidth })
  }
  if (shape.type === 'stroke') {
    const path = getFreehandPath(shape.props.points, strokeWidth * 2.2)
    return (
      <>
        {isSelected ? <Path data={path} fill={highlightStroke} listening={false} opacity={0.18} scaleX={1.04} scaleY={1.04} /> : null}
        <Path data={path} fill={stroke} hitStrokeWidth={16} opacity={opacity} />
      </>
    )
  }
  if (shape.type === 'text') {
    return hideEditableText ? null : <Text align={textAlign} fill={stroke} fontFamily="Inter, system-ui, sans-serif" fontSize={fontSize} height={shape.props.height} opacity={opacity} text={shape.props.text} width={shape.props.width} />
  }
  if (shape.type === 'image') {
    return <KonvaImageShape opacity={opacity} previewMode={previewMode} shape={shape} zoom={zoom} />
  }
  if (shape.type === 'node_card') {
    return <KonvaNodeCardShape document={document} editingFieldName={editingNodeTextField} onChatClean={onNodeChatClean} onChatExportToggle={onNodeChatExportToggle} onChatSend={onNodeChatSend} onChatUpload={onNodeChatUpload} onFieldChange={onNodeFieldChange} onImageNodeToCanvas={onImageNodeToCanvas} onPortPointerDown={onNodePortPointerDown} onRunToggle={onNodeRunToggle} onTextEditStart={onNodeTextEditStart} opacity={opacity} previewMode={previewMode} shape={shape} zoom={zoom} />
  }
  return null
}
function renderLineLikeShape(
  shape: KonvaLineShape,
  style: {
    dash?: number[]
    highlightStroke: string
    highlightWidth: number
    isSelected: boolean
    opacity: number
    stroke: string
    strokeWidth: number
  }
) {
  const path = getLinePathData(shape)
  const endHead = getLineHead(shape, 'end')
  const startHead = getLineHead(shape, 'start')
  const end = shape.props.end
  const start = { x: 0, y: 0 }
  return (
    <>
      {style.isSelected ? <Path data={path} hitStrokeWidth={16} lineCap="round" lineJoin="round" listening={false} opacity={0.28} stroke={style.highlightStroke} strokeWidth={style.highlightWidth} /> : null}
      <Path dash={style.dash} data={path} hitStrokeWidth={16} lineCap="round" lineJoin="round" opacity={style.opacity} stroke={style.stroke} strokeWidth={style.strokeWidth} />
      {startHead === 'arrow' ? <Line closed fill={style.stroke} opacity={style.opacity} points={getArrowHeadPoints(start, getLineStartHeadAnchor(shape), Math.max(12, style.strokeWidth * 5))} /> : null}
      {startHead === 'dot' ? <Circle fill={style.stroke} opacity={style.opacity} radius={Math.max(4, style.strokeWidth * 2.1)} x={0} y={0} /> : null}
      {endHead === 'arrow' ? <Line closed fill={style.stroke} opacity={style.opacity} points={getArrowHeadPoints(end, getLineArrowHeadAnchor(shape), Math.max(12, style.strokeWidth * 5))} /> : null}
      {endHead === 'dot' ? <Circle fill={style.stroke} opacity={style.opacity} radius={Math.max(4, style.strokeWidth * 2.1)} x={end.x} y={end.y} /> : null}
    </>
  )
}
function getGroupTransform(shape: CanvasShape) {
  if (!isBoxCanvasShape(shape)) return { offsetX: 0, offsetY: 0, rotation: 0, scaleX: 1, scaleY: 1, x: shape.x, y: shape.y }
  const offsetX = shape.props.width / 2
  const offsetY = shape.props.height / 2
  return {
    offsetX,
    offsetY,
    rotation: canKonvaShapeRotate(shape) ? shape.rotation ?? 0 : 0,
    scaleX: canKonvaShapeFlip(shape) && shape.flipX ? -1 : 1,
    scaleY: canKonvaShapeFlip(shape) && shape.flipY ? -1 : 1,
    x: shape.x + offsetX,
    y: shape.y + offsetY,
  }
}
function getDragPoint(target: { x: () => number; y: () => number }, transform: ReturnType<typeof getGroupTransform>) { return { x: target.x() - transform.offsetX, y: target.y() - transform.offsetY } }
type LockedDragState = { lastPoint?: { x: number; y: number }; startPointer: { x: number; y: number }; startShape: { x: number; y: number } }
function createLockedDragState(target: Konva.Node, shape: CanvasShape): LockedDragState | null {
  const pointer = target.getStage()?.getPointerPosition()
  return pointer ? { startPointer: { x: pointer.x, y: pointer.y }, startShape: { x: shape.x, y: shape.y } } : null
}
function getLockedDragPoint(target: Konva.Node, state: LockedDragState | null) {
  const pointer = target.getStage()?.getPointerPosition()
  const zoom = target.getStage()?.scaleX() ?? 1
  if (!pointer || !state) return null
  return {
    x: state.startShape.x + (pointer.x - state.startPointer.x) / Math.max(0.1, zoom),
    y: state.startShape.y + (pointer.y - state.startPointer.y) / Math.max(0.1, zoom),
  }
}
function resetDragSource(target: { position: (point: { x: number; y: number }) => void }, transform: ReturnType<typeof getGroupTransform>) { target.position({ x: transform.x, y: transform.y }) }
function getClosedFillProps(fill: string, fillStyle: ReturnType<typeof resolveKonvaShapeStyle>['fillStyle'], stroke: string) {
  const patternTile = fillStyle === 'pattern' ? getPatternTile(stroke) : undefined
  if (!patternTile) return { fill }
  return {
    fillPatternImage: patternTile.image as unknown as HTMLImageElement,
    fillPatternRepeat: 'repeat' as const,
    fillPatternScaleX: patternTile.scale,
    fillPatternScaleY: patternTile.scale,
  }
}
