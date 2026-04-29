# Admin Integration Acceptance Plan

**创建时间**: 2026-04-27
**状态**: ✅ 自动验收通过；🔄 下一阶段进入 Provider/Model 默认值、fallback、health/test 人工验收
**范围**: Admin Next.js 前端、FastAPI Admin API、PostgreSQL 数据联动、客户端模型源联动

---

## 当前计划入口

- 当前主计划：`dev-plans/admin-provider-model-management-p0.md`
- 当前总状态：`project_state.md`
- GeekAI/API 联调记录：`dev-plans/admin-provider-model-geekai-runbook.md`

本文件只记录 Admin 页面/API 验收结果；下一轮开发和“你做什么 / 我做什么”的详细步骤看 `dev-plans/admin-provider-model-management-p0.md`。

---

## 目标

验证 Admin 管理后台从登录、权限、页面加载到核心 CRUD 的真实联动闭环：

```
Admin 前端 → FastAPI /api/v1/admin/* → PostgreSQL → /api/v1/models → 桌面端 ModelSelector / 节点默认模型
```

---

## 当前本地环境

| 服务 | 地址 | 状态 |
|------|------|------|
| Admin Frontend | `http://localhost:3000` | 待验收 |
| FastAPI Backend | `http://localhost:8000` | 待验收 |
| PostgreSQL | `localhost:5433` / Docker `tangent-local-postgres` | 待验收 |
| Redis | `localhost:6380` / Docker `tangent-local-redis` | 待验收 |

---

## 测试账号

| 类型 | 邮箱 | 状态 |
|------|------|------|
| Admin | `admin@tangent.com` | 已提升为 `role=admin` |
| 普通用户 | `admin-acceptance-user@example.com` | 验收时创建 |

---

## 页面验收清单

### 1. `/login`

- [x] 打开登录页返回 200
- [x] 发送 OTP 成功
- [x] 验证 OTP 后返回 JWT
- [x] JWT 用户可访问 Admin API
- [x] 非 admin 用户访问 Admin API 返回 403

### 2. `/dashboard`

- [x] 页面返回 200
- [x] `/api/v1/admin/stats` 返回统计数据
- [x] Provider 分布、Top Models、调用趋势字段存在

### 3. `/users`

- [x] 页面返回 200
- [x] `/api/v1/admin/users` 返回用户列表
- [x] 用户字段包含邮箱、角色、启用状态、积分余额
- [x] 用户启停接口可用（仅对测试用户）

### 4. `/credits`

- [x] 页面返回 200
- [x] `/api/v1/admin/credits/transactions` 返回积分流水
- [x] `/api/v1/admin/credits/grant` 可给测试用户充值
- [x] 充值后用户余额变化

### 5. `/api-logs`

- [x] 页面返回 200
- [x] `/api/v1/admin/api-logs` 返回调用日志列表
- [x] 筛选参数 `provider` / `status` / `user_id` 不报错

### 6. `/providers`

- [x] 页面返回 200
- [x] `/api/v1/admin/providers` 返回 provider 列表
- [x] `geekai` 存在且不删除
- [x] 测试 provider 可新增、编辑、删除

### 7. `/models`

- [x] 页面返回 200
- [x] `/api/v1/admin/models` 返回模型列表
- [x] 测试模型可新增、编辑、启停、删除
- [x] `/api/v1/models` 只返回 active 模型

---

## 已实现文件索引

- `admin/src/app/login/page.tsx` — Admin OTP 登录页
- `admin/src/app/dashboard/page.tsx` — Dashboard 统计页
- `admin/src/app/users/page.tsx` — 用户列表页
- `admin/src/app/users/[id]/page.tsx` — 用户详情页
- `admin/src/app/credits/page.tsx` — 积分管理页
- `admin/src/app/api-logs/page.tsx` — API 调用日志页
- `admin/src/app/providers/page.tsx` — Provider 管理页
- `admin/src/app/models/page.tsx` — 模型管理页
- `admin/src/lib/api.ts` — Admin API client
- `admin/src/lib/auth.ts` — Admin 登录/JWT helper
- `backend/app/api/v1/admin.py` — Admin API
- `backend/app/api/v1/models.py` — 客户端 active 模型列表 API
- `backend/app/models/provider.py` — Provider 数据模型
- `backend/app/models/credit.py` — Credit / ApiCallLog / ModelConfig 数据模型

---

## 自动验收记录

> 本节由本轮验收更新。

