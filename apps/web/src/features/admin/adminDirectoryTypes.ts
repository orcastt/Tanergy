export type AdminDirectoryUserRecord = {
  collaboratePeriodEnd?: null | string
  collaboratePlanKey?: null | string
  collaboratePlanStatus?: null | string
  collaborateSubscriptionId?: null | string
  createdAt: string
  displayName: string
  email: string
  groupCount: number
  id: string
  lastLoginAt?: null | string
  locale: string
  ownedBoardCount: number
  personalCreditsSpent: number
  personalWalletCredits: number
  status: string
  teamCount: number
  teamCreditsSpent: number
  teamPeriodEnd?: null | string
  teamPlanKey?: null | string
  teamPlanStatus?: null | string
  teamSubscriptionId?: null | string
  totalCreditsSpent: number
}

export type AdminDirectoryWorkspaceRecord = {
  boardCount: number
  createdAt: string
  id: string
  kind: string
  memberCount: number
  name: string
  ownerCollaboratePlanKey?: null | string
  ownerCollaborateSubscriptionId?: null | string
  ownerDisplayName: string
  ownerEmail: string
  ownerId?: null | string
  planKey?: null | string
  planStatus?: null | string
  seatCapacity: number
  status: string
  subscriptionPeriodEnd?: null | string
  subscriptionId?: null | string
  usageCredits: number
  walletCredits: number
}

export type AdminDirectoryWorkspaceMemberRecord = {
  chargeCount: number
  displayName: string
  email?: null | string
  joinedAt?: null | string
  lastUsageAt?: null | string
  role: string
  usageCredits: number
  userId: string
}

export type AdminDirectoryBoardRecord = {
  id: string
  ownerId: string
  savedAt: string
  title: string
  visibility: string
}

export type AdminDirectoryUsersResource = {
  error?: string
  limit: number
  offset: number
  ok: boolean
  totalCount: number
  users: AdminDirectoryUserRecord[]
}

export type AdminDirectoryUserResource = { error?: string; ok: boolean; user?: AdminDirectoryUserRecord }

export type AdminDirectoryWorkspacesResource = {
  error?: string
  limit: number
  offset: number
  ok: boolean
  totalCount: number
  workspaces: AdminDirectoryWorkspaceRecord[]
}

export type AdminDirectoryWorkspaceDetailResource = {
  boards: AdminDirectoryBoardRecord[]
  error?: string
  members: AdminDirectoryWorkspaceMemberRecord[]
  ok: boolean
  workspace?: AdminDirectoryWorkspaceRecord
}
