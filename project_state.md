# TANGENT — Project State

> AI 每次开始新对话前，先读这个文件了解当前状态。
> 每次 git commit 前更新此文件。

---

## 当前阶段

**阶段**: Phase 1 MVP 开发  
**核心目标**: 「公众号长文创作」Skill 端到端跑通  
**正在做**: Slice 3 — 画布核心（节点拖拽、连线、状态机、Gate 暂停机制）

---

## 战略决策（2026-04-20 锁定）

**所有开发围绕「公众号长文创作」Skill 打通，其余节点进 Backlog。**

原因：
- 这个 Skill 覆盖了系统中最复杂的技术挑战（Gate 暂停机制、HTML模板引擎、多端口图库）
- 跑通后，其他 Skill 和节点的开发路径会非常清晰
- 避免铺大摊子，先验证核心体验

**Agent 智能体后续也按这个 Skill 的节点逻辑扩展。**

---

## MVP 节点清单（11个，已全部规格锁定）

| 节点 | 类型 | 状态 |
|------|------|------|
| `text_input` | 输入 | ⬜ 待开发 |
| `research` | AI（多轮搜索） | ⬜ 待开发 |
| `outline_generator` | AI | ⬜ 待开发 |
| `gate` | 交互（暂停等人） | ⬜ 待开发 ⭐最核心 |
| `writer` | AI（长文写作） | ⬜ 待开发 |
| `reviewer` | AI（三遍审校） | ⬜ 待开发 |
| `image_planner` | AI（配图规划） | ⬜ 待开发 |
| `image_gen` | AI（Imagen 3） | ⬜ 待开发 |
| `image_gallery` | 展示（多端口） | ⬜ 待开发 |
| `html_formatter` | 模板引擎 | ⬜ 待开发 |
| `preview_wechat` | 输出 | ⬜ 待开发 |

详细规范见 [dev-plans/node-plan.md](dev-plans/node-plan.md)  
WeChat Skill 节点完整设计见 [dev-plans/wechat-skill-nodes.md](dev-plans/wechat-skill-nodes.md)

---

## Slice 开发进度

| Slice | 名称 | 状态 | 说明 |
|-------|------|------|------|
| 0 | 项目脚手架 | ✅ 完成 | Docker, FastAPI, Vite, PostgreSQL, Redis |
| 1 | 用户系统 | ✅ 完成 | Email OTP + Google OAuth + JWT + 路由守卫 |
| 2 | Dashboard + 工作流 CRUD | ✅ 完成 | 卡片网格、重命名、复制、Trash、SideNav 徽章 |
| 2.5 | 画布骨架 | ✅ 完成（骨架） | Canvas/NodePicker/Toolbar/canvasStore 骨架，未联通执行 |
| 3 | 画布核心 | 🔲 下一步 | 节点状态机(含 waiting)、连线校验、执行引擎、Gate 机制 |
| 4 | text_input · research · outline_generator | 🔲 未开始 | |
| 5 | gate · writer · reviewer | 🔲 未开始 | gate 是整个 Skill 的关键 |
| 6 | image_planner · image_gen · image_gallery | 🔲 未开始 | |
| 7 | html_formatter · preview_wechat | 🔲 未开始 | |
| 8 | Skill 模板 + 端到端测试 | 🔲 未开始 | Brief→HTML 全流程跑通 |

---

## 已完成功能明细

### Slice 0-1（脚手架 + 用户系统）
- Docker Compose（frontend/backend/postgres/redis/minio）
- Email OTP 验证（开发模式自动填充）、Google OAuth、JWT 认证
- Login / Signup 页面，路由守卫

### Slice 2（Dashboard）
- 工作流列表（3列网格），创建/重命名/复制/Trash
- Trash 持久化到 localStorage（前端，不调 DELETE API 直到永久删除）
- SideNav Trash 徽章

### Slice 2.5（画布骨架）
- Canvas.tsx / NodePicker / Toolbar / CanvasControls
- canvasStore.ts（Zustand）
- nodes/ 目录结构（base/prompt/chat/image 等空目录）
- NodeBase / NodeTitle / PortDot 基础组件
- PlaceholderNode / PromptNode（未联通执行）
- dagUtils.ts（DAG 工具函数）

---

## 技术决策记录

| 决策 | 结论 | 时间 |
|------|------|------|
| 前端框架 | React + TypeScript + Vite | 2026-04-19 |
| 画布引擎 | React Flow v12 | 2026-04-19 |
| 后端框架 | FastAPI (Python) | 2026-04-19 |
| 部署 | Hetzner EU，Docker Compose | 2026-04-19 |
| 存储 | MinIO 自托管（EU GDPR） | 2026-04-19 |
| 支付 | Stripe | 2026-04-19 |
| 品牌名 | Tanvas → Tangent | 2026-04-20 |
| Trash 实现 | 前端 localStorage | 2026-04-20 |
| MVP 策略 | 全部围绕公众号 Skill 打通，其余 Backlog | 2026-04-20 |
| Gate 节点 | 执行中暂停+动态生成临时节点，选完折叠回 Gate（Option C） | 2026-04-20 |
| 图像模型 | MVP 只接 Imagen 3（MJ 进 Backlog） | 2026-04-20 |
| HTML 排版 | 确定性模板引擎（不走 LLM），组件库来自用户现有规范 | 2026-04-20 |

---

## 待确认事项

- [ ] **P0** Imagen 3 API：用 Vertex AI 还是已有封装？
- [ ] **P0** 邮件服务：Resend 账号是否已创建？
- [ ] **P1** Tavily API Key 是否已申请？
- [ ] **P1** 公众号 HTML 组件库品牌色：当前 `#5965AF`，以后是否可定制？

---

## GitHub

- 仓库：https://github.com/chuhengtantt/TangentAgent
- 主分支：main
- 本地目录：`/Users/orcastt/Code project/TanvasAgent`（待重命名为 TangentAgent）

---

## 开始新对话的方式

```
先读 project_state.md、dev-plans/node-plan.md、dev-plans/wechat-skill-nodes.md。
然后我们来做：[具体任务]
```
