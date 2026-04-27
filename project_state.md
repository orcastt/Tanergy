# TANGENT — Project State

> AI 每次开始新对话前，先读这个文件了解当前状态。
> 每次 git commit 前更新此文件。

---

## 当前阶段

**阶段**: Phase 2 商业化开发 — 核心能力完成，Html Editor / 构建 / Admin 联调 / 部署收口中
**核心目标**: 官方 API 默认路由 + 订阅制 + Html Editor 终点体验 + 个人素材库 + 管理后台
**下一步**: 手测 Html 多主题 / Writer Editor / 素材库 Graph → GeekAI 真 Key 端到端联调 → Admin UI 中文/设计对齐 → Staging 部署

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
- **保留桌面架构**：Tauri v2 + SQLite 本地缓存；用户自带 API Key / BYOK 暂停为默认路径
- **AI 路由收口**：official API（FastAPI 代理，扣积分）→ 未登录返回 LOGIN_REQUIRED

### Desktop Pivot（2026-04-21 锁定）

**决策：从 Web SaaS 迁移到桌面客户端（Tauri）。** 仍然有效，Phase 2 在此基础上增加后端代理。

### 公众号 Skill 优先（2026-04-20 锁定）

**所有开发围绕「公众号长文创作」Skill 打通，其余节点进 Backlog。** 仍然有效。

---

## 公众号主流程（现网默认）

| 节点 | 类型 | 状态 |
|------|------|------|
| `text_input` | 输入 | ✅ 完成（支持上游输入） |
| `research` | AI（调研） | ✅ 完成 |
| `outline_generator` | AI（大纲 + 图片计划） | ✅ 完成 |
| `image_list` | AI（多模型图片生成） | ✅ 完成（双输入、数量/模型选择、动态输出端口） |
| `image_asset` | 图片素材容器 | ✅ MVP 完成（素材库拖拽生成、可缩放、打开 Image Editor） |
| `html_formatter` / Html Editor | 图文编排终点 | ✅ 初版完成（双击编辑、Tiptap、微信预览、AI 改写） |

可选节点：`image_planner`、`image_gallery`。
高级/非默认节点：`writer`（长文/书稿编辑器）。
非默认/遗留节点：`gate`、`reviewer`、`image_gen`、`preview_wechat`（不在公众号默认模板中）。

详细规范见 [dev-plans/node-plan.md](dev-plans/node-plan.md)
WeChat Skill 节点完整设计见 [dev-plans/wechat-skill-nodes.md](dev-plans/wechat-skill-nodes.md)
开发/测试代码质量规范见 [dev-plans/code-quality-standards.md](dev-plans/code-quality-standards.md)

---

## 开发测试规范（2026-04-25 生效）

当前策略：`npm -C frontend run build` 与触碰文件定向 lint 是前端改动的基础门槛；全量 `npm -C frontend run lint` 仍有历史债，不作为每次提交阻断，但不允许新增触碰文件 lint 问题。

| 场景 | 必跑检查 |
|------|----------|
| 前端功能/节点/UI 改动 | `npm -C frontend run build` + `git diff --check` |
| 前端触碰文件 | 从 `frontend/` 执行 `npx eslint <changed-files>` |
| Rust / Tauri IPC 改动 | `cargo check --manifest-path src-tauri/Cargo.toml` |
| 节点端口契约改动 | 手测连线、动态端口、执行输入聚合 |
| Html Editor 改动 | 手测双击打开、实时预览、关闭重开、复制 HTML |

关键规范：
- 禁止新增 `any`；React Flow 使用官方 `Node`、`Edge`、`Connection`、`NodeMouseHandler`、`OnNodeDrag`、`NodeTypes` 类型。
- React Hook 必须在 early return 之前调用。
- 不在 `useEffect` 里同步做 prop → state 镜像；优先派生值、稳定 key 重新挂载或异步订阅。
- 动态端口由 `Canvas.resolveAutoInputExpansion()` 统一扩展，节点组件只负责渲染和手动 add/remove UI。

---

## Slice 开发进度

### Phase 1 — Desktop MVP ✅ 全部完成

