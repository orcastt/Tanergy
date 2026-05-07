'use client'

import type { TangentWorkspace } from '@/features/auth/sessionTypes'
import { getAiRun } from './aiClient'
import type { AiRunRecord, AiRunStatus } from './aiTypes'

const terminalAiRunStatuses = new Set<AiRunStatus>(['canceled', 'failed', 'succeeded'])
const cancelableAiRunStatuses = new Set<AiRunStatus>(['queued', 'running'])

export function isAiRunTerminalStatus(status: AiRunStatus) {
  return terminalAiRunStatuses.has(status)
}

export function isAiRunCancelableStatus(status: AiRunStatus) {
  return cancelableAiRunStatuses.has(status)
}

export async function waitForAiRunCompletion(
  runId: string,
  options?: {
    pollIntervalMs?: number
    timeoutMs?: number
    workspace?: TangentWorkspace
  }
) {
  const pollIntervalMs = Math.max(150, options?.pollIntervalMs ?? 900)
  const timeoutMs = Math.max(pollIntervalMs, options?.timeoutMs ?? 120_000)
  const deadline = Date.now() + timeoutMs
  let current = await getAiRun(runId, { workspace: options?.workspace })

  while (!isAiRunTerminalStatus(current.status)) {
    if (Date.now() >= deadline) {
      throw new Error(`AI run ${runId} did not settle within ${Math.round(timeoutMs / 1000)}s.`)
    }
    await delay(pollIntervalMs)
    current = await getAiRun(runId, { workspace: options?.workspace })
  }

  return current
}

export function getAiRunTerminalError(run: AiRunRecord) {
  if (run.status === 'canceled') return new Error('AI run was canceled.')
  if (run.error?.trim()) return new Error(run.error.trim())
  return new Error(`AI run ended with status "${run.status}".`)
}

function delay(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms)
  })
}
