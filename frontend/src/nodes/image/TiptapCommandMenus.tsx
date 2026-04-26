import { SLASH_COMMANDS, type BlockMenuState, type BlockType, type SlashMenuState } from "./tiptapEditorConfig"
import { CommandMenu, MenuButton } from "./TiptapMenus"

export function SlashCommandMenu({ slashMenu, slashIndex, runSlashCommand }: {
  slashMenu: SlashMenuState
  slashIndex: number
  runSlashCommand: (id: string) => void
}) {
  return (
    <CommandMenu top={slashMenu.top} left={slashMenu.left}>
      <div style={{ fontSize: "0.6875rem", color: "#8a8f98", padding: "0.375rem 0.75rem" }}>转换为</div>
      {SLASH_COMMANDS.map((command, index) => (
        <MenuButton
          key={command.id}
          icon={command.icon}
          label={command.label}
          hint={command.hint}
          active={index === slashIndex}
          onMouseDown={() => runSlashCommand(command.id)}
        />
      ))}
    </CommandMenu>
  )
}

export function BlockCommandMenu({ blockMenu, focusBlockAt, applyBlockType, deleteBlockAt, closeBlockMenu }: {
  blockMenu: BlockMenuState
  focusBlockAt: (pos: number) => void
  applyBlockType: (type: BlockType) => void
  deleteBlockAt: (pos: number) => void
  closeBlockMenu: () => void
}) {
  const convert = (type: BlockType) => {
    focusBlockAt(blockMenu.pos)
    applyBlockType(type)
    closeBlockMenu()
  }

  return (
    <CommandMenu top={blockMenu.top} left={blockMenu.left}>
      <div style={{ fontSize: "0.6875rem", color: "#8a8f98", padding: "0.375rem 0.75rem" }}>块选项</div>
      <MenuButton icon="¶" label="转换为正文" onMouseDown={() => convert("paragraph")} />
      <MenuButton icon="H1" label="转换为一级标题" onMouseDown={() => convert("h1")} />
      <MenuButton icon="H2" label="转换为二级标题" onMouseDown={() => convert("h2")} />
      <MenuButton icon="❞" label="转换为引用" onMouseDown={() => convert("blockquote")} />
      <MenuButton icon="🗑" label="删除块" onMouseDown={() => deleteBlockAt(blockMenu.pos)} />
    </CommandMenu>
  )
}
