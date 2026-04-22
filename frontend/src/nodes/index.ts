import type { ComponentType } from "react"

export { NODE_DEFS, NODE_MAP } from "./nodeDefs"
export type { NodeDef } from "./nodeDefs"

import TextInputNode from "./TextInputNode"
import ResearchNode from "./ResearchNode"
import OutlineGeneratorNode from "./OutlineGeneratorNode"
import GateNode from "./GateNode"
import WriterNode from "./WriterNode"
import ReviewerNode from "./ReviewerNode"
import ImagePlannerNode from "./ImagePlannerNode"
import ImageGenNode from "./ImageGenNode"
import ImageGalleryNode from "./ImageGalleryNode"
import HtmlFormatterNode from "./HtmlFormatterNode"
import PreviewWechatNode from "./PreviewWechatNode"
import GroupNode from "./GroupNode"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const nodeTypes: Record<string, ComponentType<any>> = {
  text_input: TextInputNode,
  research: ResearchNode,
  outline_generator: OutlineGeneratorNode,
  gate: GateNode,
  writer: WriterNode,
  reviewer: ReviewerNode,
  image_planner: ImagePlannerNode,
  image_gen: ImageGenNode,
  image_gallery: ImageGalleryNode,
  html_formatter: HtmlFormatterNode,
  preview_wechat: PreviewWechatNode,
  group: GroupNode,
}
