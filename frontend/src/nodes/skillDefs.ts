import type { NodeDef } from "./nodeDefs"

export interface SkillDef {
  id: string
  icon: string
  color: string
  labelKey: string
  descKey: string
  /** Nodes to pre-populate on the canvas */
  nodes: {
    type: string
    position: { x: number; y: number }
  }[]
  /** Edges between pre-populated nodes (index-based) */
  edges: [number, number][]
}

export const SKILL_DEFS: SkillDef[] = [
  {
    id: "wechat_article",
    icon: "article",
    color: "#07C160",
    labelKey: "skills.wechatArticle",
    descKey: "skills.wechatArticleDesc",
    nodes: [
      { type: "text_input", position: { x: 50, y: 200 } },
      { type: "research", position: { x: 300, y: 150 } },
      { type: "outline_generator", position: { x: 550, y: 150 } },
      { type: "gate", position: { x: 800, y: 150 } },
      { type: "writer", position: { x: 1050, y: 150 } },
      { type: "reviewer", position: { x: 1300, y: 150 } },
      { type: "html_formatter", position: { x: 1550, y: 150 } },
      { type: "preview_wechat", position: { x: 1800, y: 150 } },
    ],
    edges: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7]],
  },
  {
    id: "ecommerce",
    icon: "shopping_bag",
    color: "#F97316",
    labelKey: "skills.ecommerce",
    descKey: "skills.ecommerceDesc",
    nodes: [
      { type: "text_input", position: { x: 50, y: 200 } },
      { type: "research", position: { x: 300, y: 150 } },
      { type: "writer", position: { x: 550, y: 150 } },
      { type: "image_planner", position: { x: 800, y: 80 } },
      { type: "image_list", position: { x: 1050, y: 80 } },
      { type: "html_formatter", position: { x: 550, y: 350 } },
      { type: "preview_wechat", position: { x: 800, y: 350 } },
    ],
    edges: [[0, 1], [1, 2], [2, 3], [3, 4], [2, 5], [5, 6]],
  },
  {
    id: "xiaohongshu",
    icon: "auto_awesome",
    color: "#FE2C55",
    labelKey: "skills.xiaohongshu",
    descKey: "skills.xiaohongshuDesc",
    nodes: [
      { type: "text_input", position: { x: 50, y: 200 } },
      { type: "research", position: { x: 300, y: 150 } },
      { type: "writer", position: { x: 550, y: 150 } },
      { type: "image_planner", position: { x: 550, y: 350 } },
      { type: "image_list", position: { x: 800, y: 350 } },
      { type: "reviewer", position: { x: 800, y: 150 } },
    ],
    edges: [[0, 1], [1, 2], [0, 3], [3, 4], [2, 5]],
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
