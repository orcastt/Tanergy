# Slice 6: image_planner · image_gen · image_gallery

**优先级**: P0 | **难度**: 高 | **预计**: 3 天 | **状态**: ⬜ 未开始
**依赖**: Slice 5 | **返回索引**: [phase1-mvp.md](phase1-mvp.md)

---

## 目标

实现 MVP 公众号 Skill 的图片相关 3 个节点：image_planner（Claude 从文章提取配图方案）、image_gen（Google Imagen 3 生图）、image_gallery（图片展示 + 下载）。图片存储于本地文件系统。

---

## Rust 侧步骤

### Step 1: 扩展 execute_node — image_planner

**文件**: `src-tauri/src/commands/execute.rs` — 新增分支

```rust
// "image_planner" → execute_image_planner(input_data, db)
// "image_gen"      → execute_image_gen(input_data, db, app_handle)
```

### Step 2: image_planner 执行逻辑

**文件**: `src-tauri/src/commands/execute.rs` — 内部函数

```rust
// execute_image_planner(input_data: Value, db: &Mutex<Connection>) -> Result<Value, String>
//   1. 从 input_data 取 "text"（reviewer 输出的文章）
//   2. 解密 Anthropic key
//   3. call_anthropic(
//        system: "你是专业的内容配图策划。分析文章内容，规划配图方案。每张配图需包含：
//          - 位置：在哪个段落之后插入
//          - 描述：图片应呈现的内容（中文，用于展示）
//          - prompt：用于 AI 生图的英文 prompt（详细、具体、有艺术风格指引）
//          - 尺寸：建议的宽高比
//          输出 JSON 数组。",
//        messages: [{ role: "user", content: text }],
//        max_tokens: 4096,
//      )
//   4. 解析返回的 JSON → Vec<ImagePlan>
//   5. 返回 { "image_plans": [{ id, position, description, prompt, aspect_ratio }] }
```

### Step 3: image_gen 执行逻辑

**文件**: `src-tauri/src/commands/execute.rs` — 内部函数

```rust
// execute_image_gen(input_data: Value, db: &Mutex<Connection>, app_handle: &AppHandle) -> Result<Value, String>
//   1. 从 input_data 取 "image_plans"
//   2. 解密 Google Cloud key（access token 或 service account JSON）
//      无 key → Err("Google Cloud API Key 未配置，请前往 Settings")
//   3. 对每个 image_plan:
//      a. 调用 Google Imagen 3 API:
//         POST https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict
//         body: { instances: [{ prompt }], parameters: { sampleCount: 1, aspectRatio } }
//      b. 解析返回的 base64 图片数据
//      c. 解码 base64 → PNG bytes
//      d. 保存到本地文件系统:
//         路径: {workspace}/assets/{workflow_id}/{node_id}_{plan_id}.png
//         使用 Tauri app_handle.path() 获取 app data 目录
//      e. 记录 asset 到 SQLite:
//         INSERT INTO assets (id, workflow_id, node_id, type, file_path, metadata)
//         metadata = { prompt, position, description }
//      f. emit 进度事件:
//         app_handle.emit("node_status", { node_id, status: "progress", progress: i/total })
//   4. 返回 { "images": [{ id, file_path, prompt, description, position }] }
```

### Step 4: Asset Commands

**文件**: `src-tauri/src/commands/asset.rs`

```rust
#[tauri::command]
// get_assets(workflow_id: String, node_id: Option<String>) -> Result<Vec<AssetOut>, String>
//   SELECT * FROM assets WHERE workflow_id = ?
//   有 node_id 时追加 AND node_id = ?
//   返回 [{ id, node_id, type, file_path, metadata, created_at }]

#[tauri::command]
// read_asset_file(file_path: String) -> Result<Vec<u8>, String>
//   读取本地文件，返回原始 bytes（前端用 base64 显示图片）
//   路径校验：必须在 assets 目录下，防止路径遍历攻击

#[tauri::command]
// delete_asset(id: String) -> Result<(), String>
//   删除 SQLite 记录 + 删除本地文件

#[tauri::command]
// export_assets(workflow_id: String) -> Result<String, String>
//   打包所有 assets 为 ZIP
//   保存到临时目录，返回 ZIP 文件路径
//   使用 zip crate
```

### Step 5: 注册 Commands

**文件**: `src-tauri/src/lib.rs` — 更新 invoke_handler

```rust
commands::asset::get_assets,
commands::asset::read_asset_file,
commands::asset::delete_asset,
commands::asset::export_assets,
```

---

## 前端步骤

### Step 6: ImagePlannerNode 组件

**文件**: `frontend/src/nodes/image_planner/ImagePlannerNode.tsx`

```
使用 NodeBase 包裹

inputs: [{ id: "text", type: "text", label: "文章内容" }]
outputs: [{ id: "image_plans", type: "image_plans", label: "配图方案" }]

内容区 - 配置:
  - 配图数量: select (1/3/5, 默认 3)
  - 图片风格: select (写实 / 插画 / 简约 / 油画)

内容区 - 结果:
  - 未执行: "点击 Run 规划配图"
  - 执行中: 旋转 + "分析文章中..."
  - 成功: 配图方案列表
    ┌───────────────────────────┐
    │ 图 1: 段落 2 后           │  ← Cal Sans 14px 600
    │ 描述: 产品使用场景图       │
    │ 风格: 写实                │
    │ 尺寸: 16:9                │
    │ Prompt: "A professional...│  ← 可展开查看英文 prompt
    └───────────────────────────┘
    ┌───────────────────────────┐
    │ 图 2: ...                 │
    └───────────────────────────┘
  - 失败: 红色错误

节点数据:
  {
    imageCount: number
    imageStyle: string
    plans: ImagePlan[] | null
    error: string | null
  }

ImagePlan:
  { id: string, position: string, description: string, prompt: string, aspectRatio: string }
```

