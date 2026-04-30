import { type Editor, type TLShapeId } from 'tldraw'
import type { NodePortDataType } from '@/types/nodeRuntime'
import { createNodeCard } from './createNodeCard'
import { syncNodeEdgeInputCounts, useNodeEdgeStore } from './nodeEdges'

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

  createRuntimeEdge(promptId, 'text_out', multiGenId, 'text_in', 'text')
  createRuntimeEdge(multiGenId, 'image_out', imageId, 'image_in', 'image')
  createRuntimeEdge(imageId, 'image_out', analysisId, 'image_in', 'image')
  createRuntimeEdge(imageId, 'image_out', singleGenId, 'image_in_1', 'image')
  createRuntimeEdge(editPromptId, 'text_out', singleGenId, 'text_in', 'text')
  syncNodeEdgeInputCounts(editor)
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

function createRuntimeEdge(
  sourceId: TLShapeId,
  sourcePortId: string,
  targetId: TLShapeId,
  targetPortId: string,
  dataType: NodePortDataType
) {
  useNodeEdgeStore.getState().addEdge({
    dataType,
    sourcePortId,
    sourceShapeId: sourceId,
    targetPortId,
    targetShapeId: targetId,
  })
}
