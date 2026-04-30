# GLM Next Shift Handoff — 2026-04-30

**Purpose**: 给 GLM 接班修 S1.5 当前阻塞项。  
**Current branch**: `checkpoint/s15-node-runtime-before-refactor`  
**Mode**: 只做 S1.5 小修，不做真实 AI、后端、依赖、legacy、大重构。

---

## 0. Read First

按顺序读：

1. `project_state.md`
2. `PRD.md`
3. `ARCH.md`
4. `HARNESS.md`
5. `dev-plans/node-runtime-data-transfer-slice-2026-04-30.md`
6. `dev-plans/canvas-settings-snap-slice-2026-04-30.md`
7. 本文件

禁止：

- 不读 `.env`。
- 不读不改 `legacy/old-tangent-desktop-2026-04-29/`。
- 不新增 npm 依赖。
- 不切换 React Flow / Konva / 其他画布架构。
- 不接真实 AI API、auth、credits、provider key。
- 不把 `data:` / `blob:` / Base64 写进可持久化 Board document。

---

## 1. Current User Test Result

用户 2026-04-30 手测结论：

| Item | Result | Priority |
|------|--------|----------|
| Snap Alignment | 可用，但红色对齐轴线太深，需要 20% 透明度 | P1 |
| Node output fan-out | 仍失败：同一个 Prompt/Image output 只能接一个下游 input | **P0 Blocker** |
| Input replacement | 需要支持新线直接替换已连接 input，不要先手动断线 | **P0 Blocker** |
| Canvas performance | 目前不卡顿 | Pass |
| External image performance | 目前不卡顿 | Pass |
| Merge Capture | 当前生成 Image Node 可以接受；后续要区分 Screenshot 和 Merge to Image Node | P1 |

最重要任务：**修 Node Runtime fan-out 和 input replacement。**

---

## 2. P0 Blocker — Fan-out And Input Replacement

### 2.1 Expected Behavior

必须实现：

1. 一个 output 端口可以连接多个下游 input：
   - Prompt `text_out` → Image Gen `text_in`
   - 同一个 Prompt `text_out` → Image Gen 4 `text_in`
   - 同一个 Prompt `text_out` → Analysis `prompt_in`
   - Image `image_out` → 多个 Image Gen / Image Gen 4 / Analysis image input
2. 每个 input 端口仍然是单来源：
   - 一个 `text_in` 只能接一条 incoming edge。
   - 一个具体的 `image_in_1` 只能接一条 incoming edge。
3. 当用户把新 source 连接到已占用 input 时，自动替换旧 incoming edge：
   - 不提示 `Input already connected`。
   - 不要求用户先点击 `−` 断线。
   - 替换后旧线消失，新线保留。
4. Fan-out 不应被 replacement 误删：
   - 替换目标 input 时，只删除该 target input 的旧 incoming edge。
   - 不删除同一个 source output 指向其他下游节点的 edges。
5. 删除或替换 edge 后，下游 input summary、Run disabled 状态、dynamic image input count 立即同步。

### 2.2 Likely Files

优先看这些文件：

- `apps/web/src/components/canvas/usePortConnectionCompletion.ts`
- `apps/web/src/features/node-runtime/nodeEdges.ts`
- `apps/web/src/components/nodes/NodePortDot.tsx`
- `apps/web/src/components/canvas/CanvasConnectionLine.tsx`
- `apps/web/src/components/canvas/CanvasNodeEdgeOverlay.tsx`
- `apps/web/src/features/node-runtime/nodeDataFlow.ts`
- `apps/web/src/features/node-runtime/registry.ts`

### 2.3 Current Suspected Cause

先不要盲改，先验证；但当前代码里有两个高风险点：

1. `usePortConnectionCompletion.ts` 有 `isInputPortOccupied()` 早退，导致占用 input 不能替换。
2. `findNearestInputPort()` 过滤了 occupied input，导致用户靠近已连接端口时无法直接替换，只能找空口。

`nodeEdges.ts` 当前 `addEdge()` 只过滤完全重复的 source-target-port，不负责“target input 单来源替换”。GLM 应把规则收敛到 store 或 completion 层，但要保证 output fan-out 不被删。

推荐实现方向：

- 增加 `upsertEdgeForInput(edge)` 或调整 `addEdge()`：
  - 添加新 edge 前，删除所有 `targetShapeId + targetPortId` 相同的旧 edge。
  - 保留其他 target input 的 edges。
  - 如果同一 source output 连接多个不同 target input，全部保留。
- `completeConnection()` 不再对 occupied input 报错；改为替换并提示 `Input replaced` 或 `connection accepted`。
- 几何兜底不要一律跳过 occupied input；允许命中已占用 input 以完成替换。
- 每次 add/replace/remove 后调用 `syncNodeEdgeInputCounts(editor)`。

### 2.4 Required Manual Tests

在 `http://localhost:3000/spikes/canvas` 手测：

