import type { BoardPersistenceSummary } from '@/features/boards/boardTypes'

type BoardManagementMembersProps = {
  board: BoardPersistenceSummary
}

const seedMembers = [
  { access: 'All boards', email: 'chuheng.tan.21@ucl.ac.uk', name: 'Chuheng Tan', nickname: 'Chuheng', role: 'Owner' },
  { access: 'This board', email: 'yingdongqi@yahoo.com', name: 'MKWM', nickname: 'MKWM', role: 'Editor' },
  { access: 'This board', email: 'orcas0t@gmail.com', name: 'orcasst genus', nickname: 'Orca', role: 'Team Admin' },
]

export function BoardManagementMembers({ board }: BoardManagementMembersProps) {
  const members = getBoardMembers(board.id)

  return (
    <section className="board-panel-section">
      <div className="board-panel-section-heading">
        <div>
          <h3>Members</h3>
          <p>Board-level access scaffold for the collaboration slice.</p>
        </div>
        <button disabled title="Real invitations wait for Auth and team roles." type="button">
          Invite people
        </button>
      </div>
      <div className="board-panel-members" role="table" aria-label="Board members">
        {members.map((member) => (
          <div className="board-panel-member" key={member.email} role="row">
            <span className="board-panel-avatar">{getInitials(member.name)}</span>
            <div>
              <strong>{member.name}</strong>
              <span>{member.nickname} · {member.email}</span>
            </div>
            <small>{member.role}</small>
            <small>{member.access}</small>
            <button disabled title="Role editing waits for real team membership." type="button">
              Manage
            </button>
          </div>
        ))}
      </div>
    </section>
  )
}

function getBoardMembers(seed: string) {
  const offset = getStableIndex(seed, seedMembers.length)
  return seedMembers.map((_, index) => seedMembers[(index + offset) % seedMembers.length])
}

function getInitials(name: string) {
  return name.split(/\s+/).map((part) => part[0]?.toUpperCase()).slice(0, 2).join('')
}

function getStableIndex(value: string, modulo: number) {
  let hash = 0
  for (const char of value) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return hash % modulo
}
