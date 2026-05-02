'use client'

import type { WorkspaceBoardViewMode } from './WorkspaceBoardItem'

export type WorkspaceBoardSortMode = 'opened' | 'saved' | 'title' | 'objects'

type WorkspaceBoardToolbarProps = {
  onSearchChange: (query: string) => void
  onSortModeChange: (mode: WorkspaceBoardSortMode) => void
  onViewModeChange: (mode: WorkspaceBoardViewMode) => void
  searchQuery: string
  sortMode: WorkspaceBoardSortMode
  viewMode: WorkspaceBoardViewMode
}

export function WorkspaceBoardToolbar({
  onSearchChange,
  onSortModeChange,
  onViewModeChange,
  searchQuery,
  sortMode,
  viewMode,
}: WorkspaceBoardToolbarProps) {
  return (
    <section className="workspace-toolbar" aria-label="Board gallery tools">
      <input
        aria-label="Search boards"
        onChange={(event) => onSearchChange(event.target.value)}
        placeholder="Search boards"
        value={searchQuery}
      />
      <div className="workspace-toolbar-controls">
        <label className="workspace-sort-control">
          <span>Sort</span>
          <select
            aria-label="Sort boards"
            onChange={(event) => onSortModeChange(event.target.value as WorkspaceBoardSortMode)}
            value={sortMode}
          >
            <option value="opened">Recently opened</option>
            <option value="saved">Recently saved</option>
            <option value="title">Title A-Z</option>
            <option value="objects">Most objects</option>
          </select>
        </label>
        <div className="workspace-view-toggle" aria-label="View mode">
          <button className={viewMode === 'gallery' ? 'is-active' : ''} onClick={() => onViewModeChange('gallery')} type="button">
            Gallery
          </button>
          <button className={viewMode === 'list' ? 'is-active' : ''} onClick={() => onViewModeChange('list')} type="button">
            List
          </button>
        </div>
      </div>
    </section>
  )
}
