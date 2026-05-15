'use client'

import type { CSSProperties } from 'react'
import { useEffect } from 'react'
import Link from 'next/link'
import { LandingImageFlowBoard } from './LandingImageFlowBoard'

const metrics = [
  { label: 'Faster iteration', value: '10x' },
  { label: 'Visual clutter', value: '0px' },
  { label: 'Signal to noise', value: '99%' },
]

const statusItems = [
  { label: 'Nav Syncing', tone: 'coral' },
  { label: 'Data Binding', tone: 'mint' },
  { label: 'Final Render', tone: 'ink' },
]

const footerLinks = ['Privacy', 'Terms', 'API', 'Status']

export function VibrantLandingPage() {
  useEffect(() => {
    const revealNodes = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]'))
    if (revealNodes.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          entry.target.setAttribute('data-visible', entry.isIntersecting ? 'true' : 'false')
        }
      },
      {
        rootMargin: '-8% 0px -8% 0px',
        threshold: 0.12,
      }
    )

    for (const node of revealNodes) observer.observe(node)
    return () => observer.disconnect()
  }, [])

  return (
    <main className="tanergy-vibrant-landing">
      <nav className="tanergy-vibrant-nav" aria-label="Primary">
        <Link className="tanergy-vibrant-brand" href="/">
          Tanergy
        </Link>
        <div className="tanergy-vibrant-nav__links">
          <a aria-current="page" href="#canvas">
            Canvas
          </a>
          <a href="#library">Library</a>
          <Link href="/workspaces">Boards</Link>
          <Link href="/group">Team</Link>
        </div>
        <div className="tanergy-vibrant-nav__actions">
          <button aria-label="Search" className="tanergy-vibrant-search" type="button">
            <span />
          </button>
          <Link className="tanergy-vibrant-pill tanergy-vibrant-pill--dark" href="/sign-up">
            New Project
          </Link>
        </div>
      </nav>

      <section className="tanergy-vibrant-hero" id="canvas">
        <div className="tanergy-vibrant-hero__copy" data-reveal style={revealStyle(0)}>
          <h1>Unleash your creative potential with Tanergy.</h1>
          <p>
            A quietly editorial environment designed for high-fidelity thought. Structure your
            chaos into pristine, publish-ready architectures without the cognitive overhead.
          </p>
          <div className="tanergy-vibrant-hero__actions">
            <Link className="tanergy-vibrant-pill tanergy-vibrant-pill--dark" href="/sign-up">
              Start Canvas
            </Link>
            <Link className="tanergy-vibrant-pill tanergy-vibrant-pill--light" href="/sign-in">
              View Demo
            </Link>
          </div>
        </div>
        <div className="tanergy-vibrant-hero__visual" data-reveal style={revealStyle(140)}>
          <LandingImageFlowBoard />
        </div>
      </section>

      <section className="tanergy-vibrant-band">
        <div className="tanergy-vibrant-band__inner" data-reveal>
          <span aria-hidden="true" className="tanergy-vibrant-band__bolt">
            ⚡
          </span>
          <h2>Clarity over decoration. Velocity over friction. The definitive canvas for high-leverage teams.</h2>
          <div className="tanergy-vibrant-band__metrics">
            {metrics.map((metric) => (
              <div key={metric.label}>
                <strong>{metric.value}</strong>
                <span>{metric.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="tanergy-vibrant-primitives" id="library">
        <div className="tanergy-vibrant-primitives__header" data-reveal>
          <div>
            <h3>Architectural primitives.</h3>
            <p>Fragments of the Tanergy UI designed for pure utility, floating in an endless canvas.</p>
          </div>
          <Link className="tanergy-vibrant-pill tanergy-vibrant-pill--dark" href="/workspaces">
            Explore Library
          </Link>
        </div>

        <div className="tanergy-vibrant-primitives__grid">
          <article className="tanergy-vibrant-card tanergy-vibrant-card--board" data-reveal style={revealStyle(60)}>
            <div className="tanergy-vibrant-card__topline">
              <span>Active Board</span>
              <small>•••</small>
            </div>
            <div className="tanergy-vibrant-board-card">
              <div className="tanergy-vibrant-board-card__badge">↗</div>
              <h4>Campaign Strategy Q3</h4>
              <p>Mapping core metrics to creative deliverables across all channels.</p>
            </div>
          </article>

          <article className="tanergy-vibrant-card tanergy-vibrant-card--status" data-reveal style={revealStyle(140)}>
            <div className="tanergy-vibrant-card__topline">
              <span>Component Status</span>
            </div>
            <div className="tanergy-vibrant-status-list">
              {statusItems.map((item) => (
                <div className="tanergy-vibrant-status-item" key={item.label}>
                  <i className={`is-${item.tone}`} />
                  <span>{item.label}</span>
                </div>
              ))}
            </div>
          </article>

          <article className="tanergy-vibrant-card tanergy-vibrant-card--fluid" data-reveal style={revealStyle(80)}>
            <div className="tanergy-vibrant-card__icon">◫</div>
            <div>
              <h4>Fluid States</h4>
              <p>Transitions handled naturally.</p>
            </div>
          </article>

          <article className="tanergy-vibrant-card tanergy-vibrant-card--document" data-reveal style={revealStyle(180)}>
            <div className="tanergy-vibrant-document__label">
              <i />
              <span>Live Document</span>
            </div>
            <div className="tanergy-vibrant-document__body">
              <div>
                <strong>H1 Typography Shift</strong>
                <p>Adjusted tracking to -0.02em for display sizes.</p>
              </div>
              <div>
                <strong>Grid Alignment</strong>
                <p>Snapped all primary containers to the 12-column baseline.</p>
              </div>
            </div>
          </article>
        </div>
      </section>

      <section className="tanergy-vibrant-methodology" id="methodology">
        <div className="tanergy-vibrant-methodology__inner" data-reveal>
          <span>The Methodology</span>
          <h2>We believe white space is functional. Every pixel must earn its place on the screen.</h2>
          <a className="tanergy-vibrant-pill tanergy-vibrant-pill--light tanergy-vibrant-pill--round" href="#access">
            Read the Manifesto
          </a>
        </div>
      </section>

      <section className="tanergy-vibrant-access" id="access">
        <div className="tanergy-vibrant-access__inner" data-reveal>
          <h2>Ready to build?</h2>
          <p>Join the waitlist for Tanergy Pro and experience the ultimate editorial workspace.</p>
          <form action="/sign-up" className="tanergy-vibrant-access__form">
            <input name="email" placeholder="Email address" type="email" />
            <button className="tanergy-vibrant-pill tanergy-vibrant-pill--accent" type="submit">
              Request Access
            </button>
          </form>
        </div>
      </section>

      <footer className="tanergy-vibrant-footer">
        <div className="tanergy-vibrant-footer__inner" data-reveal>
          <small>© 2026 TANERGY AI. Quietly Editorial.</small>
          <div className="tanergy-vibrant-footer__links">
            {footerLinks.map((item) => (
              <a href="#canvas" key={item}>
                {item}
              </a>
            ))}
          </div>
        </div>
      </footer>
    </main>
  )
}

function revealStyle(delay: number): CSSProperties {
  return { ['--landing-delay' as string]: `${delay}ms` }
}
