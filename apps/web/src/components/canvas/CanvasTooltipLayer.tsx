'use client'

import { useEffect, useState } from 'react'

type TooltipPlacement = 'bottom' | 'left' | 'right'

type TooltipState = {
  label: string
  left: number
  placement: TooltipPlacement
  top: number
}

export function CanvasTooltipLayer() {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null)

  useEffect(() => {
    const showTooltip = (target: HTMLElement) => {
      const label = target.dataset.tooltip?.trim()
      if (!label) return
      const rect = target.getBoundingClientRect()
      const preferSide = Boolean(target.closest('.canvas-style-panel, .canvas-style-drawer, .konva-canvas-properties-drawer'))
      if (preferSide) {
        const placement: TooltipPlacement = rect.right + 230 < window.innerWidth ? 'right' : 'left'
        setTooltip({
          label,
          left: placement === 'right' ? rect.right + 10 : rect.left - 10,
          placement,
          top: rect.top + rect.height / 2,
        })
        return
      }
      setTooltip({
        label,
        left: rect.left + rect.width / 2,
        placement: 'bottom',
        top: rect.bottom + 9,
      })
    }

    const handleEnter = (event: PointerEvent | FocusEvent) => {
      const target = getTooltipTarget(event.target)
      if (target) showTooltip(target)
    }
    const handleLeave = (event: PointerEvent | FocusEvent) => {
      const target = getTooltipTarget(event.target)
      if (!target) return
      const related = 'relatedTarget' in event ? event.relatedTarget : null
      if (related instanceof Node && target.contains(related)) return
      setTooltip(null)
    }
    const hideTooltip = () => setTooltip(null)

    document.addEventListener('pointerover', handleEnter)
    document.addEventListener('pointerout', handleLeave)
    document.addEventListener('focusin', handleEnter)
    document.addEventListener('focusout', handleLeave)
    window.addEventListener('resize', hideTooltip)
    window.addEventListener('scroll', hideTooltip, true)
    return () => {
      document.removeEventListener('pointerover', handleEnter)
      document.removeEventListener('pointerout', handleLeave)
      document.removeEventListener('focusin', handleEnter)
      document.removeEventListener('focusout', handleLeave)
      window.removeEventListener('resize', hideTooltip)
      window.removeEventListener('scroll', hideTooltip, true)
    }
  }, [])

  if (!tooltip) return null

  return (
    <div
      className="canvas-tooltip-layer"
      data-placement={tooltip.placement}
      role="tooltip"
      style={{ left: tooltip.left, top: tooltip.top }}
    >
      {tooltip.label}
    </div>
  )
}

function getTooltipTarget(target: EventTarget | null) {
  return target instanceof Element ? target.closest<HTMLElement>('[data-tooltip]') : null
}
