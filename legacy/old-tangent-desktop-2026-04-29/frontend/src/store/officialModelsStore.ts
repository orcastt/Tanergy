import { create } from "zustand"
import { tauri, type OfficialModel } from "../services/tauri"
import { DEFAULT_MODELS, getModelsByCategory, type ModelCategory } from "../nodes/modelDefs"

interface OfficialModelsState {
  models: OfficialModel[] | null
  isLoading: boolean
  error: string | null
  refresh: () => Promise<void>
}

export const useOfficialModelsStore = create<OfficialModelsState>((set) => ({
  models: null,
  isLoading: false,
  error: null,

  refresh: async () => {
    set({ isLoading: true, error: null })
    try {
      const models = await tauri.listOfficialModels()
      set({ models, isLoading: false })
    } catch (error) {
      set({ models: null, isLoading: false, error: String(error) })
    }
  },
}))

export function getRemoteModelsByCategory(
  category: ModelCategory,
  remoteModels: OfficialModel[] | null | undefined,
) {
  const callTypes = callTypesForCategory(category)
  return (remoteModels ?? [])
    .filter((model) => model.is_active && callTypes.includes(model.call_type))
    .map((model) => ({
      id: model.model,
      name: model.display_name,
      provider: model.provider,
      category,
    }))
}

export function resolveDefaultModel(
  category: ModelCategory,
  remoteModels: OfficialModel[] | null | undefined = useOfficialModelsStore.getState().models,
) {
  const callTypes = callTypesForCategory(category)
  const activeModels = (remoteModels ?? []).filter((model) => model.is_active && callTypes.includes(model.call_type))
  const remoteDefault = activeModels.find((model) => model.is_default) ?? activeModels[0]
  if (remoteDefault) return remoteDefault.model
  const localDefault = DEFAULT_MODELS[category]
  const localModels = getModelsByCategory(category)
  return localModels.some((model) => model.id === localDefault) ? localDefault : localModels[0]?.id ?? localDefault
}

export function getDefaultModelForCategory(category: ModelCategory) {
  return resolveDefaultModel(category)
}

function callTypesForCategory(category: ModelCategory) {
  if (category === "text") return ["chat"]
  if (category === "image") return ["image", "image_chat"]
  if (category === "image_edit") return ["image_edit", "image_chat"]
  if (category === "image_enhance") return ["image_enhance"]
  return [category]
}
