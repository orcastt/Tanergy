export type BillingPaymentRecord = {
  accountId?: null | string
  amountCents: number
  checkoutSessionId?: null | string
  createdAt: string
  currency: string
  id: string
  kind: string
  metadata: Record<string, unknown>
  provider: string
  providerPaymentId?: null | string
  status: string
}

export type BillingCheckoutSessionRecord = {
  adapter: string
  amountCents: number
  clientReferenceId: string
  currency: string
  id: string
  kind: string
  metadata: Record<string, unknown>
  mode: string
  provider: string
  url?: null | string
}

export type BillingPaymentsResponse = {
  error?: string
  ok: boolean
  payments: BillingPaymentRecord[]
}

export type BillingPaymentMutationResponse = {
  checkout?: BillingCheckoutSessionRecord
  error?: string
  ok: boolean
  payment?: BillingPaymentRecord
  topupEntryId?: null | string
}

export type BillingPaymentQuery = {
  kind?: null | string
  limit?: number
  status?: null | string
  workspaceScoped?: boolean
}
