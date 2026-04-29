# Admin Provider / Model 管理闭环 P0 Plan

**创建时间**: 2026-04-27
**状态**: 🟡 当前 P0，开发中
**当前总入口**: 是。下一轮如果不知道看哪里，先看本文件。
**范围**: Admin Provider 线路配置、模型默认值、模型能力、健康检查、App 节点默认模型、GeekAI API 排障入口

---

## 0. 现在开发计划到哪里

当前项目已经完成这些基础能力：

1. Admin 后台基础页面与 API 已存在：`/dashboard`、`/users`、`/credits`、`/api-logs`、`/providers`、`/models`。
2. Provider Registry 已存在：`geekai` 的 `base_url=https://geekai.co/api/v1`、`key_env=GEEKAI_API_KEY`、`auth_style=bearer`。
3. ModelConfig 已存在：Admin 可启停模型，App 可通过 `/api/v1/models` 读取 active models。
4. GeekAI 文本默认已切到 `nemotron-3-super-120b-a12b` 并通过后端代理 smoke test。
5. `gemini-3.1-flash-image-preview` 已作为当前 Nano Banana / Gemini 图像生成与编辑模型，走 `/api/v1/proxy/image/chat`。
6. `gemini-nano-banana` 已标记为 legacy alias，不再作为当前默认模型 ID。
7. `image_list` 生成图已自动写入 workflow assets 并登记到个人图片素材库。

当前最大缺口：

- Admin 还不能完整管理“默认模型、fallback 优先级、模型能力、前端测试按钮展示”；后端 health/test 与详情 API 已开始补齐。
- App 节点默认值仍有本地硬编码 fallback，还没有完全以后端默认模型为准。
- GeekAI 文本、`gpt-image-2` 与 Gemini Chat Image 同步直连已通过；不同模型已经开始拆分独立参数和最低成本测试用例，仍需要 Admin 提供清晰测试入口来定位后续 Key、额度、通道、模型参数和后台任务问题。
- 计费口径明确为内部统一按积分记账：**1 积分 = 0.01 元人民币**；后续海外出海时，用户购买额度可以用 USD 展示/结算，但 API 用量账本仍记录 `credits_used`，避免人民币/美元切换影响历史用量。

### 0.1 现在到底看哪里

| 文件 | 什么时候看 | 你会得到什么 |
|------|------------|--------------|
| `project_state.md` | 每次重新进入项目时先看 | 当前阶段、主流程、P0 待办和计划入口 |
| `dev-plans/admin-provider-model-management-p0.md` | 本轮开发和验收时一直看 | 你做什么、我做什么、为什么、验收清单 |
| `dev-plans/admin-provider-model-geekai-runbook.md` | 查 GeekAI 真 Key、接口、错误时看 | 文本/图片/API Logs/失败退款实测记录 |
| `dev-plans/admin-integration-acceptance.md` | 人工点 Admin 页面时看 | 每个 Admin 页面和 API 的验收状态 |
| `dev-plans/image-save-chat-image-p0.md` | 查生成图保存在哪里时看 | `image_list` 入库、个人素材库、Chat Image 通道状态 |

本轮不再从 `phase2-commercial.md` 或旧 slice 计划里找下一步；那些文件是阶段背景。当前执行以本文件为准。

---

## 1. 本轮目标

把 Admin 从“能看/能改 provider 和 model”升级成“能控制 App AI 线路”的运营后台：

```text
Admin 设置 Provider / Model / 默认值 / fallback
→ App 读取 active models + default models
→ 节点新建时自动使用 Admin 默认模型
→ 执行失败时 Admin 能看到原始错误、测试线路、排查 Key/模型/通道
```

完成后，后续你不需要改代码就能切换：

- 默认文本模型
- 默认图片生成模型
- 默认图片编辑模型
- 默认图片增强模型
- Provider base_url / key_env / auth_style
- 模型启停与 fallback 优先级

---

## 2. 你下一步做什么

### Step U1 — 确认 GeekAI Key 权限页面

**你做什么**
- 打开 GeekAI 后台：API Keys / 系统 Keys / 账单记录。
- 找到当前 key 对应名称，例如 `TestTangent`。
- 截图或确认：
  - 这个 Key 是否启用。
  - 是否有单 Key 限额。
  - 是否限制图片模型。
  - 是否限制 API 调用通道。
  - `gpt-image-2` / `gemini-3.1-flash-image-preview` 是否对该 key 可用。

**我做什么**
- 在 Admin 加 Provider health/test 按钮后，用同一个 key 发最小测试请求。
- 记录原始响应，不再只展示“502”。

