import type { RefObject } from "react"
import type { Editor } from "@tiptap/core"
import { useTranslation } from "react-i18next"
import {
  ALIGN_COMMANDS,
  BLOCK_LABEL_KEYS,
  BLOCK_TYPES,
  EMOJIS,
  HIGHLIGHT,
  SLASH_COMMANDS,
  THEME,
  type AlignType,
  type BlockType,
  type ToolbarMenu,
} from "./tiptapEditorConfig"
import { MenuButton, ToolbarButton, ToolbarDropdown } from "./TiptapMenus"
import { editorColors, editorShadows } from "../../styles/editorDesign"

interface TiptapToolbarProps {
  editor: Editor
  blockType: BlockType
  fontSize: number
  toolbarMenu: ToolbarMenu
  fileInputRef: RefObject<HTMLInputElement | null>
  setFontSize: (value: number) => void
  setToolbarMenu: (value: ToolbarMenu) => void
  applyBlockType: (type: BlockType) => void
  runSlashCommand: (id: string) => void
  setTextAlign: (align: AlignType) => void
  setLink: () => void
  insertImageFromUrl: () => void
  onAiRewriteSelected: () => void
}

export default function TiptapToolbar({
  editor,
  blockType,
  fontSize,
  toolbarMenu,
  fileInputRef,
  setFontSize,
  setToolbarMenu,
  applyBlockType,
  runSlashCommand,
  setTextAlign,
  setLink,
  insertImageFromUrl,
  onAiRewriteSelected,
}: TiptapToolbarProps) {
  const { t } = useTranslation()
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
      padding: "0.375rem 1rem",
      background: "transparent", flexShrink: 0, overflow: "visible",
      position: "relative", zIndex: 13000,
    }}>
      <ToolbarButton onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title={t("html_editor.toolbar.undo")}><Icon name="undo" /></ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title={t("html_editor.toolbar.redo")}><Icon name="redo" /></ToolbarButton>
      <InsertMenu toolbarMenu={toolbarMenu} setToolbarMenu={setToolbarMenu} runSlashCommand={runSlashCommand} />
      <BlockSelect blockType={blockType} applyBlockType={applyBlockType} />
      <FontSizeControl editor={editor} fontSize={fontSize} setFontSize={setFontSize} />
      <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")} title={t("html_editor.toolbar.bold")}><Icon name="format_bold" /></ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")} title={t("html_editor.toolbar.italic")}><Icon name="format_italic" /></ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive("underline")} title={t("html_editor.toolbar.underline")}><Icon name="format_underlined" /></ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().setColor(THEME).run()} title={t("html_editor.toolbar.textColor")}><Icon name="format_color_text" /></ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleHighlight({ color: HIGHLIGHT }).run()} active={editor.isActive("highlight")} title={t("html_editor.toolbar.highlight")}><Icon name="format_ink_highlighter" /></ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive("orderedList")} title={t("html_editor.toolbar.orderedList")}><Icon name="format_list_numbered" /></ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive("bulletList")} title={t("html_editor.toolbar.bulletList")}><Icon name="format_list_bulleted" /></ToolbarButton>
      <AlignMenu editor={editor} toolbarMenu={toolbarMenu} setToolbarMenu={setToolbarMenu} setTextAlign={setTextAlign} />
      <ToolbarButton onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} title={t("html_editor.toolbar.table")}><Icon name="table" /></ToolbarButton>
      <EmojiMenu editor={editor} toolbarMenu={toolbarMenu} setToolbarMenu={setToolbarMenu} />
      <ToolbarButton onClick={() => fileInputRef.current?.click()} title={t("html_editor.toolbar.image")}><Icon name="image" /></ToolbarButton>
      <MoreMenu
        toolbarMenu={toolbarMenu}
        setToolbarMenu={setToolbarMenu}
        setLink={setLink}
        insertImageFromUrl={insertImageFromUrl}
        onAiRewriteSelected={onAiRewriteSelected}
      />
    </div>
  )
}

function InsertMenu({ toolbarMenu, setToolbarMenu, runSlashCommand }: Pick<TiptapToolbarProps, "toolbarMenu" | "setToolbarMenu" | "runSlashCommand">) {
  const { t } = useTranslation()
  return (
    <div style={{ position: "relative" }}>
      <ToolbarButton onClick={() => setToolbarMenu(toolbarMenu === "insert" ? null : "insert")} title={t("html_editor.toolbar.insertBlock")}><Icon name="add" /></ToolbarButton>
      {toolbarMenu === "insert" && (
        <ToolbarDropdown left={0}>
          {SLASH_COMMANDS.slice(0, 10).map((command) => (
            <MenuButton key={command.id} icon={command.icon} label={t(command.labelKey)} hint={t(command.hintKey)} onMouseDown={() => { setToolbarMenu(null); runSlashCommand(command.id) }} />
          ))}
        </ToolbarDropdown>
      )}
    </div>
  )
}

