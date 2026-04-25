import type { PortType, NodeType } from "../types/node"
import type { ModelCategory } from "./modelDefs"

export interface NodeDef {
  type: NodeType
  label: string
  description: string
  icon: string
  category: "input" | "text" | "ai" | "image" | "output"
  modelCategory?: ModelCategory
  defaultData: Record<string, unknown>
  inputs: { id: string; type: PortType; label?: string }[]
  outputs: { id: string; type: PortType; label?: string }[]
}

export const NODE_DEFS: NodeDef[] = [
  {
    type: "text_input",
    label: "Text",
    description: "Enter or receive text",
    icon: "edit_note",
    category: "input",
    defaultData: { text: "" },
    inputs: [{ id: "in", type: "text", label: "Text" }],
    outputs: [{ id: "out", type: "text", label: "Text" }],
  },
  {
    type: "research",
    label: "Research",
    description: "Deep research on a topic",
    icon: "search",
    category: "text",
    modelCategory: "text",
    defaultData: { query: "", model: "MiniMax-M2.7" },
    inputs: [{ id: "in", type: "text", label: "Text" }],
    outputs: [{ id: "out", type: "research_result", label: "Results" }],
  },
  {
    type: "outline_generator",
    label: "Outline",
    description: "Generate structured outline with sections",
    icon: "format_list_bulleted",
    category: "ai",
    modelCategory: "text",
    defaultData: { style: "干货清单", model: "MiniMax-M2.7", promptOverride: "" },
    inputs: [
      { id: "in", type: "text", label: "Topic" },
      { id: "research", type: "research_result", label: "Research" },
    ],
    outputs: [
      { id: "out", type: "text", label: "Outline" },
      { id: "image_plans", type: "image_plans", label: "Images" },
    ],
  },
  {
    type: "image_planner",
    label: "Image Planner",
    description: "AI image planning",
    icon: "image",
    category: "ai",
    modelCategory: "text",
    defaultData: { count: 3, style: "写实", model: "MiniMax-M2.7" },
    inputs: [{ id: "in", type: "text", label: "Article" }],
    outputs: [{ id: "out", type: "image_plans", label: "Plans" }],
  },
  {
    type: "image_list",
    label: "Image List",
    description: "AI image generation",
    icon: "photo_library",
    category: "image",
    modelCategory: "image",
    defaultData: { count: 1, model: "minimax-image", imageInputs: ["img_in_1"] },
    inputs: [
      { id: "in", type: "image_plans", label: "Plans" },
      { id: "text", type: "text", label: "Text" },
    ],
    outputs: [{ id: "out", type: "image_slot" }],
  },
  {
    type: "image_gallery",
    label: "Gallery",
    description: "Collect & display images",
    icon: "photo_library",
    category: "image",
    defaultData: {},
    inputs: [{ id: "in", type: "image_slot", label: "Image" }],
    outputs: [],
  },
  {
    type: "html_formatter",
    label: "Html Editor",
    description: "Combine sections into WeChat HTML · double-click to edit",
    icon: "code",
    category: "output",
    modelCategory: "text",
    defaultData: { style: "标准紫", fontSize: 16, lineHeight: 1.75, model: "MiniMax-M2.7", textInputs: ["text_1"] },
    inputs: [
      { id: "text_1", type: "text", label: "Section 1" },
      { id: "images", type: "image_slot", label: "Images" },
    ],
    outputs: [],
  },
]

export const NODE_MAP = Object.fromEntries(NODE_DEFS.map((d) => [d.type, d]))
