import type { AiRunRecord } from '@/features/ai/aiTypes'

const runs = new Map<string, AiRunRecord>()
const maxLocalAiRuns = 200
const localAiRunTtlMs = 6 * 60 * 60 * 1000

export function putLocalAiRun(run: AiRunRecord) {
  pruneLocalAiRuns()
  runs.delete(run.runId)
  runs.set(run.runId, run)
  while (runs.size > maxLocalAiRuns) {
    const oldestRunId = runs.keys().next().value
    if (!oldestRunId) break
    runs.delete(oldestRunId)
  }
}

export function getLocalAiRun(runId: string) {
  pruneLocalAiRuns()
  return runs.get(runId) ?? null
}

function pruneLocalAiRuns() {
  const cutoff = Date.now() - localAiRunTtlMs
  for (const [runId, run] of runs.entries()) {
    const createdAt = Date.parse(run.createdAt)
    if (!Number.isFinite(createdAt) || createdAt < cutoff) runs.delete(runId)
  }
}
