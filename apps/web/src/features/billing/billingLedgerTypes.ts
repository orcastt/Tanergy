export type CreditLedgerEntryRecord = {
  accountId: string
  actorUserId?: null | string
  createdAt: string
  creditsDelta: number
  id: string
  metadata: Record<string, unknown>
  reason: string
  sourceId?: null | string
  sourceType: string
  workspaceId?: null | string
}

export type CreditLedgerResponse = {
  accountId: string
  balanceCredits: number
  entries: CreditLedgerEntryRecord[]
  error?: string
  ok: boolean
}

export type CreditLedgerMutationResponse = {
  accountId: string
  balanceCredits: number
  entry: CreditLedgerEntryRecord
  error?: string
  ok: boolean
}

export type CreditLedgerQuery = {
  actorUserId?: null | string
  limit?: number
  reason?: null | string
  sourceId?: null | string
  sourceType?: null | string
  workspaceId?: null | string
}

export type CreditTopupInput = {
  credits: number
  metadata?: Record<string, unknown>
  sourceId?: null | string
}
