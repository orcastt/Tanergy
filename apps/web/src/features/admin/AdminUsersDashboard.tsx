'use client'

import { useRouter } from 'next/navigation'
import type { FormEvent } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { EmptyRow, FilterTextInput, limitOptions } from './adminAiShared'
import { loadAdminOperatorUserDetailResource } from './adminOperatorDetailCache'
import { AdminOperatorUserInventoryRow } from './AdminOperatorUserInventoryRow'
import {
  primeAdminOperatorUsersResource,
  loadAdminOperatorUsersResource,
} from './adminOperatorUsersCache'
import { adminOperatorUsersQuerySignature, getInitialAdminOperatorUsersState } from './adminOperatorUsersState'
import type { AdminOperatorUserRecord, AdminOperatorUsersResource } from './adminTypes'
import { writeAdminUsersViewState } from './adminUsersViewState'

type UsersDashboardStatus = 'error' | 'loading' | 'ready' | 'refreshing'

export function AdminUsersDashboard({ enabled, seedResource }: { enabled: boolean; seedResource: AdminOperatorUsersResource }) {
  const router = useRouter()
  const warmedUserIds = useRef(new Set<string>())
  const initialState = getInitialAdminOperatorUsersState(seedResource)
  const [limit, setLimit] = useState<(typeof limitOptions)[number]>(initialState.limit)
  const [offset, setOffset] = useState(initialState.offset)
  const [searchDraft, setSearchDraft] = useState(initialState.searchDraft)
  const [searchQuery, setSearchQuery] = useState(initialState.searchQuery)
  const [loadedSignature, setLoadedSignature] = useState(initialState.seedMatchesInitialQuery || initialState.snapshot.data ? initialState.signature : '')
  const [usingSeedResource, setUsingSeedResource] = useState(initialState.seedMatchesInitialQuery)
  const [resource, setResource] = useState<AdminOperatorUsersResource>(initialState.resource)
  const [error, setError] = useState<string | null>(initialState.error)
  const restoreScrollYRef = useRef(initialState.viewState?.scrollY ?? 0)
  const hasBaseQuery = !searchQuery && offset === 0
  const isSeedActive = usingSeedResource && hasBaseQuery && limit === seedResource.limit && seedResource.ok
  const requestSignature = adminOperatorUsersQuerySignature({ limit, offset, search: searchQuery })
  const shouldFetch = enabled && !isSeedActive && requestSignature !== loadedSignature
  const effectiveResource = isSeedActive ? seedResource : resource
  const hasActiveSearch = Boolean(searchDraft.trim()) || Boolean(searchQuery)

  useEffect(() => {
    if (!shouldFetch) return

    let cancelled = false

    loadAdminOperatorUsersResource({ limit, offset, search: searchQuery || undefined })
      .then((nextResource) => {
        if (cancelled) return
        setUsingSeedResource(false)
        setResource(nextResource)
        setLoadedSignature(requestSignature)
        setError(nextResource.error ?? null)
      })
      .catch((nextError: unknown) => {
        if (cancelled) return
        setUsingSeedResource(false)
        setLoadedSignature(requestSignature)
        setError(nextError instanceof Error ? nextError.message : 'User directory failed to load.')
      })

    return () => {
      cancelled = true
    }
  }, [limit, offset, requestSignature, searchQuery, shouldFetch])

  const visibleUsers = effectiveResource.users
  const effectiveError = isSeedActive ? (seedResource.error ?? null) : error
  const effectiveRefreshing = isSeedActive ? false : shouldFetch
  const effectiveStatus: UsersDashboardStatus = !enabled
    ? 'ready'
    : effectiveRefreshing && !effectiveResource.users.length
      ? 'loading'
      : effectiveRefreshing
        ? 'refreshing'
        : effectiveError
          ? 'error'
          : 'ready'
  const rangeLabel = useMemo(() => {
    if (!visibleUsers.length) return '0 / 0'
    const start = effectiveResource.offset + 1
    const end = effectiveResource.offset + visibleUsers.length
    return `${start}-${end} / ${effectiveResource.totalCount.toLocaleString('en-US')}`
  }, [effectiveResource.offset, effectiveResource.totalCount, visibleUsers.length])
  const canGoBack = offset > 0
  const canGoNext = offset + limit < effectiveResource.totalCount

  useEffect(() => {
    if (seedResource.ok) {
      primeAdminOperatorUsersResource(
        { limit: seedResource.limit || 100, offset: seedResource.offset || 0 },
        seedResource,
      )
    }
  }, [seedResource])

  useEffect(() => {
    writeAdminUsersViewState({
      limit,
      offset,
      scrollY: typeof window === 'undefined' ? 0 : window.scrollY,
      searchDraft,
      searchQuery,
    })
  }, [limit, offset, searchDraft, searchQuery])

  useEffect(() => {
    if (!enabled) return
    const handleScroll = () => {
      writeAdminUsersViewState({
        limit,
        offset,
        scrollY: window.scrollY,
        searchDraft,
        searchQuery,
      })
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', handleScroll)
    }
  }, [enabled, limit, offset, searchDraft, searchQuery])

  useEffect(() => {
    if (restoreScrollYRef.current <= 0) return
    if (effectiveStatus === 'loading') return
    const nextScrollY = restoreScrollYRef.current
    const frame = window.requestAnimationFrame(() => {
      window.scrollTo({ top: nextScrollY })
      restoreScrollYRef.current = 0
    })
    return () => {
      window.cancelAnimationFrame(frame)
    }
  }, [effectiveStatus, visibleUsers.length])

  function submitSearch(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault()
    setOffset(0)
    setSearchQuery(searchDraft.trim())
  }

  function clearSearch() {
    setOffset(0)
    setSearchDraft('')
    setSearchQuery('')
  }

  function persistViewState() {
    writeAdminUsersViewState({
      limit,
      offset,
      scrollY: typeof window === 'undefined' ? 0 : window.scrollY,
      searchDraft,
      searchQuery,
    })
  }

  function warmDetail(user: AdminOperatorUserRecord) {
    persistViewState()
    const detailHref = `/admin/users/${encodeURIComponent(user.id)}`
    if (!warmedUserIds.current.has(user.id)) {
      warmedUserIds.current.add(user.id)
      router.prefetch(detailHref)
      void loadAdminOperatorUserDetailResource(user.id)
    }
  }

  return (
    <section className="management-panel management-panel-wide admin-users-directory" aria-label="User inventory">
        <div className="management-panel-heading">
          <div>
            <h2>Users</h2>
          </div>
        </div>

        <div className="admin-users-toolbar">
          <form className="admin-users-search-form" onSubmit={submitSearch}>
            <FilterTextInput
              label="Search users"
              leadingIcon="search"
              onChange={setSearchDraft}
              placeholder="email, name, or user_id"
              value={searchDraft}
            />
            <button className="product-button" type="submit">Search</button>
            <button className="product-button product-button-secondary" disabled={!hasActiveSearch} onClick={clearSearch} type="button">
              Clear
            </button>
          </form>
          <div className="admin-users-toolbar-actions">
            <span className="admin-users-range-label">{rangeLabel}</span>
            <div className="management-segmented admin-users-limit-toggle">
              {limitOptions.map((option) => (
                <button
                  key={option}
                  className={option === limit ? 'is-active' : undefined}
                  onClick={() => {
                    setLimit(option)
                    setOffset(0)
                  }}
                  type="button"
                >
                  {option}
                </button>
              ))}
            </div>
            <button className="product-button product-button-secondary" disabled={!canGoBack} onClick={() => setOffset(Math.max(0, offset - limit))} type="button">
              Previous
            </button>
            <button className="product-button product-button-secondary" disabled={!canGoNext} onClick={() => setOffset(offset + limit)} type="button">
              Next
            </button>
          </div>
        </div>

        {effectiveError ? <p>{effectiveError}</p> : null}

        <div className="management-table-wrap">
          <table className="management-table admin-users-table">
            <colgroup>
              <col style={{ width: '10%' }} />
              <col style={{ width: '11%' }} />
              <col style={{ width: '4%' }} />
              <col style={{ width: '8%' }} />
              <col style={{ width: '13%' }} />
              <col style={{ width: '13%' }} />
              <col style={{ width: '10%' }} />
              <col style={{ width: '10%' }} />
              <col style={{ width: '7%' }} />
              <col style={{ width: '5%' }} />
              <col style={{ width: '5%' }} />
            </colgroup>
            <thead>
              <tr>
                <th>User ID</th>
                <th>Email</th>
                <th>IP</th>
                <th>Register date</th>
                <th>Team plan</th>
                <th>Team credit</th>
                <th>Group plan</th>
                <th>Person credit</th>
                <th>Total spent</th>
                <th>Status</th>
                <th>Detail</th>
              </tr>
            </thead>
            <tbody>
              {effectiveStatus === 'loading' ? <EmptyRow colSpan={11} message="Loading users..." /> : null}
              {effectiveStatus !== 'loading' && visibleUsers.length ? visibleUsers.map((user) => (
                <AdminOperatorUserInventoryRow key={user.id} onWarmDetail={warmDetail} user={user} />
              )) : null}
              {effectiveStatus !== 'loading' && !visibleUsers.length ? <EmptyRow colSpan={11} message="No users match this search." /> : null}
            </tbody>
          </table>
        </div>
    </section>
  )
}
