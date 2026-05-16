'use client'

import type { ComponentProps, ReactNode } from 'react'
import { CanvasSettingsPanel } from '@/components/canvas/CanvasSettingsPanel'
import { KonvaBoardSaveAudit } from './KonvaBoardSaveAudit'
import { KonvaCanvasDiagnostics } from './KonvaCanvasDiagnostics'
import { KonvaCanvasNavigator } from './KonvaCanvasNavigator'
import { KonvaCanvasProperties } from './KonvaCanvasProperties'
import { KonvaContextMenuHost } from './KonvaContextMenuHost'
import { KonvaNodeCreateMenu } from './KonvaNodeCreateMenu'
import { KonvaNodeImageLightbox } from './KonvaNodeImageLightbox'
import { KonvaNodeTextEditor } from './KonvaNodeTextEditor'
import { KonvaSelectionToolbar } from './KonvaSelectionToolbar'
import { KonvaTextEditor } from './KonvaTextEditor'

type KonvaCanvasTransientUiProps = {
  contextMenuHostProps?: ComponentProps<typeof KonvaContextMenuHost>
  diagnosticsProps: ComponentProps<typeof KonvaCanvasDiagnostics>
  fileInput?: ReactNode
  focusedEditNotice?: string | null
  lightboxKey?: string
  lightboxProps?: ComponentProps<typeof KonvaNodeImageLightbox>
  navigatorProps: ComponentProps<typeof KonvaCanvasNavigator>
  nodeCreateMenuProps?: ComponentProps<typeof KonvaNodeCreateMenu>
  nodeTextEditorProps?: ComponentProps<typeof KonvaNodeTextEditor>
  propertiesProps?: ComponentProps<typeof KonvaCanvasProperties>
  saveAuditProps?: ComponentProps<typeof KonvaBoardSaveAudit>
  selectionToolbarProps?: ComponentProps<typeof KonvaSelectionToolbar>
  settingsPanelProps?: ComponentProps<typeof CanvasSettingsPanel>
  textEditorProps?: ComponentProps<typeof KonvaTextEditor>
}

export function KonvaCanvasTransientUi({
  contextMenuHostProps,
  diagnosticsProps,
  fileInput,
  focusedEditNotice,
  lightboxKey,
  lightboxProps,
  navigatorProps,
  nodeCreateMenuProps,
  nodeTextEditorProps,
  propertiesProps,
  saveAuditProps,
  selectionToolbarProps,
  settingsPanelProps,
  textEditorProps,
}: KonvaCanvasTransientUiProps) {
  return (
    <>
      {focusedEditNotice ? (
        <div aria-live="polite" className="konva-canvas-occupancy-toast" role="status">
          {focusedEditNotice}
        </div>
      ) : null}
      {lightboxProps ? <KonvaNodeImageLightbox key={lightboxKey} {...lightboxProps} /> : null}
      {nodeCreateMenuProps ? <KonvaNodeCreateMenu {...nodeCreateMenuProps} /> : null}
      {textEditorProps ? (
        <>
          <button
            aria-label="Finish text editing"
            className="konva-canvas-text-editor-backdrop"
            onClick={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
            type="button"
          />
          <KonvaTextEditor {...textEditorProps} />
        </>
      ) : null}
      {nodeTextEditorProps ? (
        <>
          <button
            aria-label="Finish node text editing"
            className="konva-canvas-text-editor-backdrop"
            onClick={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
            type="button"
          />
          <KonvaNodeTextEditor {...nodeTextEditorProps} />
        </>
      ) : null}
      {propertiesProps ? <KonvaCanvasProperties {...propertiesProps} /> : null}
      {selectionToolbarProps ? <KonvaSelectionToolbar {...selectionToolbarProps} /> : null}
      <KonvaCanvasNavigator {...navigatorProps} />
      {saveAuditProps ? <KonvaBoardSaveAudit {...saveAuditProps} /> : null}
      {settingsPanelProps ? <CanvasSettingsPanel {...settingsPanelProps} /> : null}
      <KonvaCanvasDiagnostics {...diagnosticsProps} />
      {contextMenuHostProps ? <KonvaContextMenuHost {...contextMenuHostProps} /> : null}
      {fileInput}
    </>
  )
}
