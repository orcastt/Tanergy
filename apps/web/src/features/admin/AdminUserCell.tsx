type AdminUserCellRecord = {
  displayName: string
  email: string
  id: string
}

export function AdminUserCell({ user }: { user: AdminUserCellRecord }) {
  return (
    <div className="management-member">
      <div className="management-avatar small" aria-hidden="true">{initials(user.displayName || user.email)}</div>
      <span>
        <strong>{user.displayName || 'Unnamed user'}</strong>
        <small>{user.email}</small>
        <small>{user.id}</small>
      </span>
    </div>
  )
}

function initials(value: string) {
  return value.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join('') || 'NA'
}
