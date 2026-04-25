# Slice 13: Skill 系统 — AI 驱动拓扑 + 节点注册表约束

**优先级**: P0 | **难度**: 中 | **预计**: 3 天 | **状态**: ✅ 已完成
**依赖**: Slice 11 ✅ | **返回索引**: [phase2-commercial.md](phase2-commercial.md)

---

## 目标

重构 Agent 的节点连线机制：不再手写固定模板，改为将 `nodeDefs.ts` 的完整端口注册表动态注入系统提示，让 AI 根据用户需求灵活组合节点拓扑。前端增加校验层确保连线合法。

核心原则：**节点注册表是唯一真相源**，AI 的输入输出都从注册表推导，加新节点只改 `nodeDefs.ts`。

> 状态校准（2026-04-25）：公众号默认模板已切到 Outline Split 架构，且默认终点为 `html_formatter` / Html Editor。`gate/writer/reviewer/preview_wechat` 视为 legacy，不再作为默认推荐节点。

---

## 现有问题

| 问题 | 原因 |
|------|------|
| Agent 只能连公众号流程 | 系统提示手写了固定端口映射 |
| 用户说"不要配图"无法响应 | 没有动态拓扑能力 |
| 加新节点要改 Agent 提示 | 提示和注册表不同步 |
| 连线可能端口名错误 | AI 靠自然语言描述猜端口 |

---

## 架构设计

```
用户消息 → Agent API → Rust 动态生成系统提示（从 nodeDefs 序列化）
                         ↓
                      AI 返回 { message, actions }
                         ↓
                      前端 nodeBuilder 校验端口 → 创建节点+连线 → 自动 runAll
```

---

## 改动清单

### 1. Rust: 动态生成系统提示

**文件**: `src-tauri/src/commands/agent.rs`

**当前**: 手写 `SYSTEM_PROMPT` 常量，硬编码节点列表和端口映射。

**改为**: `build_system_prompt()` 函数，从节点定义数据生成提示。

```rust
fn build_system_prompt() -> String {
    // 节点注册表（与前端 nodeDefs.ts 保持同步）
    let nodes = json!([
        {
            "type": "text_input",
            "desc": "Text input node, inject user content via data.text",
            "inputs": [],
            "outputs": [{"id": "out", "type": "text"}],
            "injectUserText": true
        },
        {
            "type": "research",
            "desc": "Deep research on a topic",
            "inputs": [{"id": "in", "type": "text"}],
            "outputs": [{"id": "out", "type": "research_result"}]
        },
        {
            "type": "outline_generator",
            "desc": "Generate sections[] and image_plans[] for Split",
            "inputs": [{"id": "in", "type": "text"}, {"id": "research", "type": "research_result"}],
            "outputs": [{"id": "out", "type": "text"}, {"id": "image_plans", "type": "image_plans"}]
        },
        {
            "type": "image_planner",
            "desc": "AI image planning from article",
            "inputs": [{"id": "in", "type": "text"}],
            "outputs": [{"id": "out", "type": "image_plans"}]
        },
        {
            "type": "image_list",
            "desc": "AI image generation from plans or text",
            "inputs": [{"id": "in", "type": "image_plans"}, {"id": "text", "type": "text"}],
            "outputs": []
        },
        {
            "type": "image_gallery",
            "desc": "Collect and display images",
            "inputs": [{"id": "in", "type": "image_slot"}],
            "outputs": []
        },
        {
            "type": "html_formatter",
            "desc": "Html Editor terminal node: combine text + images into WeChat HTML, then double-click to edit/preview/copy",
            "inputs": [{"id": "text_1", "type": "text"}, {"id": "images", "type": "image_slot"}],
            "outputs": []
        }
    ]);

    format!(r#"你是 TANGENT 工作流画布的 AI 助手。用户描述需求，你返回 JSON 指令创建节点和连线。

## 节点注册表
{nodes}

## 输出格式
严格 JSON：
{{
  "message": "向用户解释你创建了什么",
  "actions": [
    {{"op": "add", "type": "节点类型", "name": "唯一名", "position": [x, y], "data": {{}}}},
    {{"op": "connect", "from": "源name", "fromPort": "端口id", "to": "目标name", "toPort": "端口id"}}
  ]
}}

## 规则
1. 每个 add 必须有唯一 name（如 "topic"、"research1"），connect 用 name 引用
2. position.x 从 100 开始，每个节点间隔 300
3. text_input 必须带 "data": {{"text": "用户的完整输入内容"}}
4. connect 的 fromPort/toPort 必须使用注册表中定义的端口 id（如 "out"、"in"、"research"、"text"）
5. 端口类型必须匹配：text→text, research_result→research_result, image_plans→image_plans, image_slot→image_slot
6. 必须包含所有 connect 指令形成完整链路
7. 根据用户需求灵活选择节点，不要固定流程。例如：
   - "写公众号" → text_input→research→outline（由 Split 自动补齐后续图）
   - "只要研究" → text_input→research
   - "电商海报" → text_input→research→image_planner→image_list
   - "不要配图" → 跳过 image_planner 和 image_list
8. 只输出 JSON"#,
        nodes = serde_json::to_string_pretty(&nodes).unwrap_or_default()
    )
}
```

