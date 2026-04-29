'use client'

import {
  BaseBoxShapeUtil,
  HTMLContainer,
  Rectangle2d,
  T,
  resizeBox,
  type Geometry2d,
  type RecordProps,
  type TLResizeInfo,
} from 'tldraw'
import type { JsonObject, NodeRuntimeSummary } from '@/types/nodeRuntime'
import type { NodeCardShape } from '@/types/nodeCardShape'
import { NodeCardContent } from './NodeCardContent'

declare module '@tldraw/tlschema' {
  interface TLGlobalShapePropsMap {
    node_card: NodeCardShape['props']
  }
}

export class NodeCardShapeUtil extends BaseBoxShapeUtil<NodeCardShape> {
  static override type = 'node_card' as const

  static override props: RecordProps<NodeCardShape> = {
    data: T.jsonValue,
    h: T.number,
    nodeId: T.string,
    nodeType: T.literalEnum('prompt', 'image_gen', 'image_gen_4', 'analysis', 'image'),
    runtimeSummary: T.jsonValue,
    version: T.number,
    w: T.number,
  }

  override canBind() {
    return true
  }

  override getDefaultProps(): NodeCardShape['props'] {
    return {
      data: { prompt: 'A clean product poster for a ceramic coffee cup.' },
      h: 188,
      nodeId: 'prompt-default',
      nodeType: 'prompt',
      runtimeSummary: { costHint: null, error: null, lastRunId: null, resultAssetIds: [], status: 'idle' },
      version: 1,
      w: 300,
    }
  }

  override getGeometry(shape: NodeCardShape): Geometry2d {
    return new Rectangle2d({
      height: shape.props.h,
      isFilled: true,
      width: shape.props.w,
    })
  }

  override onResize(shape: NodeCardShape, info: TLResizeInfo<NodeCardShape>) {
    return resizeBox(shape, info)
  }

  override component(shape: NodeCardShape) {
    const updateData = (data: JsonObject) => {
      this.editor.updateShape<NodeCardShape>({
        id: shape.id,
        props: { data },
        type: 'node_card',
      })
    }

    const runMock = () => {
      const runId = `run_mock_${Date.now()}`
      const resultCount = shape.props.nodeType === 'image_gen_4' ? 4 : shape.props.nodeType === 'image_gen' ? 1 : 0
      const runningSummary: NodeRuntimeSummary = {
        costHint: 'Mock run · no credits charged',
        error: null,
        lastRunId: runId,
        resultAssetIds: [],
        status: 'running',
      }
      this.editor.updateShape<NodeCardShape>({
        id: shape.id,
        props: { runtimeSummary: runningSummary },
        type: 'node_card',
      })

      window.setTimeout(() => {
        const latest = this.editor.getShape<NodeCardShape>(shape.id)
        if (!latest) return
        this.editor.updateShape<NodeCardShape>({
          id: shape.id,
          props: {
            runtimeSummary: {
              costHint: shape.props.nodeType === 'analysis' ? 'Mock analysis · text output only' : 'Mock run · asset ids only',
              error: null,
              lastRunId: runId,
              resultAssetIds: Array.from({ length: resultCount }, (_, index) => `asset_mock_${index + 1}`),
              status: 'succeeded',
            },
          },
          type: 'node_card',
        })
      }, 450)
    }

    const getEditorPagePoint = (localX: number, localY: number) => {
      const transform = this.editor.getShapePageTransform(shape.id)
      if (!transform) return null
      return transform.applyToPoint({ x: localX, y: localY })
    }

    return (
      <HTMLContainer className="node-card-shape">
        <NodeCardContent getEditorPagePoint={getEditorPagePoint} onDataChange={updateData} onRunMock={runMock} shape={shape} />
      </HTMLContainer>
    )
  }

  override indicator(shape: NodeCardShape) {
    return <rect width={shape.props.w} height={shape.props.h} rx={16} ry={16} />
  }
}
