# TANGENT Web AI Image Canvas — PRD

**版本**: v0.2
**日期**: 2026-04-29
**状态**: Web 重启方向正式 PRD 草案，开发前基线
**当前优先级**: P0 最小图像链路
**一句话定位**: TANGENT 是一个极简 Web AI 图像画布，用户用文本节点连接生图节点一次生成 4 张图，再把图片送入绘图编辑器或画布涂改，最后合并导出为新的图片节点。

---

## 0. 文档使用方式

本文件回答“用户能看到什么、能操作什么、怎样算完成”。
工程实现细节见 `ARCH.md`。
当前项目状态见 `project_state.md`。
切片计划见 `dev-plans/web-collaborative-canvas-pivot.md`。

每次开发前先读：

1. `project_state.md`
2. `PRD.md`
3. `ARCH.md`
4. 当前切片对应的 `dev-plans/`

---

## 1. 产品概述

### 1.1 这个产品是什么

TANGENT 是一个运行在浏览器里的 AI 图像创作画布。它把“提示词、生成图片、选择图片、绘制修改、合并导出”做成一条非常短的可视化链路。

用户不需要理解复杂工作流，也不需要安装桌面客户端。核心体验是：

```text
Text Node → Multi Generate Node（4 张图）→ Image Node → Image Editor / Canvas Markup → New Image Node
```

### 1.2 解决什么问题

| 用户问题 | 产品解法 |
|----------|----------|
| AI 生图工具结果零散，难以继续修改 | 每张图都成为画布上的 Image Node，可继续连接、编辑、导出 |
| 节点工作流太复杂，小白不知道从哪开始 | P0 只保留 4 类核心节点，AI Chat 可自动创建节点和连线 |
| 生成后想手动画几笔、圈选、标注 | Image Editor 和 Canvas Markup 提供轻量绘图 |
| 改完后难以保存成新的图 | Merge Capture 把图片和笔迹合并为新的 Image Node |
| 设计工具太重，AI 工具太散 | 用一个干净画布承载生成、对比、编辑和导出 |

### 1.3 目标用户

#### P0 核心用户

| 用户 | 场景 | 需求 |
|------|------|------|
| 独立创作者 | 生成封面、海报、社媒图 | 快速从 prompt 得到 4 个方向并手动微调 |
| 设计师 / Art Director | 概念探索、视觉参考、风格迭代 | 在画布上对比生成图、圈画修改点 |
| 小型内容团队 | 广告图、产品图、活动视觉 | 用简单节点链路沉淀讨论和改图过程 |

#### P0 不优先的用户

- 专业修图师：P0 不替代 Photoshop。
- 复杂工作流用户：P0 不做 ComfyUI 式复杂图。
- 公众号长文创作者：旧公众号链路冻结。
- 本地离线用户：P0 走 Web。
- 企业私有化客户：P0 不做私有部署。

### 1.4 产品原则

1. **干净优先**：沿用白色大画布、小卡片、轻边框、少按钮的视觉方向。
2. **小白优先**：用户可以通过一句话或一个文本节点开始，不需要先学习节点系统。
3. **图像链路优先**：先跑通一条完整图像链路，再加协作、素材库、复杂模型管理。
4. **结果回到画布**：AI 输出、编辑导出、截图合并都必须生成画布上的 Image Node。
5. **不照搬 Tanva**：只参考 `https://github.com/litai12/Tanva.git` 的操作逻辑，如发送到画布、截图合并、坐标转换；不复制复杂代码和技术债。

---

## 2. 功能列表

### 2.1 P0 必须有

