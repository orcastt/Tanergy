import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function POST() {
  return NextResponse.json(
    { error: 'Remove BG requires the FastAPI image-ops service and services/api[image-ops].' },
    { status: 501 }
  )
}
