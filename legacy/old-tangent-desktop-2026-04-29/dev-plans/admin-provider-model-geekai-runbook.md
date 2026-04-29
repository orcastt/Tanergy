# Admin → App → GeekAI 联调与修复 Runbook

**创建时间**: 2026-04-27
**状态**: 🔄 真实 `GEEKAI_API_KEY` 已本地配置；文本默认已切到 `nemotron-3-super-120b-a12b` 并通过；`gpt-image-2` 可用；Gemini Chat Image 同步直连成功；Tangent 代理闭环和后台模式待复测
**范围**: Admin 后台、FastAPI 后端、桌面 App、Provider/Model 默认值、GeekAI 文生图/图生图/增强联调

---

## 0. 当前开发入口

本文件是 GeekAI/API 联调记录和排障手册，不再作为下一轮唯一计划入口。

- 当前总计划：`dev-plans/admin-provider-model-management-p0.md`
- 当前总状态：`project_state.md`
- Admin 页面验收：`dev-plans/admin-integration-acceptance.md`

下一轮开发以 `admin-provider-model-management-p0.md` 为准：先补 Admin 默认模型、fallback、Provider health/test，再用本文件继续记录 GeekAI 真调用结果。

---

## 1. 当前真实状态

### 已确认可用

| 模块 | 当前状态 | 说明 |
|------|----------|------|
| Admin 前端 | ✅ 正在 `http://localhost:3000` 运行 | `/login` 可访问 |
| FastAPI 后端 | ✅ 正在 `http://localhost:8000` 运行 | `/api/v1/health` 返回 ok |
| PostgreSQL | ✅ Docker `tangent-local-postgres` 正常 | 端口 `5433` |
| Redis | ✅ Docker `tangent-local-redis` 正常 | 端口 `6380` |
| Admin API | ✅ 可访问 | `/admin/stats`、`/providers`、`/models` 正常 |
| App 模型列表 | ✅ 可读取 | `/api/v1/models` 返回 active models |
| Admin → App 模型显隐 | ✅ 基础闭环存在 | Admin 启停模型会影响 `/api/v1/models` |
| Provider CRUD API | ✅ 2026-04-27 探针通过 | 测试 provider 可新增、编辑、删除；`geekai` 配置正确 |
| GeekAI 文本代理 | ✅ 2026-04-27 smoke test 通过 | 当前默认切到 `nemotron-3-super-120b-a12b`，返回 `OK`；`hunyuan-3.0-preview` 后续原始 API 返回“模型不存在”，暂不作为默认 |
| GeekAI 生图代理 | ✅ `gpt-image-2` 可用 | `gpt-image-2` 曾返回 `image/png` 并保存样张；用户后台账单也显示成功扣费 |
| GeekAI 失败退款 | ✅ 2026-04-27 smoke test 通过 | GeekAI API 返回 `402 金币余额不足` 时本地积分自动退回，API Logs 写 `error` |
| GeekAI Chat Image 代理 | ✅ / 🔄 同步直连成功，Tangent 代理待复测 | `/api/v1/proxy/image/chat` 已开发；`gemini-3.1-flash-image-preview` 直连官方示例与 `enable_search` 成功，后台模式 pending 后失败 |

### 当前阻断

| 阻断 | 表现 | 原因 | 下一步 |
|------|------|------|--------|
| 默认模型仍有硬编码 | Admin 无法设置默认文本/图片/编辑模型 | `frontend/src/nodes/nodeDefs.ts`、`src-tauri/src/services/ai_types.rs` 仍有默认值 | 下一轮开发默认模型管理 |
| 执行层模型映射仍静态 | Admin 新增 provider/model 后，执行层不一定知道如何路由 | Rust `ai_types.rs` 只映射当前白名单 | 下一轮改为后端返回 provider/model/call_type 配置 |
| Gemini/Nano Banana 2 后台模式未完成 | `gemini-3.1-flash-image-preview` 同步直连成功，但 `background=true` 轮询后失败 | 上游返回 `500 failed / invalid argument` | 先用同步模式接入产品，后台模式作为后续增强 |
| Admin UI 未完全中文化 | 侧边栏、表单、按钮仍有英文 | Admin 暂无 i18n/中文规范统一 | 下一轮按设计规范重做 |