**为什么**
- 之前 `gemini-3.1-flash-image-preview` 曾返回 `402`，但后续按官方示例复测已成功；仍需要把 Admin 测试入口做好，方便以后直接区分“模型成功、上游失败、Key/额度问题、请求体问题”。

**2026-04-28 复测记录**
- ✅ `backend/.env` 中 `GEEKAI_API_KEY` 存在，未打印真实 key；本地安全指纹为 `sha256_8=2d2b3cf4`，用于和后台 TestTangent key 自查是否同一把。
- ✅ 同一 key 直连 `nemotron-3-super-120b-a12b` 文本模型成功返回 `OK`，说明 key 本身未失效。
- ✅ `gpt-image-2` 已在 GeekAI 账单中显示成功扣费记录，说明传统 `/images/generations` 图片线路可用。
- ✅ GPT-Image-2 参数白名单已收口：`size=1024x1024/1024x1536/1536x1024`，`quality=low/medium/high`；测试默认使用 `quality=low`。
- ✅ `gemini-3.1-flash-image-preview` 按用户提供的光合作用信息图示例直连 `/chat/completions` 成功，返回图片 URL。
- ✅ `enable_search=true` + `image.aspect_ratio=5:4` 的旧金山天气图示例直连成功，返回图片 URL。
- ✅ Chat Image 分辨率白名单已收口为 `0.5K`、`1K`、`2K`、`4K`；后续测试默认用 `0.5K` 控制成本。
- ⚠️ `background=true` + `image_size=0.5K` 先返回 `201 pending`，轮询 `/chat/{id}` 后上游返回 `500 failed / invalid argument`；后台模式继续待单独适配和参数验证。
- 结论：Gemini 3.1 Flash Image Preview 同步图像生成线路可用；下一步在 Tangent 后端代理接受 `201 pending` 并继续保留 Admin 测试入口，方便复现同步/后台/搜索三类调用。

### Step U2 — 确认默认模型策略

**你做什么**
- 确认默认模型是否按下面顺序：
  - 文本：`nemotron-3-super-120b-a12b`
  - 图片生成：`gpt-image-2`
  - 图片生成/编辑高级路线：`gemini-3.1-flash-image-preview`
  - 图片编辑备用：`gpt-image-1`
  - 图片增强：`jimeng-image-enhance-v2`

**我做什么**
- 把这些默认值做成 Admin 可配置项。
- App 新建节点时读取 Admin 默认，不再只看前端硬编码。

**为什么**
- 模型会变，默认值必须后台可改，不应该每次改代码。

### Step U3 — 人工页面验收

**你做什么**
- 我开发完后，你逐页点：
  - `/providers`
  - `/models`
  - `/api-logs`
- 检查中文、按钮、表格、错误提示是否清楚。

**我做什么**
- 修 UI 文案、状态、错误提示。
- 把验收结果写回 `dev-plans/admin-integration-acceptance.md`。

**为什么**
- API 通不等于后台好用，运营后台必须减少误操作。

---

## 3. 我要做什么

### Step C1 — 数据库能力扩展

**我要开发**
- 给 `model_configs` 增加：
  - `is_default`
  - `fallback_priority`
  - `capabilities` 或等价 JSON 字段
  - `endpoint_type` 或等价字段，用于区分 `chat_completions` / `images_generations` / `images_edits` / `images_enhance`
  - `parameter_schema`，记录不同模型可选参数
  - `pricing_schema`，记录积分扣费、上游成本币种、后续 CNY/USD 展示口径
  - `smoke_test_payload`，记录最低成本测试请求
- 可选给 `providers` 增加：
  - `health_status`
  - `last_checked_at`
  - `last_error`

**你配合**
- 确认默认模型策略。

**为什么**
- 现在 `call_type` 只能表达大类，不足以表达 Gemini 这种 Chat Image 模型。
- GPT-Image-2、Gemini Chat Image、Jimeng Enhance 的参数和最低成本测试组合不同，必须由 model capabilities 描述，不能写死在一个通用表单里。
- 价格不要只存人民币；Admin 和后端应把“内部积分扣费”和“上游人民币成本 / 后续美元售卖展示”拆开，避免出海时重算历史账本。

### Step C2 — 后端 Admin API

**我要开发**
- `GET /api/v1/models` 返回：
  - active models
  - default models by call_type / capability
  - fallback order
- Admin models API 支持：
  - 设置默认模型
  - 设置 fallback priority
  - 编辑 capabilities / endpoint_type
  - 返回可选参数 schema、最低成本 smoke test 参数、价格档位
