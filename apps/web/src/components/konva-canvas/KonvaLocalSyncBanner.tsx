import type { KonvaLocalYjsSyncController } from './useKonvaLocalYjsSync'

type KonvaLocalSyncBannerProps = {
  localSync: KonvaLocalYjsSyncController
}

export function KonvaLocalSyncBanner({ localSync }: KonvaLocalSyncBannerProps) {
  if (!localSync.hasPendingRemoteSnapshot) return null
  const remoteTime = formatSyncTime(localSync.lastRemotePublishedAt)
  return (
    <div className="konva-local-sync-banner" role="status">
      <div className="konva-local-sync-banner__content">
        <strong>Another session updated this board.</strong>
        <small>
          {remoteTime
            ? `Remote changes arrived at ${remoteTime} while your local edits were still pending.`
            : 'Remote changes arrived while your local edits were still pending.'}
        </small>
      </div>
      <div className="konva-local-sync-banner__actions">
        <button className="konva-local-sync-banner__action" onClick={localSync.applyPendingRemoteSnapshot} type="button">
          Load remote
        </button>
        <button className="konva-local-sync-banner__action is-primary" onClick={localSync.publishLocalSnapshot} type="button">
          Keep current
        </button>
      </div>
    </div>
  )
}

function formatSyncTime(value: string | null) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}