---

## 2. 为什么先做这条线

目标是打通真实商业化闭环：

```
Admin 配置 Provider/Model
→ App 读取可用模型和默认模型
→ 用户在节点里执行 AI
→ 后端代理 GeekAI
→ 扣积分 / 失败退款
→ Admin API Logs 可追踪
```

这条链路一旦稳定，后面再做素材库、Html Editor、Image Editor 的 AI 功能都会更顺。

---

## 3. 人工验收 Step-by-step Guidance

### Step 0 — 明确安全规则

**你要做什么**
- 只把真实 API Key 放到 `backend/.env` 的 `GEEKAI_API_KEY`。
- 不要把真实 key 写进 Admin 表单、Git、文档、截图。

**我要做什么**
- 只检查 key 是否存在，不打印 key。
- 只在接口里测试真实调用结果、扣费和日志。

**为什么**
- 当前产品路线是后端统一代理，Admin 只管理 `key_env`，不直接暴露真实 key。

---

### Step 1 — 配置 GeekAI 真实 Key

**你要做什么**

在 `backend/.env` 添加：

```env
GEEKAI_API_KEY=你的真实 GeekAI Key
```

然后告诉我：“Key 已配置，可以重启后端”。

**我要做什么**
- 重启 `backend` 服务。
- 验证 `backend` 进程已读取到 `GEEKAI_API_KEY`。
- 不显示 key 内容。

**为什么**
- 后端代理调用 GeekAI 时，会通过 provider 的 `key_env=GEEKAI_API_KEY` 到环境变量读取真实 key。

**2026-04-27 实测结果**
- ✅ `backend/.env` 已写入 `GEEKAI_API_KEY`，该文件被 `.gitignore` 忽略，不进入 Git。
- ✅ 后端进程已重启，`Settings` 能读取到 `GEEKAI_API_KEY`。
- ✅ 在 Codex CLI 中，`uvicorn --reload`/后台子进程会被会话清理；验收时使用前台会话启动后端最稳定。

---

### Step 2 — 验证 Admin Provider 配置

**你要做什么**
- 打开 `http://localhost:3000/providers`。
- 找到 `geekai`。
- 人工确认：
  - `base_url = https://geekai.co/api/v1`
  - `key_env = GEEKAI_API_KEY`
  - `auth_style = bearer`
  - `is_active = true`

**我要做什么**
- 用 Admin API 验证同一份 provider 数据。
- 如字段不对，我修正数据库/API 或指导你在 Admin 修改。

**为什么**
- Provider 管理的是“线路”，模型调用失败时先排除线路配置错误。

#### Step 2.1 — Provider API 自动探针

**我要执行什么**
- 使用 Admin OTP 登录拿到 JWT。
- 调用 `GET /api/v1/admin/providers`。
- 确认 `geekai` 存在且配置正确。
- 创建临时测试 provider。
- Patch 临时 provider 的名称和启停状态。
- Delete 临时 provider。
- 再次列表确认临时 provider 已删除。

**2026-04-27 实测结果**

| 接口 | 结果 | 备注 |
|------|------|------|
| `POST /api/v1/auth/send-otp` | ✅ 200 | dev mode 返回 `dev_code` |
| `POST /api/v1/auth/verify-otp` | ✅ 200 | Admin JWT 获取成功 |
| `GET /api/v1/admin/providers` | ✅ 200 | 返回 6 个 provider |
| `geekai` 配置 | ✅ 正确 | `base_url=https://geekai.co/api/v1`、`key_env=GEEKAI_API_KEY`、`auth_style=bearer`、`is_active=true` |
| `POST /api/v1/admin/providers` | ✅ 200 | 临时 provider 创建成功 |
| `PATCH /api/v1/admin/providers/{id}` | ✅ 200 | 名称和 `is_active` 更新成功 |
| `DELETE /api/v1/admin/providers/{id}` | ✅ 200 | 删除成功 |
| 删除后列表确认 | ✅ 通过 | 临时 provider 不再存在 |

