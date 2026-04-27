import type { CSSProperties } from "react"
import { useTranslation } from "react-i18next"
import { editorColors, editorShadows } from "../../styles/editorDesign"

interface Props {
  text: string
  title?: string
}

interface BookBlock {
  type: "h1" | "h2" | "h3" | "p"
  text: string
}

const PAGE_BLOCK_LIMIT = 8

export default function BookPreview({ text, title }: Props) {
  const { t } = useTranslation()
  const bookTitle = title || t("writer_editor.untitled")
  const blocks = parseBookBlocks(text, t("writer_editor.emptyPreview"))
  const pages = paginateBlocks(blocks)

  return (
    <div style={previewShellStyle}>
      <div style={previewHeaderStyle}>
        <div>
          <div style={{ fontSize: 12, color: editorColors.secondary, fontWeight: 700 }}>{t("writer_editor.bookPreview")}</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: editorColors.text }}>{bookTitle}</div>
        </div>
        <div style={{ fontSize: 12, color: editorColors.secondary }}>{t("writer_editor.pages", { count: pages.length })}</div>
      </div>
      <div style={pagesStyle}>
        {pages.map((page, pageIndex) => (
          <article key={pageIndex} style={pageStyle}>
            <div style={pageTopBarStyle}>
              <span>{bookTitle}</span>
              <span>{pageIndex + 1}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {page.map((block, blockIndex) => <BookBlockView key={`${pageIndex}-${blockIndex}`} block={block} />)}
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}

function BookBlockView({ block }: { block: BookBlock }) {
  if (block.type === "h1") return <h1 style={h1Style}>{block.text}</h1>
  if (block.type === "h2") return <h2 style={h2Style}>{block.text}</h2>
  if (block.type === "h3") return <h3 style={h3Style}>{block.text}</h3>
  return <p style={paragraphStyle}>{block.text}</p>
}

function parseBookBlocks(text: string, emptyText: string): BookBlock[] {
  const normalized = text.trim() || emptyText
  return normalized
    .split(/\n{2,}/)
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk) => {
      if (chunk.startsWith("# ")) return { type: "h1", text: chunk.replace(/^#\s+/, "") }
      if (chunk.startsWith("## ")) return { type: "h2", text: chunk.replace(/^##\s+/, "") }
      if (chunk.startsWith("### ")) return { type: "h3", text: chunk.replace(/^###\s+/, "") }
      return { type: "p", text: chunk.replace(/\n/g, " ") }
    })
}

function paginateBlocks(blocks: BookBlock[]) {
  const pages: BookBlock[][] = []
  let current: BookBlock[] = []
  let weight = 0

  for (const block of blocks) {
    const blockWeight = block.type === "p" ? Math.max(1, Math.ceil(block.text.length / 180)) : 1
    if (current.length > 0 && weight + blockWeight > PAGE_BLOCK_LIMIT) {
      pages.push(current)
      current = []
      weight = 0
    }
    current.push(block)
    weight += blockWeight
  }
  if (current.length > 0) pages.push(current)
  return pages.length > 0 ? pages : [[{ type: "p" as const, text: "" }]]
}

const previewShellStyle: CSSProperties = { height: "100%", background: "#EEF2F1", overflow: "auto", display: "flex", flexDirection: "column" }
const previewHeaderStyle: CSSProperties = { padding: "1rem 1.25rem", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid rgba(0,0,0,0.06)", background: "rgba(255,255,255,0.72)", backdropFilter: "blur(14px)", position: "sticky", top: 0, zIndex: 2 }
const pagesStyle: CSSProperties = { padding: "2rem", display: "flex", flexDirection: "column", alignItems: "center", gap: "1.5rem" }
const pageStyle: CSSProperties = { width: 620, minHeight: 820, background: "#FFFDF8", boxShadow: editorShadows.modal, padding: "3.5rem 4rem", boxSizing: "border-box", color: "#252525", fontFamily: "'Noto Serif SC','Songti SC','Times New Roman',serif" }
const pageTopBarStyle: CSSProperties = { display: "flex", justifyContent: "space-between", marginBottom: "2.5rem", color: "#9A948A", fontSize: 12, letterSpacing: "0.04em" }
const h1Style: CSSProperties = { margin: "0 0 1.75rem", fontSize: 30, lineHeight: 1.35, fontWeight: 800, letterSpacing: "-0.02em" }
const h2Style: CSSProperties = { margin: "1.25rem 0 0.75rem", fontSize: 22, lineHeight: 1.45, fontWeight: 750 }
const h3Style: CSSProperties = { margin: "1rem 0 0.5rem", fontSize: 17, lineHeight: 1.5, fontWeight: 700, color: "#6B5B45" }
const paragraphStyle: CSSProperties = { margin: 0, fontSize: 16, lineHeight: 2.05, textAlign: "justify", textIndent: "2em", letterSpacing: "0.02em" }
