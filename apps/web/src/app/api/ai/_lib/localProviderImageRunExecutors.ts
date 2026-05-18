import {
  buildJiekouImagePath,
  getImageModelFamily,
  nanoBanana2ModelId,
  toJiekouNanoBananaImageSize,
  toJiekouNanoBananaSize,
  type ImageModelExecutor,
  type ImageModelFamily,
  type ImageModelRunInput,
  type ProviderClientConfig,
  type ProviderImageResponse,
} from './localProviderImageRunSupport'
import {
  extractImageSources,
  getProviderClientConfig,
  postProviderJson,
  settleImageTask,
} from './localProviderImageRunProviderClient'

const defaultImageModelExecutors: Record<ImageModelFamily, ImageModelExecutor> = {
  'doubao-seedream-5.0-lite': (input) => runDoubaoSeedreamLite({
    clientConfig: input.clientConfig,
    count: input.count,
    inputImages: input.inputImages,
    outputFormat: input.seedreamOutputFormat,
    prompt: input.prompt,
    size: input.seedreamSize,
  }),
  'gpt-image-2': (input) => runGptImage2({
    clientConfig: input.clientConfig,
    count: input.count,
    inputImages: input.inputImages,
    prompt: input.prompt,
    quality: input.gptQuality,
    size: input.gptSize,
  }),
  'nano-banana-2': (input) => runNanoBanana2({
    aspectRatio: input.nanoBananaAspectRatio,
    clientConfig: input.clientConfig,
    count: input.count,
    imageSize: input.nanoBananaImageSize,
    inputImages: input.inputImages,
    prompt: input.prompt,
  }),
}

const providerImageModelExecutors: Partial<Record<string, Partial<Record<ImageModelFamily, ImageModelExecutor>>>> = {
  jiekou: {
    'doubao-seedream-5.0-lite': (input) => runJiekouSeedreamLite({
      clientConfig: input.clientConfig,
      count: input.count,
      inputImages: input.inputImages,
      prompt: input.prompt,
      size: input.seedreamSize,
    }),
    'gpt-image-2': (input) => runJiekouGptImage2({
      clientConfig: input.clientConfig,
      count: input.count,
      inputImages: input.inputImages,
      prompt: input.prompt,
      quality: input.gptQuality,
      size: input.gptSize,
    }),
    'nano-banana-2': (input) => runJiekouNanoBanana2({
      aspectRatio: input.nanoBananaAspectRatio,
      clientConfig: input.clientConfig,
      count: input.count,
      imageSize: input.nanoBananaImageSize,
      inputImages: input.inputImages,
      prompt: input.prompt,
    }),
  },
}

export async function createLocalProviderImageExecutor(input: ImageModelRunInput) {
  const clientConfig = getProviderClientConfig(input.provider)
  const family = getImageModelFamily(input.modelId)
  const providerExecutors = providerImageModelExecutors[clientConfig.provider] ?? {}
  const executor = providerExecutors[family] ?? defaultImageModelExecutors[family]
  if (!executor) throw new Error(`Unsupported local image model: ${input.modelId}`)
  return executor({ ...input, clientConfig })
}

async function runNanoBanana2(input: { aspectRatio: string; clientConfig: ProviderClientConfig; count: number; imageSize: string; inputImages: string[]; prompt: string }) {
  const sharedBody = { aspect_ratio: input.aspectRatio, model: nanoBanana2ModelId, prompt: input.prompt, retries: 0, size: input.imageSize }
  const outputs: string[] = []
  for (let index = 0; index < input.count; index += 1) {
    if (input.inputImages.length === 0) outputs.push(...await runSingleImageGeneration(sharedBody, input.clientConfig))
    else outputs.push(...extractImageSources(await settleImageTask(await postProviderJson<ProviderImageResponse>('/images/edits', { ...sharedBody, image: input.inputImages.length === 1 ? input.inputImages[0] : input.inputImages }, input.clientConfig), input.clientConfig)))
  }
  return outputs
}

async function runJiekouNanoBanana2(input: { aspectRatio: string; clientConfig: ProviderClientConfig; count: number; imageSize: string; inputImages: string[]; prompt: string }) {
  const sharedBody = { aspect_ratio: toJiekouNanoBananaSize(input.aspectRatio), output_format: 'png', prompt: input.prompt, size: toJiekouNanoBananaImageSize(input.imageSize) }
  const endpoint = input.inputImages.length > 0 ? 'gemini-3.1-flash-image-edit' : 'gemini-3.1-flash-image-text-to-image'
  return runRepeatedJiekouImageGenerations(endpoint, { ...sharedBody, ...(input.inputImages.length > 0 ? { image_base64s: input.inputImages.map(toJiekouInlineImageBase64) } : {}) }, input.count, input.clientConfig)
}

async function runGptImage2(input: { clientConfig: ProviderClientConfig; count: number; inputImages: string[]; prompt: string; quality: string; size: string }) {
  const sharedBody = { background: 'auto', model: 'gpt-image-2', n: 1, output_format: 'png', prompt: input.prompt, quality: input.quality, response_format: 'url', retries: 0, size: input.size }
  const outputs: string[] = []
  for (let index = 0; index < input.count; index += 1) outputs.push(...await runSingleGptImage2(sharedBody, input.inputImages, input.clientConfig))
  return outputs
}

