# Phase 2 — 官方 API + 订阅商业化

**阶段**: 商业化 | **目标**: 官方统一 API 为默认、订阅制、完善体验
**状态**: 🔄 核心功能完成，Html Editor / Admin 联调 / 部署收口中 | **开始日期**: 2026-04

---

## 核心架构变更

```
Phase 1: 用户自带 Key 为主 → 官方 API 为备选
Phase 2: 官方 API 为默认 → 用户自带 Key 为高级选项
```

**原则**:
- 工作流数据全部本地存储（零服务器成本）
- AI 调用走 FastAPI 后端代理（扣积分）
- 用户注册即用，不碰 API Key
- 订阅制：Free 限量 + Pro 无限
- 网页端架构预留，暂不开发

---

## 技术栈

| 层 | 选型 | 说明 |
|---|---|---|
| 后端 API | FastAPI + PostgreSQL + Redis | 自建后端，Docker 部署 |
| AI 代理 | `backend/app/services/proxy_service.py` | 多 provider 路由 + 积分扣减 |
| 用户认证 | FastAPI + JWT (email OTP) | `/api/v1/auth/send-otp` + `/verify-otp` |
| 积分系统 | PostgreSQL + 本地 SQLite 缓存 | `credit_balances` + `credit_transactions` |
| API 调用日志 | PostgreSQL `api_call_logs` | 管理后台可查 |
| 模型配置 | PostgreSQL `model_configs` | 管理后台可配 |
| 支付 | Stripe Checkout | FastAPI endpoint 创建 session |
| 管理后台 | Next.js + shadcn/ui | 独立 Web App，调用 FastAPI admin API |
| 用户自带 Key | 保留，移到"高级设置" | 从主流程降级 |

---

## Slice 列表

| # | 文件 | 名称 | 优先级 | 难度 | 预计 | 状态 |
|---|------|------|--------|------|------|------|
| 13 | [slice-13-skill-system.md](slice-13-skill-system.md) | Skill 动态拓扑系统 | P0 | 高 | 3天 | ✅ |
| 14 | [slice-14-model-registry.md](slice-14-model-registry.md) | 模型注册表 + 多模型路由 | P1 | 中 | 3天 | ✅ |
| 15 | [slice-15-official-default.md](slice-15-official-default.md) | 官方 API 默认路由 + 登录门控 | P0 | 低 | 1天 | ✅ |
| 16 | [slice-16-multi-provider-backend.md](slice-16-multi-provider-backend.md) | 多模型代理 + 差异积分 | P1 | 高 | 5天 | ✅ |
| 17 | [slice-17-i18n.md](slice-17-i18n.md) | i18n 中英切换完成 | P1 | 中 | 2天 | ✅ |
| 18 | [slice-18-onboarding.md](slice-18-onboarding.md) | 首次引导 + 订阅支付 | P1 | 高 | 3天 | ✅ |
| 19 | [slice-19-settings-v2.md](slice-19-settings-v2.md) | Settings 简化 + Skill 推荐卡片 | P2 | 中 | 3天 | ✅ |
| 22 | [slice-22-image-editor-layers.md](slice-22-image-editor-layers.md) | Image Editor 图层画板 | P1 | 高 | 5天 | ✅ |
| 23 | [slice-23-html-editor.md](slice-23-html-editor.md) | Html Editor 富文本编辑 | P1 | 高 | 5天 | ✅ 初版完成，待手测 |
| — | [personal-library-plan.md](personal-library-plan.md) | 个人素材库 + Image 容器 | P1 | 中 | 3天 | ✅ MVP 完成，待手测 |
| 20 | [slice-20-web-placeholder.md](slice-20-web-placeholder.md) | 网页端架构预留 | P3 | - | - | ⬜ |
| — | [admin-dashboard.md](admin-dashboard.md) | 管理后台 Web 应用 | P1 | 高 | 5天 | 🔄 API + 基础前端完成，待联调 |
| — | [docs-alignment-html-editor.md](docs-alignment-html-editor.md) | 文档对齐 + Html Editor 收口 | P0 | 中 | 1天 | ✅ |

---

## 依赖关系

```
Slice 13 (Skill 动态拓扑)          ← ✅ 已完成 (build_system_prompt + nodeBuilder 校验)
  └──→ Slice 14 (模型注册表)       ← ✅ 已完成 (ModelSelector + 多模型路由 + provider 灰显)

Slice 15 (路由翻转 + 登录门控)      ← ✅ 已完成
  └──→ Slice 16 (多模型代理)        ← ✅ 已完成 (proxy_service.py)
  └──→ Slice 17 (i18n)             ← ✅ 已完成
  └──→ Slice 18 (引导页 + 支付)    ← ✅ 已完成 (AuthGuard + Stripe)
          └──→ Slice 19 (Settings + Skill 卡片) ← ✅ 已完成
                  └──→ Slice 20 (网页端预留)    ← ⬜ 待开始

Slice 22 (Image Editor 图层画板)    ← ✅ 已完成 (Procreate 风格，持久化)
  └──→ Slice 23 (Html Editor)       ← ✅ 初版完成 (Tiptap 富文本 + 微信预览 + AI 改写)
  └──→ Personal Library              ← ✅ MVP 完成 (Text/Image 素材 + image_asset)

admin-dashboard.md                  ← 🔄 API + 基础 Next.js 前端完成，待联调验收
```