- Admin providers API 支持：
  - provider health check
  - provider test call
  - key_env 是否已配置的布尔状态，不暴露真实 key

**你配合**
- 给我真实测试模型优先级和是否允许测试消耗。

**为什么**
- 这是“后台控制前端节点”的核心闭环。

### Step C3 — Admin UI

**我要开发**
- `/providers` 页面增加：
  - API 地址展示与编辑
  - key_env 展示
  - Key 已配置/未配置状态
  - 测试 Provider 按钮
  - 最近一次健康检查结果
- `/models` 页面增加：
  - 默认模型标记
  - 一键设为默认
  - fallback 顺序
  - capability / endpoint 标签
  - 模型参数选项，例如 GPT-Image-2 `size/quality`、Gemini `image_size/aspect_ratio`、Enhance `size`
  - 测试模型按钮
- `/api-logs` 页面增强：
  - 原始错误预览
  - provider/model/call_type 过滤
  - success/error 快速筛选

**你配合**
- 手动点击页面，确认你能看懂每个字段。

**为什么**
- GeekAI 这类“同一模型同步成功、后台模式失败、或偶发上游错误”的问题，必须能在后台自助定位。

### Step C4 — App 节点默认值

**我要开发**
- App 启动/登录后读取 `/api/v1/models`。
- 新建节点时优先使用后端 default model。
- 如果默认模型被禁用，节点显示明确错误并要求重新选择。
- 保留本地 fallback，仅用于后端不可用时兜底。

**你配合**
- 在 Admin 修改默认模型后，新建节点确认默认值变化。

**为什么**
- Admin 默认模型如果不能影响 App，就只是后台表格，不是真闭环。

---

## 4. 开发顺序

1. **数据库 migration**：先让默认值、fallback、能力字段有地方存。
2. **后端 API**：让 Admin 和 App 能读写这些配置。
3. **Admin UI**：做 Provider/Model 的设置、测试、健康状态。
4. **App 接入默认值**：节点创建时读后端默认。
5. **GeekAI 定向复测**：用 Admin 测试页复现 `gpt-image-2` / `gemini-3.1-flash-image-preview` 的真实响应。
6. **验收与文档**：跑构建、接口测试、手测清单、同步状态文件。

### 4.1 Step-by-step 协作表

| 步骤 | 你做什么 | 我做什么 | 为什么 |
|------|----------|----------|--------|
| 1 | 确认 GeekAI Key 页面是否启用图片模型、是否有限额 | 不打印 key，只检查环境变量是否存在 | 先排除 Key 权限问题 |
| 2 | 确认默认模型策略是否采用本文 Step U2 | 写 migration 和 seed 默认值 | 默认值必须能从后台改 |
| 3 | 暂停手动改模型，等我先补 Admin 字段 | 开发 Admin API：默认模型、fallback、capabilities、health/test | 避免页面和数据结构错位 |
| 4 | 打开 Admin `/providers`、`/models` 人工点选 | 修页面中文、设计、错误展示 | API 可用不等于页面可用 |
| 5 | 在 App 新建 text/image/edit 节点确认默认模型变化 | 接入 App 读取后端 defaults | 验证 Admin 真能控制 App |
| 6 | 允许一次低成本生图/编辑测试 | 用 Admin 测试按钮记录上游原始响应和退款日志 | 定位成功/失败来自 Key、通道、模型参数还是后台任务 |
| 7 | 最后跑一遍主流程手测 | 更新 `project_state.md`、runbook、acceptance 记录 | 把进度重新收口，避免下次迷路 |

---

## 5. 验收清单

