export type PortType =
  | "prompt"
  | "image"
  | "text"
  | "video"
  | "search_result"
  | "structured"
  | "audio"

export type NodeType =
  | "prompt"
  | "chat"
  | "optimize"
  | "analysis"
  | "search"
  | "image_mj"
  | "image_imagen"
  | "image_upload"
  | "preview_wechat"
  | "preview_red"

export const PORT_COLORS: Record<PortType, string> = {
  prompt: "#8B5CF6",
  image: "#22C55E",
  text: "#3B82F6",
  video: "#F97316",
  search_result: "#EF4444",
  structured: "#EAB308",
  audio: "#9CA3AF",
}
