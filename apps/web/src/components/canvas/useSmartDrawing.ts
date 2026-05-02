'use client'

import { useEffect, useRef } from 'react'
import {
  createShapeId,
  getIndices,
  toRichText,
  type Editor,
  type TLShapeId,
} from 'tldraw'
import { useCanvasSettingsStore } from '@/features/canvas-settings/canvasSettingsStore'
import {
  recognizeSmartDrawing,
  type SmartDrawingInput,
  type SmartDrawingResult,
} from '@/features/smart-drawing/smartDrawingRecognizer'

type DrawShapeRecord = SmartDrawingInput & {
  id: TLShapeId
  index?: string
  isLocked?: boolean
  opacity?: number
  parentId?: string
  props: SmartDrawingInput['props'] & { isComplete?: boolean }
  rotation?: number
  type: string
  typeName: string
}

type UpdatedRecordPair = [unknown, unknown]

export function useSmartDrawing(editor: Editor | null) {
  const enabled = useCanvasSettingsStore((state) => state.settings.smartDrawing)
  const enabledRef = useRef(enabled)
  const processedShapeIds = useRef(new Set<string>())

  useEffect(() => {
    enabledRef.current = enabled
  }, [enabled])

  useEffect(() => {
    if (!editor) return
    return editor.store.listen(({ changes }) => {
      if (!enabledRef.current) return
      const completedDrawIds = Object.values(changes.updated ?? {})
        .map((entry) => getCompletedDrawId(entry as UpdatedRecordPair))
        .filter(Boolean) as TLShapeId[]

      completedDrawIds.forEach((shapeId) => {
        if (processedShapeIds.current.has(shapeId)) return
        processedShapeIds.current.add(shapeId)
        requestAnimationFrame(() => convertDrawShape(editor, shapeId))
      })
    }, { scope: 'document', source: 'user' })
  }, [editor])
}

function getCompletedDrawId(entry: UpdatedRecordPair) {
  const [before, after] = entry
  if (!isDrawShape(before) || !isDrawShape(after)) return null
  if (before.props.isComplete || !after.props.isComplete) return null
  return after.id
}

function convertDrawShape(editor: Editor, shapeId: TLShapeId) {
  const shape = editor.getShape(shapeId)
  if (!isDrawShape(shape) || !shape.props.isComplete) return

  const result = recognizeSmartDrawing(shape)
  if (!result) return

  const nextShapeId = createShapeId()
  editor.run(() => {
    if (!editor.getShape(shapeId)) return
    editor.deleteShapes([shapeId])
    editor.createShape({
      ...getSharedShapeFields(shape),
      ...toTldrawShape(nextShapeId, result),
    } as Parameters<Editor['createShape']>[0])
    editor.select(nextShapeId)
  })
}

function toTldrawShape(id: TLShapeId, result: SmartDrawingResult) {
  if (result.kind === 'geo') {
    return {
      id,
      props: {
        geo: result.geo,
        h: result.h,
        richText: toRichText(''),
        ...getStyleProps(result.style),
        w: result.w,
      },
      type: 'geo',
      x: result.x,
      y: result.y,
    }
  }

  const indices = getIndices(Math.max(1, result.points.length - 1))
  return {
    id,
    props: {
      ...getLineStyleProps(result.style),
      points: Object.fromEntries(result.points.map((point, index) => [
        `p${index}`,
        {
          id: `p${index}`,
          index: indices[index],
          x: point.x,
          y: point.y,
        },
      ])),
      spline: result.spline,
    },
    type: 'line',
    x: result.x,
    y: result.y,
  }
}

function getStyleProps(style: SmartDrawingResult['style']) {
  return {
    ...(style.color ? { color: style.color } : {}),
    ...(style.dash ? { dash: style.dash } : {}),
    ...(style.fill ? { fill: style.fill } : {}),
    ...(style.size ? { size: style.size } : {}),
  }
}

function getLineStyleProps(style: SmartDrawingResult['style']) {
  return {
    ...(style.color ? { color: style.color } : {}),
    ...(style.dash ? { dash: style.dash } : {}),
    ...(style.size ? { size: style.size } : {}),
  }
}

function getSharedShapeFields(shape: DrawShapeRecord) {
  return {
    ...(shape.index ? { index: shape.index } : {}),
    ...(typeof shape.isLocked === 'boolean' ? { isLocked: shape.isLocked } : {}),
    ...(shape.parentId ? { parentId: shape.parentId } : {}),
    ...(typeof shape.opacity === 'number' ? { opacity: shape.opacity } : {}),
    ...(typeof shape.rotation === 'number' ? { rotation: shape.rotation } : {}),
  }
}

function isDrawShape(value: unknown): value is DrawShapeRecord {
  return Boolean(
    value &&
    typeof value === 'object' &&
    (value as DrawShapeRecord).typeName === 'shape' &&
    (value as DrawShapeRecord).type === 'draw'
  )
}