function BlockSelect({ blockType, applyBlockType }: Pick<TiptapToolbarProps, "blockType" | "applyBlockType">) {
  const { t } = useTranslation()
  return (
    <select
      value={blockType}
      onChange={(event) => applyBlockType(event.target.value as BlockType)}
      style={{
        height: 32, minWidth: 132, borderRadius: 6, border: "none",
        background: editorColors.surface, padding: "0 0.5rem", boxShadow: editorShadows.ring,
        fontSize: "0.875rem", fontWeight: 600, cursor: "pointer",
      }}
    >
      {BLOCK_TYPES.map((key) => <option key={key} value={key}>{t(BLOCK_LABEL_KEYS[key])}</option>)}
    </select>
  )
}

function FontSizeControl({ editor, fontSize, setFontSize }: Pick<TiptapToolbarProps, "editor" | "fontSize" | "setFontSize">) {
  const { t } = useTranslation()
  const changeSize = (next: number) => {
    setFontSize(next)
    editor.chain().focus().setMark("textStyle", { fontSize: `${next}px` }).run()
  }

  return (
    <div style={{ display: "flex", alignItems: "center", background: editorColors.surface, borderRadius: 6, height: 32, boxShadow: editorShadows.ring }}>
      <ToolbarButton onClick={() => changeSize(Math.max(12, fontSize - 1))} title={t("html_editor.toolbar.decreaseFont")}><Icon name="remove" /></ToolbarButton>
      <span style={{ width: 34, textAlign: "center", fontSize: "0.8125rem" }}>{fontSize}</span>
      <ToolbarButton onClick={() => changeSize(Math.min(32, fontSize + 1))} title={t("html_editor.toolbar.increaseFont")}><Icon name="add" /></ToolbarButton>
    </div>
  )
}

function AlignMenu({ editor, toolbarMenu, setToolbarMenu, setTextAlign }: Pick<TiptapToolbarProps, "editor" | "toolbarMenu" | "setToolbarMenu" | "setTextAlign">) {
  const { t } = useTranslation()
  return (
    <div style={{ position: "relative" }}>
      <ToolbarButton
        onClick={() => setToolbarMenu(toolbarMenu === "align" ? null : "align")}
        active={ALIGN_COMMANDS.some((command) => command.id !== "left" && editor.isActive({ textAlign: command.id }))}
        title={t("html_editor.toolbar.align")}
      ><Icon name="format_align_left" /></ToolbarButton>
      {toolbarMenu === "align" && (
        <ToolbarDropdown left={-90} width={180}>
          {ALIGN_COMMANDS.map((command) => (
            <MenuButton
              key={command.id}
              icon={command.icon}
              label={t(command.labelKey)}
              active={command.id === "left" ? !ALIGN_COMMANDS.some((item) => item.id !== "left" && editor.isActive({ textAlign: item.id })) : editor.isActive({ textAlign: command.id })}
              onMouseDown={() => { setToolbarMenu(null); setTextAlign(command.id) }}
            />
          ))}
        </ToolbarDropdown>
      )}
    </div>
  )
}

function EmojiMenu({ editor, toolbarMenu, setToolbarMenu }: Pick<TiptapToolbarProps, "editor" | "toolbarMenu" | "setToolbarMenu">) {
  const { t } = useTranslation()
  return (
    <div style={{ position: "relative" }}>
      <ToolbarButton onClick={() => setToolbarMenu(toolbarMenu === "emoji" ? null : "emoji")} title={t("html_editor.toolbar.emoji")}><Icon name="mood" /></ToolbarButton>
      {toolbarMenu === "emoji" && (
        <ToolbarDropdown left={-120} width={220}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 4 }}>
            {EMOJIS.map((emoji) => (
              <button
                key={emoji}
                onMouseDown={(event) => {
                  event.preventDefault()
                  editor.chain().focus().insertContent(emoji).run()
                  setToolbarMenu(null)
                }}
                style={{ border: "none", background: "transparent", fontSize: "1.125rem", cursor: "pointer", padding: 6, borderRadius: 6 }}
              >{emoji}</button>
            ))}
          </div>
        </ToolbarDropdown>
      )}
    </div>
  )
}

function MoreMenu({ toolbarMenu, setToolbarMenu, setLink, insertImageFromUrl, onAiRewriteSelected }: Pick<TiptapToolbarProps, "toolbarMenu" | "setToolbarMenu" | "setLink" | "insertImageFromUrl" | "onAiRewriteSelected">) {
  const { t } = useTranslation()
  return (
    <div style={{ position: "relative" }}>
      <ToolbarButton onClick={() => setToolbarMenu(toolbarMenu === "more" ? null : "more")} title={t("html_editor.toolbar.more")}><Icon name="more_horiz" /></ToolbarButton>
      {toolbarMenu === "more" && (
        <ToolbarDropdown left={-150}>
          <MenuButton icon="link" label={t("html_editor.toolbar.insertLink")} onMouseDown={() => { setToolbarMenu(null); setLink() }} />
          <MenuButton icon="add_photo_alternate" label={t("html_editor.toolbar.imageUrl")} onMouseDown={() => { setToolbarMenu(null); insertImageFromUrl() }} />
          <MenuButton icon="auto_fix_high" label={t("html_editor.toolbar.rewriteSelected")} onMouseDown={() => { setToolbarMenu(null); onAiRewriteSelected() }} />
        </ToolbarDropdown>
      )}
    </div>
  )
}

function Icon({ name }: { name: string }) {
  return <span className="material-symbols-outlined" style={{ fontSize: 17 }}>{name}</span>
}
