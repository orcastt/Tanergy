'use client'

import type { JsonValue } from '@tldraw/utils'
import type { Editor } from 'tldraw'
import type { NodeCardShape } from '@/types/nodeCardShape'
import type { JsonObject, NodeRuntimeSummary } from '@/types/nodeRuntime'
import { useCanvasPerformanceStore } from '@/features/canvas-performance/canvasPerformanceStore'
import { getNodeDefinition, getResolvedNodePorts } from '@/features/node-runtime/registry'
import { createCanvasImageFromNode } from '@/features/node-runtime/imageNodeAssets'
import { getImageNodeEffectiveAsset } from '@/features/node-runtime/imageNodeEffectiveAsset'
import { auditNodePayload } from '@/features/node-runtime/payloadAudit'
import { resolveNodeInputs } from '@/features/node-runtime/nodeDataFlow'
import { useNodeEdgeStore } from '@/features/node-runtime/nodeEdges'
import { useEditorRevision } from '@/components/canvas/useEditorRevision'
import { NodePortDot } from './NodePortDot'
import { AnalysisPreview, ImageGeneratePreview, ImagePreview, PromptPreview } from './NodeCardPreviews'

type NodeCardContentProps = {
  editor: Editor
  getEditorPagePoint: (localX: number, localY: number) => { x: number; y: number } | null
  onDataChange: (data: JsonObject) => void
  onRunMock: () => void
  shape: NodeCardShape
}

function stopNodeControlEvent(event: React.SyntheticEvent) {
  event.preventDefault()
  event.stopPropagation()
}

function clearBrowserSelection() {
  window.getSelection()?.removeAllRanges()
}

export function NodeCardContent({ editor, getEditorPagePoint, onDataChange, onRunMock, shape }: NodeCardContentProps) {
  const nodeRenderMode = useCanvasPerformanceStore((state) => state.nodeRenderMode)
  const zoom = useCanvasPerformanceStore((state) => state.zoom)
  const definition = getNodeDefinition(shape.props.nodeType)
  const data = asJsonObject(shape.props.data)
  const runtimeSummary = asRuntimeSummary(shape.props.runtimeSummary)
  const ports = getResolvedNodePorts(shape.props.nodeType, data)
  const shouldUseShell = nodeRenderMode === 'shell' && !hasReadableImageNodeFootprint(shape, zoom)

  if (shouldUseShell) {
    return (
      <div className={`node-card node-card--${shape.props.nodeType} node-card--shell`}>
        <NodeCardPorts getEditorPagePoint={getEditorPagePoint} ports={ports} shape={shape} />
        <div className="node-card__shell-body">
          <span className="node-card__shell-title">{definition.displayName}</span>
          <span className="node-card__shell-status" data-status={runtimeSummary.status}>
            {runtimeSummary.status === 'idle' ? `${ports.length} ports` : runtimeSummary.status}
          </span>
        </div>
      </div>
    )
  }

  return (
    <NodeCardFullContent
      data={data}
      definition={definition}
      editor={editor}
      getEditorPagePoint={getEditorPagePoint}
      onDataChange={onDataChange}
      onRunMock={onRunMock}
      ports={ports}
      runtimeSummary={runtimeSummary}
      shape={shape}
    />
  )
}

