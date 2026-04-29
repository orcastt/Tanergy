# Slice 4: text_input · research · outline_generator

**优先级**: P0 | **难度**: 中 | **预计**: 3 天 | **状态**: ✅ 已完成（状态校准）
**依赖**: Slice 3 | **返回索引**: [phase1-mvp.md](phase1-mvp.md)

> 2026-04-25 对齐：`outline_generator.image_plans` 已统一为真实 `image_plans` 端口类型，并驱动 Split 后的 `image_list`。

---

## 目标

实现 MVP 公众号 Skill 的前 3 个节点：text_input（用户输入）、research（Tavily 多轮搜索）、outline_generator（Claude 生成大纲选项）。前端渲染节点 UI，Tauri Rust 侧执行 AI API 调用。

---

## Rust 侧步骤

### Step 1: AI Client 服务

**文件**: `src-tauri/src/services/ai_client.rs`

```rust
// call_anthropic(api_key: &str, messages: Vec<Value>, system: Option<&str>, max_tokens: u32) -> Result<String, String>
//   1. 构建 POST https://api.anthropic.com/v1/messages
//   2. Headers: x-api-key, anthropic-version, content-type
//   3. Body: { model: "claude-sonnet-4-20250514", messages, system, max_tokens }
//   4. reqwest::Client 发请求，超时 120s
//   5. 解析 response JSON → content[0].text
//   6. 错误处理：API 错误 → Err(错误信息)

// call_tavily(api_key: &str, query: &str, max_results: u32) -> Result<Vec<Value>, String>
//   1. POST https://api.tavily.com/search
//   2. Body: { api_key, query, max_results, include_answer: true }
//   3. 解析 results 数组
//   4. 返回 Vec<{ title, url, content, score }>
```

### Step 2: 节点执行 Commands

**文件**: `src-tauri/src/commands/execute.rs`

```rust
#[tauri::command]
// execute_node(node_id: String, node_type: String, input_data: Value) -> Result<NodeResult, String>
//
// 根据 node_type 分发：
//   "text_input"        → 透传 input_data（无 API 调用）
//   "research"          → 解密 Tavily key → call_tavily → 再用 Claude 汇总
//   "outline_generator" → 解密 Anthropic key → call_anthropic → 解析大纲
//   其他类型 → Err("节点类型未实现")（后续 Slice 补充）
//
// NodeResult = { outputs: Value, assets: Vec<Value> }
```

### Step 3: research 节点执行逻辑

**文件**: `src-tauri/src/commands/execute.rs` — 内部函数

```rust
// execute_research(input_data: Value, db: &Mutex<Connection>) -> Result<Value, String>
//   1. 从 input_data 取 "text" 字段（搜索主题）
//   2. 从 api_keys 表解密 Tavily key
//      无 key → Err("Tavily API Key 未配置，请前往 Settings")
//   3. call_tavily(query, max_results=10)
//   4. 从 api_keys 表解密 Anthropic key
//   5. call_anthropic(
//        messages: [{ role: "user", content: "基于以下搜索结果，整理关键信息：\n{results}" }],
//        system: "你是研究助手。整理搜索结果，提取关键事实和观点。保留来源引用。",
//      )
//   6. 返回 { "research_result": { summary, sources, raw_results } }
```

### Step 4: outline_generator 节点执行逻辑

**文件**: `src-tauri/src/commands/execute.rs` — 内部函数

```rust
// execute_outline_generator(input_data: Value, db: &Mutex<Connection>) -> Result<Value, String>
//   1. 从 input_data 取 "text" 和/或 "research_result"
//   2. 解密 Anthropic key
//   3. call_anthropic(
//        messages: [{ role: "user", content: "主题：{text}\n研究素材：{research_result}\n请生成3个不同角度的文章大纲" }],
//        system: "你是资深内容策划。为给定主题生成3个不同风格的文章大纲。每个大纲包含：标题、5-7个章节标题、每个章节的核心要点。JSON格式输出。",
//      )
//   4. 解析 Claude 返回的 JSON → 3 个大纲选项
//   5. 返回 { "outline_options": [{ id, title, angle, sections }] }
```

### Step 5: 注册 Commands

**文件**: `src-tauri/src/lib.rs` — 更新 invoke_handler

```rust
commands::execute::execute_node,
```

### Step 6: Tauri Events（进度推送）

**文件**: `src-tauri/src/commands/execute.rs`

```rust
// 执行开始时 emit:
// app_handle.emit("node_status", { node_id, status: "running" })

// 执行完成时 emit:
// app_handle.emit("node_status", { node_id, status: "success", result })

// 执行失败时 emit:
// app_handle.emit("node_status", { node_id, status: "failed", error })
```

---

## 前端步骤

### Step 7: Tauri 服务封装

**文件**: `frontend/src/services/tauri.ts` — 扩展

```typescript
// Execution
executeNode: (nodeId: string, nodeType: string, inputData: Record<string, unknown>) =>
  invoke<{ outputs: Record<string, unknown>; assets: unknown[] }>("execute_node", {
    nodeId, nodeType, inputData,
  }),
```

### Step 8: Event 监听

**文件**: `frontend/src/services/tauri.ts` — 新增

```typescript
import { listen } from "@tauri-apps/api/event";

// onNodeStatus(callback: (event: NodeStatusEvent) => void)
// listen("node_status", (event) => callback(event.payload))
//   payload: { node_id, status, result?, error? }
```

### Step 9: TextInputNode 组件

**文件**: `frontend/src/nodes/text_input/TextInputNode.tsx`

