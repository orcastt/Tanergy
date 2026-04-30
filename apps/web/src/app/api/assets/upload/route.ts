import { NextResponse } from 'next/server'
import { createLocalAssetFromUpload } from '../_lib/localAssetStore'
import type { TangentAssetOrigin } from '@/features/assets/assetTypes'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const form = await request.formData()
    const file = form.get('file')
    if (!(file instanceof File)) throw new Error('Missing image file.')

    const record = await createLocalAssetFromUpload({
      bytes: await file.arrayBuffer(),
      fileName: file.name,
      height: getOptionalNumber(form.get('height')),
      mime: file.type,
      origin: getOrigin(form.get('origin')),
      title: getOptionalString(form.get('title')) ?? file.name,
      width: getOptionalNumber(form.get('width')),
    })
    return NextResponse.json({ asset: record })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Asset upload failed.' },
      { status: 400 }
    )
  }
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
  if (typeof value !== 'string') return undefined
  if (['ai_run', 'editor_export', 'generated', 'merge_capture', 'paste', 'screenshot', 'upload'].includes(value)) {
    return value as TangentAssetOrigin
  }
  return undefined
}
