'use client'

import { useState, type CSSProperties, type ReactNode, type SyntheticEvent } from 'react'
import type { Editor } from 'tldraw'
import {
  arrowheadEndStyles,
  arrowheadStartStyles,
  arrowKindStyles,
  dashStyles,
  fillStyles,
  fontStyles,
  getPanelStyleValue,
  setPanelStyle,
  sizeStyles,
  splineStyles,
  strokeColors,
  styleProps,
} from './canvasStyleControls'
import { useEditorRevision } from './useEditorRevision'
import { CanvasStylePanelSelectionActions } from './CanvasStylePanelSelectionActions'
import { ActionButtonGroup, StyleButton, StyleButtonGroup, type SelectionAction } from './CanvasStylePanelGroups'

type CanvasSpikeStylePanelProps = {
  editor: Editor | null
}

const layerActions: SelectionAction[] = [
  { icon: 'layer-back', label: 'Send to back', run: (editor, ids) => editor.sendToBack(ids) },
  { icon: 'layer-down', label: 'Send backward', run: (editor, ids) => editor.sendBackward(ids) },
  { icon: 'layer-up', label: 'Bring forward', run: (editor, ids) => editor.bringForward(ids) },
  { icon: 'layer-front', label: 'Bring to front', run: (editor, ids) => editor.bringToFront(ids) },
]

const alignActions: SelectionAction[] = [
  { icon: 'align-left', label: 'Align left', minSelected: 2, run: (editor, ids) => editor.alignShapes(ids, 'left') },
  { icon: 'align-center-x', label: 'Align center', minSelected: 2, run: (editor, ids) => editor.alignShapes(ids, 'center-horizontal') },
  { icon: 'align-right', label: 'Align right', minSelected: 2, run: (editor, ids) => editor.alignShapes(ids, 'right') },
  { icon: 'align-top', label: 'Align top', minSelected: 2, run: (editor, ids) => editor.alignShapes(ids, 'top') },
  { icon: 'align-center-y', label: 'Align middle', minSelected: 2, run: (editor, ids) => editor.alignShapes(ids, 'center-vertical') },
  { icon: 'align-bottom', label: 'Align bottom', minSelected: 2, run: (editor, ids) => editor.alignShapes(ids, 'bottom') },
]

const operationActions: SelectionAction[] = [
  { icon: 'duplicate', label: 'Duplicate', run: (editor, ids) => editor.duplicateShapes(ids, { x: 24, y: 24 }) },
  { icon: 'delete', label: 'Delete', run: (editor, ids) => editor.deleteShapes(ids) },
  { icon: 'stretch-x', label: 'Stretch horizontal', run: (editor, ids) => editor.stretchShapes(ids, 'horizontal') },
  { icon: 'stretch-y', label: 'Stretch vertical', run: (editor, ids) => editor.stretchShapes(ids, 'vertical') },
]

function stopCanvasEvent(event: SyntheticEvent) {
  event.stopPropagation()
}

