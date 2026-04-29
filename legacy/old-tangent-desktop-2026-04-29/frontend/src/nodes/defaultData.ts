import type { NodeType } from "../types/node"
import { getDefaultModelForCategory } from "../store/officialModelsStore"
import { NODE_MAP } from "./nodeDefs"

export function getNodeDefaultData(
  type: NodeType,
  overrides: Record<string, unknown> = {},
) {
  const def = NODE_MAP[type]
  const data: Record<string, unknown> = { nodeType: type, ...(def?.defaultData ?? {}), ...overrides }
  if (def?.modelCategory && !("model" in overrides)) {
    data.model = getDefaultModelForCategory(def.modelCategory)
  }
  return data
}
