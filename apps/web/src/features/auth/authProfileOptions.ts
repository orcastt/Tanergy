export const authProfileGenderOptions = [
  { label: 'Not specified', value: '' },
  { label: 'Female', value: 'female' },
  { label: 'Male', value: 'male' },
  { label: 'Non-binary', value: 'non_binary' },
  { label: 'Prefer not to say', value: 'prefer_not_to_say' },
] as const

export type AuthProfileGender = Exclude<(typeof authProfileGenderOptions)[number]['value'], ''>

const authProfileGenderLabels = new Map<string, string>(
  authProfileGenderOptions
    .filter((option) => option.value)
    .map((option) => [option.value, option.label]),
)

export function formatAuthProfileGender(value?: null | string) {
  if (!value) return 'Not specified'
  return authProfileGenderLabels.get(value) ?? value
}
