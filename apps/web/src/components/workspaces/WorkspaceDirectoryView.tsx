'use client'

import { useMemo, useState } from 'react'
import type { PlanKey, WorkspaceKind } from '@/features/billing/billingTypes'
import { WorkspaceDirectoryActions } from './WorkspaceDirectoryActions'
import {
  DirectorySection,
  FeaturedSummaryCard,
  type DirectoryViewMode,
} from './WorkspaceDirectoryViewParts'
import {
  type WorkspaceDirectoryItem,
} from '@/features/workspaces/workspacePresentation'

type WorkspaceDirectoryViewProps = {
  createLabel: string
  currentPlanKey?: null | PlanKey
  emptyCreatedLabel: string
  emptyJoinedLabel: string
  featuredSummary?: null | {
    currentPeriodEnd?: null | string
    label: string
    meta: string
    planLabel: string
    remainingCredits: number
    title: string
    totalCredits: number
    usedThisCycle: number
  }
  isLoading?: boolean
  joinLabel: string
  kind: Extract<WorkspaceKind, 'group_workspace' | 'team_workspace'>
  items: WorkspaceDirectoryItem[]
  statusMessage?: null | string
  title: string
}

export function WorkspaceDirectoryView({
  createLabel,
  currentPlanKey,
  emptyCreatedLabel,
  emptyJoinedLabel,
  featuredSummary = null,
  isLoading = false,
  joinLabel,
  kind,
  items,
  statusMessage = null,
  title,
}: WorkspaceDirectoryViewProps) {
  const [optimisticItems, setOptimisticItems] = useState<WorkspaceDirectoryItem[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [viewMode, setViewMode] = useState<DirectoryViewMode>('gallery')
  const directoryItems = useMemo(() => mergeWorkspaceItems(items, optimisticItems), [items, optimisticItems])

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
            currentPlanKey={currentPlanKey}
            joinLabel={joinLabel}
            kind={kind}
            onWorkspaceAdded={appendDirectoryItem}
          />
        </div>
      </section>
      {statusMessage ? <p className="workspace-directory-status" role="status">{statusMessage}</p> : null}

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
        {featuredSummary ? <FeaturedSummaryCard summary={featuredSummary} /> : null}
        <DirectorySection
          emptyLabel={emptyCreatedLabel}
          isLoading={isLoading}
          items={createdItems}
          title="Created by me"
          viewMode={viewMode}
        />
        <DirectorySection
          emptyLabel={emptyJoinedLabel}
          isLoading={isLoading}
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
    setOptimisticItems((current) => [
      { ...item, href },
      ...current.filter((existing) => existing.id !== item.id),
    ])
  }
}

function mergeWorkspaceItems(
  baseItems: WorkspaceDirectoryItem[],
  optimisticItems: WorkspaceDirectoryItem[],
) {
  const seen = new Set<string>()
  return [...optimisticItems.filter((item) => !baseItems.some((existing) => existing.id === item.id)), ...baseItems].filter((item) => {
    if (seen.has(item.id)) return false
    seen.add(item.id)
    return true
  })
}
