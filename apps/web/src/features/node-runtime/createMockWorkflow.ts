import { createShapeId, type Editor, type TLShapeId } from 'tldraw'
import type { NodeCardShape } from '@/types/nodeCardShape'
import { createNodeCard } from './createNodeCard'

const graphGap = 120

export function createStep15MockGraph(editor: Editor) {
  const viewport = editor.getViewportPageBounds()
  const startX = viewport.midX - 720
  const startY = viewport.midY - 240

  const promptId = createNodeCard(editor, {
    idHint: 'planner-prompt',
    type: 'prompt',
    x: startX,
    y: startY + 80,
  })
  const multiGenId = createNodeCard(editor, {
    idHint: 'planner-image-gen-4',
    type: 'image_gen_4',
    x: startX + 340 + graphGap,
    y: startY,
  })
  const imageId = createNodeCard(editor, {
    data: { assetId: 'asset_mock_cat_001', title: 'Generated cat image' },
    idHint: 'planner-image',
    type: 'image',
    x: startX + 340 + graphGap + 360 + graphGap,
    y: startY + 34,
  })
  const analysisId = createNodeCard(editor, {
    idHint: 'planner-analysis',
    type: 'analysis',
    x: startX + 340 + graphGap + 360 + graphGap + 460 + graphGap,
    y: startY,
  })
  const editPromptId = createNodeCard(editor, {
    data: { prompt: '把猫改成狗' },
    idHint: 'planner-edit-prompt',
    type: 'prompt',
    x: startX + 340 + graphGap + 360 + graphGap + 460 + graphGap,
    y: startY + 350,
  })
  const singleGenId = createNodeCard(editor, {
    data: { imageInputCount: 2 },
    idHint: 'planner-image-gen',
    type: 'image_gen',
    x: startX + 340 + graphGap + 360 + graphGap + 460 + graphGap + 360 + graphGap,
    y: startY + 180,
  })

  createBoundArrow(editor, promptId, multiGenId, { x: 1, y: 0.5 }, { x: 0, y: 0.19 })
  createBoundArrow(editor, multiGenId, imageId, { x: 1, y: 0.5 }, { x: 0, y: 0.5 })
  createBoundArrow(editor, imageId, analysisId, { x: 1, y: 0.5 }, { x: 0, y: 0.19 })
  createBoundArrow(editor, imageId, singleGenId, { x: 1, y: 0.5 }, { x: 0, y: 0.5 })
  createBoundArrow(editor, editPromptId, singleGenId, { x: 1, y: 0.5 }, { x: 0, y: 0.19 })
  editor.select(promptId, multiGenId, imageId, analysisId, editPromptId, singleGenId)
  editor.zoomToSelection({ animation: { duration: 220 } })
}

export function createStep15StressNodes(editor: Editor) {
  const viewport = editor.getViewportPageBounds()
  const startX = viewport.minX + 120
  const startY = viewport.minY + 120
  const ids: TLShapeId[] = []

  for (let index = 0; index < 60; index += 1) {
    const column = index % 10
    const row = Math.floor(index / 10)
    const type = index % 5 === 0 ? 'image_gen_4' : index % 5 === 1 ? 'prompt' : index % 5 === 2 ? 'image' : index % 5 === 3 ? 'analysis' : 'image_gen'
    ids.push(
      createNodeCard(editor, {
        idHint: `stress-${index}`,
        type,
        x: startX + column * 340,
        y: startY + row * 250,
      })
    )
  }

  editor.select(...ids.slice(0, 10))
}

function createBoundArrow(
  editor: Editor,
  sourceId: TLShapeId,
  targetId: TLShapeId,
  sourceAnchor: { x: number; y: number },
  targetAnchor: { x: number; y: number }
) {
  const source = editor.getShape<NodeCardShape>(sourceId)
  const target = editor.getShape<NodeCardShape>(targetId)
  if (!source || !target) return

  const sourcePoint = { x: source.x + source.props.w * sourceAnchor.x, y: source.y + source.props.h * sourceAnchor.y }
  const targetPoint = { x: target.x + target.props.w * targetAnchor.x, y: target.y + target.props.h * targetAnchor.y }
  const arrowId = createShapeId()

  editor.createShape({
    id: arrowId,
    type: 'arrow',
    x: sourcePoint.x,
    y: sourcePoint.y,
    props: {
      end: { x: targetPoint.x - sourcePoint.x, y: targetPoint.y - sourcePoint.y },
      start: { x: 0, y: 0 },
    },
  })

  editor.createBinding({
    fromId: arrowId,
    props: {
      isExact: false,
      isPrecise: true,
      normalizedAnchor: sourceAnchor,
      snap: 'edge-point',
      terminal: 'start',
    },
    toId: sourceId,
    type: 'arrow',
  })
  editor.createBinding({
    fromId: arrowId,
    props: {
      isExact: false,
      isPrecise: true,
      normalizedAnchor: targetAnchor,
      snap: 'edge-point',
      terminal: 'end',
    },
    toId: targetId,
    type: 'arrow',
  })
}
