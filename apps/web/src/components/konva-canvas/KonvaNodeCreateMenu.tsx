import type { CSSProperties } from 'react'
import { getNodeCreateOptions } from '@/features/node-runtime/registry'
import type { NodeType } from '@/types/nodeRuntime'

type KonvaNodeCreateMenuProps = {
  onCreateNode: (type: NodeType) => void
  style?: CSSProperties
  variant?: 'canvas' | 'toolbar'
}

const nodeCreateOptions = getNodeCreateOptions()

export function KonvaNodeCreateMenu({ onCreateNode, style, variant = 'canvas' }: KonvaNodeCreateMenuProps) {
  return (
    <div className="konva-node-create-menu" data-variant={variant} onPointerDown={(event) => event.stopPropagation()} style={style}>
      {getNodeMenuSections().map((section) => (
        <NodeMenuSection key={section.label} label={section.label} nodes={section.nodes} onCreateNode={onCreateNode} />
      ))}
    </div>
  )
}

type NodeOption = ReturnType<typeof getNodeCreateOptions>[number]

function getNodeMenuSections() {
  const sections = new Map<string, { label: string; nodes: NodeOption[]; order: number }>()
  for (const option of nodeCreateOptions) {
    const section = sections.get(option.category) ?? {
      label: option.categoryLabel,
      nodes: [],
      order: option.categoryOrder,
    }
    section.nodes.push(option)
    sections.set(option.category, section)
  }
  return [...sections.values()].sort((a, b) => a.order - b.order)
}

function NodeMenuSection({
  label,
  nodes,
  onCreateNode,
}: {
  label: string
  nodes: NodeOption[]
  onCreateNode: (type: NodeType) => void
}) {
  if (nodes.length === 0) return null
  return (
    <div className="konva-node-create-menu__section">
      <div className="konva-node-create-menu__label">{label}</div>
      <div className="konva-node-create-menu__row">
        {nodes.map((option) => (
          <button
            className="konva-node-create-menu__item"
            key={option.type}
            onClick={() => onCreateNode(option.type)}
            style={{ '--node-accent': option.accentColor } as CSSProperties}
            type="button"
          >
            <span className="konva-node-create-menu__badge">{option.shortLabel}</span>
            <span>{option.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
