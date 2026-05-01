'use client'

import type { Editor } from 'tldraw'
import type { NodeCardShape } from '@/types/nodeCardShape'
import type { JsonObject, NodeRuntimeSummary } from '@/types/nodeRuntime'
import type { RuntimeInputResolution } from '@/features/node-runtime/nodeDataFlow'
import { getDefaultImageModelId } from '@/features/ai/mockAiContracts'
import { useAiModels } from '@/features/ai/useAiModels'
import { ImageNodePreview } from './ImageNodePreview'

type PreviewProps = {
  data: JsonObject
  inputResolution: RuntimeInputResolution
  onDataChange: (data: JsonObject) => void
}

function stopNodeControlEvent(event: React.SyntheticEvent) {
  event.stopPropagation()
}

export function PromptPreview({ data, inputResolution, onDataChange }: PreviewProps) {
  return (
    <>
      <label className="node-card__prompt-field node-card__prompt-field--unlabeled" onPointerDown={stopNodeControlEvent} onWheel={stopNodeControlEvent}>
        <textarea
          aria-label="Prompt"
          value={String(data.prompt ?? '')}
          onChange={(event) => onDataChange({ ...data, prompt: event.currentTarget.value })}
        />
      </label>
      {inputResolution.textValues.length > 0 ? (
        <FlowHint tone="success" text={`${inputResolution.textValues.length} text input merged`} />
      ) : null}
    </>
  )
}

export function ImageGeneratePreview({
  data,
  imageCount,
  inputResolution,
  onDataChange,
  runtimeSummary,
}: PreviewProps & {
  imageCount: 1 | 4
  runtimeSummary: NodeRuntimeSummary
}) {
  const models = useAiModels('image_generation')
  const modelId = String(data.modelId ?? getDefaultImageModelId())
  const aspectRatio = String(data.aspectRatio ?? 'auto')
  const resolution = String(data.resolution ?? '1K')
  const results = runtimeSummary.resultAssetIds ?? []
  const modelOptions = models.some((model) => model.id === modelId)
    ? models
    : [{ ...models[0], displayName: modelId, id: modelId, isEnabled: false }, ...models]

  return (
    <>
      <div className="node-card__field-grid" onPointerDown={stopNodeControlEvent} onWheel={stopNodeControlEvent}>
        <label>
          <span>Model</span>
          <select value={modelId} onChange={(event) => onDataChange({ ...data, modelId: event.currentTarget.value })}>
            {modelOptions.map((model) => (
              <option disabled={!model.isEnabled} key={model.id} value={model.id}>
                {model.displayName}
              </option>
            ))}
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
      <FlowHint
        tone={inputResolution.canRun ? 'success' : 'error'}
        text={inputResolution.canRun ? inputResolution.runHint : inputResolution.missingReasons[0]}
      />
    </>
  )
}

export function AnalysisPreview({
  data,
  inputResolution,
  onDataChange,
  runtimeSummary,
}: PreviewProps & {
  runtimeSummary: NodeRuntimeSummary
}) {
  const textOutput = String(runtimeSummary.textOutput ?? '')
  return (
    <div className="node-card__analysis" onPointerDown={stopNodeControlEvent} onWheel={stopNodeControlEvent}>
      <div className="node-card__thumb" data-type="image">{inputResolution.imageValues.length || 'img'}</div>
      <label className="node-card__prompt-field node-card__prompt-field--compact">
        <textarea
          value={String(data.analysisPrompt ?? '')}
          onChange={(event) => onDataChange({ ...data, analysisPrompt: event.currentTarget.value })}
        />
      </label>
      <div className="node-card__analysis-output">
        {textOutput || (inputResolution.canRun ? 'Ready to output analysis text.' : inputResolution.missingReasons[0])}
      </div>
    </div>
  )
}

export function ImagePreview(props: {
  data: JsonObject
  editor: Editor
  inputResolution: RuntimeInputResolution
  shape: NodeCardShape
}) {
  return <ImageNodePreview {...props} />
}

function FlowHint({ text, tone }: { text: string | undefined; tone: 'error' | 'success' }) {
  if (!text) return null
  return <div className={`node-card__flow-hint node-card__flow-hint--${tone}`}>{text}</div>
}
