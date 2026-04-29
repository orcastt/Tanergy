'use client'

import { useEffect } from 'react'
import { createShapeId, type Editor, type TLArrowShape, type TLShapeId } from 'tldraw'
import type { NodeCardShape } from '@/types/nodeCardShape'
import { validateNodeConnection, getArrowColorForDataType } from '@/features/node-runtime/connectionRules'
import { getResolvedNodePorts } from '@/features/node-runtime/registry'
import type { JsonObject, ResolvedNodePort } from '@/types/nodeRuntime'

type ConnectionFrom = {
  pagePoint: { x: number; y: number }
  portDataType: 'image' | 'text'
  portDirection: 'in' | 'out'
  portId: string
  shapeId: string
}

type CompleteDetail = {
  from: ConnectionFrom
  targetPagePoint: { x: number; y: number }
  targetPortId: string
  targetShapeId: string
}

export function usePortConnectionCompletion(editor: Editor | null) {
  useEffect(() => {
    if (!editor) return
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<CompleteDetail>).detail
      completeConnection(editor, detail)
    }
    window.addEventListener('port:complete', handler)
    return () => { window.removeEventListener('port:complete', handler) }
  }, [editor])
}

function completeConnection(editor: Editor, detail: CompleteDetail) {
  const { from, targetPortId, targetShapeId } = detail
  const sourceShape = editor.getShape<NodeCardShape>(from.shapeId as TLShapeId)
  const targetShape = editor.getShape<NodeCardShape>(targetShapeId as TLShapeId)
  if (!sourceShape || !targetShape) return

  const sourceData = asJsonObject(sourceShape.props.data)
  const sourcePorts = getResolvedNodePorts(sourceShape.props.nodeType, sourceData)
  const sourcePort = sourcePorts.find((p) => p.id === from.portId)
  if (!sourcePort) return

  const targetData = asJsonObject(targetShape.props.data)
  const targetPorts = getResolvedNodePorts(targetShape.props.nodeType, targetData)
  const targetPort = targetPorts.find((p) => p.id === targetPortId)
  if (!targetPort) return

  const result = validateNodeConnection(sourceShape, sourcePort, targetShape, targetPort)
  if (!result.valid || !result.dataType) return

  const targetTransform = editor.getShapePageTransform(targetShape.id)
  if (!targetTransform) return
  const targetAnchorX = targetPort.direction === 'in' ? 0 : targetShape.props.w
  const targetAnchorY = targetShape.props.h * targetPort.anchorY
  const computedTargetPage = targetTransform.applyToPoint({ x: targetAnchorX, y: targetAnchorY })

  createConnectionArrow(editor, sourceShape, sourcePort, from.pagePoint, targetShape, targetPort, computedTargetPage, result.dataType)
}

function createConnectionArrow(
  editor: Editor,
  sourceShape: NodeCardShape,
  sourcePort: ResolvedNodePort,
  sourcePagePoint: { x: number; y: number },
  targetShape: NodeCardShape,
  targetPort: ResolvedNodePort,
  targetPagePoint: { x: number; y: number },
  dataType: 'image' | 'text'
) {
  const color = getArrowColorForDataType(dataType)
  const arrowId = createShapeId('arrow') as TLShapeId

  const sourceAnchor = {
    x: sourcePort.direction === 'out' ? 1 : 0,
    y: sourcePort.anchorY,
  }
  const targetAnchor = {
    x: targetPort.direction === 'in' ? 0 : 1,
    y: targetPort.anchorY,
  }

  editor.run(() => {
    editor.createShape<TLArrowShape>({
      id: arrowId,
      type: 'arrow',
      x: sourcePagePoint.x,
      y: sourcePagePoint.y,
      props: {
        color,
        end: { x: targetPagePoint.x - sourcePagePoint.x, y: targetPagePoint.y - sourcePagePoint.y },
        start: { x: 0, y: 0 },
      },
    })

    editor.createBinding({
      fromId: arrowId,
      props: { isExact: false, isPrecise: true, normalizedAnchor: sourceAnchor, snap: 'edge-point', terminal: 'start' },
      toId: sourceShape.id,
      type: 'arrow',
    })

    editor.createBinding({
      fromId: arrowId,
      props: { isExact: false, isPrecise: true, normalizedAnchor: targetAnchor, snap: 'edge-point', terminal: 'end' },
      toId: targetShape.id,
      type: 'arrow',
    })
  })
}

function asJsonObject(value: unknown): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as unknown as JsonObject) : {}
}
