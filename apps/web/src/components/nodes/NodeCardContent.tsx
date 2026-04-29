'use client'

import type { JsonValue } from '@tldraw/utils'
import type { NodeCardShape } from '@/types/nodeCardShape'
import type { JsonObject, NodeRuntimeSummary } from '@/types/nodeRuntime'
import { getNodeDefinition, getResolvedNodePorts } from '@/features/node-runtime/registry'
import { auditNodePayload } from '@/features/node-runtime/payloadAudit'
import { NodePortDot } from './NodePortDot'

type NodeCardContentProps = {
  getEditorPagePoint: (localX: number, localY: number) => { x: number; y: number } | null
  onDataChange: (data: JsonObject) => void
  onRunMock: () => void
  shape: NodeCardShape
}

function stopNodeControlEvent(event: React.SyntheticEvent) {
  event.stopPropagation()
}

export function NodeCardContent({ getEditorPagePoint, onDataChange, onRunMock, shape }: NodeCardContentProps) {
  const definition = getNodeDefinition(shape.props.nodeType)
  const data = asJsonObject(shape.props.data)
  const runtimeSummary = asRuntimeSummary(shape.props.runtimeSummary)
  const ports = getResolvedNodePorts(shape.props.nodeType, data)
  const payloadAudit = auditNodePayload({
    data,
    nodeId: shape.props.nodeId,
    runtimeSummary,
    version: shape.props.version,
  })

  return (
    <div className={`node-card node-card--${shape.props.nodeType}`}>
      <div className="node-card__ports">
        {ports.map((port) => (
          <NodePortDot
            getEditorPagePoint={getEditorPagePoint}
            key={port.id}
            port={port}
            shape={shape}
          />
        ))}
      </div>

      <header className="node-card__header">
        <h2>{definition.displayName}</h2>
        {(shape.props.nodeType === 'image_gen' || shape.props.nodeType === 'image_gen_4' || shape.props.nodeType === 'analysis') ? (
          <button
            className={`node-card__run-btn ${runtimeSummary.status === 'running' ? 'node-card__run-btn--running' : ''}`}
            onPointerDown={stopNodeControlEvent}
            type="button"
            onClick={(e) => { e.stopPropagation(); onRunMock() }}
          >
            {runtimeSummary.status === 'running' ? '■ Stop' : '▶ Run'}
          </button>
        ) : null}
      </header>

      <div className="node-card__body">
        {shape.props.nodeType === 'prompt' ? (
          <PromptPreview data={data} onDataChange={onDataChange} />
        ) : null}
        {shape.props.nodeType === 'image_gen' || shape.props.nodeType === 'image_gen_4' ? (
          <ImageGeneratePreview
            data={data}
            imageCount={shape.props.nodeType === 'image_gen_4' ? 4 : 1}
            onDataChange={onDataChange}
            runtimeSummary={runtimeSummary}
          />
        ) : null}
        {shape.props.nodeType === 'analysis' ? (
          <AnalysisPreview data={data} onDataChange={onDataChange} runtimeSummary={runtimeSummary} />
        ) : null}
        {shape.props.nodeType === 'image' ? <ImagePreview data={data} /> : null}
      </div>

      <footer className="node-card__footer">
        <span>{ports.map((port) => port.label).join(' · ')}</span>
        <span>{payloadAudit.byteSize} B props</span>
      </footer>

      {payloadAudit.issues.length > 0 ? (
        <div className="node-card__warning">{payloadAudit.issues[0]}</div>
      ) : null}
    </div>
  )
}

function PromptPreview({
  data,
  onDataChange,
}: {
  data: JsonObject
  onDataChange: (data: JsonObject) => void
}) {
  return (
    <label className="node-card__prompt-field" onPointerDown={stopNodeControlEvent} onWheel={stopNodeControlEvent}>
      <span>Prompt</span>
      <textarea
        value={String(data.prompt ?? '')}
        onChange={(event) => onDataChange({ ...data, prompt: event.currentTarget.value })}
      />
    </label>
  )
}

