# Image Save Loop + Chat Image P0 Plan

**创建时间**: 2026-04-27
**状态**: 🔄 核心实现完成；Gemini Chat Image 同步直连成功，Tangent 代理闭环和后台模式待复测
**范围**: `image_list` 生成图片保存闭环、失败退款验收、GeekAI Chat Image 通道、Admin/API 文档同步

---

## 当前计划入口

本文件记录“生成图保存到哪里”和 Chat Image 初版实现。下一轮开发入口不是本文件，而是：

- 当前主计划：`dev-plans/admin-provider-model-management-p0.md`
- GeekAI 排障记录：`dev-plans/admin-provider-model-geekai-runbook.md`

---

## 1. 目标

把真实 GeekAI 生图从“接口返回临时 PNG”收口为产品可用闭环：

1. `image_list` 生成图片后自动保存到本地工作流 assets。
2. 同一张图片自动登记到全局个人素材库，可在 Workspace Library 复用。
3. 节点输出携带 `asset_id`、`file_path`、`library_item_id`、`library_file_path`、prompt、model 等索引。
4. 后端继续保证成功扣费、失败退款、API Logs 可追踪。
5. 新增 `gemini-3.1-flash-image-preview` 的 Chat Image 代理通道，为 Nano Banana 2 路线做准备。

---

## 2. 当前现状

| 模块 | 当前状态 | 问题 |
|------|----------|------|
| `image_list` | 已调用官方图片代理并写入 `$APPDATA/assets/{workflow_id}` | 没有自动进入个人素材库 |
| 个人素材库 | 已有 SQLite `library_items/tags` 与图片保存能力 | 目前多为用户手动保存 |
| 后端 `/proxy/image` | `gpt-image-2` smoke test 成功 | 仍需失败退款验收与参数过滤固化 |
| 后端 `/proxy/chat` | 文本 smoke test 成功 | Chat Image 还没有独立通道 |
| Admin Logs | API 可看到成功/失败记录 | 浏览器页面仍待人工验收 |

---

## 3. 实现步骤

### Step A — 生图自动保存到素材库

**我要做**
- 新增 Rust helper，将 PNG bytes 保存到 `$APPDATA/library/images`。
- 插入 `library_items(kind='image')`。
- 自动写入标签：`AI生成`、`image_list`、模型名。
- `image_list` 输出中增加 `library_item_id`、`library_file_path`、`library_tags`。

**你要验收**
- 运行 `image_list` 后，左侧个人素材库图片组能看到新图片。
- 拖拽该图片回画布能生成 `image_asset` 节点。

**为什么**
- 解决“生成图片在哪里找”的产品断点。

**实现结果**
- ✅ 新增 `src-tauri/src/services/library_assets.rs`。
- ✅ `image_list` 生成图继续写入 workflow assets。
- ✅ 同一张图同步写入 `$APPDATA/library/images` 并插入 `library_items`。
- ✅ 节点输出补充 `library_item_id`、`library_file_path`、`library_tags`、`model`。

### Step B — 失败退款验收

**我要做**
- 用错误模型或错误参数跑一次代理调用。
- 确认 `api_call_logs.status=error`。
- 确认扣除后自动 refund，余额回到失败前。
- 把结果写入 runbook。

**你要验收**
- Admin `/api-logs` 页面能看到 error。
- 用户积分没有被失败调用吞掉。

**为什么**
- 商业化调用必须保证失败不乱扣费。

**2026-04-27 实测结果**
- ✅ 使用 `gpt-image-2` 触发 GeekAI API `402 金币余额不足` 响应；用户后台截图显示账户仍有余额，因此该错误暂按 GeekAI API Key/通道侧异常处理，不再判定为真实账户余额不足。
- ✅ 本地积分余额从 `41` 到 `41`，确认自动退款。
- ✅ Admin API Logs 记录 `geekai/gpt-image-2 image error credits_used=8`。

### Step C — Chat Image 代理通道

**我要做**
- 新增 `/api/v1/proxy/image/chat`。
- 请求支持 `provider`、`model`、`prompt`、`images`、`aspect_ratio`、`image_size`、`enable_search`、`background`。
- GeekAI 请求映射到 `/chat/completions`。
- 支持后台模式 `background=true` 返回 id 后轮询 `/chat/{id}`。
- 从响应中提取图片 URL/base64，再返回 `image/png`。
- 失败时写 error log 并退款。

**你要验收**
- `gemini-3.1-flash-image-preview` 文生图成功。
- 之后再接入 App 的 `image_list` 模型选择。