```
使用 NodeBase 包裹

inputs: []（无输入）
outputs: [{ id: "text", type: "text", label: "主题" }]

内容区:
  - 多行 textarea
  - Inter 14px, 行高 1.5
  - 最小高度 80px, 可拖拽调整
  - placeholder: "输入主题关键词..."

节点数据 (node.data):
  { text: string }

onChange:
  - debounce 300ms
  - canvasStore.updateNodeData(id, { text: value })
```

### Step 10: ResearchNode 组件

**文件**: `frontend/src/nodes/research/ResearchNode.tsx`

```
使用 NodeBase 包裹

inputs: [{ id: "text", type: "text", label: "主题" }]
outputs: [{ id: "research_result", type: "research_result", label: "研究结果" }]

内容区 - 配置:
  - 搜索轮次: select (1/2/3, 默认 2)
  - 结果数量: select (5/10/15, 默认 10)

内容区 - 结果:
  - 未执行: "点击 Run 搜索"
  - 执行中: 旋转 + "搜索中..."
  - 成功: 研究摘要
    ┌───────────────────────────┐
    │ AI 摘要                   │  ← 浅棕背景
    │ 关键发现概括...            │
    ├───────────────────────────┤
    │ 来源 1: 标题              │
    │   摘要内容...              │
    │   🔗 source.com           │
    ├───────────────────────────┤
    │ 来源 2: ...               │
    └───────────────────────────┘
    - 最多显示 5 条来源
    - 超过显示 "还有 N 条来源"
  - 失败: 红色错误 + "请检查 Tavily API Key"

节点数据:
  {
    searchRounds: number
    resultCount: number
    result: { summary, sources } | null
    error: string | null
  }
```

### Step 11: OutlineGeneratorNode 组件

**文件**: `frontend/src/nodes/outline_generator/OutlineGeneratorNode.tsx`

```
使用 NodeBase 包裹

inputs:
  - { id: "text", type: "text", label: "主题" }
  - { id: "research_result", type: "research_result", label: "研究素材" }（可选）
outputs:
  - { id: "outline_options", type: "outline_options", label: "大纲选项" }

内容区 - 配置:
  - 文章风格: select
    选项: 深度解析 / 轻松科普 / 情感共鸣 / 干货清单

内容区 - 结果:
  - 未执行: "点击 Run 生成大纲"
  - 执行中: 旋转 + "生成中..."
  - 成功: 3 个大纲选项卡片
    ┌───────────────────────────┐
    │ 方案 A: [标题]            │  ← Cal Sans 14px 600
    │ 角度: 深度分析            │
    │ 1. 章节1                  │
    │ 2. 章节2                  │
    │ 3. 章节3 ...              │
    └───────────────────────────┘
    ┌───────────────────────────┐
    │ 方案 B: [标题]            │
    │ ...                       │
    └───────────────────────────┘
    ┌───────────────────────────┐
    │ 方案 C: [标题]            │
    │ ...                       │
    └───────────────────────────┘
  - 注：选择功能在 Gate 节点（Slice 5）实现
  - 失败: 红色错误 + "请检查 Anthropic API Key"

节点数据:
  {
    style: string
    options: OutlineOption[] | null
    error: string | null
  }

OutlineOption:
  { id: string, title: string, angle: string, sections: string[] }
```

### Step 12: 更新节点注册表

**文件**: `frontend/src/nodes/nodeDefs.ts` — 确认 3 个节点定义

确认 text_input、research、outline_generator 的 inputs/outputs 定义与组件一致。

### Step 13: 执行引擎连接

**文件**: `frontend/src/lib/executionEngine.ts` — 更新 executeNode

```typescript
// executeNode(node) 改为：
async function executeNode(node: Node) {
  canvasStore.getState().setNodeStatus(node.id, "running");

  // 收集上游输入数据
  const inputData = collectUpstreamData(node);

  try {
    const result = await tauri.executeNode(node.id, node.type, inputData);
    canvasStore.getState().setNodeResult(node.id, result.outputs);
    canvasStore.getState().setNodeStatus(node.id, "done");
  } catch (error) {
    canvasStore.getState().setNodeStatus(node.id, "error");
    canvasStore.getState().setNodeResult(node.id, { error: String(error) });
  }
}
```

---

## 验收清单

- [ ] TextInputNode: textarea 输入正常，通过 text 端口输出
- [ ] ResearchNode: 接收 text_input 的输出，调用 Tavily 搜索
- [ ] ResearchNode 搜索结果结构化展示（AI 摘要 + 来源列表）
- [ ] ResearchNode 未配置 Tavily Key 时提示 "前往 Settings"
- [ ] OutlineGeneratorNode: 接收 text + research_result，生成 3 个大纲选项
- [ ] 大纲选项显示正确（标题、角度、章节列表）
- [ ] OutlineGeneratorNode 未配置 Anthropic Key 时提示
- [ ] 节点执行中状态正确（蓝色边框脉冲）
- [ ] 节点执行成功（绿色边框 2 秒）
- [ ] 节点执行失败（红色边框 + 错误信息）
- [ ] Run All 按拓扑序执行，text_input → research → outline_generator
- [ ] 上游输出正确传递给下游输入
- [ ] 所有文件 < 300 行

---

## 完成后更新

- [ ] 本文件状态 → ✅
- [ ] project_state.md → Slice 5
- [ ] phase1-mvp.md → Slice 4 ✅
- [ ] git commit: "Slice 4: text_input + research + outline_generator nodes"
