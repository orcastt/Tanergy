'use client'

const staleAdminLocalStoragePrefixes = [
  'tanergy.admin.',
  'tanergy.admin-',
]

export function discardStaleAdminLocalStorage() {
  if (typeof window === 'undefined') return
  for (let index = window.localStorage.length - 1; index >= 0; index -= 1) {
    const key = window.localStorage.key(index)
    if (!key || !staleAdminLocalStoragePrefixes.some((prefix) => key.startsWith(prefix))) continue
    window.localStorage.removeItem(key)
  }
}
