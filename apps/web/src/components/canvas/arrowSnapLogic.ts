import { getArrowTargetState, type Editor, type TLArrowBinding, type TLArrowShape, type TLShape, type VecLike } from 'tldraw'
import {
  getAnchorPagePoint,
  getBestAnchorForReferencePoint,
  getCandidateAnchors,
  getResolvedTerminalPagePoint,
  getArrowTerminalPagePoint,
  isCleanTldrawAnchor,
  isSameAnchor,
  toTldrawAnchor,
  type Anchor,
  type ArrowTerminal,
} from './arrowAnchorUtils'

const portSnapScreenDistance = 34

export function snapArrowBindings(editor: Editor) {
  const arrows = editor
    .getCurrentPageShapes()
    .filter((shape): shape is TLArrowShape => shape.type === 'arrow')

  for (const arrow of arrows) {
    for (const binding of editor.getBindingsFromShape(arrow.id, 'arrow')) {
      const anchor = getBestAnchor(editor, binding)
      if (!anchor) continue

      if (
        binding.props.isPrecise &&
        !binding.props.isExact &&
        binding.props.snap === 'edge-point' &&
        isCleanTldrawAnchor(binding.props.normalizedAnchor) &&
        isSameAnchor(binding.props.normalizedAnchor, anchor)
      ) {
        continue
      }

      editor.updateBinding({
        ...binding,
        props: {
          ...binding.props,
          isExact: false,
          isPrecise: true,
          normalizedAnchor: toTldrawAnchor(anchor),
          snap: 'edge-point',
        },
      })
    }
  }
}

export function updateActiveArrowPortSnap(editor: Editor) {
  if (!isArrowInteraction(editor)) return

  const arrow = getActiveArrow(editor)
  if (!arrow) return

  const bindings = editor.getBindingsFromShape(arrow.id, 'arrow')
  const activeTerminal = getActiveTerminal(editor, arrow, bindings)
  const oppositeTerminal = getOppositeTerminal(activeTerminal)
  const oppositeBinding = bindings.find((binding) => binding.props.terminal === oppositeTerminal)
  const activeBinding = bindings.find((binding) => binding.props.terminal === activeTerminal)
  const currentPoint = editor.inputs.getCurrentPagePoint()
  const target = getBindablePortTarget(editor, arrow, currentPoint, oppositeBinding)

  if (!target) {
    if (activeBinding) editor.deleteBinding(activeBinding)
    return
  }

  const referencePoint = getResolvedTerminalPagePoint(editor, arrow, oppositeTerminal, bindings) ?? currentPoint
  const anchor = getBestAnchorForReferencePoint(editor, target, referencePoint)
  if (!anchor) return

  createOrUpdateArrowBinding(editor, arrow, target, activeTerminal, anchor)
}

export function getActiveArrow(editor: Editor) {
  const selectedArrow = editor
    .getSelectedShapes()
    .find((shape): shape is TLArrowShape => shape.type === 'arrow')
  if (selectedArrow) return selectedArrow

  if (!isArrowCreationInteraction(editor)) return null

  return getTopmostArrow(editor)
}

export function isArrowCreationInteraction(editor: Editor) {
  return editor.isIn('arrow.pointing') || editor.isIn('select.dragging_handle')
}

export function getActiveTerminal(editor: Editor, arrow: TLArrowShape, bindings: TLArrowBinding[]): ArrowTerminal {
  const startBinding = bindings.find((binding) => binding.props.terminal === 'start')
  const endBinding = bindings.find((binding) => binding.props.terminal === 'end')

  if (startBinding && !endBinding) return 'end'
  if (endBinding && !startBinding) return 'start'

  const targetState = getArrowTargetState(editor)
  if (targetState) {
    const activeBinding = bindings.find((binding) => binding.toId === targetState.target.id)
    if (activeBinding) return activeBinding.props.terminal
  }

  const currentPoint = editor.inputs.getCurrentPagePoint()
  const startPoint = getArrowTerminalPagePoint(editor, arrow, 'start')
  const endPoint = getArrowTerminalPagePoint(editor, arrow, 'end')

  if (!startPoint || !endPoint) return 'end'

  const startDistance = (startPoint.x - currentPoint.x) ** 2 + (startPoint.y - currentPoint.y) ** 2
  const endDistance = (endPoint.x - currentPoint.x) ** 2 + (endPoint.y - currentPoint.y) ** 2

  return startDistance < endDistance ? 'start' : 'end'
}

