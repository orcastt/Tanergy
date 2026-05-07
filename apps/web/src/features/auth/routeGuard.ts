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
  return process.env.TANGENT_REQUIRE_WEB_AUTH === '1'
}
