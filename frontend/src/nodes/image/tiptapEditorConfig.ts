import { Extension } from "@tiptap/core"
import Image from "@tiptap/extension-image"

export type BlockType = "paragraph" | "h1" | "h2" | "h3" | "bulletList" | "orderedList" | "codeBlock" | "blockquote"
export type AlignType = "left" | "center" | "right" | "justify"
export type SlashMenuState = { top: number; left: number; from: number; to: number }
export type BlockMenuState = { top: number; left: number; pos: number }
export type ToolbarMenu = "insert" | "align" | "emoji" | "more" | null

export const THEME = "#5965AF"
export const HIGHLIGHT = "#EDE4F1"
export const DEFAULT_FONT_SIZE = 16

export const BLOCK_LABELS: Record<BlockType, string> = {
  paragraph: "正文文本",
  h1: "一级标题",
  h2: "二级标题",
  h3: "三级标题",
  bulletList: "无序列表",
  orderedList: "有序列表",
  codeBlock: "代码块",
  blockquote: "引用",
}

export const EMOJIS = ["😊", "🔥", "✨", "💡", "📌", "✅", "⚠️", "🚀", "❤️", "🎯", "📈", "🧠"]

export const ALIGN_COMMANDS: Array<{ id: AlignType; icon: string; label: string }> = [
  { id: "left", icon: "☰", label: "左对齐" },
  { id: "center", icon: "≡", label: "居中对齐" },
  { id: "right", icon: "☷", label: "右对齐" },
  { id: "justify", icon: "▤", label: "两端对齐" },
]

export const SLASH_COMMANDS = [
  { id: "paragraph", icon: "¶", label: "正文文本", hint: "普通段落" },
  { id: "h1", icon: "H1", label: "一级标题", hint: "大标题" },
  { id: "h2", icon: "H2", label: "二级标题", hint: "章节标题" },
  { id: "h3", icon: "H3", label: "三级标题", hint: "小标题" },
  { id: "bulletList", icon: "☷", label: "无序列表", hint: "项目符号" },
  { id: "orderedList", icon: "1.", label: "有序列表", hint: "编号列表" },
  { id: "codeBlock", icon: "{}", label: "代码块", hint: "代码片段" },
  { id: "blockquote", icon: "❞", label: "引用", hint: "引文/洞察" },
  { id: "table", icon: "▦", label: "表格", hint: "3×3" },
  { id: "image", icon: "▧", label: "插入图片", hint: "上传本地图片" },
  { id: "emoji", icon: "😊", label: "表情", hint: "插入 emoji" },
]

export const FontSize = Extension.create({
  name: "fontSize",

  addGlobalAttributes() {
    return [
      {
        types: ["textStyle"],
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (element) => element.style.fontSize || null,
            renderHTML: (attributes) => {
              if (!attributes.fontSize) return {}
              return { style: `font-size: ${attributes.fontSize}` }
            },
          },
        },
      },
    ]
  },
})

export const LocalImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      tanvasFilePath: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-tanvas-file-path") ?? element.getAttribute("data-file-path"),
        renderHTML: (attributes) => attributes.tanvasFilePath ? { "data-tanvas-file-path": attributes.tanvasFilePath } : {},
      },
      tanvasRemoteUrl: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-tanvas-remote-url") ?? element.getAttribute("data-remote-url"),
        renderHTML: (attributes) => attributes.tanvasRemoteUrl ? { "data-tanvas-remote-url": attributes.tanvasRemoteUrl } : {},
      },
      tanvasDescription: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-tanvas-description"),
        renderHTML: (attributes) => attributes.tanvasDescription ? { "data-tanvas-description": attributes.tanvasDescription } : {},
      },
      tanvasPosition: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-tanvas-position"),
        renderHTML: (attributes) => attributes.tanvasPosition ? { "data-tanvas-position": attributes.tanvasPosition } : {},
      },
      tanvasPlanId: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-tanvas-plan-id"),
        renderHTML: (attributes) => attributes.tanvasPlanId ? { "data-tanvas-plan-id": attributes.tanvasPlanId } : {},
      },
      style: {
        default: null,
        parseHTML: (element) => element.getAttribute("style"),
        renderHTML: (attributes) => attributes.style ? { style: attributes.style } : {},
      },
    }
  },
})

export function normalizeRewriteHtml(rewrittenHtml: string) {
  const trimmed = rewrittenHtml.trim()
  if (!trimmed) return ""
  if (/<(p|h[1-6]|ul|ol|li|blockquote|pre|table|section|div)\b/i.test(trimmed)) return trimmed
  if (/<[a-z][\s\S]*>/i.test(trimmed)) return `<p>${trimmed}</p>`
  return trimmed
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br />")}</p>`)
    .join("")
}

function escapeHtml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}
