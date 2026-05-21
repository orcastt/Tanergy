export type AdminFinanceCountRecord = { amountCents: number; count: number; key: string }
export type AdminFinanceAccountCountRecord = { accountKind: string; count: number; ownerType: string; status: string }
export type AdminFinanceSubscriptionCountRecord = { count: number; planFamily: string; seatCapacity: number; status: string }
export type AdminFinanceLedgerTotals = { balanceCredits: number; grantedCredits: number; spentCredits: number }

export type AdminFinanceSummaryRecord = {
  accountCounts: AdminFinanceAccountCountRecord[]
  ledgerTotals: AdminFinanceLedgerTotals
  paymentKindCounts: AdminFinanceCountRecord[]
  paymentProviderCounts: AdminFinanceCountRecord[]
  paymentStatusCounts: AdminFinanceCountRecord[]
  subscriptionCounts: AdminFinanceSubscriptionCountRecord[]
}

export type AdminFinancePaymentRecord = {
  accountId?: null | string
  accountKind?: null | string
  amountCents: number
  checkoutSessionId?: null | string
  createdAt: string
  currency: string
  id: string
  kind: string
  metadata: Record<string, unknown>
  ownerId?: null | string
  ownerType?: null | string
  provider: string
  providerPaymentId?: null | string
  status: string
}

export type AdminFinanceWalletRecord = {
  accountId: string
  accountKind: string
  balanceCredits: number
  createdAt: string
  ownerId: string
  ownerType: string
  status: string
  updatedAt: string
}

export type AdminFinanceLedgerRecord = {
  accountId: string
  accountKind?: null | string
  actorUserId?: null | string
  createdAt: string
  creditsDelta: number
  id: string
  metadata: Record<string, unknown>
  ownerId?: null | string
  ownerType?: null | string
  reason: string
  sourceId?: null | string
  sourceType: string
  workspaceId?: null | string
}

export type AdminFinanceSubscriptionRecord = {
  accountId: string
  createdAt: string
  currentPeriodEnd?: null | string
  currentPeriodStart?: null | string
  id: string
  ownerId: string
  ownerType: string
  planFamily: string
  planKey: string
  provider: string
  providerCustomerId?: null | string
  providerSubscriptionId?: null | string
  seatCapacity: number
  status: string
  updatedAt: string
  workspaceId?: null | string
}

export type AdminFinanceMemberUsageRecord = {
  chargeCount: number
  displayName: string
  email?: null | string
  lastUsageAt?: null | string
  role: string
  usageCredits: number
  userId: string
  workspaceId: string
}

export type AdminFinanceSummaryResource = { error?: string; ok: boolean; summary?: AdminFinanceSummaryRecord }
export type AdminFinancePaymentsResource = { error?: string; ok: boolean; payments: AdminFinancePaymentRecord[] }
export type AdminFinanceWalletsResource = { error?: string; ok: boolean; wallets: AdminFinanceWalletRecord[] }
export type AdminFinanceLedgerResource = { error?: string; ledger: AdminFinanceLedgerRecord[]; ok: boolean }
export type AdminFinanceSubscriptionsResource = { error?: string; ok: boolean; subscriptions: AdminFinanceSubscriptionRecord[] }
export type AdminFinanceMemberUsageResource = { error?: string; memberUsage: AdminFinanceMemberUsageRecord[]; ok: boolean }

export type AdminFinanceManualMutationResource = {
  accountId?: null | string
  auditId?: null | string
  balanceCredits?: null | number
  ledgerEntryId?: null | string
  message: string
  ok: boolean
  paymentId?: null | string
  subscriptionId?: null | string
  workspaceId?: null | string
}

export type AdminPlanCatalogRecord = {
  annualPriceUsd?: null | number
  billingPeriod: string
  boardLimit?: null | number
  createdAt?: null | string
  groupMemberLimit?: null | number
  groupWorkspaceLimit?: null | number
  includedCredits: number
  metadata: Record<string, unknown>
  monthlyPriceUsd?: null | number
  name: string
  pageLimit?: null | number
  planFamily: string
  planKey: string
  registrationCredits: number
  seatMax?: null | number
  seatMin?: null | number
  seatRange?: null | string
  updatedAt?: null | string
}

export type AdminPlanCatalogResource = {
  error?: string
  ok: boolean
  plans: AdminPlanCatalogRecord[]
}

export type AdminPlanCatalogUpdateInput = Partial<Pick<
  AdminPlanCatalogRecord,
  'annualPriceUsd' | 'billingPeriod' | 'boardLimit' | 'groupMemberLimit' | 'groupWorkspaceLimit' | 'includedCredits' | 'metadata' | 'monthlyPriceUsd' | 'name' | 'pageLimit' | 'registrationCredits' | 'seatMax' | 'seatMin' | 'seatRange'
>>

export type AdminPlanCatalogMutationResource = {
  auditId?: null | string
  ok: boolean
  plan: AdminPlanCatalogRecord
}

export type AdminFinanceQuery = {
  accountId?: string
  accountKind?: string
  actorUserId?: string
  kind?: string
  limit?: number
  ownerId?: string
  ownerType?: string
  planFamily?: string
  provider?: string
  reason?: string
  status?: string
  userId?: string
  workspaceId?: string
}

export type AdminManualUserTopupInput = {
  amountCents?: number
  credits: number
  currency?: string
  note: string
  userId: string
}

export type AdminManualCreditAdjustmentInput = {
  creditsDelta: number
  note: string
  userId?: string
  workspaceId?: string
}

export type AdminManualWorkspaceTopupInput = {
  amountCents?: number
  credits: number
  currency?: string
  note: string
  workspaceId: string
}

export type AdminManualCollaboratePlanInput = {
  durationCount?: number
  durationUnitDays?: number
  effectMode?: string
  grantIncludedCredits?: boolean
  note: string
  periodEnd?: string
  planKey: string
  status?: string
  userId: string
}

export type AdminManualTeamPlanInput = {
  durationCount?: number
  durationUnitDays?: number
  effectMode?: string
  grantIncludedCredits?: boolean
  note: string
  periodEnd?: string
  planKey: string
  seatCapacity: number
  status?: string
  workspaceId: string
}

export type AdminManualCreateGroupWorkspaceInput = {
  note: string
  userId: string
  workspaceName: string
}

export type AdminManualCreateTeamWorkspaceInput = {
  durationCount?: number
  durationUnitDays?: number
  effectMode?: string
  extraCredits?: number
  grantIncludedCredits?: boolean
  note: string
  periodEnd?: string
  planKey: string
  seatCapacity: number
  status?: string
  userId: string
  workspaceName: string
}
