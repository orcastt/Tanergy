import { NextResponse } from 'next/server'
import { isTangentAssetOrigin, type TangentAssetOrigin } from '@/features/assets/assetTypes'
import { getApiRequestContext } from '../../_lib/apiRequestContext'
import { getAssetStorageAdapter } from '../_lib/assetStorageAdapter'

export const runtime = 'nodejs'

const acceptedUploadImageTypes = new Set(['image/png', 'image/jpeg', 'image/webp'])
const maxUploadImageBytes = 100 * 1024 * 1024
const maxUploadRequestBytes = maxUploadImageBytes + 1024 * 1024

export async function POST(request: Request) {
  try {
    assertRequestContentLength(request, maxUploadRequestBytes, 'Upload request is too large.')
    const form = await request.formData()
    const file = form.get('file')
    if (!(file instanceof File)) throw new Error('Missing image file.')
    if (!acceptedUploadImageTypes.has(file.type)) throw new Error('Use PNG, JPEG, or WebP.')
    if (file.size > maxUploadImageBytes) throw new Error('Image must be 100MB or smaller.')

    const record = await getAssetStorageAdapter().createFromUpload({
      bytes: await file.arrayBuffer(),
      fileName: file.name,
      height: getOptionalNumber(form.get('height')),
      mime: file.type,
      origin: getOrigin(form.get('origin')),
      title: getOptionalString(form.get('title')) ?? file.name,
      width: getOptionalNumber(form.get('width')),
    }, getApiRequestContext(request))
    return NextResponse.json({ asset: record })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Asset upload failed.' },
      { status: 400 }
    )
  }
}

function assertRequestContentLength(request: Request, maxBytes: number, message: string) {
  const raw = request.headers.get('content-length')
  if (!raw) return
  const byteLength = Number(raw)
  if (Number.isFinite(byteLength) && byteLength > maxBytes) throw new Error(message)
}

function getOptionalNumber(value: FormDataEntryValue | null) {
  if (typeof value !== 'string' || value.trim() === '') return undefined
  const number = Number(value)
  return Number.isFinite(number) ? number : undefined
}

function getOptionalString(value: FormDataEntryValue | null) {
  return typeof value === 'string' && value.trim() ? value : undefined
}

function getOrigin(value: FormDataEntryValue | null): TangentAssetOrigin | undefined {
  return isTangentAssetOrigin(value) ? value : undefined
}
