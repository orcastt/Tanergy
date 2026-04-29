# Admin Analytics Dashboard & Model Registry Plan

**创建时间**: 2026-04-28  
**状态**: 🟡 新增规划，建议作为 Provider/Model P0 后的 P0.5 / P1 主线  
**范围**: 管理仪表板、AI API 线路与模型用量账本、用户分析、收入分析、漏斗/队列留存、内容审核、Admin 审计  
**结论**: 需要补充，但不建议一次性重做一个独立 Admin codebase；应该在现有 `backend/` 与 `admin/` 里增量升级。

---

## 1. 现状判断

当前 Admin 已经具备基础运营后台：

- 已有 Admin 登录、角色权限、基础页面：`/dashboard`、`/users`、`/credits`、`/api-logs`、`/providers`、`/models`。
- 已有 Provider Registry：可管理 `provider/base_url/key_env/auth_style/is_active`。
- 已有 ModelConfig：可启停模型，App 可通过 `/api/v1/models` 读取 active models。
- 已有 `ApiCallLog`：记录 provider、model、call_type、tokens、credits_used、latency、status、error。
- 已有积分流水：`CreditTransaction` 可记录充值、扣费、退款。

但它还不是 Mixpanel / Stripe / OpenAI Admin Console 那种完整分析系统，缺口主要在：

- 模型注册表还缺参数 schema、价格表、capability、endpoint 调用规则、默认值、fallback。
- API Logs 还缺请求参数摘要、上游任务 ID、退款关联、上游成本、失败错误码、响应元数据。
- 用户页还缺个人调用时间线、充值/消费/退款汇总、最近工作流、风控状态。
- 分析后端还缺事件采集、漏斗、队列留存、收入指标、内容审核队列、Admin 操作审计。

---

## 2. 总体原则

### 2.1 不新建独立后台项目

用户提出的“完整管理网络应用，包含 React 组件、API 路由和图表配置”是正确方向，但本项目已经有：

- 后端：`backend/` FastAPI
- 管理后台：`admin/` Next.js
- 数据库：PostgreSQL
- 计费/积分/API 日志基础表

所以开发方式应是：

```text
扩展现有 backend/app/models + migrations
→ 扩展 backend/app/api/v1/admin*.py
→ 扩展 admin/src/app 页面
→ 用现有 Admin 登录权限和设计系统
```

不另起一个全新 repo，避免认证、权限、部署、样式、数据模型重复。

### 2.2 先做“用量账本”，再做“分析大屏”

优先级顺序：

1. **API 用量账本准确**：每次 AI 调用是谁、哪个模型、哪个线路、多少钱、多少积分、是否退款。
2. **模型注册表完整**：每个模型支持什么参数、调用哪个 endpoint、价格怎么算、最低成本测试怎么发。
3. **用户详情能追溯**：每个用户的调用、充值、消费、退款、失败原因都能查。
4. **再做漏斗、留存、收入图表**：图表基于可信账本计算，不先画空壳大屏。

### 2.3 积分与币种口径

内部账本统一使用积分：

```text
1 积分 = 0.01 元人民币
```

设计上要把三件事分开：

- **内部用量账本**：永远记录 `credits_used`，用于用户余额、退款、模型消耗、毛利分析。
- **上游采购成本**：记录在 `pricing_schema.provider_cost`，当前主要是 GeekAI 的人民币价格表。
- **用户购买展示币种**：当前可按人民币展示；海外出海时可按 USD 套餐售卖，但不改历史 API log 的积分账本。

这样后续从人民币定价切到美元订阅/充值时，只需要调整套餐和汇率展示，不需要重算每条模型调用。

---

## 3. 分阶段开发路线

## Phase A — P0.5 AI API 用量账本与模型注册表

### 目标

把后台从“能看到一行 API log”升级为“能解释每次模型调用为什么扣这么多、失败是否退款、调用规则是什么”。

### 后端补充

#### 3.1 扩展 `model_configs`

新增或等价字段：

