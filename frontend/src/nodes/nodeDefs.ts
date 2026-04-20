import type { PortType, NodeType } from "../types/node"

export interface NodeDef {
  type: NodeType
  label: string
  description: string
  icon: string
  category: "input" | "text" | "image" | "output"
  defaultData: Record<string, unknown>
  inputs: { id: string; type: PortType; label?: string }[]
  outputs: { id: string; type: PortType; label?: string }[]
}

export const NODE_DEFS: NodeDef[] = [
  {
    type: "prompt",
    label: "Prompt",
    description: "提示词输入节点",
    icon: "edit_note",
    category: "text",
    defaultData: { prompt: "" },
    inputs: [],
    outputs: [{ id: "out", type: "prompt", label: "Prompt" }],
  },
  {
    type: "chat",
    label: "Chat",
    description: "AI 文字生成",
    icon: "chat",
    category: "text",
    defaultData: { systemPrompt: "", model: "gpt-4o-mini" },
    inputs: [{ id: "prompt", type: "prompt", label: "Prompt" }],
    outputs: [{ id: "out", type: "text", label: "Text" }],
  },
  {
    type: "optimize",
    label: "Optimize",
    description: "文本润色优化",
    icon: "tune",
    category: "text",
    defaultData: { rules: "" },
    inputs: [{ id: "text", type: "text", label: "Text" }],
    outputs: [{ id: "out", type: "text", label: "Cleaned" }],
  },
  {
    type: "analysis",
    label: "Analysis",
    description: "数据分析节点",
    icon: "analytics",
    category: "text",
    defaultData: { query: "" },
    inputs: [{ id: "text", type: "text" }],
    outputs: [{ id: "out", type: "structured" }],
  },
  {
    type: "search",
    label: "Search",
    description: "搜索节点",
    icon: "search",
    category: "text",
    defaultData: { query: "" },
    inputs: [],
    outputs: [{ id: "out", type: "search_result", label: "Results" }],
  },
  {
    type: "image_mj",
    label: "MJ V7",
    description: "Midjourney V7 生图",
    icon: "image",
    category: "image",
    defaultData: { prompt: "", aspectRatio: "1:1" },
    inputs: [{ id: "prompt", type: "prompt" }, { id: "ref", type: "text" }],
    outputs: [{ id: "out", type: "image", label: "Images" }],
  },
  {
    type: "image_imagen",
    label: "Imagen 3",
    description: "Google Imagen 3 生图",
    icon: "photo_camera",
    category: "image",
    defaultData: { prompt: "" },
    inputs: [{ id: "prompt", type: "prompt" }],
    outputs: [{ id: "out", type: "image", label: "Images" }],
  },
  {
    type: "image_upload",
    label: "Image Upload",
    description: "上传图片素材",
    icon: "upload_file",
    category: "input",
    defaultData: { urls: [] },
    inputs: [],
    outputs: [{ id: "out", type: "image", label: "Image" }],
  },
  {
    type: "preview_wechat",
    label: "Preview: WeChat",
    description: "微信公众号预览",
    icon: "article",
    category: "output",
    defaultData: {},
    inputs: [{ id: "text", type: "text" }, { id: "image", type: "image" }],
    outputs: [],
  },
  {
    type: "preview_red",
    label: "Preview: RED",
    description: "小红书预览",
    icon: "preview",
    category: "output",
    defaultData: {},
    inputs: [{ id: "text", type: "text" }, { id: "image", type: "image" }],
    outputs: [],
  },
]

export const NODE_MAP = Object.fromEntries(NODE_DEFS.map((d) => [d.type, d]))