- [x] 后端 `GET /api/v1/admin/providers/{provider_id}/health` 能返回 `base_url`、`key_env`、active、Key 配置状态。
- [x] 后端 `POST /api/v1/admin/providers/{provider_id}/test` 能 dry-run / execute 低成本测试，并写 API log。
- [x] Admin `/providers` 页面能看到 GeekAI 的 `base_url`、`key_env`、`auth_style`、Key 配置状态。
- [x] Admin `/providers` 页面能点击 dry-run / 真实测试 GeekAI Provider，并展示原始错误。
- [x] Admin `/models` 能把某个模型设为默认文本/图片/编辑/enhance。
- [ ] Admin `/models` 能配置 fallback priority。
- [x] `/api/v1/models` 返回默认模型配置。
- [x] 数据库已支持模型 capabilities、参数 schema、最低成本 smoke test 参数和价格档位。
- [x] Admin `/models` 页面能展示模型 capabilities、参数 schema、最低成本 smoke test 参数和价格档位。
- [x] App 新建 text/research/outline/html/image/edit 节点时使用 Admin 默认模型。
- [ ] 禁用默认模型时有明确提示。
- [ ] `gpt-image-2` / `gemini-3.1-flash-image-preview` 的同步、搜索、后台任务和失败退款能通过 Admin 测试页复现并记录。
- [x] 后端 `GET /api/v1/admin/models/{model_id}` 能返回模型详情、用量聚合和最近日志。
- [x] 后端 `POST /api/v1/admin/models/{model_id}/test` 能按 `smoke_test_payload` dry-run / execute 模型测试。
- [x] 后端 `GET /api/v1/admin/api-logs/{log_id}` 能返回单条日志详情和用户信息。
- [ ] `npm -C admin run build` 通过。
- [ ] `npm -C frontend run build` 通过。
- [ ] `cargo check --manifest-path src-tauri/Cargo.toml` 通过。
- [ ] `git diff --check` 通过。

---

## 6. 文件索引

| 文件 | 作用 |
|------|------|
| `project_state.md` | 当前项目总状态与下一步入口 |
| `dev-plans/admin-provider-model-management-p0.md` | 本轮 Provider/Model 管理闭环主计划 |
| `dev-plans/admin-provider-model-geekai-runbook.md` | GeekAI 真 Key、模型、错误响应联调记录 |
| `dev-plans/admin-integration-acceptance.md` | Admin 页面/API 验收记录 |
| `backend/app/models/credit.py` | ModelConfig 数据结构 |
| `backend/app/models/provider.py` | Provider Registry 数据结构 |
| `backend/app/api/v1/admin.py` | Admin Provider/Model API |
| `backend/app/api/v1/models.py` | App 读取 active/default models |
| `frontend/src/components/ModelSelector.tsx` | 前端模型下拉 |
| `frontend/src/nodes/nodeDefs.ts` | 当前节点默认值 fallback，待改为后端 default |
| `src-tauri/src/services/ai_types.rs` | 当前静态 provider/model fallback，待弱化 |

---

## 7. 风险 / 阻断

- GeekAI 后台任务可能返回 pending 后失败，需要 Admin 测试页展示原始状态、task id 和最终错误。
- 默认模型字段需要 migration；如果已有线上数据，后续上线前要做安全迁移。
- Admin UI 中文化和设计规范需要顺手一起修，避免后面重复返工。

---

## 8. 后续 Admin 分析系统补充

用户提出的 Mixpanel 级后台分析能力是需要补的，但它不应该抢在当前 P0 前面一次性重做。

当前顺序建议：

1. **先完成本文件 P0**：Provider/Model 默认值、fallback、health/test、App 默认模型读取。
2. **再进入 Admin Analytics P0.5/P1**：API 用量账本、模型注册表详情、用户调用时间线、收入/漏斗/留存。
3. **最后补 P2**：内容审核、Admin 操作审计、模拟用户。

详细计划见：`dev-plans/admin-analytics-dashboard-plan.md`。

### 为什么不能先做完整大屏

- 目前 `ApiCallLog` 只有基础字段，无法完整解释上游成本、退款关联、task id、请求参数摘要。
- 当前收入数据主要来自积分流水和 Stripe webhook，MRR/ARR/LTV/Churn 需要更完整账单表才能准确计算。
- 如果先做图表，容易出现“页面很漂亮但数据口径不可信”的问题。

### 和本 P0 的接口边界

本 P0 会先补：

- `model_configs` 的默认值、fallback、capability、参数 schema、最低成本测试 payload。
- `api_call_logs` 的 API 详情、错误、退款、task id 可追踪能力。
- Admin `/models`、`/providers`、`/api-logs` 的测试和排障入口。

这些字段会成为后续 `admin-analytics-dashboard-plan.md` 里 Overview、Funnel、Cohort、Revenue、Model Usage 的数据基础。

---

## 9. 2026-04-28 实现记录

### 已完成

- 新增 migration：`backend/migrations/versions/a00000000009_add_model_registry_analytics_fields.py`。
- `model_configs` 已增加：
  - `endpoint_type`
  - `capabilities`
  - `parameter_schema`
  - `pricing_schema`
  - `smoke_test_payload`
  - `is_default`
  - `fallback_priority`
- `api_call_logs` 已增加：
  - `endpoint`
  - `request_params`
  - `response_meta`
  - `upstream_task_id`
  - `error_code`
  - `refund_transaction_id`
  - `upstream_cost`
  - `route_provider`
