# Official API Only Routing + Admin Provider Plan

**状态**: 🔄 Phase 1/2 初版完成；当前 P0 转入 Admin Provider/Model 默认值、fallback、health/test 管理闭环
**创建时间**: 2026-04-26
**最近更新**: 2026-04-27 — 对齐 `gemini-3.1-flash-image-preview` / Nano Banana 2 当前模型 ID 与 Admin Provider/Model 管理计划
**背景**: 产品路线收口为 Tangent 官方后端代理线路；用户自带 API Key / BYOK 暂停作为默认功能，后续如需要再作为高级能力恢复。

---

## 当前执行入口

本文件是官方代理路线背景文档；下一轮开发以 `dev-plans/admin-provider-model-management-p0.md` 为准。

---

## Summary

当前目标是把 AI 调用路径做纯粹：

```text
Desktop App → 登录 / JWT → FastAPI proxy → Provider Registry → GeekAI/其他中转站/官方直连
```

用户侧不再配置第三方 API Key；Provider Key、模型配置、扣费、日志、fallback 都由后端和 Admin 管理。

---

## GeekAI 测试模型清单（当前白名单）

### 文本模型（测试优先免费）

| 优先级 | 模型 ID | 用途 | 备注 |
|--------|---------|------|------|
| 1 | `nemotron-3-super-120b-a12b` | 默认测试文本模型 | 当前原始 API 可同步返回 |
| 2 | `minimax-m2.7:free` | 测试备用文本模型 | 原始调用返回 task id，但查询结果未取到，暂不作为同步默认 |
| 3 | `hunyuan-3.0-preview` | 观察模型 | 当前原始 API 返回“模型不存在”，暂不作为默认 |

### 图片生成模型

| 优先级 | 模型 ID | 用途 |
|--------|---------|------|
| 1 | `gpt-image-2` | 默认图片生成 |
| 2 | `gemini-3.1-flash-image-preview` | Gemini 3.1 Flash Image Preview / Nano Banana 2 路线，走 Chat Completions |
| 3 | `jimeng_t2i_v40` | 即梦图片生成备用 |
| 4 | `nano-banana-2` / `nano-banana-hd` | 历史/待核验标签，当前不作为默认模型 ID |

### 图片编辑模型

| 优先级 | 模型 ID | 用途 | 备注 |
|--------|---------|------|------|
| 1 | `gemini-3.1-flash-image-preview` | 默认图片编辑 / 图生图 | 走 Chat Completions 的 Gemini 3.1 Flash Image Preview |
| 2 | `gpt-image-1` | 图片编辑 / 图生图备用 | GeekAI 当前支持编辑 |

### 图片增强模型

| 优先级 | 模型 ID | 用途 |
|--------|---------|------|
| 1 | `jimeng-image-enhance-v2` | 图片增强、清晰化、细节增强 |

---

## GeekAI 接口契约（按当前用户确认）

### 图片生成

- **Endpoint**: `POST https://geekai.co/api/v1/images/generations`
- **Auth**: `Authorization: Bearer $GEEKAI_API_KEY`
- **当前默认参数**: `response_format: "url"`、`output_format: "png"`、`async: false`、`retries: 0`
- **可透传参数**: `model`、`prompt`、`negative_prompt`、`image`、`strength`、`size`、`aspect_ratio`、`n`、`quality`、`style_preset`、`mask`、`watermark`、`background`、`extra_body`
- **返回兼容**: 同时兼容 `data[].url`、`data[].b64_json`、`revised_prompt`、`task_id`、`task_status`
- **GPT-Image-2 参数**: 允许 `size=1024x1024/1024x1536/1536x1024` 与 `quality=low/medium/high`；测试默认使用 `quality=low`，smoke test 使用最低成本组合 `size=1024x1536` + `quality=low`
- **GPT-Image-2 过滤**: 不向上游发送 `negative_prompt`、`seed`、`strength`、`aspect_ratio`、`style_preset`
- **GPT-Image-2 参考图**: 单图可传 `image`；多图可通过 Tangent API 的 `image` 数组传入，后端会映射为 GeekAI `images`

### 图片生成结果查询

- **Endpoint**: `GET https://geekai.co/api/v1/images/{task_id}`
- **用途**: 当 `task_status` 为 `running` 或异步模型返回 `task_id` 时轮询结果
- **备注**: 若 GeekAI 文档/真实接口方法存在差异，以真 Key 联调结果为准，后端适配层统一屏蔽差异