| 编号 | 功能 | 说明 | 优先级 |
|------|------|------|--------|
| F01 | Web 登录 | 用户能登录进入 Dashboard；P0 可先用现有认证或本地开发模式 | P0 |
| F02 | Dashboard / Board 列表 | 创建、打开、重命名 Board | P0 |
| F03 | Canvas Editor | 无限画布，支持 pan、zoom、选择、拖拽、连线 | P0 |
| F04 | Text Node | 输入 prompt，输出 text | P0 |
| F05 | Multi Generate Node | 接收 text，一次生成 4 张图片，2×2 显示缩略图 | P0 |
| F06 | Image Node | 承载单张图，支持查看、下载、发送到画布、连接编辑器 | P0 |
| F07 | Image Editor Node | 接收 Image，打开轻量绘图编辑器 | P0 |
| F08 | Image Editor | 画笔、橡皮、清空、导出为新 Image Node | P0 |
| F09 | Canvas Markup | Image Node 可发送为画布图片对象，用户可在其上绘制标注 | P0 |
| F10 | Merge Capture | 选中图片和笔迹，离屏合并成新 Image Node | P0 |
| F11 | AI Chat 自动搭线 | 用户一句话生成 Text / Multi Generate / Image Editor 节点和连线 | P0 |
| F12 | AI Proxy 调用 | 前端不暴露 API Key，由服务端调用生图模型 | P0 |
| F13 | API 调用日志 | 记录用户、Board、模型、参数、状态、耗时、费用 | P0 |
| F14 | 加载 / 空 / 错误状态 | 所有核心流程有明确状态反馈 | P0 |
| F15 | i18n 基线 | P0 UI 默认英文，保留中文开发文案能力 | P0 |

### 2.2 P0.5 / P1 将来再说

| 功能 | 说明 | 阶段 |
|------|------|------|
| 多人协作 | Presence、多人光标、实时同步 | P0.5 |
| 分享链接 | 邀请他人查看或编辑 Board | P0.5 |
| Personal Assets / Library | 素材库、历史图、标签 | P1 |
| 专业 Image Editor | 多图层、选择变换、局部 AI 编辑、历史栈 | P1 |
| 模型选择 UI | 用户端选择 gpt-image-2、Gemini 等模型 | P1 |
| Admin Analytics | 漏斗、留存、收入、内容审核大屏 | P1/P2 |
| 支付订阅 | Stripe 订阅、额度购买 | P1 |
| 版本历史 | Board 快照、回滚 | P1 |
| 团队 Workspace | 多成员权限、团队计费 | P1 |
| 移动端 | iOS / Android | P2 |
| 桌面客户端 | Tauri app | 冻结，非本版本 |

---

## 3. 用户流程

### 3.1 首次进入产品

```text
用户访问 Web App
  → 如果未登录，进入 Login 页面
  → 输入邮箱 / 使用 Google 登录
  → 登录成功
  → 进入 Dashboard
  → 如果没有 Board，显示空状态和 New Board 按钮
  → 点击 New Board
  → 进入 Canvas Editor
```

#### 登录成功后看到什么

- 顶部显示产品名和用户头像。
- 主区域显示 Board 列表。
- 新用户显示空状态：`No boards yet. Create your first AI image canvas.`
- 主要按钮：`New Board`。

#### 登录失败显示什么

- 邮箱格式错误：输入框下方显示 `Enter a valid email address.`
- 验证码错误或 OAuth 失败：页面顶部 toast 显示 `Login failed. Please try again.`
- 网络错误：toast 显示 `Network error. Check your connection and retry.`

### 3.2 创建 Board

```text
用户在 Dashboard 点击 New Board
  → 系统创建 Board
  → 默认标题为 Untitled Board
  → 自动跳转 Canvas Editor
  → 当前视野中央显示空画布引导
```

空画布引导：

- 主文案：`Start with a text prompt.`
- 次文案：`Create a Text Node, connect it to Multi Generate, and generate 4 image options.`
- 快捷按钮：`Add Text Node`、`Ask AI to build it`。

### 3.3 手动最小链路

```text
Canvas Editor 空白状态
  → 用户点击 Add Text Node
  → Text Node 出现在当前视野中央
  → 用户输入 prompt
  → 用户添加 Multi Generate Node
  → 用户从 Text Node 输出端连到 Multi Generate 输入端
  → Multi Generate Node 的 Run 按钮可点击
  → 用户点击 Run
  → 节点进入 loading 状态
  → 生成成功后显示 4 张缩略图
  → 用户点击一张缩略图
  → 系统在右侧创建 Image Node
```

### 3.4 Image Editor 绘图导出

```text
用户选择 Image Node
  → 添加 Image Editor Node
  → 连接 Image Node → Image Editor Node
  → 点击 Image Editor Node 的 Open Editor
  → 打开 Image Editor
  → 用户使用画笔绘制
  → 点击 Export to Image Node
  → 编辑器关闭或保持打开
  → 画布上生成新的 Image Node
```

导出成功反馈：

- 新 Image Node 出现在原节点右侧或当前视野附近。
- toast：`Exported as a new image node.`
- 新节点默认选中，方便继续连接。

### 3.5 发送到画布并合并截图

