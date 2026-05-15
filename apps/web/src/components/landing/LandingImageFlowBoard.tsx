export function LandingImageFlowBoard() {
  return (
    <div className="tanergy-vibrant-flow-board" aria-label="Image flow board preview">
      <div className="tanergy-vibrant-flow-board__toolbar">
        <span />
        <span />
        <span />
        <strong>Image Flow Board</strong>
      </div>

      <div className="tanergy-vibrant-flow-edge tanergy-vibrant-flow-edge--prompt" />
      <div className="tanergy-vibrant-flow-edge tanergy-vibrant-flow-edge--chat" />

      <article className="tanergy-vibrant-flow-node tanergy-vibrant-flow-node--prompt">
        <span>Prompt</span>
        <p>Refine product lighting with editorial contrast.</p>
      </article>

      <article className="tanergy-vibrant-flow-node tanergy-vibrant-flow-node--image">
        <span>Image Gen 4</span>
        <div className="tanergy-vibrant-flow-grid" aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
        </div>
      </article>

      <article className="tanergy-vibrant-flow-node tanergy-vibrant-flow-node--chat">
        <span>AI Chat</span>
        <p>Compare, annotate and export the answer.</p>
      </article>
    </div>
  )
}
