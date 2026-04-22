export type PortType =
  | "text"
  | "research_result"
  | "outline_options"
  | "image_plans"
  | "image"
  | "image_slot"
  | "structured"

export type NodeType =
  | "text_input"
  | "research"
  | "outline_generator"
  | "gate"
  | "writer"
  | "reviewer"
  | "image_planner"
  | "image_gen"
  | "image_gallery"
  | "html_formatter"
  | "preview_wechat"
  | "group"

export const PORT_COLORS: Record<PortType, string> = {
  text: "#3B82F6",
  research_result: "#92400E",
  outline_options: "#7C3AED",
  image_plans: "#8B5CF6",
  image: "#22C55E",
  image_slot: "#86EFAC",
  structured: "#EAB308",
}