1. 新建 Prompt、Image Gen、Image Gen 4。
2. Prompt `text_out` → Image Gen `text_in`，应出现黄色线。
3. 同一个 Prompt `text_out` → Image Gen 4 `text_in`，两条黄色线都保留。
4. 再新建 Analysis，同一个 Prompt `text_out` → Analysis `prompt_in`，三条黄色线都保留。
5. 新建第二个 Prompt，连接到 Image Gen 已占用的 `text_in`，旧 Prompt → Image Gen 线消失，新 Prompt → Image Gen 线出现；Prompt → Image Gen 4 和 Prompt → Analysis 不应被删。
6. 新建 Image，Image `image_out` → Image Gen `image_in_1`；再连同一个 Image 到 Image Gen 4 / Analysis，绿色线都保留。
7. 新建第二个 Image，连接到 Image Gen 已占用 `image_in_1`，旧绿色线被替换，不影响其他下游绿色线。
8. Image Gen / Image Gen 4 多 image 输入时，连接后仍保留一个新的空 image input，直到 P0 上限。
9. 点击 runtime edge 中点 `−`，只删除该一条线，下游摘要同步更新。
10. Run 状态随连接/替换/删除立即变化；没有 text 时 Image Gen Run disabled。

### 2.5 Validation Commands

修完后必须跑：

```bash
npm -C apps/web run lint
npm -C apps/web run typecheck
npm -C apps/web run build
git diff --check
```

行数检查：

```bash
find apps/web/src -type f \( -name '*.ts' -o -name '*.tsx' -o -name '*.css' \) -print0 \
  | xargs -0 wc -l \
  | awk '$2 != "total" && $1 > 300 {print}' \
  | sort -nr
```

应输出为空。

---

## 3. P1 — Snap Alignment Guide Opacity

### Expected Behavior

对齐吸附红色轴线现在太重。改成淡淡可见即可：

- 目标视觉：约 20% opacity。
- 不影响 Snap Alignment 功能。
- 不改全局红色，不影响普通 shape 颜色。

### Notes

这大概率是 tldraw 原生 snap guide 样式。GLM 应用浏览器 DevTools 确认实际 DOM class，再在当前 canvas scope 下覆盖样式。不要凭感觉改整个主题色。

可看文件：

- `apps/web/src/app/globals.css`
- `apps/web/src/app/styles/canvas-shell.css`
- `apps/web/src/app/styles/canvas-settings.css`
- tldraw snap guide 的实际 DOM class（用浏览器 Inspect）

Acceptance:

1. 拖动对象触发对齐时轴线仍出现。
2. 红色 guide 明显降到轻量提示感，约 20% 透明度。
3. 其他 UI 红色状态不变。

---

## 4. P1 — Screenshot vs Merge To Image Node

### Product Clarification

当前 Merge Capture 生成 Image Node，用户可以接受；但后续交互应区分两个动作：

1. **Screenshot**
   - 选中当前对象/组件后直接截图。
   - 截图作为普通 canvas image shape 放回画布。
   - 用户感觉是“把当前选区拍成一张图，贴回白板”。
2. **Merge / Convert To Image Node**
   - 在 Screenshot 之后增加一个 Merge 功能。
   - 把截图转换成 Image Node。
   - Image Node 里预览这张截图，作为后续 Image Gen / Analysis 的 image 输入来源。

### Guardrail

P0 spike 可以用临时 data URL 做本地预览，但不能设计成未来持久化方案。正式保存时必须走：

```text
data URL / blob → POST /api/v1/assets/from-data-url → Asset URL / asset_id → Image Node stores asset ref
```

Acceptance:

1. Screenshot 创建普通图片对象，不是节点卡片。
2. Merge/Convert 创建 Image Node，节点内显示该截图。
3. 导出不截 UI、网格、选择框。
4. 文档状态不能长期保存 `data:` / `blob:`。

---

## 5. Passed / Do Not Spend Time

用户确认当前暂不需要优化：

- 普通画布拖动/缩放目前不卡顿。
- 多张浏览器图片复制进来目前不卡顿。
- 小 UI 细节后面再抠。

GLM 不要花时间重写性能层，也不要继续大改工具栏。

---

## 6. Source Size Guard

继续遵守 `HARNESS.md`：

| File | Risk |
|------|------|
| `apps/web/src/components/canvas/CanvasSpikeStylePanel.tsx` | 接近 300 行 |
| `apps/web/src/components/canvas/CanvasSpikeToolbar.tsx` | 接近 300 行 |
| `apps/web/src/app/styles/canvas-overlays.css` | 接近 300 行 |
| `apps/web/src/app/styles/canvas-settings.css` | 接近 250 行 |
| `apps/web/src/components/canvas/CanvasSettingsPanel.tsx` | 接近 250 行 |

如果必须触碰接近 300 行的文件：

- 小修可以做。
- 新功能必须先拆分。
- 不允许出现 1000 行文件。

---

## 7. Handoff Back To Codex

GLM 2026-04-30 班次已完成全部 P0 和 P1 修复。用户手测确认通过，无遗留阻塞。

### 7.1 改动文件