- 已为 `gpt-image-2` 写入 size / quality 参数、人民币上游价格表、内部积分扣费口径、最低成本 smoke payload。
- 已为 `gemini-3.1-flash-image-preview` 写入 `0.5K/1K/2K/4K`、搜索/后台模式 capability、最低成本 `0.5K` smoke payload。
- 已明确价格拆分：
  - 内部账本：`credits_used`
  - 当前积分价值：`1 credit = 0.01 CNY`
  - 上游成本：`pricing_schema.provider_cost`
  - 后续海外售卖：通过套餐/展示支持 USD，不改历史 API log。

### 已验证

- `backend/.venv/bin/python -m compileall backend/app backend/migrations/versions/a00000000009_add_model_registry_analytics_fields.py` 通过。
- `PYTHONPATH=. .venv/bin/alembic upgrade head` 已在本地 PostgreSQL 成功升级到 `a00000000009`。
- 已查询确认 `nemotron-3-super-120b-a12b`、`gpt-image-2`、`gemini-3.1-flash-image-preview` 的 endpoint、默认状态、fallback、smoke payload 已写入。
- `git diff --check` 通过。

### 下一步

1. 手测 Admin `/models` 点击“设默认”后，App 新建对应节点是否立即使用新默认模型。
2. 后端测试接口的真实请求结果继续补 response meta / upstream cost 更细粒度解析。
3. 用 Tangent 代理复测 Gemini Chat Image 同步、搜索和后台模式。

### 2026-04-28 追加实现

- 新增 `backend/app/api/v1/admin_diagnostics.py`，避免继续扩大已超过 300 行的 `admin.py`。
- 新增 `backend/app/services/admin/diagnostics.py`，集中处理 Provider health、模型测试、响应摘要、脱敏请求摘要。
- 新增 `backend/app/schemas/admin_diagnostics.py`，提供 Admin 诊断 API 响应结构。
- `backend/app/main.py` 已挂载 `admin_diagnostics.router` 到 `/api/v1/admin`。
- 新增接口：
  - `GET /api/v1/admin/providers/{provider_id}/health`
  - `POST /api/v1/admin/providers/{provider_id}/test`
  - `GET /api/v1/admin/models/{model_id}`
  - `POST /api/v1/admin/models/{model_id}/test`
  - `GET /api/v1/admin/api-logs/{log_id}`
- 测试接口默认 `execute=false`，只做 dry-run；需要真实消耗 GeekAI 额度时由 Admin UI 显式传 `execute=true`。

### 2026-04-28 Admin 前端接入

- `admin/src/app/models/page.tsx` 已拆为薄 page，主体移到 `admin/src/components/admin/models/ModelsClient.tsx`。
- `admin/src/app/providers/page.tsx` 已拆为薄 page，主体移到 `admin/src/components/admin/providers/ProvidersClient.tsx`。
- `admin/src/app/api-logs/page.tsx` 已拆为薄 page，主体移到 `admin/src/components/admin/api-logs/ApiLogsClient.tsx`。
- `/models` 已支持模型详情、能力/参数/价格 JSON、dry-run 与真实测试按钮。
- `/providers` 已支持线路诊断、Key 配置状态、dry-run 与真实测试按钮。
- `/api-logs` 已支持单条详情，展示 endpoint、error_code、task id、退款流水、请求摘要、响应摘要、上游成本。
- 真实测试按钮会先 `confirm`，避免误消耗 GeekAI 额度。

### 2026-04-28 App 默认模型接入

- 新增 `frontend/src/store/officialModelsStore.ts`，登录后统一缓存 `/api/v1/models`。
- 新增 `frontend/src/nodes/defaultData.ts`，新建节点时统一注入 Admin 默认模型。
- `Canvas` 节点选择器、Dashboard Skill 模板、AI Agent 建图、Outline Split 自动生成节点都已改为使用 `getNodeDefaultData()` 或 `getDefaultModelForCategory()`。
- `ModelSelector` 改为使用统一模型缓存，不再每个下拉单独请求模型列表。
- `nodeDefs.ts` 的 AI 节点默认数据已移除硬编码模型，保留 `DEFAULT_MODELS` 只作为后端不可用时的本地 fallback。
- Image Editor AI Edit 与 Html Editor AI Rewrite 的默认模型改为读取 Admin 默认模型。
- Agent 系统提示已改为不主动写死模型，除非用户明确要求指定模型。
- Admin `/models` 新增“设默认”按钮，调用 `POST /api/v1/admin/models/{model_id}/set-default`，后端会清理同类默认模型。
