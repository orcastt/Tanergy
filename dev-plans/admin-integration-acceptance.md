# Admin Integration Acceptance Plan

**创建时间**: 2026-04-27  
**状态**: ✅ 自动验收通过，待人工视觉/交互复核  
**范围**: Admin Next.js 前端、FastAPI Admin API、PostgreSQL 数据联动、客户端模型源联动

---

## 目标

验证 Admin 管理后台从登录、权限、页面加载到核心 CRUD 的真实联动闭环：

```
Admin 前端 → FastAPI /api/v1/admin/* → PostgreSQL → /api/v1/models → 桌面端 ModelSelector
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
- 真实 AI Key 联动和线上 CORS / 域名 / SSL 需要 Staging 环境再验收。
