# Slice 14: 模型注册表 + 多模型路由

**优先级**: P1 | **难度**: 中 | **预计**: 3 天 | **状态**: ✅ 已完成
**依赖**: Slice 13 ✅ | **返回索引**: [phase2-commercial.md](phase2-commercial.md)

> 2026-04-25 对齐：模型注册表已服务文本/图片节点；`html_formatter` 仍走文本模型生成微信 HTML。

---

## 已完成的部分

- ✅ `frontend/src/nodes/modelDefs.ts` — 模型注册表已定义 (TEXT_MODELS + IMAGE_MODELS)
- ✅ `frontend/src/components/ModelSelector.tsx` — 模型选择器组件已实现
- ✅ `src-tauri/src/services/ai_client.rs` — `resolve_text_model()` / `resolve_image_model()` 多模型路由
- ✅ `src-tauri/src/services/provider.rs` — Provider presets (gemini/claude/gpt/glm/minimax)
- ✅ 各 AI 节点已有 ModelSelector 下拉框
- ✅ `backend/app/services/proxy_service.py` — 后端多 provider 代理（Slice 16）

---

## 目标

建立统一的模型注册表，让用户在每个 AI 节点中自主选择模型。大部分已实现，剩余工作：动态从后端读取可用模型 + 未配置 Key 时灰显 + Agent 模型推荐。

---

## 核心设计

### 模型注册表 (`frontend/src/nodes/modelDefs.ts`)

```ts
export type ModelCategory = "text" | "image" | "video"

export interface ModelDef {
  id: string              // 唯一标识，如 "claude-sonnet-4-6"
  name: string            // 显示名，如 "Claude Sonnet 4.6"
  provider: string        // Provider ID，如 "anthropic"
  category: ModelCategory
  capabilities?: string[] // 如 ["vision", "tool_use"]
}

export const MODEL_DEFS: Record<ModelCategory, ModelDef[]> = {
  text: [
    { id: "MiniMax-M2.7", name: "MiniMax M2.7", provider: "minimax", category: "text" },
    { id: "claude-sonnet-4-6", name: "Claude Sonnet 4.6", provider: "anthropic", category: "text" },
    { id: "gpt-4o", name: "GPT-4o", provider: "openai", category: "text" },
    { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro", provider: "google", category: "text" },
  ],
  image: [
    { id: "minimax-image", name: "MiniMax Image", provider: "minimax", category: "image" },
    { id: "dall-e-3", name: "DALL-E 3", provider: "openai", category: "image" },
    { id: "flux-pro", name: "Flux Pro", provider: "flux", category: "image" },
  ],
  video: [
    // 未来扩展
    // { id: "sora", name: "Sora", provider: "openai", category: "video" },
    // { id: "runway-gen3", name: "Runway Gen-3", provider: "runway", category: "video" },
  ],
}
```

### 节点-模型绑定

每个 AI 节点的 `nodeData` 存储用户选择的模型：

```ts
// nodeDefs.ts 中 AI 节点增加默认 model
{
  type: "research",
  defaultData: { query: "", model: "MiniMax-M2.7" },  // ← 默认模型
  ...
}
```

### 节点 UI 模型选择器

每个 AI 节点内部增加模型下拉框：

```tsx
// 通用组件：根据节点 category 渲染模型选择器
<select
  value={data.model ?? "MiniMax-M2.7"}
  onChange={(e) => updateNodeData(id, { model: e.target.value })}
>
  {MODEL_DEFS.text.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
</select>
```

---

## 改动清单

### 1. 新文件: `frontend/src/nodes/modelDefs.ts` (~30行)

模型注册表定义。

### 2. 修改: `frontend/src/nodes/nodeDefs.ts`

- 所有 AI 节点 `defaultData` 加 `model` 字段
- 导出每个节点的 `modelCategory` 元数据

### 3. 新文件: `frontend/src/components/ModelSelector.tsx` (~40行)

通用模型选择器组件：
- 接收 `category: ModelCategory` + `value` + `onChange`
- 根据 category 渲染对应模型的 `<option>` 列表
- 样式与现有节点内 select 一致

### 4. 修改: 各 AI 节点组件 (~10个文件)

- ResearchNode, OutlineGeneratorNode, WriterNode, ReviewerNode — 加 `<ModelSelector category="text" />`
- ImagePlannerNode, ImageGenNode — 加 `<ModelSelector category="image" />`
- HtmlFormatterNode — 加 `<ModelSelector category="text" />`

### 5. 修改: `src-tauri/src/services/ai_client.rs`

- `chat_completion` 接收 `model` 参数（已有），保持不变
- `image_generation` 接收 `model` 参数（已有），保持不变
- Provider 路由逻辑已有（minimax 默认），新增 openai/anthropic 路由

### 6. 新文件: `src-tauri/src/services/providers/` (按需)

如需新增 provider 适配（如 OpenAI image gen API），每个 provider 一个文件：

```
src-tauri/src/services/providers/
├── mod.rs           (~20行)  导出 + 路由
├── minimax.rs       (现有代码迁移)
├── openai.rs        (~150行) OpenAI chat + image API
├── anthropic.rs     (~150行) Anthropic Claude API
└── flux.rs          (~100行) Flux image API
```

### 7. 修改: `src-tauri/src/commands/agent.rs`

- `build_system_prompt()` 注册表节点加 `modelCategory` 字段
- AI 可以为节点推荐默认模型

### 8. i18n 翻译

模型名不在翻译范围内（品牌名保持原文），但模型选择器的 label（"Model:"/"模型:"）需加入 i18n。

---

## 实施顺序

```
Step 1  ─── 创建 modelDefs.ts + ModelSelector 组件（零风险新文件）
Step 2  ─── nodeDefs.ts 加 model 字段 + 各节点加 ModelSelector
Step 3  ─── Rust 后端 provider 拆分 + 多模型路由
Step 4  ─── 测试：每个节点切换模型验证执行
Step 5  ─── agent.rs 注册表更新
```

---

## 验证清单

- [x] 每个 AI 节点有模型下拉选择器
- [x] 切换模型后执行节点，调用正确的 API
- [x] 用户未配置某 provider 的 API Key → 该 provider 模型在 UI 上灰显或提示（"(no key)"）
- [x] Agent 创建节点时可推荐模型（defaultModel 字段 + 系统提示规则 #8）
- [x] 新增 provider/模型 = 加一条注册 + 一个适配函数
- [x] `npx tsc --noEmit` + `cargo check` 零错误

---

## 完成后更新

- [ ] 本文件状态 → ✅
- [ ] phase1-mvp.md → Slice 14 ✅
- [ ] git commit: "feat(slice14): model registry + multi-provider routing"
