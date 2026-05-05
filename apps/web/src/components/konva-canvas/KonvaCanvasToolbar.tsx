import { useState } from 'react'
import { CanvasLineIcon } from '@/components/canvas/CanvasLineIcon'
import type { KonvaCanvasTool } from './konvaCanvasTypes'
import type { NodeType } from '@/types/nodeRuntime'
import { KonvaNodeCreateMenu } from './KonvaNodeCreateMenu'
import { konvaToolGroups, konvaToolLabels, konvaToolShortcuts } from './konvaCanvasTypes'

type KonvaCanvasToolbarProps = {
  activeTool: KonvaCanvasTool
  isSettingsOpen?: boolean
  onCreateNode: (type: NodeType) => void
  onToolChange: (tool: KonvaCanvasTool) => void
  onAddStressStrokes: () => void
  onClear: () => void
  onOpenSettings: () => void
}

export function KonvaCanvasToolbar({
  activeTool,
  isSettingsOpen = false,
  onCreateNode,
  onAddStressStrokes,
  onClear,
  onOpenSettings,
  onToolChange,
}: KonvaCanvasToolbarProps) {
  const [nodeMenuOpen, setNodeMenuOpen] = useState(false)
  const createNode = (type: NodeType) => {
    onCreateNode(type)
    setNodeMenuOpen(false)
  }

  return (
    <div className="konva-canvas-toolbar" aria-label="Konva canvas tools">
      {konvaToolGroups.map((group) => (
        <div className="konva-canvas-toolbar__group" key={group.label} aria-label={group.label}>
          {group.tools.map((tool) => (
            <button
              aria-label={konvaToolLabels[tool]}
              className="konva-canvas-tool"
              data-active={activeTool === tool}
              data-tooltip={getToolTooltip(tool)}
              key={tool}
              onClick={() => onToolChange(tool)}
              type="button"
            >
              <ToolGlyph tool={tool} />
            </button>
          ))}
        </div>
      ))}
      <div className="konva-canvas-toolbar__group konva-canvas-toolbar__node-group" aria-label="Create nodes">
        <button
          aria-label="Create node"
          className="konva-canvas-tool"
          data-active={nodeMenuOpen}
          data-tooltip="Node"
          onClick={() => setNodeMenuOpen((open) => !open)}
          type="button"
        >
          <ToolGlyph tool="node" />
        </button>
        {nodeMenuOpen ? <KonvaNodeCreateMenu onCreateNode={createNode} variant="toolbar" /> : null}
      </div>
      <div className="konva-canvas-toolbar__group">
        <button
          aria-label="Canvas settings"
          className="konva-canvas-tool"
          data-active={isSettingsOpen}
          data-tooltip="Canvas settings"
          onClick={onOpenSettings}
          type="button"
        >
          <CanvasLineIcon name="settings" />
        </button>
        <button className="konva-canvas-action" onClick={onAddStressStrokes} type="button">
          1k strokes
        </button>
        <button className="konva-canvas-action" onClick={onClear} type="button">
          Clear
        </button>
      </div>
    </div>
  )
}

function getToolTooltip(tool: KonvaCanvasTool) {
  const shortcut = konvaToolShortcuts[tool]
  return shortcut ? `${konvaToolLabels[tool]}: ${shortcut}` : konvaToolLabels[tool]
}

function ToolGlyph({ tool }: { tool: KonvaCanvasTool | 'node' }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24">
      {tool === 'node' ? <path d="M6 7.5h5v4H6zM13 12.5h5v4h-5zM11 9.5h2.2c1.2 0 1.8.6 1.8 1.8v1.2" /> : null}
      {tool === 'hand' ? <path d="M8 12V6.5a1.5 1.5 0 0 1 3 0V11M11 11V5.5a1.5 1.5 0 0 1 3 0V11M14 11V7a1.5 1.5 0 0 1 3 0v8.2c0 3-2 5.3-5.2 5.3H10c-2.2 0-3.8-1-5-3l-1.2-2.1a1.5 1.5 0 0 1 2.5-1.6L8 16" /> : null}
      {tool === 'select' ? <path d="M6 4l10 8-5 1.2 3 5.4-2.2 1.2-3-5.5L5 18z" /> : null}
      {tool === 'rect' ? <rect height="13" rx="2" width="15" x="4.5" y="5.5" /> : null}
      {tool === 'diamond' ? <path d="M12 4l8 8-8 8-8-8z" /> : null}
      {tool === 'ellipse' ? <ellipse cx="12" cy="12" rx="7.5" ry="5.5" /> : null}
      {tool === 'triangle' ? <path d="M12 4.5l8 15H4z" /> : null}
      {tool === 'cloud' ? <path d="M7.2 17.5h9.3a4 4 0 0 0 .5-8 5.2 5.2 0 0 0-9.8-1.8A4.9 4.9 0 0 0 7.2 17.5z" /> : null}
      {tool === 'frame' ? <path d="M5 6.5h14v12H5zM8 4.5h8" /> : null}
      {tool === 'arrow' ? <path d="M5 19L18 6M11 5h8v8" /> : null}
      {tool === 'line' ? <path d="M5 19L19 5" /> : null}
      {tool === 'draw' ? <path d="M4 16c3-7 6 3 9-4 1.5-3.5 4-3 7-1" /> : null}
      {tool === 'sticky' ? <path d="M6 5h12v10.5L14.5 19H6zM14.5 19v-3.5H18M9 9h6M9 12h4" /> : null}
      {tool === 'text' ? <path d="M6 6h12M12 6v12M9 18h6" /> : null}
      {tool === 'eraser' ? <path d="M5 15l8-8a2 2 0 0 1 2.8 0l3.2 3.2a2 2 0 0 1 0 2.8l-5 5H8zM3 21h18" /> : null}
    </svg>
  )
}
