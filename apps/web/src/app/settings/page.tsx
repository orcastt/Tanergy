import Link from 'next/link'
import { AppShell } from '@/components/app-shell/AppShell'

const settings = [
  {
    title: 'Canvas defaults',
    status: 'Local browser',
    copy: 'Grid, snap and zoom preferences remain client-side settings until the user profile store exists.',
    rows: ['Grid and snap controls stay inside the canvas settings panel.', 'Board autosave keeps its 1200ms debounce and save indicator.'],
  },
  {
    title: 'Persistence mode',
    status: 'FastAPI-ready',
    copy: 'Boards and assets use the local Next bridge unless the public API base URL points to FastAPI.',
    rows: ['Board documents are guarded before save.', 'Images must resolve through Asset records, not data URLs.'],
  },
  {
    title: 'AI model availability',
    status: 'Mock registry',
    copy: 'Model selectors read the server-owned registry contract. Real provider keys remain server-only.',
    rows: ['Image Gen and Image Gen 4 already consume the mock registry.', 'AI Chat and real provider runs are later P0 work.'],
  },
]

export default function SettingsPage() {
  const apiMode = process.env.NEXT_PUBLIC_API_BASE_URL ? 'FastAPI API base configured' : 'Next local bridge'

  return (
    <AppShell>
      <div className="product-page management-page">
        <section className="product-page-header">
          <p className="product-kicker">Settings</p>
          <h1 className="product-page-title">App settings that are honest about what is wired.</h1>
          <p className="product-section-copy">
            Settings are scoped to visible app preferences, persistence mode and model availability.
            Team permissions, billing and secrets live on their own pages or server environments.
          </p>
        </section>

        <section className="management-summary-grid" aria-label="Settings summary">
          {settings.map((item) => (
            <article className="management-callout" key={item.title}>
              <span>{item.status}</span>
              <h2>{item.title}</h2>
              <p>{item.copy}</p>
            </article>
          ))}
        </section>

        <section className="management-section-grid" aria-label="Settings details">
          {settings.map((item) => (
            <article className="management-panel" key={item.title}>
              <h2>{item.title}</h2>
              <ul className="management-check-list">
                {item.rows.map((row) => <li key={row}>{row}</li>)}
              </ul>
            </article>
          ))}

          <article className="management-panel management-panel-wide">
            <h2>Environment boundary</h2>
            <dl className="management-definition-list">
              <div>
                <dt>Current persistence route</dt>
                <dd>{apiMode}</dd>
              </div>
              <div>
                <dt>Server secrets</dt>
                <dd>R2, Postgres, email and AI provider values are never edited in the frontend.</dd>
              </div>
              <div>
                <dt>Next real setup</dt>
                <dd>Staging API, managed Postgres, R2 bucket, sender domain and AI provider key.</dd>
              </div>
            </dl>
          </article>
        </section>

        <section className="management-notice">
          <div>
            <h2>Separated product areas</h2>
            <p>
              Team membership and subscription are intentionally split into their own route shells
              so Settings stays focused on app behavior.
            </p>
          </div>
          <div className="management-actions">
            <Link className="product-button product-button-secondary" href="/team">Team</Link>
            <Link className="product-button product-button-secondary" href="/billing">Subscription</Link>
          </div>
        </section>
      </div>
    </AppShell>
  )
}
