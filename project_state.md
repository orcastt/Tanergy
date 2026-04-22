# TANGENT — Project State

> AI 每次开始新对话前，先读这个文件了解当前状态。
> 每次 git commit 前更新此文件。

---

## 当前阶段

**阶段**: Phase 1 MVP 开发（Desktop pivot — 从 Web SaaS 迁移到 Tauri 桌面客户端）
**核心目标**: 「公众号长文创作」Skill 端到端跑通
**正在做**: Slice 8 — 积分订阅系统 (Supabase + Stripe)

---

## 战略决策

### Desktop Pivot（2026-04-21 锁定）

**决策：从 Web SaaS 迁移到桌面客户端（Tauri）。**

原因：
- 用户自带 API Key → 不需要积分/计量系统，零 API 运营成本
- 本地 SQLite → 不需要服务器、PostgreSQL、Redis、MinIO
- 软件授权订阅 → 不需要 Stripe 按时计费
- 现有 React 前端代码几乎原封不动迁入 Tauri
- MVP 是单人 Skill（公众号长文创作），不需要协同

影响：
- **删除**：FastAPI 后端、Docker、Hetzner、PostgreSQL、Redis、ARQ 队列、MinIO、Stripe、Cloudflare
- **新增**：Tauri v2 (Rust 壳)、SQLite、Drizzle ORM、本地文件系统、OS keychain、本地加密签名 License
- **保留**：所有 React 前端代码、React Flow 画布、节点定义、Skill 定义、Gate 机制
- **现有 backend/ 代码**：保留在仓库中供参考，标记为 Deprecated

三个关键子决策：
1. **定价模式**: Freemium + Pro 解锁（免费版限 3 个工作流 + 手动节点，Pro €19/月或€149/年解锁全部）
2. **授权验证**: 本地加密签名验证（Honor system），无需服务器校验
3. **AI API 调用**: 经 Tauri Rust 侧 reqwest 转发（API Key 不暴露给 JS）

### 公众号 Skill 优先（2026-04-20 锁定）

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
| `text_input` | 输入 | ✅ 完成 |
| `research` | AI（多轮搜索） | ✅ 完成 |
| `outline_generator` | AI | ✅ 完成 |
| `gate` | 交互（暂停等人） | ✅ 完成 ⭐最核心 |
| `writer` | AI（长文写作） | ✅ 完成 |
| `reviewer` | AI（三遍审校） | ✅ 完成 |
| `image_planner` | AI（配图规划） | ✅ 完成 |
| `image_gen` | AI（MiniMax image-01） | ✅ 完成 |
| `image_gallery` | 展示（多端口） | ✅ 完成 |
| `html_formatter` | 模板引擎 | 🔲 待开发 |
| `preview_wechat` | 输出 | 🔲 待开发 |

详细规范见 [dev-plans/node-plan.md](dev-plans/node-plan.md)
WeChat Skill 节点完整设计见 [dev-plans/wechat-skill-nodes.md](dev-plans/wechat-skill-nodes.md)

---

## Slice 开发进度（Desktop 版）

| Slice | 名称 | 状态 | 说明 |
|-------|------|------|------|
| 0 | Tauri 脚手架 + SQLite | ✅ 完成 | Rust 骨架 + SQLite 6 张表 + health_check |
| 1 | License + API Key 管理 | ✅ 完成 | Settings 集成，5 providers，AES-256-GCM 加密 |
| 2 | Dashboard + 工作流 CRUD（本地） | ✅ 完成 | Tauri IPC 替代 REST API，本地 SQLite |
| 3 | 画布核心（复用现有） | ✅ 完成 | Canvas/NodePicker/Toolbar/执行引擎 全部复用 |
| 4 | text_input · research · outline_generator | ✅ 完成 | MiniMax M2.7，Tauri IPC 执行 |
| 5 | gate · writer · reviewer | ✅ 完成 | Gate 选择/输入模式，Writer 4风格，Reviewer 三遍审校 |
| 6 | image_planner · image_gen · image_gallery | ✅ 完成 | MiniMax image-01 生图 + 本地文件系统 + Lightbox |
| 7 | html_formatter · preview_wechat | ✅ 完成 | MiniMax HTML 排版 + 微信预览 + 复制 HTML |
| 8 | 积分订阅系统 (Supabase+Stripe) | 🔨 进行中 | 积分套餐/官方API代理/Pro会员8折/节点积分显示 |
| 9 | 主题 + 语言 + 桌面安装包 | 🔲 未开始 | 打包 .dmg / .msi / .AppImage |
| 10 | 画布交互增强（部分） | ✅ 完成 | 分类颜色边框、端口 tooltip、复制粘贴删除、右键菜单、Alt+Click 复制 |

---

## 已完成功能明细

### Legacy: Slice 0-1（Web 脚手架 + 用户系统）— Deprecated
- Docker Compose（frontend/backend/postgres/redis/minio）— 后端不再使用
- Email OTP 验证、Google OAuth、JWT 认证 — 桌面版改用 License Key
- Login / Signup 页面 — 桌面版改为 Welcome 向导
- **前端代码保留，后端代码保留供参考**

### 可复用: Slice 2（Dashboard）
- 工作流列表（3列网格），创建/重命名/复制/Trash — UI 全部可复用
- Trash 持久化到 localStorage — 改为 SQLite
- SideNav Trash 徽章 — 可复用
- JSON 导出/导入（Tauri plugin-dialog + plugin-fs）
- Import 按钮卡片 + Export 三点菜单选项

