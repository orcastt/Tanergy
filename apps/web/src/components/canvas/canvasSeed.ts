'use client'

import {
  AssetRecordType,
  DefaultColorStyle,
  DefaultSizeStyle,
  createShapeId,
  toRichText,
  type Editor,
  type TLAssetId,
} from 'tldraw'
import type { AiCardShape, AiCardTone } from './AiCardShape'

const sampleImageUrl = '/spikes/sample-image.svg'


function richText(text: string) {
  return toRichText(text)
}

export function seedCanvasSpike(editor: Editor) {
  if (editor.getCurrentPageShapeIds().size > 0) return

  createBoardKit(editor)
  createShapeSet(editor, 60, 320)
  createSampleImage(editor, 720, 80)
  createLinkCard(editor, 720, 460)
  createAiCards(editor, 60, 640)
  editor.zoomToFit({ animation: { duration: 240 } })
}

export function createBoardKit(editor: Editor, x = 60, y = 80) {
  editor.createShapes([
    {
      type: 'text',
      x,
      y,
      props: { richText: richText('Canvas Spike: whiteboard + AI node cards'), w: 560, size: 'xl' },
    },
    {
      type: 'note',
      x,
      y: y + 92,
      props: {
        color: 'yellow',
        richText: richText('Sticky note\\nDoes this feel simple enough?'),
      },
    },
    {
      type: 'frame',
      x: x + 320,
      y: y + 80,
      props: { name: 'Frame / board area', w: 320, h: 220 },
    },
  ])
}

export function createShapeSet(editor: Editor, x = 60, y = 320) {
  editor.setStyleForNextShapes(DefaultColorStyle, 'violet')
  editor.setStyleForNextShapes(DefaultSizeStyle, 'm')
  editor.createShapes([
    {
      type: 'geo',
      x,
      y,
      props: { geo: 'rectangle', w: 180, h: 110, richText: richText('Rectangle') },
    },
    {
      type: 'geo',
      x: x + 230,
      y,
      props: { geo: 'ellipse', w: 150, h: 110, richText: richText('Circle') },
    },
    {
      type: 'geo',
      x: x + 440,
      y,
      props: { geo: 'diamond', w: 160, h: 110, richText: richText('Decision') },
    },
    {
      type: 'arrow',
      x: x + 184,
      y: y + 44,
      props: { start: { x: 0, y: 0 }, end: { x: 52, y: 0 } },
    },
    {
      type: 'arrow',
      x: x + 386,
      y: y + 44,
      props: { start: { x: 0, y: 0 }, end: { x: 52, y: 0 } },
    },
  ])
}

export function createSampleImage(editor: Editor, x = 720, y = 80) {
  const assetId = AssetRecordType.createId('canvas-spike-sample-image') as TLAssetId
  if (!editor.getAsset(assetId)) {
    editor.createAssets([
      {
        id: assetId,
        type: 'image',
        typeName: 'asset',
        props: {
          h: 640,
          isAnimated: false,
          mimeType: 'image/svg+xml',
          name: 'sample-image.svg',
          src: sampleImageUrl,
          w: 960,
        },
        meta: {},
      },
    ])
  }

  editor.createShape({
    type: 'image',
    x,
    y,
    props: {
      assetId,
      h: 240,
      w: 360,
    },
  })
}

export function createLinkCard(editor: Editor, x = 720, y = 460) {
  createAiCard(editor, {
    detail: 'Mock metadata for pasted URLs in the spike.',
    id: 'link-card',
    subtitle: 'https://example.com/inspiration',
    title: 'Reference link card',
    tone: 'link',
    x,
    y,
  })
}

export function createAiCards(editor: Editor, x = 60, y = 640) {
  const promptId = createAiCard(editor, {
    detail: 'A clean product poster for a ceramic coffee cup.',
    id: 'prompt-card',
    subtitle: 'Text input for the image idea',
    title: 'Prompt',
    tone: 'prompt',
    x,
    y,
  })
  const generateId = createAiCard(editor, {
    detail: 'Model selector + 4 image result grid.',
    id: 'generate-card',
    subtitle: 'Generate 4 options',
    title: 'Generate',
    tone: 'generate',
    x: x + 340,
    y,
  })
  const editId = createAiCard(editor, {
    detail: 'Open drawing editor or send image to canvas.',
    id: 'edit-card',
    subtitle: 'Paint, mark up, export',
    title: 'Edit',
    tone: 'edit',
    x: x + 680,
    y,
  })

  createArrow(editor, x + 266, y + 74)
  createArrow(editor, x + 606, y + 74)
  editor.select(promptId, generateId, editId)
}

function createAiCard(
  editor: Editor,
  input: {
    detail: string
    id: string
    subtitle: string
    title: string
    tone: AiCardTone
    x: number
    y: number
  }
) {
  const id = input.id
    ? createShapeId(`${input.id}-${Date.now()}-${Math.round(Math.random() * 1000)}`)
    : createShapeId()
  editor.createShape<AiCardShape>({
    id,
    type: 'ai_card',
    x: input.x,
    y: input.y,
    props: {
      detail: input.detail,
      h: 156,
      subtitle: input.subtitle,
      title: input.title,
      tone: input.tone,
      w: 270,
    },
  })
  return id
}

function createArrow(editor: Editor, x: number, y: number) {
  editor.createShape({
    id: createShapeId(),
    type: 'arrow',
    x,
    y,
    props: {
      end: { x: 70, y: 0 },
      start: { x: 0, y: 0 },
    },
  })
}
