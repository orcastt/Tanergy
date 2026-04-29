import type { PointerEvent as RPointerEvent, MouseEvent as RMouseEvent } from "react"

/**
 * Use on onClick of buttons/controls inside nodes that should NOT
 * trigger node selection or drag.
 */
export function nodeAction(e: RMouseEvent | RPointerEvent) {
  e.stopPropagation()
}

/**
 * Use on onPointerDown of resize handles inside nodes.
 * Prevents ReactFlow from initiating node drag.
 */
export function nodeResize(e: RPointerEvent) {
  e.preventDefault()
  e.stopPropagation()
  ;(e.nativeEvent as PointerEvent).stopImmediatePropagation()
}
