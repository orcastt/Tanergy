const forbiddenLabelChars = /[<>"'`{}\[\]\\|;]/g
const forbiddenLabelTokens = [/--/g, /\/\*/g, /\*\//g]
const controlChars = /[\u0000-\u001f\u007f]/g

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