| 模块 | 结果 | 备注 |
|------|------|------|
| 服务启动 | ✅ 通过 | Admin `3000`、Backend `8000`、Postgres `5433`、Redis `6380` |
| 登录 / 权限 | ✅ 通过 | `admin@tangent.com` 可访问；普通用户访问 Admin API 返回 403 |
| Dashboard | ✅ 通过 | 页面 200，`/api/v1/admin/stats` 字段校验通过 |
| Users | ✅ 通过 | 页面 200，列表字段校验通过；测试用户启停可 flip 并恢复 |
| Credits | ✅ 通过 | 页面 200；测试用户充值 7 credits 后余额增加 |
| API Logs | ✅ 通过 | 页面 200；`provider` / `status` / `user_id` 筛选不报错 |
| Providers | ✅ 通过 | 页面 200；测试 provider 新增、编辑、删除通过；`geekai` 存在 |
| Models | ✅ 通过 | 页面 200；测试 model 新增、编辑、启停、删除通过 |
| Client Models | ✅ 通过 | `/api/v1/models` 只返回 active 模型；禁用测试模型后立即隐藏 |

---

## 本轮执行命令

- `curl http://localhost:8000/api/v1/health`
- `curl http://localhost:3000/login`
- `POST /api/v1/auth/send-otp`
- `POST /api/v1/auth/verify-otp`
- `GET /api/v1/admin/stats`
- `GET /api/v1/admin/users`
- `GET /api/v1/admin/credits/transactions`
- `POST /api/v1/admin/credits/grant`
- `GET /api/v1/admin/api-logs`
- `GET /api/v1/admin/providers`
- `POST/PATCH/DELETE /api/v1/admin/providers/{provider_id}`
- `GET /api/v1/admin/models`
- `POST/PATCH/DELETE /api/v1/admin/models/{model_id}`
- `GET /api/v1/models`
- `npm -C admin run build`

---

## 构建验收

- [x] `npm -C admin run build` 通过
- [x] `git diff --check -- dev-plans/admin-integration-acceptance.md` 通过
- [ ] Next.js warning 待后续处理：workspace root inferred，多 lockfile
- [ ] Next.js warning 待后续处理：`middleware` 文件约定 deprecated，后续迁移到 `proxy`

---

## 风险 / 待人工确认

- 浏览器内表单、弹窗、toast、loading 状态需要人工确认视觉与交互。
- 当前 Admin UI 仍有英文文案，后续需要按项目 i18n 和视觉规范统一。
- 线上 CORS / 域名 / SSL 需要 Staging 环境再验收。
- 2026-04-27 实测：`backend/.env` 已本地配置 `GEEKAI_API_KEY` 且被 git 忽略；后端重启后 `POST /api/v1/proxy/chat` 旧的 `503 No API key configured for provider: geekai` 已解除。
- 2026-04-27 实测：`POST /api/v1/proxy/chat` 早前使用 `geekai/hunyuan-3.0-preview` 成功；后续原始 API 对同模型返回“模型不存在”，当前测试默认已切到 `geekai/nemotron-3-super-120b-a12b`，后端代理成功返回 `OK`，扣除 1 credit，返回 `tokens=33`。
- 2026-04-27 实测：`POST /api/v1/proxy/image` 使用 `geekai/gpt-image-2` 成功返回 `image/png`，`size=1024x1024`、`quality=low`，样张保存到 `/tmp/tanvas-gpt-image-2-smoke.png`。
- 2026-04-27 实测：`GET /api/v1/admin/api-logs` 已能看到 `geekai/gpt-image-2 image success credits_used=8`、`geekai/hunyuan-3.0-preview chat success credits_used=1` 与 `geekai/nemotron-3-super-120b-a12b chat success credits_used=1`。
- 2026-04-27 追加实测：Provider API 探针通过。`GET /providers` 返回 6 个 provider；`geekai` 的 `base_url=https://geekai.co/api/v1`、`key_env=GEEKAI_API_KEY`、`auth_style=bearer`、`is_active=true`；临时 provider 新增、Patch、Delete 均成功。
- 2026-04-27 追加实测：失败退款通过。GeekAI API 返回 `402 金币余额不足` 时，本地积分 balance `41 → 41`，Admin API Logs 写入 `geekai/gpt-image-2 image error credits_used=8`；用户后台截图显示账户仍有余额，因此需继续排查 API Key/通道权限或 GeekAI 错误映射。
- 2026-04-27 追加开发：`gemini-3.1-flash-image-preview` / Nano Banana 2 已新增 `/api/v1/proxy/image/chat`，模型白名单为 `call_type=image_chat`；真实出图被 GeekAI API `402` 阻断，本地积分已退款并写入 `image_chat error`。
- 2026-04-28 追加实测：`gemini-3.1-flash-image-preview` 直连 GeekAI `/chat/completions` 成功返回图片 URL；`enable_search=true` 天气图示例也成功；`background=true` 返回 `201 pending` 后轮询失败，后台模式待继续验收。
- 2026-04-27 状态对齐：下一轮 P0 是 Admin Provider/Model 管理闭环，包含默认文本/图片/编辑/enhance 模型、fallback 优先级、Provider health/test、App 节点默认值读取；详细计划见 `dev-plans/admin-provider-model-management-p0.md`。
- 图片编辑、enhance、GeekAI 原始调用记录见 `dev-plans/admin-provider-model-geekai-runbook.md`。
