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

export const BLOCK_TYPES: BlockType[] = ["paragraph", "h1", "h2", "h3", "bulletList", "orderedList", "codeBlock", "blockquote"]

export const BLOCK_LABEL_KEYS: Record<BlockType, string> = {
  paragraph: "html_editor.blocks.paragraph",
  h1: "html_editor.blocks.h1",
  h2: "html_editor.blocks.h2",
  h3: "html_editor.blocks.h3",
  bulletList: "html_editor.blocks.bulletList",
  orderedList: "html_editor.blocks.orderedList",
  codeBlock: "html_editor.blocks.codeBlock",
  blockquote: "html_editor.blocks.blockquote",
}

export const EMOJIS = ["😊", "🔥", "✨", "💡", "📌", "✅", "⚠️", "🚀", "❤️", "🎯", "📈", "🧠"]

export const ALIGN_COMMANDS: Array<{ id: AlignType; icon: string; labelKey: string }> = [
  { id: "left", icon: "format_align_left", labelKey: "html_editor.align.left" },
  { id: "center", icon: "format_align_center", labelKey: "html_editor.align.center" },
  { id: "right", icon: "format_align_right", labelKey: "html_editor.align.right" },
  { id: "justify", icon: "format_align_justify", labelKey: "html_editor.align.justify" },
]

export const SLASH_COMMANDS = [
  { id: "paragraph", icon: "notes", labelKey: "html_editor.blocks.paragraph", hintKey: "html_editor.hints.paragraph" },
  { id: "h1", icon: "title", labelKey: "html_editor.blocks.h1", hintKey: "html_editor.hints.h1" },
  { id: "h2", icon: "title", labelKey: "html_editor.blocks.h2", hintKey: "html_editor.hints.h2" },
  { id: "h3", icon: "title", labelKey: "html_editor.blocks.h3", hintKey: "html_editor.hints.h3" },
  { id: "bulletList", icon: "format_list_bulleted", labelKey: "html_editor.blocks.bulletList", hintKey: "html_editor.hints.bulletList" },
  { id: "orderedList", icon: "format_list_numbered", labelKey: "html_editor.blocks.orderedList", hintKey: "html_editor.hints.orderedList" },
  { id: "codeBlock", icon: "code", labelKey: "html_editor.blocks.codeBlock", hintKey: "html_editor.hints.codeBlock" },
  { id: "blockquote", icon: "format_quote", labelKey: "html_editor.blocks.blockquote", hintKey: "html_editor.hints.blockquote" },
  { id: "table", icon: "table", labelKey: "html_editor.blocks.table", hintKey: "html_editor.hints.table" },
  { id: "image", icon: "image", labelKey: "html_editor.blocks.image", hintKey: "html_editor.hints.image" },
  { id: "emoji", icon: "mood", labelKey: "html_editor.blocks.emoji", hintKey: "html_editor.hints.emoji" },
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