export function CanvasSpikeStylePanel({ editor }: CanvasSpikeStylePanelProps) {
  const [isOpen, setIsOpen] = useState(true)
  useEditorRevision(editor, 'style-panel')
  const selectedIds = editor?.getSelectedShapeIds() ?? []
  const selectedShapes = editor?.getSelectedShapes() ?? []
  const selectedCount = selectedIds.length
  const hasSelection = selectedCount > 0
  const hasNodeCardSelection = selectedShapes.some((shape) => shape.type === 'node_card')
  const hasEditableStyleSelection = hasSelection && !hasNodeCardSelection
  if (!editor) return null

  const drawerShell = (children: ReactNode) => (
    <aside
      className="canvas-style-drawer"
      aria-label="Canvas side properties"
      data-open={isOpen ? 'true' : 'false'}
      onDoubleClick={stopCanvasEvent}
      onPointerDown={stopCanvasEvent}
      onWheel={stopCanvasEvent}
    >
      <button
        aria-label={isOpen ? 'Collapse side properties' : 'Expand side properties'}
        className="canvas-style-drawer__handle"
        onClick={() => setIsOpen((open) => !open)}
        title={isOpen ? 'Collapse properties' : 'Expand properties'}
        type="button"
      >
        <span aria-hidden>{isOpen ? '‹' : '›'}</span>
      </button>
      {isOpen ? children : null}
    </aside>
  )

  if (!hasEditableStyleSelection) {
    return drawerShell(
      <div className="canvas-style-panel canvas-style-panel--empty">
        <div className="canvas-style-panel__header">
          <span>Properties</span>
          <small>Drawing styles</small>
        </div>
        <p>Select a shape, arrow, text, image or markup to edit drawing styles.</p>
      </div>
    )
  }

  const color = getPanelStyleValue(editor, styleProps.color)
  const fill = getPanelStyleValue(editor, styleProps.fill)
  const size = getPanelStyleValue(editor, styleProps.size)
  const dash = getPanelStyleValue(editor, styleProps.dash)
  const font = getPanelStyleValue(editor, styleProps.font)
  const spline = getPanelStyleValue(editor, styleProps.spline)
  const arrowKind = getPanelStyleValue(editor, styleProps.arrowKind)
  const arrowheadEnd = getPanelStyleValue(editor, styleProps.arrowheadEnd)
  const arrowheadStart = getPanelStyleValue(editor, styleProps.arrowheadStart)
  const opacity = editor.getSharedOpacity()
  const opacityPercent = opacity?.type === 'shared' ? Math.round(opacity.value * 100) : 100

  return drawerShell(
    <div className="canvas-style-panel" aria-label="Canvas style panel">
      <div className="canvas-style-panel__header">
        <span>属性</span>
        <small>已选 · {selectedCount}</small>
      </div>

      <CanvasStylePanelSelectionActions editor={editor} selectedIds={selectedIds} />

      <section className="canvas-style-panel__block">
        <p>描边</p>
        <div className="canvas-style-panel__swatches">
          {strokeColors.map((item) => (
            <button
              aria-label={item.label}
              className={color === item.value ? 'is-active' : undefined}
              key={item.value}
              onClick={() => setPanelStyle(editor, styleProps.color, item.value)}
              style={{ '--swatch': item.swatch } as CSSProperties}
              title={item.label}
              type="button"
            />
          ))}
        </div>
      </section>

      <StyleButtonGroup label="填充">
        {fillStyles.map((item) => (
          <StyleButton
            active={fill === item.value}
            icon={`fill-${item.value}`}
            key={item.value}
            label={item.label}
            onClick={() => setPanelStyle(editor, styleProps.fill, item.value)}
          />
        ))}
      </StyleButtonGroup>

      <StyleButtonGroup label="描边宽度">
        {sizeStyles.map((item) => (
          <StyleButton
            active={size === item.value}
            icon={`size-${item.value}`}
            key={item.value}
            label={item.label}
            onClick={() => setPanelStyle(editor, styleProps.size, item.value)}
          />
        ))}
      </StyleButtonGroup>

      <StyleButtonGroup label="边框样式">
        {dashStyles.map((item) => (
          <StyleButton
            active={dash === item.value}
            icon={`dash-${item.value}`}
            key={item.value}
            label={item.label}
            onClick={() => setPanelStyle(editor, styleProps.dash, item.value)}
          />
        ))}
      </StyleButtonGroup>

      <StyleButtonGroup label="线条风格">
        {splineStyles.map((item) => (
          <StyleButton
            active={spline === item.value}
            icon={`spline-${item.value}`}
            key={item.value}
            label={item.label}
            onClick={() => setPanelStyle(editor, styleProps.spline, item.value)}
          />
        ))}
      </StyleButtonGroup>

      <StyleButtonGroup label="箭头类型">
        {arrowKindStyles.map((item) => (
          <StyleButton
            active={arrowKind === item.value}
            icon={`arrow-kind-${item.value}`}
            key={item.value}
            label={item.label}
            onClick={() => setPanelStyle(editor, styleProps.arrowKind, item.value)}
          />
        ))}
      </StyleButtonGroup>

      <StyleButtonGroup label="端点">
        {arrowheadStartStyles.map((item) => (
          <StyleButton
            active={arrowheadStart === item.value}
            icon={`arrow-start-${item.value}`}
            key={`start-${item.value}`}
            label={`Start ${item.label}`}
            onClick={() => setPanelStyle(editor, styleProps.arrowheadStart, item.value)}
          />
        ))}
        {arrowheadEndStyles.map((item) => (
          <StyleButton
            active={arrowheadEnd === item.value}
            icon={`arrow-end-${item.value}`}
            key={`end-${item.value}`}
            label={`End ${item.label}`}
            onClick={() => setPanelStyle(editor, styleProps.arrowheadEnd, item.value)}
          />
        ))}
      </StyleButtonGroup>

      <StyleButtonGroup label="字体">
        {fontStyles.map((item) => (
          <StyleButton
            active={font === item.value}
            icon={`font-${item.value}`}
            key={item.value}
            label={item.label}
            onClick={() => setPanelStyle(editor, styleProps.font, item.value)}
          />
        ))}
      </StyleButtonGroup>

      <section className="canvas-style-panel__block">
        <p>透明度</p>
        <div className="canvas-style-panel__range-row">
          <input
            max={100}
            min={10}
            onChange={(event) => {
              const nextOpacity = Number(event.currentTarget.value) / 100
              editor.run(() => {
                editor.setOpacityForSelectedShapes(nextOpacity)
                editor.setOpacityForNextShapes(nextOpacity)
                editor.updateInstanceState({ isChangingStyle: true })
              })
            }}
            type="range"
            value={opacityPercent}
          />
          <span>{opacity?.type === 'mixed' ? '混合' : opacityPercent}</span>
        </div>
      </section>

      <ActionButtonGroup actions={layerActions} editor={editor} label="图层" selectedCount={selectedCount} selectedIds={selectedIds} />
      <ActionButtonGroup actions={alignActions} editor={editor} label="对齐" selectedCount={selectedCount} selectedIds={selectedIds} />
      <ActionButtonGroup actions={operationActions} editor={editor} label="操作" selectedCount={selectedCount} selectedIds={selectedIds} />
    </div>
  )
}
