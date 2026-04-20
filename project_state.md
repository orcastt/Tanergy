# TANGENT — Project State

> AI 每次开始新对话前，先读这个文件了解当前状态。
> 每次 git commit 前更新此文件。

---

## 当前阶段

**阶段**: Phase 1 MVP 开发
**正在做**: 准备进入 Slice 2（Dashboard + 工作流）

**已完成**:
- [x] PRD.md v0.3：视觉规范切换为 Cal.com 风格（灰度克制、阴影即边框、Cal Sans + Inter）
- [x] ARCH.md v0.1：非功能需求、技术栈、目录结构、API 设计、安全规范、300行审查规则
- [x] reference/theme.ts：Cal.com 风格设计 Token（灰度色、11级阴影、Cal Sans 排版）
- [x] reference/design-system.md：Cal.com 设计规范原文存档
- [x] dev-plans/phase1-mvp.md：Phase 1 完整开发计划（10 个 Slice）
- [x] Slice 0：项目脚手架（Docker, FastAPI, Vite, Alembic）
- [x] Slice 1：用户系统（Email OTP + Google OAuth + JWT + 路由守卫）

**下一步**: Slice 2 — Dashboard + 工作流

---

## 技术决策记录

| 决策 | 结论 | 时间 |
|------|------|------|
| 前端框架 | React + TypeScript + Vite | 2026-04-19 |
| 画布引擎 | React Flow v12 | 2026-04-19 |
| 后端框架 | FastAPI (Python) | 2026-04-19 |
| 部署平台 | Hetzner EU（芬兰/德国） | 2026-04-19 |
| 存储方案 | MinIO 自托管（EU GDPR 合规） | 2026-04-19 |
| 支付 | Stripe | 2026-04-19 |

---

## 待确认事项（阻塞开发的问题）

- [ ] **P0** Midjourney API：官方 API 还是 useapi.net 代理？（影响 MVP Image 节点）
- [ ] **P0** 邮件服务：用 SendGrid 还是 Resend？
- [ ] **P0** 服务器规格：Hetzner CX32（4核8G）是否足够？
- [ ] **P1** Search 节点：MVP 只用 Tavily，不做国内平台，确认？

---

## 已知问题

（暂无 - 代码还未开始）

---

## MVP 验收进度

详见 [dev-plans/phase1-mvp.md](dev-plans/phase1-mvp.md)

| Slice | 名称 | 状态 |
|-------|------|------|
| 0 | 项目脚手架 | ✅ 完成 |
| 1 | 用户系统 | ✅ 完成 |
| 2 | Dashboard + 工作流 | ⬜ 未开始 |
| 3 | 画布核心 | ⬜ 未开始 |
| 4 | 文本类节点 | ⬜ 未开始 |
| 5 | 图像生成节点 | ⬜ 未开始 |
| 6 | 执行引擎 | ⬜ 未开始 |
| 7 | Skills 系统 | ⬜ 未开始 |
| 8 | 订阅计费 | ⬜ 未开始 |
| 9 | 主题 + 语言 + 收尾 | ⬜ 未开始 |

---

## 如何开始新的开发对话

在新对话的第一条消息中这样说：

```
先读项目根目录的 PRD.md、ARCH.md、project_state.md，了解当前状态。
然后我们来做：[具体任务]
```
