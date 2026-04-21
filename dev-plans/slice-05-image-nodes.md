# Slice 5: gate · writer · reviewer

**优先级**: P0 | **难度**: 高 | **预计**: 3 天 | **状态**: ⬜ 未开始
**依赖**: Slice 4 | **返回索引**: [phase1-mvp.md](phase1-mvp.md)

---

## 目标

实现 MVP 公众号 Skill 的核心交互节点和写作节点：gate（暂停等人选择大纲）、writer（Claude 长文写作）、reviewer（三遍审校）。Gate 是整个系统最关键的架构创新。

---

## Rust 侧步骤

### Step 1: 扩展 execute_node

**文件**: `src-tauri/src/commands/execute.rs` — 新增分支

```rust
// "gate" → 不执行 API 调用，返回特殊标记
//   返回 { "status": "waiting", "waiting_payload": { "mode": "select", "options": input_data.outline_options } }
//   前端收到 waiting 后负责渲染临时选项节点

// "writer" → execute_writer(input_data, db)
// "reviewer" → execute_reviewer(input_data, db)
```

### Step 2: writer 执行逻辑

```rust
// execute_writer(input_data, db) -> Result<Value, String>
//   1. 从 input_data 取 "outline_options"（Gate 传来的用户选择）
//   2. 解密 Anthropic key
//   3. call_anthropic(
//        system: "你是资深公众号写手。根据选定的大纲方向，撰写完整文章。要求：2000-5000字，至少3个H2小标题，语言生动有感染力，段落清晰。Markdown格式输出。",
//        messages: [{ role: "user", content: "大纲方向：{selected_outline}\n研究素材：{research_context}" }],
//        max_tokens: 8192,
//      )
//   4. 返回 { "text": article_markdown }
```

### Step 3: reviewer 执行逻辑

```rust
// execute_reviewer(input_data, db) -> Result<Value, String>
//   1. 从 input_data 取 "text"（writer 的输出）
//   2. 解密 Anthropic key
//   3. 三遍审校（单次 API 调用，链式 prompt）：
//      call_anthropic(
//        system: "你是严格的内容审校编辑。对文章进行三遍审校：
//          第一遍：事实核查 — 检查数据、引用的准确性，标注可疑之处
//          第二遍：去AI味 — 修改过于模板化、机械化的表达，增加人味
//          第三遍：节奏调整 — 检查段落长度、过渡、阅读节奏
//          直接输出最终审校后的完整文章，不要输出中间过程。",
//        messages: [{ role: "user", content: text }],
//        max_tokens: 8192,
//      )
//   4. 返回 { "text": reviewed_article }
```

---

## 前端步骤

### Step 4: GateNode 组件

**文件**: `frontend/src/nodes/gate/GateNode.tsx`

```
使用 NodeBase 包裹

inputs: [{ id: "outline_options", type: "outline_options", label: "大纲选项" }]
outputs: [{ id: "outline_options", type: "outline_options", label: "用户选择" }]

内容区 — 默认（idle）:
  - 淡灰文字 "等待上游大纲输入"

内容区 — waiting 状态:
  - 琥珀色边框脉冲
  - 动态生成 3 个临时交互节点（AnimatedTempNode）
  - 每个临时节点显示大纲标题 + 角度 + 章节预览
  - 点击一个临时节点 → resolveGate

内容区 — resolved 后:
  - 折叠显示 "✓ 已选：{选项标题}"
  - 绿色边框 2 秒

节点数据:
  {
    selectedOption: OutlineOption | null
    options: OutlineOption[] | null
  }
```

### Step 5: AnimatedTempNode 组件

**文件**: `frontend/src/nodes/gate/AnimatedTempNode.tsx`

```
Gate 动态生成的临时交互节点（不存入 graph_json）

Props:
  option: OutlineOption
  onSelect: (option: OutlineOption) => void

布局:
  ┌───────────────────────────┐
  │ 方案 A: [标题]            │  ← Cal Sans 14px 600
  │ 角度: 深度分析            │
  │ 1. 章节1                  │
  │ 2. 章节2 ...              │
  │                    [选择] │  ← #242424 药丸
  └───────────────────────────┘

动画:
  - 淡入: opacity 0→1, scale 0.9→1, 300ms
  - 选中后: 其他临时节点淡出，选中节点高亮后折叠进 Gate
```

### Step 6: Gate 与执行引擎集成

**文件**: `frontend/src/lib/executionEngine.ts` — 更新

```typescript
// runAll() 中遇到 Gate 节点的处理：
// 1. 正常执行到 gate 节点
// 2. executeNode 返回 { status: "waiting" }
// 3. canvasStore.setWaitingGate(nodeId)
// 4. 暂停执行（不继续下游）
// 5. 用户选择后 → canvasStore.resolveGate(nodeId, value)
// 6. 将 value 写入 nodeResult → 继续执行下游（writer）
```

### Step 7: WriterNode 组件

**文件**: `frontend/src/nodes/writer/WriterNode.tsx`

```
使用 NodeBase 包裹

inputs: [{ id: "outline_options", type: "outline_options", label: "大纲方向" }]
outputs: [{ id: "text", type: "text", label: "文章" }]

内容区 - 配置:
  - 写作风格: select（继承 Skill 配置，只读显示）
  - 目标字数: select (2000-3000 / 3000-5000 / 5000+)

内容区 - 结果:
  - 执行中: 旋转 + "写作中..."（Claude 长文通常 15-30 秒）
  - 成功: 文章预览
    - 前 300 字显示
    - "展开全文" 按钮
    - 展开后完整 Markdown 渲染
  - 失败: 红色错误

节点数据:
  {
    targetLength: string
    result: string | null
    error: string | null
  }
```

### Step 8: ReviewerNode 组件

**文件**: `frontend/src/nodes/reviewer/ReviewerNode.tsx`

```
使用 NodeBase 包裹

inputs: [{ id: "text", type: "text", label: "待审文章" }]
outputs: [{ id: "text", type: "text", label: "审校后文章" }]

内容区 - 配置:
  - 审校轮次: 显示 "三遍审校（事实→去AI味→节奏）"（固定，不可调）

内容区 - 结果:
  - 执行中: 旋转 + "审校中..."（通常 10-20 秒）
  - 成功: 审校后文章预览（同 WriterNode 展开/收起）
  - 失败: 红色错误

节点数据:
  {
    result: string | null
    error: string | null
  }
```

---

## 验收清单

- [ ] Gate 节点接收 outline_options，执行时触发 waiting 状态
- [ ] waiting 时画布自动生成 3 个临时选项节点（不破坏原有结构）
- [ ] 临时节点显示大纲标题、角度、章节列表
- [ ] 点击选项后临时节点淡出消失，Gate 折叠显示 "✓ 已选：xxx"
- [ ] 选择后数据正确传递给下游 writer
- [ ] WriterNode 接收选择的大纲，Claude 生成完整文章
- [ ] 文章 ≥2000 字，含 ≥3 个 H2 小标题
- [ ] ReviewerNode 接收文章，三遍审校后输出改进版
- [ ] 审校结果不暴露中间过程
- [ ] Gate + Writer + Reviewer 整条链路跑通（text_input → research → outline → gate → writer → reviewer）
- [ ] 上游输出正确传递给每个下游节点
- [ ] 所有文件 < 300 行

---

## 完成后更新

- [ ] 本文件状态 → ✅
- [ ] project_state.md → Slice 6
- [ ] phase1-mvp.md → Slice 5 ✅
- [ ] git commit: "Slice 5: gate + writer + reviewer nodes"