| 字段 | 用途 |
|------|------|
| `endpoint_type` | `chat_completions` / `images_generations` / `images_edits` / `images_enhance` / `chat_image` |
| `capabilities` | 支持文生图、图生图、多图、搜索、后台模式、enhance、文件对话等 |
| `parameter_schema` | 用户端/Admin 可选参数，如 size、quality、image_size、aspect_ratio |
| `pricing_schema` | 模型价格表、折扣、积分换算规则 |
| `smoke_test_payload` | 最低成本测试请求，默认使用最便宜参数 |
| `is_default` | 是否为某类默认模型 |
| `fallback_priority` | fallback 顺序 |

#### 3.2 扩展 `api_call_logs`

新增或等价字段：

| 字段 | 用途 |
|------|------|
| `endpoint` | 实际调用路径，如 `/images/generations`、`/chat/completions` |
| `request_params` | 脱敏后的请求参数摘要，不存完整 prompt/image |
| `response_meta` | task_id、image_count、finish_reason、provider request id 等 |
| `upstream_task_id` | GeekAI 异步任务 ID 或 Chat background ID |
| `error_code` | 上游错误码，如 400、401、402、500 |
| `refund_transaction_id` | 失败退款对应积分流水 |
| `upstream_cost` | 上游金币/人民币成本，允许为空 |
| `credit_cost` | 本系统扣除积分 |
| `route_provider` | fallback 后最终命中的线路 |

`pricing_schema` 推荐结构：

```json
{
  "billing_unit": "credit",
  "credit_value": { "currency": "CNY", "amount": 0.01 },
  "display_currencies": ["CNY", "USD"],
  "user_charge": { "mode": "fixed_per_call", "credits_per_call": 8 },
  "provider_cost": { "currency": "CNY", "unit": "image", "price_table": [] }
}
```

#### 3.3 新增 Admin API

| API | 用途 |
|-----|------|
| `GET /api/v1/admin/models/{id}/usage` | 单模型用量、成功率、成本、耗时 |
| `POST /api/v1/admin/models/{id}/test` | 按 smoke payload 测试模型 |
| `GET /api/v1/admin/providers/{id}/health` | Provider key/env/base_url 健康状态 |
| `POST /api/v1/admin/providers/{id}/test` | Provider 最小请求测试 |
| `GET /api/v1/admin/users/{id}/timeline` | 用户充值、扣费、API 调用、退款时间线 |
| `GET /api/v1/admin/api-logs/{id}` | 单次调用详情，含脱敏请求/响应元数据 |

### Admin UI 补充

| 页面 | 补充内容 |
|------|----------|
| `/dashboard` | API 成功率、今日调用、今日成本、失败退款、Top Models |
| `/models` | 参数 schema、价格表、capability、默认模型、fallback、测试按钮 |
| `/providers` | base_url、key_env 状态、健康检查、测试结果、最近错误 |
| `/api-logs` | 详情抽屉、错误码、task id、退款状态、请求参数摘要 |
| `/users/[id]` | 用户调用历史、充值/消费/退款、最近错误、最近工作流 |

### 最低成本测试规则

| 模型 | 默认测试参数 |
|------|--------------|
| `gpt-image-2` | `size=1024x1536` 或 `1024x1024`，`quality=low` |
| `gemini-3.1-flash-image-preview` | `image.image_size=0.5K`，必要时不用 `background` |
| 文本免费/低价模型 | 短 prompt：`只回复 OK` |
| 图片增强 | 最小尺寸，如 `720p` |

---

## Phase B — P1 产品分析事件系统

### 目标

像 Mixpanel 一样记录用户行为，但只记录产品事件，不默认存用户正文、图片内容或完整 prompt。

### 新增数据表

#### `analytics_events`

| 字段 | 用途 |
|------|------|
| `id` | 事件 ID |
| `user_id` | 登录用户，可为空 |
| `anonymous_id` | 未登录或设备级标识 |
| `session_id` | 会话 ID |
| `event_name` | `screen_view`、`button_click`、`node_run`、`image_generate` |
| `screen` | 当前页面或 modal |
| `properties` | 脱敏 JSON，如 node_type、model、workflow_id |
| `created_at` | 事件时间 |