### 图片编辑 / 图生图

- **Gemini Endpoint**: `POST https://geekai.co/api/v1/chat/completions`
- **Images Edit Endpoint**: `POST https://geekai.co/api/v1/images/edits`
- **支持模型**: `gemini-3.1-flash-image-preview` 走 Chat Completions；`gpt-image-1` 走 Images Edit；`gemini-nano-banana` 已标记 legacy alias
- **图片入参**: `image` 支持单个字符串 URL/data URL，也支持字符串数组
- **Gemini 分辨率**: `image.image_size` 允许 `0.5K`、`1K`、`2K`、`4K`；Tangent 测试默认使用 `0.5K`
- **当前默认参数**: Gemini Chat Image 默认 `image_size: "0.5K"`、`background: false`；Images Edit 默认 `response_format: "url"`、`output_format: "png"`、`background: "auto"`、`quality: "auto"`、`retries: 0`

### 图片增强

- **Endpoint**: `POST https://geekai.co/api/v1/images/enhance`
- **支持模型**: `jimeng-image-enhance-v2`
- **当前默认参数**: `size: "720p"`、`response_format: "url"`、`output_format: "png"`、`retries: 0`
- **可透传参数**: `extra_body.enable_hdr`、`extra_body.enable_wb`、`extra_body.hdr_strength`

### 错误处理

- `400 validation_error`: 参数校验失败，展示字段级错误
- `401 unauthorized`: Key/token 无效，Admin/后端线路告警
- `413 invalid_request`: 请求参数或图片过大，提示压缩/换图
- `500 invalid_request`: 上游异常，记录调用日志并按策略退款/重试

---

## 阶段计划

### Phase 1 — 官方线路收口（当前阶段）

目标：桌面端只走官方后端代理，不再提示或使用用户自带 API Key。

- [x] Tauri `chat_completion` 只走 `official_chat_completion`
- [x] Tauri `image_generation` 只走 `official_image_generation`
- [x] 未登录统一返回 `LOGIN_REQUIRED`
- [x] Dashboard 删除“配置 API Key”提示
- [x] Settings Advanced 删除 API Key 管理入口
- [x] ModelSelector 不再因本地 Key 缺失灰显模型
- [x] 用户可见错误文案改为“登录 / 官方线路 / 积分”

### Phase 2 — GeekAI 作为官方中转线路

目标：把 GeekAI 接入后端 Provider Registry，作为第一条 OpenAI-compatible relay。

- [x] 后端新增 `geekai` Provider seed
- [x] 支持 `GEEKAI_API_KEY`
- [x] `proxy_service` 使用 `https://geekai.co/api/v1/chat/completions`
- [x] 文本/图片模型下拉默认改为 GeekAI 官方模型
- [x] 图片生成把 `model` 从前端传到 `/api/v1/proxy/image`
- [x] GeekAI 图片生成使用 `/images/generations`
- [x] Image Editor AI Edit 接入 `/images/edits` / 图生图官方路径
- [x] Html Editor AI 改写可选择文本模型
- [x] Image Editor AI Edit 可选择图片模型
- [x] Admin Models seed 加入 GeekAI 文本/图片模型
- [x] 文本测试模型优先级改为免费模型：`nemotron-3-super-120b-a12b` → `minimax-m2.7:free` → `hunyuan-3.0-preview`
- [x] 图片生成模型收口为：`gpt-image-2`、`gemini-3.1-flash-image-preview`、`jimeng_t2i_v40`；`nano-banana-2` / `nano-banana-hd` 仅保留为待核验/非默认标签
- [x] 图片编辑模型收口为：`gemini-3.1-flash-image-preview` 默认，`gpt-image-1` 备用；`gemini-nano-banana` 不再作为当前模型 ID
- [x] Admin Providers API 真实后端联调查看/编辑 GeekAI 已通过
- [ ] Admin Providers 页面补 health/test、Key 配置状态与原始错误展示
- [ ] 跑通 `research / outline_generator / html_formatter / image_list`

### Phase 2.5 — GeekAI 图片异步与增强接口

目标：把图片链路从“同步生成/编辑”升级为完整官方图片能力，但不阻塞当前主流程上线。

- [x] 支持图片生成异步任务 ID 与结果轮询（GeekAI `GET /images/{task_id}`，待真 Key 联调确认）
- [ ] Image Editor 接入 `POST /images/clarify`，用于图片超分/澄清类处理（待确认是否进入首轮）
- [x] Image Editor 接入 `POST /images/enhance` 后端代理，用于图像增强、清晰化、细节增强
- [x] 统一图片任务状态：queued / running / succeeded / failed / timeout
- [ ] Admin 调用日志记录图片任务 ID、上游模型、重试次数、最终 URL

