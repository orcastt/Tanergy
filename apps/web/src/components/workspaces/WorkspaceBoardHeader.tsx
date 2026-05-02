'use client'

type WorkspaceBoardHeaderProps = {
  isLoading: boolean
  onCreate: () => void
  onRefresh: () => void
}

export function WorkspaceBoardHeader({ isLoading, onCreate, onRefresh }: WorkspaceBoardHeaderProps) {
  return (
    <section className="workspace-header">
      <div>
        <p className="product-kicker">Workspace</p>
        <h1>Boards in this workspace.</h1>
        <p>Open a saved canvas, create a new board, or switch between gallery and list scanning.</p>
      </div>
      <div className="workspace-header-actions" aria-label="Workspace board controls">
        <button className="product-button product-button-primary" onClick={onCreate} type="button">
          New board
        </button>
        <button className="product-button product-button-secondary" disabled={isLoading} onClick={onRefresh} type="button">
          Refresh
        </button>
      </div>
    </section>
  )
}