```text
用户在 Image Node 点击 Send to Canvas
  → 图片成为可拖拽的画布图片对象
  → 用户选择画笔工具
  → 在图片上绘制标注或修改
  → 用户框选图片和相关笔迹
  → 点击 Merge to Image
  → 系统离屏渲染选区
  → 生成新的 Image Node
```

合并成功反馈：

- 新 Image Node 出现在选区右侧。
- toast：`Merged selection into a new image node.`
- 原图片和笔迹不删除，用户可以对比前后结果。

### 3.6 AI Chat 自动搭线

```text
用户打开空白 Canvas
  → 在底部 AI Chat 输入：
    "Create a workflow to generate 4 cat poster ideas and edit the best one."
  → 点击 Send
  → AI Planner 返回 graph spec
  → 前端校验节点类型和连线规则
  → 自动创建 Text Node、Multi Generate Node、Image Editor Node
  → 自动连线并布局到当前视野
  → Text Node 中填入 prompt 草稿
  → 用户点击 Run 或修改 prompt 后再 Run
```

AI Chat 失败：

- Planner 超时：显示 `AI planner timed out. Try a shorter request.`
- 返回无效节点：显示 `I could not build a valid workflow. Try describing the image you want.`
- 不创建半坏状态；如果 graph 校验失败，不写入画布。

---

## 4. 页面清单

### 4.1 Login 页面

| 项 | 内容 |
|----|------|
| 路径 | `/login` |
| 作用 | 用户登录或注册 |
| 主要内容 | Logo、一句话介绍、邮箱输入、验证码/魔法链接、Google 登录按钮、错误提示 |
| 空状态 | 无 |
| 成功跳转 | `/boards` |
| 失败反馈 | 输入框错误或 toast |

### 4.2 Dashboard / Boards 页面

| 项 | 内容 |
|----|------|
| 路径 | `/boards` |
| 作用 | 管理 Board |
| 主要内容 | Board 列表、New Board、搜索、最近打开时间 |
| 空状态 | `No boards yet` + `New Board` |
| 加载状态 | Skeleton board cards |
| 错误状态 | `Could not load boards. Retry` |

### 4.3 Canvas Editor 页面

| 项 | 内容 |
|----|------|
| 路径 | `/boards/:boardId` |
| 作用 | 核心画布编辑 |
| 主要内容 | 无限画布、节点、图片对象、笔迹、连线、工具栏、底部 AI Chat |
| 空状态 | 中央引导 + Add Text Node / Ask AI |
| 加载状态 | Canvas skeleton + loading overlay |
| 错误状态 | Board 不存在、无权限、网络错误 |

### 4.4 Node Picker 弹层

| 项 | 内容 |
|----|------|
| 触发 | 双击画布、快捷键、工具栏 Add |
| 作用 | 添加核心节点 |
| 主要内容 | Text、Multi Generate、Image、Image Editor |
| P0 约束 | 不展示旧节点分类，不展示复杂模型节点 |
| 空状态 | 无 |

### 4.5 AI Chat 输入区

| 项 | 内容 |
|----|------|
| 位置 | Canvas 底部居中 |
| 作用 | 一句话创建节点链路或辅助修改 prompt |
| 主要内容 | 输入框、Send、简短提示、loading 状态 |
| 错误状态 | inline error 或 toast |
| P0 约束 | 不做多轮复杂 Agent，不做长对话历史管理 |

### 4.6 Image Editor 屏幕 / Modal

| 项 | 内容 |
|----|------|
| 触发 | Image Editor Node → Open Editor |
| 作用 | 对输入图片进行轻量绘图并导出 |
| 主要内容 | 画布、画笔、橡皮、颜色、笔刷大小、清空、Export、Close |
| 空状态 | 没有输入图时显示 `Connect an image node first.` |
| 加载状态 | 图片加载 skeleton |
| 错误状态 | 图片加载失败、导出失败 |

### 4.7 Image Preview 弹层

| 项 | 内容 |
|----|------|
| 触发 | 双击 Image Node 或缩略图 |
| 作用 | 查看单张图 |
| 主要内容 | 大图、下载、复制 URL、关闭 |
| 错误状态 | 图片加载失败显示占位 |

---

## 5. 每个功能的完成定义

### F01 Web 登录

完成定义：