| Slice | 名称 | 状态 | 说明 |
|-------|------|------|------|
| 0 | Tauri 脚手架 + SQLite | ✅ | Rust 骨架 + SQLite 6 张表 + health_check |
| 1 | License + API Key 管理 | ✅ / legacy | 本地 Key 能力保留在历史实现中；当前 UI 默认关闭 BYOK |
| 2 | Dashboard + 工作流 CRUD | ✅ | Tauri IPC 替代 REST API，本地 SQLite |
| 3 | 画布核心 | ✅ | Canvas/NodePicker/Toolbar/执行引擎 全部复用 |
| 4 | text_input · research · outline_generator | ✅ | 历史初版为 MiniMax；当前测试默认走官方 `hunyuan-3.0-preview` 免费文本模型 |
| 5 | Outline Split 编排 | ✅ | 以大纲拆分替代 Gate 主链路，自动生成章节节点并连到 html_formatter |
| 6 | image_planner · image_gen · image_gallery | ✅ | 历史初版图片链路完成；当前默认图片模型为官方 `gpt-image-2`，`image_list` 为主节点 |
| 7 | html_formatter · legacy preview_wechat | ✅ | 官方文本模型 HTML 排版；当前默认出口已升级为 Html Editor |
| 8 | 积分订阅系统 | ✅ | FastAPI 后端替代 Supabase，完整积分/支付系统 |
| 9 | 主题 + 语言 + 桌面安装包 | ✅ | 暗夜模式、文件拆分、桌面打包+CI |
| 10 | 画布交互增强 | ✅ | 分类颜色边框、复制粘贴删除、右键菜单、打组/取消打组 |
| 11 | Image List重构 + AI Agent面板 | ✅ | 双输入/动态端口/图片编辑器/AI对话面板/主题切换 |

### Phase 2 — 商业化 🔄 核心完成，收口中

| Slice | 名称 | 优先级 | 状态 | 说明 |
|-------|------|--------|------|------|
| 13 | Skill 动态拓扑系统 | P0 | ✅ | build_system_prompt + nodeBuilder 校验 |
| 14 | 模型注册表 + 多模型路由 | P1 | ✅ / 🔄 | ModelSelector 已支持后端动态模型源 + 本地白名单 fallback；待 Admin 页面真数据验收 |
| 15 | 官方 API 默认路由 + 登录门控 | P0 | ✅ | Tauri AI 执行只走 FastAPI 官方代理，未登录返回 LOGIN_REQUIRED |
| 16 | 多模型代理 + 差异积分 | P1 | ✅ / 🔄 | GeekAI 文本/图片/编辑/增强白名单已接入，后端按启用模型强校验；图片轮询/enhance 已开发，待真 Key 联调 |
| 17 | i18n 中英切换完成 | P1 | ✅ | 16+ 组件 t() 替换，langStore，TopNav 切换按钮 |
| 18 | 首次引导 + 订阅支付 | P1 | ✅ | AuthGuard，OTP 登录，Stripe Checkout，ProUpgradeModal |
| 19 | Settings 简化 + Skill 推荐卡片 | P2 | ✅ | Account/Advanced/About 三 Tab，SkillPicker 模态框 |
| 20 | 网页端架构预留 | P3 | ⬜ | 仅规划，暂不开发 |
| 22 | Image Editor 图层画板 | P1 | ✅ | Procreate 风格图层画板，导出/AI Edit/状态恢复 |
| 23 | Html Editor 富文本编辑 | P1 | ✅ / 🔄 | 初版已开发并构建通过；待手测验收 |
| — | Writer 高级节点 + 书稿预览 | P2 | ✅ / 🔄 | Writer 已恢复为非默认高级节点；支持纯文本书稿编辑与 PDF/书籍式预览，待手测 |
| — | 个人素材库 + Image 容器 + Graph | P1 | ✅ / 🔄 | 全局素材库 MVP 完成；新增 Gallery/List/Graph 三视图，待手测保存、搜索、拖拽和图谱筛选 |
| — | 管理后台 Web 应用 | P1 | ✅ / 🔄 | Admin API + Provider Registry + 基础 Next.js 前端本地自动联调通过；待人工视觉/交互复核与部署 |
| — | Provider 可插拔架构 | P1 | ✅ / 🔄 | providers DB 表 + `services/proxy/` DB-first 查询；GeekAI seed 已加入，待真实 Key、Admin 动态模型源联调 |
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
| 节点执行时渲染模糊 | `index.css` | 移除 `backface-visibility: hidden`，改用 `antialiased`（避免 GPU 光栅化模糊） |
| 连线无法选择/删除 | `DeletableEdge.tsx` + `canvasStore.ts` | 自定义边组件 + hover 显示 − 按钮 + selectedEdgeIds + Delete 键支持 |
| Image List output 预览冲突 | `ImageListNode.tsx` + `NodeBase.tsx` | 移除 done 状态的图片网格，output port 不显示底部标签 |
| 图片拖拽到画板失败 | `SourcePanel.tsx` + `LayerCanvas.tsx` | base64 过大导致 dataTransfer 失败 → 改用 click-to-add 主方案 + image-id cache key 拖拽 |

### 已修复（2026-04-24 会话）