### Step 7: ImageGenNode 组件

**文件**: `frontend/src/nodes/image_gen/ImageGenNode.tsx`

```
使用 NodeBase 包裹

inputs:
  - { id: "image_plans", type: "image_plans", label: "配图方案" }
outputs:
  - { id: "image_slot", type: "image_slot", label: "图片" }

内容区 - 配置:
  - 生成模型: select (Imagen 3) — MVP 仅支持 Imagen 3
  - 并发生成数: select (1/2/3, 默认 2)

内容区 - 结果:
  - 未执行: "点击 Run 生成配图"
  - 执行中: 进度条 + "生成中 2/5..."
  - 成功: 图片缩略图网格
    ┌──────┬──────┬──────┐
    │ img1 │ img2 │ img3 │  ← 点击可放大
    └──────┴──────┴──────┘
    每张图下方显示描述
    图片加载: invoke('read_asset_file', { filePath })
  - 失败: 红色错误 + "请检查 Google Cloud API Key"

节点数据:
  {
    concurrency: number
    images: GeneratedImage[] | null
    error: string | null
  }

GeneratedImage:
  { id: string, filePath: string, prompt: string, description: string, position: string }
```

### Step 8: ImageGalleryNode 组件

**文件**: `frontend/src/nodes/image_gallery/ImageGalleryNode.tsx`

```
使用 NodeBase 包裹

inputs:
  - { id: "image_slot", type: "image_slot", label: "图片" }
    支持多输入（多个 image_gen 节点连接到此节点）
outputs: []

内容区:
  - 无图片: "连接图片节点展示图片"
  - 有图片: 瀑布流/网格展示
    ┌───────────────────────────┐
    │ ┌─────┐ ┌─────┐ ┌─────┐ │
    │ │     │ │     │ │     │ │  ← 点击放大
    │ │ img1│ │ img2│ │ img3│ │
    │ └─────┘ └─────┘ └─────┘ │
    │ 描述1    描述2    描述3   │
    ├───────────────────────────┤
    │ [下载全部 ZIP]  [复制全部] │
    └───────────────────────────┘

  放大查看（Modal）:
    - 全尺寸图片
    - prompt 信息
    - 单张下载按钮
    - 左右翻页（多张图时）

  "下载全部 ZIP":
    - invoke('export_assets', { workflowId })
    - 触发 Tauri 文件保存对话框
    - 或直接下载到 ~/Downloads/

节点数据:
  {
    layout: "grid" | "masonry"  // 默认 grid
    images: GeneratedImage[]
  }
```

### Step 9: 图片展示 Hook

**文件**: `frontend/src/hooks/useAssetImage.ts`

```typescript
// useAssetImage(filePath: string) => { src: string | null, isLoading: boolean }
//   1. 调用 invoke('read_asset_file', { filePath })
//   2. 将 Vec<u8> 转 base64 → `data:image/png;base64,{base64}`
//   3. 缓存到 Map<filePath, src>，避免重复读取
//   4. 返回 src 用于 <img> 显示
```

### Step 10: 更新节点注册表

**文件**: `frontend/src/nodes/nodeDefs.ts` — 确认 3 个节点定义

```
image_planner:
  inputs: [{ id: "text", type: "text" }]
  outputs: [{ id: "image_plans", type: "image_plans" }]
  category: "ai"

image_gen:
  inputs: [{ id: "image_plans", type: "image_plans" }]
  outputs: [{ id: "image_slot", type: "image_slot" }]
  category: "image"

image_gallery:
  inputs: [{ id: "image_slot", type: "image_slot" }]  // 多输入
  outputs: []
  category: "image"
```

确认新增端口类型:
- `image_plans` — 配图方案（紫色 #8B5CF6）
- `image_slot` — 图片数据（绿色 #22C55E）

### Step 11: 执行引擎更新

**文件**: `frontend/src/lib/executionEngine.ts` — 更新

```typescript
// 新增 image_planner / image_gen 分支处理
// image_gen 执行时监听 progress 事件:
//   listen("node_status", (event) => {
//     if (event.payload.status === "progress") {
//       canvasStore.setNodeProgress(nodeId, event.payload.progress)
//     }
//   })
```

---

## 验收清单

- [ ] ImagePlannerNode 接收文章，Claude 规划配图方案
- [ ] 配图方案包含位置、描述、英文 prompt、尺寸
- [ ] ImageGenNode 接收方案，调用 Imagen 3 生成图片
- [ ] 生成进度实时显示（2/5...）
- [ ] 生成的图片保存到本地文件系统
- [ ] 图片记录写入 assets 表
- [ ] 未配置 Google Cloud Key 时提示 "前往 Settings"
- [ ] ImageGalleryNode 展示图片缩略图网格
- [ ] 点击图片可放大查看
- [ ] "下载全部 ZIP" 打包下载正常
- [ ] 单张图片下载正常
- [ ] 上游输出正确传递: reviewer → image_planner → image_gen → image_gallery
- [ ] 文章 + 配图整条链路跑通（text_input → research → outline → gate → writer → reviewer → image_planner → image_gen → image_gallery）
- [ ] 所有文件 < 300 行

---

## 完成后更新

- [ ] 本文件状态 → ✅
- [ ] project_state.md → Slice 7
- [ ] phase1-mvp.md → Slice 6 ✅
- [ ] git commit: "Slice 6: image_planner + image_gen + image_gallery nodes"
