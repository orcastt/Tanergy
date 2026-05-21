const forbiddenLabelChars = /[<>"'`{}\[\]\\|;]/g
const forbiddenLabelTokens = [/--/g, /\/\*/g, /\*\//g]
const controlChars = /[\u0000-\u001f\u007f]/g
const allowedBoardTitle = /^[\p{L}\p{N} ._-]+$/u
const forbiddenBoardTitleChars = /[^\p{L}\p{N} ._-]/gu
export const boardTitleValidationMessage = 'Board title can only use letters, numbers, spaces, hyphen, underscore, and dot.'

export function sanitizeUserLabelInput(value: string, maxLength = 80) {
  let next = value.replace(controlChars, '').replace(forbiddenLabelChars, '')
  for (const token of forbiddenLabelTokens) {
    token.lastIndex = 0
    next = next.replace(token, '')
  }
  return next.slice(0, maxLength)
}

export function normalizeUserLabelInput(value: string, maxLength = 80) {
  return sanitizeUserLabelInput(value, maxLength).trim().replace(/\s+/g, ' ')
}

export function normalizeBoardTitleInput(value: string) {
  return value.replace(controlChars, '').trim().replace(/\s+/g, ' ')
}

export function sanitizeBoardTitleInput(value: string, maxLength = 80) {
  return value.replace(controlChars, '').replace(forbiddenBoardTitleChars, '').slice(0, maxLength)
}

export function validateBoardTitleInput(value: string, maxLength = 80) {
  const normalized = normalizeBoardTitleInput(value)
  if (!normalized) return 'Board title is required.'
  if (normalized.length > maxLength) return `Board title must be ${maxLength} characters or fewer.`
  return allowedBoardTitle.test(normalized) ? null : boardTitleValidationMessage
}
