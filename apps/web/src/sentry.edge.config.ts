import * as Sentry from '@sentry/nextjs'

import {
  getSentryEnvironment,
  getSentryRelease,
  parseSentrySampleRate,
  scrubSentryEvent,
} from './features/observability/sentryEventScrubber'

const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN

Sentry.init({
  beforeSend: scrubSentryEvent,
  dsn,
  enabled: Boolean(dsn),
  environment: getSentryEnvironment(),
  release: getSentryRelease(),
  sendDefaultPii: false,
  tracesSampleRate: parseSentrySampleRate(process.env.SENTRY_TRACES_SAMPLE_RATE, 0.05),
})
