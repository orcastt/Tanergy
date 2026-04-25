# Slice 11: Image List 重构 + AI Agent 面板 + 画布主题

**优先级**: P0 | **难度**: 高 | **预计**: 5 天 | **状态**: ✅ 完成
**依赖**: Slice 10 | **返回索引**: [phase1-mvp.md](phase1-mvp.md)

> 2026-04-25 对齐：Agent 默认生成 Outline + Split 路径，终点为 `html_formatter` / Html Editor。

---

## 目标

三大改动：
1. **画布内暗夜模式切换** — 主题 icon 只在 dashboard 出现，canvas 里没有
2. **Image Gen → Image List 重构** — 双输入、数量/模型选择、双击进图片编辑器、画笔工具、AI 对话改图、动态输出端口
3. **右侧 AI Agent 对话面板** — 侧拉展开/收回，作为控制中枢，通过对话自动在画布上创建并连接节点

---

## Phase 1: 画布主题切换 (Quick Fix)

**改 1 个文件**: `frontend/src/canvas/Toolbar.tsx`

- import `useThemeStore`
- 在 undo/redo 按钮后加分隔线 + 主题切换按钮 (`dark_mode` / `light_mode` icon)
- 同步修改 `CanvasPage.tsx` 的硬编码背景色 → CSS variables

---

## Phase 2: Image Gen → Image List 基础重构

### 2a. 改名 + 双输入端口

| 文件 | 改动 |
|------|------|
| `types/node.ts` | `"image_gen"` → `"image_list"` |
| `nodes/nodeDefs.ts` | type/label/description 改名, inputs 加 `text` 端口, defaultData 加 `{ count: 1, model: "minimax" }` |
| `nodes/index.ts` | key 改名 + 保留 `image_gen` 兼容别名 |
| `nodes/ImageGenNode.tsx` → `ImageListNode.tsx` | 重命名文件 |
| `lib/executionEngine.ts` | AI_NODES 里 `"image_gen"` → `"image_list"` |
| `src-tauri/commands/execute/mod.rs` | match arm 加 `"image_list"`, 保留 `"image_gen"` |

### 2b. 数量 + 模型选择 UI

**改**: `ImageListNode.tsx`

- 加 `<select>` 数量 (1-10)
- 加 `<select>` 模型 (MiniMax / GPT Image / Gemini)
- 参考 `ImagePlannerNode.tsx` 的 select 样式
- `updateNodeData(id, { count, model })` 持久化到 node data

### 2c. 动态输出端口

**关键改动**:

| 文件 | 改动 |
|------|------|
| `nodeDefs.ts` | outputs 改为 `[]` (空，由组件动态计算) |
| `ImageListNode.tsx` | 根据 `images.length` 或 `data.count` 生成 `image1..imageN` 输出端口 |
| `Canvas.tsx` | `getOutputPortType` 增加 node.data.outputs 动态查找 |
| `executionEngine.ts` | 结果路由支持 sourceHandle: `nodeResults[source][sourceHandle]` |
| `media.rs` | 返回值加 `image1`, `image2`... 独立 key |

---

## Phase 3: 图片编辑器 Modal (双击打开)

### 文件结构

```
frontend/src/nodes/image/
├── ImageThumb.tsx          (~50行)  提取共享缩略图组件
├── ImageEditorModal.tsx    (~180行) Modal 壳：左右面板布局
├── ImageEditorPanel.tsx    (~100行) 左面板：可滚动图片列表
├── DrawingPanel.tsx        (~160行) 右面板：画布 + 工具栏 + AI弹窗
├── DrawingCanvas.tsx       (~200行) HTML5 Canvas 画笔实现
├── AiEditPopup.tsx         (~100行) AI 修改指令弹窗
└── drawingStore.ts         (~60行)  画笔状态 (颜色/粗细/笔画/undo)
```

### 交互流程

1. 双击 Image List 节点 → 打开 Modal
2. 左面板: 生成的图片列表，上下滚动选择
3. 右面板: 选中图片 + 画笔工具 (颜色/粗细/橡皮/undo)
4. 画完后点 "AI Edit" → 弹出对话框
5. 用户描述修改意图 → AI 生成新图 → 插入到选中图片后面
6. 关闭 Modal → 输出端口自动更新 (image1, image2, image3...)

