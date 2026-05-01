import type { AiRunRecord } from '@/features/ai/aiTypes'

const runs = new Map<string, AiRunRecord>()

export function putLocalAiRun(run: AiRunRecord) {
  runs.set(run.runId, run)
}

export function getLocalAiRun(runId: string) {
  return runs.get(runId) ?? null
}
