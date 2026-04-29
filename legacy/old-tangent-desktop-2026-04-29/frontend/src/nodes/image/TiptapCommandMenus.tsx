import { useTranslation } from "react-i18next"
import { SLASH_COMMANDS, type BlockMenuState, type BlockType, type SlashMenuState } from "./tiptapEditorConfig"
import { CommandMenu, MenuButton } from "./TiptapMenus"
import { editorColors, editorTypography } from "../../styles/editorDesign"

export function SlashCommandMenu({ slashMenu, slashIndex, runSlashCommand }: {
  slashMenu: SlashMenuState
  slashIndex: number
  runSlashCommand: (id: string) => void
}) {
  const { t } = useTranslation()
  return (
    <CommandMenu top={slashMenu.top} left={slashMenu.left}>
      <div style={{ ...editorTypography.label, color: editorColors.secondary, padding: "0.375rem 0.75rem" }}>{t("html_editor.menu.convertTo")}</div>
      {SLASH_COMMANDS.map((command, index) => (
        <MenuButton
          key={command.id}
          icon={command.icon}
          label={t(command.labelKey)}
          hint={t(command.hintKey)}
          active={index === slashIndex}
          onMouseDown={() => runSlashCommand(command.id)}
        />
      ))}
    </CommandMenu>
  )
}

export function BlockCommandMenu({ blockMenu, focusBlockAt, applyBlockType, deleteBlockAt, saveBlockToLibrary, closeBlockMenu }: {
  blockMenu: BlockMenuState
  focusBlockAt: (pos: number) => void
  applyBlockType: (type: BlockType) => void
  deleteBlockAt: (pos: number) => void
  saveBlockToLibrary: (pos: number) => void
  closeBlockMenu: () => void
}) {
  const { t } = useTranslation()
  const convert = (type: BlockType) => {
    focusBlockAt(blockMenu.pos)
    applyBlockType(type)
    closeBlockMenu()
  }

  return (
    <CommandMenu top={blockMenu.top} left={blockMenu.left}>
      <div style={{ ...editorTypography.label, color: editorColors.secondary, padding: "0.375rem 0.75rem" }}>{t("html_editor.menu.blockOptions")}</div>
      <MenuButton icon="notes" label={t("html_editor.menu.toParagraph")} onMouseDown={() => convert("paragraph")} />
      <MenuButton icon="title" label={t("html_editor.menu.toH1")} onMouseDown={() => convert("h1")} />
      <MenuButton icon="title" label={t("html_editor.menu.toH2")} onMouseDown={() => convert("h2")} />
      <MenuButton icon="format_quote" label={t("html_editor.menu.toQuote")} onMouseDown={() => convert("blockquote")} />
      <MenuButton icon="folder_open" label={t("html_editor.toolbar.saveToLibrary")} onMouseDown={() => { saveBlockToLibrary(blockMenu.pos); closeBlockMenu() }} />
      <MenuButton icon="delete" label={t("html_editor.menu.deleteBlock")} onMouseDown={() => deleteBlockAt(blockMenu.pos)} />
    </CommandMenu>
  )
}
