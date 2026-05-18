import Link from 'next/link'

export type LegalSection = {
  body: string[]
  title: string
}

export function LegalPage({
  intro,
  sections,
  title,
}: {
  intro: string
  sections: LegalSection[]
  title: string
}) {
  return (
    <main className="tanergy-legal-page">
      <nav className="tanergy-legal-nav" aria-label="Legal navigation">
        <Link className="tanergy-legal-brand" href="/">Tanergy</Link>
        <div>
          <Link href="/pricing">Pricing</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/ai-policy">AI Policy</Link>
        </div>
      </nav>

      <article className="tanergy-legal-document">
        <header className="tanergy-legal-header">
          <span>Draft legal policy</span>
          <h1>{title}</h1>
          <p>{intro}</p>
          <small>Last updated: May 18, 2026</small>
        </header>

        <div className="tanergy-legal-sections">
          {sections.map((section) => (
            <section key={section.title}>
              <h2>{section.title}</h2>
              {section.body.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
            </section>
          ))}
        </div>
      </article>
    </main>
  )
}
