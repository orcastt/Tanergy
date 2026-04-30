# GLM Shift Handback — 2026-04-29

**Branch**: `checkpoint/s15-node-runtime-before-refactor`
**GLM shift**: 端口连线交互重写、Node Picker、Selection Toolbar、Run UI 优化
**Codex 复核要点**: 见第 5 节

---

## 1. Current State

- **分支**: `checkpoint/s15-node-runtime-before-refactor`
- **工作区**: dirty（未 commit）
- **lint**: 0 errors, 0 warnings
- **typecheck**: pass
- **build**: pass
- **文件行数**: 全部 ≤300 行（NodeCardContent 294 行最接近上限）

## 2. What GLM Changed

### 新增文件（5 个）

| 文件 | 行数 | 用途 |
|------|------|------|
| `components/canvas/portConnectionStore.ts` | 25 | Zustand store 管理端口连接状态（connectingFrom + mouseScreenPoint） |
| `components/canvas/CanvasConnectionLine.tsx` | 40 | 拖拽连线时跟随鼠标的临时虚线 SVG overlay |
| `components/canvas/usePortConnectionCompletion.ts` | 113 | 端口连线完成逻辑：校验连接规则 + 程序化创建 tldraw arrow + bindings |
| `components/canvas/CanvasNodePicker.tsx` | 80 | 双击画布弹出的分类 Node Picker（Text: Prompt/Analysis; Image: Image Gen/4/Image） |
| `components/canvas/CanvasSelectionToolbar.tsx` | 150 | 选中 2+ 对象时显示的浮动工具栏（📷 Screenshot + ⊞ 对齐下拉） |

### 修改文件（8 个）

| 文件 | 变更内容 |
|------|----------|
| `components/nodes/NodeCardContent.tsx` | 端口改为 drag-to-connect 交互（pointerdown→全局 pointermove→pointerup）；端口 hover 显示黑底白字 tooltip；Run 按钮移至标题栏右侧；去掉 IDLE/SUCCEEDED 状态文字；精简冗余文字 |
| `components/nodes/NodeCardShape.tsx` | 新增 `getEditorPagePoint` 函数传给 NodeCardContent 用于坐标转换 |
| `components/canvas/CanvasSpike.tsx` | 接入 CanvasConnectionLine、CanvasNodePicker、CanvasSelectionToolbar；移除 CanvasMergeCapturePanel |
| `features/node-runtime/createNodeCard.ts` | 增大默认节点高度：Prompt 220、Image Gen 320、Image Gen 4 350、Analysis 340、Image 240 |
| `styles/node-card-content.css` | 端口 `pointer-events: auto`，hover 放大，tooltip 黑底白字样式 |
| `styles/node-card-base.css` | Run 按钮样式（含 Stop 红色态）；精简 header 样式 |
| `styles/canvas-overlays.css` | 连接线 overlay、Node Picker 分类面板、Selection Toolbar 浮动工具栏样式 |

## 3. User Test Results

| 测试项 | 结果 |
|--------|------|
| 节点创建/拖拽/复制/删除 | ✅ 通过，流畅 |
| 节点内部交互不穿透画布 | ✅ 通过 |
| 端口 tooltip（hover 显示 text/image） | ✅ 通过 |
| 端口连线（drag-to-connect） | ⚠️ 已实现但用户尚未确认连线是否成功创建（连线颜色/校验未复测） |
| Node Picker（双击弹出分类面板） | ✅ 面板出现，用户要求分类（已实现 Text/Image 分组） |
| Run/Stop 按钮 | ✅ 通过 |
| 节点内容自适应 | ✅ 通过 |
| Selection Toolbar（Screenshot + 对齐） | ✅ 工具栏出现，用户已确认功能需求 |
| 60 节点压力测试 | ✅ 流畅不卡顿 |
| Merge Capture 位置 | 已改为 Selection Toolbar 中的 Screenshot 按钮 |
| 图片密集压力测试 | 未测试 |

## 4. Known Issues / Follow-up