**为什么**
- Nano Banana 2 / Gemini 3.1 Flash Image Preview 不是传统 `/images/generations`，需要单独通道。

**实现结果**
- ✅ 新增 `POST /api/v1/proxy/image/chat`。
- ✅ 新增 `ImageChatProxyRequest`。
- ✅ 新增 `proxy_chat_image_generation`，支持 `messages[].content[]`、`image.aspect_ratio`、`image.image_size`、`enable_search`、`background`。
- ✅ `image_size` 白名单支持 `0.5K`、`1K`、`2K`、`4K`；测试默认值已改为 `0.5K`。
- ✅ GPT-Image-2 白名单支持 `size=1024x1024/1024x1536/1536x1024` 与 `quality=low/medium/high`；App 默认 `quality=low`，测试用例使用最低成本参数。
- ✅ 支持 `background=true` 后轮询 `/chat/{id}`，并兼容 GeekAI `201 pending` 初始响应。
- ✅ 支持从 URL / base64 / markdown 文本中提取图片。
- ✅ Tauri 图片模型表加入 `gemini-3.1-flash-image-preview`，执行层会路由到 Chat Image 后端代理。
- ✅ 2026-04-28 复测：直连 GeekAI `/chat/completions` 的光合作用信息图示例成功返回图片 URL。
- ✅ 2026-04-28 复测：`enable_search=true` + `image.aspect_ratio=5:4` 的天气图示例成功返回图片 URL。
- ⚠️ 2026-04-28 复测：`background=true` + `image_size=0.5K` 返回 `201 pending`，轮询后上游返回 `500 failed / invalid argument`；后台模式继续待参数和模型支持确认。

---

## 4. 涉及文件索引

| 文件 | 改动 |
|------|------|
| `src-tauri/src/commands/execute/media.rs` | `image_list` 输出补素材库索引 |
| `src-tauri/src/commands/execute/media/image_planner.rs` | 从 `media.rs` 拆出的 image_planner，保持执行文件低于 300 行 |
| `src-tauri/src/services/library_assets.rs` | 新增图片保存到素材库 helper |
| `src-tauri/src/services/official_images.rs` | 拆出 Tauri 官方图片/Chat Image/Edit 代理调用 |
| `src-tauri/src/services/mod.rs` | 导出素材库 helper |
| `backend/app/api/v1/proxy.py` | 新增 Chat Image 路由 |
| `backend/app/schemas/credit.py` | 新增 Chat Image 请求 schema |
| `backend/app/services/proxy/` | 新增 Chat Image 代理/结果提取 |
| `dev-plans/admin-provider-model-geekai-runbook.md` | 写入测试与验收结果 |
| `dev-plans/admin-integration-acceptance.md` | 同步 Admin/API 验收状态 |

---

## 5. 测试计划

- `cargo check --manifest-path src-tauri/Cargo.toml`
- 后端最小 smoke test：`/api/v1/proxy/chat`、`/api/v1/proxy/image`
- 后端失败退款 smoke test
- `git diff --check`
- 手测：App 运行 `image_list` 后，在个人素材库图片组看到生成图
- 手测：Admin `/api-logs` 页面确认 success/error

---

## 6. 验收清单

- [x] `image_list` 输出包含 `library_item_id`。
- [x] 生成图片保存到 `$APPDATA/library/images`。
- [ ] 个人素材库图片组能看到生成图片。
- [x] 失败调用自动退款并写入 error log。
- [x] `/api/v1/proxy/image/chat` 可调用。
- [x] `gemini-3.1-flash-image-preview` 直连 GeekAI 至少完成一次成功出图 smoke test。
- [ ] `gemini-3.1-flash-image-preview` 通过 Tangent `/api/v1/proxy/image/chat` 返回 PNG 并写入 API Logs。
- [x] 文档状态同步完成。

---

## 7. 风险 / 阻断

- 真实生图会消耗 GeekAI 额度；`gpt-image-2` 测试尽量使用 `low`，Gemini Chat Image 测试尽量使用 `0.5K`。
- Chat Image 后续 smoke test 默认使用 `0.5K`；`2K` / `4K` 只做人工高质量验收，不进默认测试。
- Gemini Chat Image 同步直连已成功；后台模式 `background=true` 仍需确认合法参数和上游支持范围。
- Chat Image 响应格式可能随模型变化，需要兼容 URL、base64、content parts 多种形态。
- `image_list` 当前 Rust 文件超过 300 行，本轮只做必要调用；若继续扩展，需要拆分 `media.rs`。
