# TANGENT — Project State

> AI 每次开始新对话前，先读这个文件了解当前状态。
> 每次 git commit 前更新此文件。

---

## 当前阶段

**阶段**: Phase 2 商业化开发 — 全部 Slice 完成，本地测试 + Bug 修复中
**核心目标**: 官方 API 默认路由 + 订阅制 + 完善体验 + 管理后台
**下一步**: 修复已知 Bug → 端到端测试 → 线上部署

---

## 战略决策

### Phase 2 商业化架构（2026-04-22 锁定）

**决策：从纯桌面本地架构扩展为 桌面客户端 + FastAPI 后端。**

原因：
- 官方统一 API 代理 → 用户无需配置 Key 即可使用（降低门槛）
- 积分/订阅制 → 持续收入
- 多模型差价 → 灵活定价
- 管理后台 → 运营支撑

影响：
- **新增后端**：FastAPI + PostgreSQL + Redis + MinIO（Docker Compose）
- **新增认证**：Email OTP + JWT（替代本地 License Key）
- **新增积分系统**：CreditBalance / CreditTransaction / ApiCallLog / ModelConfig
- **新增支付**：Stripe Checkout + Webhook
- **新增管理后台**：Next.js Web App + Admin API
- **新增 Provider Registry**：DB 表驱动，零代码新增 AI provider
- **保留桌面架构**：Tauri v2 + SQLite 本地缓存 + 用户自带 Key 降级
- **AI 路由翻转**：official API（FastAPI 代理，扣积分）→ 用户自带 Key → LOGIN_REQUIRED

### Desktop Pivot（2026-04-21 锁定）

**决策：从 Web SaaS 迁移到桌面客户端（Tauri）。** 仍然有效，Phase 2 在此基础上增加后端代理。

### 公众号 Skill 优先（2026-04-20 锁定）

**所有开发围绕「公众号长文创作」Skill 打通，其余节点进 Backlog。** 仍然有效。

---

## MVP 节点清单（12个，已全部规格锁定）

| 节点 | 类型 | 状态 |
|------|------|------|
| `text_input` | 输入 | ✅ 完成（可缩放、滚动10行） |
| `research` | AI（多轮搜索） | ✅ 完成 |
| `outline_generator` | AI | ✅ 完成 |
| `gate` | 交互（暂停等人） | ✅ 完成 ⭐最核心 |
| `writer` | AI（长文写作） | ✅ 完成 |
| `reviewer` | AI（三遍审校） | ✅ 完成 |
| `image_planner` | AI（配图规划） | ✅ 完成 |
| `image_list` | AI（多模型图片生成） | ✅ 完成（双输入、数量/模型选择、动态输出端口、hover删除input） |
| `image_gallery` | 展示（多端口） | ✅ 完成 |
| `html_formatter` | 模板引擎 | ✅ 完成 |
| `preview_wechat` | 输出 | ✅ 完成 |
| `group` | 分组容器 | ✅ 完成 |

详细规范见 [dev-plans/node-plan.md](dev-plans/node-plan.md)
WeChat Skill 节点完整设计见 [dev-plans/wechat-skill-nodes.md](dev-plans/wechat-skill-nodes.md)

---

## Slice 开发进度

### Phase 1 — Desktop MVP ✅ 全部完成

| Slice | 名称 | 状态 | 说明 |
|-------|------|------|------|
| 0 | Tauri 脚手架 + SQLite | ✅ | Rust 骨架 + SQLite 6 张表 + health_check |
| 1 | License + API Key 管理 | ✅ | Settings 集成，5 providers，AES-256-GCM 加密 |
| 2 | Dashboard + 工作流 CRUD | ✅ | Tauri IPC 替代 REST API，本地 SQLite |
| 3 | 画布核心 | ✅ | Canvas/NodePicker/Toolbar/执行引擎 全部复用 |
| 4 | text_input · research · outline_generator | ✅ | MiniMax M2.7，Tauri IPC 执行 |
| 5 | gate · writer · reviewer | ✅ | Gate 选择/输入模式，Writer 4风格，Reviewer 三遍审校 |
| 6 | image_planner · image_gen · image_gallery | ✅ | MiniMax image-01 生图 + 本地文件系统 + Lightbox |
| 7 | html_formatter · preview_wechat | ✅ | MiniMax HTML 排版 + 微信预览 + 复制 HTML |
| 8 | 积分订阅系统 | ✅ | FastAPI 后端替代 Supabase，完整积分/支付系统 |
| 9 | 主题 + 语言 + 桌面安装包 | ✅ | 暗夜模式、文件拆分、桌面打包+CI |
| 10 | 画布交互增强 | ✅ | 分类颜色边框、复制粘贴删除、右键菜单、打组/取消打组 |
| 11 | Image List重构 + AI Agent面板 | ✅ | 双输入/动态端口/图片编辑器/AI对话面板/主题切换 |

