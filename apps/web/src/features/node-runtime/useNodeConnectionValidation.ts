'use client'

import { useEffect, useRef } from 'react'
import type { Editor, TLArrowBinding, TLArrowShape } from 'tldraw'
import type { NodeCardShape } from '@/types/nodeCardShape'
import { getArrowColorForDataType, getNodePortForAnchor, validateNodeConnection } from './connectionRules'

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

    onEvent({ text: result.reason, tone: 'success' })
  }
}

function getPort(shape: NodeCardShape, binding: TLArrowBinding) {
  return getNodePortForAnchor(shape, binding.props.normalizedAnchor)
}

function isNodeCard(shape: unknown): shape is NodeCardShape {
  return Boolean(shape && typeof shape === 'object' && 'type' in shape && shape.type === 'node_card')
}
