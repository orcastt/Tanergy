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
import { ActionButtonGroup, StyleButton, StyleButtonGroup } from './CanvasStylePanelGroups'
import {
  alignActions,
  getSelectionTool,
  getToolLabel,
  layerActions,
  operationActions,
  toolSupports,
  useLastStylePanelTool,
} from './canvasStylePanelModel'

type CanvasSpikeStylePanelProps = {
  editor: Editor | null
}

function stopCanvasEvent(event: SyntheticEvent) {
  event.stopPropagation()
}

export function CanvasSpikeStylePanel({ editor }: CanvasSpikeStylePanelProps) {
  const [isOpen, setIsOpen] = useState(true)
  const lastStyleTool = useLastStylePanelTool(editor)
  useEditorRevision(editor, 'style-panel')

  const selectedIds = editor?.getSelectedShapeIds() ?? []
  const selectedShapes = editor?.getSelectedShapes() ?? []
  const selectedCount = selectedIds.length
  const hasSelection = selectedCount > 0
  const hasNodeCardSelection = selectedShapes.some((shape) => shape.type === 'node_card')
  const hasEditableStyleSelection = hasSelection && !hasNodeCardSelection
  const activeTool = hasEditableStyleSelection
    ? getSelectionTool(selectedShapes) ?? lastStyleTool
    : lastStyleTool
  const applyToSelection = hasEditableStyleSelection
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
        data-tooltip={isOpen ? 'Collapse properties' : 'Expand properties'}
        type="button"
      >
        <span aria-hidden>{isOpen ? '‹' : '›'}</span>
      </button>
      {isOpen ? children : null}
    </aside>
  )

  const styleValueOptions = { useSelection: applyToSelection }
  const color = getPanelStyleValue(editor, styleProps.color, styleValueOptions)
  const fill = getPanelStyleValue(editor, styleProps.fill, styleValueOptions)
  const size = getPanelStyleValue(editor, styleProps.size, styleValueOptions)
  const dash = getPanelStyleValue(editor, styleProps.dash, styleValueOptions)
  const font = getPanelStyleValue(editor, styleProps.font, styleValueOptions)
  const spline = getPanelStyleValue(editor, styleProps.spline, styleValueOptions)
  const arrowKind = getPanelStyleValue(editor, styleProps.arrowKind, styleValueOptions)
  const arrowheadEnd = getPanelStyleValue(editor, styleProps.arrowheadEnd, styleValueOptions)
  const arrowheadStart = getPanelStyleValue(editor, styleProps.arrowheadStart, styleValueOptions)
  const opacity = applyToSelection ? editor.getSharedOpacity() : { type: 'shared' as const, value: editor.getInstanceState().opacityForNextShape }
  const opacityPercent = opacity.type === 'shared' ? Math.round(opacity.value * 100) : 100

  return drawerShell(
    <div className="canvas-style-panel" aria-label="Canvas style panel">
      <div className="canvas-style-panel__header">
        <span>Properties</span>
        <small>{hasEditableStyleSelection ? `Selected · ${selectedCount}` : `${getToolLabel(activeTool)} styles`}</small>
      </div>

      {hasEditableStyleSelection ? <CanvasStylePanelSelectionActions editor={editor} selectedIds={selectedIds} /> : null}

      <section className="canvas-style-panel__block">
        <p>Stroke</p>
        <div className="canvas-style-panel__swatches">
          {strokeColors.map((item) => (
            <button
              aria-label={item.label}
              className={color === item.value ? 'is-active' : undefined}
              data-tooltip={item.label}
              key={item.value}
              onClick={() => setPanelStyle(editor, styleProps.color, item.value, { applyToSelection })}
              style={{ '--swatch': item.swatch } as CSSProperties}
              type="button"
            />
          ))}
        </div>
      </section>

      {toolSupports(activeTool, 'fill') ? (
        <StyleButtonGroup label="Fill">
          {fillStyles.map((item) => (
            <StyleButton
              active={fill === item.value}
              icon={`fill-${item.value}`}
              key={item.value}
              label={item.label}
              onClick={() => setPanelStyle(editor, styleProps.fill, item.value, { applyToSelection })}
            />
          ))}
        </StyleButtonGroup>
      ) : null}

      <StyleButtonGroup label="Width">
        {sizeStyles.map((item) => (
          <StyleButton
            active={size === item.value}
            icon={`size-${item.value}`}
            key={item.value}
            label={item.label}
            onClick={() => setPanelStyle(editor, styleProps.size, item.value, { applyToSelection })}
          />
        ))}
      </StyleButtonGroup>

      {toolSupports(activeTool, 'dash') ? (
        <StyleButtonGroup label="Dash">
          {dashStyles.map((item) => (
            <StyleButton
              active={dash === item.value}
              icon={`dash-${item.value}`}
              key={item.value}
              label={item.label}
              onClick={() => setPanelStyle(editor, styleProps.dash, item.value, { applyToSelection })}
            />
          ))}
        </StyleButtonGroup>
      ) : null}

      {toolSupports(activeTool, 'spline') ? (
        <StyleButtonGroup label="Line">
          {splineStyles.map((item) => (
            <StyleButton
              active={spline === item.value}
              icon={`spline-${item.value}`}
              key={item.value}
              label={item.label}
              onClick={() => setPanelStyle(editor, styleProps.spline, item.value, { applyToSelection })}
            />
          ))}
        </StyleButtonGroup>
      ) : null}

      {toolSupports(activeTool, 'arrow') ? (
        <StyleButtonGroup label="Arrow">
          {arrowKindStyles.map((item) => (
            <StyleButton
              active={arrowKind === item.value}
              icon={`arrow-kind-${item.value}`}
              key={item.value}
              label={item.label}
              onClick={() => setPanelStyle(editor, styleProps.arrowKind, item.value, { applyToSelection })}
            />
          ))}
        </StyleButtonGroup>
      ) : null}

      {toolSupports(activeTool, 'arrow') ? (
        <StyleButtonGroup label="Heads">
          {arrowheadStartStyles.map((item) => (
            <StyleButton
              active={arrowheadStart === item.value}
              icon={`arrow-start-${item.value}`}
              key={`start-${item.value}`}
              label={`Start ${item.label}`}
              onClick={() => setPanelStyle(editor, styleProps.arrowheadStart, item.value, { applyToSelection })}
            />
          ))}
          {arrowheadEndStyles.map((item) => (
            <StyleButton
              active={arrowheadEnd === item.value}
              icon={`arrow-end-${item.value}`}
              key={`end-${item.value}`}
              label={`End ${item.label}`}
              onClick={() => setPanelStyle(editor, styleProps.arrowheadEnd, item.value, { applyToSelection })}
            />
          ))}
        </StyleButtonGroup>
      ) : null}

      {toolSupports(activeTool, 'font') ? (
        <StyleButtonGroup label="Font">
          {fontStyles.map((item) => (
            <StyleButton
              active={font === item.value}
              icon={`font-${item.value}`}
              key={item.value}
              label={item.label}
              onClick={() => setPanelStyle(editor, styleProps.font, item.value, { applyToSelection })}
            />
          ))}
        </StyleButtonGroup>
      ) : null}

      <section className="canvas-style-panel__block">
        <p>Opacity</p>
        <div className="canvas-style-panel__range-row">
          <input
            max={100}
            min={10}
            onChange={(event) => {
              const nextOpacity = Number(event.currentTarget.value) / 100
              editor.run(() => {
                if (applyToSelection) editor.setOpacityForSelectedShapes(nextOpacity)
                editor.setOpacityForNextShapes(nextOpacity)
                editor.updateInstanceState({ isChangingStyle: true })
              })
            }}
            type="range"
            value={opacityPercent}
          />
          <span>{opacity.type === 'mixed' ? 'Mixed' : opacityPercent}</span>
        </div>
      </section>

      {hasEditableStyleSelection ? (
        <>
          <ActionButtonGroup actions={layerActions} editor={editor} label="Layer" selectedCount={selectedCount} selectedIds={selectedIds} />
          <ActionButtonGroup actions={alignActions} editor={editor} label="Align" selectedCount={selectedCount} selectedIds={selectedIds} />
          <ActionButtonGroup actions={operationActions} editor={editor} label="Actions" selectedCount={selectedCount} selectedIds={selectedIds} />
        </>
      ) : null}
    </div>
  )
}
