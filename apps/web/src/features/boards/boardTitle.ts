import { normalizeBoardTitleInput, sanitizeBoardTitleInput, validateBoardTitleInput } from '@/features/security/safeText'

export function normalizeBoardTitle(value: unknown, fallback = 'Untitled Board') {
  const source = typeof value === 'string' ? value : fallback
  const validationError = validateBoardTitleInput(source)
  if (validationError) throw new Error(validationError)
  return normalizeBoardTitleInput(source)
}

export function coerceBoardTitle(value: unknown, fallback = 'Untitled Board') {
  const source = typeof value === 'string' ? value : fallback
  const safeTitle = normalizeBoardTitleInput(sanitizeBoardTitleInput(source))
  return safeTitle || normalizeBoardTitleInput(sanitizeBoardTitleInput(fallback)) || 'Untitled Board'
}
