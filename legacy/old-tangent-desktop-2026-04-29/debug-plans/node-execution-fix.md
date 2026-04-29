# Plan: 完善现有节点 — 跑通完整工作流

> 备注（2026-04-25）：本文件为历史排障记录，流程描述基于旧链路（Gate/Writer/Reviewer/preview_wechat）。当前默认公众号主流程已切换为 Outline Split + `html_formatter` / Html Editor 终点。

## Context

所有节点类型的前端 UI 和后端 executor 都已实现。本文关注旧链路（Text Input → Research → Outline → Gate → Writer → Reviewer → ...）的历史问题排查，用于回溯，不作为当前默认流程规范。

## 审计结果

### 已验证可用的节点
- **text_input** — 纯前端，直接返回 `{ text }` ✅
- **gate** — 纯前端交互，等待用户选择 ✅
- **image_gallery** — 纯前端聚合图片 ✅
- **preview_wechat** — 历史预览组件，非默认主流程 ✅

### AI 节点（历史记录：当时全部走 MiniMax API）

> 当前默认执行口径已变更：文本测试默认 `nemotron-3-super-120b-a12b`、图片默认 `gpt-image-2`，均经 FastAPI 官方代理与 GeekAI relay；下一步由 Admin Provider/Model 管理闭环接管默认值和 fallback；以下列表仅用于回溯旧输入/输出解析问题。
- **research** — 输入 text，输出 `{ text }` ✅
- **outline_generator** — 输入 text + research，输出 `{ options: [...] }` ✅
- **writer** — 输入 outline，输出 `{ text }` ✅
- **reviewer** — 三遍审校，输入 text，输出 `{ text }` ✅
- **image_planner** — 输入 text，输出 image plans ✅
- **image_list** — 输入 image_plans + text，输出 `{ images: [...] }` ✅
- **html_formatter** — 输入 text + image_slot，输出 `{ html }` ✅

### 关键问题：输入数据路由

executionEngine.ts 中的 `gatherInputData` 通过 edge 的 targetHandle/sourceHandle 路由数据。需要验证每个节点间的数据格式是否匹配：

| 连接 | sourceHandle | targetHandle | 数据格式 | 是否匹配 |
|------|-------------|-------------|---------|---------|
| text_input → research | out | in | `{ text }` → 读取 `in.text` | ✅ |
| research → outline | out | in | `{ text }` → 读取 `in.text` | ❓ outline 期望 `in` 是 text string，但传入的是 `{ text }` 对象 |
| outline → gate | out | in | `{ options }` → gate 的 `extractGateOptions` | ✅ |
| gate → writer | out | outline | `{ selected }` → writer 读取 `outline` | ✅ |
| writer → reviewer | out | in | `{ text }` → reviewer 读取 `in` | ❓ 同上 |
| writer → image_planner | out | in | `{ text }` → planner 读取 `in` | ❓ 同上 |
| image_planner → image_list | out | in | plans → image_list 读取 `in` | ✅ |
| writer → html_formatter | out | text | `{ text }` → formatter 读取 `text` | ✅ |
| image_list → html_formatter | imageN | image_slot | image data → formatter 读取 `image_slot` | ❓ |

**核心问题**：很多 executor 通过 `payload.input_data.get("in").and_then(|v| v.as_str())` 读取输入，但上游传入的是 `{ text: "..." }` 对象，不是纯字符串。需要用 `.get("text")` 先解包。

## 修复计划

### 1. 修复 executionEngine.ts 数据路由
**文件**: `frontend/src/lib/executionEngine.ts`

当前 `gatherInputData` 直接传 sourceResult。但很多 executor 期望 targetHandle "in" 下是纯文本，而 sourceResult 是 `{ text: "..." }`。

需要在 gatherInputData 中加一层解包：如果 sourceHandle 是 "out" 且 sourceResult 是 `{ text: string }`，则只传 text 字符串。

或者更好的方案：在后端 executor 中统一处理嵌套对象。

### 2. 修复后端 executor 的输入解析
**文件**: `src-tauri/src/commands/execute/mod.rs`

每个 executor 的输入解析需要兼容两种格式：
- 直接字符串：`"some text"`
- 包装对象：`{ "text": "some text" }`

修改 `exec_research`、`exec_outline`、`exec_writer`、`exec_reviewer` 中的输入解析逻辑。

### 3. 修复 Agent Chat
Agent Chat 的代码完整（前端 agentStore → tauri.agentChat → 后端 agent.rs → 官方文本模型），可能的问题：
- 没有登录或没有官方线路访问权限
- 后端 Provider / 模型配置不可用
- 或者智能路由（credits）的判断逻辑有问题

需要测试确认是否能正常调用。

### 4. 修复 writer → html_formatter 数据传递
**文件**: `frontend/src/lib/executionEngine.ts`

writer 输出 `{ text: "markdown article" }`，html_formatter 需要接收这个 markdown。需要确认 edge targetHandle "text" 正确映射。

## 实施顺序

1. **修复后端 executor 输入解析** — 统一处理 `{ text }` 包装对象
2. **修复前端 gatherInputData** — 确保数据格式正确传递
3. **测试当前默认工作流** — Text Input → Research → Outline → Split → Image List → HTML Formatter / Html Editor
4. **测试图片工作流** — Writer → Image Planner → Image List → HTML Formatter
5. **修复 Agent Chat** — 排查 API 调用问题

## 验证
- 当前默认 Html Editor 终点工作流端到端跑通
- 每个节点输出结果正确传递到下游
- Agent Chat 能正常对话并创建节点