**你要做什么**
- 人工打开 `/providers` 页面，确认同样的增删改流程在 UI 中好用。
- 注意不要删除 `geekai`、`gpt`、`gemini` 等真实 provider。

**为什么**
- API 探针只能证明后端正确；人工页面验收才能证明 Admin UI 操作顺手、反馈清楚。

---

### Step 3 — 验证 Admin Model 配置

**你要做什么**
- 打开 `http://localhost:3000/models`。
- 确认下面模型存在且 active：
  - 文本默认：`nemotron-3-super-120b-a12b`
  - 文本备用：`minimax-m2.7:free`
  - 文本观察：`hunyuan-3.0-preview`（当前原始 API 返回“模型不存在”，暂不作为默认）
  - 生图：`gpt-image-2`
  - 生图备用：`gemini-3.1-flash-image-preview`（文档中 Gemini 3.1 Flash Image Preview / Nano Banana 2 路线）
  - 生图备用：`jimeng_t2i_v40`
  - 待核验标签：`nano-banana-2` / `nano-banana-hd`（如果模型广场仍提供这些 images API ID，再进入默认候选）
  - 图片编辑默认：`gemini-3.1-flash-image-preview`（Chat Image 编辑）；图片编辑备用：`gpt-image-1`
  - 图片增强：`jimeng-image-enhance-v2`

**我要做什么**
- 验证 `/api/v1/models` 只返回 active 模型。
- 关闭/开启一个测试模型，确认 App 模型下拉同步变化。

**为什么**
- App 不直接读 Admin 页面，而是读 `/api/v1/models`。这里是 Admin → App 的关键桥。

---

### Step 4 — 测试文本模型

**你要做什么**
- 在 App 里登录官方账号。
- 记录测试前积分余额。

**我要做什么**
- 用后端接口测试：

```http
POST /api/v1/proxy/chat
provider=geekai
model=nemotron-3-super-120b-a12b
messages=[{"role":"user","content":"请只回复 OK"}]
```

- 检查：
  - 返回文本是否正常。
  - `/api/v1/admin/api-logs` 是否新增 `chat` 日志。
  - 积分是否按 `credits_per_call` 扣除。

**为什么**
- 文本模型是所有 AI 编排节点的基础，包括 research、outline、writer、html_formatter、AI 改写。

**2026-04-27 实测结果**

| 项目 | 结果 |
|------|------|
| 接口 | ✅ `POST /api/v1/proxy/chat` |
| Provider / Model | ✅ `geekai` / `nemotron-3-super-120b-a12b` |
| 返回 | ✅ `OK` |
| 积分 | ✅ 扣除 1 credit |
| Token | ✅ 返回 `tokens=33` |
| 旧阻断 | ✅ `503 No API key configured for provider: geekai` 已解除 |

**2026-04-27 追加实测**
- ⚠️ `hunyuan-3.0-preview` 仍在 `/models` 清单中，但原始 `/chat/completions` 返回 `{"message":"模型不存在"}`。
- ⚠️ `minimax-m2.7:free` 原始调用返回 task id，但 `/chat/{id}` 查询返回 `chat response not found`，暂不适合作为同步默认。
- ✅ `nemotron-3-super-120b-a12b` 原始调用与后端代理均可同步返回 `OK`，本轮改为测试默认文本模型。

---

### Step 5 — 测试生图模型

**你要做什么**
- 确认测试生图会消耗 GeekAI 额度和本地积分。
- 给我确认：“可以开始测试生图”。

**我要做什么**
- 先测 `gpt-image-2`，因为它走现有 `/images/generations`，最接近当前后端实现：

```http
POST /api/v1/proxy/image
provider=geekai
model=gpt-image-2
prompt=一只白色小猫，干净背景，产品摄影风格
size=1024x1536
quality=low
```