async function runJiekouGptImage2(input: { clientConfig: ProviderClientConfig; count: number; inputImages: string[]; prompt: string; quality: string; size: string }) {
  const endpoint = input.inputImages.length > 0 ? 'gpt-image-2-edit' : 'gpt-image-2-text-to-image'
  const sharedBody = { background: 'auto', n: 1, output_format: 'png', prompt: input.prompt, quality: input.quality, size: input.size, ...(input.inputImages.length === 0 ? { moderation: 'auto' } : {}), ...(input.inputImages.length > 0 ? { image: input.inputImages.length === 1 ? input.inputImages[0] : input.inputImages } : {}) }
  return runRepeatedJiekouImageGenerations(endpoint, sharedBody, input.count, input.clientConfig)
}

async function runDoubaoSeedreamLite(input: { clientConfig: ProviderClientConfig; count: number; inputImages: string[]; outputFormat: string; prompt: string; size: string }) {
  const sharedBody = { model: 'doubao-seedream-5.0-lite', output_format: input.outputFormat, prompt: input.prompt, retries: 0, size: input.size, watermark: false, ...createImageReferenceBody(input.inputImages) }
  if (input.count <= 1) return runSingleImageGeneration(sharedBody, input.clientConfig)
  try {
    const grouped = await runSingleImageGeneration({ ...sharedBody, extra_body: { sequential_image_generation: 'auto', sequential_image_generation_options: { max_images: input.count } } }, input.clientConfig)
    return (grouped.length >= input.count ? grouped : [...grouped, ...await runRepeatedImageGenerations(sharedBody, input.count - grouped.length, input.clientConfig)]).slice(0, input.count)
  } catch {
    return runRepeatedImageGenerations(sharedBody, input.count, input.clientConfig)
  }
}

async function runJiekouSeedreamLite(input: { clientConfig: ProviderClientConfig; count: number; inputImages: string[]; prompt: string; size: string }) {
  const sharedBody = { optimize_prompt_options: { mode: 'standard' }, prompt: input.prompt, sequential_image_generation: 'disabled', size: input.size, watermark: false, ...(input.inputImages.length > 0 ? { image: input.inputImages } : {}) }
  if (input.count <= 1) return extractImageSources(await postProviderJson<ProviderImageResponse>(buildJiekouImagePath('seedream-5.0-lite'), sharedBody, input.clientConfig))
  const outputs = extractImageSources(await postProviderJson<ProviderImageResponse>(buildJiekouImagePath('seedream-5.0-lite'), { ...sharedBody, sequential_image_generation: 'auto', sequential_image_generation_options: { max_images: input.count } }, input.clientConfig))
  return (outputs.length >= input.count ? outputs : [...outputs, ...await runRepeatedJiekouImageGenerations('seedream-5.0-lite', sharedBody, input.count - outputs.length, input.clientConfig)]).slice(0, input.count)
}

async function runSingleGptImage2(sharedBody: Record<string, unknown>, inputImages: string[], clientConfig: ProviderClientConfig) {
  if (inputImages.length === 0) return extractImageSources(await settleImageTask(await postProviderJson<ProviderImageResponse>('/images/generations', sharedBody, clientConfig), clientConfig))
  if (inputImages.length === 1) return extractImageSources(await settleImageTask(await postProviderJson<ProviderImageResponse>('/images/edits', { ...sharedBody, image: inputImages[0] }, clientConfig), clientConfig))
  try {
    return extractImageSources(await settleImageTask(await postProviderJson<ProviderImageResponse>('/images/generations', { ...sharedBody, image: inputImages }, clientConfig), clientConfig))
  } catch {
    return extractImageSources(await settleImageTask(await postProviderJson<ProviderImageResponse>('/images/generations', { ...sharedBody, images: inputImages } as Record<string, unknown>, clientConfig), clientConfig))
  }
}

async function runRepeatedImageGenerations(sharedBody: Record<string, unknown>, count: number, clientConfig: ProviderClientConfig) {
  const outputs: string[] = []
  for (let index = 0; index < count; index += 1) outputs.push(...await runSingleImageGeneration(sharedBody, clientConfig))
  return outputs
}

async function runRepeatedJiekouImageGenerations(endpoint: string, sharedBody: Record<string, unknown>, count: number, clientConfig: ProviderClientConfig) {
  const outputs: string[] = []
  for (let index = 0; index < count; index += 1) outputs.push(...extractImageSources(await postProviderJson<ProviderImageResponse>(buildJiekouImagePath(endpoint), sharedBody, clientConfig)))
  return outputs
}

async function runSingleImageGeneration(body: Record<string, unknown>, clientConfig: ProviderClientConfig) {
  return extractImageSources(await settleImageTask(await postProviderJson<ProviderImageResponse>('/images/generations', body, clientConfig), clientConfig))
}

function createImageReferenceBody(inputImages: string[]) {
  if (inputImages.length === 0) return {}
  return { image: inputImages.length === 1 ? inputImages[0] : inputImages }
}

function toJiekouInlineImageBase64(image: string) {
  return image.startsWith('data:') && image.includes(',') ? image.split(',', 2)[1] : image
}