function ImageGeneratePreview({
  data,
  imageCount,
  onDataChange,
  runtimeSummary,
}: {
  data: JsonObject
  imageCount: 1 | 4
  onDataChange: (data: JsonObject) => void
  runtimeSummary: NodeRuntimeSummary
}) {
  const modelId = String(data.modelId ?? 'gpt-image-2')
  const aspectRatio = String(data.aspectRatio ?? 'auto')
  const resolution = String(data.resolution ?? '1K')
  const results = runtimeSummary.resultAssetIds ?? []

  return (
    <>
      <div className="node-card__field-grid" onPointerDown={stopNodeControlEvent} onWheel={stopNodeControlEvent}>
        <label>
          <span>Model</span>
          <select value={modelId} onChange={(event) => onDataChange({ ...data, modelId: event.currentTarget.value })}>
            <option value="gpt-image-2">GPT Image 2</option>
            <option value="gemini-3.1-flash-image-preview">Gemini 3.1 Flash</option>
          </select>
        </label>
        <label>
          <span>Aspect</span>
          <select value={aspectRatio} onChange={(event) => onDataChange({ ...data, aspectRatio: event.currentTarget.value })}>
            <option value="auto">Auto</option>
            <option value="1:1">1:1</option>
            <option value="4:3">4:3</option>
            <option value="16:9">16:9</option>
            <option value="3:2">3:2</option>
          </select>
        </label>
        <label>
          <span>Resolution</span>
          <select value={resolution} onChange={(event) => onDataChange({ ...data, resolution: event.currentTarget.value })}>
            <option value="0.5K">0.5K</option>
            <option value="1K">1K</option>
            <option value="2K">2K</option>
            <option value="4K">4K</option>
          </select>
        </label>
      </div>

      <div className="node-card__result-grid">
        {Array.from({ length: imageCount }).map((_, index) => (
          <div className="node-card__mock-image" data-filled={results[index] ? 'true' : undefined} key={index}>
            {results[index] ? `asset_${index + 1}` : index + 1}
          </div>
        ))}
      </div>
    </>
  )
}

function AnalysisPreview({
  data,
  onDataChange,
  runtimeSummary,
}: {
  data: JsonObject
  onDataChange: (data: JsonObject) => void
  runtimeSummary: NodeRuntimeSummary
}) {
  return (
    <div className="node-card__analysis" onPointerDown={stopNodeControlEvent} onWheel={stopNodeControlEvent}>
      <div className="node-card__thumb" data-type="image">img</div>
      <label className="node-card__prompt-field node-card__prompt-field--compact">
        <textarea
          value={String(data.analysisPrompt ?? '')}
          onChange={(event) => onDataChange({ ...data, analysisPrompt: event.currentTarget.value })}
        />
      </label>
      <div className="node-card__analysis-output">
        {runtimeSummary.status === 'succeeded' ? 'Analysis text output will become a text connection.' : ''}
      </div>
    </div>
  )
}

function ImagePreview({ data }: { data: JsonObject }) {
  return (
    <div className="node-card__image-preview">
      <div className="node-card__image-frame">
        <span>{String(data.title ?? 'Image')}</span>
      </div>
    </div>
  )
}

function asJsonObject(value: JsonValue): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as unknown as JsonObject) : {}
}

function asRuntimeSummary(value: JsonValue): NodeRuntimeSummary {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { costHint: null, error: null, lastRunId: null, resultAssetIds: [], status: 'idle' }
  }
  const summary = value as Partial<NodeRuntimeSummary>
  return {
    costHint: summary.costHint ?? null,
    error: summary.error ?? null,
    lastRunId: summary.lastRunId ?? null,
    resultAssetIds: summary.resultAssetIds ?? [],
    status: summary.status ?? 'idle',
  }
}
