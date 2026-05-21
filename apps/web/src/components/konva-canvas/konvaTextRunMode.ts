import { hasRemotePersistenceApi } from '@/features/api/persistenceApi'

export function shouldUseRemoteTextRun() {
  return process.env.NEXT_PUBLIC_TANGENT_TEXT_STREAM_MODE === 'airun' && hasRemotePersistenceApi()
}
