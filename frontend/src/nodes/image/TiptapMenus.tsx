import { useEffect, useState, type ReactNode } from "react"
import type { Editor } from "@tiptap/core"
import { useTranslation } from "react-i18next"
import { HIGHLIGHT } from "./tiptapEditorConfig"
import { editorColors, editorShadows } from "../../styles/editorDesign"

export function ToolbarButton({ onClick, active, title, children, disabled }: {
  onClick: () => void
  active?: boolean
  title: string
  children: ReactNode
  disabled?: boolean
}) {
  return (
    <button
      onMouseDown={(event) => { event.preventDefault(); if (!disabled) onClick() }}
      disabled={disabled}
      title={title}
      style={{
        width: 30, height: 30, borderRadius: 6, border: "none",
        background: active ? editorColors.primary : "transparent",
        color: active ? "#fff" : disabled ? editorColors.placeholder : editorColors.text,
        cursor: disabled ? "not-allowed" : "pointer", display: "flex",
        alignItems: "center", justifyContent: "center",
        fontSize: "14px", fontWeight: active ? 700 : 500,
      }}
    >
      {children}
    </button>
  )
}

export function MenuButton({ icon, label, hint, onMouseDown, active }: {
  icon: ReactNode
  label: string
  hint?: string
  onMouseDown: () => void
  active?: boolean
}) {
  return (
    <button
      onMouseDown={(event) => { event.preventDefault(); onMouseDown() }}
      style={{
        width: "100%", display: "flex", alignItems: "center", gap: "0.625rem",
        padding: "0.5rem 0.75rem", border: "none",
        background: active ? editorColors.hover : "transparent",
        color: editorColors.text, cursor: "pointer", textAlign: "left", borderRadius: 6,
      }}
    >
      <span style={{ width: 22, color: editorColors.secondary, display: "inline-flex", justifyContent: "center", fontWeight: 700 }}>
        {typeof icon === "string" ? <span className="material-symbols-outlined" style={{ fontSize: 17 }}>{icon}</span> : icon}
      </span>
      <span style={{ flex: 1, fontSize: "0.8125rem", fontWeight: 500 }}>{label}</span>
      {hint && <span style={{ fontSize: "0.6875rem", color: editorColors.secondary }}>{hint}</span>}
    </button>
  )
}

export function FloatingToolbar({ editor, onSaveSelection }: { editor: Editor; onSaveSelection: () => void }) {
  const { t } = useTranslation()
  const [visible, setVisible] = useState(false)
  const [position, setPosition] = useState({ top: 0, left: 0 })

  useEffect(() => {
    const update = () => {
      const { from, to } = editor.state.selection
      if (from === to) { setVisible(false); return }
      const selection = window.getSelection()
      if (!selection || selection.rangeCount === 0) { setVisible(false); return }
      const rect = selection.getRangeAt(0).getBoundingClientRect()
      setPosition({ top: rect.top - 54, left: rect.left + rect.width / 2 })
      setVisible(true)
    }
    editor.on("selectionUpdate", update)
    editor.on("transaction", update)
    return () => {
      editor.off("selectionUpdate", update)
      editor.off("transaction", update)
    }
  }, [editor])

  if (!visible) return null

  return (
    <div
      style={{
        position: "fixed", top: position.top, left: position.left,
        transform: "translateX(-50%)", display: "flex", gap: 2,
        padding: "0.25rem 0.375rem", background: editorColors.primary,
        borderRadius: 8, boxShadow: editorShadows.panel, zIndex: 11000,
      }}
    >
      <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")} title={t("html_editor.toolbar.bold")}><span className="material-symbols-outlined" style={{ color: "#fff", fontSize: 16 }}>format_bold</span></ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")} title={t("html_editor.toolbar.italic")}><span className="material-symbols-outlined" style={{ color: "#fff", fontSize: 16 }}>format_italic</span></ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive("underline")} title={t("html_editor.toolbar.underline")}><span className="material-symbols-outlined" style={{ color: "#fff", fontSize: 16 }}>format_underlined</span></ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleHighlight({ color: HIGHLIGHT }).run()} active={editor.isActive("highlight")} title={t("html_editor.toolbar.highlight")}><span className="material-symbols-outlined" style={{ color: "#fff", fontSize: 16 }}>format_ink_highlighter</span></ToolbarButton>
      <ToolbarButton onClick={onSaveSelection} title={t("html_editor.toolbar.saveToLibrary")}><span className="material-symbols-outlined" style={{ color: "#fff", fontSize: 16 }}>folder_open</span></ToolbarButton>
    </div>
  )
}

export function ToolbarDropdown({ children, left = 0, width = 220 }: { children: ReactNode; left?: number; width?: number }) {
  return (
    <div style={{
      position: "absolute", top: 36, left, width, background: editorColors.surface,
      border: "none", borderRadius: 8,
      boxShadow: editorShadows.panel, padding: "0.375rem", zIndex: 12000,
    }}>
      {children}
    </div>
  )
}

export function CommandMenu({ children, top, left }: { children: ReactNode; top: number; left: number }) {
  return (
    <div style={{
      position: "fixed", top, left, width: 224, maxHeight: 420, overflowY: "auto",
      background: editorColors.surface, border: "none", borderRadius: 8,
      boxShadow: editorShadows.panel, padding: "0.375rem", zIndex: 12000,
    }}>
      {children}
    </div>
  )
}