- `gpt-image-2` 模型注意：
  - 支持入口：`https://geekai.co/api/v1/images/generations`
  - 默认 `quality=medium`、`size=1024x1024`
  - 支持尺寸：`1024x1024`、`1024x1536`、`1536x1024`
  - 支持质量：`low`、`medium`、`high`
  - 不支持：`negative_prompt`、`seed`、`strength`、`aspect_ratio`、`style_preset`
  - 以图生图可传 `image` 或多图 `images`
  - 耗时任务可设置 `async=true`，再轮询 `/images/{task_id}`

**GPT-Image-2 测试 / 产品参数策略**

| 场景 | size | quality | async | 用途 |
|------|------|---------|-------|------|
| Smoke test 默认 | `1024x1536` | `low` | `false` | 当前价格表最低成本组合之一 |
| Square smoke | `1024x1024` | `low` | `false` | 需要方图时使用，成本略高于非方图 low |
| 用户普通生成 | `1024x1024` / `1024x1536` / `1536x1024` | `low` / `medium` / `high` | 可选 | 前端和 Admin 都应开放 |
| 多图参考 / 图生图 | 按目标比例选择 | `low` 起测，验收可升到 `medium/high` | 耗时任务可开 | 使用 `image` 或 `images` |

当前代码策略：
- 后端白名单允许 GPT-Image-2 的三种 `size` 和三种 `quality`。
- 后端会过滤 GPT-Image-2 不支持的 `negative_prompt`、`strength`、`style_preset` 等字段。
- App 默认 `quality=low`，避免开发/测试误用 GeekAI 默认 `medium`。
- Admin Provider/Model 管理页后续需要把这些选项作为模型 capability 展示和配置。

**验收标准**
- 返回 `image/png`。
- Admin `/api-logs` 有 `image` 成功日志。
- 用户积分扣除正确。
- 失败时生成 `error` 日志并自动退款。

**为什么**
- `image_list` 是公众号主流程配图节点，生图模型真实可用才能验收完整工作流。

**2026-04-27 实测结果**

| 项目 | 结果 |
|------|------|
| 接口 | ✅ `POST /api/v1/proxy/image` |
| Provider / Model | ✅ `geekai` / `gpt-image-2` |
| 请求参数 | ✅ `size=1024x1024`、`quality=low`、`async=false` |
| 返回类型 | ✅ `image/png` |
| 返回大小 | ✅ `141931` bytes |
| 本地样张 | ✅ `/tmp/tanvas-gpt-image-2-smoke.png` |

**下一步需补测**
- Admin `/api-logs` 浏览器页面确认 `image` 成功日志可见。
- 手动制造一次失败请求，确认 `error` 日志与自动退款。
- `gpt-image-2` 以图生图、多图参考、异步 `task_id` 轮询。

**2026-04-27 API Logs 实测**

| 模型 | call_type | status | credits_used |
|------|-----------|--------|--------------|
| `gpt-image-2` | `image` | `success` | `8` |
| `hunyuan-3.0-preview` | `chat` | `success` | `1` |
| `nemotron-3-super-120b-a12b` | `chat` | `success` | `1` |

---

### Step 5.1 — 测试 Gemini 3.1 Flash Image Preview / Nano Banana 2

**重要差异**

用户提供的调用案例显示，`gemini-3.1-flash-image-preview` 的图像生成/编辑入口是：

```http
POST https://geekai.co/api/v1/chat/completions
```

它不是传统 `/images/generations`。这意味着它需要一条新的“Chat Image”代理路径。

**你要做什么**
- 确认我们优先测试的 Gemini/Nano Banana 2 模型 ID 是：
  - `gemini-3.1-flash-image-preview`
- 如果模型广场里仍然显示 `nano-banana-2`，请截图或告诉我模型 ID，避免两个 ID 混用。

**我要做什么**
- 先在 Admin 模型表加入/确认：
  - provider：`geekai`
  - model：`gemini-3.1-flash-image-preview`
  - display_name：`Gemini 3.1 Flash Image Preview`
  - call_type：`image_chat`