**改动量**: ~80 行替换原来的 `SYSTEM_PROMPT` 常量

---

### 2. 前端: nodeBuilder 校验层

**文件**: `frontend/src/agent/nodeBuilder.ts`

在执行 connect 之前校验端口合法性：

```typescript
import { NODE_MAP } from "../nodes/nodeDefs"
import type { NodeType } from "../types/node"

function validatePort(nodeType: string, portId: string, direction: "input" | "output"): boolean {
  const def = NODE_MAP[nodeType as NodeType]
  if (!def) return false
  const ports = direction === "input" ? def.inputs : def.outputs
  return ports.some(p => p.id === portId)
}

// 在 connect 循环中加校验
if (action.op === "connect" && action.from && action.to) {
  const sourceType = /* 从 nameToType map 获取 */
  const targetType = /* 从 nameToType map 获取 */

  if (!validatePort(sourceType, sourceHandle, "output")) {
    console.warn(`Invalid source port: ${sourceType}.${sourceHandle}`)
    continue
  }
  if (!validatePort(targetType, targetHandle, "input")) {
    console.warn(`Invalid target port: ${targetType}.${targetHandle}`)
    continue
  }
  // ... 原有 addEdge 逻辑
}
```

**需要额外维护**: `nameToType` Map（add 时记录 name→type 映射，connect 时用来查类型）

**改动量**: ~20 行新增

---

### 3. 前端: AgentStore 增强

**文件**: `frontend/src/agent/agentStore.ts`

无需改动 — `AgentAction` 已支持 `name` 和 `data` 字段。

---

### 4. 后续扩展: 新增节点零成本

加新节点时只需改 3 处（和现在一样）：
1. `frontend/src/types/node.ts` — 加 PortType / NodeType
2. `frontend/src/nodes/nodeDefs.ts` — 加节点定义（含完整端口信息）
3. `src-tauri/src/commands/agent.rs` — `build_system_prompt()` 的 nodes 数组里加一条

Agent 自动能用新节点，无需改系统提示的自然语言描述。

---

## 未来可选增强（不在本 Slice 范围）

| 增强 | 描述 | Slice |
|------|------|------|
| 模型注册表 + 多模型路由 | 文本/图片/视频节点各自可选模型（Claude、GPT、Sora 等），用户自选 | Slice 14 |
| Skill 推荐 UI | 用户点 "New Workflow" 时展示 Skill 卡片（公众号/电商/小红书），点击直接调用 Agent | Slice 15 |
| 对话上下文感知 | Agent 接收当前画布已有节点作为 context，支持"在这个基础上加一个翻译节点" | Slice 15 |
| 节点注册表单一来源 | Rust 从 JSON 文件读取节点定义（不手写），前端也读同一文件 | 节点 > 20 个时 |

---

## 实施顺序

```
Step 1  ─── Rust: build_system_prompt() 动态生成提示（~1h）
Step 2  ─── 前端: nodeBuilder 增加 nameToType + 端口校验（~30min）
Step 3  ─── 测试: 各种场景对话验证（~1h）
Step 4  ─── i18n: 完成剩余组件的中英切换（~2h，可与 Step 1-3 并行）
```

---

## 验证清单

- [x] Agent 能正确创建公众号主流程（Outline + Split 路径）
- [x] 用户说"只要研究" → 只创建 2 个节点 + 1 条连线
- [x] 用户说"写电商海报" → 不强制插入 legacy writer/reviewer 节点
- [x] 用户说"写公众号，不要配图" → 跳过 image_planner/image_list
- [x] 非法端口名 → 前端 console.warn + 跳过该连线（不崩溃）
- [x] text_input 节点自动填入用户输入的内容
- [x] 创建+连线后自动 runAll 执行
- [x] 新建工作流时画布和聊天都重置
- [x] `npx tsc --noEmit` + `cargo check` 零错误

---

## 完成后更新

- [ ] 本文件状态 → ✅
- [ ] phase1-mvp.md → Slice 13 ✅
- [ ] git commit: "feat(slice13): skill system — dynamic topology from node registry"
