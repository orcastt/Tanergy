'use client'

import { useEffect } from 'react'
import { getArrowTargetState, type Editor, type TLArrowBinding, type TLArrowShape, type TLShape, type VecLike } from 'tldraw'
import { getNodePortAnchors, getNodePortForAnchor } from '@/features/node-runtime/connectionRules'
import type { NodeCardShape } from '@/types/nodeCardShape'
import type { NodePortDataType } from '@/types/nodeRuntime'

type Anchor = { x: number; y: number }
type ArrowTerminal = 'start' | 'end'

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

const sideAnchors: Anchor[] = [
  { x: 0.5, y: 0 },
  { x: 1, y: 0.5 },
  { x: 0.5, y: 1 },
  { x: 0, y: 0.5 },
]

const triangleAnchors: Anchor[] = [
  { x: 0.5, y: 0 },
  { x: 1, y: 1 },
  { x: 0, y: 1 },
]

const portSnapScreenDistance = 34

export function getCandidateAnchors(shape: TLShape): Anchor[] | null {
  if (shape.type === 'arrow' || shape.type === 'line' || shape.type === 'draw') return null

  if (shape.type === 'node_card') return getNodePortAnchors(shape as NodeCardShape)

  if (shape.type === 'geo') {
    const geo = shape.props.geo
    if (geo === 'triangle') return triangleAnchors
    if (geo === 'diamond') return sideAnchors
  }

  return sideAnchors
}

export function getAnchorPagePoint(editor: Editor, shape: TLShape, anchor: Anchor): VecLike | null {
  const geometry = editor.getShapeGeometry(shape)
  const transform = editor.getShapePageTransform(shape.id)
  if (!geometry || !transform) return null

  const bounds = geometry.bounds
  return transform.applyToPoint({
    x: bounds.minX + bounds.w * anchor.x,
    y: bounds.minY + bounds.h * anchor.y,
  })
}

export function getArrowTerminalPagePoint(
  editor: Editor,
  arrow: TLArrowShape,
  terminal: ArrowTerminal
): VecLike | null {
  const transform = editor.getShapePageTransform(arrow.id)
  if (!transform) return null
  return transform.applyToPoint(arrow.props[terminal])
}

function getBestAnchorForReferencePoint(editor: Editor, target: TLShape, referencePoint: VecLike) {
  const candidates = getCandidateAnchors(target)
  if (!candidates) return null

  let bestAnchor = candidates[0]
  let bestDistance = Infinity

  for (const candidate of candidates) {
    const point = getAnchorPagePoint(editor, target, candidate)
    if (!point) continue
    const distance = (point.x - referencePoint.x) ** 2 + (point.y - referencePoint.y) ** 2
    if (distance < bestDistance) {
      bestDistance = distance
      bestAnchor = candidate
    }
  }

  return bestAnchor
}

function getResolvedTerminalPagePoint(
  editor: Editor,
  arrow: TLArrowShape,
  terminal: ArrowTerminal,
  bindings: TLArrowBinding[]
) {
  const binding = bindings.find((item) => item.props.terminal === terminal)
  if (binding) {
    const boundShape = editor.getShape(binding.toId)
    if (boundShape) {
      const point = getAnchorPagePoint(editor, boundShape, binding.props.normalizedAnchor)
      if (point) return point
    }
  }

  return getArrowTerminalPagePoint(editor, arrow, terminal)
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

function isSameAnchor(a: Anchor, b: Anchor) {
  return Math.abs(a.x - b.x) < 0.001 && Math.abs(a.y - b.y) < 0.001
}

function snapArrowBindings(editor: Editor) {
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
          normalizedAnchor: anchor,
          snap: 'edge-point',
        },
      })
    }
  }
}

function getTopmostArrow(editor: Editor) {
  return [...editor.getCurrentPageShapesSorted()]
    .reverse()
    .find((shape): shape is TLArrowShape => shape.type === 'arrow') ?? null
}

function isArrowCreationInteraction(editor: Editor) {
  return editor.isIn('arrow.pointing') || editor.isIn('select.dragging_handle')
}

function getActiveArrow(editor: Editor) {
  const selectedArrow = editor
    .getSelectedShapes()
    .find((shape): shape is TLArrowShape => shape.type === 'arrow')
  if (selectedArrow) return selectedArrow

  if (!isArrowCreationInteraction(editor)) {
    return null
  }

  return getTopmostArrow(editor)
}

function isArrowInteraction(editor: Editor) {
  return isArrowCreationInteraction(editor)
}

function getOppositeTerminal(terminal: ArrowTerminal): ArrowTerminal {
  return terminal === 'start' ? 'end' : 'start'
}