- 开发后端代理：
  - 构造 `messages[].content[]`，包含 text 和 image_url。
  - 支持 `image.aspect_ratio`、`image.image_size`。
  - 支持 `enable_search`。
  - 支持 `background=true` 后轮询 `/chat/{id}`。
  - 从 Chat Completions 响应中提取图片 URL/base64，再转成 `image/png` 返回 App。

**最小测试请求**

```http
POST /api/v1/proxy/image/chat
provider=geekai
model=gemini-3.1-flash-image-preview
prompt=创作一个 Nano Banana 菜肴的图片，场景设在一家高档餐厅中，带有 Gemini 主题
image_size=0.5K
aspect_ratio=1:1
```

**分辨率策略**
- 代码层允许 `0.5K`、`1K`、`2K`、`4K` 四档 `image_size`。
- 后续 smoke test 默认使用 `0.5K`，减少 GeekAI 金币消耗。
- `1K` 已通过默认同步直连场景间接验证；`2K` / `4K` 仅作为可选高质量手测，不主动跑自动测试。

**验收标准**
- 返回图片，或在后台模式下返回任务 ID 并最终轮询到图片。
- Admin `/api-logs` 记录 call_type 为 `image_chat`。
- 失败自动退款。

**为什么**
- 这类模型能力更强，支持多参考图、搜索、4K 和多轮编辑，但它的 API 形态不是传统图片接口。如果不单独适配，直接放到 `image_list` 会失败。

**2026-04-27 实测结果**

| 项目 | 结果 |
|------|------|
| 后端路由 | ✅ `POST /api/v1/proxy/image/chat` 已新增 |
| 模型白名单 | ✅ `geekai/gemini-3.1-flash-image-preview` 已加入，`call_type=image_chat` |
| App 执行路由 | ✅ Tauri 图片模型表已加入该模型，执行层会走 Chat Image 后端代理 |
| 真实调用 | ⚠️ GeekAI API 返回 `402 金币余额不足`；用户后台截图显示账户仍有余额 |
| 本地退款 | ✅ balance `41 → 41` |
| API Logs | ✅ `image_chat error credits_used=5` |

**2026-04-28 直连复测结果**

| 测试项 | 结果 |
|--------|------|
| Key 存在性 | ✅ `backend/.env` 有 `GEEKAI_API_KEY`；未打印真实 key，安全指纹 `sha256_8=2d2b3cf4` |
| 同 key 文本模型 | ✅ `nemotron-3-super-120b-a12b` 直连 `/chat/completions` 返回 `OK` |
| `gpt-image-2` | ✅ 用户账单显示 `/images/generations` 已成功扣费，传统图片线路可用 |
| Gemini 光合作用信息图 | ✅ 直连 `/chat/completions` 成功，返回 `message.image.url` 和 markdown 图片链接 |
| Gemini `enable_search` 天气图 | ✅ `enable_search=true`、`image.aspect_ratio=5:4` 成功，返回图片 URL |
| Gemini 后台模式 | ⚠️ `background=true`、`image_size=0.5K` 返回 `201 pending`，轮询 `/chat/{id}` 后上游返回 `500 failed / invalid argument` |

**当前判断**
- Tangent 后端代理实现与用户提供文档一致：`POST /chat/completions`、`messages[].content[]`、可选 `image.image_size` / `aspect_ratio`、可选 `background=true`。
- Chat Image 分辨率白名单已按 GeekAI 文档收口为 `0.5K`、`1K`、`2K`、`4K`；Tangent 默认测试值为 `0.5K`。
- Gemini 3.1 Flash Image Preview 同步图像生成已确认可用；之前 `402` 更像临时额度/通道状态或请求窗口问题，不再作为当前阻断。
- 后端结果提取逻辑能处理这次响应中的 markdown 图片链接；`message.image.url` 也会被递归 URL 提取覆盖。
- 已修后端 Chat Image 代理接受 `201`，避免 `background=true` pending 响应被提前当作失败；后台任务本身仍需按 GeekAI 最终轮询结果继续验收。
- 下一步：用 Tangent `/api/v1/proxy/image/chat` 跑一次同步请求，确认扣费、返回 PNG、API Logs 和失败退款都经过本地代理闭环。

