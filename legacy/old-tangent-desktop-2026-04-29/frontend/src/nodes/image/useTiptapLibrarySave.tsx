import { useCallback, useMemo, useState } from "react"
import type { Editor } from "@tiptap/core"
import type { Node as ProseMirrorNode } from "@tiptap/pm/model"
import { useTranslation } from "react-i18next"
import LibrarySaveDialog from "../../library/LibrarySaveDialog"

type SaveDialogState = {
  defaultTitle: string
  payload: {
    content_html: string
    plain_text: string
  }
}

export function useTiptapLibrarySave(editor: Editor | null) {
  const { t } = useTranslation()
  const [saveDialog, setSaveDialog] = useState<SaveDialogState | null>(null)

  const saveSelectionToLibrary = useCallback(() => {
    if (!editor) return
    const { from, to } = editor.state.selection
    if (from === to) return
    const plainText = editor.state.doc.textBetween(from, to, "\n").trim()
    if (!plainText) return
    setSaveDialog({
      defaultTitle: makeTitle(plainText, t("html_editor.libraryTitleFallback")),
      payload: { plain_text: plainText, content_html: textToHtml(plainText) },
    })
  }, [editor, t])

  const saveBlockToLibrary = useCallback((pos: number) => {
    if (!editor) return
    const node = editor.state.doc.nodeAt(pos)
    const plainText = node?.textContent.trim() ?? ""
    if (!node || !plainText) return
    setSaveDialog({
      defaultTitle: makeTitle(plainText, t("html_editor.libraryTitleFallback")),
      payload: { plain_text: plainText, content_html: blockToHtml(node) },
    })
  }, [editor, t])

  const librarySaveDialog = useMemo(() => {
    if (!saveDialog) return null
    return (
      <LibrarySaveDialog
        kind="text"
        defaultTitle={saveDialog.defaultTitle}
        payload={saveDialog.payload}
        onClose={() => setSaveDialog(null)}
      />
    )
  }, [saveDialog])

  return { saveSelectionToLibrary, saveBlockToLibrary, librarySaveDialog }
}

function makeTitle(text: string, fallback: string) {
  return text.replace(/\s+/g, " ").slice(0, 28) || fallback
}

function textToHtml(text: string) {
  return `<p>${escapeHtml(text).replace(/\n/g, "<br />")}</p>`
}

function blockToHtml(node: ProseMirrorNode) {
  const text = escapeHtml(node.textContent.trim()).replace(/\n/g, "<br />")
  if (node.type.name === "heading") {
    const level = node.attrs.level ?? 2
    return `<h${level}>${text}</h${level}>`
  }
  if (node.type.name === "blockquote") return `<blockquote>${text}</blockquote>`
  if (node.type.name === "codeBlock") return `<pre><code>${text}</code></pre>`
  if (node.type.name === "bulletList") return `<ul><li>${text}</li></ul>`
  if (node.type.name === "orderedList") return `<ol><li>${text}</li></ol>`
  return `<p>${text}</p>`
}

function escapeHtml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}