### Phase 3 — Admin 动态模型源

目标：前端不再硬编码模型列表，由后端模型配置和 Admin 控制可见模型、价格与默认值。

- [x] `/api/v1/models` 暴露启用模型列表、类型、价格、provider
- [x] 前端 `ModelSelector` 从后端拉取模型，失败时使用本地安全 fallback
- [x] Admin Models seed 支持测试默认文本模型 `nemotron-3-super-120b-a12b`、默认图片模型 `gpt-image-2`、默认编辑模型 `gemini-3.1-flash-image-preview`
- [x] 后端校验请求模型必须存在于启用列表 / fallback 白名单，禁用模型返回 `MODEL_NOT_ENABLED`
- [x] Admin Providers API 真实联调新增、编辑、删除测试 provider 通过，`geekai` 配置正确
- [ ] Admin 可设置默认模型、fallback priority、capabilities、endpoint type

### Phase 4 — 模型与线路解耦

目标：模型不等于线路，后端可按优先级选择多个 relay。

- [ ] 增加模型到线路映射表或配置结构
- [ ] 记录 `route_provider`、`upstream_model`、`fallback_from`
- [ ] 支持主线路失败自动切备用线路
- [ ] Admin 可设置线路优先级、启停、超时

### Phase 5 — Staging 部署验收

目标：部署一套只给内部测试的真实环境。

- [ ] FastAPI + PostgreSQL + Redis 部署
- [ ] Admin Dashboard 部署
- [ ] SSL / CORS / 环境变量配置
- [ ] 创建首个 admin 用户
- [ ] 验证登录、积分、Provider、模型、调用日志、失败退款

### Phase 6 — Production 准备

目标：Staging 稳定后再上线正式环境。

- [ ] 备份策略
- [ ] 错误监控
- [ ] Provider 可用性监控
- [ ] 费用与积分策略复核
- [ ] 桌面端默认 backend URL 切生产

---

## 已实现文件索引

### Phase 1

- `src-tauri/src/services/ai_client.rs` — AI 文本/图片执行改为只走官方后端代理。
- `src-tauri/src/services/ai_types.rs` — 删除 direct BYOK 调用遗留请求/响应类型。
- `src-tauri/src/services/credits.rs` — 删除本地 BYOK 访问判断。
- `src-tauri/src/commands/execute/mod.rs` — AI 节点前置校验只检查官方登录态。
- `frontend/src/components/ModelSelector.tsx` — 登录后展示可选模型，不再检查本地 API Key。
- `frontend/src/pages/DashboardPage.tsx` — 删除“配置 API Key”提示条。
- `frontend/src/pages/settings/AdvancedTab.tsx` — 删除 API Key 管理入口，改为官方线路说明。
- `frontend/src/lib/executionEngine.ts` — 未登录错误文案改为官方线路登录提示。
- `frontend/src/i18n/locales/en.json` — 更新官方线路 / Mock / 登录文案。
- `frontend/src/i18n/locales/zh.json` — 更新官方线路 / Mock / 登录文案。

### Phase 2

