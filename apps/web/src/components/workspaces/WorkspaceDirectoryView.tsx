'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import type { WorkspaceKind } from '@/features/billing/billingTypes'
import { WorkspaceDirectoryActions } from './WorkspaceDirectoryActions'
import {
  formatWorkspaceMembershipRole,
  type WorkspaceDirectoryItem,
} from '@/features/workspaces/workspaceDirectoryMock'

type DirectoryViewMode = 'gallery' | 'list'

type WorkspaceDirectoryViewProps = {
  createLabel: string
  emptyCreatedLabel: string
  emptyJoinedLabel: string
  joinLabel: string
  kind: Extract<WorkspaceKind, 'group_workspace' | 'team_workspace'>
  items: WorkspaceDirectoryItem[]
  title: string
}

export function WorkspaceDirectoryView({
  createLabel,
  emptyCreatedLabel,
  emptyJoinedLabel,
  joinLabel,
  kind,
  items,
  title,
}: WorkspaceDirectoryViewProps) {
  const [directoryItems, setDirectoryItems] = useState(items)
  const [searchQuery, setSearchQuery] = useState('')
  const [viewMode, setViewMode] = useState<DirectoryViewMode>('gallery')

  const filteredItems = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return directoryItems
    return directoryItems.filter((item) => (
      item.name.toLowerCase().includes(query)
      || item.membershipRole.includes(query)
    ))
  }, [directoryItems, searchQuery])

  const createdItems = filteredItems.filter((item) => item.relationship === 'created')
  const joinedItems = filteredItems.filter((item) => item.relationship === 'joined')

  return (
    <div className="product-page workspace-directory-page">
      <section className="product-page-header workspace-directory-header">
        <div className="workspace-directory-header-main">
          <h1 className="product-page-title">{title}</h1>
          <WorkspaceDirectoryActions
            createLabel={createLabel}
            joinLabel={joinLabel}
            kind={kind}
            onWorkspaceAdded={appendDirectoryItem}
          />
        </div>
      </section>

      <section className="workspace-toolbar workspace-directory-toolbar" aria-label={`${title} tools`}>
        <label className="workspace-search-field">
          <span aria-hidden="true" className="workspace-search-glyph" />
          <input
            aria-label={`Search ${title.toLowerCase()}`}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder={`Search ${title.toLowerCase()}`}
            value={searchQuery}
          />
        </label>
        <div className="workspace-view-toggle" aria-label="View mode">
          <button className={viewMode === 'gallery' ? 'is-active' : ''} onClick={() => setViewMode('gallery')} type="button">
            Gallery
          </button>
          <button className={viewMode === 'list' ? 'is-active' : ''} onClick={() => setViewMode('list')} type="button">
            List
          </button>
        </div>
      </section>

      <div className="workspace-directory-stack">
        <DirectorySection
          emptyLabel={emptyCreatedLabel}
          items={createdItems}
          title="Created by me"
          viewMode={viewMode}
        />
        <DirectorySection
          emptyLabel={emptyJoinedLabel}
          items={joinedItems}
          title="Joined"
          viewMode={viewMode}
        />
      </div>
    </div>
  )

  function appendDirectoryItem(item: WorkspaceDirectoryItem) {
    if (item.kind !== kind) return
    const href = item.kind === 'team_workspace' ? `/team/${encodeURIComponent(item.id)}` : `/group/${encodeURIComponent(item.id)}`
    setDirectoryItems((current) => [
      { ...item, href },
      ...current.filter((existing) => existing.id !== item.id),
    ])
  }
}

function DirectorySection({
  emptyLabel,
  items,
  title,
  viewMode,
}: {
  emptyLabel: string
  items: WorkspaceDirectoryItem[]
  title: string
  viewMode: DirectoryViewMode
}) {
  return (
    <section className="workspace-directory-section">
      <header className="workspace-directory-section-header">
        <h2>{title}</h2>
      </header>
      {items.length === 0 ? (
        <div className="workspace-directory-empty">{emptyLabel}</div>
      ) : (
        <div className={viewMode === 'gallery' ? 'workspace-directory-grid' : 'workspace-directory-list'}>
          {items.map((item) => (
            <DirectoryCard
              href={item.href ?? null}
              item={item}
              key={item.id}
              viewMode={viewMode}
            />
          ))}
        </div>
      )}
    </section>
  )
}

function DirectoryCard({
  href,
  item,
  viewMode,
}: {
  href: null | string
  item: WorkspaceDirectoryItem
  viewMode: DirectoryViewMode
}) {
  const className = `workspace-directory-card ${viewMode === 'list' ? 'is-list' : ''}${href ? ' is-link' : ''}`
  const content = (
    <>
      <div className="workspace-directory-card-preview" data-kind={item.kind}>
        <span>{getWorkspaceInitials(item.name)}</span>
      </div>
      <div className="workspace-directory-card-body">
        <div className="workspace-directory-card-top">
          <h3>{item.name}</h3>
          <span className={`workspace-directory-role is-${item.membershipRole}`}>
            {formatWorkspaceMembershipRole(item.membershipRole)}
          </span>
        </div>
        <div className="workspace-directory-card-meta">
          <span>{formatBoardCount(item.boardCount)}</span>
          <span>{formatMemberCount(item.memberInitials.length)}</span>
        </div>
      </div>
      <div className="workspace-directory-card-footer">
        <div className="workspace-directory-members" aria-label="Members preview">
          {item.memberInitials.map((initial, index) => (
            <span key={`${item.id}-${initial}-${index}`}>{initial}</span>
          ))}
        </div>
      </div>
    </>
  )

  if (href) {
    return (
      <Link className={className} href={href}>
        {content}
      </Link>
    )
  }

  return (
    <article className={className}>
      {content}
    </article>
  )
}

function getWorkspaceInitials(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'TW'
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase()).join('')
}

function formatBoardCount(value: number) {
  return value === 1 ? '1 board' : `${value} boards`
}

function formatMemberCount(value: number) {
  return value === 1 ? '1 member' : `${value} members`
}