| File | Change |
|------|--------|
| `apps/web/src/features/node-runtime/nodeEdges.ts` | `addEdge()` 去重规则从完全匹配 source+target+port 改为只按 `targetShapeId + targetPortId` 去重，实现 input 单来源自动替换 + output fan-out 保留 |
| `apps/web/src/components/canvas/usePortConnectionCompletion.ts` | 移除 `isInputPortOccupied` 早退报错，改为检测替换并提示 `Replaced: <label>`；`findNearestInputPort` 移除 occupied 过滤，允许命中已连接 input 完成替换 |
| `apps/web/src/components/canvas/CanvasNodeEdgeOverlay.tsx` | 移除 SVG hit path（26px 宽隐形粗线拦截端口点击），改用 SVG 容器 `onPointerMove` 中点距离检测 hover 状态，解决 fan-out 时输出端口被边覆盖层遮挡无法点击的根因 |
| `apps/web/src/app/styles/node-edge-overlay.css` | 移除 `.node-edge-overlay__path-hit` 样式，新增 `.node-edge-overlay__svg:hover { pointer-events: auto }` |
| `apps/web/src/app/styles/canvas-shell.css` | 新增 `.canvas-spike-stage .tl-snap-indicator` 和 `.tl-snap-point` opacity 0.2 覆盖 |
| `project_state.md` | 更新阶段状态、已完成记录、风险表、下一步 |
| `dev-plans/node-runtime-data-transfer-slice-2026-04-30.md` | 更新 Status 和 Open Blocker |
| `dev-plans/canvas-settings-snap-slice-2026-04-30.md` | 更新 Open Polish |

### 7.2 Fan-out / Replacement 最终数据规则

1. **Output fan-out**：`addEdge()` 去重只按 target（`targetShapeId + targetPortId`）。同一个 source output 连接不同 target input 时，所有 edges 互不影响，全部保留。
2. **Input 单来源 + 自动替换**：`addEdge()` 添加新 edge 前自动删除同一 `targetShapeId + targetPortId` 的旧 edge。不报错、不要求先断线。
3. **Replacement 不误删 fan-out**：替换只删除目标 input 的旧线，不影响同一 source output 到其他下游的 edges。
4. **类型校验**：`validateNodeConnection` 仍保证 text→text / image→image 和方向合法性。
5. **几何兜底**：`findNearestInputPort` 允许命中已占用 input，完成替换。
6. **同步**：每次 add/replace/remove 后 `syncNodeEdgeInputCounts` 更新动态端口。

### 7.3 质量闸门

| Gate | Result |
|------|--------|
| `npm -C apps/web run lint` | ✅ 通过 |
| `npm -C apps/web run typecheck` | ✅ 通过 |
| `npm -C apps/web run build` | ✅ 通过 |
| `git diff --check` | ✅ 无 whitespace 错误 |
| 源码文件行数检查 | ✅ 所有文件 < 300 行，`CanvasNodeEdgeOverlay.tsx` 162 行 |

### 7.4 手测结果

用户 2026-04-30 确认通过：

| 测试项 | 结果 |
|--------|------|
| Prompt text_out → 多个下游 text input（Image Gen / Image Gen 4 / Analysis） | ✅ 多条黄色线保留 |
| Image image_out → 多个下游 image input | ✅ 多条绿色线保留 |
| 新 source 连接到已占用 input 自动替换 | ✅ 旧线消失，新线出现，不影响其他 fan-out |
| runtime edge 中点 `−` 断连 | ✅ 只删一条线 |
| Snap Alignment guide opacity | ✅ 降到轻量提示感 |
| 画布和图片性能 | ✅ 不卡顿 |

### 7.5 文件行数

未触碰接近 300 行的文件，不需要后续拆分。

### 7.6 临时逻辑

无 data URL / blob 逻辑。所有改动都是 Node Runtime edge store 和 CSS 覆盖。

### 7.7 Codex 回来后优先验收

- `useNodeEdgeStore` `addEdge` 去重逻辑是否只按 target input。
- `CanvasNodeEdgeOverlay` hover 检测是否稳定（`−` 按钮在边中点附近是否可靠出现）。
- `nodeDataFlow` 是否按最新 edges 解析数据。
- Image Gen 4 四个 output 是否仍分别传 asset 1-4。
- Screenshot / Merge P1 后续：区分 Screenshot（普通图片贴回画布）与 Merge to Image Node。

---

## 8. Codex Follow-up — Selected Edge Disconnect

用户 2026-04-30 继续手测发现：连线很多时，中点 hover 的 `−` 按钮不稳定，导致部分 runtime edge 无法断开。

更新交互：

1. 鼠标点击一条 runtime data edge，选中该 edge。
2. 被选中的 edge 视觉加粗/高亮。
3. 在该 edge 的下游 target 端附近显示 `−` 断链按钮。
4. 点击 `−` 删除该 edge，并同步下游输入摘要和动态 image input count。

实现约束：

- 不恢复覆盖整条线的粗 hit path，避免再次挡住 source output / target input 端口点击。
- hit 区只覆盖贝塞尔线中段，用于选择 edge。
- 断链按钮显示在靠近 target 的线段上，不直接压住 target input port。
