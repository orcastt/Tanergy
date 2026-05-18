'use client'

import { useState } from 'react'
import {
  getCollaboratePlanOptions,
  getTeamPlanOptions,
  NumberInput,
  PlanScheduleFields,
  StrictSelect,
  TeamMonthlyScheduleFields,
  TextInput,
  Toggle,
  toFloat,
  toInt,
} from './AdminFinanceFields'
import {
  adminManualAdjustUserCredits,
  adminManualCreateGroupWorkspace,
  adminManualCreateTeamWorkspace,
  adminManualSetCollaboratePlan,
  adminManualTopupUser,
} from './adminFinanceClient'
import { adminManualOperateGroupPlan } from './adminFinancePlanOperationsClient'
import { formatDate, formatNumber } from './adminAiShared'
import type { AdminDirectoryUserRecord } from './adminTypes'

export function AdminUserFinanceActions({
  enabled,
  onMutated,
  title = 'User billing actions',
  user,
  userId,
}: {
  enabled: boolean
  onMutated: () => void
  title?: string
  user?: AdminDirectoryUserRecord | null
  userId: string
}) {
  const [collaborateGrantIncluded, setCollaborateGrantIncluded] = useState(true)
  const [collaborateDurationCount, setCollaborateDurationCount] = useState('1')
  const [collaborateEffectMode, setCollaborateEffectMode] = useState('immediate')
  const [collaboratePlanKey, setCollaboratePlanKey] = useState('collaborate_start')
  const [groupWorkspaceName, setGroupWorkspaceName] = useState('')
  const [note, setNote] = useState('')
  const [running, setRunning] = useState(false)
  const [status, setStatus] = useState('ready')
  const [teamGrantIncluded, setTeamGrantIncluded] = useState(true)
  const [teamDurationCount, setTeamDurationCount] = useState('1')
  const [teamEffectMode, setTeamEffectMode] = useState('immediate')
  const [teamExtraCredits, setTeamExtraCredits] = useState('0')
  const [teamPlanKey, setTeamPlanKey] = useState('team_start')
  const [teamSeats, setTeamSeats] = useState('2')
  const [teamWorkspaceName, setTeamWorkspaceName] = useState('')
  const [topupCredits, setTopupCredits] = useState('100')
  const hasReason = Boolean(note.trim())

  async function run(label: string, action: () => Promise<{ message: string }>) {
    if (!enabled || running || !userId) return
    setRunning(true)
    setStatus(`${label}...`)
    try {
      const result = await action()
      setStatus(result.message || `${label} done.`)
      onMutated()
    } catch (error) {
      setStatus(error instanceof Error ? error.message : `${label} failed.`)
    } finally {
      setRunning(false)
    }
  }

  return (
    <article className="management-panel">
      <div className="management-panel-heading compact">
        <div><h3>{title}</h3></div>
        <span className="management-status">{status}</span>
      </div>

      <div className="management-mini-stat-grid">
        <Stat label="Wallet credits" value={user ? formatNumber(user.personalWalletCredits) : '-'} />
        <Stat label="Total spent" value={user ? formatNumber(user.totalCreditsSpent) : '-'} />
        <Stat label="Group plan" value={formatCurrentPlan(user?.collaboratePlanKey, user?.collaboratePlanStatus, user?.collaboratePeriodEnd)} />
      </div>

      <TextInput label="Operation reason" onChange={setNote} placeholder="manual correction / support request / plan migration" value={note} />

      <div className="manual-finance-grid admin-detail-finance-grid">
        <section className="manual-finance-block">
          <h3>User wallet</h3>
          <NumberInput label="Credits" onChange={setTopupCredits} value={topupCredits} />
          <div className="management-actions is-start">
            <button
              className="product-button"
              disabled={!enabled || running || !userId || !hasReason}
              onClick={() => run('Top up user', () => adminManualTopupUser({
                credits: toFloat(topupCredits),
                note,
                userId,
              }))}
              type="button"
            >
              Top up credits
            </button>
            <button
              className="product-button product-button-secondary"
              disabled={!enabled || running || !userId || !hasReason}
              onClick={() => run('Deduct user credits', () => adminManualAdjustUserCredits({
                creditsDelta: -toFloat(topupCredits),
                note,
                userId,
              }))}
              type="button"
            >
              Deduct credits
            </button>
          </div>
        </section>

        <section className="manual-finance-block">
          <h3>Group plan</h3>
          <StrictSelect label="Plan" onChange={setCollaboratePlanKey} options={getCollaboratePlanOptions()} value={collaboratePlanKey} />
          <div className="management-field-grid two">
            <PlanScheduleFields
              durationCount={collaborateDurationCount}
              effectMode={collaborateEffectMode}
              onDurationCountChange={setCollaborateDurationCount}
              onEffectModeChange={setCollaborateEffectMode}
            />
          </div>
          <Toggle checked={collaborateGrantIncluded} label="Grant included credits" onChange={setCollaborateGrantIncluded} />
          <div className="management-actions is-start">
            <button
              className="product-button product-button-secondary"
              disabled={!enabled || running || !userId || !hasReason}
              onClick={() => run('Assign group plan', () => adminManualSetCollaboratePlan({
                durationCount: toInt(collaborateDurationCount),
                durationUnitDays: 30,
                effectMode: collaborateEffectMode,
                grantIncludedCredits: collaborateGrantIncluded,
                note,
                planKey: collaboratePlanKey,
                userId,
              }))}
              type="button"
            >
              Assign Group plan
            </button>
            <button
              className="product-button product-button-secondary"
              disabled={!enabled || running || !user?.collaborateSubscriptionId || !hasReason}
              onClick={() => run('Delete group plan', () => adminManualOperateGroupPlan({
                action: 'delete',
                note,
                subscriptionId: user?.collaborateSubscriptionId ?? undefined,
                userId,
              }))}
              type="button"
            >
              Delete plan
            </button>
          </div>
        </section>

        <section className="manual-finance-block">
          <h3>Create Group</h3>
          <TextInput label="Workspace name" onChange={setGroupWorkspaceName} placeholder="New group workspace" value={groupWorkspaceName} />
          <button
            className="product-button"
            disabled={!enabled || running || !userId || !groupWorkspaceName.trim() || !hasReason}
            onClick={() => run('Create group workspace', () => adminManualCreateGroupWorkspace({
              note,
              userId,
              workspaceName: groupWorkspaceName,
            }))}
            type="button"
          >
            Create Group workspace
          </button>
        </section>

        <section className="manual-finance-block">
          <h3>Create Team</h3>
          <TextInput label="Workspace name" onChange={setTeamWorkspaceName} placeholder="New team workspace" value={teamWorkspaceName} />
          <StrictSelect label="Plan" onChange={setTeamPlanKey} options={getTeamPlanOptions()} value={teamPlanKey} />
          <NumberInput label="Seats" onChange={setTeamSeats} value={teamSeats} />
          <NumberInput label="Extra credits" onChange={setTeamExtraCredits} value={teamExtraCredits} />
          <div className="management-field-grid two">
            <TeamMonthlyScheduleFields
              durationCount={teamDurationCount}
              effectMode={teamEffectMode}
              onDurationCountChange={setTeamDurationCount}
              onEffectModeChange={setTeamEffectMode}
            />
          </div>
          <Toggle checked={teamGrantIncluded} label="Grant included credits" onChange={setTeamGrantIncluded} />
          <button
            className="product-button product-button-secondary"
            disabled={!enabled || running || !userId || !teamWorkspaceName.trim() || !hasReason}
            onClick={() => run('Create team workspace', () => adminManualCreateTeamWorkspace({
              durationCount: toInt(teamDurationCount),
              durationUnitDays: 30,
              effectMode: teamEffectMode,
              extraCredits: toFloat(teamExtraCredits),
              grantIncludedCredits: teamGrantIncluded,
              note,
              planKey: teamPlanKey,
              seatCapacity: toInt(teamSeats),
              userId,
              workspaceName: teamWorkspaceName,
            }))}
            type="button"
          >
            Create Team workspace
          </button>
        </section>
      </div>
    </article>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="management-mini-stat"><span>{label}</span><strong>{value}</strong></div>
}

function formatCurrentPlan(planKey?: null | string, status?: null | string, periodEnd?: null | string) {
  if (!planKey) return 'None'
  return periodEnd ? `${planKey} until ${formatDate(periodEnd)}` : `${planKey} (${status ?? 'unknown'})`
}
