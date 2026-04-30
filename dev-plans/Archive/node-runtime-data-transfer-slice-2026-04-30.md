# Node Runtime Data Transfer Slice — 2026-04-30

## Goal

验证 S1.5 节点连线不只是视觉连接，而是能按 `text` / `image` 类型传递 mock 数据。

## Status

2026-04-30 Codex 已完成首轮实现，进入手测确认。

2026-04-30 用户手测发现 P0 blocker：同一个 Prompt / Image output fan-out 到多个下游 input 仍失败；已占用 input 也不能直接被新连接替换。下一班次优先按 `dev-plans/Archive/glm-next-shift-handoff-2026-04-30.md` 修复。

2026-04-30 GLM 修复 fan-out + auto-replacement：`nodeEdges.ts` 的 `addEdge()` 改为按 `targetShapeId + targetPortId` 去重，新连接自动替换同一 target input 的旧 edge，同时保留同一 source output 到其他下游的 fan-out edges；`usePortConnectionCompletion.ts` 移除 `isInputPortOccupied` 阻断和 `findNearestInputPort` 占用过滤。质量闸门全通过。等待用户手测确认。

2026-04-30 Codex 根据密集连线手测反馈调整断链交互：runtime edge 不再依赖中点 hover 出现 `−`；用户点击数据线后选中该 edge，选中线加粗，并在下游 target 端附近显示 `−` 断链按钮。hit 区只覆盖贝塞尔线中段，避免再次遮挡 source output / target input 端口。质量闸门全通过，等待用户手测确认。

## Scope

- Prompt output 向下游传递文本。
- Image output 向下游传递轻量图片引用。
- Image Gen / Image Gen 4 读取 text 和 image inputs，并生成 1 / 4 个 mock asset id。
- Analysis 读取 image 和 prompt inputs，并输出 mock text。
- 删除 runtime edge 后，下游输入状态同步缺失。
- Inspector 显示当前节点输入摘要。

## Non-goals

- 不接真实 AI API。
- 不接后端、credits、Model Registry。
- 不把 Base64 / 大图 / Provider 原始响应写入节点。
- 不做长期持久化保存；本切片先验证 runtime 数据流。

## Acceptance

1. Prompt 文本修改后，下游 Image Gen 能读取最新文本。
2. Image Gen 未连接 text 时 Run disabled / 显示缺失提示。
3. 连接 Prompt → Image Gen 后 Run 可用，mock 输出 asset id。
4. Image → Analysis 后 Analysis Run 可用，输出 mock 反推提示词文本。
5. Analysis → Prompt / Image Gen 后，下游能读取 Analysis text output。
6. Image Gen / Image Gen 4 多 image 输入连接后，动态 image input 端口仍稳定。
7. 删除 edge 后，下游输入摘要和 Run 状态同步更新。
8. 同一个 Prompt / Image 输出端口可以 fan-out 连接多个下游输入。
9. Image Gen 4 输出拆成 4 个 image 输出端口，分别传递 asset 1-4。

## Implemented

- `nodeDataFlow` 解析 runtime edge，递归读取上游 text / image 轻量引用。
- Node Card 根据输入摘要显示 Run 可用性、缺失提示和 mock 输出。
- Image Gen / Image Gen 4 mock Run 生成 1 / 4 个 asset id，并带 prompt/ref 数量痕迹。
- Analysis mock Run 输出 `textOutput`，可继续作为下游 text 输入。
- 左侧 Inspector 显示 runtime input count、run hint、runtime output 和 payload guard。
- 触碰源码文件均保持 300 行以下；`NodeCardContent` 已拆出 `NodeCardPreviews`。

## Follow-up Fixes

- 允许一个 source output 连接多个下游 input；每个 input 仍保持单来源，避免输入语义混乱。
- 最近端口兜底命中会跳过已连接 input，避免第二条线被吸到已有连接的端口。
- `Image Gen 4` 输出端口拆为 `Asset 1 out` 到 `Asset 4 out`，每个端口只传对应 mock asset。
- 断链交互改为 click-to-select edge，target 端附近显示 `−`；不再依赖密集线场景下不稳定的中点 hover。

## Open Blocker

- ~~Output fan-out 用户手测仍未通过。修复时必须保证 source output 可连多个不同 target input。~~ GLM 2026-04-30 已修复，等待手测。
- ~~Input replacement 用户要求直接支持。连接到已占用 input 时，自动替换该 input 的旧 incoming edge；不要提示用户先断线。~~ GLM 2026-04-30 已修复，等待手测。
- ~~不要让 replacement 删除同一 source output 的其他 fan-out edges。~~ 已确认 `addEdge` 只按 target input 去重，不影响其他下游。

## Manual Test

1. 新建 Prompt 和 Image Gen，先不连线：Image Gen 应显示 `Connect a prompt first.`，Run 不可点。
2. 连 Prompt text out → Image Gen text in：Image Gen 应显示 ready，Run 后出现 1 个 mock asset。
3. 新建 Image Gen 4，连同一个 Prompt：Run 后应出现 4 个 mock asset。
4. 新建 Image 和 Analysis，连 Image image out → Analysis image in：Analysis Run 后应出现 mock analysis text。
5. 连 Analysis text out → Prompt / Image Gen text in：下游 Inspector 的 text count 应增加。
6. 删除中间 runtime edge：下游 input count 和 Run 可用状态应立即更新。
7. 同一个 Prompt text out 分别连接 Image Gen 和 Image Gen 4：两边都应保留连接。
8. Image Gen 4 Run 后，从 Asset 1/2/3/4 四个输出分别连到 Image/Analysis：每条下游只收到对应 asset。
9. 密集连线场景中点击某条 runtime edge：该线应加粗选中，并在下游 target 端附近显示 `−`；点击后只删除该一条线。