### 可复用: Slice 2.5（画布骨架）
- Canvas.tsx / NodePicker / Toolbar / CanvasControls — 全部可复用
- canvasStore.ts（Zustand）— 全部可复用
- NodeBase / NodeTitle / PortDot 基础组件 — 全部可复用
- dagUtils.ts（DAG 工具函数）— 全部可复用

### 可复用: Slice 3（画布核心）
- **执行引擎** [executionEngine.ts](frontend/src/lib/executionEngine.ts)：拓扑分层、runAll/stopAll — DAG 解析逻辑不变
- **节点状态机**：idle/running/waiting/done/error — 不变
- **Gate 机制**：waitingGates/setWaitingGate/resolveGate — 不变
- **端口类型校验**：Canvas.tsx isValidConnection — 不变
- **Toolbar Run/Stop All** — 不变
- **PortType 定义** [node.ts](frontend/src/types/node.ts) — 不变
- **11个节点定义** [nodeDefs.ts](frontend/src/nodes/nodeDefs.ts) — 不变

### Slice 10: 画布交互增强（部分完成）
- **节点分类颜色边框**: NodeBase.tsx — 3px left border by category (input/ai/image/output/text)
- **端口 Hover tooltip**: NodeBase.tsx — `title` attribute 显示端口数据类型
- **复制粘贴删除**: canvasStore.ts — clipboard + copySelected/pasteNodes/deleteSelected/duplicateNode
- **键盘快捷键**: Canvas.tsx — Ctrl+C/V, Delete/Backspace, Escape
- **右键上下文菜单**: ContextMenu.tsx — 节点右键 Copy/Paste/Delete, 空白右键 Paste
- **Alt+Click 复制节点**: Canvas.tsx — onNodeClick + altKey
- **工作流自动保存**: CanvasPage.tsx — Back 按钮保存 + unmount 保存
- **JSON 导出/导入**: DashboardPage.tsx + workflow.rs — Tauri dialog + fs 插件
- **Welcome 页重设计**: WelcomePage.tsx — 取消自动跳转，产品介绍页

---

## 技术决策记录

| 决策 | 结论 | 时间 |
|------|------|------|
| 前端框架 | React + TypeScript + Vite | 2026-04-19 |
| 画布引擎 | React Flow v12 | 2026-04-19 |
| **桌面壳** | **Tauri v2 (Rust)** | **2026-04-21** |
| **本地数据库** | **SQLite + Drizzle ORM** | **2026-04-21** |
| **AI API 调用** | **Tauri Rust 侧 reqwest，用户自带 Key** | **2026-04-21** |
| **文件存储** | **本地文件系统（Tauri fs API）** | **2026-04-21** |
| **授权方式** | **本地加密签名验证（Honor system）** | **2026-04-21** |
| **计费模式** | **Freemium + Pro 解锁** | **2026-04-21** |
| **API Key 加密** | **AES-256-GCM / OS keychain** | **2026-04-21** |
| 品牌名 | Tanvas → Tangent | 2026-04-20 |
| Trash 实现 | 前端 localStorage → 改为 SQLite | 2026-04-20 |
| MVP 策略 | 全部围绕公众号 Skill 打通，其余 Backlog | 2026-04-20 |
| Gate 节点 | 执行中暂停+动态生成临时节点，选完折叠回 Gate（Option C） | 2026-04-20 |
| 图像模型 | MVP 只接 Imagen 3（MJ 进 Backlog） | 2026-04-20 |
| HTML 排版 | 确定性模板引擎（不走 LLM） | 2026-04-20 |
| React Flow | 使用 `any` 类型参数规避版本冲突 | 2026-04-21 |
| ~~后端框架~~ | ~~FastAPI~~ | **Deprecated** |
| ~~部署~~ | ~~Hetzner, Docker~~ | **Deprecated** |
| ~~缓存/队列~~ | ~~Redis, ARQ~~ | **Deprecated** |
| ~~对象存储~~ | ~~MinIO~~ | **Deprecated** |
| ~~支付~~ | ~~Stripe~~ | **Deprecated** |
| ~~CDN~~ | ~~Cloudflare~~ | **Deprecated** |
| ~~实时协同~~ | ~~Yjs + WebSocket~~ | **Deprecated（Phase 2 网页版）** |

---

## 待确认事项

- [ ] **P0** macOS 代码签名：Apple Developer 账号是否已准备？
- [ ] **P0** Tauri webview：用系统 webview 还是打包 Chromium？（影响一致性 vs 下载体积）
- [ ] **P0** License 签名密钥：Ed25519 密钥对是否已生成？
- [ ] **P1** API Key 获取引导：为用户准备 Anthropic / Tavily / Google Cloud Key 获取步骤文档
- [ ] **P1** 小红书 HTML 组件库品牌色：当前 `#5965AF`，以后是否可定制？
- [ ] **P1** Auto-update：Tauri updater 是否已配置和测试？
- [ ] **P2** 网页版用户系统：邮箱/Google 注册登录 + 工作流云同步 + Stripe 订阅计费（MVP 不做，Phase 2 补充）

---

## GitHub

- 仓库：https://github.com/chuhengtantt/TangentAgent
- 主分支：main
- 本地目录：`/Users/orcastt/Code project/TanvasAgent`

---

## 开始新对话的方式

```
先读 project_state.md、dev-plans/node-plan.md、dev-plans/wechat-skill-nodes.md。
然后我们来做：[具体任务]
```
