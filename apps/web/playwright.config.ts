import { defineConfig } from '@playwright/test'

const port = Number(process.env.PLAYWRIGHT_WEB_PORT ?? 3100)
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${port}`

export default defineConfig({
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  projects: [
    {
      name: 'chromium-desktop',
      use: {
        browserName: 'chromium',
        viewport: { height: 900, width: 1440 },
      },
    },
    {
      name: 'firefox-desktop',
      use: {
        browserName: 'firefox',
        viewport: { height: 900, width: 1440 },
      },
    },
    {
      name: 'webkit-desktop',
      use: {
        browserName: 'webkit',
        viewport: { height: 900, width: 1440 },
      },
    },
    {
      name: 'chromium-mobile',
      use: {
        browserName: 'chromium',
        hasTouch: true,
        isMobile: true,
        viewport: { height: 844, width: 390 },
      },
    },
  ],
  reporter: process.env.CI ? [['dot'], ['html', { open: 'never' }]] : 'list',
  testDir: './e2e',
  timeout: 45_000,
  use: {
    baseURL,
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `npm run start -- --hostname 127.0.0.1 --port ${port}`,
    env: {
      ...process.env,
      CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY ?? 'sk_test_playwright',
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:
        process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
        ?? 'pk_test_cGxheXdyaWdodC5jbGVyay5hY2NvdW50cy5kZXYk',
    },
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    url: baseURL,
  },
})
