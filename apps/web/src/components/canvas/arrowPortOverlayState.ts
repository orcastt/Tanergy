import type { Editor, TLArrowBinding, TLArrowShape, TLShape, VecLike } from 'tldraw'
import { getNodePortForAnchor } from '@/features/node-runtime/connectionRules'
import type { NodeCardShape } from '@/types/nodeCardShape'
import type { NodePortDataType } from '@/types/nodeRuntime'
import {
  getAnchorPagePoint,
  getBestAnchorForReferencePoint,
  getCandidateAnchors,
  type Anchor,
  type ArrowTerminal,
} from './arrowAnchorUtils'
import {
  getActiveArrow,
  getActiveTerminal,
  getBindablePortTarget,
  getOppositeTerminal,
  isArrowCreationInteraction,
} from './arrowSnapLogic'

export type ArrowPortHighlight = {
  dataType?: NodePortDataType
  id: string
  isActive: boolean
  pagePoint: VecLike
  role: 'source' | 'target'
  shapeId: TLShape['id']
  terminal?: ArrowTerminal
}

export type ArrowShapeHighlight = {
  id: string
  pagePoints: VecLike[]
  role: 'source' | 'target'
  shapeId: TLShape['id']
}

export type ArrowPortOverlayState = {
  ports: ArrowPortHighlight[]
  shapes: ArrowShapeHighlight[]
}

export function getArrowPortOverlayState(editor: Editor | null): ArrowPortOverlayState {
  if (!editor) return { ports: [], shapes: [] }

  const ports: ArrowPortHighlight[] = []
  const shapes: ArrowShapeHighlight[] = []
  const highlightedShapeIds = new Set<string>()
  const addShape = createShapeCollector(editor, shapes, highlightedShapeIds)
  const arrow = getActiveArrow(editor)

  if (arrow) {
    const bindings = editor.getBindingsFromShape(arrow.id, 'arrow')
    const activeTerminal = isArrowCreationInteraction(editor)
      ? getActiveTerminal(editor, arrow, bindings)
      : undefined
    const oppositeTerminal = activeTerminal ? getOppositeTerminal(activeTerminal) : undefined
    const oppositeBinding = oppositeTerminal
      ? bindings.find((binding) => binding.props.terminal === oppositeTerminal)
      : undefined

    for (const binding of bindings) {
      const bindingHighlight = getBindingHighlight(editor, binding)
      if (bindingHighlight) ports.push(bindingHighlight)

      const shape = editor.getShape(binding.toId)
      if (shape) addShape(shape, binding.props.terminal === 'start' ? 'source' : 'target')
    }

    const preview = activeTerminal
      ? getPreviewTargetState(editor, arrow, activeTerminal, oppositeBinding)
      : null
    if (preview) {
      addShape(preview.target, preview.role)
      ports.push(...getShapePortHighlights(editor, preview.target, preview.role, preview.activeAnchor, preview.terminal))
    }

    return { ports, shapes }
  }

  const preview = getPreviewTargetState(editor, null)
  if (preview) {
    addShape(preview.target, 'source')
    ports.push(...getShapePortHighlights(editor, preview.target, 'source', preview.activeAnchor))
  }

  return { ports, shapes }
}

function createShapeCollector(
  editor: Editor,
  shapes: ArrowShapeHighlight[],
  highlightedShapeIds: Set<string>
) {
  return (shape: TLShape, role: 'source' | 'target') => {
    const key = `${role}-${shape.id}`
    if (highlightedShapeIds.has(key)) return
    const highlight = getShapeHighlight(editor, shape, role)
    if (!highlight) return
    highlightedShapeIds.add(key)
    shapes.push(highlight)
  }
}

