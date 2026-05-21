import Link from 'next/link'
import { AppShell } from '@/components/app-shell/AppShell'

export default function CollectionsPage() {
  return (
    <AppShell>
      <div className="product-page management-page">
        <section className="product-page-header">
          <p className="product-kicker">Collection</p>
          <h1 className="product-page-title">Saved assets and references will live here.</h1>
          <p className="product-section-copy">
            Collection is a route shell for future reusable images, references and saved
            generations. It does not replace the active Workspace Board gallery.
          </p>
        </section>

        <section className="management-summary-grid" aria-label="Collection summary">
          <article className="management-callout cream">
            <span>Assets</span>
            <h2>Asset library later</h2>
            <p>Real Collection needs persisted Asset metadata, thumbnails and ownership filters.</p>
          </article>
          <article className="management-callout mint">
            <span>References</span>
            <h2>Workspace-scoped</h2>
            <p>Future saved references should remain filtered by workspace permissions.</p>
          </article>
          <article className="management-callout">
            <span>Status</span>
            <h2>Placeholder</h2>
            <p>P0 still prioritizes Board persistence, Auth and real AI output into Assets.</p>
          </article>
        </section>

        <section className="management-notice">
          <div>
            <h2>No asset library CRUD yet.</h2>
            <p>
              Collection becomes useful after real staging storage, Auth and AI-generated Asset
              records are connected.
            </p>
          </div>
          <Link className="product-button product-button-primary" href="/workspaces">Back to workspace</Link>
        </section>
      </div>
    </AppShell>
  )
}