function getActiveTerminal(editor: Editor, arrow: TLArrowShape, bindings: TLArrowBinding[]): ArrowTerminal {
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

function canUseShapeAsArrowPortTarget(editor: Editor, arrow: TLArrowShape | null, shape: TLShape, oppositeBinding?: TLArrowBinding) {
  return (
    shape.id !== arrow?.id &&
    shape.id !== oppositeBinding?.toId &&
    !shape.isLocked &&
    !!getCandidateAnchors(shape) &&
    (!arrow || editor.canBindShapes({ binding: 'arrow', fromShape: arrow, toShape: shape }))
  )
}

function getBindablePortTarget(
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

  const props = {
    isExact: false,
    isPrecise: true,
    normalizedAnchor: anchor,
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
      isSameAnchor(existing.props.normalizedAnchor, anchor)
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

function updateActiveArrowPortSnap(editor: Editor) {
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

function getBindingHighlight(
  editor: Editor,
  binding: TLArrowBinding
): ArrowPortHighlight | null {
  const shape = editor.getShape(binding.toId)
  if (!shape) return null

  const pagePoint = getAnchorPagePoint(editor, shape, binding.props.normalizedAnchor)
  if (!pagePoint) return null

  return {
    dataType: shape.type === 'node_card'
      ? getNodePortForAnchor(shape as NodeCardShape, binding.props.normalizedAnchor)?.dataType
      : undefined,
    id: `${binding.fromId}-${binding.props.terminal}-${binding.toId}`,
    isActive: true,
    pagePoint,
    role: binding.props.terminal === 'start' ? 'source' : 'target',
    shapeId: shape.id,
    terminal: binding.props.terminal,
  }
}

function getShapeOutlinePagePoints(editor: Editor, shape: TLShape): VecLike[] {
  const geometry = editor.getShapeGeometry(shape)
  const transform = editor.getShapePageTransform(shape.id)
  if (!geometry || !transform) return []

  return geometry.vertices.map((point) => transform.applyToPoint(point))
}

function getShapeHighlight(editor: Editor, shape: TLShape, role: 'source' | 'target'): ArrowShapeHighlight | null {
  const pagePoints = getShapeOutlinePagePoints(editor, shape)
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
        dataType: shape.type === 'node_card'
          ? getNodePortForAnchor(shape as NodeCardShape, anchor)?.dataType
          : undefined,
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

  const oppositeTerminal =
    arrow && activeTerminal ? getOppositeTerminal(activeTerminal) : null
  const bindings = arrow ? editor.getBindingsFromShape(arrow.id, 'arrow') : []
  const referencePoint =
    arrow && oppositeTerminal
      ? getResolvedTerminalPagePoint(editor, arrow, oppositeTerminal, bindings) ?? currentPoint
      : currentPoint
  const activeAnchor = getBestAnchorForReferencePoint(editor, target, referencePoint)
  const role: 'source' | 'target' = arrow
    ? activeTerminal === 'start'
      ? 'source'
      : 'target'
    : 'source'

  return {
    activeAnchor,
    role,
    target,
    terminal: activeTerminal,
  }
}

export function getArrowPortOverlayState(editor: Editor | null): ArrowPortOverlayState {
  if (!editor) return { ports: [], shapes: [] }

  const ports: ArrowPortHighlight[] = []
  const shapes: ArrowShapeHighlight[] = []
  const highlightedShapeIds = new Set<string>()

  const addShape = (shape: TLShape, role: 'source' | 'target') => {
    const key = `${role}-${shape.id}`
    if (highlightedShapeIds.has(key)) return
    const highlight = getShapeHighlight(editor, shape, role)
    if (!highlight) return
    highlightedShapeIds.add(key)
    shapes.push(highlight)
  }

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
      ports.push(
        ...getShapePortHighlights(
          editor,
          preview.target,
          preview.role,
          preview.activeAnchor,
          preview.terminal
        )
      )
    }

    return { ports, shapes }
  }

  const preview = getPreviewTargetState(editor, null)
  if (preview) {
    addShape(preview.target, 'source')
    ports.push(
      ...getShapePortHighlights(editor, preview.target, 'source', preview.activeAnchor)
    )
  }

  return { ports, shapes }
}

export function useArrowPortSnapping(editor: Editor | null) {
  useEffect(() => {
    if (!editor) return

    let frame: number | null = null
    const scheduleSnap = () => {
      if (frame !== null) return
      frame = requestAnimationFrame(() => {
        frame = null
        editor.run(() => {
          updateActiveArrowPortSnap(editor)
          snapArrowBindings(editor)
        })
      })
    }

    scheduleSnap()
    const unsubscribe = editor.store.listen(scheduleSnap, { scope: 'document', source: 'user' })

    return () => {
      unsubscribe()
      if (frame !== null) cancelAnimationFrame(frame)
    }
  }, [editor])
}
