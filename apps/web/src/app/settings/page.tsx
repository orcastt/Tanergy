import { AppShell } from '@/components/app-shell/AppShell'

const settings = [
  {
    title: 'Canvas defaults',
    copy: 'Grid, snap and zoom preferences remain local client settings until the user profile exists.',
  },
  {
    title: 'Persistence mode',
    copy: 'Boards and assets use the local bridge unless NEXT_PUBLIC_API_BASE_URL points to FastAPI.',
  },
  {
    title: 'AI providers',
    copy: 'Provider keys stay server-only. This page will only expose model availability and usage state.',
  },
]

export default function SettingsPage() {
  return (
    <AppShell>
      <div className="product-page">
        <section className="product-page-header">
          <p className="product-kicker">Settings shell</p>
          <h1 className="product-page-title">Quiet controls for local product readiness.</h1>
          <p className="product-section-copy">
            Settings are intentionally scoped to visible app preferences and deployment state.
            Secrets, provider keys and production credentials never enter the frontend.
          </p>
        </section>

        <section className="product-grid" aria-label="Settings groups">
          {settings.map((item) => (
            <article className="product-panel" key={item.title}>
              <h2>{item.title}</h2>
              <p>{item.copy}</p>
            </article>
          ))}
        </section>

        <section className="product-signature">
          <div>
            <h2>Server-managed credentials</h2>
            <p>
              R2, Postgres, email and AI provider values are configured through server
              environments. The frontend only reads public routing variables.
            </p>
          </div>
          <div className="product-ui-fragment" aria-hidden="true">
            <div className="product-ui-row">
              <span className="product-ui-line" />
              <span className="product-ui-chip" />
            </div>
            <div className="product-ui-row">
              <span className="product-ui-line" />
              <span className="product-ui-chip" />
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  )
}
