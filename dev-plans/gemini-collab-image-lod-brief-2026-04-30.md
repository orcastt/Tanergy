# Gemini Review Brief — Studio Collaboration, Many Images, Image LOD

**Date**: 2026-04-30  
**Project**: TANGENT Web AI Image Canvas  
**Purpose**: 请 Gemini 评估当前性能瓶颈和后续架构方向，尤其是面向工作室协同场景时，是否应把 Asset / Image LOD / Thumbnail Cache 提到主线。

---

## 1. Product Direction

TANGENT 现在的目标不是单纯的个人生图工具，而是一个面向工作室协同的 Web AI image canvas：

- 类似 Miro / FigJam 的自由白板体验。
- 画布上会有很多图片、截图、标注、生成结果、参考图。
- AI 能力以节点存在：Prompt / Image Gen / Image Gen 4 / Analysis / Image Node。
- 未来会加入多人协作，团队一起整理项目、拉参考、生成、分析、标注、合并。

这意味着“很多图 + 很多节点”不是边缘压力测试，而是产品默认工作负载。

---

## 2. Current Architecture

当前是 tldraw-first 的 Web canvas 架构：

- `tldraw` 作为白板底座，承载普通图片、画笔、箭头、选择、pan / zoom。
- `node_card` 是 tldraw custom shape，里面用 React 渲染节点 UI。
- Node Runtime 自己管理节点类型、端口、数据连接和 mock run。
- 节点数据线不再使用 tldraw arrow，已改为 runtime edge store + SVG overlay。
- 图片节点只存轻量 asset 引用和尺寸，不把 Base64 / 大图 / provider 原始响应塞进 node props。

已经跑通的关键链路：

- Prompt → Image Gen / Image Gen 4 → Image Node。
- Image + Prompt → Image Gen / Analysis。
- Canvas image → Image Node。
- Image Node → canvas image。
- Merge Capture → Image Node。
- Image Node 本地拖拽 / 双击导入图片。
- Node edge fan-out、input replacement、click-to-select edge + target-end disconnect。

---

## 3. What Has Already Been Optimized

### 3.1 Low Zoom / Image Node LOD

已新增 `canvasPerformanceStore`：

- 根据 zoom、viewport width、image-like count 切换 Image Node preview mode。
- 低缩放 / 高密度时，Image Node 不挂载真实图片，显示轻量占位。
- 后续导入 canvas image 的最大边从固定 1280 改成按浏览器宽度自适应：
  - `<1200px`: 768
  - `<1800px`: 960
  - `>=1800px`: 1152

### 3.2 React Overlay / Subscription Churn

已收窄多处 editor 订阅：

- `NodeCardContent` 不再因 camera pan / zoom 整批刷新。
- Inspector、Selection Toolbar、Style Panel、Navigator、Arrow Overlay、Node Edge Overlay 改为分层订阅。
- 图片数量统计只在 image / Image Node 结构变化时全量重算，不在普通拖图和画笔 points 更新时扫全画布。
- 小地图在高密度或拖拽时采样更少。
- Selection Toolbar / Style Panel 在拖拽或移动视图时临时隐藏。
- Navigator 已支持折叠，折叠态不计算小地图 bounds / shape rects。

这些优化后：

- 低缩放 pan / zoom 有改善。
- 放大编辑也稍微改善。
- 但图片和节点继续变多时仍会卡。

---

## 4. Current Problem

用户最新手测反馈：

> 现在稍微好一点，但是图片还是多了的时候还是会变得卡顿。Image Node 里面有图的时候缩放会有点卡顿，但这是建立在很多图、很多节点的情况下。

当前判断：

- 前面已经减少了 React 浮层和 editor subscription 的无效重算。
- 现在剩下的主要瓶颈更像是图片渲染本身：
  - 很多普通 canvas image 同时存在。
  - 很多 Image Node 内部挂载真实 `<img>` / `next/image` 预览。
  - zoom / pan 时浏览器持续重采样和重绘图片。
  - 低缩放可通过 Image Node placeholder 缓解，但普通 tldraw image shape 仍可能渲染原图。

这说明问题开始从“我们自己的 React 层太吵”转向“资产渲染层需要 LOD”。

---

## 5. Why This Matters For Collaboration

如果未来做工作室协同，真实项目会自然出现：

- 几十到几百张参考图。
- 多轮 AI 生成结果。
- 多个截图 / merge capture 结果。
- 很多 Image Node、Prompt Node、Analysis Node。
- 多人同时 pan / zoom / 拖动 / 添加节点 / 画标注。

多人协作会额外带来：

- presence / cursor / selection overlay。
- remote shape updates。
- board state sync。
- asset upload / permission / cache。

如果单人多图已经卡，多人协作只会放大问题。因此，图片资产和渲染策略可能应该是 P0.5 前置主线，而不是 P1 polish。

---

## 6. Proposed Architecture Direction

不建议现在推翻 tldraw 或重写节点系统。更合理的是保留当前架构，补一个正式的 Asset + LOD 层。

### 6.1 Canvas Document Layer

画布文档只保存轻量信息：

- shape id
- node id
- layout
- edge ids
- asset id
- short params
- runtime summary

协作时 CRDT / sync 也只同步这些轻量状态。

### 6.2 Asset Layer

每张图片都进入统一 asset model：

```text
assetId
originalUrl
thumbnail256Url
thumbnail512Url
thumbnail1024Url
width
height
mime
size
createdBy
permission / workspace scope
```

本地 spike 阶段可先用 browser-side downscale / blob URL / data URL，但正式版本需要 object storage / asset service。

### 6.3 Render LOD Layer

根据本地 UI 状态选择渲染版本：

