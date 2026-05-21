import { expect, test, type APIResponse } from '@playwright/test'

const publicPages = [
  { path: '/', text: 'Tanergy' },
  { path: '/pricing', text: 'Pricing' },
  { path: '/privacy', text: 'Privacy Policy' },
  { path: '/terms', text: 'Terms of Service' },
]

test.describe('public security posture', () => {
  test('sets hardened headers on public pages', async ({ request }) => {
    const response = await request.get('/')
    expect(response.ok()).toBe(true)
    expectHeader(response, 'x-content-type-options', 'nosniff')
    expectHeader(response, 'referrer-policy', 'strict-origin-when-cross-origin')
    expectHeader(response, 'x-frame-options', 'DENY')
    expectHeader(response, 'permissions-policy', 'camera=(), microphone=(), geolocation=()')

    const csp = response.headers()['content-security-policy'] ?? ''
    expect(csp).toContain("default-src 'self'")
    expect(csp).toContain("object-src 'none'")
    expect(csp).toContain("frame-ancestors 'none'")
  })

  test('marks public share pages as noindex', async ({ request }) => {
    const response = await request.get('/share/security-e2e-missing')
    expect(response.status()).toBeLessThan(500)
    expectHeader(response, 'x-robots-tag', 'noindex, nofollow')
  })

  for (const publicPage of publicPages) {
    test(`renders ${publicPage.path} without server error`, async ({ page }) => {
      await page.goto(publicPage.path)
      await expect(page.locator('body')).toContainText(publicPage.text)
      await expect(page.locator('body')).not.toContainText('Internal Server Error')
    })
  }

  test('does not execute script-like share ids', async ({ page }) => {
    await page.addInitScript(() => {
      window.__tangentXssProbe = 0
    })

    const payload = encodeURIComponent('<img src=x onerror="window.__tangentXssProbe=1">')
    await page.goto(`/share/${payload}`)
    await expect(page.locator('body')).toContainText(/Share Link|Opening Share Link/)
    await page.waitForTimeout(300)

    const probeValue = await page.evaluate(() => window.__tangentXssProbe)
    expect(probeValue).toBe(0)
  })
})

function expectHeader(response: APIResponse, name: string, value: string) {
  expect(response.headers()[name]).toBe(value)
}

declare global {
  interface Window {
    __tangentXssProbe?: number
  }
}
