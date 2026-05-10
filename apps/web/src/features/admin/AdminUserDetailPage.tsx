'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState, type ReactNode } from 'react'
import { AdminOperatorActionModal } from './AdminOperatorActionModal'
import type { AdminOperatorMutationResult } from './adminOperatorActionMutations'
import {
  AdminOperatorBillingPanel,
  AdminOperatorGroupPlanPanel,
  AdminOperatorJoinedWorkspacePanel,
  AdminOperatorTeamPlanPanel,
} from './AdminOperatorDetailPanels'
import {
  clearAdminOperatorUserDetail,
  loadAdminOperatorUserDetailResource,
  patchAdminOperatorUserDetailMutation,
  patchAdminOperatorUserDetailStatus,
  primeAdminOperatorUserDetail,
  readAdminOperatorUserDetail,
} from './adminOperatorDetailCache'
import { getAdminOperatorActionKey, type AdminOperatorAction } from './adminOperatorActions'
import type { AdminAccess, AdminOperatorUserDetail } from './adminTypes'
import { readAdminUserDetailViewState, writeAdminUserDetailViewState, type AdminUserDetailTab } from './adminUserDetailViewState'
import { hasRemotePersistenceApi } from '@/features/api/persistenceApi'

type DetailStatus = 'error' | 'loading' | 'ready' | 'refreshing'

type AdminUserDetailPageProps = {
  seedAccess?: AdminAccess
  seedDetail?: AdminOperatorUserDetail | null
  seedError?: null | string
  userId: string
}

const detailTabs = [
  { id: 'billing', label: 'Billing' },
  { id: 'team-plan', label: 'Team Plan' },
  { id: 'joined-team', label: 'Joined Team' },
  { id: 'group-plan', label: 'Group Plan' },
  { id: 'joined-group', label: 'Joined Group' },
] as const satisfies Array<{ id: AdminUserDetailTab; label: string }>

