'use client'

import type { ComponentProps, ReactNode, RefObject } from 'react'
import { CanvasTooltipLayer } from '@/components/canvas/CanvasTooltipLayer'
import { KonvaCanvasHeader } from './KonvaCanvasHeader'
import { KonvaCanvasPagesPanel } from './KonvaCanvasPagesPanel'
import { KonvaCanvasStage } from './KonvaCanvasStage'
import { KonvaCanvasToolbar } from './KonvaCanvasToolbar'
import { KonvaCanvasViewerStage } from './KonvaCanvasViewerStage'
import { KonvaCollaborationOverlay } from './KonvaCollaborationOverlay'
import { KonvaLocalSyncBanner } from './KonvaLocalSyncBanner'

type KonvaCanvasShellProps = {
  children?: ReactNode
  collaborationEnabled: boolean
  dropHintKind: 'image' | 'pdf' | null
  effectiveReadOnly: boolean
  headerProps: ComponentProps<typeof KonvaCanvasHeader>
  localSyncBannerProps?: ComponentProps<typeof KonvaLocalSyncBanner>
  overlayProps: ComponentProps<typeof KonvaCollaborationOverlay>
  pagesPanelProps: ComponentProps<typeof KonvaCanvasPagesPanel>
  sectionHandlers: {
    onContextMenu?: React.HTMLAttributes<HTMLElement>['onContextMenu']
    onDoubleClick?: React.HTMLAttributes<HTMLElement>['onDoubleClick']
    onDragEnter?: React.HTMLAttributes<HTMLElement>['onDragEnter']
    onDragLeave?: React.HTMLAttributes<HTMLElement>['onDragLeave']
    onDragOver?: React.HTMLAttributes<HTMLElement>['onDragOver']
    onDrop?: React.HTMLAttributes<HTMLElement>['onDrop']
    onPointerDownCapture?: React.HTMLAttributes<HTMLElement>['onPointerDownCapture']
    onPointerLeave?: React.HTMLAttributes<HTMLElement>['onPointerLeave']
    onPointerMoveCapture?: React.HTMLAttributes<HTMLElement>['onPointerMoveCapture']
  }
  shellRef: RefObject<HTMLDivElement | null>
  stageToolMode: string
  themeMode: string
  toolbarProps?: ComponentProps<typeof KonvaCanvasToolbar>
  viewerStageProps: ComponentProps<typeof KonvaCanvasViewerStage>
  writableStageProps: ComponentProps<typeof KonvaCanvasStage>
}

export function KonvaCanvasShell({
  children,
  collaborationEnabled,
  dropHintKind,
  effectiveReadOnly,
  headerProps,
  localSyncBannerProps,
  overlayProps,
  pagesPanelProps,
  sectionHandlers,
  shellRef,
  stageToolMode,
  themeMode,
  toolbarProps,
  viewerStageProps,
  writableStageProps,
}: KonvaCanvasShellProps) {
  return (
    <main className="konva-canvas-shell" data-theme={themeMode}>
      <KonvaCanvasHeader {...headerProps} />
      {effectiveReadOnly || !toolbarProps ? null : (
        <KonvaCanvasToolbar {...toolbarProps} />
      )}
      <section
        className="konva-canvas-stage-wrap"
        data-drop-active={dropHintKind ? 'true' : 'false'}
        data-space-panning={effectiveReadOnly ? undefined : writableStageProps.isSpacePanning}
        data-tool-mode={stageToolMode}
        onContextMenu={sectionHandlers.onContextMenu}
        onDoubleClick={sectionHandlers.onDoubleClick}
        onDragEnter={sectionHandlers.onDragEnter}
        onDragLeave={sectionHandlers.onDragLeave}
        onDragOver={sectionHandlers.onDragOver}
        onDrop={sectionHandlers.onDrop}
        onPointerDownCapture={sectionHandlers.onPointerDownCapture}
        onPointerLeave={sectionHandlers.onPointerLeave}
        onPointerMoveCapture={sectionHandlers.onPointerMoveCapture}
        ref={shellRef}
      >
        {effectiveReadOnly || !dropHintKind ? null : (
          <div className="konva-canvas-drop-hint" aria-hidden="true" data-kind={dropHintKind}>
            <div className="konva-canvas-drop-hint__icon">
              <span />
            </div>
            <div className="konva-canvas-drop-hint__content">
              <strong>{dropHintKind === 'image' ? 'Drop image to upload' : 'Drop PDF on a chat node'}</strong>
              <small>{dropHintKind === 'image' ? 'Empty canvas lands at the current view center.' : 'PDF files attach to chat references rather than the blank canvas.'}</small>
            </div>
          </div>
        )}
        {effectiveReadOnly || !collaborationEnabled || !localSyncBannerProps ? null : (
          <KonvaLocalSyncBanner {...localSyncBannerProps} />
        )}
        <KonvaCanvasPagesPanel {...pagesPanelProps} />
        {effectiveReadOnly ? (
          <KonvaCanvasViewerStage {...viewerStageProps} />
        ) : (
          <KonvaCanvasStage {...writableStageProps} />
        )}
        <KonvaCollaborationOverlay {...overlayProps} />
        {children}
        <CanvasTooltipLayer />
      </section>
    </main>
  )
}
