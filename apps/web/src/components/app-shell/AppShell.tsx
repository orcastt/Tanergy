'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, type ReactNode } from 'react'
import { mockSession } from '@/features/auth/mockSession'

const navItems = [
  { href: '/boards', label: 'Boards' },
  { href: '/workspaces', label: 'Workspaces' },
  { href: '/settings', label: 'Settings' },
  { href: '/account', label: 'Account' },
]

type AppShellProps = {
  children: ReactNode
}

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname()
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  return (
    <div className="product-shell">
      <header className="product-top-nav">
        <Link className="product-wordmark" href="/boards" onClick={() => setIsMenuOpen(false)}>
          <span className="product-wordmark-mark">T</span>
          <span>TANGENT</span>
        </Link>

        <nav aria-label="Primary" className="product-nav-links">
          {navItems.map((item) => (
            <Link
              className={`product-nav-link${isActivePath(pathname, item.href) ? ' is-active' : ''}`}
              href={item.href}
              key={item.href}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="product-nav-actions">
          <Link className="product-button product-button-secondary" href="/workspaces">
            {mockSession.activeWorkspace.name}
          </Link>
          <Link className="product-button product-button-primary" href="/boards">
            Open boards
          </Link>
          <Link className="product-text-link" href="/login">
            Log in
          </Link>
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
          {navItems.map((item) => (
            <Link
              className={`product-nav-link${isActivePath(pathname, item.href) ? ' is-active' : ''}`}
              href={item.href}
              key={item.href}
              onClick={() => setIsMenuOpen(false)}
            >
              {item.label}
            </Link>
          ))}
          <Link className="product-button product-button-primary" href="/boards" onClick={() => setIsMenuOpen(false)}>
            Open boards
          </Link>
          <Link className="product-text-link" href="/login" onClick={() => setIsMenuOpen(false)}>
            Log in
          </Link>
        </nav>
      ) : null}

      <main>{children}</main>
    </div>
  )
}

function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`)
}
