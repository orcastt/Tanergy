'use client'

import type { Editor } from 'tldraw'
import type { NodeCardShape } from '@/types/nodeCardShape'
import type { JsonObject, NodeRuntimeSummary } from '@/types/nodeRuntime'
import type { RuntimeInputResolution } from '@/features/node-runtime/nodeDataFlow'
import { getAnalysisModelSelectOptions, getDefaultAnalysisModelId, getDefaultImageModelId } from '@/features/ai/mockAiContracts'
import { useAiModels } from '@/features/ai/useAiModels'
import { getImageGenerationCardFields, getNormalizedAnalysisData, getNormalizedImageGenerationData } from '@/features/node-runtime/registry'
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
  const normalizedData = getNormalizedImageGenerationData(data)
  const fields = getImageGenerationCardFields(normalizedData)
  const modelId = String(normalizedData.modelId ?? getDefaultImageModelId())
  const results = runtimeSummary.resultAssetIds ?? []
  const modelOptions = models.some((model) => model.id === modelId)
    ? models
    : [{ ...models[0], displayName: modelId, id: modelId, isEnabled: false }, ...models]

  return (
    <>
      <div className="node-card__field-grid" onPointerDown={stopNodeControlEvent} onWheel={stopNodeControlEvent}>
        {fields.map((field) => (
          <label key={field.name}>
            <span>{getPreviewFieldLabel(field.name, field.label)}</span>
            <select
              value={String(normalizedData[field.name] ?? '')}
              onChange={(event) => onDataChange({ ...data, [field.name]: event.currentTarget.value })}
            >
              {(field.name === 'modelId' ? modelOptions.map((model) => ({
                disabled: !model.isEnabled,
                label: model.displayName,
                value: model.id,
              })) : field.options ?? []).map((option) => (
                <option disabled={Boolean('disabled' in option && option.disabled)} key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        ))}
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
  const analysisModels = useAiModels('image_analysis')
  const normalizedData = getNormalizedAnalysisData(data)
  const modelId = String(normalizedData.modelId ?? getDefaultAnalysisModelId())
  const fallbackOptions = getAnalysisModelSelectOptions()
  const modelOptions = analysisModels.length > 0
    ? analysisModels.map((model) => ({
        disabled: !model.isEnabled,
        label: model.displayName,
        value: model.id,
      }))
    : fallbackOptions
  const textOutput = String(runtimeSummary.textOutput ?? '')
  return (
    <div className="node-card__analysis" onPointerDown={stopNodeControlEvent} onWheel={stopNodeControlEvent}>
      <div className="node-card__thumb" data-type="image">{inputResolution.imageValues.length || 'img'}</div>
      <label className="node-card__analysis-model-field">
        <select
          aria-label="Analysis model"
          value={modelId}
          onChange={(event) => onDataChange({ ...data, modelId: event.currentTarget.value })}
        >
          {modelOptions.map((option) => (
            <option disabled={option.disabled} key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <label className="node-card__prompt-field node-card__prompt-field--compact">
        <textarea
          value={String(normalizedData.analysisPrompt ?? '')}
          onChange={(event) => onDataChange({ ...data, analysisPrompt: event.currentTarget.value })}
        />
      </label>
      <div className="node-card__analysis-output">
        {textOutput || (inputResolution.canRun ? 'Ready to output analysis text.' : inputResolution.missingReasons[0])}
      </div>
    </div>
  )
}

export function PromptOptimizerPreview({
  inputResolution,
  runtimeSummary,
}: PreviewProps & {
  runtimeSummary: NodeRuntimeSummary
}) {
  const optimizedPrompt = String(runtimeSummary.textOutput ?? '')
  return (
    <div className="node-card__prompt-optimizer" onPointerDown={stopNodeControlEvent} onWheel={stopNodeControlEvent}>
      <span>Optimized preview</span>
      <div className="node-card__analysis-output">
        {optimizedPrompt || (runtimeSummary.status === 'running'
          ? 'Generating...'
          : inputResolution.canRun ? 'Ready to optimize.' : inputResolution.missingReasons[0])}
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

function getPreviewFieldLabel(fieldName: string, label: string) {
  if (fieldName === 'aspectRatio') return 'Aspect'
  if (fieldName === 'imageSize') return 'Image'
  return label
}