### 事件命名规范

| 类型 | 示例 |
|------|------|
| 页面浏览 | `screen_view.dashboard`、`screen_view.canvas` |
| 功能点击 | `button_click.run_node`、`button_click.copy_html` |
| 节点使用 | `node_created.image_list`、`node_run.html_formatter` |
| AI 使用 | `ai_call.started`、`ai_call.succeeded`、`ai_call.failed` |
| 素材库 | `library_item.saved`、`library_item.dragged_to_canvas` |

### API

| API | 用途 |
|-----|------|
| `POST /api/v1/events` | App/前端上报产品事件 |
| `GET /api/v1/admin/analytics/events` | Admin 查询事件 |
| `GET /api/v1/admin/analytics/overview` | 活跃、参与度、功能使用概览 |

---

## Phase C — P1 漏斗、队列留存、收入仪表板

### 目标

给运营回答三个问题：

1. 用户有没有激活？
2. 用户是否持续回来？
3. 收入和 AI 成本是否健康？

### 漏斗可视化

默认漏斗：

```text
注册
→ 首次创建 workflow
→ 首次运行 text/research
→ 首次生成图片
→ 首次复制 Html / 导出结果
→ 首次充值 / 订阅
```

Admin 图表：

- Funnel chart：每一步人数、转化率、流失百分比。
- Trend line：按天/周查看 funnel conversion。
- Segment filter：按模型、计划、来源、语言过滤。

### 队列留存

默认 cohort：

- 周队列：用户注册周 → 第 1/2/3/4/8 周是否回访。
- 月队列：用户注册月 → 第 1/2/3/6 月是否回访。

Admin 图表：

- Cohort heatmap：颜色越深代表留存越高。
- 指标：`retained_users / cohort_users`。
- 事件口径：默认以 `screen_view.canvas` 或 `node_run.*` 作为活跃。

### 收入仪表板

指标：

| 指标 | 口径 |
|------|------|
| MRR | 当前有效月订阅收入 |
| ARR | `MRR * 12` |
| ARPU | 周/月收入 ÷ 活跃付费用户数 |
| LTV | ARPU ÷ churn rate，MVP 可先估算 |
| Churn | 上期付费、本期未续费用户比例 |
| Gross Margin | 收入 - 上游 AI 成本 |

注意：当前后端只有 Stripe checkout webhook 和积分流水，缺少完整 subscription/invoice 表。Phase C 需要补持久化账单表，否则 MRR/ARR 只能粗略估算。

---

## Phase D — P2 内容审核与安全运营

### 目标

在 AI 生成内容、素材库、导出内容开始产生真实用户数据后，提供审核入口。

### 新增数据表

| 表 | 用途 |
|----|------|
| `moderation_items` | 待审内容队列，存摘要、风险标签、来源 |
| `moderation_rules` | 自动审核规则 |
| `moderation_actions` | 管理员处理记录 |

### Admin 页面

| 页面 | 功能 |
|------|------|
| `/moderation` | 风险内容队列、筛选、批量处理 |
| `/moderation/rules` | 自动规则管理 |
| `/audit-logs` | 查看 Admin 操作记录 |

### 安全规则

- 默认不把用户完整文章、图片、prompt 全量送进分析事件。
- 审核队列只存必要摘要、风险标签和引用 ID。
- 查看敏感内容需要 Admin 权限，并写入审计日志。

---

## Phase E — P2 Admin 操作审计与模拟用户

### 目标

让后台操作可追责，避免误改 provider、模型价格、用户积分。

### 新增 `admin_audit_logs`

| 字段 | 用途 |
|------|------|
| `actor_admin_id` | 谁操作 |
| `action` | `model.update`、`provider.test`、`credit.grant`、`user.suspend` |
| `target_type` / `target_id` | 被操作对象 |
| `before` / `after` | 脱敏前后差异 |
| `ip_address` / `user_agent` | 风险排查 |
| `created_at` | 操作时间 |

### 模拟用户 Impersonation

建议做成 P2，且必须限制：