### Phase 2 — 商业化 ✅ 全部完成

| Slice | 名称 | 优先级 | 状态 | 说明 |
|-------|------|--------|------|------|
| 13 | Skill 动态拓扑系统 | P0 | ✅ | build_system_prompt + nodeBuilder 校验 |
| 14 | 模型注册表 + 多模型路由 | P1 | ✅ | ModelSelector + provider 灰显 + defaultModel |
| 15 | 官方 API 默认路由 + 登录门控 | P0 | ✅ | credits.rs 重写 → FastAPI，路由翻转 |
| 16 | 多模型代理 + 差异积分 | P1 | ✅ | proxy_service.py，5 providers，差价积分 |
| 17 | i18n 中英切换完成 | P1 | ✅ | 16+ 组件 t() 替换，langStore，TopNav 切换按钮 |
| 18 | 首次引导 + 订阅支付 | P1 | ✅ | AuthGuard，OTP 登录，Stripe Checkout，ProUpgradeModal |
| 19 | Settings 简化 + Skill 推荐卡片 | P2 | ✅ | Account/Advanced/About 三 Tab，SkillPicker 模态框 |
| 20 | 网页端架构预留 | P3 | ⬜ | 仅规划，暂不开发 |
| — | 管理后台 Web 应用 | P1 | ✅ | Admin API + Provider Registry + Next.js 前端 8 页面 |
| — | Provider 可插拔架构 | P1 | ✅ | providers DB 表 + proxy_service DB-first 查询 |
| — | 线上部署方案 | P0 | ⬜ | Docker/Nginx/SSL 配置已就绪，待实际部署 |

---

## Bug 修复记录（2026-04-23 测试会话）

### 已修复

| Bug | 文件 | 修复 |
|-----|------|------|
| 旧工作流加载白屏 | `workflow.rs` | `graph_json` 类型 `String` → `Option<String>`，兼容 NULL |
| Image List 节点崩溃 | `ImageListNode.tsx` | `removeImageInput` useCallback 定义顺序移到 useMemo 之前 |
| Image List 生成4张相同图 | `media.rs` | 文件名加序号 `_N` 防止覆盖，prompt 加 variation 前缀 |
| Image Editor 返回跳到 Dashboard | `CanvasPage.tsx` + `Canvas.tsx` | Back 按钮先检查 editor 状态；Canvas 卸载时清理 overlay |
| 登录门控阻止本地测试 | `AuthGuard.tsx` | 临时禁用 auth check |
| 画布 fitView 导致 200% 缩放 | `Canvas.tsx` | 移除 `fitView` prop，改用 `defaultViewport={{ zoom: 1 }}` |
| 节点显示模糊 | `NodeBase.tsx` + `index.css` | 移除 `willChange: transform`，添加 `backface-visibility` + `subpixel-antialiased` |
| 连线无法选择/删除 | `DeletableEdge.tsx` + `canvasStore.ts` | 自定义边组件 + hover 显示 − 按钮 + selectedEdgeIds + Delete 键支持 |
| Image List output 预览冲突 | `ImageListNode.tsx` + `NodeBase.tsx` | 移除 done 状态的图片网格，output port 不显示底部标签 |

### 待修复（见 debug-plans/）

详见 [debug-plans/bugs-session-2026-04-23.md](debug-plans/bugs-session-2026-04-23.md)

---

## 本次新增/改进功能

### DeletableEdge — 连线交互增强

- **新文件**: `frontend/src/canvas/DeletableEdge.tsx`
- 点击连线 → 高亮变蓝
- 鼠标悬停/选中 → 中点显示红色 − 按钮，点击删除
- 20px 宽透明命中区域，解决"很难选中连线"的问题
- Delete/Backspace 键删除选中的连线
- `canvasStore` 新增 `selectedEdgeIds` 状态追踪

