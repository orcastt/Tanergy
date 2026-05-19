'use client'

export type CreditUsageMetrics = {
  percent: number
  total: number
  used: number
}

export function resolveCreditUsageMetrics(remaining: number, total: number): CreditUsageMetrics {
  const safeTotal = Number.isFinite(total) && total > 0 ? total : 0
  const safeRemaining = Number.isFinite(remaining) ? remaining : 0
  const used = Math.max(0, Math.min(safeTotal, safeTotal - safeRemaining))
  const percent = safeTotal > 0 ? Math.max(0, Math.min(100, Math.round((used / safeTotal) * 100))) : 0
  return { percent, total: safeTotal, used }
}

export type CreditWalletMetrics = {
  remainingCredits: number
  totalCredits: number
  usedCredits: number
}

export function resolveCreditWalletMetrics(credits: {
  includedRemaining: number
  includedTotal: number
  topUpBalance: number
  usedThisCycle: number
}): CreditWalletMetrics {
  const remainingCredits = Math.max(0, credits.includedRemaining + credits.topUpBalance)
  const plannedTotal = Math.max(0, credits.includedTotal + credits.topUpBalance)
  const usedCredits = Math.max(0, credits.usedThisCycle)
  return {
    remainingCredits,
    totalCredits: Math.max(plannedTotal, remainingCredits + usedCredits),
    usedCredits,
  }
}
