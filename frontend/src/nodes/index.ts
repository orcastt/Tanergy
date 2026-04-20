import type { ComponentType } from "react"

export { NODE_DEFS, NODE_MAP } from "./nodeDefs"
export type { NodeDef } from "./nodeDefs"

import PlaceholderNode from "./PlaceholderNode"

const allTypes = [
  "text_input",
  "research",
  "outline_generator",
  "gate",
  "writer",
  "reviewer",
  "image_planner",
  "image_gen",
  "image_gallery",
  "html_formatter",
  "preview_wechat",
] as const

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const nodeTypes: Record<string, ComponentType<any>> = Object.fromEntries(
  allTypes.map((t) => [t, PlaceholderNode])
)