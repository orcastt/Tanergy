'use client'

import { useEffect, useMemo, useState } from 'react'
import type { TangentWorkspace } from '@/features/auth/sessionTypes'
import { loadBillingPlans } from '@/features/billing/billingReadClient'
import { planCatalog, resolvePlanKey } from '@/features/billing/billingContracts'
import type { PlanKey, WorkspacePlanSummary } from '@/features/billing/billingTypes'

export type KonvaCanvasPagePlan = {
  pageLimit: null | number
  planName?: string
}

export function useKonvaCanvasPagePlan(workspace?: TangentWorkspace): KonvaCanvasPagePlan {
  const [livePlans, setLivePlans] = useState<Partial<Record<PlanKey, WorkspacePlanSummary>>>(planCatalog)
  const workspaceId = workspace?.id ?? ''
  const workspaceKind = workspace?.kind
  const workspacePlanKey = workspace?.planKey

  useEffect(() => {
    let cancelled = false

    if (!workspaceId) {
      return () => {
        cancelled = true
      }
    }

    loadBillingPlans({ force: true })
      .then((response) => {
        if (cancelled) return
        setLivePlans(buildPlanLookup(response.plans))
      })
      .catch(() => {
        if (cancelled) return
        setLivePlans(planCatalog)
      })

    return () => {
      cancelled = true
    }
  }, [workspaceId, workspaceKind, workspacePlanKey])

  return useMemo(() => resolveCanvasPagePlan(workspace, livePlans), [livePlans, workspace])
}

function buildPlanLookup(plans: WorkspacePlanSummary[]) {
  const lookup: Partial<Record<PlanKey, WorkspacePlanSummary>> = {}
  for (const plan of plans) {
    lookup[plan.planKey] = plan
  }
  return lookup
}

function resolveCanvasPagePlan(
  workspace: TangentWorkspace | undefined,
  livePlans: Partial<Record<PlanKey, WorkspacePlanSummary>>,
): KonvaCanvasPagePlan {
  if (!workspace) return { pageLimit: null, planName: undefined }
  const planKey = resolvePlanKey(workspace.kind, workspace.planKey)
  const plan = livePlans[planKey] ?? planCatalog[planKey]
  const planPageLimit = plan.pageLimit ?? null
  return {
    pageLimit: Math.min(planPageLimit ?? 10, 10),
    planName: plan.name,
  }
}
