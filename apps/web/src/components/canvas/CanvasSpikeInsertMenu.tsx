import { frameTool, noteTool, type ToolAction } from './canvasToolbarConfig'

type CanvasSpikeInsertMenuProps = {
  disabled: boolean
  onCreateAiCards: () => void
  onCreateAnalysisNode: () => void
  onCreateBoardKit: () => void
  onCreateImage: () => void
  onCreateImageGen4Node: () => void
  onCreateImageGenNode: () => void
  onCreateImageNode: () => void
  onCreateLinkCard: () => void
  onCreatePromptNode: () => void
  onCreateShapeSet: () => void
  onCreateStep15Graph: () => void
  onCreateStressNodes: () => void
  onDrawTool: (tool: ToolAction) => void
  onRunInsertAction: (action: () => void) => void
}

export function CanvasSpikeInsertMenu({
  disabled,
  onCreateAiCards,
  onCreateAnalysisNode,
  onCreateBoardKit,
  onCreateImage,
  onCreateImageGen4Node,
  onCreateImageGenNode,
  onCreateImageNode,
  onCreateLinkCard,
  onCreatePromptNode,
  onCreateShapeSet,
  onCreateStep15Graph,
  onCreateStressNodes,
  onDrawTool,
  onRunInsertAction,
}: CanvasSpikeInsertMenuProps) {
  const insertButtons = [
    { action: onCreatePromptNode, icon: '⌘', title: 'Prompt node' },
    { action: onCreateImageGenNode, icon: '✧', title: 'Image Gen node' },
    { action: onCreateImageGen4Node, icon: '✥', title: 'Image Gen 4 node' },
    { action: onCreateAnalysisNode, icon: '☌', title: 'Analysis node' },
    { action: onCreateImageNode, icon: '▧', title: 'Image node' },
    { action: onCreateImage, icon: '🖼', title: 'Image' },
    { action: onCreateLinkCard, icon: '🔗', title: 'Link card' },
    { action: onCreateAiCards, icon: '✦', title: 'AI cards' },
    { action: onCreateStep15Graph, icon: '⚙', title: 'S1.5 node graph' },
    { action: onCreateStressNodes, icon: '▦', title: '60 node stress test' },
    { action: onCreateShapeSet, icon: '⋯', title: 'Sample shapes' },
    { action: onCreateBoardKit, icon: '☰', title: 'Board kit' },
  ]

  return (
    <div className="canvas-spike-toolbar__popover canvas-spike-toolbar__popover--wide" role="menu">
      {insertButtons.slice(0, 5).map((button) => (
        <InsertButton disabled={disabled} key={button.title} onClick={() => onRunInsertAction(button.action)} {...button} />
      ))}
      <InsertButton disabled={disabled} icon="▤" onClick={() => onDrawTool(noteTool)} title="Sticky note" />
      <InsertButton disabled={disabled} icon="▣" onClick={() => onDrawTool(frameTool)} title="Frame" />
      {insertButtons.slice(5).map((button) => (
        <InsertButton disabled={disabled} key={button.title} onClick={() => onRunInsertAction(button.action)} {...button} />
      ))}
    </div>
  )
}

function InsertButton({
  disabled,
  icon,
  onClick,
  title,
}: {
  disabled: boolean
  icon: string
  onClick: () => void
  title: string
}) {
  return (
    <button aria-label={title} data-tooltip={title} disabled={disabled} onClick={onClick} type="button">
      <span aria-hidden>{icon}</span>
    </button>
  )
}
