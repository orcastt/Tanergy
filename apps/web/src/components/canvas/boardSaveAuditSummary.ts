import type { RuntimeAssetMigrationResult } from '@/features/assets/runtimeAssetMigration'
import type { LocalBoardSaveResponse } from '@/features/boards/localBoardClient'
import type { BoardDocumentSerializationResult } from '@/features/boards/boardDocumentSerializer'
import type { BoardAction } from './boardSaveStatus'

type BoardSaveAuditSummaryInput = {
  lastAction: BoardAction | null
  migration: RuntimeAssetMigrationResult | null
  mode: 'board' | 'dev'
  result: BoardDocumentSerializationResult | null
  saveError: string | null
  saveResult: LocalBoardSaveResponse | null
}

export function getBoardSaveAuditSummary({
  lastAction,
  migration,
  mode,
  result,
  saveError,
  saveResult,
}: BoardSaveAuditSummaryInput) {
  const issue = result?.audit.issues.find((item) => item.blocking)
  const auditStatus = !result
    ? 'Not checked'
    : saveResult?.board
      ? `${lastAction === 'load' ? 'Loaded' : 'Saved'} ${saveResult.board.byteSize} bytes`
      : result.audit.ok
        ? `${result.audit.byteSize} bytes`
        : issue?.code ?? 'Blocked'
  const detail = saveError ?? (migration?.migrated ? `${migration.migrated} asset(s) migrated` : issue?.path)

  return {
    auditStatus,
    detail,
    issue,
    loadLabel: mode === 'board' ? 'Load board' : 'Load local',
    saveLabel: mode === 'board' ? 'Save board' : 'Save local',
  }
}
