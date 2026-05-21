'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { CanvasPoint } from '@/features/canvas-engine'

type CursorTarget = {
  id: string
  point: CanvasPoint
}

type AnimatedCursor = {
  current: CanvasPoint
  target: CanvasPoint
}

const farFollowFactor = 0.34
const mediumFollowFactor = 0.24
const nearFollowFactor = 0.16
const settleDistance = 0.45
const teleportDistance = 360

export function useSmoothedCollaborationCursors(targets: CursorTarget[]) {
  const animationFrameRef = useRef<number | null>(null)
  const cursorsRef = useRef<Map<string, AnimatedCursor>>(new Map())
  const [positions, setPositions] = useState<Map<string, CanvasPoint>>(() => new Map())

  const stepAnimation = useCallback(function animateCursors() {
    animationFrameRef.current = null
    let isMoving = false

    for (const cursor of cursorsRef.current.values()) {
      const deltaX = cursor.target.x - cursor.current.x
      const deltaY = cursor.target.y - cursor.current.y
      const distance = Math.hypot(deltaX, deltaY)
      if (distance <= settleDistance) {
        cursor.current = { ...cursor.target }
        continue
      }
      const followFactor = resolveFollowFactor(distance)
      cursor.current = {
        x: cursor.current.x + deltaX * followFactor,
        y: cursor.current.y + deltaY * followFactor,
      }
      isMoving = true
    }

    setPositions(snapshotCursorPositions(cursorsRef.current))
    if (isMoving) {
      animationFrameRef.current = window.requestAnimationFrame(animateCursors)
    }
  }, [])

  useEffect(() => {
    const nextIds = new Set(targets.map((target) => target.id))
    let changed = false

    for (const id of cursorsRef.current.keys()) {
      if (nextIds.has(id)) continue
      cursorsRef.current.delete(id)
      changed = true
    }

    for (const target of targets) {
      const existing = cursorsRef.current.get(target.id)
      if (!existing) {
        cursorsRef.current.set(target.id, {
          current: { ...target.point },
          target: { ...target.point },
        })
        changed = true
        continue
      }

      existing.target = { ...target.point }
      if (distanceBetweenPoints(existing.current, target.point) > teleportDistance) {
        existing.current = { ...target.point }
        changed = true
      }
    }

    if (changed) {
      setPositions(snapshotCursorPositions(cursorsRef.current))
    }
    if (targets.length === 0) {
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current)
        animationFrameRef.current = null
      }
      setPositions((current) => (current.size > 0 ? new Map() : current))
      return
    }
    if (animationFrameRef.current === null) {
      animationFrameRef.current = window.requestAnimationFrame(stepAnimation)
    }
  }, [stepAnimation, targets])

  useEffect(() => (
    () => {
      if (animationFrameRef.current === null) return
      window.cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }
  ), [])

  return positions
}

function snapshotCursorPositions(cursors: Map<string, AnimatedCursor>) {
  return new Map(
    [...cursors.entries()].map(([id, cursor]) => [id, { ...cursor.current }] as const),
  )
}

function resolveFollowFactor(distance: number) {
  if (distance > 180) return farFollowFactor
  if (distance > 72) return mediumFollowFactor
  return nearFollowFactor
}

function distanceBetweenPoints(left: CanvasPoint, right: CanvasPoint) {
  return Math.hypot(left.x - right.x, left.y - right.y)
}