| Bug | 文件 | 修复 |
|-----|------|------|
| 节点内拖拽 textarea 触发节点移动 | `TextInputNode.tsx` + `NodeBase.tsx` | 内容区加 `nodrag nopan`，input/select/textarea 加 `cursor: auto` CSS |
| NodeBase port handle 位置偏移 | `NodeBase.tsx` | 重写 handle 容器定位逻辑，直接 `left: -10px`/`right: -10px` + `translateY(-50%)`，不再使用 `translate(-50%, -50%)` |
| DeletableEdge 删除按钮 hover 区域太小 | `DeletableEdge.tsx` | hit area strokeWidth 20→24，按钮加 `padding: 8px; margin: -8px` |
| Image Editor 关闭后图层状态丢失 | `ImageEditorModal.tsx` + `layerStore.ts` | 新增 `getState()`/`restoreState()`，关闭时保存到 `nodeResults.layerData`，重开时恢复 |
| Image Editor 导出失败（Rust 命令错误） | `ImageEditorModal.tsx` | 导出改为直接存 data URL，不再调 `save_canvas_export` Rust 命令；SourcePanel 支持 `data:` URL 路径 |
| 栅格化/AI Edit 包含网格线和选择框 | `LayerCanvas.tsx` + `AiEditPopup.tsx` | 新增 `rasterizeLayers()` 离屏合成函数（只渲染图层，无 UI 元素），替代 `getCanvasElement().toDataURL()` |
| 图层面板无法拖拽排序 | `LayerPanel.tsx` + `layerStore.ts` | LayerRow 支持 HTML5 drag-and-drop；新增 `moveTo(id, toIndex)` action |

### 待修复（见 debug-plans/）

详见 [debug-plans/bugs-session-2026-04-23.md](debug-plans/bugs-session-2026-04-23.md)

---

## 本次新增/改进功能

### Html Editor 富文本编辑器 (Slice 23) — 初版收口（2026-04-25）

| 改进 | 说明 |
|------|------|
| **默认终点统一** | 公众号主流程以 `html_formatter` / Html Editor 为终点，`preview_wechat` 降为 legacy |
| **双击进入编辑器** | `HtmlFormatterNode` done 状态双击打开全屏 Html Editor |
| **多主题模板** | 支持标准紫、经典蓝、墨黑、暖灰、赭红五套公众号颜色主题，预览与复制输出同步 |

### Writer 高级节点 — 书稿编辑器（2026-04-27）

| 能力 | 状态 |
|------|------|
| **非默认高级节点** | `writer` 回到 Node Picker，但不进入公众号默认主链路 |
| **书稿编辑器** | 节点可打开全屏 Writer Editor，左侧纯文本/Markdown 编辑 |
| **PDF/书籍预览** | 右侧按章节/段落分页展示书籍式排版预览 |
| **保存闭环** | 编辑内容写回 `nodeResults.text` 与节点 `editedText`，关闭重开不丢 |

### Personal Library 素材库 — MVP（2026-04-26）

| 能力 | 状态 |
|------|------|
| **全局素材库** | SQLite `library_items/tags`，跨 workflow 共享 |
| **左侧侧拉面板** | 工作流页面左侧 Drawer，文章组/图片组切换、搜索、标签筛选 |
| **Workspace 页面** | Workspace 右侧 Library 标签页支持 Gallery/List/Graph 三视图 |
| **Knowledge Graph** | 基于素材类型、标签、素材节点生成关系图，点击标签可筛选 |
| **保存入口** | Text 节点保存文字素材；Image Editor 导出当前画布到图片素材 |
| **拖拽生成节点** | Text 素材生成 `text_input`；Image 素材生成 `image_asset` |
| **图片容器** | `image_asset` 支持缩放、输出 `image_slot`、打开 Image Editor |
| **Tiptap 富文本** | 支持标题、加粗、斜体、下划线、列表、引用、链接、分割线 |
| **微信实时预览** | 右侧整页预览实时渲染编辑后的 HTML |
| **AI 改写** | 选中文本后调用 `ai_rewrite_html`，结果插入文章 |
| **保存闭环** | 编辑内容写回 `nodeResults`，关闭时写入节点 `editedHtml`，重开不丢 |
| **构建通过** | `npm -C frontend run build` 已通过 |

### Image Editor 图层画板 (Slice 22) — 后续改进（2026-04-24）

| 改进 | 说明 |
|------|------|
| **图层状态持久化** | 编辑器关闭再打开，图层内容保留（layerData 存入 nodeResults） |
| **导出无需 Rust** | 直接存 data URL 到 canvasStore，SourcePanel 支持识别 data: 路径 |
| **纯净栅格化** | `rasterizeLayers()` 离屏合成，导出/AI Edit 时不含网格线和选择框 |
| **图层拖拽排序** | LayerPanel 支持拖拽调整图层顺序，drag indicator 图标指示可拖 |
| **默认关闭网格** | 初始状态 `showGrid: false`，用户可手动开启 |
| **TextInputNode 支持上游连接** | 新增 `in` input port，可接收上游节点文本；有上游时自动显示上游内容 |

---

