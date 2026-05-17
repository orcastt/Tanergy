import type { ApiRequestContext } from '../../_lib/apiRequestContext'
import { createLocalProviderImageExecutor } from './localProviderImageRunExecutors'
import { persistGeneratedImage, resolveInputImages } from './localProviderImageRunPersistence'
import {
  clampCount,
  createCostHint,
  createRunId,
  getString,
  mapLegacyGptQuality,
  mapLegacyGptSize,
  mapLegacyNanoBananaImageSize,
  normalizeGptImageQuality,
  normalizeGptImageSize,
  normalizeNanoBananaAspectRatio,
  normalizeNanoBananaImageSize,
  normalizeSeedreamOutputFormat,
  normalizeSeedreamSize,
} from './localProviderImageRunSupport'
import { normalizeImageGenerationModelId } from '@/features/ai/aiImageModelCatalog'
import { getAiModelDefinition, asAiRunParams } from '@/features/ai/mockAiContracts'
import type { AiRunRecord, AiRunRequest } from '@/features/ai/aiTypes'
import type { AiRunChargeSummary } from '@/features/billing/billingTypes'

export async function createLocalProviderImageRun(input: {
  context: ApiRequestContext
  charge: AiRunChargeSummary
  request: AiRunRequest
}) {
  const startedAt = Date.now()
  const prompt = input.request.prompt?.trim()
  if (!prompt) throw new Error('Missing image prompt.')

  const normalizedModelId = normalizeImageGenerationModelId(input.request.selectedModelId)
  const model = getAiModelDefinition(normalizedModelId)
  const params = asAiRunParams(input.request.params)
  const count = clampCount(Number(params.count ?? 1))
  const referenceImages = await resolveInputImages(input.request.inputAssetIds ?? [], input.context)

  const generatedSources = (await createLocalProviderImageExecutor({
    count,
    gptQuality: normalizeGptImageQuality(getString(params.quality) ?? mapLegacyGptQuality(getString(params.resolution))),
    gptSize: normalizeGptImageSize(getString(params.size) ?? mapLegacyGptSize(getString(params.aspectRatio))),
    inputImages: referenceImages,
    modelId: model.id,
    nanoBananaAspectRatio: normalizeNanoBananaAspectRatio(getString(params.aspectRatio)),
    nanoBananaImageSize: normalizeNanoBananaImageSize(getString(params.imageSize) ?? mapLegacyNanoBananaImageSize(getString(params.resolution))),
    prompt,
    provider: model.provider,
    seedreamOutputFormat: normalizeSeedreamOutputFormat(getString(params.seedreamOutputFormat)),
    seedreamSize: normalizeSeedreamSize(getString(params.seedreamSize) ?? getString(params.size)),
  })).slice(0, count)

  if (generatedSources.length === 0) throw new Error('Image provider did not return any generated images.')

  const assets = await Promise.all(
    generatedSources.map((source, index) => persistGeneratedImage({
      context: input.context,
      index,
      prompt,
      source,
    }))
  )

  return {
    boardId: input.request.boardId ?? null,
    charge: input.charge,
    chargedAccountId: input.charge.chargedAccountId,
    chargedScope: input.charge.chargedScope,
    costCredits: 0,
    costHint: createCostHint(model.provider, model.id, model.displayName, params),
    createdAt: new Date().toISOString(),
    entitlementSource: input.charge.entitlementSource,
    error: null,
    inputAssetIds: input.request.inputAssetIds ?? [],
    latencyMs: Math.max(1, Date.now() - startedAt),
    modelId: model.id,
    nodeId: input.request.nodeId ?? null,
    outputAssetIds: assets.map((asset) => asset.id),
    provider: model.provider,
    runId: createRunId(),
    runType: 'image_generation',
    status: 'succeeded',
    workspaceKind: input.charge.workspaceKind,
    workspaceSeatId: input.charge.workspaceSeatId ?? null,
  } satisfies AiRunRecord
}

export const createProviderImageRun = createLocalProviderImageRun
