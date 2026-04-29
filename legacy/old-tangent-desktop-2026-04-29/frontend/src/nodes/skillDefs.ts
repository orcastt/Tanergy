export interface SkillDef {
  id: string
  icon: string
  color: string
  labelKey: string
  descKey: string
  nodes: {
    type: string
    position: { x: number; y: number }
  }[]
  edges: [number, number, string?, string?][]
}

export const SKILL_DEFS: SkillDef[] = [
  {
    id: "wechat_article",
    icon: "article",
    color: "#07C160",
    labelKey: "skills.wechatArticle",
    descKey: "skills.wechatArticleDesc",
    // Full workflow: Text → Research → Outline (auto-split) → N×Text + ImageList → HtmlFormatter → Preview
    nodes: [
      { type: "text_input",        position: { x: 50,  y: 300 } },
      { type: "research",          position: { x: 330, y: 300 } },
      { type: "outline_generator", position: { x: 610, y: 300 } },
      // Split auto-creates: N×text_input + image_list + html_formatter
      { type: "html_formatter",    position: { x: 1050, y: 300 } },
    ],
    edges: [
      [0, 1, "out", "in"],
      [1, 2, "out", "in"],
      [1, 2, "out", "research"],
    ],
  },
  {
    id: "blank",
    icon: "dashboard",
    color: "#6349EA",
    labelKey: "skills.blank",
    descKey: "skills.blankDesc",
    nodes: [],
    edges: [],
  },
]