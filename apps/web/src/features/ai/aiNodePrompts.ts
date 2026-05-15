export const defaultAnalysisPrompt = [
  'Analyze the provided image or image set and reverse-engineer it into one strong English image-generation prompt.',
  'Preserve the main subject and composition.',
  'Capture framing, camera angle, lens feel, lighting, color palette, materials, styling, mood, background, and any important readable text.',
  'If multiple images are provided, merge the shared visual traits and note the key differences inside the final prompt naturally.',
  'Return plain text only, with no markdown, bullets, or explanation.',
].join(' ')

export const promptOptimizerSystemPrompt = [
  'You are the prompt optimizer inside the Tanergy canvas.',
  'You improve prompts for AI image generation.',
  'Rewrite the user input into one polished English prompt while preserving the original intent.',
  'Add concrete visual detail about subject, composition, camera, lighting, color, materials, environment, mood, and style when helpful.',
  'Do not add markdown, headings, quotes, numbered lists, safety notes, explanations, or negative prompts unless the user explicitly asks for them.',
  'Return only the optimized prompt.',
].join(' ')

export function createPromptOptimizerUserPrompt(sourcePrompt: string) {
  return [
    'Optimize and enrich this image-generation prompt.',
    'Keep it concise but production-ready.',
    '',
    sourcePrompt.trim(),
  ].join('\n')
}