- 未登录访问 `/boards` 或 `/boards/:boardId` 会跳转 `/login`。
- 邮箱格式不合法时，提交按钮不可继续或显示字段错误。
- 登录成功后跳转 `/boards`。
- 登录失败显示明确错误，不清空用户已输入邮箱。
- 登录中按钮显示 loading，不允许重复提交。

### F02 Dashboard / Board 列表

完成定义：

- 加载中显示 skeleton。
- 无 Board 显示空状态和 New Board 按钮。
- 有 Board 显示名称、更新时间、缩略图占位。
- 点击 New Board 创建 Board 并跳转 Canvas。
- 重命名为空时不允许保存；最长 80 字符。
- 加载失败显示 Retry。

### F03 Canvas Editor

完成定义：

- 打开 Board 后显示可 pan/zoom 的画布。
- 画布对象在 50% / 100% / 200% 缩放下点击、拖动、框选不偏移。
- resize 浏览器窗口后对象位置不漂移。
- 空画布显示引导。
- 画布加载失败显示可返回 Dashboard 的错误页。

### F04 Text Node

完成定义：

- 可添加到当前视野中央。
- 文本输入可编辑、自动保存到画布状态。
- 空文本时输出端仍存在，但连接到 Multi Generate 后 Run 按钮不可用。
- 文本最长 4,000 字符，超过显示计数和错误。
- 支持复制、删除、拖动。

### F05 Multi Generate Node

完成定义：

- 连接 Text Node 后读取 prompt。
- 未连接或 prompt 为空时显示 `Connect a text prompt first.`。
- 点击 Run 后进入 loading 状态，显示 4 个生成占位。
- 成功后显示 4 张缩略图。
- 每张缩略图可点击创建 Image Node。
- 失败时显示错误和 Retry，不生成空 Image Node。
- 重复 Run 会保留上一轮结果直到新结果成功，避免画布突然清空。

### F06 Image Node

完成定义：

- 可从生成缩略图、编辑器导出、合并截图创建。
- 显示图片预览、标题/来源、基础操作按钮。
- 支持双击预览。
- 支持 Download。
- 支持 Send to Canvas。
- 支持连接到 Image Editor Node。
- 图片加载失败显示破图占位和 Retry。

### F07 Image Editor Node

完成定义：

- 接收 Image Node 连接。
- 未连接图片时 Open Editor 不可用并显示提示。
- 连接图片后显示小预览和 Open Editor。
- 打开编辑器时加载对应图片。
- 导出成功后在画布创建新 Image Node。

### F08 Image Editor

完成定义：

- 打开后显示输入图片。
- 画笔可绘制，橡皮可擦除笔迹。
- 可调整颜色和笔刷大小。
- Export 只包含图片和绘制内容，不包含 UI、网格、选框。
- 导出失败显示错误，不关闭编辑器。
- Close 前保存当前编辑状态；重开不丢。

### F09 Canvas Markup

完成定义：

- Image Node 点击 Send to Canvas 后，图片对象出现在当前视野附近。
- 图片对象可拖动、缩放。
- 画笔笔迹与图片坐标对齐，缩放后不偏移。
- 画布笔迹可选择、删除。

### F10 Merge Capture

完成定义：

- 用户选中图片对象和相关笔迹后，显示 Merge to Image。
- 合并使用选区 world bounds 离屏渲染。
- 输出 PNG 创建新 Image Node。
- 不截入 UI 控件、选择框、网格。
- 没有选中可合并对象时按钮不可用。

### F11 AI Chat 自动搭线

完成定义：

- 空画布输入自然语言后，生成 Text / Multi Generate / Image Editor 节点。
- 节点自动连线。
- 节点出现在当前视野，不跑到画布远处。
- Planner 返回非法 graph 时不修改画布，并显示错误。
- 用户可以撤销 AI 创建的节点组。

### F12 AI Proxy 调用

完成定义：

- 前端不包含任何真实 Provider API Key。
- 生图请求必须发到后端。
- 后端校验用户、余额、模型可用性。
- 成功返回图片 Asset URL。
- 失败返回结构化错误码。

### F13 API 调用日志

完成定义：

- 每次 Run 创建一条日志。
- 日志包含 user、board、node、provider、model、endpoint、params、status、latency、cost。
- 失败日志包含 error_code 和 message。
- 如果失败不扣费，日志标记 refunded 或 no_charge。

### F14 状态反馈

完成定义：

- 所有网络请求有 loading。
- 所有空列表有空状态。
- 所有失败有明确错误文案和可重试动作。
- 删除操作有确认或可撤销。

