import type { ComponentType } from "react"

export { NODE_DEFS, NODE_MAP } from "./nodeDefs"
export type { NodeDef } from "./nodeDefs"

import PromptNode from "./PromptNode"
import PlaceholderNode from "./PlaceholderNode"

const placeholderTypes = ["chat", "optimize", "analysis", "search", "image_mj", "image_imagen", "image_upload", "preview_wechat", "preview_red"] as const

export const nodeTypes: Record<string, ComponentType> = {
  prompt: PromptNode,
  ...Object.fromEntries(placeholderTypes.map((t) => [t, PlaceholderNode])),
}
