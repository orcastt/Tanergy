'use client'

import Link from 'next/link'
import { SignOutButton, UserButton } from '@clerk/nextjs'
import { usePathname, useRouter } from 'next/navigation'
import { useState, type ReactNode } from 'react'
import { useTangentSession } from '@/features/auth/useTangentSession'

const topNavItems = [
  { href: '/workspaces', label: 'Workspace', match: ['/workspaces', '/boards'] },
  { href: '/collections', label: 'Collection' },
  { href: '/team', label: 'Team' },
  { href: '/billing', label: 'Subscription' },
]

type SideNavItem =
  | { href: string; icon: string; label: string; match?: string[]; type: 'link' }

const sideNavItems = [
  { href: '/workspaces', icon: 'W', label: 'Workspace', match: ['/boards', '/workspaces'], type: 'link' },
  { href: '/collections', icon: 'C', label: 'Collections', type: 'link' },
  { href: '/team', icon: 'T', label: 'Team', type: 'link' },
  { href: '/billing', icon: '$', label: 'Subscription', type: 'link' },
  { href: '/settings', icon: '*', label: 'Settings', type: 'link' },
] satisfies SideNavItem[]

type AppShellProps = {
  children: ReactNode
}

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { error: sessionError, session, status: sessionStatus } = useTangentSession()
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  const createBoard = () => {
    setIsMenuOpen(false)
    router.push(`/boards/${encodeURIComponent(createBoardId())}?new=1`)
  }

  return (
    <div className="product-shell">
      <header className="product-top-nav">
        <Link className="product-wordmark" href="/" onClick={() => setIsMenuOpen(false)}>
          <span className="product-wordmark-mark">T</span>
          <span>Tanergy</span>
        </Link>

        <nav aria-label="Primary" className="product-nav-links">
          {topNavItems.map((item) => (
            <Link
              className={`product-nav-link${isActiveItem(pathname, item) ? ' is-active' : ''}`}
              href={item.href}
              key={item.label}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="product-nav-actions">
          <Link aria-label="Search" className="product-search-link" href="/workspaces">
            <span aria-hidden="true" />
          </Link>
          <UserButton />
          <button className="product-button product-button-primary" onClick={createBoard} type="button">
            New Board
          </button>
        </div>

        <button
          aria-expanded={isMenuOpen}
          className="product-button product-button-secondary product-mobile-menu"
          onClick={() => setIsMenuOpen((value) => !value)}
          type="button"
        >
          Menu
        </button>
      </header>

      {isMenuOpen ? (
        <nav aria-label="Mobile primary" className="product-nav-sheet">
          {topNavItems.map((item) => (
            <Link
              className={`product-nav-link${isActiveItem(pathname, item) ? ' is-active' : ''}`}
              href={item.href}
              key={item.label}
              onClick={() => setIsMenuOpen(false)}
            >
              {item.label}
            </Link>
          ))}
          <Link className="product-button product-button-primary" href="/workspaces" onClick={() => setIsMenuOpen(false)}>
            Open workspace
          </Link>
          <Link className="product-text-link" href="/account" onClick={() => setIsMenuOpen(false)}>
            Account
          </Link>
          <Link className="product-text-link" href="/sign-in" onClick={() => setIsMenuOpen(false)}>
            Log in
          </Link>
        </nav>
      ) : null}

      <div className="product-app-frame">
        <aside className="product-sidebar" aria-label="Workspace navigation">
          <section className="product-sidebar-workspace">
            <div className="product-sidebar-avatar" aria-hidden="true" />
            <div>
              <strong>Tanergy</strong>
              <span>{session.activeWorkspace.name}</span>
            </div>
          </section>

          <Link className="product-sidebar-upgrade" href="/billing">
            Upgrade Plan
          </Link>

          <nav className="product-sidebar-nav">
            {sideNavItems.map((item) => (
              <Link
                className={[
                  'product-sidebar-link',
                  isActiveItem(pathname, item) ? 'is-active' : '',
                ].filter(Boolean).join(' ')}
                href={item.href}
                key={item.label}
              >
                <span aria-hidden="true">{item.icon}</span>
                {item.label}
              </Link>
            ))}
          </nav>

          <nav className="product-sidebar-footer" aria-label="Account navigation">
            <Link
              className={`product-sidebar-link${isActivePath(pathname, '/account') ? ' is-active' : ''}`}
              href="/account"
            >
              <span aria-hidden="true">{session.user.avatarInitials}</span>
              Account
            </Link>
            <SignOutButton redirectUrl="/">
              <button className="product-sidebar-link is-muted" type="button">
                <span aria-hidden="true">-&gt;</span>
                Logout
              </button>
            </SignOutButton>
          </nav>
        </aside>
        <main className="product-main">
          {sessionStatus === 'error' ? (
            <div className="product-session-warning" role="status">
              {sessionError ?? 'Session lookup failed. Using local fallback display.'}
            </div>
          ) : null}
          {children}
        </main>
      </div>
    </div>
  )
}

function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`)
}

function isActiveItem(pathname: string, item: { href: string; match?: string[] }) {
  if (item.match) return item.match.some((path) => isActivePath(pathname, path))
  return isActivePath(pathname, item.href)
}

function createBoardId() {
  return `board-${new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}`
}