### NodeBase PortDef 增强

- `PortDef` 新增 `removable` + `onRemove` 属性
- 底部 port 标签 hover 时圆点变红色 − 按钮
- 无 label 的 output 不再占据底部栏空间

### Image List 改进

- 动态 input 限制最多 3 个（`MAX_IMAGE_INPUTS = 3`）
- Input 端口 hover 显示 − 删除按钮
- Output 端口不再在底部标签栏显示（避免和 Gallery 预览冲突）
- done 状态显示 "已生成 N 张图片" 文字，不显示预览网格

---

## 已完成功能明细

### Phase 1: Slice 0-11（全部完成）

核心：Tauri 桌面壳 + SQLite + React Flow 画布 + 12 个节点 + 执行引擎 + 主题切换 + AI Agent 面板。

### Phase 2: Slice 13-19 + Admin（全部完成）

详见各 slice 的 dev-plans 文件。

---

## 线上部署（配置已就绪，待执行）

详见 [DEPLOY.md](DEPLOY.md)

### 部署架构

```
云服务器 (2C4G 起步)
├── Nginx (443) — SSL + 反向代理 + 限流
│   ├── api.tangent.ai    → FastAPI :8000
│   └── admin.tangent.ai  → Next.js :3000
├── FastAPI Backend (Docker)
├── PostgreSQL 16 (Docker)
└── Redis 7 (Docker)
```

### 配置文件清单

| 文件 | 用途 |
|------|------|
| `backend/docker-compose.yml` | 本地开发（PostgreSQL + Redis） |
| `backend/docker-compose.prod.yml` | 生产部署（全部 5 容器） |
| `backend/.env` | 本地开发环境变量 |
| `backend/.env.prod` | 生产环境变量模板 |
| `nginx/nginx.conf` | Nginx 反代 + SSL + 限流配置 |
| `admin/.env.local` | Admin Dashboard 本地配置 |
| `DEPLOY.md` | 完整部署步骤文档 |

---

## 待办事项

### P0 — 上线前必须

- [ ] 端到端测试：完整 Skill 流程跑通（text_input → preview_wechat）
- [ ] 购买云服务器 + 域名 + SSL 证书
- [ ] macOS 代码签名：Apple Developer 账号
- [ ] 配置生产环境 AI Provider API Keys
- [ ] Stripe Live 模式切换

### P1 — 体验优化

- [ ] 画布节点缩放时文字清晰度优化（CSS/GPU rendering）
- [ ] 自动化测试框架搭建（pytest + Vitest）
- [ ] 错误提示优化（节点执行失败的友好提示）
- [ ] 工作流自动保存间隔优化

### P2 — 后续迭代

- [ ] 网页端架构（Slice 20）
- [ ] 协同编辑（多人同时编辑画布）
- [ ] 自定义 Skill 编辑器（用户创建自己的 Skill 模板）
- [ ] 移动端预览（微信扫码预览输出）

---

## 技术栈总览

### 桌面客户端

| 层级 | 选型 |
|------|------|
| 桌面壳 | Tauri v2 (Rust) |
| 前端 | React + TypeScript + Vite |
| 画布 | React Flow v12 |
| 状态管理 | Zustand |
| 本地数据库 | SQLite |
| API Key 加密 | AES-256-GCM |
| i18n | i18next + react-i18next |

### 后端服务

| 层级 | 选型 |
|------|------|
| API 框架 | FastAPI |
| 数据库 | PostgreSQL 16 |
| 缓存 | Redis 7 |
| 对象存储 | MinIO（预留） |
| 支付 | Stripe |
| 认证 | Email OTP + JWT |
| AI 代理 | httpx + 多 provider 路由 |
| Provider 管理 | PostgreSQL providers 表（零代码新增） |
| 部署 | Docker Compose + Nginx |

### 管理后台

| 层级 | 选型 |
|------|------|
| 框架 | Next.js 14 + App Router |
| UI | shadcn/ui + TailwindCSS |
| 图表 | Recharts |
| 部署 | Docker（同服务器） |

---

## GitHub

- 仓库：https://github.com/chuhengtantt/TangentAgent
- 主分支：main
- 本地目录：`/Users/orcastt/Code project/TanvasAgent`

---

## 开始新对话的方式

```
先读 project_state.md、dev-plans/phase2-commercial.md。
然后我们来做：[具体任务]
```