---

### Step 6 — 测试图片编辑模型

**你要做什么**
- 提供或确认使用一张测试图片。

**我要做什么**
- 用一张小图测试：

```http
POST /api/v1/proxy/image/chat
provider=geekai
model=gemini-3.1-flash-image-preview
prompt=把背景改成淡蓝色，保留主体
images=[<测试图片 base64 或 URL>]
```

`gpt-image-1` 作为备用编辑模型时继续走：

```http
POST /api/v1/proxy/image/edit
provider=geekai
model=gpt-image-1
prompt=把背景改成淡蓝色，保留主体
image=<测试图片 base64 或 URL>
```

**验收标准**
- 返回编辑后的 `image/png`。
- Admin `/api-logs` 有图片编辑记录。
- 失败退款可追踪。

**为什么**
- Image Editor 的 AI Edit 依赖这个接口。

---

### Step 7 — 测试图片增强模型

**你要做什么**
- 确认可以消耗一次增强额度。

**我要做什么**
- 调用：

```http
POST /api/v1/proxy/image/enhance
provider=geekai
model=jimeng-image-enhance-v2
image=<测试图片 base64 或 URL>
size=720p
```

**验收标准**
- 返回增强后的 `image/png`。
- Admin `/api-logs` 有 `image_enhance` 记录。

**为什么**
- enhance 是下一阶段 Image Editor 的重要增值能力。

---

### Step 8 — App 端完整工作流验收

**你要做什么**
- 在 App 里新建 workflow。
- 用公众号 Skill 或手动节点测试：
  - `text_input`
  - `research`
  - `outline_generator`
  - Split
  - `image_list`
  - `html_formatter`

**我要做什么**
- 观察日志、接口、积分、模型选择是否一致。
- 如果某节点仍走硬编码或旧模型，我定位并修复。

**为什么**
- API 单测只能证明接口可用，完整工作流验收才能证明产品可用。

---

## 4. 开发计划与修复计划

> 2026-04-27 对齐：下方 P0 仍保留为 GeekAI runbook 的背景记录；当前真正执行入口已拆到 `dev-plans/admin-provider-model-management-p0.md`，避免计划散乱。

### P0 — 当前必须做

#### P0.1 Provider/Model 默认值管理

**我要开发**
- 给 `model_configs` 增加：
  - `is_default`
  - `fallback_priority`
  - `capabilities`
- Admin `/models` 增加：
  - 设为默认文本模型
  - 设为默认生图模型
  - 设为默认图片编辑模型
  - 设为默认增强模型
  - fallback 优先级
- `/api/v1/models` 返回默认模型信息。
- App `ModelSelector` 和节点默认值读取后端默认模型。

**你要验收**
- 在 Admin 改默认模型。
- 新建节点后默认模型自动变化。
- 禁用默认模型时，系统提示需要重新选择默认模型。

**为什么**
- 这是“后台控制前端节点”的核心闭环。

---

#### P0.2 执行层移除静态模型映射

**我要开发**
- Rust/Tauri 执行层不再只依赖 `src-tauri/src/services/ai_types.rs` 静态表。
- 节点执行时保留用户选中的 model id。
- 后端通过 DB 校验 provider/model/call_type。
- 必要时 App 缓存 active model list，用于 provider 映射。

**你要验收**
- Admin 新增一个 active 模型后，App 能显示并执行。
- Admin 禁用模型后，App 不再允许选择。

**为什么**
- 否则 Admin 模型管理只是“显示控制”，不是“执行控制”。

---

#### P0.3 GeekAI 真 Key 全链路验收

**我要开发/修复**
- 修真实 Key 联调中发现的请求体字段问题。
- 修失败退款日志。
- 确认异步 `task_id` 查询逻辑。
- 将每类调用的验收命令写入文档。
- 为 `gpt-image-2` 加模型参数过滤：不向它发送 `negative_prompt`、`seed`、`strength`、`aspect_ratio`、`style_preset`。
- 为 `gpt-image-2` 固定合法 `size` 映射：`1024x1024`、`1024x1536`、`1536x1024`。
- 新增 `gemini-3.1-flash-image-preview` 的 Chat Image 代理通道。
- 新增 Chat 后台模式轮询：`POST /chat/completions background=true` → `GET /chat/{id}`。