| # | 事项 | 优先级 |
|---|------|--------|
| 1 | 端口 drag-to-connect 连线交互已实现，需 Codex 复测确认 arrow 创建和绑定正确 | P0 |
| 2 | Screenshot 功能使用 `editor.toImageDataUrl()` 创建截图，但 P0 规格要求离屏渲染不包含 UI — 需验证 | P0 |
| 3 | 对齐功能只实现了上/下/左/右/居中，尚未实现"横向等距排布"和"纵向等距排布" | P1 |
| 4 | Run 按钮 hover 显示积分扣除数量 — 用户提到后续要加，P0 不阻塞 | P1 |
| 5 | 打组功能（Group）— 用户提到但未在本次实现 | P1 |
| 6 | 端口连线时如果快速拖动可能丢失 pointerup 事件 — 需要实际测试 | P1 |
| 7 | 图片密集压力测试仍未完成 | P1 |
| 8 | NodeCardContent.tsx 294 行，接近 300 行上限，下次改动前需拆分 | 维护 |

## 5. What Codex Should Verify

### 5.1 Git / Diff

```bash
git branch --show-current        # 应为 checkpoint/s15-node-runtime-before-refactor
git status --short                # 应有 8 modified + 5 untracked
git diff --stat                   # 确认变更范围
```

确认：
- GLM 是否误触 `.env`、legacy archive 或非 S1.5 范围文件
- 所有新增文件是否职责单一、不超过 300 行

### 5.2 Quality Gates

```bash
npm -C apps/web run lint          # 应 0 error
npm -C apps/web run typecheck     # 应 pass
npm -C apps/web run build         # 应 pass
git diff --check                  # 应 empty
```

文件行数检查：

```bash
find apps/web/src -type f \( -name '*.ts' -o -name '*.tsx' -o -name '*.css' \) -print0 \
  | xargs -0 wc -l \
  | awk '$2 != "total" && $1 > 300 {print}' \
  | sort -nr
```

应输出为空。

### 5.3 Manual UI Verification

Codex 应引导用户复测：
1. **端口连线**：从 Prompt 右侧黄色输出端口按住 → 拖到 Image Gen 左侧黄色输入端口 → 释放 → 应出现黄色连线
2. **非法连线**：尝试 image 端口连到 text 端口 → 应被校验拒绝
3. **连线颜色**：text 连线黄色，image 连线绿色
4. **断开按钮**：鼠标靠近 node-node 连线中点 → `−` 按钮出现 → 点击断开
5. **动态 image 端口**：Image → Image Gen image 输入 → 是否自动新增空端口
6. **Screenshot**：选中 2+ 形状 → bounding box 上方 📷 → 点击 → 是否在下方创建 Image Node
7. **对齐**：选中多个形状 → ⊞ → 各种对齐是否正确

### 5.4 Architecture / Scope Review

GLM 未触碰以下边界：
- ❌ 无真实 AI API 调用
- ❌ 无后端 auth / credits / provider 修改
- ❌ 无新依赖添加
- ❌ 无 legacy archive 访问
- ❌ 无画布库替换

需要关注：
- `portConnectionStore.ts` 使用 Zustand 在 tldraw HTMLContainer 内共享状态 — 确认跨 React root 是否可靠
- `usePortConnectionCompletion.ts` 使用 `window.dispatchEvent(CustomEvent)` 通信 — 确认是否有更好的方式
- `CanvasSelectionToolbar.tsx` 使用 `editor.getShapeGeometry()` 和 `editor.getShapePageTransform()` — 这些方法在 tldraw 类型声明中不存在但在运行时可用，确认 tldraw 版本兼容性

## 6. Recommendation

1. 如果连线复测通过 → 建议创建 checkpoint commit，然后进入正式五节点 UI 链路
2. 如果连线有问题 → 优先修复连线，这是 S1.5 的核心裁决项
3. 无论结果 → 建议将 `NodeCardContent.tsx`（294 行）拆分端口相关代码到独立文件

---

## 7. Codex Follow-up — Port Connection Fix

**时间**: 2026-04-29

结论：端口连线失败暂不判定为 tldraw 框架不可行，当前更像实现层问题。

已修复：

