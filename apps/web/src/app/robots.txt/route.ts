export const runtime = 'nodejs'

export function GET() {
  return new Response('User-agent: *\nDisallow: /api/\nDisallow: /share/\n', {
    headers: {
      'Cache-Control': 'public, max-age=3600',
      'Content-Type': 'text/plain; charset=utf-8',
      'Cross-Origin-Resource-Policy': 'same-origin',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  })
}