- zoom 很低：显示 thumbnail 或 placeholder。
- camera moving / zooming：临时显示低质量缩略图。
- camera idle 且图片屏幕尺寸足够大：恢复高清。
- 远离 viewport：不挂载复杂内容。
- Image Node 低缩放：只显示标题 / 状态 / 轻量缩略摘要。
- 普通 canvas image：也应支持 thumbnail，而不是永远用原图。

重要原则：

- LOD 状态是 local UI state，不应进入协作文档。
- Asset id 和尺寸 metadata 可以同步。
- 原图和缩略图 URL 可以从 asset resolver 得到。

---

## 7. Possible Implementation Slices

### Slice A — Image Node Moving Preview Degrade

低风险，短期缓解：

- camera moving / zooming 时，Image Node 临时降级为 reduced preview。
- 停止 100-200ms 后恢复真实图片。
- 不碰普通 tldraw image shape。

预估：0.5-1 天。  
风险：低。  
收益：改善 Image Node 多图缩放体验。

### Slice B — Local Thumbnail Cache For Canvas Images

中等风险，开始接近真实 Miro / Figma：

- 导入 / 粘贴图片时生成本地缩略图。
- 普通 canvas image shape 根据 zoom 和屏幕尺寸选择 original / thumbnail。
- 需要研究 tldraw image shape 的 asset resolver / custom ImageShapeUtil / asset URL 替换点。

预估：2-5 天 spike。  
风险：中。  
收益：解决普通 canvas image 多图渲染成本。

### Slice C — Node LOD

低缩放时所有复杂节点降级：

- 只显示节点标题、类型、状态、小缩略图。
- 不挂载完整表单、port summary、图片预览。
- 放大后恢复完整 React node UI。

预估：1-3 天。  
风险：中低。  
收益：很多节点时减少 React DOM 和图片预览成本。

### Slice D — Real Asset Pipeline

正式协作前必需：

- 后端 asset upload。
- object storage。
- multi-size thumbnail generation。
- signed / permissioned URLs。
- board save 时禁止 `data:` / `blob:` 长期存在。

预估：1-2 周以上，取决于 backend / storage。  
风险：中高。  
收益：为协作和正式上线打基础。

---

## 8. Key Questions For Gemini

1. 在 tldraw-first 架构下，是否足以支撑“工作室协同 + 很多图 + 很多节点”的产品目标？
2. 当前继续补 Asset / LOD 层，而不是换成自研 canvas renderer / Konva / React Flow，是否合理？
3. 普通 canvas image 的 LOD 应该怎么接入 tldraw：
   - custom ImageShapeUtil？
   - asset URL resolver？
   - shape meta / asset props 存多尺寸 URL？
   - 还是在导入阶段直接降采样，原图另存？
4. Image Node 和普通 canvas image 是否应该共用同一个 Asset Preview Resolver？
5. LOD 状态是否应该完全本地化，不进入 CRDT / board document？
6. 在多人协作前，最低必须完成哪几个性能/资产切片？
7. 如果未来目标是 500+ objects / 100+ images / 50+ AI nodes，当前路线还有哪些隐藏风险？
8. 是否需要更早做 viewport virtualization / node unmounting，还是先做 image LOD 就够？

---

## 9. Current Recommendation

当前不建议推翻已有节点和画布实现。  
建议路线：

1. 先做 Image Node camera moving 降级预览，快速缓解。
2. 再做普通 canvas image 的 thumbnail / LOD spike。
3. 同时设计正式 Asset model，避免继续把 `data:` / `blob:` 当成未来持久化方案。
4. 再做 Node LOD。
5. 单人大量图片 / 大量节点稳定后，再进入多人协作。

核心判断：

> 如果 TANGENT 面向工作室协同，那么 Asset Pipeline + Image LOD 不是后期优化，而是协作前置基础设施。

---

## 10. Gemini Review Result / Codex Decision

用户把本 brief 交给 Gemini 后，得到的核心反馈与当前判断一致：

- 保留 tldraw-first 是合理的；当前瓶颈不是画布底座选错，而是很多高清图同时 zoom / pan / drag 时触发浏览器图片解码、GPU 显存和重采样成本。
- Asset Pipeline + Image LOD 应提前到 P0.5 前置主线；如果协作上线时仍把 `data:` / `blob:` / Base64 放入 Board document 或 CRDT，同步和内存都会成为硬阻塞。
- 普通 canvas image 的 LOD 应做独立技术 spike，优先评估 custom `ImageShapeUtil` / asset resolver / 多尺寸 URL 接入点，不要混入普通 UI 小修。
- Image Node 与普通 canvas image 必须共用统一 Asset Preview Resolver。
- LOD 状态必须是本地 UI state，不能同步到 CRDT / Board document。
- 500+ objects / 100+ images / 50+ AI nodes 的另一个风险是 HTMLContainer / React node DOM 数量，因此 Node LOD 也应进入主线。
- 在屏幕内已经塞满很多图的情况下，viewport virtualization 不是第一解；先降低单个图片/节点渲染成本。

Codex 采纳并修正为下一阶段路线：

1. 先做 Image Node camera moving degrade，快速缓解多图缩放。
2. 再做 Node LOD，低缩放时复杂节点只保留标题、类型、状态和轻量缩略摘要。
3. 单独开普通 canvas image thumbnail / LOD spike，研究 tldraw image shape 覆盖方式。
4. 设计统一 Asset Preview Resolver，Image Node 和普通 canvas image 都通过它选择 original / thumbnail / placeholder。
5. 真实 Asset Pipeline 与后端存储并行规划，作为多人协作前置基础设施。

下一步：提交当前 S1.5 稳定快照后，新建 Asset LOD 分支并写正式 `Asset-lod-roadmap.md`。