- 只允许超级管理员。
- 页面顶部显示“正在模拟用户”明显横幅。
- 不允许查看密码、key、支付敏感信息。
- 所有操作写入 `admin_audit_logs`。
- 默认用于调试 UI 状态，不用于代替用户执行付费或删除操作。

---

## 4. 仪表板布局与图表类型

### `/dashboard` Overview

| 区域 | 图表类型 | 指标 |
|------|----------|------|
| KPI Cards | 数字卡片 | 总用户、今日活跃、今日 API 调用、今日收入、失败率 |
| Usage Trend | Line chart | 7/30 天调用量、成功率、平均耗时 |
| Model Mix | Stacked bar / Pie | 文本/图片/编辑/enhance 各模型占比 |
| Cost Health | Line chart | credits 扣除、退款、上游成本、毛利 |
| Error Watch | Table | 最近失败、错误码、provider、model、用户 |

### `/analytics/funnel`

- Funnel chart：注册 → 激活 → 留存 → 收入。
- 每步显示：人数、转化率、流失人数、流失百分比。

### `/analytics/cohorts`

- Heatmap：周/月 cohort 留存。
- 行：注册周/月。
- 列：第 N 周/月。
- 值：留存率。

### `/analytics/revenue`

- KPI：MRR、ARR、ARPU、LTV、Churn、Gross Margin。
- Line chart：收入趋势、退款趋势、AI 成本趋势。
- Table：付费用户、套餐、最近付款、当前余额。

### `/models/[id]`

- KPI：调用量、成功率、平均耗时、平均积分、上游成本。
- Line chart：调用趋势、失败趋势。
- Table：最近调用、失败样本、fallback 命中情况。

### `/users/[id]`

- Timeline：注册、登录、workflow、AI 调用、充值、扣费、退款、封禁。
- Tables：API history、credit history、recent workflows。

---

## 5. 建议代码结构

### Backend

```text
backend/app/models/analytics.py
backend/app/models/admin_audit.py
backend/app/models/moderation.py
backend/app/schemas/analytics.py
backend/app/schemas/admin_audit.py
backend/app/api/v1/events.py
backend/app/api/v1/admin_analytics.py
backend/app/api/v1/admin_audit.py
backend/app/api/v1/admin_moderation.py
backend/app/services/analytics/aggregates.py
backend/app/services/analytics/funnels.py
backend/app/services/analytics/cohorts.py
backend/app/services/analytics/revenue.py
backend/migrations/versions/*_admin_analytics_tables.py
```

### Admin Frontend

```text
admin/src/app/analytics/page.tsx
admin/src/app/analytics/funnel/page.tsx
admin/src/app/analytics/cohorts/page.tsx
admin/src/app/analytics/revenue/page.tsx
admin/src/app/audit-logs/page.tsx
admin/src/app/moderation/page.tsx
admin/src/app/models/[id]/page.tsx
admin/src/components/charts/KpiCard.tsx
admin/src/components/charts/LineTrend.tsx
admin/src/components/charts/FunnelChart.tsx
admin/src/components/charts/CohortHeatmap.tsx
admin/src/components/admin/ApiLogDetailDrawer.tsx
admin/src/components/admin/UserTimeline.tsx
```

### Frontend / Desktop Event Tracking

```text
frontend/src/lib/analytics/events.ts
frontend/src/lib/analytics/track.ts
src-tauri/src/commands/analytics.rs
```

---

## 6. Step-by-step 协作指南