export function getOppositeTerminal(terminal: ArrowTerminal): ArrowTerminal {
  return terminal === 'start' ? 'end' : 'start'
}

export function getBindablePortTarget(
  editor: Editor,
  arrow: TLArrowShape | null,
  point: VecLike,
  oppositeBinding?: TLArrowBinding
) {
  const snapMargin = portSnapScreenDistance / editor.getZoomLevel()
  const filter = (shape: TLShape) => canUseShapeAsArrowPortTarget(editor, arrow, shape, oppositeBinding)

  const hitShape = editor.getShapeAtPoint(point, {
    filter,
    hitFrameInside: true,
    hitInside: true,
    margin: snapMargin,
  })
  if (hitShape) return hitShape

  let nearestShape: TLShape | null = null
  let nearestDistance = Infinity
  const maxDistance = snapMargin * snapMargin

  for (const shape of [...editor.getCurrentPageShapesSorted()].reverse()) {
    if (!filter(shape)) continue

    for (const anchor of getCandidateAnchors(shape) ?? []) {
      const anchorPoint = getAnchorPagePoint(editor, shape, anchor)
      if (!anchorPoint) continue
      const distance = (anchorPoint.x - point.x) ** 2 + (anchorPoint.y - point.y) ** 2
      if (distance < maxDistance && distance < nearestDistance) {
        nearestShape = shape
        nearestDistance = distance
      }
    }
  }

  return nearestShape
}

function getBestAnchor(editor: Editor, binding: TLArrowBinding): Anchor | null {
  const arrow = editor.getShape<TLArrowShape>(binding.fromId)
  const target = editor.getShape(binding.toId)
  if (!arrow || arrow.type !== 'arrow' || !target) return null

  const oppositeTerminal = binding.props.terminal === 'start' ? 'end' : 'start'
  const oppositePoint = getResolvedTerminalPagePoint(
    editor,
    arrow,
    oppositeTerminal,
    editor.getBindingsFromShape(arrow.id, 'arrow')
  )
  if (!oppositePoint) return null

  return getBestAnchorForReferencePoint(editor, target, oppositePoint)
}

function getTopmostArrow(editor: Editor) {
  return [...editor.getCurrentPageShapesSorted()]
    .reverse()
    .find((shape): shape is TLArrowShape => shape.type === 'arrow') ?? null
}

function isArrowInteraction(editor: Editor) {
  return isArrowCreationInteraction(editor)
}

function canUseShapeAsArrowPortTarget(editor: Editor, arrow: TLArrowShape | null, shape: TLShape, oppositeBinding?: TLArrowBinding) {
  return (
    shape.id !== arrow?.id &&
    shape.id !== oppositeBinding?.toId &&
    !shape.isLocked &&
    !!getCandidateAnchors(shape) &&
    (!arrow || editor.canBindShapes({ binding: 'arrow', fromShape: arrow, toShape: shape }))
  )
}

function createOrUpdateArrowBinding(
  editor: Editor,
  arrow: TLArrowShape,
  target: TLShape,
  terminal: ArrowTerminal,
  anchor: Anchor
) {
  const existingBindings = editor
    .getBindingsFromShape(arrow.id, 'arrow')
    .filter((binding) => binding.props.terminal === terminal)

  const cleanAnchor = toTldrawAnchor(anchor)
  const props = {
    isExact: false,
    isPrecise: true,
    normalizedAnchor: cleanAnchor,
    snap: 'edge-point' as const,
    terminal,
  }

  const existing = existingBindings[0]
  if (existing) {
    if (
      existing.toId === target.id &&
      existing.props.isPrecise &&
      !existing.props.isExact &&
      existing.props.snap === 'edge-point' &&
      isCleanTldrawAnchor(existing.props.normalizedAnchor) &&
      isSameAnchor(existing.props.normalizedAnchor, cleanAnchor)
    ) {
      if (existingBindings.length > 1) editor.deleteBindings(existingBindings.slice(1))
      return
    }

    editor.updateBinding({ ...existing, props, toId: target.id })
    if (existingBindings.length > 1) editor.deleteBindings(existingBindings.slice(1))
    return
  }

  editor.createBinding({
    fromId: arrow.id,
    props,
    toId: target.id,
    type: 'arrow',
  })
}
