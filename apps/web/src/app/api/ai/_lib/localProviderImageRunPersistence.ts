import type { ApiRequestContext } from '../../_lib/apiRequestContext'
import { getAssetStorageAdapter } from '../../assets/_lib/assetStorageAdapter'
import { getImageDimensionsFromBytes, getImageExtensionFromMime } from '../../assets/_lib/imageByteMetadata'
import { fetchRemoteImageForAsset } from '../../assets/_lib/remoteImageImport'
import {
  assertAiInlineImageTotalByteLength,
  arrayBufferFromBuffer,
  parseAiInlineImageDataUrl,
  toAiInlineImageDataUrl,
} from './aiInlineImageGuards'
import { maxImageReferenceInputs } from './localProviderImageRunSupport'

export async function persistGeneratedImage(input: {
  context: ApiRequestContext
  index: number
  prompt: string
  source: string
}) {
  if (input.source.startsWith('data:')) {
    const parsed = parseDataUrl(input.source)
    const dimensions = getImageDimensionsFromBytes(parsed.bytes, parsed.mime)
    return getAssetStorageAdapter().createFromUpload({
      bytes: parsed.bytes,
      fileName: `ai-${input.index + 1}.${getImageExtensionFromMime(parsed.mime)}`,
      height: dimensions?.height,
      mime: parsed.mime,
      origin: 'ai_run',
      title: createGeneratedAssetTitle(input.prompt, input.index),
      width: dimensions?.width,
    }, input.context)
  }

  const remote = await fetchRemoteImageForAsset(input.source)
  return getAssetStorageAdapter().createFromUpload({
    bytes: remote.bytes,
    fileName: remote.fileName,
    height: remote.height,
    mime: remote.mime,
    origin: 'ai_run',
    title: createGeneratedAssetTitle(input.prompt, input.index),
    width: remote.width,
  }, input.context)
}

export async function resolveInputImages(assetIds: string[], context: ApiRequestContext) {
  const uniqueIds = [...new Set(assetIds.filter(Boolean))]
  if (uniqueIds.length > maxImageReferenceInputs) {
    throw new Error(`Image generation accepts up to ${maxImageReferenceInputs} reference images.`)
  }
  const imageUrls: string[] = []
  let totalInlineBytes = 0
  for (const assetId of uniqueIds) {
    const record = await getAssetStorageAdapter().getRecord(assetId, context)
    const fileUrl = record.originalUrl
    const fileName = getAssetFileName(fileUrl)
    const { file, mime } = await getAssetStorageAdapter().readFile(assetId, fileName, context)
    totalInlineBytes += file.byteLength
    assertAiInlineImageTotalByteLength(totalInlineBytes, 'Reference images exceed the total allowed size for image generation.')
    imageUrls.push(toAiInlineImageDataUrl(mime, file))
  }
  return imageUrls
}

function parseDataUrl(dataUrl: string) {
  const parsed = parseAiInlineImageDataUrl(dataUrl)
  return {
    bytes: arrayBufferFromBuffer(parsed.buffer),
    mime: parsed.mime,
  }
}

function createGeneratedAssetTitle(prompt: string, index: number) {
  const cleanPrompt = prompt.replace(/\s+/g, ' ').trim().slice(0, 48) || 'Generated image'
  return index === 0 ? cleanPrompt : `${cleanPrompt} ${index + 1}`
}

function getAssetFileName(url: string) {
  const pathname = new URL(url, 'http://tangent.local').pathname
  const fileName = pathname.split('/').filter(Boolean).at(-1)
  if (!fileName) throw new Error('Asset file URL is missing a filename.')
  return fileName
}