### F15 i18n 基线

完成定义：

- P0 默认英文。
- 中文开发环境显示中文时，不混入英文业务文案。
- 所有用户可见文案走 i18n key，不在组件里散落硬编码。

---

## 6. 数据字段与约束

### 6.1 User

| 字段 | 类型 | 必填 | 约束 |
|------|------|------|------|
| `id` | string/uuid | 是 | 服务端生成 |
| `email` | string | 是 | 唯一；最长 254；必须合法邮箱 |
| `display_name` | string | 否 | 最长 60 |
| `avatar_url` | string | 否 | URL；最长 2,048 |
| `role` | enum | 是 | `user` / `admin` |
| `created_at` | datetime | 是 | 服务端生成 |
| `last_login_at` | datetime | 否 | 登录成功后更新 |

### 6.2 Workspace

| 字段 | 类型 | 必填 | 约束 |
|------|------|------|------|
| `id` | uuid | 是 | 服务端生成 |
| `name` | string | 是 | 1-80 字符 |
| `owner_id` | uuid | 是 | 必须存在 User |
| `created_at` | datetime | 是 | 服务端生成 |

P0 可默认每个用户一个 personal workspace。

### 6.3 Board

| 字段 | 类型 | 必填 | 约束 |
|------|------|------|------|
| `id` | uuid | 是 | 服务端生成 |
| `workspace_id` | uuid | 是 | 必须属于当前用户 |
| `owner_id` | uuid | 是 | 必须存在 User |
| `title` | string | 是 | 1-80 字符；默认 `Untitled Board` |
| `thumbnail_url` | string | 否 | URL；最长 2,048 |
| `document_state` | json | 是 | 画布对象、节点、边；P0 可本地/服务端保存 |
| `created_at` | datetime | 是 | 服务端生成 |
| `updated_at` | datetime | 是 | 每次保存更新 |

### 6.4 Canvas Node

| 字段 | 类型 | 必填 | 约束 |
|------|------|------|------|
| `id` | string | 是 | board 内唯一 |
| `type` | enum | 是 | `text` / `multi_generate` / `image` / `image_editor` |
| `position.x` | number | 是 | world 坐标 |
| `position.y` | number | 是 | world 坐标 |
| `size.width` | number | 是 | 120-1,200 |
| `size.height` | number | 是 | 80-1,200 |
| `data` | object | 是 | 按节点类型校验 |
| `created_at` | datetime | 是 | 创建时间 |
| `updated_at` | datetime | 是 | 更新时间 |

### 6.5 Text Node Data

| 字段 | 类型 | 必填 | 约束 |
|------|------|------|------|
| `text` | string | 是 | 0-4,000 字符 |
| `placeholder` | string | 否 | 最长 120 |

### 6.6 Multi Generate Node Data

| 字段 | 类型 | 必填 | 约束 |
|------|------|------|------|
| `model_role` | string | 是 | 默认 `default_image` |
| `count` | number | 是 | P0 固定 4 |
| `status` | enum | 是 | `idle` / `running` / `succeeded` / `failed` |
| `result_asset_ids` | string[] | 否 | 最多 4 |
| `last_run_id` | uuid | 否 | 对应 AI Run |
| `error_code` | string | 否 | 失败时存在 |

### 6.7 Image Node Data

| 字段 | 类型 | 必填 | 约束 |
|------|------|------|------|
| `asset_id` | uuid | 是 | 必须存在 Asset |
| `url` | string | 是 | URL；不能持久化 `blob:` / `data:` |
| `width` | number | 否 | > 0 |
| `height` | number | 否 | > 0 |
| `source` | enum | 是 | `generated` / `editor_export` / `merge_capture` / `upload` |
| `title` | string | 否 | 最长 80 |

### 6.8 Edge

| 字段 | 类型 | 必填 | 约束 |
|------|------|------|------|
| `id` | string | 是 | board 内唯一 |
| `source_node_id` | string | 是 | 必须存在 |
| `source_handle` | string | 是 | 按节点类型校验 |
| `target_node_id` | string | 是 | 必须存在 |
| `target_handle` | string | 是 | 按节点类型校验 |
| `type` | enum | 是 | `text` / `image` |

允许连接：

- Text → Multi Generate
- Image → Image Editor
- Multi Generate result → Image（可由点击缩略图创建，不一定用 Edge）

