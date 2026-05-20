import * as Sentry from '@sentry/nextjs'

import {
  getSentryEnvironment,
  getSentryRelease,
  parseSentrySampleRate,
  scrubSentryEvent,
} from './features/observability/sentryEventScrubber'

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN

Sentry.init({
  beforeSend: scrubSentryEvent,
  dsn,
  enabled: Boolean(dsn),
  environment: getSentryEnvironment(),
  release: getSentryRelease(),
  sendDefaultPii: false,
  tracesSampleRate: parseSentrySampleRate(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE, 0.05),
})

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