---

## 已完成的工作

### Slice 15: 官方 API 默认路由 ✅
- `src-tauri/src/services/credits.rs` — 完全重写，从 Supabase 切换到 FastAPI
- 路由翻转：official API 优先 → 用户自带 Key 降级 → LOGIN_REQUIRED
- JWT 存储在本地 `app_config` 表 (`backend_jwt`)
- 后端 URL 可配置 (`backend_url`)，默认 `http://localhost:8000`
- AI 节点登录门控（`execute/mod.rs`）

### Slice 16: 多模型代理 + 差异积分 ✅
- `backend/app/services/proxy_service.py` — AI 代理核心
- 支持 minimax / claude / gpt / gemini / glm 五个 provider
- 每次调用预扣积分，失败自动退款
- 完整的 API 调用日志记录 (`api_call_logs` 表)
- FastAPI 路由: `/api/v1/proxy/chat` + `/api/v1/proxy/image`

### Slice 17: i18n 中英切换 ✅
- `store/langStore.ts` — Zustand 语言 store，localStorage 持久化
- TopNav 语言切换按钮（translate 图标 + EN/ZH）
- 16+ 组件完成 `useTranslation` + `t()` 替换
- `en.json` + `zh.json` — 100+ 翻译 key，覆盖节点/页面/设置/技能
- 默认英文，`npx tsc --noEmit` 零错误

### Slice 18: 首次引导 + 订阅支付 ✅
- `frontend/src/components/AuthGuard.tsx` — 路由守卫
- `frontend/src/components/ProUpgradeModal.tsx` — 月付/年付升级弹窗
- `frontend/src/components/CreditBalance.tsx` — 低余额警告 + Upgrade 按钮
- `frontend/src/services/tauri.ts` — createCheckout + getSubscription
- `src-tauri/src/commands/billing.rs` — Stripe Checkout 命令
- `frontend/src/lib/executionEngine.ts` — LOGIN_REQUIRED / INSUFFICIENT_CREDITS 错误处理
- FastAPI `billing.py` — Stripe Checkout + Webhook

### Slice 19: Settings 简化 + Skill 推荐卡片 ✅
- `frontend/src/pages/SettingsPage.tsx` — Account / Advanced / About 三 Tab
- `frontend/src/pages/settings/AccountTab.tsx` — 登录状态/积分/Upgrade/退出
- `frontend/src/pages/settings/AdvancedTab.tsx` — 主题/语言切换 + API Keys
- `frontend/src/pages/settings/AboutTab.tsx` — 版本信息 + 链接
- `frontend/src/nodes/skillDefs.ts` — 4 个 Skill 定义（wechat/ecommerce/xiaohongshu/blank）
- `frontend/src/components/SkillPicker.tsx` — Skill 选择模态框
- `frontend/src/pages/DashboardPage.tsx` — "New Workflow" → SkillPicker → 自动创建节点

### Slice 13: Skill 动态拓扑系统 ✅
- `src-tauri/src/commands/agent.rs` — `build_node_registry()` + `build_system_prompt()` 动态生成系统提示
- `frontend/src/agent/nodeBuilder.ts` — `nameToType` 映射 + `isValidPort()` 端口校验 + 自动 runAll
- `frontend/src/agent/agentStore.ts` — 解析 Agent JSON 响应 + 调用 `buildActions()`
- AI 根据用户需求灵活组合节点拓扑，不再硬编码固定流程

### 管理后台 API 🔄
- `backend/app/api/v1/admin.py` — 完整 admin API
- `/admin/stats` — 仪表盘统计
- `/admin/users` — 用户管理 (列表 + 禁用/启用)
- `/admin/credits/grant` — 积分充值
- `/admin/credits/transactions` — 积分流水
- `/admin/api-logs` — API 调用日志
- `/admin/models` — 模型配置 CRUD
- Admin 角色验证 (`require_admin` 依赖注入)

### 数据库
- PostgreSQL 表: `credit_balances`, `credit_transactions`, `api_call_logs`, `model_configs`
- User 表新增 `role` 字段 (`user` / `admin`)
- Alembic 迁移: `a00000000001_add_credits_and_admin.py`
- 本地 SQLite 新增: `003_credits.sql` 迁移

---

## 下一步优先级

1. **Html Editor 手测验收** — 双击打开、编辑预览、关闭重开不丢内容
2. **管理后台联调** — 基础 Next.js 前端已实现，联调 Admin API 与鉴权
3. **端到端测试** — Docker + 迁移 + 完整流程验证
4. **线上部署** — 购买云服务器 + 域名 + SSL + 执行 DEPLOY.md
5. **Slice 20 (网页端预留)** — 架构规划（低优先级）

---

## 开发流程

```
1. 按 P0 → P1 → P2 顺序实施
2. 每个 Slice 读写对应 .md 文件
3. 完成后更新本文件状态 → ✅
4. git commit
```
