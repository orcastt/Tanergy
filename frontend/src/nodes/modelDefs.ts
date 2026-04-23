export type ModelCategory = "text" | "image" | "video"

export interface ModelDef {
  id: string
  name: string
  provider: string
  category: ModelCategory
}

export const MODEL_DEFS: Record<ModelCategory, ModelDef[]> = {
  text: [
    { id: "MiniMax-M2.7", name: "MiniMax M2.7", provider: "minimax", category: "text" },
    { id: "claude-sonnet-4-6", name: "Claude Sonnet 4.6", provider: "anthropic", category: "text" },
    { id: "gpt-4o", name: "GPT-4o", provider: "openai", category: "text" },
    { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro", provider: "google", category: "text" },
    { id: "glm-4-plus", name: "GLM-4 Plus", provider: "glm", category: "text" },
  ],
  image: [
    { id: "minimax-image", name: "MiniMax Image", provider: "minimax", category: "image" },
    { id: "dall-e-3", name: "DALL-E 3", provider: "openai", category: "image" },
  ],
  video: [],
}

export function getModelsByCategory(category: ModelCategory): ModelDef[] {
  return MODEL_DEFS[category] ?? []
}

export const DEFAULT_MODELS: Record<ModelCategory, string> = {
  text: "MiniMax-M2.7",
  image: "minimax-image",
  video: "minimax-image",
}
