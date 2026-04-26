import type { RefObject } from "react"
import type { Editor } from "@tiptap/core"
import {
  ALIGN_COMMANDS,
  BLOCK_LABELS,
  EMOJIS,
  HIGHLIGHT,
  SLASH_COMMANDS,
  THEME,
  type AlignType,
  type BlockType,
  type ToolbarMenu,
} from "./tiptapEditorConfig"
import { MenuButton, ToolbarButton, ToolbarDropdown } from "./TiptapMenus"

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
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
      padding: "0.5rem 1rem", borderBottom: "1px solid #e8e8e8",
      background: "#fff", flexShrink: 0, overflowX: "auto",
    }}>
      <ToolbarButton onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title="撤销">↶</ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title="前进">↷</ToolbarButton>
      <InsertMenu toolbarMenu={toolbarMenu} setToolbarMenu={setToolbarMenu} runSlashCommand={runSlashCommand} />
      <BlockSelect blockType={blockType} applyBlockType={applyBlockType} />
      <FontSizeControl editor={editor} fontSize={fontSize} setFontSize={setFontSize} />
      <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")} title="加粗"><b>B</b></ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")} title="斜体"><i>I</i></ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive("underline")} title="下划线"><u>U</u></ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().setColor(THEME).run()} title="文字颜色"><span style={{ textDecoration: "underline", textDecorationColor: THEME }}>A</span></ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleHighlight({ color: HIGHLIGHT }).run()} active={editor.isActive("highlight")} title="高亮">◩</ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive("orderedList")} title="有序列表">≡</ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive("bulletList")} title="无序列表">☷</ToolbarButton>
      <AlignMenu editor={editor} toolbarMenu={toolbarMenu} setToolbarMenu={setToolbarMenu} setTextAlign={setTextAlign} />
      <ToolbarButton onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} title="表格">▦</ToolbarButton>
      <EmojiMenu editor={editor} toolbarMenu={toolbarMenu} setToolbarMenu={setToolbarMenu} />
      <ToolbarButton onClick={() => fileInputRef.current?.click()} title="插入图片">▧</ToolbarButton>
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
  return (
    <div style={{ position: "relative" }}>
      <ToolbarButton onClick={() => setToolbarMenu(toolbarMenu === "insert" ? null : "insert")} title="添加块">＋⌄</ToolbarButton>
      {toolbarMenu === "insert" && (
        <ToolbarDropdown left={0}>
          {SLASH_COMMANDS.slice(0, 10).map((command) => (
            <MenuButton key={command.id} icon={command.icon} label={command.label} hint={command.hint} onMouseDown={() => { setToolbarMenu(null); runSlashCommand(command.id) }} />
          ))}
        </ToolbarDropdown>
      )}
    </div>
  )
}

function BlockSelect({ blockType, applyBlockType }: Pick<TiptapToolbarProps, "blockType" | "applyBlockType">) {
  return (
    <select
      value={blockType}
      onChange={(event) => applyBlockType(event.target.value as BlockType)}
      style={{
        height: 32, minWidth: 132, borderRadius: 6, border: "none",
        background: "#f7f7f7", padding: "0 0.5rem",
        fontSize: "0.875rem", fontWeight: 600, cursor: "pointer",
      }}
    >
      {Object.entries(BLOCK_LABELS).map(([key, value]) => <option key={key} value={key}>{value}</option>)}
    </select>
  )
}

function FontSizeControl({ editor, fontSize, setFontSize }: Pick<TiptapToolbarProps, "editor" | "fontSize" | "setFontSize">) {
  const changeSize = (next: number) => {
    setFontSize(next)
    editor.chain().focus().setMark("textStyle", { fontSize: `${next}px` }).run()
  }

  return (
    <div style={{ display: "flex", alignItems: "center", background: "#f7f7f7", borderRadius: 6, height: 32 }}>
      <ToolbarButton onClick={() => changeSize(Math.max(12, fontSize - 1))} title="减小字号">−</ToolbarButton>
      <span style={{ width: 34, textAlign: "center", fontSize: "0.8125rem" }}>{fontSize}</span>
      <ToolbarButton onClick={() => changeSize(Math.min(32, fontSize + 1))} title="增大字号">＋</ToolbarButton>
    </div>
  )
}

function AlignMenu({ editor, toolbarMenu, setToolbarMenu, setTextAlign }: Pick<TiptapToolbarProps, "editor" | "toolbarMenu" | "setToolbarMenu" | "setTextAlign">) {
  return (
    <div style={{ position: "relative" }}>
      <ToolbarButton
        onClick={() => setToolbarMenu(toolbarMenu === "align" ? null : "align")}
        active={ALIGN_COMMANDS.some((command) => command.id !== "left" && editor.isActive({ textAlign: command.id }))}
        title="对齐方式"
      >↔⌄</ToolbarButton>
      {toolbarMenu === "align" && (
        <ToolbarDropdown left={-90} width={180}>
          {ALIGN_COMMANDS.map((command) => (
            <MenuButton
              key={command.id}
              icon={command.icon}
              label={command.label}
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
  return (
    <div style={{ position: "relative" }}>
      <ToolbarButton onClick={() => setToolbarMenu(toolbarMenu === "emoji" ? null : "emoji")} title="表情">☺</ToolbarButton>
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
  return (
    <div style={{ position: "relative" }}>
      <ToolbarButton onClick={() => setToolbarMenu(toolbarMenu === "more" ? null : "more")} title="更多">···</ToolbarButton>
      {toolbarMenu === "more" && (
        <ToolbarDropdown left={-150}>
          <MenuButton icon="🔗" label="插入链接" onMouseDown={() => { setToolbarMenu(null); setLink() }} />
          <MenuButton icon="🌄" label="图片 URL" onMouseDown={() => { setToolbarMenu(null); insertImageFromUrl() }} />
          <MenuButton icon="✨" label="AI 改写选中文本" onMouseDown={() => { setToolbarMenu(null); onAiRewriteSelected() }} />
        </ToolbarDropdown>
      )}
    </div>
  )
}
