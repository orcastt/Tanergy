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
    label: "Text Input",
    description: "Enter topic or keywords",
    icon: "edit_note",
    category: "input",
    defaultData: { text: "" },
    inputs: [],
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
    description: "Generate outline options",
    icon: "format_list_bulleted",
    category: "ai",
    modelCategory: "text",
    defaultData: { style: "Content List", model: "MiniMax-M2.7" },
    inputs: [{ id: "in", type: "text" }, { id: "research", type: "research_result" }],
    outputs: [{ id: "out", type: "outline_options", label: "Options" }],
  },
  {
    type: "gate",
    label: "Gate",
    description: "Pause for user selection",
    icon: "fork_right",
    category: "ai",
    defaultData: {},
    inputs: [{ id: "in", type: "outline_options" }],
    outputs: [{ id: "out", type: "outline_options", label: "Selected" }],
  },
  {
    type: "writer",
    label: "Writer",
    description: "AI long-form writing",
    icon: "edit",
    category: "ai",
    modelCategory: "text",
    defaultData: { style: "Content List", model: "MiniMax-M2.7" },
    inputs: [{ id: "outline", type: "outline_options" }],
    outputs: [{ id: "out", type: "text", label: "Article" }],
  },
  {
    type: "reviewer",
    label: "Reviewer",
    description: "Three-pass review",
    icon: "rate_review",
    category: "ai",
    modelCategory: "text",
    defaultData: { model: "MiniMax-M2.7" },
    inputs: [{ id: "in", type: "text" }],
    outputs: [{ id: "out", type: "text", label: "Reviewed" }],
  },
  {
    type: "image_planner",
    label: "Image Planner",
    description: "AI image planning",
    icon: "image",
    category: "ai",
    modelCategory: "text",
    defaultData: { count: 3, style: "Realistic", model: "MiniMax-M2.7" },
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
    inputs: [{ id: "in", type: "image_plans", label: "Plans" }, { id: "text", type: "text", label: "Text" }],
    outputs: [],
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
    label: "HTML Formatter",
    description: "Markdown to WeChat HTML",
    icon: "code",
    category: "output",
    modelCategory: "text",
    defaultData: { style: "Classic", fontSize: 16, lineHeight: 1.75, model: "MiniMax-M2.7" },
    inputs: [{ id: "text", type: "text", label: "Article" }, { id: "image_slot", type: "image_slot", label: "Image" }],
    outputs: [{ id: "out", type: "structured", label: "HTML" }],
  },
  {
    type: "preview_wechat",
    label: "Preview: WeChat",
    description: "WeChat preview & copy HTML",
    icon: "article",
    category: "output",
    defaultData: {},
    inputs: [{ id: "html", type: "structured", label: "HTML" }],
    outputs: [],
  },
]

export const NODE_MAP = Object.fromEntries(NODE_DEFS.map((d) => [d.type, d]))