function getBindingHighlight(editor: Editor, binding: TLArrowBinding): ArrowPortHighlight | null {
  const shape = editor.getShape(binding.toId)
  if (!shape) return null

  const pagePoint = getAnchorPagePoint(editor, shape, binding.props.normalizedAnchor)
  if (!pagePoint) return null

  return {
    dataType: getNodePortDataType(shape, binding.props.normalizedAnchor),
    id: `${binding.fromId}-${binding.props.terminal}-${binding.toId}`,
    isActive: true,
    pagePoint,
    role: binding.props.terminal === 'start' ? 'source' : 'target',
    shapeId: shape.id,
    terminal: binding.props.terminal,
  }
}

function getShapeHighlight(editor: Editor, shape: TLShape, role: 'source' | 'target'): ArrowShapeHighlight | null {
  const geometry = editor.getShapeGeometry(shape)
  const transform = editor.getShapePageTransform(shape.id)
  if (!geometry || !transform) return null

  const pagePoints = geometry.vertices.map((point) => transform.applyToPoint(point))
  if (pagePoints.length < 2) return null

  return {
    id: `${role}-${shape.id}`,
    pagePoints,
    role,
    shapeId: shape.id,
  }
}

function getShapePortHighlights(
  editor: Editor,
  shape: TLShape,
  role: 'source' | 'target',
  activeAnchor: Anchor | null,
  terminal?: ArrowTerminal
): ArrowPortHighlight[] {
  const anchors = getCandidateAnchors(shape) ?? []

  return anchors
    .map((anchor, index): ArrowPortHighlight | null => {
      const pagePoint = getAnchorPagePoint(editor, shape, anchor)
      if (!pagePoint) return null

      const highlight: ArrowPortHighlight = {
        dataType: getNodePortDataType(shape, anchor),
        id: `${role}-${shape.id}-${index}`,
        isActive: activeAnchor ? isSameAnchor(anchor, activeAnchor) : false,
        pagePoint,
        role,
        shapeId: shape.id,
      }
      if (terminal) highlight.terminal = terminal

      return highlight
    })
    .filter((highlight): highlight is ArrowPortHighlight => highlight !== null)
}

function getPreviewTargetState(
  editor: Editor,
  arrow: TLArrowShape | null,
  activeTerminal?: ArrowTerminal,
  oppositeBinding?: TLArrowBinding
) {
  if (editor.getCurrentToolId() !== 'arrow' && !isArrowCreationInteraction(editor)) return null

  const currentPoint = editor.inputs.getCurrentPagePoint()
  const target = getBindablePortTarget(editor, arrow, currentPoint, oppositeBinding)
  if (!target) return null

  const oppositeTerminal = arrow && activeTerminal ? getOppositeTerminal(activeTerminal) : null
  const bindings = arrow ? editor.getBindingsFromShape(arrow.id, 'arrow') : []
  const referencePoint =
    arrow && oppositeTerminal
      ? getResolvedReferencePoint(editor, arrow, oppositeTerminal, bindings, currentPoint)
      : currentPoint
  const activeAnchor = getBestAnchorForReferencePoint(editor, target, referencePoint)
  const role: 'source' | 'target' = arrow
    ? activeTerminal === 'start'
      ? 'source'
      : 'target'
    : 'source'

  return { activeAnchor, role, target, terminal: activeTerminal }
}

function getResolvedReferencePoint(
  editor: Editor,
  arrow: TLArrowShape,
  terminal: ArrowTerminal,
  bindings: TLArrowBinding[],
  fallback: VecLike
) {
  const binding = bindings.find((item) => item.props.terminal === terminal)
  if (!binding) return fallback
  const shape = editor.getShape(binding.toId)
  if (!shape) return fallback
  return getAnchorPagePoint(editor, shape, binding.props.normalizedAnchor) ?? fallback
}

function getNodePortDataType(shape: TLShape, anchor: Anchor) {
  return shape.type === 'node_card'
    ? getNodePortForAnchor(shape as NodeCardShape, anchor)?.dataType
    : undefined
}

function isSameAnchor(a: Anchor, b: Anchor) {
  return Math.abs(a.x - b.x) < 0.001 && Math.abs(a.y - b.y) < 0.001
}