### 6.9 Asset

| 字段 | 类型 | 必填 | 约束 |
|------|------|------|------|
| `id` | uuid | 是 | 服务端生成 |
| `workspace_id` | uuid | 是 | 必须属于当前用户 |
| `board_id` | uuid | 否 | 产生它的 Board |
| `kind` | enum | 是 | `generated` / `editor_export` / `merge_capture` / `upload` |
| `url` | string | 是 | 远程 URL 或服务端 asset URL |
| `mime_type` | string | 是 | P0 支持 `image/png` / `image/jpeg` / `image/webp` |
| `size_bytes` | number | 否 | P0 单图最大 20MB |
| `width` | number | 否 | > 0 |
| `height` | number | 否 | > 0 |
| `created_by` | uuid | 是 | 当前用户 |
| `created_at` | datetime | 是 | 服务端生成 |

### 6.10 AI Run / API Call Log

| 字段 | 类型 | 必填 | 约束 |
|------|------|------|------|
| `id` | uuid | 是 | 服务端生成 |
| `user_id` | uuid | 是 | 当前用户 |
| `board_id` | uuid | 否 | 当前 Board |
| `node_id` | string | 否 | 触发节点 |
| `provider` | string | 是 | 如 `geekai` |
| `model` | string | 是 | 如 `gpt-image-2` |
| `endpoint` | string | 是 | 如 `/images/generations` |
| `request_params` | json | 是 | 不含密钥 |
| `response_meta` | json | 否 | task id、图片数等 |
| `status` | enum | 是 | `pending` / `running` / `succeeded` / `failed` |
| `latency_ms` | number | 否 | >= 0 |
| `cost_credits` | number | 是 | >= 0 |
| `error_code` | string | 否 | 失败时存在 |
| `created_at` | datetime | 是 | 服务端生成 |

### 6.11 Merge Capture

| 字段 | 类型 | 必填 | 约束 |
|------|------|------|------|
| `id` | uuid | 是 | 服务端生成 |
| `board_id` | uuid | 是 | 当前 Board |
| `source_object_ids` | string[] | 是 | 至少 1 个图片对象 |
| `bounds.x` | number | 是 | world 坐标 |
| `bounds.y` | number | 是 | world 坐标 |
| `bounds.width` | number | 是 | > 0 |
| `bounds.height` | number | 是 | > 0 |
| `output_asset_id` | uuid | 是 | 生成的 Asset |
| `created_by` | uuid | 是 | 当前用户 |

---

## 7. 错误、加载、空状态

### 7.1 全局网络断开

- 顶部或底部显示非阻塞 banner：`You are offline. Changes will sync when the connection returns.`
- P0 如果不支持离线保存，则按钮操作显示 `Reconnect to continue.`
- 已在画布上的对象不消失。

### 7.2 服务端错误

- 500：`Something went wrong. Please retry.`
- 401：跳转登录，toast：`Session expired. Please log in again.`
- 403：显示权限错误页：`You do not have access to this board.`
- 404 Board：显示 `Board not found` + `Back to boards`。
- 429：`Too many requests. Please wait and try again.`

### 7.3 AI 调用错误

| 错误 | 显示 |
|------|------|
| 余额不足 | `Not enough credits to generate images.` |
| 模型不可用 | `The selected image model is unavailable. Try again later.` |
| Provider 超时 | `Image generation timed out. Retry?` |
| 内容违规 | `This prompt could not be processed. Try a different prompt.` |
| 返回空图片 | `No image was returned. Retry will not charge again if the previous run failed.` |

### 7.4 图片加载错误

- Image Node 显示灰色占位和 `Image failed to load`。
- 提供 Retry。
- Download / Send to Canvas 禁用。

### 7.5 空状态

| 场景 | 空状态 |
|------|--------|
| 没有 Board | `No boards yet. Create your first AI image canvas.` |
| 空 Canvas | `Start with a text prompt.` |
| Multi Generate 未连接 Text | `Connect a text prompt first.` |
| Image Editor 未连接图片 | `Connect an image node first.` |
| 没有可合并对象 | `Select an image and drawings to merge.` |

### 7.6 加载状态

| 场景 | 加载表现 |
|------|----------|
| Dashboard 加载 | Board skeleton cards |
| Canvas 加载 | 中央 spinner + `Loading board...` |
| 生图运行中 | 4 个缩略图 skeleton + 进度文案 |
| 图片加载中 | Blur / skeleton placeholder |
| Editor 导出中 | Export 按钮 loading，禁止重复点击 |
| Merge Capture | 选区上方显示 `Merging...` |

