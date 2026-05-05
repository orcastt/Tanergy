import Link from 'next/link'

const featureCards = [
  {
    label: 'Canvas',
    title: 'Markup, crop and capture without leaving the board.',
    tone: 'coral',
  },
  {
    label: 'Runtime graph',
    title: 'Prompt, image and chat nodes pass mock data cleanly.',
    tone: 'mint',
  },
  {
    label: 'Workspace',
    title: 'Boards, pages and history are ready for real Auth.',
    tone: 'cream',
  },
]

export default function HomePage() {
  return (
    <main className="tanergy-landing">
      <nav className="tanergy-nav" aria-label="Tanergy navigation">
        <Link className="tanergy-brand" href="/">
          Tanergy
        </Link>
        <div className="tanergy-nav-links" aria-label="Product sections">
          <a href="#canvas">Canvas</a>
          <a href="#flow">Nodes</a>
          <a href="#workspace">Workspace</a>
        </div>
        <div className="tanergy-nav-actions">
          <Link className="tanergy-ghost-link" href="/sign-in">
            Log in
          </Link>
          <Link className="tanergy-dark-button" href="/sign-up">
            Register
          </Link>
        </div>
      </nav>

      <section className="tanergy-hero" aria-labelledby="tanergy-hero-title">
        <div className="tanergy-hero-copy">
          <p className="tanergy-kicker">AI image canvas</p>
          <h1 id="tanergy-hero-title">Tanergy turns visual chaos into editable flow.</h1>
          <p>
            A vibrant workspace for images, prompts, AI nodes and board pages. Start from a clean
            canvas, connect your ideas, then keep the useful parts moving.
          </p>
          <div className="tanergy-hero-actions">
            <Link className="tanergy-dark-button tanergy-large-button" href="/sign-up">
              Start building
            </Link>
            <Link className="tanergy-light-button tanergy-large-button" href="/sign-in">
              Log in
            </Link>
          </div>
        </div>

        <div className="tanergy-product-scene" aria-label="Tanergy canvas preview">
          <div className="tanergy-scene-toolbar">
            <span />
            <span />
            <span />
            <strong>Image Flow Board</strong>
          </div>
          <div className="tanergy-node tanergy-node-prompt">
            <span>Prompt</span>
            <p>Refine product lighting with editorial contrast.</p>
          </div>
          <div className="tanergy-node tanergy-node-image">
            <span>Image Gen 4</span>
            <div className="tanergy-image-grid">
              <i />
              <i />
              <i />
              <i />
            </div>
          </div>
          <div className="tanergy-node tanergy-node-chat">
            <span>AI Chat</span>
            <p>Compare, annotate and export the answer.</p>
          </div>
          <div className="tanergy-edge tanergy-edge-a" />
          <div className="tanergy-edge tanergy-edge-b" />
        </div>
      </section>

      <section className="tanergy-band" id="canvas">
        <h2>Clarity over decoration. Velocity over friction.</h2>
        <div className="tanergy-metric-row" aria-label="Product highlights">
          <div>
            <strong>5%</strong>
            <span>Deep zoom canvas</span>
          </div>
          <div>
            <strong>4</strong>
            <span>Image output ports</span>
          </div>
          <div>
            <strong>∞</strong>
            <span>Reusable board pages</span>
          </div>
        </div>
      </section>

      <section className="tanergy-feature-grid" id="flow" aria-label="Tanergy feature grid">
        {featureCards.map((card) => (
          <article className={`tanergy-feature-card ${card.tone}`} key={card.label}>
            <span>{card.label}</span>
            <h3>{card.title}</h3>
          </article>
        ))}
      </section>

      <section className="tanergy-final-cta" id="workspace">
        <div>
          <p className="tanergy-kicker">Workspace gate</p>
          <h2>Landing first. Auth next. Workspace after verification.</h2>
        </div>
        <Link className="tanergy-dark-button tanergy-large-button" href="/sign-up">
          Create account
        </Link>
      </section>
    </main>
  )
}