function NodeCardFullContent({
  data,
  definition,
  editor,
  getEditorPagePoint,
  onDataChange,
  onRunMock,
  ports,
  runtimeSummary,
  shape,
}: NodeCardContentProps & {
  data: JsonObject
  definition: ReturnType<typeof getNodeDefinition>
  ports: ReturnType<typeof getResolvedNodePorts>
  runtimeSummary: NodeRuntimeSummary
}) {
  useEditorRevision(editor, 'node-content')
  useNodeEdgeStore((state) => state.edges)
  const inputResolution = resolveNodeInputs(editor, shape)
  const imageAsset = shape.props.nodeType === 'image' ? getImageNodeEffectiveAsset(data, inputResolution) : null
  const payloadAudit = auditNodePayload({
    data,
    nodeId: shape.props.nodeId,
    runtimeSummary,
    version: shape.props.version,
  })

  return (
    <div className={`node-card node-card--${shape.props.nodeType}`}>
      <NodeCardPorts getEditorPagePoint={getEditorPagePoint} ports={ports} shape={shape} />

      <header className="node-card__header">
        <h2>{definition.displayName}</h2>
        <div className="node-card__header-actions">
          {shape.props.nodeType === 'image' ? (
            <button
              className="node-card__action-btn"
              disabled={!imageAsset}
              onMouseDown={stopNodeControlEvent}
              onPointerDown={stopNodeControlEvent}
              type="button"
              onClick={(event) => {
                clearBrowserSelection()
                event.stopPropagation()
                if (!imageAsset) return
                createCanvasImageFromNode(editor, {
                  assetId: imageAsset.assetId,
                  imageHeight: imageAsset.imageHeight,
                  imageWidth: imageAsset.imageWidth,
                  x: shape.x + shape.props.w + 40,
                  y: shape.y,
                })
                clearBrowserSelection()
              }}
              title={imageAsset ? 'Convert to canvas image' : 'Import or connect an image first.'}
            >
              To Canvas
            </button>
          ) : null}
          {(shape.props.nodeType === 'image_gen' || shape.props.nodeType === 'image_gen_4' || shape.props.nodeType === 'analysis') ? (
            <button
              className={`node-card__run-btn ${runtimeSummary.status === 'running' ? 'node-card__run-btn--running' : ''}`}
              disabled={!inputResolution.canRun}
              onMouseDown={stopNodeControlEvent}
              onPointerDown={stopNodeControlEvent}
              type="button"
              onClick={(e) => {
                clearBrowserSelection()
                e.stopPropagation()
                onRunMock()
                clearBrowserSelection()
              }}
              title={inputResolution.runHint}
            >
              {runtimeSummary.status === 'running' ? '■ Stop' : '▶ Run'}
            </button>
          ) : null}
        </div>
      </header>

      <div className="node-card__body">
        {shape.props.nodeType === 'prompt' ? (
          <PromptPreview data={data} inputResolution={inputResolution} onDataChange={onDataChange} />
        ) : null}
        {shape.props.nodeType === 'image_gen' || shape.props.nodeType === 'image_gen_4' ? (
          <ImageGeneratePreview
            data={data}
            imageCount={shape.props.nodeType === 'image_gen_4' ? 4 : 1}
            inputResolution={inputResolution}
            onDataChange={onDataChange}
            runtimeSummary={runtimeSummary}
          />
        ) : null}
        {shape.props.nodeType === 'analysis' ? (
          <AnalysisPreview
            data={data}
            inputResolution={inputResolution}
            onDataChange={onDataChange}
            runtimeSummary={runtimeSummary}
          />
        ) : null}
        {shape.props.nodeType === 'image' ? (
          <ImagePreview
            data={data}
            editor={editor}
            inputResolution={inputResolution}
            shape={shape}
          />
        ) : null}
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

function NodeCardPorts({
  getEditorPagePoint,
  ports,
  shape,
}: {
  getEditorPagePoint: NodeCardContentProps['getEditorPagePoint']
  ports: ReturnType<typeof getResolvedNodePorts>
  shape: NodeCardShape
}) {
  return (
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
  )
}

function hasReadableImageNodeFootprint(shape: NodeCardShape, zoom: number) {
  if (shape.props.nodeType !== 'image') return false
  return shape.props.w * zoom >= 220 && shape.props.h * zoom >= 160
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
    ...(value as NodeRuntimeSummary),
    costHint: summary.costHint ?? null,
    error: summary.error ?? null,
    lastRunId: summary.lastRunId ?? null,
    resultAssetIds: summary.resultAssetIds ?? [],
    status: summary.status ?? 'idle',
  }
}
