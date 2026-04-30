# Low Zoom Node Perf Slice — 2026-04-30

## Goal

降低 `9%-12%` 低缩放下、大画布里大量图片和图片节点同时可见时的卡顿，并继续处理用户手测反馈的放大编辑卡顿：zoom in 后拖普通图片、添加节点、导入图片、画笔涂画时，避免我们自定义 React 浮层和性能统计跟着每帧全量重算。

## Status

- 低缩放 Image Node LOD / 自适应导入尺寸已完成。
- 放大编辑热路径第二刀已完成：图片计数从每次 store / pointer event 全量扫描，改成只在 image / Image Node 结构变化时重算；普通视图 zoom/pan 只更新 viewport / zoom 指标。
- `NodeCardContent` / Inspector / Selection Toolbar / Style Panel / Navigator / Arrow Overlay / Node Edge Overlay 已从全量 editor store 订阅拆到更窄的 revision modes。
- 小地图在高密度或拖拽/移动视图时降低 shape rect 采样预算；Selection Toolbar 和 Style Panel 在拖拽/移动视图期间隐藏，结束后再回到新位置。
- 用户复测确认“稍微好一点”，但多图多节点仍会卡；本切片已完成 React/overlay 降噪职责，剩余瓶颈转为图片资产渲染成本，需要进入 Asset Pipeline + Image / Node LOD 主线。

## Scope

- 检查 `NodeCard` 是否在 camera pan / zoom 时被整批重渲染。
- 把节点卡片的 editor 订阅从“所有 store 变化”收窄到“shape / asset 文档变化”。
- 增加 canvas performance store，根据浏览器宽度、当前 zoom 和图片/图片节点数量切换 Image Node 预览质量。
- 低缩放 / 多图片时，Image Node 只显示轻量占位，不挂载真实图片。
- 未来普通 canvas image 粘贴/导入的 `maxImageDimension` 按浏览器宽度降低到 768 / 960 / 1152，减少后续大图内存压力。
- 放大编辑场景下，图片数量统计不能在普通拖动、画笔 points 更新、非图片 shape 更新时全量扫 `getCurrentPageShapes()`。
- 小地图和自定义浮层不能在普通 canvas image 拖动时跟着每帧全量重算；需要按 selection / node content / node geometry / viewport-document 等维度收窄订阅。
- 拖动对象或移动视图时，Selection Toolbar / Style Panel 可临时隐藏，结束后再重新计算位置和样式。
- 保持节点数据流、上游 run 输出传播、图片导入和 edge 更新行为不回退。

## Non-goals

- 不重写 tldraw 架构。
- 不引入虚拟列表、React Flow、Konva 或新依赖。
- 不做真实图片缩略图服务。
- 不在这一刀里重构 Node Runtime store。
- 不替换 tldraw 默认 ImageShapeUtil；普通已存在 canvas image 的完整 LOD 后续单独评估。
- 不把本切片继续扩展成正式 Asset Pipeline；后续由 `Asset-lod-roadmap.md` 统一规划。

## Files / Modules

- `apps/web/src/components/canvas/useEditorRevision.ts`
- `apps/web/src/components/canvas/useEditorInteractionState.ts`
- `apps/web/src/features/canvas-performance/canvasPerformanceStore.ts`
- `apps/web/src/features/canvas-performance/editorPerformanceMetrics.ts`
- `apps/web/src/components/canvas/CanvasSpike.tsx`
- `apps/web/src/components/canvas/CanvasSpikeNavigator.tsx`
- `apps/web/src/components/canvas/CanvasSelectionToolbar.tsx`
- `apps/web/src/components/canvas/CanvasSpikeStylePanel.tsx`
- `apps/web/src/components/canvas/CanvasSpikeToolbar.tsx`
- `apps/web/src/components/canvas/CanvasArrowPortOverlay.tsx`
- `apps/web/src/components/canvas/CanvasConnectionCutOverlay.tsx`
- `apps/web/src/components/canvas/CanvasNodeEdgeOverlay.tsx`
- `apps/web/src/components/inspector/CanvasNodeInspector.tsx`
- `apps/web/src/components/nodes/ImageNodePreview.tsx`
- `apps/web/src/app/styles/node-card-content.css`
- `apps/web/src/components/nodes/NodeCardContent.tsx`
- `project_state.md`

## Data Model Impact

- 无新增 document 字段。
- 无 shape props 结构变化。

## Security / Cost Impact

- 无服务端改动。
- 无新依赖、无新 key。

## Acceptance

1. 在低缩放下 pan / zoom 时，`NodeCard` 不再因 camera 变化整批刷新。
2. 图片数量多且 zoom 低于自适应阈值时，Image Node 预览切为轻量占位；放大后恢复真实图片。
3. 后续粘贴/导入普通 canvas image 时，图片最大边随浏览器宽度降低。
4. 上游节点 run 完成后，下游节点输入摘要和可运行状态仍会更新。
5. 导入图片、Screenshot、Convert、To Canvas、断线交互不回退。
6. 放大到可编辑尺度后，拖普通 canvas image、添加节点、导入图片和画笔涂画时，图片计数、小地图、工具浮层、Inspector 和 edge overlay 不应再因普通 shape 更新每帧全量刷新。
7. `lint` / `typecheck` / `build` / `git diff --check` 全通过。

## Manual Test

1. 在 `http://127.0.0.1:3000/spikes/canvas` 放大画布并摆多张图片 / 多个 Image Node。
2. 缩到 `9%-12%` 左右连续 pan / zoom，观察卡顿是否减轻，Image Node 应切为轻量预览。
3. 放大到可阅读尺度，Image Node 应恢复真实图片预览。
4. Prompt → Image Gen / Analysis 连线后，运行或切换上游输入，下游摘要仍应刷新。
5. 再测 `Convert to Image Node`、`To Canvas`、Screenshot、断线按钮，确认无回归。
6. 放大到 100%-200%，选中并拖动多张普通 canvas image，观察 Selection Toolbar / Style Panel 是否拖动中隐藏、松手后回到正确位置，拖动过程不应明显顿挫。
7. 在高密度画布上连续添加节点、导入图片、使用画笔涂画，观察小地图和节点线不会造成明显额外卡顿。

## Rollback Notes

- 如果下游节点不再跟随上游 run / props 更新，先回退 `useEditorRevision.ts` 的订阅过滤逻辑。
- 如果用户觉得低缩放占位太早出现，调低 `canvasPerformanceStore.ts` 的阈值。
- 如果放大编辑时节点数据线不跟随节点移动，优先检查 `useEditorRevision(editor, 'node-geometry')` 是否漏掉 `node_card` geometry 更新。
- 如果 Selection Toolbar / Style Panel 松手后位置不更新，先检查 `useEditorInteractionState.ts` 的 pointer / camera state 同步。

## Handoff To Asset LOD

本切片证明：

- 订阅降噪和低缩放 Image Node placeholder 能改善手感。
- 但当一个工作室项目包含大量普通 canvas image、Image Node 和 AI nodes 时，仅靠 React 层降噪不足。
- 下一阶段必须补统一 Asset Preview Resolver、普通 canvas image thumbnail / LOD、Image Node moving degrade、Node LOD 和正式 Asset Pipeline。
