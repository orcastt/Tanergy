'use client'

import type { JsonValue } from '@tldraw/utils'
import type { SyntheticEvent } from 'react'
import type { Editor } from 'tldraw'
import { auditNodePayload } from '@/features/node-runtime/payloadAudit'
import { getNodeDefinition, getResolvedNodePorts } from '@/features/node-runtime/registry'
import type { NodeCardShape } from '@/types/nodeCardShape'
import type { JsonObject, NodeInspectorField } from '@/types/nodeRuntime'
import { useEditorRevision } from '../canvas/useEditorRevision'

type CanvasNodeInspectorProps = {
  connectionMessage?: { text: string; tone: 'error' | 'success' } | null
  editor: Editor | null
}

function stopCanvasEvent(event: SyntheticEvent) {
  event.stopPropagation()
}

export function CanvasNodeInspector({ connectionMessage, editor }: CanvasNodeInspectorProps) {
  useEditorRevision(editor)

  if (!editor) return null

  const selectedNode = editor.getSelectedShapes().find(isNodeCard)
  if (!selectedNode) return null

  const definition = getNodeDefinition(selectedNode.props.nodeType)
  const data = asJsonObject(selectedNode.props.data)
  const ports = getResolvedNodePorts(selectedNode.props.nodeType, data)
  const audit = auditNodePayload({
    data,
    nodeId: selectedNode.props.nodeId,
    runtimeSummary: selectedNode.props.runtimeSummary,
    version: selectedNode.props.version,
  })

  const updateField = (field: NodeInspectorField, value: string) => {
    const nextValue = field.type === 'number' ? Number(value) : value
    editor.updateShape<NodeCardShape>({
      id: selectedNode.id,
      props: { data: { ...data, [field.name]: nextValue } },
      type: 'node_card',
    })
  }

  return (
    <aside
      aria-label="Node inspector"
      className="node-inspector"
      onDoubleClick={stopCanvasEvent}
      onPointerDown={stopCanvasEvent}
      onWheel={stopCanvasEvent}
    >
      <header className="node-inspector__header">
        <span>S1.5 Inspector</span>
        <h2>{definition.displayName}</h2>
        <small>{selectedNode.props.nodeId}</small>
      </header>

      <section className="node-inspector__section">
        <p>Ports</p>
        <div className="node-inspector__ports">
          {ports.map((port) => (
            <span data-direction={port.direction} data-type={port.dataType} key={port.id}>
              {port.direction === 'in' ? '←' : '→'} {port.label}
            </span>
          ))}
        </div>
      </section>

      <section className="node-inspector__section">
        <p>Parameters</p>
        <div className="node-inspector__fields">
          {definition.inspectorFields.map((field) => (
            <InspectorField
              field={field}
              key={field.name}
              onChange={(value) => updateField(field, value)}
              value={data[field.name]}
            />
          ))}
        </div>
      </section>

      <section className="node-inspector__section">
        <p>Payload guard</p>
        <div className={audit.issues.length > 0 ? 'node-inspector__audit is-warning' : 'node-inspector__audit'}>
          <strong>{audit.byteSize} bytes in shape props</strong>
          <span>{audit.issues[0] ?? 'Clean: ids, short params, layout and summaries only.'}</span>
        </div>
      </section>

      {connectionMessage ? (
        <section className={`node-inspector__connection node-inspector__connection--${connectionMessage.tone}`}>
          {connectionMessage.text}
        </section>
      ) : null}
    </aside>
  )
}

function InspectorField({
  field,
  onChange,
  value,
}: {
  field: NodeInspectorField
  onChange: (value: string) => void
  value: JsonValue | undefined
}) {
  const stringValue = value === undefined || value === null ? '' : String(value)

  if (field.type === 'textarea') {
    return (
      <label>
        <span>{field.label}</span>
        <textarea value={stringValue} onChange={(event) => onChange(event.currentTarget.value)} />
      </label>
    )
  }

  if (field.type === 'select') {
    return (
      <label>
        <span>{field.label}</span>
        <select value={stringValue} onChange={(event) => onChange(event.currentTarget.value)}>
          {field.options?.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    )
  }

  return (
    <label>
      <span>{field.label}</span>
      <input
        type={field.type === 'number' ? 'number' : 'text'}
        value={stringValue}
        onChange={(event) => onChange(event.currentTarget.value)}
      />
    </label>
  )
}

function asJsonObject(value: JsonValue): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as unknown as JsonObject) : {}
}

function isNodeCard(shape: unknown): shape is NodeCardShape {
  return Boolean(shape && typeof shape === 'object' && 'type' in shape && shape.type === 'node_card')
}
