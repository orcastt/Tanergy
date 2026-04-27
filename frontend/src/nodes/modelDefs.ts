export type ModelCategory = "text" | "image" | "image_edit" | "image_enhance" | "video"

export interface ModelDef {
  id: string
  name: string
  provider: string
  category: ModelCategory
}

export const MODEL_DEFS: Record<ModelCategory, ModelDef[]> = {
  text: [
    { id: "hunyuan-3.0-preview", name: "Hunyuan 3.0 Preview", provider: "geekai", category: "text" },
    { id: "minimax-m2.7:free", name: "MiniMax M2.7 Free", provider: "geekai", category: "text" },
    { id: "nemotron-3-super-120b-a12b", name: "Nemotron 3 Super 120B", provider: "geekai", category: "text" },
  ],
  image: [
    { id: "gpt-image-2", name: "GPT-Image-2", provider: "geekai", category: "image" },
    { id: "nano-banana-2", name: "Nano Banana 2", provider: "geekai", category: "image" },
    { id: "nano-banana-hd", name: "Nano Banana HD", provider: "geekai", category: "image" },
    { id: "jimeng_t2i_v40", name: "Jimeng Image 4.0", provider: "geekai", category: "image" },
  ],
  image_edit: [
    { id: "gemini-nano-banana", name: "Gemini Nano Banana", provider: "geekai", category: "image_edit" },
    { id: "gpt-image-1", name: "GPT-Image-1", provider: "geekai", category: "image_edit" },
  ],
  image_enhance: [
    { id: "jimeng-image-enhance-v2", name: "Jimeng Image Enhance v2", provider: "geekai", category: "image_enhance" },
  ],
  video: [],
}

export function getModelsByCategory(category: ModelCategory): ModelDef[] {
  return MODEL_DEFS[category] ?? []
}

export const DEFAULT_MODELS: Record<ModelCategory, string> = {
  text: "hunyuan-3.0-preview",
  image: "gpt-image-2",
  image_edit: "gemini-nano-banana",
  image_enhance: "jimeng-image-enhance-v2",
  video: "gpt-image-2",
}