export function AdminUserDetailPage({
  seedAccess,
  seedDetail = null,
  seedError = null,
  userId,
}: AdminUserDetailPageProps) {
  const router = useRouter()
  const canReachApi = hasRemotePersistenceApi()
  const cachedSnapshot = readAdminOperatorUserDetail(userId)
  const cachedDetail = cachedSnapshot.data?.detail ?? null
  const initialDetail = seedDetail ?? cachedDetail
  const initialViewState = readAdminUserDetailViewState(userId)
  const [activeTab, setActiveTab] = useState<AdminUserDetailTab>(initialViewState?.activeTab ?? 'billing')
  const [activeAction, setActiveAction] = useState<AdminOperatorAction | null>(null)
  const [detail, setDetail] = useState<AdminOperatorUserDetail | null>(initialDetail)
  const [error, setError] = useState<string | null>(seedError ?? cachedSnapshot.error ?? null)
  const [isFetching, setIsFetching] = useState(canReachApi && !initialDetail)
  const detailStatus: DetailStatus = !detail
    ? (error ? 'error' : 'loading')
    : (isFetching ? 'refreshing' : (error ? 'error' : 'ready'))
  const canAccess = seedAccess?.canAccessAdmin ?? true

  useEffect(() => {
    if (!seedDetail) return
    primeAdminOperatorUserDetail(userId, { detail: seedDetail, ok: true })
  }, [seedDetail, userId])

  useEffect(() => {
    if (!canReachApi || detail) return
    let cancelled = false
    loadAdminOperatorUserDetailResource(userId)
      .then((resource) => {
        if (cancelled) return
        setDetail(resource.detail ?? null)
        setError(resource.error ?? null)
      })
      .catch((nextError) => {
        if (cancelled) return
        setError(nextError instanceof Error ? nextError.message : 'User detail failed to load.')
      })
      .finally(() => {
        if (cancelled) return
        setIsFetching(false)
      })
    return () => {
      cancelled = true
    }
  }, [canReachApi, detail, userId])

  useEffect(() => {
    writeAdminUserDetailViewState(userId, {
      activeTab,
      selectedGroupId: '',
      selectedTeamId: '',
    })
  }, [activeTab, userId])

  async function refresh() {
    if (!canReachApi) return
    setIsFetching(true)
    setError(null)
    try {
      const resource = await loadAdminOperatorUserDetailResource(userId, { force: true })
      setDetail(resource.detail ?? null)
      setError(resource.error ?? null)
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'User detail failed to load.')
    } finally {
      setIsFetching(false)
    }
  }

  async function handleActionDone(action: AdminOperatorAction, result: AdminOperatorMutationResult) {
    if ('subscriptionId' in result) {
      await refresh()
      return
    }
    if (!('userId' in result) || !('status' in result)) {
      const nextDetail = patchAdminOperatorUserDetailMutation(userId, action, result)
      if (nextDetail) {
        setDetail(nextDetail)
        setError(null)
        return
      }
      await refresh()
      return
    }
    if (result.status === 'deleted') {
      clearAdminOperatorUserDetail(result.userId)
      router.replace('/admin?tab=users')
      return
    }
    patchAdminOperatorUserDetailStatus(result.userId, result.status)
    setDetail((current) => current ? { ...current, user: { ...current.user, status: result.status } } : current)
    setError(null)
  }

  if (!canReachApi) return <Notice body="Admin API is not configured for this environment." title="Admin API unavailable" />
  if (!canAccess) return <Notice body={seedAccess?.error ?? 'This account does not currently have admin access.'} title="Admin access required" />

  return (
    <div className="product-page management-page admin-operator-detail-page">
      <section className="product-page-header admin-user-detail-header">
        <div>
          <p className="product-kicker">Admin</p>
          <h1 className="product-page-title">{detail?.user.displayName || detail?.user.email || userId}</h1>
        </div>
        <div className="admin-user-detail-actions">
          <Link className="product-button product-button-secondary" href="/admin?tab=users">
            Back to users
          </Link>
          <button className="product-button product-button-secondary" onClick={refresh} type="button">
            Refresh
          </button>
        </div>
      </section>

      {error ? <section className="management-notice admin-operator-warning"><div><h2>Data warning</h2><p>{error}</p></div></section> : null}

      <div className="management-segmented management-console-tabs admin-user-detail-tabs" role="tablist" aria-label="User detail panels">
        {detailTabs.map((tab) => (
          <button
            aria-selected={activeTab === tab.id}
            className={activeTab === tab.id ? 'is-active' : undefined}
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            role="tab"
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="management-tab-panels">
        <DetailPanel active={activeTab === 'billing'}>
          <AdminOperatorBillingPanel detail={detail} onAction={setActiveAction} status={detailStatus} />
        </DetailPanel>
        <DetailPanel active={activeTab === 'team-plan'}>
          <AdminOperatorTeamPlanPanel onAction={setActiveAction} teams={detail?.ownedTeams ?? []} userId={userId} />
        </DetailPanel>
        <DetailPanel active={activeTab === 'joined-team'}>
          <AdminOperatorJoinedWorkspacePanel
            excludedWorkspaceIds={[
              ...(detail?.joinedTeams ?? []).map((workspace) => workspace.id),
              ...(detail?.ownedTeams ?? []).map((workspace) => workspace.id),
            ]}
            kind="team"
            onAction={setActiveAction}
            rows={detail?.joinedTeams ?? []}
            title="Joined Team"
            userId={userId}
          />
        </DetailPanel>
        <DetailPanel active={activeTab === 'group-plan'}>
          <AdminOperatorGroupPlanPanel detail={detail} onAction={setActiveAction} userId={userId} />
        </DetailPanel>
        <DetailPanel active={activeTab === 'joined-group'}>
          <AdminOperatorJoinedWorkspacePanel
            excludedWorkspaceIds={[
              ...(detail?.joinedGroups ?? []).map((workspace) => workspace.id),
              ...(detail?.ownedGroups ?? []).map((workspace) => workspace.id),
            ]}
            kind="group"
            onAction={setActiveAction}
            rows={detail?.joinedGroups ?? []}
            title="Joined Group"
            userId={userId}
          />
        </DetailPanel>
      </div>

      {activeAction ? (
        <AdminOperatorActionModal
          action={activeAction}
          enabled={canReachApi}
          key={getAdminOperatorActionKey(activeAction)}
          onClose={() => setActiveAction(null)}
          onDone={(result) => handleActionDone(activeAction, result)}
        />
      ) : null}
    </div>
  )
}

function DetailPanel({ active, children }: { active: boolean; children: ReactNode }) {
  return <section hidden={!active}>{children}</section>
}

function Notice({ body, title }: { body: string; title: string }) {
  return <section className="management-notice"><div><h2>{title}</h2><p>{body}</p></div><Link className="product-button product-button-secondary" href="/admin">Back to admin</Link></section>
}