| 步骤 | 你做什么 | 我做什么 | 为什么 |
|------|----------|----------|--------|
| A1 | 确认后台优先看“模型/成本/用户调用历史” | 先扩 API 用量账本和模型注册表 | 这是现在最影响真实联调的缺口 |
| A2 | 确认价格口径：积分、人民币、GeekAI 金币如何换算 | 增加 `pricing_schema` 与成本字段 | 以后才能算毛利和模型成本 |
| A3 | 允许最低成本 smoke test | 做模型测试按钮和日志详情 | 方便快速定位线路问题 |
| B1 | 确认哪些用户行为需要追踪 | 做 `analytics_events` 和 `POST /events` | 只追踪有产品意义的事件 |
| B2 | 确认哪些内容不能采集 | 做事件脱敏和隐私规则 | 避免把文章、图片、prompt 误存进分析库 |
| C1 | 确认注册→激活→收入漏斗定义 | 做 funnel API 和图表 | 运营指标必须先统一口径 |
| C2 | 确认活跃定义 | 做 cohort API 和 heatmap | 留存不能用模糊口径 |
| C3 | 确认订阅/充值口径 | 补 billing 持久化表和 revenue dashboard | MRR/ARR 需要可靠账单源 |
| D1 | 等真实用户内容量上来后确认审核策略 | 做 moderation queue | 现在可规划，不必抢在 P0 前 |
| E1 | 确认谁有超级管理员权限 | 做 audit logs 和 impersonation | 高风险功能必须可追责 |

---

## 7. 开发验收清单

### Phase A 验收

- [ ] 单次 API 调用详情能看到 provider、model、endpoint、参数摘要、耗时、积分、错误码、退款状态。
- [ ] 每个模型能看到 capability、参数选项、价格表、最低成本测试 payload。
- [ ] Admin 能测试 `gpt-image-2`，默认使用 `quality=low`。
- [ ] Admin 能测试 `gemini-3.1-flash-image-preview`，默认使用 `image_size=0.5K`。
- [ ] 用户详情能看到个人调用历史、充值、扣费、退款。
- [ ] 失败调用自动退款时，API log 能关联 refund transaction。

### Phase B 验收

- [ ] 前端能上报 `screen_view`、`button_click`、`node_run`、`ai_call`。
- [ ] Admin 能按用户、事件名、时间范围查询事件。
- [ ] 不采集完整 prompt、文章正文、图片 base64。

### Phase C 验收

- [ ] Dashboard 有用户、调用、收入、失败率、成本趋势。
- [ ] Funnel 能展示每一步人数、转化率、流失百分比。
- [ ] Cohort heatmap 能自动按周/月计算留存。
- [ ] Revenue 能展示 MRR、ARR、ARPU、LTV、Churn，并标注口径。

### Phase D/E 验收

- [ ] 内容审核队列支持标记、批量操作、处理记录。
- [ ] 所有 Admin 改 provider/model/积分/用户状态的操作写入审计日志。
- [ ] 模拟用户功能有明显横幅、权限限制和审计记录。

---

## 8. 风险与取舍

- **不要先做漂亮大屏**：如果 `api_call_logs` 和 billing 数据不完整，图表会误导决策。
- **不要采集过多内容**：分析事件只存行为和脱敏属性，内容审核另走受控队列。
- **不要过早做 impersonation**：这是高风险能力，必须等 audit log 完成后再开。
- **不要把第三方 key 暴露给 Admin 前端**：Admin 只看 `key_env` 和“已配置/未配置”。
- **图表组件要复用**：避免每个页面手写 Recharts 配置，组件拆分保持文件可控。

---

## 9. 和当前 P0 的关系

当前仍应先完成：

1. `dev-plans/admin-provider-model-management-p0.md` 的 Provider/Model 默认值、fallback、health/test。
2. GeekAI 真调用的同步/后台模式、失败退款、API Logs 详情。
3. Admin 中文化与设计对齐。

本文件是下一层能力：当 Provider/Model P0 能稳定控制 App 后，再把数据沉淀为完整分析系统。

---

## 10. 2026-04-28 Phase A 进展

已完成底层能力：

- `model_configs` 已具备 endpoint、capability、parameter schema、pricing schema、smoke payload、default、fallback 字段。
- `api_call_logs` 已具备 endpoint、request summary、response meta、task id、error code、refund transaction、upstream cost、route provider 字段。
- Admin 诊断 API 已提供：
  - Provider health
  - Provider dry-run / execute test
  - Model detail + usage
  - Model dry-run / execute test
  - API log detail

仍待完成：

- Admin 页面接入这些 API。
- API log 详情抽屉展示脱敏请求摘要、响应摘要、退款关联、task id。
- 用户详情页时间线与模型用量图表。
