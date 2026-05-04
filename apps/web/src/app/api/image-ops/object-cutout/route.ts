import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function POST() {
  return NextResponse.json(
    { error: 'Object Cutout is reserved for the Segment Anything point/box flow.' },
    { status: 501 }
  )
}