- 将端口起点从 `event.nativeEvent.offsetX/Y` 改为 `shape.props.w/h + port.anchorY` 计算，避免把端口局部坐标误当作节点局部坐标。
- 将目标端口识别从单纯 `document.elementFromPoint()` 改为“DOM 精确命中 + 最近输入端口几何命中”双路径，降低 tldraw canvas / overlay / pointer 事件干扰。
- 拆出 `components/nodes/NodePortDot.tsx`，让 `NodeCardContent.tsx` 从 294 行降到 217 行。
- 保留 tldraw arrow + binding 作为真实连线载体，因此断连按钮、类型颜色和现有连接校验可继续复用。

已通过：

```bash
npm -C apps/web run lint
npm -C apps/web run typecheck
npm -C apps/web run build
git diff --check
```

待手测：

1. Prompt `text_out` → Image Gen `text_in`：应创建黄色连线。
2. Image `image_out` → Image Gen / Analysis `image_in`：应创建绿色连线。
3. text → image 或 image → text：应拒绝创建。
4. Image Gen / Image Gen 4 的 image 输入连入后，应自动保留一个新的空 image 输入端口。
5. 鼠标靠近 node-node 连线中点，应出现 `−`，点击后删除连线。

### 7.1 Codex Follow-up 2 — Click-to-connect

用户复测发现 drag-to-connect 不够丝滑，且页面报错：

```text
At binding(type = arrow).props.normalizedAnchor.dataType:
Unexpected property
```

根因：

- `getCandidateAnchors()` 对 `node_card` 返回了完整 `NodePortAnchor`，其中包含 `dataType`、`direction`、`id`、`label`。
- tldraw `arrow` binding 的 `normalizedAnchor` schema 只允许 `{ x, y }`，当 arrow snapping 把完整端口对象写进 binding 时会触发校验崩溃。
- 原交互是 pointerdown → pointerup 的拖拽式连接，不符合用户期望的 React Flow-like click-to-connect。

已修复：

- `arrowAnchorUtils.ts` 只向 tldraw binding 写入干净的 `{ x, y }` anchor。
- `NodePortDot.tsx` 改为：点击 output 端口开始连接；点击 input 端口完成连接；点击新的 output 端口会重启连接。
- `CanvasConnectionLine.tsx` 负责全局 mousemove / Esc / 空白点击取消，并显示跟随鼠标的 Bezier 曲线预览。
- `usePortConnectionCompletion.ts` 生成 clean solid arc arrow，仍使用 tldraw arrow binding，因此节点移动后连线会跟随。

注意：

- 如果浏览器中已经存过旧的非法 binding，本地 tldraw 数据可能仍会报错；需要在错误弹窗中点击 `Reset data` 清掉本地旧画布数据后再测。

### 7.2 Codex Follow-up 3 — Stable node-node bindings

用户复测发现：

- 幽灵线很难点中目标端口，容易出现一下就消失。
- 偶尔连上后，只要稍微移动节点，连线就消失。
- Inspector 显示 `Port type mismatch: text cannot connect to image`。

根因：

- 旧的 `snapArrowBindings()` 会在每次画布事件后重算所有 arrow binding 的最近 anchor。
- 对 `node_card` 来说，端口不是普通几何吸附点，而是有 `text/image` 类型语义的数据端口。
- 移动节点后，旧吸附可能把已连接的 text 线从 text input 重吸附到更近的 image input，随后连接校验判定类型不匹配并删除连线。
- 端口视觉点和真实点击区域过小，用户必须点得非常精确。

已修复：

- `arrowSnapLogic.ts` 对已有 `node_card` binding 不再执行重吸附，保持用户连接时选中的端口语义。
- `NodePortDot` 命中区域从 14px 增加到 24px，并在连接模式下高亮兼容目标端口。
- `CanvasConnectionLine` 在连接模式下允许点击目标端口附近完成连接，不再必须精确命中 port DOM。
- `usePortConnectionCompletion` 的几何兜底只选择同类型 input 端口，并把命中半径放宽到 96px。

待手测：

1. Prompt text output → Image Gen text input，点击目标端口附近也应能完成。
2. 移动 Prompt 或 Image Gen 后，连线必须保持在原 text 端口，不应跳到 image 端口。
3. Image output → Image Gen image input 后，动态 image input 仍应新增一个空口。
4. 连接中点击空白应取消；Esc 应取消。
