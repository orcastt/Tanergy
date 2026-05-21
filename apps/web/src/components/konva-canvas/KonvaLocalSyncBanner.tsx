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
        <strong>Remote update</strong>
        {remoteTime ? <small>{remoteTime}</small> : null}
      </div>
      <div className="konva-local-sync-banner__actions">
        <button className="konva-local-sync-banner__action" onClick={localSync.applyPendingRemoteSnapshot} type="button">
          Use remote
        </button>
        <button className="konva-local-sync-banner__action is-primary" onClick={localSync.publishLocalSnapshot} type="button">
          Keep mine
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
