import type { ChargeScope, CreditLedgerEntryRecord, WorkspaceKind } from './billingTypes'

export function BillingLedgerTable({
  emptyMessage,
  entries,
}: {
  emptyMessage: string
  entries: CreditLedgerEntryRecord[]
}) {
  if (entries.length === 0) return <p>{emptyMessage}</p>

  return (
    <div className="management-table-wrap">
      <table className="management-table">
        <thead>
          <tr>
            <th>When</th>
            <th>Reason</th>
            <th>Source</th>
            <th>Actor</th>
            <th>Credits</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => {
            const isDebit = entry.creditsDelta < 0
          return (
              <tr key={entry.id}>
                <td>{formatDate(entry.createdAt)}</td>
                <td>
                  <span className="management-table-cell-stack">
                    <strong>{formatLedgerReason(entry.reason)}</strong>
                    <small>{entry.workspaceId ?? 'No workspace scope'}</small>
                  </span>
                </td>
                <td>
                  <span className="management-table-cell-stack">
                    <strong>{entry.sourceType}</strong>
                    <small>{entry.sourceId ?? 'Manual'}</small>
                  </span>
                </td>
                <td>{entry.actorUserId ?? 'System'}</td>
                <td style={{ color: isDebit ? 'var(--color-signature-coral)' : 'var(--color-success)', fontWeight: 700 }}>
                  {isDebit ? '' : '+'}
                  {formatCredits(entry.creditsDelta)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export function describeChargeScope(scope: ChargeScope) {
  if (scope === 'workspace_pool') return 'Workspace pooled credits'
  return 'Personal credits'
}

export function describeWorkspaceKind(value: WorkspaceKind) {
  if (value === 'team_workspace') return 'Team workspace'
  if (value === 'group_workspace') return 'Group workspace'
  if (value === 'enterprise_workspace') return 'Enterprise workspace'
  return 'Solo workspace'
}

export function formatCredits(value: number) {
  const normalized = Math.abs(value % 1) > 0.001
    ? new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 })
    : new Intl.NumberFormat('en-US')
  return normalized.format(value)
}

export function formatDate(value?: null | string) {
  if (!value) return '—'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleString('en-US', {
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
  })
}

export function formatLabel(value: string) {
  return value.replace(/_/g, ' ')
}

export function formatPrice(value?: null | number) {
  if (value === null || value === undefined) return 'Custom'
  if (value === 0) return '$0'
  return `$${value}/month`
}

function formatLedgerReason(value: string) {
  if (value === 'subscription_grant') return 'Subscription grant'
  if (value === 'topup_purchase') return 'Top-up purchase'
  if (value === 'usage_charge') return 'Usage charge'
  if (value === 'usage_refund') return 'Usage refund'
  if (value === 'admin_adjustment') return 'Admin adjustment'
  if (value === 'seat_change_adjustment') return 'Seat change'
  if (value === 'plan_change_adjustment') return 'Plan change'
  return formatLabel(value)
}
