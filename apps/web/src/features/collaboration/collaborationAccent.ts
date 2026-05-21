const collaborationAccentPalette = [
  '#2563eb',
  '#16a34a',
  '#db2777',
  '#d97706',
  '#7c3aed',
  '#0891b2',
  '#ea580c',
  '#0f766e',
] as const

export function getCollaborationAccent(seed: string) {
  const normalized = seed.trim()
  let hash = 0
  for (let index = 0; index < normalized.length; index += 1) {
    hash = (hash * 31 + normalized.charCodeAt(index)) >>> 0
  }
  return collaborationAccentPalette[hash % collaborationAccentPalette.length]
}
