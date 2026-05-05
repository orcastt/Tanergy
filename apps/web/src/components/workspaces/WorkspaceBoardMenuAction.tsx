'use client'

type BoardMenuIconName =
  | 'copy'
  | 'delete'
  | 'external'
  | 'manage'
  | 'migrate'
  | 'pin'
  | 'private'
  | 'public'
  | 'rename'
  | 'share'
  | 'star'

type WorkspaceBoardMenuActionProps = {
  children: string
  disabled?: boolean
  icon: BoardMenuIconName
  tone?: 'danger' | 'default'
  onClick: () => void
}

export function WorkspaceBoardMenuAction({
  children,
  disabled = false,
  icon,
  onClick,
  tone = 'default',
}: WorkspaceBoardMenuActionProps) {
  return (
    <button className="workspace-board-menu-action" data-tone={tone} disabled={disabled} onClick={onClick} type="button">
      <BoardMenuIcon name={icon} />
      <span>{children}</span>
    </button>
  )
}

function BoardMenuIcon({ name }: { name: BoardMenuIconName }) {
  return (
    <svg aria-hidden className="workspace-board-menu-icon" viewBox="0 0 20 20">
      {name === 'share' ? (
        <>
          <path d="M6.4 10.8l7.2-7.2" />
          <path d="M9.4 3.4h4.4v4.4" />
          <path d="M8.7 5.8H5.1a1.7 1.7 0 00-1.7 1.7v7.4a1.7 1.7 0 001.7 1.7h7.4a1.7 1.7 0 001.7-1.7v-3.6" />
        </>
      ) : null}
      {name === 'external' ? (
        <>
          <path d="M7.2 4.2H4.9a1.7 1.7 0 00-1.7 1.7v9.2a1.7 1.7 0 001.7 1.7h9.2a1.7 1.7 0 001.7-1.7v-2.3" />
          <path d="M10.4 3.2h6.4v6.4" />
          <path d="M9.2 10.8l7.2-7.2" />
        </>
      ) : null}
      {name === 'star' ? <path d="M10 2.9l2.1 4.4 4.8.7-3.5 3.4.8 4.8-4.2-2.3-4.2 2.3.8-4.8L3.1 8l4.8-.7L10 2.9z" /> : null}
      {name === 'pin' ? (
        <>
          <path d="M7.7 3.4h4.6" />
          <path d="M8.4 3.8l-.6 5.1-2 2.1h8.4l-2-2.1-.6-5.1" />
          <path d="M10 11v5.7" />
        </>
      ) : null}
      {name === 'rename' ? (
        <>
          <path d="M4 14.7l3.2-.7 8-8a1.5 1.5 0 00-2.1-2.1l-8 8-.7 3.2z" />
          <path d="M11.9 5.1l3 3" />
        </>
      ) : null}
      {name === 'copy' ? (
        <>
          <rect x="6.6" y="3.2" width="9.2" height="9.2" rx="1.8" />
          <path d="M12.6 16.8H5.9a1.7 1.7 0 01-1.7-1.7V8.4" />
        </>
      ) : null}
      {name === 'manage' ? (
        <>
          <rect x="3.3" y="4.2" width="13.4" height="11.6" rx="2" />
          <path d="M3.3 7.7h13.4" />
          <path d="M7.4 11h5.2" />
          <path d="M7.4 13.5h3.2" />
        </>
      ) : null}
      {name === 'migrate' ? (
        <>
          <path d="M4.2 6.2h6.9" />
          <path d="M8.7 3.8l2.6 2.4-2.6 2.4" />
          <path d="M15.8 13.8H8.9" />
          <path d="M11.3 11.4l-2.6 2.4 2.6 2.4" />
          <rect x="3.4" y="3.4" width="4.5" height="4.5" rx="1" />
          <rect x="12.1" y="12.1" width="4.5" height="4.5" rx="1" />
        </>
      ) : null}
      {name === 'private' ? (
        <>
          <path d="M6 8V6.5a4 4 0 018 0V8" />
          <rect x="4.5" y="8" width="11" height="8.5" rx="1.8" />
        </>
      ) : null}
      {name === 'public' ? (
        <>
          <circle cx="10" cy="10" r="7" />
          <path d="M3.6 10h12.8" />
          <path d="M10 3.2c2 2 2 11.6 0 13.6" />
          <path d="M10 3.2c-2 2-2 11.6 0 13.6" />
        </>
      ) : null}
      {name === 'delete' ? (
        <>
          <path d="M4.2 5.8h11.6" />
          <path d="M8 5.8V4.2h4v1.6" />
          <path d="M6.2 7.8l.5 7.5a1.6 1.6 0 001.6 1.5h3.4a1.6 1.6 0 001.6-1.5l.5-7.5" />
          <path d="M8.8 9.7v4.4" />
          <path d="M11.2 9.7v4.4" />
        </>
      ) : null}
    </svg>
  )
}
