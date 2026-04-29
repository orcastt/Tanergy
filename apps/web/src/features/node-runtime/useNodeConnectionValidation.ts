'use client'

import { useEffect, useRef } from 'react'
import type { Editor, TLArrowBinding, TLArrowShape } from 'tldraw'
import type { NodeCardShape } from '@/types/nodeCardShape'
import { getArrowColorForDataType, getNodePortForAnchor, validateNodeConnection } from './connectionRules'
import { maxImageInputPorts } from './registry'

type ConnectionValidationEvent = {
  tone: 'error' | 'success'
  text: string
}

export function useNodeConnectionValidation(
  editor: Editor | null,
  onEvent: (event: ConnectionValidationEvent) => void
) {
  const lastMessage = useRef('')

  useEffect(() => {
    if (!editor) return

    let frame: number | null = null

    const scheduleValidation = () => {
      if (frame !== null) return
      frame = requestAnimationFrame(() => {
        frame = null
        validateConnections(editor, (event) => {
          const nextMessage = `${event.tone}:${event.text}`
          if (lastMessage.current === nextMessage) return
          lastMessage.current = nextMessage
          onEvent(event)
        })
      })
    }

    const cleanupStore = editor.store.listen(scheduleValidation)
    editor.on('event', scheduleValidation)

    return () => {
      if (frame !== null) cancelAnimationFrame(frame)
      cleanupStore()
      editor.off('event', scheduleValidation)
    }
  }, [editor, onEvent])
}

function validateConnections(editor: Editor, onEvent: (event: ConnectionValidationEvent) => void) {
  const arrows = editor
    .getCurrentPageShapes()
    .filter((shape): shape is TLArrowShape => shape.type === 'arrow')
  const imageInputCounts = new Map<NodeCardShape['id'], number>()
  const occupiedInputPorts = new Map<NodeCardShape['id'], Set<string>>()

  for (const arrow of arrows) {
    const bindings = editor.getBindingsFromShape(arrow.id, 'arrow')
    const startBinding = bindings.find((binding) => binding.props.terminal === 'start')
    const endBinding = bindings.find((binding) => binding.props.terminal === 'end')
    if (!startBinding || !endBinding) continue

    const source = editor.getShape<NodeCardShape>(startBinding.toId)
    const target = editor.getShape<NodeCardShape>(endBinding.toId)
    if (!isNodeCard(source) || !isNodeCard(target)) continue

    const sourcePort = getPort(source, startBinding)
    const targetPort = getPort(target, endBinding)
    if (!sourcePort || !targetPort) {
      editor.deleteShapes([arrow.id])
      onEvent({ text: 'Connection removed: use node input/output ports', tone: 'error' })
      continue
    }

    const result = validateNodeConnection(source, sourcePort, target, targetPort)
    if (!result.valid || !result.dataType) {
      editor.deleteShapes([arrow.id])
      onEvent({ text: result.reason, tone: 'error' })
      continue
    }

    const occupiedPorts = occupiedInputPorts.get(target.id) ?? new Set<string>()
    if (!targetPort.multiple && occupiedPorts.has(targetPort.id)) {
      editor.deleteShapes([arrow.id])
      onEvent({ text: `Input already connected: ${targetPort.label}`, tone: 'error' })
      continue
    }
    occupiedPorts.add(targetPort.id)
    occupiedInputPorts.set(target.id, occupiedPorts)

    const color = getArrowColorForDataType(result.dataType)
    if (arrow.props.color !== color) {
      editor.updateShape<TLArrowShape>({
        id: arrow.id,
        props: { color },
        type: 'arrow',
      })
    }

    if (targetPort.dataType === 'image' && targetPort.direction === 'in') {
      imageInputCounts.set(target.id, (imageInputCounts.get(target.id) ?? 0) + 1)
    }

    onEvent({ text: result.reason, tone: 'success' })
  }

  updateDynamicImageInputCounts(editor, imageInputCounts)
}

function updateDynamicImageInputCounts(editor: Editor, counts: Map<NodeCardShape['id'], number>) {
  for (const shape of editor.getCurrentPageShapes()) {
    if (!isNodeCard(shape)) continue
    if (shape.props.nodeType !== 'image_gen' && shape.props.nodeType !== 'image_gen_4') continue

    const data = shape.props.data && typeof shape.props.data === 'object' && !Array.isArray(shape.props.data)
      ? shape.props.data
      : {}
    const nextCount = Math.min(Math.max((counts.get(shape.id) ?? 0) + 1, 1), maxImageInputPorts)
    if (Number(data.imageInputCount ?? 1) === nextCount) continue

    editor.updateShape<NodeCardShape>({
      id: shape.id,
      props: {
        data: {
          ...data,
          imageInputCount: nextCount,
        },
      },
      type: 'node_card',
    })
  }
}

function getPort(shape: NodeCardShape, binding: TLArrowBinding) {
  return getNodePortForAnchor(shape, binding.props.normalizedAnchor)
}

function isNodeCard(shape: unknown): shape is NodeCardShape {
  return Boolean(shape && typeof shape === 'object' && 'type' in shape && shape.type === 'node_card')
}