---

## Phase 4: Rust 后端改动

### 文件变动

| 文件 | 改动 |
|------|------|
| `commands/execute/media.rs` | `exec_image_gen` → `exec_image_list`: 模型路由 + text 输入 + count 限制 + 逐图输出 |
| `services/ai_client.rs` | 拆分: chat 留原文件, image 生成提至 `services/image_gen.rs` |
| `services/image_gen.rs` | **新建**: minimax/gpt/gemini 三路生成函数 (~200行) |
| `commands/execute/image_edit.rs` | **新建**: `edit_image_with_drawing` 命令 (~120行) |

### 模型路由设计

```rust
pub async fn image_generation(provider: &str, prompt: &str, ...) -> Result<ImageResult> {
    match provider {
        "gpt"    => image_generation_gpt(prompt, ...).await,
        "gemini" => image_generation_gemini(prompt, ...).await,
        _        => image_generation_minimax(provider, prompt, ...).await,
    }
}
```

---

## Phase 5: 右侧 AI Agent 对话面板

### 功能描述

- 画布右侧可侧拉/收回的面板
- 不能直接生成图片
- 作为 Agent 控制中枢
- 用户用自然语言描述需求 → AI 返回文字指令 → 自动在画布上创建并连接节点

### 文件结构

```
frontend/src/agent/
├── AgentPanel.tsx       (~180行) 侧拉面板壳 + 展开/收回动画
├── AgentChat.tsx        (~200行) 对话 UI + 消息列表 + 输入框
├── agentStore.ts        (~80行)  对话历史 + 发送/接收状态
└── nodeBuilder.ts       (~100行) 解析 AI 指令 → 调用 canvasStore 创建节点+连线
```

### 交互流程

1. 画布右上角有 AI icon 按钮 → 点击展开右侧面板
2. 用户输入: "帮我写一篇关于 AI 的公众号长文"
3. AI 返回 JSON 指令:
```json
{
  "message": "我为你创建了公众号长文工作流，包含以下节点：",
  "actions": [
    { "op": "add", "type": "text_input", "position": [100, 200] },
    { "op": "add", "type": "research", "position": [400, 200] },
    { "op": "connect", "from": "text_input", "fromPort": "out", "to": "research", "toPort": "in" }
  ]
}
```
4. `nodeBuilder.ts` 逐条执行 actions → 调用 `canvasStore.addNode` + `canvasStore.addEdge`
5. 画布上自动出现连接好的节点链

### Rust 后端

**新建**: `src-tauri/src/commands/agent.rs` (~80行)

- `agent_chat(messages, context)` 命令
- context 包含当前画布节点列表 + 已连接关系

---

## 实施顺序

```
Phase 1  ─── 主题切换 (独立，5分钟)
Phase 2a ─── 改名 + 双输入 (依赖: 无)
Phase 2b ─── 数量/模型 UI (依赖: 2a)
Phase 2c ─── 动态输出端口 (依赖: 2b)
Phase 4  ─── Rust 后端 (可与 2b/2c 并行)
Phase 3  ─── 图片编辑器 Modal (依赖: 2c + 4)
Phase 5  ─── AI Agent 面板 (独立，可与 2-4 并行)
```

## 验证清单

- [x] 画布内可切换暗夜模式
- [x] Image List 有两个输入端口 (配图方案 + text)
- [x] 可选生成数量 (1-10) 和模型
- [x] 生成后输出端口动态增加 (image1, image2...)
- [x] 下游节点能连接到特定的 imageN 端口
- [x] 双击打开图片编辑器
- [x] 画笔工具可用 (选颜色/粗细)
- [x] AI Edit 弹窗可输入指令
- [ ] AI 改图后新图插入到选中图后面（Rust 后端待接入）
- [x] 右侧 AI 面板可展开/收回
- [x] AI 对话能自动在画布创建并连接节点
- [x] 所有文件 < 300 行

---

## 完成后更新

- [ ] 本文件状态 → ✅
- [ ] project_state.md
- [ ] phase1-mvp.md → Slice 11 ✅
