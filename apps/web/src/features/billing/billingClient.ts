'use client'

import {
  hasRemotePersistenceApi,
  persistenceApiUrl,
  persistenceAuthHeadersAsync,
} from '@/features/api/persistenceApi'
import { getCurrentSessionSnapshot } from '@/features/auth/mockSession'
import type {
  BillingMeResponse,
  WorkspaceDashboardResponse,
} from './billingTypes'
import { createLocalBillingMe, createLocalWorkspaceDashboard } from './billingContracts'

export async function loadBillingMe(): Promise<BillingMeResponse> {
  if (!hasRemotePersistenceApi()) return createLocalBillingMe(getCurrentSessionSnapshot())
  return loadJson<BillingMeResponse>('/api/v1/billing/me')
}

export async function loadWorkspaceDashboard(): Promise<WorkspaceDashboardResponse> {
  if (!hasRemotePersistenceApi()) return { dashboard: createLocalWorkspaceDashboard(getCurrentSessionSnapshot()), ok: true }
  return loadJson<WorkspaceDashboardResponse>('/api/v1/workspaces/current/dashboard')
}

async function loadJson<T>(path: string): Promise<T> {
  const headers = await persistenceAuthHeadersAsync()
  const response = await fetch(persistenceApiUrl(path), { headers })
  const payload = await response.json() as T & { error?: string }
  if (!response.ok) throw new Error(payload.error || 'Billing resource lookup failed.')
  return payload
}
