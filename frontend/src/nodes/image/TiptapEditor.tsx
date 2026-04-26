import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { Editor } from "@tiptap/core"
import { useEditor, EditorContent } from "@tiptap/react"
import { DragHandle } from "@tiptap/extension-drag-handle-react"
import StarterKit from "@tiptap/starter-kit"
import Underline from "@tiptap/extension-underline"
import Link from "@tiptap/extension-link"
import Placeholder from "@tiptap/extension-placeholder"
import Highlight from "@tiptap/extension-highlight"
import { TextStyle } from "@tiptap/extension-text-style"
import Color from "@tiptap/extension-color"
import TextAlign from "@tiptap/extension-text-align"
import { Table } from "@tiptap/extension-table"
import TableRow from "@tiptap/extension-table-row"
import TableCell from "@tiptap/extension-table-cell"
import TableHeader from "@tiptap/extension-table-header"
import { hydrateLocalImageHtml } from "./localImageHtml"
import TiptapToolbar from "./TiptapToolbar"
import { FloatingToolbar } from "./TiptapMenus"
import { BlockCommandMenu, SlashCommandMenu } from "./TiptapCommandMenus"
import { getTiptapEditorStyles } from "./tiptapEditorStyles"
import {
  DEFAULT_FONT_SIZE,
  FontSize,
  LocalImage,
  SLASH_COMMANDS,
  normalizeRewriteHtml,
  type AlignType,
  type BlockMenuState,
  type BlockType,
  type SlashMenuState,
  type ToolbarMenu,
} from "./tiptapEditorConfig"
interface TiptapEditorProps {
  content: string
  onUpdate: (html: string) => void
  onAiRewrite: (selectedText: string, insertRewrittenHtml: (rewrittenHtml: string) => void) => void
}
export default function TiptapEditor({ content, onUpdate, onAiRewrite }: TiptapEditorProps) {
  const [blockType, setBlockType] = useState<BlockType>("paragraph")
  const [fontSize, setFontSize] = useState(DEFAULT_FONT_SIZE)
  const [toolbarMenu, setToolbarMenu] = useState<ToolbarMenu>(null)
  const [slashMenu, setSlashMenu] = useState<SlashMenuState | null>(null)
  const [slashIndex, setSlashIndex] = useState(0)
  const [blockMenu, setBlockMenu] = useState<BlockMenuState | null>(null)
  const [activeBlockPos, setActiveBlockPos] = useState<number | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const hydratedContent = useMemo(() => hydrateLocalImageHtml(content), [content])
  const updateBlockType = useCallback((editorInstance: Editor) => {
    if (editorInstance.isActive("heading", { level: 1 })) setBlockType("h1")
    else if (editorInstance.isActive("heading", { level: 2 })) setBlockType("h2")
    else if (editorInstance.isActive("heading", { level: 3 })) setBlockType("h3")
    else if (editorInstance.isActive("bulletList")) setBlockType("bulletList")
    else if (editorInstance.isActive("orderedList")) setBlockType("orderedList")
    else if (editorInstance.isActive("codeBlock")) setBlockType("codeBlock")
    else if (editorInstance.isActive("blockquote")) setBlockType("blockquote")
    else setBlockType("paragraph")

    const currentFontSize = editorInstance.getAttributes("textStyle").fontSize as string | undefined
    if (currentFontSize) {
      const parsed = Number.parseInt(currentFontSize, 10)
      if (Number.isFinite(parsed)) setFontSize(parsed)
    }
  }, [])
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Underline,
      TextStyle,
      FontSize,
      Color.configure({ types: ["textStyle"] }),
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      LocalImage.configure({ inline: false, allowBase64: true }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      Link.configure({ openOnClick: false }),
      Placeholder.configure({
        placeholder: ({ node }) => node.type.name === "heading" ? "请输入标题" : "输入 “/” 符号，快速添加不同形式内容",
      }),
    ],
    content: hydratedContent,
    editorProps: {
      attributes: { class: "notion-editor-content" },
      handleKeyDown: (_view, event) => {
        if (slashMenu && handleSlashMenuKey(event)) return true
        if (event.key === "/") requestAnimationFrame(() => updateSlashMenu())
        return false
      },
    },
    onUpdate: ({ editor: editorInstance }) => {
      onUpdate(editorInstance.getHTML())
      updateSlashMenu(editorInstance)
    },
    onSelectionUpdate: ({ editor: editorInstance }) => {
      updateBlockType(editorInstance)
      updateSlashMenu(editorInstance)
    },
  })
  const updateSlashMenu = useCallback((editorInstance = editor) => {
    if (!editorInstance) return
    const { from, to } = editorInstance.state.selection
    if (from !== to || from < 2) { setSlashMenu(null); return }
    const previous = editorInstance.state.doc.textBetween(from - 1, from, "\n")
    if (previous !== "/") { setSlashMenu(null); return }
    const coords = editorInstance.view.coordsAtPos(from)
    setSlashMenu({ top: coords.bottom + 8, left: coords.left, from: from - 1, to: from })
    setSlashIndex(0)
  }, [editor])
  const deleteActiveSlash = useCallback(() => {
    if (!editor || !slashMenu) return false
    editor.chain().focus().deleteRange({ from: slashMenu.from, to: slashMenu.to }).run()
    setSlashMenu(null)
    return true
  }, [editor, slashMenu])
  const applyBlockType = useCallback((type: BlockType) => {
    if (!editor) return
    setBlockType(type)
    const chain = editor.chain().focus()
    if (type === "paragraph") chain.setParagraph().run()
    else if (type === "h1") chain.toggleHeading({ level: 1 }).run()
    else if (type === "h2") chain.toggleHeading({ level: 2 }).run()
    else if (type === "h3") chain.toggleHeading({ level: 3 }).run()
    else if (type === "bulletList") chain.toggleBulletList().run()
    else if (type === "orderedList") chain.toggleOrderedList().run()
    else if (type === "codeBlock") chain.toggleCodeBlock().run()
    else if (type === "blockquote") chain.toggleBlockquote().run()
  }, [editor])
  const runSlashCommand = useCallback((id: string) => {
    if (!editor) return
    deleteActiveSlash()
    if (id === "paragraph") editor.chain().focus().setParagraph().run()
    else if (id === "h1") editor.chain().focus().toggleHeading({ level: 1 }).run()
    else if (id === "h2") editor.chain().focus().toggleHeading({ level: 2 }).run()
    else if (id === "h3") editor.chain().focus().toggleHeading({ level: 3 }).run()
    else if (id === "bulletList") editor.chain().focus().toggleBulletList().run()
    else if (id === "orderedList") editor.chain().focus().toggleOrderedList().run()
    else if (id === "codeBlock") editor.chain().focus().toggleCodeBlock().run()
    else if (id === "blockquote") editor.chain().focus().toggleBlockquote().run()
    else if (id === "table") editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
    else if (id === "image") fileInputRef.current?.click()
    else if (id === "emoji") editor.chain().focus().insertContent("😊").run()
  }, [deleteActiveSlash, editor])
  const handleSlashMenuKey = useCallback((event: KeyboardEvent) => {
    if (event.key === "ArrowDown") {
      event.preventDefault()
      setSlashIndex((value) => (value + 1) % SLASH_COMMANDS.length)
      return true
    }
    if (event.key === "ArrowUp") {
      event.preventDefault()
      setSlashIndex((value) => (value - 1 + SLASH_COMMANDS.length) % SLASH_COMMANDS.length)
      return true
    }
    if (event.key === "Enter") {
      event.preventDefault()
      runSlashCommand(SLASH_COMMANDS[slashIndex].id)
      return true
    }
    if (event.key === "Escape") {
      event.preventDefault()
      setSlashMenu(null)
      return true
    }
    return false
  }, [runSlashCommand, slashIndex])
  const setLink = useCallback(() => {
    if (!editor) return
    const prev = editor.getAttributes("link").href as string | undefined
    const url = window.prompt("输入链接地址", prev ?? "https://")
    if (url === null) return
    if (url === "") { editor.chain().focus().unsetLink().run(); return }
    editor.chain().focus().setLink({ href: url }).run()
  }, [editor])
  const insertImageFromUrl = useCallback(() => {
    if (!editor) return
    const url = window.prompt("输入图片 URL")
    if (url) editor.chain().focus().setImage({ src: url }).run()
  }, [editor])
  const insertImageFile = useCallback((file: File) => {
    if (!editor) return
    const reader = new FileReader()
    reader.onload = () => {
      const src = typeof reader.result === "string" ? reader.result : ""
      if (src) editor.chain().focus().setImage({ src, alt: file.name }).run()
    }
    reader.readAsDataURL(file)
  }, [editor])
  const getRewriteTarget = useCallback(() => {
    if (!editor) return { selectedText: "", insertRewrittenHtml: () => {} }
    const { from, to, $to } = editor.state.selection
    const selectedText = from === to ? "" : editor.state.doc.textBetween(from, to, " ")
    const insertAt = $to.depth >= 1 ? $to.after(1) : to
    const topLevelText = $to.depth >= 1 ? editor.state.doc.nodeAt($to.before(1))?.textContent ?? "" : ""
    return {
      selectedText: selectedText || topLevelText,
      insertRewrittenHtml: (rewrittenHtml: string) => {
        const normalizedHtml = normalizeRewriteHtml(rewrittenHtml)
        if (normalizedHtml) editor.chain().focus().insertContentAt(insertAt, normalizedHtml).run()
      },
    }
  }, [editor])
  const handleAiRewriteSelected = useCallback(() => {
    const target = getRewriteTarget()
    onAiRewrite(target.selectedText, target.insertRewrittenHtml)
  }, [getRewriteTarget, onAiRewrite])
  const setTextAlign = useCallback((align: AlignType) => {
    if (editor) editor.chain().focus().setTextAlign(align).run()
  }, [editor])
  const insertParagraphAfterBlock = useCallback(() => {
    if (!editor || activeBlockPos == null) return
    const node = editor.state.doc.nodeAt(activeBlockPos)
    const insertAt = node ? activeBlockPos + node.nodeSize : editor.state.selection.to
    editor.chain().focus().insertContentAt(insertAt, { type: "paragraph" }).setTextSelection(insertAt + 1).run()
  }, [activeBlockPos, editor])
  const focusBlockAt = useCallback((pos: number) => {
    if (!editor) return
    const node = editor.state.doc.nodeAt(pos)
    editor.chain().focus().setTextSelection(node?.isTextblock ? pos + 1 : pos).run()
  }, [editor])
  const deleteBlockAt = useCallback((pos: number) => {
    if (!editor) return
    const node = editor.state.doc.nodeAt(pos)
    if (!node) return
    editor.chain().focus().deleteRange({ from: pos, to: pos + node.nodeSize }).run()
    setBlockMenu(null)
  }, [editor])

  useEffect(() => {
    if (!editor || editor.getHTML() === hydratedContent) return
    editor.commands.setContent(hydratedContent, { emitUpdate: false })
  }, [hydratedContent, editor])

  if (!editor) return null

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden", background: "#fff" }}>
      <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(event) => {
        const file = event.target.files?.[0]
        if (file) insertImageFile(file)
        event.target.value = ""
      }} />
      <TiptapToolbar
        editor={editor}
        blockType={blockType}
        fontSize={fontSize}
        toolbarMenu={toolbarMenu}
        fileInputRef={fileInputRef}
        setFontSize={setFontSize}
        setToolbarMenu={setToolbarMenu}
        applyBlockType={applyBlockType}
        runSlashCommand={runSlashCommand}
        setTextAlign={setTextAlign}
        setLink={setLink}
        insertImageFromUrl={insertImageFromUrl}
        onAiRewriteSelected={handleAiRewriteSelected}
      />
      <div style={{ flex: 1, overflow: "auto", padding: "2.25rem 3rem", position: "relative" }}>
        <EditorContent editor={editor} />
        <DragHandle editor={editor} nested onNodeChange={({ pos }) => { setActiveBlockPos(pos); setBlockMenu(null) }}>
          <div className="notion-block-handle">
            <button className="notion-block-add" title="点击在下方添加块" onMouseDown={(event) => { event.preventDefault(); event.stopPropagation(); insertParagraphAfterBlock() }}>＋</button>
            <button className="notion-block-grip" title="拖拽移动 / 点击查看选项" onClick={(event) => {
              event.preventDefault()
              event.stopPropagation()
              if (activeBlockPos != null) {
                const rect = event.currentTarget.getBoundingClientRect()
                setBlockMenu({ top: rect.bottom + 8, left: rect.left, pos: activeBlockPos })
              }
            }}>⠿</button>
          </div>
        </DragHandle>
        {slashMenu && <SlashCommandMenu slashMenu={slashMenu} slashIndex={slashIndex} runSlashCommand={runSlashCommand} />}
        {blockMenu && (
          <BlockCommandMenu
            blockMenu={blockMenu}
            focusBlockAt={focusBlockAt}
            applyBlockType={applyBlockType}
            deleteBlockAt={deleteBlockAt}
            closeBlockMenu={() => setBlockMenu(null)}
          />
        )}
        <style>{getTiptapEditorStyles()}</style>
      </div>
      <FloatingToolbar editor={editor} />
    </div>
  )
}
