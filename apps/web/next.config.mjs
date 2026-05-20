import { withSentryConfig } from '@sentry/nextjs'

/** @type {import('next').NextConfig} */
// Temporary cross-platform test helper:
// set NEXT_ALLOWED_DEV_ORIGINS for Cloudflare Tunnel + next dev.
// Remove this before treating the tunnel workflow as a production path.
const allowedDevOrigins = (process.env.NEXT_ALLOWED_DEV_ORIGINS ?? '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)

const securityHeaders = [
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  {
    key: 'X-Frame-Options',
    value: 'DENY',
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=()',
  },
  {
    key: 'Content-Security-Policy',
    value: buildContentSecurityPolicy(),
  },
]

if (process.env.NODE_ENV === 'production') {
  securityHeaders.push({
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  })
}

const nextConfig = {
  allowedDevOrigins: Array.from(new Set(['127.0.0.1', ...allowedDevOrigins])),
  async headers() {
    return [
      {
        headers: securityHeaders,
        source: '/:path*',
      },
      {
        headers: [
          {
            key: 'X-Robots-Tag',
            value: 'noindex, nofollow',
          },
        ],
        source: '/share/:shareId',
      },
    ]
  },
  reactStrictMode: true,
}

const sentryBuildPluginEnabled = Boolean(
  process.env.SENTRY_AUTH_TOKEN && process.env.SENTRY_ORG && process.env.SENTRY_PROJECT,
)

export default sentryBuildPluginEnabled
  ? withSentryConfig(nextConfig, {
    authToken: process.env.SENTRY_AUTH_TOKEN,
    org: process.env.SENTRY_ORG,
    project: process.env.SENTRY_PROJECT,
    silent: true,
    widenClientFileUpload: true,
  })
  : nextConfig

function buildContentSecurityPolicy() {
  const apiOrigin = getOptionalOrigin(process.env.NEXT_PUBLIC_API_BASE_URL)
  const appOrigin = getOptionalOrigin(process.env.NEXT_PUBLIC_APP_URL)
  const assetOrigin = getOptionalOrigin(process.env.NEXT_PUBLIC_ASSET_BASE_URL)
  const connectSrc = [
    "'self'",
    'https:',
    'wss:',
    'ws:',
    apiOrigin,
    appOrigin,
  ].filter(Boolean)
  const imgSrc = ["'self'", 'blob:', 'data:', 'https:', apiOrigin, assetOrigin].filter(Boolean)
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "frame-src 'self' https://*.clerk.accounts.dev https://*.clerk.com https://challenges.cloudflare.com",
    "form-action 'self'",
    `img-src ${unique(imgSrc).join(' ')}`,
    "font-src 'self' data:",
    "style-src 'self' 'unsafe-inline'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.clerk.accounts.dev https://*.clerk.com https://challenges.cloudflare.com",
    `connect-src ${unique(connectSrc).join(' ')}`,
    "worker-src 'self' blob:",
    "media-src 'self' blob: data: https:",
  ].join('; ')
}

function getOptionalOrigin(value) {
  if (!value?.trim()) return null
  try {
    const parsed = new URL(value)
    return ['http:', 'https:'].includes(parsed.protocol) ? parsed.origin : null
  } catch {
    return null
  }
}

function unique(values) {
  return Array.from(new Set(values))
}