---

## 8. 不做什么

本版本明确不包含：

1. 不做 Tauri 桌面客户端。
2. 不做公众号 Html Editor。
3. 不做 Writer 小说/长文节点。
4. 不做 Research / Outline / Split 等长文工作流。
5. 不做 Personal Library / Knowledge Graph。
6. 不做完整 Tanva 复制或迁移。
7. 不做复杂 Paper.js 大型画布架构照搬。
8. 不做专业 Photoshop 级图层系统。
9. 不做视频、3D、音频节点。
10. 不做用户自带 API Key。
11. 不在前端暴露任何 Provider Key。
12. 不做复杂 Admin Analytics 大屏。
13. P0 不做多人实时协作。
14. P0 不做 Stripe 付费上线闭环。
15. P0 不做移动端。
16. P0 不做公开模板市场。
17. P0 不做复杂模型参数面板；默认低成本生图参数即可。

---

## 9. 验收清单

### 9.1 登录与 Dashboard

- [ ] 未登录访问受保护页面会跳转登录。
- [ ] 登录成功进入 Dashboard。
- [ ] 登录失败显示明确错误。
- [ ] 无 Board 时显示空状态。
- [ ] New Board 创建成功并跳转 Canvas。
- [ ] Board 标题可重命名，空标题不可保存。

### 9.2 Canvas 基础

- [ ] 画布可 pan / zoom。
- [ ] 50% / 100% / 200% 缩放下点击不偏移。
- [ ] 拖拽节点不偏移。
- [ ] 框选对象不偏移。
- [ ] resize 浏览器窗口后对象不漂移。
- [ ] 空画布显示引导。

### 9.3 Text → Multi Generate

- [ ] 可创建 Text Node。
- [ ] Text Node 可输入 prompt。
- [ ] 可创建 Multi Generate Node。
- [ ] 可连接 Text → Multi Generate。
- [ ] prompt 为空时 Run 禁用或显示提示。
- [ ] 点击 Run 进入 loading。
- [ ] 成功后显示 4 张缩略图。
- [ ] 失败后显示错误和 Retry。
- [ ] 点击缩略图创建 Image Node。

### 9.4 Image Node

- [ ] Image Node 显示图片。
- [ ] 图片加载失败显示占位。
- [ ] 双击可预览。
- [ ] Download 可用。
- [ ] Send to Canvas 可用。
- [ ] 可连接 Image Editor Node。

### 9.5 Image Editor

- [ ] 未连接图片时 Open Editor 不可用。
- [ ] 连接图片后可打开 Editor。
- [ ] Editor 能显示输入图片。
- [ ] 画笔可绘制。
- [ ] 橡皮可擦除。
- [ ] Export 生成新 Image Node。
- [ ] Export 不包含 UI、网格、选框。
- [ ] 关闭重开不丢编辑状态。

### 9.6 Canvas Markup / Merge Capture

- [ ] Send to Canvas 后图片出现在当前视野附近。
- [ ] 图片可拖动和缩放。
- [ ] 在图片上绘图位置准确。
- [ ] 可选中图片和笔迹。
- [ ] Merge to Image 生成新 Image Node。
- [ ] Merge 不截到 UI、网格、选框。
- [ ] 原图和笔迹保留，不被自动删除。

### 9.7 AI Chat 自动搭线

- [ ] 输入一句自然语言后返回节点图。
- [ ] 自动创建 Text / Multi Generate / Image Editor 节点。
- [ ] 自动连线。
- [ ] 节点出现在当前视野。
- [ ] 返回非法 graph 时不修改画布。
- [ ] 用户可撤销 AI 创建的节点组。

### 9.8 AI Proxy / Logs

- [ ] 前端代码不包含真实 Provider Key。
- [ ] 生图请求走后端。
- [ ] 后端能记录 API Call Log。
- [ ] 成功日志包含模型、耗时、费用。
- [ ] 失败日志包含错误码。
- [ ] 失败不扣费或记录退款状态。

### 9.9 i18n / UI

- [ ] 默认英文 UI。
- [ ] 中文环境不混入英文业务文案。
- [ ] 新增用户可见文案都走 i18n。
- [ ] 视觉保持干净白板、小卡片、轻边框。
