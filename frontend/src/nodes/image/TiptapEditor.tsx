import { useCallback, useRef, useState, useEffect } from "react"
import { useEditor, EditorContent } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Underline from "@tiptap/extension-underline"
import Link from "@tiptap/extension-link"
import Placeholder from "@tiptap/extension-placeholder"

interface TiptapEditorProps {
  content: string
  onUpdate: (html: string) => void
  onAiRewrite: (selectedText: string) => void
}

type BlockType = "paragraph" | "h1" | "h2" | "h3" | "blockquote"

const BLOCK_LABELS: Record<BlockType, string> = {
  paragraph: "正文",
  h1: "标题1",
  h2: "标题2",
  h3: "标题3",
  blockquote: "引用",
}

function ToolbarButton({ onClick, active, title, children }: {
  onClick: () => void
  active?: boolean
  title: string
  children: React.ReactNode
}) {
  return (
    <button
      onMouseDown={(e) => { e.preventDefault(); onClick() }}
      title={title}
      style={{
        width: 28, height: 28, borderRadius: 4, border: "none",
        background: active ? "#f0e6ff" : "transparent",
        color: active ? "#7C3AED" : "#555",
        cursor: "pointer", display: "flex",
        alignItems: "center", justifyContent: "center",
        fontSize: "13px", fontWeight: active ? 600 : 400,
      }}
    >
      {children}
    </button>
  )
}

function FloatingToolbar({ editor }: { editor: NonNullable<ReturnType<typeof useEditor>> }) {
  const [visible, setVisible] = useState(false)
  const [position, setPosition] = useState({ top: 0, left: 0 })

  useEffect(() => {
    const update = () => {
      const { from, to } = editor.state.selection
      if (from === to) { setVisible(false); return }
      const sel = window.getSelection()
      if (!sel || sel.rangeCount === 0) { setVisible(false); return }
      const range = sel.getRangeAt(0)
      const rect = range.getBoundingClientRect()
      setPosition({ top: rect.top - 60, left: rect.left + rect.width / 2 })
      setVisible(true)
    }
    editor.on("selectionUpdate", update)
    return () => { editor.off("selectionUpdate", update) }
  }, [editor])

  if (!visible) return null

  return (
    <div
      style={{
        position: "fixed",
        top: position.top,
        left: position.left,
        transform: "translateX(-50%)",
        display: "flex", gap: 2, padding: "0.25rem 0.375rem",
        background: "#1a1a1a", borderRadius: 8,
        boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
        zIndex: 9999,
      }}
    >
      <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")} title="加粗"><b style={{ color: "#fff" }}>B</b></ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")} title="斜体"><i style={{ color: "#fff" }}>I</i></ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive("underline")} title="下划线"><u style={{ color: "#fff" }}>U</u></ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive("strike")} title="删除线"><s style={{ color: "#fff" }}>S</s></ToolbarButton>
      <div style={{ width: 1, height: 20, background: "#555", margin: "0 2px" }} />
      <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive("heading", { level: 1 })} title="标题1"><span style={{ color: "#fff", fontSize: 11, fontWeight: 700 }}>H1</span></ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive("heading", { level: 2 })} title="标题2"><span style={{ color: "#fff", fontSize: 11, fontWeight: 700 }}>H2</span></ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive("heading", { level: 3 })} title="标题3"><span style={{ color: "#fff", fontSize: 11, fontWeight: 700 }}>H3</span></ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive("blockquote")} title="引用"><span style={{ color: "#fff" }}>"</span></ToolbarButton>
    </div>
  )
}

