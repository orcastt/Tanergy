'use client'

import type { WorkspaceBoardViewMode } from './WorkspaceBoardItem'

type NewBoardTileProps = {
  onCreate: () => void
  viewMode: WorkspaceBoardViewMode
}

export function NewBoardTile({ onCreate, viewMode }: NewBoardTileProps) {
  return (
    <button className={`workspace-new-card ${viewMode === 'list' ? 'is-list' : ''}`} onClick={onCreate} type="button">
      <span aria-hidden="true">+</span>
      <strong>New board</strong>
    </button>
  )
}

export function WorkspaceLoadingState() {
  return <div className="workspace-empty-inline">Loading workspace boards...</div>
}

export function WorkspaceEmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="workspace-empty-hero">
      <strong>No boards yet.</strong>
      <button className="product-button product-button-primary" onClick={onCreate} type="button">New board</button>
    </div>
  )
}
