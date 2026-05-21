'use client'

import { useUser } from '@clerk/nextjs'
import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'

export function SentryUserContext() {
  const { isLoaded, user } = useUser()
  const userId = user?.id

  useEffect(() => {
    if (!isLoaded) return
    Sentry.setTag('auth.loaded', 'true')
    if (userId) {
      Sentry.setUser({ id: userId })
    } else {
      Sentry.setUser(null)
    }
  }, [isLoaded, userId])

  return null
}