export default function TiptapEditor({ content, onUpdate, onAiRewrite }: TiptapEditorProps) {
  const [blockType, setBlockType] = useState<BlockType>("paragraph")
  const toolbarRef = useRef<HTMLDivElement>(null)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Underline,
      Link.configure({ openOnClick: false }),
      Placeholder.configure({ placeholder: "输入文章内容..." }),
    ],
    content,
    onUpdate: ({ editor: e }) => { onUpdate(e.getHTML()) },
    onSelectionUpdate: ({ editor: e }) => {
      if (e.isActive("heading", { level: 1 })) setBlockType("h1")
      else if (e.isActive("heading", { level: 2 })) setBlockType("h2")
      else if (e.isActive("heading", { level: 3 })) setBlockType("h3")
      else if (e.isActive("blockquote")) setBlockType("blockquote")
      else setBlockType("paragraph")
    },
  })

  const setLink = useCallback(() => {
    if (!editor) return
    const prev = editor.getAttributes("link").href as string | undefined
    const url = window.prompt("输入链接地址", prev ?? "https://")
    if (url === null) return
    if (url === "") { editor.chain().focus().unsetLink().run(); return }
    editor.chain().focus().setLink({ href: url }).run()
  }, [editor])

  useEffect(() => {
    if (!editor || editor.getHTML() === content) return
    editor.commands.setContent(content, { emitUpdate: false })
  }, [content, editor])

  const getSelectedText = useCallback(() => {
    if (!editor) return ""
    const { from, to } = editor.state.selection
    return editor.state.doc.textBetween(from, to, " ")
  }, [editor])

  if (!editor) return null

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <div
        ref={toolbarRef}
        style={{
          display: "flex", alignItems: "center", gap: 2,
          padding: "0.375rem 0.75rem",
          borderBottom: "1px solid var(--border-color)",
          background: "#fff",
          flexShrink: 0,
          overflowX: "auto",
        }}
      >
        <select
          value={blockType}
          onChange={(e) => {
            const v = e.target.value as BlockType
            setBlockType(v)
            if (v === "paragraph") editor.chain().focus().setParagraph().run()
            else if (v === "h1") editor.chain().focus().toggleHeading({ level: 1 }).run()
            else if (v === "h2") editor.chain().focus().toggleHeading({ level: 2 }).run()
            else if (v === "h3") editor.chain().focus().toggleHeading({ level: 3 }).run()
            else if (v === "blockquote") editor.chain().focus().toggleBlockquote().run()
          }}
          style={{ height: 28, borderRadius: 4, border: "1px solid #e3e2e2", padding: "0 0.25rem", fontSize: "12px", cursor: "pointer" }}
        >
          {Object.entries(BLOCK_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>

        <div style={{ width: 1, height: 20, background: "var(--border-color)", margin: "0 4px" }} />

        <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")} title="加粗 (Ctrl+B)"><b>B</b></ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")} title="斜体 (Ctrl+I)"><i>I</i></ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive("underline")} title="下划线 (Ctrl+U)"><u>U</u></ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive("strike")} title="删除线"><s>S</s></ToolbarButton>

        <div style={{ width: 1, height: 20, background: "var(--border-color)", margin: "0 4px" }} />

        <ToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive("bulletList")} title="无序列表">•</ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive("orderedList")} title="有序列表">1.</ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive("blockquote")} title="引用">"</ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().setHorizontalRule().run()} active={false} title="分隔线">—</ToolbarButton>
        <ToolbarButton onClick={setLink} active={editor.isActive("link")} title="链接">🔗</ToolbarButton>

        <div style={{ width: 1, height: 20, background: "var(--border-color)", margin: "0 4px" }} />

        <button
          onMouseDown={(e) => { e.preventDefault(); onAiRewrite(getSelectedText()) }}
          style={{
            height: 28, padding: "0 0.625rem", borderRadius: 4, border: "none",
            background: "#6349EA", color: "#fff", fontSize: "12px", fontWeight: 600,
            cursor: "pointer", display: "flex", alignItems: "center", gap: "0.25rem",
          }}
        >
          <span style={{ fontSize: "14px" }}>✨</span>
          AI 改写
        </button>
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: "1rem" }}>
        <EditorContent editor={editor} style={{ height: "100%" }} />
        <style>{`
          .tiptap { height: 100%; outline: none; }
          .tiptap p { margin: 0 0 0.75em 0; }
          .tiptap h1 { font-size: 1.5em; font-weight: 700; margin: 1em 0 0.5em; }
          .tiptap h2 { font-size: 1.25em; font-weight: 600; margin: 0.9em 0 0.4em; }
          .tiptap h3 { font-size: 1.1em; font-weight: 600; margin: 0.8em 0 0.3em; }
          .tiptap blockquote { border-left: 3px solid #5965AF; padding-left: 1em; color: #666; margin: 1em 0; }
          .tiptap ul, .tiptap ol { padding-left: 1.5em; margin: 0.5em 0; }
          .tiptap hr { border: none; border-top: 1px solid #e3e2e2; margin: 1.5em 0; }
          .tiptap a { color: #5965AF; text-decoration: underline; }
          .tiptap p.is-editor-empty:first-child::before {
            content: attr(data-placeholder);
            color: #aaa;
            float: left;
            height: 0;
            pointer-events: none;
          }
        `}</style>
      </div>

      <FloatingToolbar editor={editor} />
    </div>
  )
}