**你要验收**
- 文本、生图、图片编辑、enhance 都至少成功一次。
- `gpt-image-2` 文生图成功。
- `gpt-image-2` 以图生图成功。
- `gemini-3.1-flash-image-preview` 文生图成功。
- 失败一次也要确认退款。

**为什么**
- 商业化前，扣费和退款必须可信。

---

#### P0.4 Admin 中文化与设计对齐

**我要开发**
- Sidebar、页面标题、表单、按钮、空状态、错误提示全部中文化。
- 按 `reference/design-system.md` 调整视觉：
  - 灰度主色
  - Cal.com 风格卡片阴影
  - 减少蓝色/Slate 大色块
  - 表格、Dialog、Button 统一

**你要验收**
- 中文环境下无英文 UI 混入。
- 每页视觉和主 App 风格一致。

**为什么**
- Admin 是运营系统，不是临时工具；语言和视觉统一会显著减少误操作。

---

## 5. 建议执行顺序

1. **先做 Admin Provider/Model 管理闭环**
   原因：先把默认值、fallback、health/test 做进后台，后续排查不用靠临时命令。

2. **再用 Admin 测试按钮复测 GeekAI**
   原因：同一入口能记录上游原始错误、API Logs 和本地退款。

3. **先测文本，再测低成本生图**
   原因：文本成本低、排错快；`gpt-image-2` 优先使用 `quality=low`，Gemini Chat Image 优先使用 `image_size=0.5K`。

4. **最后收口 Admin UI 中文/设计对齐**
   原因：避免先美化，后面因功能调整反复改页面。

---

## 6. 本轮完成标准

- [x] 后端读取到 `GEEKAI_API_KEY`。
- [x] Provider CRUD API 探针通过。
- [x] `nemotron-3-super-120b-a12b` 文本调用成功。
- [x] `gpt-image-2` 历史生图调用成功。
- [x] `gpt-image-2` 本次 smoke test 未发送不支持的参数。
- [ ] `gemini-3.1-flash-image-preview` Chat Image 成功出图。
- [x] 至少一个失败调用能自动退款并写入 API Logs。
- [x] Admin `/api-logs` API 能看到成功记录。
- [ ] Admin `/api-logs` 浏览器页面人工确认成功记录。
- [x] Admin `/api-logs` API 能看到失败记录。
- [x] App 模型下拉基础读取 Admin active 模型。
- [ ] App 节点默认值读取 Admin default model。
- [x] 新开发计划拆成当前 P0：`dev-plans/admin-provider-model-management-p0.md`。

---

## 7. 相关文件索引

| 文件 | 作用 |
|------|------|
| `dev-plans/admin-integration-acceptance.md` | Admin 自动验收与页面验收记录 |
| `backend/app/api/v1/admin.py` | Admin users/credits/logs/providers/models API |
| `backend/app/api/v1/models.py` | App 读取 active models |
| `backend/app/api/v1/proxy.py` | App AI 调用后端代理入口 |
| `backend/app/services/proxy/` | GeekAI/OpenAI-compatible 请求、扣费、退款、日志 |
| `backend/app/models/credit.py` | CreditBalance / ApiCallLog / ModelConfig |
| `backend/app/models/provider.py` | Provider Registry |
| `frontend/src/components/ModelSelector.tsx` | App 节点模型下拉 |
| `frontend/src/nodes/nodeDefs.ts` | 当前节点默认模型，待改为后端默认 |
| `src-tauri/src/services/ai_types.rs` | 当前静态模型 provider 映射，待弱化或移除 |
| `src-tauri/src/services/official_images.rs` | Tauri 官方图片/Chat Image/Edit 后端代理调用 |
| `src-tauri/src/services/library_assets.rs` | `image_list` 生成图片同步保存到个人素材库 |