- `backend/app/services/proxy_service.py` — 保留兼容 re-export，旧导入路径不变。
- `backend/app/services/proxy/provider.py` — Provider DB-first 读取、环境变量解析、启用模型白名单校验。
- `backend/app/services/proxy/credits.py` — 扣积分、退款、API 调用日志。
- `backend/app/services/proxy/chat.py` — 文本官方代理，GeekAI/OpenAI-compatible `/chat/completions`。
- `backend/app/services/proxy/images.py` — 图片生成、编辑、结果查询、增强代理。
- `backend/app/services/proxy/image_payloads.py` — GeekAI 图片生成/编辑请求体适配。
- `backend/app/services/proxy/image_results.py` — `url` / `b64_json` 结果解析与异步任务轮询。
- `backend/app/api/v1/proxy.py` — `/proxy/image` 改为结构化请求并透传 `model`。
- `backend/app/api/v1/proxy.py` — 新增 `/proxy/image/edit`。
- `backend/app/api/v1/proxy.py` — 统一代理错误状态码：积分不足、模型禁用、Provider 未配置、上游失败。
- `backend/app/schemas/credit.py` — `ImageProxyRequest` 增加 `model` 字段。
- `backend/app/schemas/credit.py` — 新增 `ImageEditProxyRequest`。
- `backend/app/core/config.py` — 增加 `GEEKAI_API_KEY` 配置字段。
- `backend/migrations/versions/a00000000002_add_providers.py` — 新库 seed 中包含 GeekAI。
- `backend/migrations/versions/a00000000003_seed_geekai_provider.py` — 已有库升级时补 seed GeekAI。
- `backend/migrations/versions/a00000000004_seed_geekai_models.py` — seed 官方 GeekAI 文本/图片模型。
- `frontend/src/nodes/modelDefs.ts` — 官方文本/图片模型列表切到 GeekAI 渠道。
- `frontend/src/nodes/image/HtmlRewritePopup.tsx` — AI 改写增加文本模型选择。
- `frontend/src/nodes/image/AiEditPopup.tsx` — AI 图片编辑增加图片模型选择。
- `src-tauri/src/services/credits.rs` — 增加官方图片编辑代理调用。
- `src-tauri/src/services/ai_client.rs` — Image Editor AI Edit 改为走官方图片编辑代理。
- `.env.example` — 增加 `GEEKAI_API_KEY` 示例。
- `backend/.env.prod` — 增加生产环境 `GEEKAI_API_KEY` 占位。

### Phase 2.5 / 3 已实现 / 待验收索引

- `backend/app/api/v1/proxy.py` — 已增加图片任务结果 `GET /images/{task_id}` 与 enhance 代理端点；clarify 待后续确认。
- `backend/app/services/proxy/images.py` — 已增加 GeekAI 图片异步结果轮询与 enhance 适配；clarify 待后续确认。
- `backend/app/api/v1/models.py` — 新增客户端可读模型列表接口。
- `frontend/src/components/ModelSelector.tsx` — 从后端模型源读取可选项，保留本地 fallback。
- `admin/` — Providers / Models 页面联调真实 CRUD 和默认模型设置。
- `frontend/src/nodes/modelDefs.ts` — 临时 fallback 模型列表改为当前 GeekAI 白名单。
- `backend/migrations/versions/*_seed_geekai_models.py` — seed 当前文本/图片/编辑/增强模型白名单与测试默认值。
- `backend/migrations/versions/a00000000005_update_geekai_model_whitelist.py` — 已有库升级时移除旧模型并补齐新白名单。
- `src-tauri/src/commands/credits.rs` — 新增 `list_official_models` Tauri 命令。
- `src-tauri/src/services/ai_client.rs` — Image Editor AI Edit 改为直接传图片 + 用户指令，不再先走文本改写 prompt。
- `src-tauri/src/services/ai_types.rs` — 文本、图片、编辑、增强模型映射改为 GeekAI 当前白名单。
- `backend/app/services/proxy/provider.py` — 请求模型未启用或类型不匹配时阻断调用，避免绕过前端下拉。

---

## 测试计划

- 前端：`npm -C frontend run build`
- 前端触碰文件：从 `frontend/` 执行定向 `npx eslint <files>`
- Rust：`cargo check --manifest-path src-tauri/Cargo.toml`
- 后端：`python3 -m compileall backend/app backend/migrations`
- 手测：
  - 未登录执行 AI 节点 → 提示登录，不再提示 API Key
  - 登录后执行文本节点 → 走 `/api/v1/proxy/chat`
  - Image Editor AI Edit → 走 `/api/v1/proxy/image/edit` 并透传图片模型
  - Image List → 图片生成透传 `gpt-image-2` / `gemini-3.1-flash-image-preview` / `jimeng_t2i_v40`
  - 异步图片任务 → 返回 `task_id` 后可轮询 `GET /images/{task_id}`
  - Image Enhance → `jimeng-image-enhance-v2` 可返回增强图
  - Settings Advanced → 不显示 API Key 配置
  - ModelSelector → 登录后模型可选，不依赖本地 Key

---

## 风险与阻断

- Admin Providers / Models 基础能力已存在；下一步补默认模型管理、fallback、health/test 和页面原始错误展示。
- GeekAI 图片结果、clarify、enhance 接口需要真 Key 联调确认返回结构后再收口；Gemini Chat Image 同步直连已成功，后台模式 pending 后失败需继续验证；clarify 尚未进入本轮实现。
- 部分历史文档仍描述 BYOK，需要随 Phase 1/2 逐步标 legacy。
- Staging 前需要真实域名、SSL、后端环境变量和至少一条可用 Provider Key。
