export const protectedProductPathPrefixes = [
  '/admin',
  '/account',
  '/billing',
  '/boards',
  '/collections',
  '/team',
  '/settings',
  '/usage',
  '/workspaces',
]

export function isProtectedProductPath(pathname: string) {
  return protectedProductPathPrefixes.some((prefix) => (
    pathname === prefix || pathname.startsWith(`${prefix}/`)
  ))
}

export function shouldRequireWebAuth() {
  if (process.env.TANGENT_REQUIRE_WEB_AUTH === '1') return true
  return process.env.NODE_ENV === 'production' && Boolean(process.env.NEXT_PUBLIC_API_BASE_URL?.trim())
}
