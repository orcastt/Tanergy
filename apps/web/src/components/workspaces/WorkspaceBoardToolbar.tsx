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
      <label className="workspace-search-field">
        <span aria-hidden="true" className="workspace-search-glyph" />
        <input
          aria-label="Search boards"
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search boards"
          value={searchQuery}
        />
      </label>
      <div className="workspace-toolbar-controls">
        <div className="workspace-select-shell">
          <select
            aria-label="Sort boards"
            className="workspace-sort-select"
            onChange={(event) => onSortModeChange(event.target.value as WorkspaceBoardSortMode)}
            value={sortMode}
          >
            <option value="opened">Recently opened</option>
            <option value="saved">Recently saved</option>
            <option value="title">Title A-Z</option>
            <option value="objects">Most objects</option>
          </select>
        </div>
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