### Image Editor 图层画板 (Slice 22) — 全新设计

将简单涂鸦工具改造为 Procreate 风格的图层画板，架构完全重写。

**新文件**:
| 文件 | 说明 |
|------|------|
| `nodes/image/layerStore.ts` | Zustand 图层状态（Layer CRUD、绘画、拖拽/缩放、栅格化、网格吸附） |
| `nodes/image/SourcePanel.tsx` | 左侧源图片列表（click-to-add + drag-to-canvas） |
| `nodes/image/LayerCanvas.tsx` | 主画板 canvas（多层合成渲染 + 绘画 + 选择工具） |
| `nodes/image/LayerPanel.tsx` | 右侧图层面板（列表 + 操作 + 不透明度滑条 + 导出到节点） |
| `nodes/image/Toolbar.tsx` | 工具栏（选择/画笔切换、颜色、笔宽、橡皮、撤销、网格、吸附、AI Edit） |

**核心功能**:
- **图层系统**: 新建/删除/复制/上下移动，半透明度滑条，显示/隐藏切换，锁定/解锁
- **图片 contain 渲染**: 不同比例图片不拉伸，自适应画布
- **选择工具**: 点击选中图层，拖拽移动，右下角 handle 缩放
- **绘画**: 画笔/橡皮，8色 4级笔宽
- **网格 + 吸附**: 20px 网格线，移动/缩放时自动吸附对齐
- **栅格化**: 合并所有可见图层为一张新图层
- **导出到节点**: 将画布内容保存为文件，添加到 Image List 节点输出
- **AI Edit**: 截取画布 → 选择官方图片模型 → 调用 FastAPI 图片编辑代理 → 添加为新图层

**AI Edit 技术细节**:
- `AiEditPopup.tsx` 重写：多状态机（input → analyzing → generating → done/error）
- 进度条：30% 分析 → 70% 生成 → 100% 完成
- Rust 侧 `ai_edit_image` 命令：截图 base64 + 指令 + 图片模型 → 官方图片编辑代理 → 返回新图

**Rust 侧新增命令**:
| 命令 | 说明 |
|------|------|
| `save_canvas_export` | Canvas base64 → 写文件 → 入 DB |
| `ai_edit_image` | 截图 + 指令 → AI 图片生成 |

**旧文件已弃用**（保留供参考）: DrawingCanvas.tsx, DrawingPanel.tsx, ImageEditorPanel.tsx, drawingStore.ts

### DeletableEdge — 连线交互增强

- **新文件**: `frontend/src/canvas/DeletableEdge.tsx`
- 点击连线 → 高亮变蓝
- 鼠标悬停/选中 → 中点显示红色 − 按钮，点击删除
- Delete/Backspace 键删除选中的连线

### NodeBase PortDef 增强

- `PortDef` 新增 `removable` + `onRemove` 属性
- 底部 port 标签 hover 时圆点变红色 − 按钮

### Image List 改进

- 动态 input 限制最多 3 个（`MAX_IMAGE_INPUTS = 3`）
- done 状态显示 "已生成 N 张图片" 文字
- 点击预览可打开 Image Editor

---

## 已完成功能明细

### Phase 1: Slice 0-11（全部完成）

核心：Tauri 桌面壳 + SQLite + React Flow 画布 + 12 个节点 + 执行引擎 + 主题切换 + AI Agent 面板。

### Phase 2: Slice 13-19 + 22-23 + Personal Library + Admin（核心完成，收口中）

详见各 slice 的 dev-plans 文件；当前待手测 Personal Library、Html Editor、Admin 联调和生产部署。

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

- [ ] 端到端测试：完整 Skill 流程跑通（text_input → html_formatter / Html Editor）
- [ ] Personal Library 手测：保存文字/图片、标签搜索、拖拽生成节点、Image Editor 导出
- [ ] Official-only routing 手测：未登录提示登录，登录后走 `/api/v1/proxy/*`
- [ ] GeekAI 真 Key 联调：免费文本模型、图片生成、图片编辑、图片增强、模型切换、积分扣减
- [ ] Admin 动态模型源：前端模型列表从后端读取，Admin 可设置文本/图片/编辑默认模型
- [ ] 购买云服务器 + 域名 + SSL 证书
- [ ] macOS 代码签名：Apple Developer 账号
- [ ] 配置 Staging/生产环境 AI Provider Keys（Admin/后端环境变量）
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
| 前端 | React 19 + TypeScript 6 + Vite 8 |
| 画布 | React Flow v12 |
| 状态管理 | Zustand 5 |
| 本地数据库 | SQLite |
| API Key 加密 | AES-256-GCM（legacy，本地 BYOK 当前关闭） |
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
| 框架 | Next.js 16 + App Router |
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
再读 dev-plans/docs-alignment-html-editor.md。
然后我们来做：[具体任务]
```
