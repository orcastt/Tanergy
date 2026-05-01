import Link from 'next/link'
import { AppShell } from '@/components/app-shell/AppShell'
import { getCurrentSessionSnapshot } from '@/features/auth/mockSession'

export default function TeamPage() {
  const session = getCurrentSessionSnapshot()

  return (
    <AppShell>
      <div className="product-page management-page">
        <section className="product-page-header">
          <p className="product-kicker">Team</p>
          <h1 className="product-page-title">Workspace membership is a placeholder boundary.</h1>
          <p className="product-section-copy">
            This page keeps team semantics separate from the Board gallery. Invites, roles,
            workspace switching and shared permissions wait for real Auth and database records.
          </p>
        </section>

        <section className="management-summary-grid" aria-label="Team summary">
          <article className="management-callout mint">
            <span>Current workspace</span>
            <h2>{session.activeWorkspace.name}</h2>
            <p>{session.activeWorkspace.role} access in local development.</p>
          </article>
          <article className="management-callout cream">
            <span>Members</span>
            <h2>1 mock user</h2>
            <p>Only the development user is shown until real invitations exist.</p>
          </article>
          <article className="management-callout">
            <span>Status</span>
            <h2>Coming soon</h2>
            <p>Team invites, role changes and audit logs are not wired yet.</p>
          </article>
        </section>

        <section className="management-panel management-panel-wide" aria-label="Team members">
          <div className="management-panel-heading">
            <div>
              <h2>Members</h2>
              <p>Readable table structure now, real team CRUD later.</p>
            </div>
            <button className="product-button product-button-secondary" disabled type="button">
              Invite unavailable
            </button>
          </div>
          <div className="management-table-wrap">
            <table className="management-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Source</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <span className="management-member">
                      <span className="management-avatar small" aria-hidden="true">{session.user.avatarInitials}</span>
                      <span>
                        <strong>{session.user.displayName}</strong>
                        <small>{session.user.email}</small>
                      </span>
                    </span>
                  </td>
                  <td><span className="management-badge">Owner</span></td>
                  <td><span className="management-status">Dev fallback</span></td>
                  <td>Mock session</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="management-notice">
          <div>
            <h2>Permission work is later P0.</h2>
            <p>
              The next real step is server-side Auth/session, then workspace-filtered Board
              and Asset access. Collaboration still remains P0.5.
            </p>
          </div>
          <Link className="product-button product-button-primary" href="/workspaces">Open boards</Link>
        </section>
      </div>
    </AppShell>
  )
}
