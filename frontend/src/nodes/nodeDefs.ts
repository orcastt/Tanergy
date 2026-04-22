import type { PortType, NodeType } from "../types/node"

export interface NodeDef {
  type: NodeType
  label: string
  description: string
  icon: string
  category: "input" | "text" | "ai" | "image" | "output"
  defaultData: Record<string, unknown>
  inputs: { id: string; type: PortType; label?: string }[]
  outputs: { id: string; type: PortType; label?: string }[]
}

export const NODE_DEFS: NodeDef[] = [
  {
    type: "text_input",
    label: "Text Input",
    description: "输入主题/关键词",
    icon: "edit_note",
    category: "input",
    defaultData: { text: "" },
    inputs: [],
    outputs: [{ id: "out", type: "text", label: "Text" }],
  },
  {
    type: "research",
    label: "Research",
    description: "Tavily 多轮搜索",
    icon: "search",
    category: "text",
    defaultData: { query: "" },
    inputs: [{ id: "in", type: "text", label: "Text" }],
    outputs: [{ id: "out", type: "research_result", label: "Results" }],
  },
  {
    type: "outline_generator",
    label: "Outline",
    description: "Claude 生成大纲选项",
    icon: "format_list_bulleted",
    category: "ai",
    defaultData: { style: "干货清单" },
    inputs: [{ id: "in", type: "text" }, { id: "research", type: "research_result" }],
    outputs: [{ id: "out", type: "outline_options", label: "Options" }],
  },
  {
    type: "gate",
    label: "Gate",
    description: "暂停等待用户选择",
    icon: "fork_right",
    category: "ai",
    defaultData: {},
    inputs: [{ id: "in", type: "outline_options" }],
    outputs: [{ id: "out", type: "outline_options", label: "Selected" }],
  },
  {
    type: "writer",
    label: "Writer",
    description: "Claude 生成长文",
    icon: "edit",
    category: "ai",
    defaultData: { style: "干货清单" },
    inputs: [{ id: "outline", type: "outline_options" }],
    outputs: [{ id: "out", type: "text", label: "Article" }],
  },
  {
    type: "reviewer",
    label: "Reviewer",
    description: "三遍审校",
    icon: "rate_review",
    category: "ai",
    defaultData: {},
    inputs: [{ id: "in", type: "text" }],
    outputs: [{ id: "out", type: "text", label: "Reviewed" }],
  },
  {
    type: "image_planner",
    label: "Image Planner",
    description: "AI 规划配图方案",
    icon: "image",
    category: "ai",
    defaultData: { count: 3, style: "写实" },
    inputs: [{ id: "in", type: "text", label: "文章" }],
    outputs: [{ id: "out", type: "image_plans", label: "配图方案" }],
  },
  {
    type: "image_list",
    label: "Image List",
    description: "AI 生成配图列表",
    icon: "photo_library",
    category: "image",
    defaultData: { count: 1, model: "minimax" },
    inputs: [{ id: "in", type: "image_plans", label: "配图方案" }, { id: "text", type: "text", label: "Text" }],
    outputs: [],
  },
  {
    type: "image_gallery",
    label: "Gallery",
    description: "收集展示图片",
    icon: "photo_library",
    category: "image",
    defaultData: {},
    inputs: [{ id: "in", type: "image_slot", label: "图片" }],
    outputs: [],
  },
  {
    type: "html_formatter",
    label: "HTML Formatter",
    description: "Markdown → 微信样式 HTML",
    icon: "code",
    category: "output",
    defaultData: { style: "经典", fontSize: 16, lineHeight: 1.75 },
    inputs: [{ id: "text", type: "text", label: "文章" }, { id: "image_slot", type: "image_slot", label: "配图" }],
    outputs: [{ id: "out", type: "structured", label: "HTML" }],
  },
  {
    type: "preview_wechat",
    label: "Preview: WeChat",
    description: "公众号预览 + 复制 HTML",
    icon: "article",
    category: "output",
    defaultData: {},
    inputs: [{ id: "html", type: "structured", label: "排版 HTML" }],
    outputs: [],
  },
]

export const NODE_MAP = Object.fromEntries(NODE_DEFS.map((d) => [d.type, d]))