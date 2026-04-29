import type { Editor, TLArrowBinding, TLArrowShape, TLShape, VecLike } from 'tldraw'
import { getNodePortAnchors } from '@/features/node-runtime/connectionRules'
import type { NodeCardShape } from '@/types/nodeCardShape'

export type Anchor = { x: number; y: number }
export type ArrowTerminal = 'start' | 'end'

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

export function getCandidateAnchors(shape: TLShape): Anchor[] | null {
  if (shape.type === 'arrow' || shape.type === 'line' || shape.type === 'draw') return null

  if (shape.type === 'node_card') {
    return getNodePortAnchors(shape as NodeCardShape).map(toTldrawAnchor)
  }

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
  const cleanAnchor = toTldrawAnchor(anchor)
  return transform.applyToPoint({
    x: bounds.minX + bounds.w * cleanAnchor.x,
    y: bounds.minY + bounds.h * cleanAnchor.y,
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

export function getBestAnchorForReferencePoint(
  editor: Editor,
  target: TLShape,
  referencePoint: VecLike
) {
  const candidates = getCandidateAnchors(target)
  if (!candidates) return null

  let bestAnchor = toTldrawAnchor(candidates[0])
  let bestDistance = Infinity

  for (const candidate of candidates) {
    const cleanCandidate = toTldrawAnchor(candidate)
    const point = getAnchorPagePoint(editor, target, cleanCandidate)
    if (!point) continue
    const distance = (point.x - referencePoint.x) ** 2 + (point.y - referencePoint.y) ** 2
    if (distance < bestDistance) {
      bestDistance = distance
      bestAnchor = cleanCandidate
    }
  }

  return bestAnchor
}

export function getResolvedTerminalPagePoint(
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

export function isSameAnchor(a: Anchor, b: Anchor) {
  const cleanA = toTldrawAnchor(a)
  const cleanB = toTldrawAnchor(b)
  return Math.abs(cleanA.x - cleanB.x) < 0.001 && Math.abs(cleanA.y - cleanB.y) < 0.001
}

export function isCleanTldrawAnchor(anchor: unknown) {
  if (!anchor || typeof anchor !== 'object' || Array.isArray(anchor)) return false
  const keys = Object.keys(anchor)
  return keys.length === 2 && keys.includes('x') && keys.includes('y')
}

export function toTldrawAnchor(anchor: VecLike): Anchor {
  return { x: anchor.x, y: anchor.y }
}
