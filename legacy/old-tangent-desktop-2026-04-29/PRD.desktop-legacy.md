# TANGENT — Product Requirements Document

> **Legacy / Frozen Notice — 2026-04-29**
> 本文件记录旧桌面客户端 + 公众号工作流路线，当前不再作为主开发入口。新的 Web-first 多人协作 AI 画布方向见 `PRD.web-collab.md`；当前执行计划见 `dev-plans/web-collaborative-canvas-pivot.md`。

**版本**: v0.9
**日期**: 2026-04-27
**状态**: Phase 2 商业化 — 核心能力完成，当前 P0 为 Admin Provider/Model 管理闭环
**上次更新**: Admin Provider/Model 默认值、fallback、health/test 计划设为当前主入口

---

## 目录

1. [产品概述](#1-产品概述)
2. [目标用户与痛点](#2-目标用户与痛点)
3. [MVP 功能范围](#3-mvp-功能范围)
4. [应用视图](#4-应用视图)
5. [用户流程](#5-用户流程)
6. [功能完成定义](#6-功能完成定义)
7. [节点系统设计](#7-节点系统设计)
8. [Skills 技能系统](#8-skills-技能系统)
9. [UI/UX 设计规范](#9-uiux-设计规范)
10. [数据字段约束](#10-数据字段约束)
11. [错误状态与空状态](#11-错误状态与空状态)
12. [本版本不做什么](#12-本版本不做什么)
13. [API 集成清单](#13-api-集成清单)
14. [订阅与商业模式](#14-订阅与商业模式)
15. [MVP 验收清单](#15-mvp-验收清单)
16. [开发路线图](#16-开发路线图)
17. [待确认事项](#17-待确认事项)

---

## 1. 产品概述

### 1.1 一句话定位

**TANGENT 是一款桌面 AI 创意工作流画布应用**：用户通过拖拽节点或选择预置 Skill，自动构建从「提示词 → AI 生图/文章」的完整生产流水线，本地编辑并输出到公众号、小红书等场景。AI 调用统一走 Tangent 官方后端代理，用户自带 API Key / BYOK 暂不作为默认路径。

### 1.2 解决的核心问题

| 现有痛点 | TANGENT 的解法 |
|---------|-------------|
| 多工具切换（MJ → PS → 文档 → 发布）| 一个画布完成全流程 |
| AI 生成过程不透明，不可控 | 每步可见、可暂停、可调参 |
| 工作流不可复用，下次从头来 | 工作流可保存、分享、套模板 |
| 需要写很长的 Prompt | 自然语言描述，AI 自动展开 |
| 内容生产后还要手动整理发布 | 直接生成公众号/小红书可用格式 |
| 第三方 AI 线路不稳定、维护成本高 | 官方后端统一管理 Provider、模型价格、备用线路 |

### 1.3 竞品对比

| 产品 | 定位 | TANGENT 差异点 |
|------|------|-------------|
| ComfyUI | 本地图像工作流 | 引导式桌面应用 + Skills 系统 + 低门槛 |
| n8n | 通用自动化 | 专注 AI 创意，有预置 Skill 模板 |
| Coze | AI Bot 搭建 | 专注视觉创作，不是聊天机器人 |
| Canva | 设计编辑工具 | 生产工具，不是精修工具 |

---

## 2. 目标用户与痛点

### 2.1 主要用户画像

**用户 A：内容创作者（核心用户，MVP 重点）**
- 每周需生产 3-5 篇公众号图文或小红书笔记
- 痛点：选题 → 配图 → 排版 → 发布，单篇耗时 3-5 小时
- 期望：输入主题，10 分钟内得到可发布的完整图文

**用户 B：品牌/电商设计师**
- 需要批量生成产品图、海报、场景图
- 痛点：MJ 出图后还要 PS 处理，多版本管理混乱
- 期望：一个工作流跑完所有变体，结果直接可用

**用户 C：创意团队负责人**（Phase 2 网页版）
- 管理 5-20 人团队，需要复用工作流、统一风格
- 痛点：每个人用自己的工具，难以沉淀方法论
- 期望：团队共享工作流模板，统一出图标准
- **注**：桌面 MVP 为单人使用，团队协作功能推迟到 Phase 2 网页版

### 2.2 用户规模预期

- MVP（0-3个月）：个人用户，目标 200 下载，50 激活，20 Pro 付费
- V1（3-6个月）：目标 1000 下载，200 激活，80 Pro 付费
- V2（6-12个月）：加入网页版，月 MRR ≥ €2,000

---

## 3. MVP 功能范围

### 3.1 必须有（MVP 范围，Phase 1）— 已全部完成

以下功能已实现：

- [x] 首次启动向导（Email OTP 登录）
- [x] 官方 API 路由（登录后通过 FastAPI 代理调用 AI；本地 BYOK 能力转为 legacy）
- [x] 主画布（节点拖拽、连线、网格对齐）
- [x] 双击画布 → 节点选择面板
- [x] 节点执行引擎（拓扑序执行、状态机、错误处理）
- [x] 公众号长文创作 Skill（完整节点链路跑通）
  - text_input · research · outline_generator · split · image_list · html_formatter / Html Editor
- [x] 本地 SQLite 持久化（工作流、资产自动保存）
- [x] 图片本地存储 + 下载
- [x] 官方 API 代理 + 积分系统 + 登录门控
- [x] 亮色 / 暗色主题切换
- [x] 中文 / 英文语言切换
- [x] 工作流保存与命名
- [x] Tauri 桌面打包与分发（.dmg / .msi）

### 3.2 Phase 2 — 进行中

- [x] 官方 API 代理 + 积分系统（Slice 15-16 完成）
- [x] i18n 中英切换（Slice 17 完成）
- [x] 首次引导 + Stripe 支付（Slice 18 完成）
- [x] Settings 简化 + Skill 推荐卡片（Slice 19 完成）
- [x] 右侧 AI 对话面板 + 自然语言自动连线（Slice 11 完成）
- [x] Skill 动态拓扑系统（Slice 13 完成）
- [ ] 管理后台联调验收（API + 基础 Next.js 前端已完成）
- [ ] 小红书图文笔记 Skill
- [x] Image Editor 图层画板（Slice 22 完成）— Procreate 风格多图层编辑器
- [x] Html Editor 富文本编辑（Slice 23 初版完成，待手测验收）— Tiptap + 微信双栏预览 + AI 改写
- [x] Html Editor 多主题 — 标准紫、经典蓝、墨黑、暖灰、赭红，预览与复制输出同步
- [x] 个人素材库 MVP — 全局文章组/图片组、标签保存、拖拽到画布、`image_asset` 容器节点、Workspace Knowledge Graph
- [x] Writer 高级节点 — 非默认长文/小说/书稿节点，纯文本编辑 + PDF/书籍式预览
- [ ] 节点子画布 Draw/Comment
- [ ] 可选云同步（增值功能，渐进式引入网页版）
- [ ] 工作流模板分享

### 3.3 Phase 3+ 再做

- [ ] 视频节点（Kling、Seedance 等）
- [ ] PPT 节点（Reveal.js 编辑器）
- [ ] 微信公众号直接发布
- [ ] 小红书发布辅助
- [ ] Skill 市场（用户发布/购买）
- [ ] 音频节点、3D 节点
- [ ] 网页版（云端协同）

---

## 4. 应用视图

| 视图 | 触发 | 作用 | 前置条件 |
|------|------|------|---------|
| Welcome | 首次启动 / 未登录 | Email OTP 登录引导 | 无 |
| Credits | 导航 | 积分中心（余额、充值、升级） | 无 |
| Dashboard | 登录后 | 工作流列表 + Skill 推荐 | 已登录 |
| Canvas Editor | 打开/创建工作流 | 核心编辑界面 | 已登录 |
| Settings | 导航 | Account / Advanced / About | 无 |
| Admin Dashboard | 浏览器 | 后台管理（用户/积分/日志） | Admin 角色 |

---

## 5. 用户流程

### 5.1 首次启动向导

```
用户首次启动 TANGENT
  → Welcome 屏幕（品牌 Logo，简短介绍）
  → Step 1: 输入邮箱 → 发送 OTP
  → Step 2: 输入验证码 → 验证通过后登录
  → Step 3: 进入 Dashboard（AI 调用走官方后端代理）
  → Dashboard 加载
  → 显示欢迎 toast：「TANGENT 已就绪，创建你的第一个工作流！」
```

### 5.2 官方 AI 线路配置（当前路径）

```
用户登录 Tangent 账号
  → 节点执行时携带 JWT 调用 FastAPI proxy
  → 后端根据 Provider Registry / ModelConfig 校验启用模型、选择线路并扣积分
  → Provider Key 只存在后端环境变量和 Admin 管理侧
  → 如果模型被禁用或类型不匹配：
     → 返回 MODEL_NOT_ENABLED，前端提示切换可用模型
  → 如果用户未登录：
     → 节点显示错误：「请登录后使用官方 AI 线路」
     → 错误面板引导登录
```

### 5.3 核心流程 A：手动搭建工作流

```
用户打开 TANGENT，进入 Dashboard
  → 点击「新建工作流」
  → 系统创建空白画布，进入 Canvas Editor
  → 用户双击画布空白处
  → 节点选择面板弹出（居中）
  → 用户点击「Text Input」节点
  → 节点出现在画布双击位置附近，自动对齐网格
  → 用户在 Text Input 节点输入框中输入主题
  → 用户双击其他位置，选择「Research」
  → 节点出现
  → 用户从 Text Input 节点右侧蓝色端口拖拽连线
  → 连线跟随鼠标，显示连线预览
  → 拖到 Research 节点左侧对应端口
  → 松手，连线建立，颜色标记类型
  → 用户点击 Research 节点上的「Run」按钮
  → 节点边框变蓝，显示进度动画
  → Tauri Rust 侧解密 Tavily Key → 调用 API → 返回结果
  → 节点内显示结构化搜索结果
  → 节点边框变绿（2 秒后恢复默认）
  → 用户点击顶栏「保存」（或 Cmd/Ctrl+S）
  → 工作流保存到本地 SQLite，显示 toast「已保存」
```

### 5.4 核心流程 B：使用 Skill 快速生成小红书笔记（Phase 2）

```
用户在 Dashboard 点击「新建工作流」
  → 进入空白画布
  → 点击左侧工具栏「Skills」图标
  → Skills 面板从左侧滑入，显示内置 Skill 列表
  → 用户点击「小红书图文笔记」
  → 弹出 Skill 配置弹窗
  → 用户填写主题，选择配置
  → 画布动画：节点一个个出现，连线逐条生成
  → 用户点击 Run All
  → 工作流从左到右依次执行
  → Preview: RED 节点展示小红书卡片样式预览
  → 用户点击「复制文案」
  → 用户点击「下载全部图片」
```

### 5.5 核心流程 C：公众号长文创作

```
（同 Skill 流程，选择「公众号长文创作」）
  → Skill 配置：主题、风格、配图数量、配图风格
  → 工作流生成：text_input → research → outline_generator
  → Outline 完成后 Split 自动补齐：N×text_input(section) + image_list + html_formatter
  → image_list 负责多图生成并连到 html_formatter.images
  → 执行完毕
  → 用户双击 Html Formatter 节点进入 Html Editor
  → Html Editor 左侧富文本编辑，右侧展示微信样式实时预览
  → 用户点击「复制 HTML」
  → 用户点击「下载配图」
```

### 5.6 账户与订阅管理

```
应用启动时检查登录状态（JWT）
  → 已登录：进入 Dashboard
  → 未登录：进入 Welcome OTP 登录引导

用户在 Credits / Settings 查看订阅状态
  → Free：显示当前积分与额度提示
  → Pro：显示 Pro 标记与到期信息（如适用）
  → 余额不足：弹出 Upgrade 引导（Stripe Checkout）
```

---

## 6. 功能完成定义

> 完成 = 按预期行为工作 + 错误情况有处理 + 空状态有设计

### 6.1 登录与 Setup

**登录完成标准（OTP）**：
- 输入邮箱可发送验证码，收到验证码后可登录
- 登录成功后 JWT 本地持久化，重启后可恢复登录态
- 未登录用户访问受保护页面时，自动跳转 Welcome
- 登录失败有明确错误提示并可重试

**官方线路完成标准**：
- 登录后 AI 节点统一调用 FastAPI 官方代理
- 未登录时 AI 节点返回 `LOGIN_REQUIRED` 并引导登录
- Provider Key 不出现在桌面端，由后端环境变量和 Admin 管理
- 调用失败、积分不足、Provider 未配置都有明确错误提示

### 6.2 画布基础操作

**节点拖拽完成标准**：
- 拖动时节点跟随鼠标，松手后对齐最近网格（20px）
- 节点不能拖出画布边界
- 多选：按住 Shift 点击，或框选，多选后可整体拖动

**连线完成标准**：
- 从端口拖出时显示连线预览（虚线）
- 拖到不兼容类型端口上时，端口高亮红色，松手不连接，显示 tooltip「类型不匹配」
- 连线建立后，两端节点均高亮对应端口
- 点击连线可选中（高亮），按 Delete/Backspace 删除

**Undo/Redo 完成标准**：
- Cmd/Ctrl+Z 撤销，Cmd/Ctrl+Shift+Z 重做
- 支持 50 步历史
- 顶栏撤销/重做按钮在无历史时置灰

### 6.3 节点执行

**单节点 Run 完成标准**：
- 点击节点 Run 按钮后：
  - 按钮变为「停止」（可取消）
  - 节点边框变蓝色
  - 节点内显示进度（百分比或旋转动画）
  - 不能再次点击 Run（防重复提交）
- 执行成功后：
  - 结果显示在节点内（图片 2×2 网格，文本显示前 200 字+展开）
  - 节点边框绿色 2 秒，恢复默认
- 执行失败后：
  - 节点边框红色
  - 节点内显示错误信息
  - 如果是登录/官方线路问题：「请登录或检查官方 AI 线路」
  - Run 按钮恢复可点击
  - 错误可展开查看详情

**工作流 Run All 完成标准**：
- 按拓扑顺序执行（DAG 解析）
- 同层节点并发执行
- 任意节点失败：暂停后续依赖节点，其他无依赖节点继续
- 全部完成：顶栏状态「执行完毕 ✓ 耗时 xx 秒」
- 部分失败：顶栏状态「执行完毕（2 个节点失败）」

### 6.4 Skill：公众号长文创作

**完成标准**：
- Skill 配置弹窗：主题为必填，未填不可点击「生成工作流」，按钮置灰
- 工作流生成动画：节点逐个出现，总动画时长 1.0-2.0 秒
- 执行完成后，Html Formatter 节点可双击打开 Html Editor，编辑器内显示：
  - 模拟公众号图文样式（含标题、配图、正文分节）
  - 「复制 HTML」按钮（点击后按钮变为「已复制 ✓」）
  - 「下载配图」按钮（触发 ZIP 下载到本地）
- 生成的文章必须包含：标题（20-30字）、正文（2000-5000字）、至少 3 个 H2 小标题、N 张配图

### 6.5 工作流保存

**完成标准**：
- Cmd/Ctrl+S 或点击顶栏「保存」：
  - 触发保存，按钮显示「保存中...」
  - 成功：显示 toast「已保存」（底部，3 秒消失）
  - 失败：显示 toast「保存失败，请重试」（带重试按钮）
- 保存为本地 SQLite 操作，同步且瞬时（<50ms）
- 有未保存变更时，顶栏标题旁显示「●」
- 关闭有未保存变更的工作流时，弹窗确认「有未保存的变更，确认关闭？」

### 6.6 图片下载

**完成标准**：
- 单图下载：点击下载按钮，文件复制到用户指定位置
- 多图下载：打包为 ZIP，文件名格式 `tangent_[workflow_name]_[date].zip`
- 图片存储在本地工作空间 assets/ 目录，应用重启后仍可访问

### 6.7 订阅状态显示

**完成标准**：
- 顶栏或账户区域显示当前计划状态：Free / Pro
- 余额不足时显示低余额提示，并可一键升级/充值
- Settings > Account / Credits 页面显示积分余额、计划状态、升级入口

---

## 7. 节点系统设计

> 现网默认围绕公众号 Skill 的 Outline Split 主链路运行；`writer` 作为高级/实验长文节点保留但不进入默认模板，`gate/reviewer` 保留为 legacy。

### 7.1 端口类型与颜色

| 颜色 | 类型标识 | 数据格式 |
|------|---------|---------|
| 🔵 蓝色 | `text` | string / Markdown |
| 🟤 棕色 | `research_result` | 结构化搜索结果 JSON |
| 🟣 紫色 | `outline_options` | legacy 大纲选项 JSON |
| 🟢 绿色 | `image` | URL 或 Base64 |
| 🟢 绿（虚线） | `image_slot` | 图片占位符，连接后填充 |
| 🟡 黄色 | `structured` | JSON / HTML |

**端口规则**：
- 相同类型端口才可连接
- 一个输出端口可连接多个输入端口（fan-out）
- 一个输入端口只接受一条连线
- 类型不兼容时：端口高亮红色 + tooltip「类型不匹配」

### 7.2 公众号主节点清单（默认主链路）

#### 📥 输入类
| 节点 | 说明 | 输出类型 | 计费 |
|------|------|---------|------|
| text_input | 用户输入主题/关键词 | `text` | 免费（本地） |

#### 🔍 AI 搜索类
| 节点 | 说明 | 输入 | 输出 | AI 线路 |
|------|------|------|------|------------|
| research | 官方线路调研，整合结果 | `text` | `research_result` | 官方代理 |

#### ✍️ AI 编排类
| 节点 | 说明 | 输入 | 输出 | AI 线路 |
|------|------|------|------|------------|
| outline_generator | 生成章节大纲 + image_plans（供 Split） | `text` / `research_result` | `text`（章节输出）+ `image_plans` | 官方代理 |
| image_planner | 可选：基于文章文本补充配图计划 | `text` | `image_plans` | 官方代理 |

#### 🎨 配图类
| 节点 | 说明 | 输入 | 输出 | AI 线路 |
|------|------|------|------|------------|
| image_list | 官方多模型图片生成（GPT Image / Nano Banana / Jimeng / Seedream 等），双输入，动态输出端口，点击预览打开图层编辑器 | `image_plans` + `text` | `image_slot`×N（动态） | 官方代理 |
| image_asset | 个人图片素材容器，可缩放，双击进入 Image Editor | 无 | `image_slot` | 免费（本地） |
| image_gallery | 可选：收集图片并展示 | `image_slot` | 展示 UI | 免费（本地） |

#### 📄 输出类
| 节点 | 说明 | 输入 | 输出 | 计费 |
|------|------|------|------|------|
| html_formatter / Html Editor | Markdown + 图片 → 微信样式 HTML；双击进入富文本编辑、实时预览、AI 改写、复制 HTML；支持标准紫/经典蓝/墨黑/暖灰/赭红主题 | `text` + `image_slot`×N | 终点编辑 UI | 官方代理 |
| writer | 高级/实验：长文、小说、书稿草稿；打开 Writer Editor 后左侧纯文本编辑、右侧 PDF/书籍式预览 | `text` / `research_result` | `text` draft | 官方代理 |

默认主链路节点：`text_input`、`research`、`outline_generator`、`image_list`、`html_formatter`。
可选节点：`image_planner`、`image_gallery`、`image_asset`、`writer`。
legacy（非默认）节点：`gate`、`reviewer`、`image_gen`、`preview_wechat`。

### 7.3 节点状态机

| 状态 | 视觉表现 |
|------|---------|
| `idle` | 默认状态 |
| `running` | 蓝色边框脉冲，节点内显示进度动画 |
| `waiting` | 保留（仅 legacy gate 场景） |
| `done` | 绿色边框 2 秒，然后恢复默认 |
| `error` | 红色边框，显示错误信息 |

### 7.4 Backlog 节点（Phase 2+）

以下节点 MVP 不实现，移入 Backlog：

- **Prompt / Chat / Optimize**：通用文本节点，公众号 Skill 用 outline_generator + Split 路径代替
- **Search（热点）**：公众号 Skill 用 research 代替
- **Analysis（图像分析）**：Phase 2+ 再做
- **Midjourney V7 / Niji 7 / Seedream 5.0**：Phase 2+，当前主流程优先使用 GeekAI 官方图片模型
- **视频类（Kling、Seedance、Vidu 等）**：Phase 3
- **音频类（MiniMax Speech 等）**：Phase 3
- **PPT 节点**：Phase 3
- **小红书 Skill**：Phase 2

### 7.5 Image Editor 图层画板

**入口**：Image List 节点 done 状态 → 点击预览 → 打开全屏 Image Editor

**布局**：三栏（源图片 180px | 主画板 | 图层面板 220px）+ 顶部 header + 工具栏

**核心功能**：

| 功能 | 说明 | 状态 |
|------|------|------|
| 图层 CRUD | 新建/删除/复制/上下移动 | ✅ |
| 图层属性 | 不透明度(0-1)、显示/隐藏、锁定/解锁 | ✅ |
| 图片 contain 渲染 | 不同比例图片不拉伸，等比居中 | ✅ |
| 选择工具 | 点击选中图层，拖拽移动，handle 缩放 | ✅ |
| 绘画工具 | 画笔/橡皮，8色 4级笔宽 | ✅ |
| 网格 + 吸附 | 20px 网格线，移动/缩放时自动对齐 | ✅ |
| 从源图片添加 | 点击或拖拽左侧图片到画板创建图层 | ✅ |
| 栅格化 | 合并所有可见图层为一张新图层 | ✅ |
| 导出到节点 | 画布内容保存到 Image List 输出 slots | ✅ |
| AI Edit | 截取画布 + 指令 → AI 生成新图层 | ✅ |
| 撤销 | 撤销当前图层最后一笔 | ✅ |

---

## 8. Skills 技能系统

### 8.1 概念定义

Skills 是**预置工作流模板**。用户选择 Skill 后，填写必要参数，画布自动生成完整节点链路，可进一步手动调整。

### 8.2 MVP 内置 Skill：公众号长文创作（Phase 1）

**入口**：左侧工具栏 Skills 图标 → 点击「公众号长文创作」

**触发词（Phase 2 自然语言连线时使用）**：
- "写一篇公众号文章"
- "帮我做公众号图文"
- "生成公众号推文关于 XX"

**配置弹窗字段**：
| 字段 | 类型 | 必填 | 默认值 |
|------|------|------|------|
| 主题关键词 | 文本输入 | 是 | 无 |
| 文章风格 | 单选：深度解析 / 轻松科普 / 情感共鸣 / 干货清单 | 否 | 干货清单 |
| 配图数量 | 单选：1 / 3 / 5 | 否 | 3 |
| 配图风格 | 单选：写实 / 插画 / 简约 | 否 | 写实 |

**生成的节点链路**：
```
text_input ──→ research ──→ outline_generator
                               │
                               ├─ Split → text_input(section_1..N) ─┐
                               └─ image_plans ─────────→ image_list ─┼→ html_formatter / Html Editor
                                                        └→ image_gallery（可选）
```

**节点链路说明**：
1. `text_input`：用户输入主题/关键词
2. `research`：Tavily 多轮搜索，收集素材
3. `outline_generator`：生成章节结构 `sections[]` 和 `image_plans[]`
4. `Split`：自动创建 N 个章节 text_input，并自动补齐后半段连线
5. `image_list`：按计划生成 N 张配图（支持动态输出）
6. `image_gallery`：收集所有图片（可选）
7. `html_formatter`：将多段文本 + 图片合成为微信 HTML
8. 用户双击 `html_formatter` 进入 Html Editor，进行二次编辑、微信预览和复制 HTML

**输出验收标准**：
- Html Editor 内显示公众号样式 HTML 预览
- 文章长度 2000-5000 字，含 ≥3 个 H2 小标题
- 配图数量与配置一致
- 「复制 HTML」按钮：点击后 2 秒内完成复制，按钮文字变「已复制 ✓」
- 「下载配图」按钮：触发 ZIP 下载到本地

### 8.3 Phase 2 Skill：小红书图文笔记

**配置弹窗字段**：
| 字段 | 类型 | 必填 | 默认值 |
|------|------|------|------|
| 主题 | 文本输入 | 是 | 无 |
| 类型 | 单选：种草推荐 / 教程攻略 / 好物分享 / 生活记录 | 否 | 种草推荐 |
| 图片数量 | 单选：1 / 3 / 6 / 9 | 否 | 6 |
| 图片比例 | 单选：1:1 / 3:4 | 否 | 3:4 |
| 文案风格 | 单选：活泼可爱 / 简约高级 / 专业测评 | 否 | 活泼可爱 |

**生成的节点链路**：
```
[Search]──●──→[Chat:文案]──●──┬──→[Preview:RED]
                             │
                        [Optimize]──●──→[Image×N]──●──┘
```

**输出验收标准**：
- Preview: RED 节点内显示小红书样式卡片
- 文案包含：标题（≤20字）、正文（100-500字）、≥3 个 emoji、3-8 个话题标签
- 图片数量与配置一致
- 「复制文案」：点击复制，「下载图片」：触发 ZIP 下载

### 8.4 Phase 3+ Skills

- 品牌全案设计
- 电商素材生产
- 短视频脚本+生成
- 用户自定义 Skill 发布
- Skill 市场

---

## 9. UI/UX 设计规范（Cal.com 风格）

> 设计系统详细 Token 见 `reference/theme.ts`。设计规范原文见 `reference/design-system.md`。

### 9.1 设计理念

**关键词**：单色克制、灰度调色板、阴影即边框、紧凑标题

整体气质参考 Cal.com：纯灰度世界里，粗犷来自黑白对比而非色彩。Cal Sans 紧凑标题像雕刻在页面上，Inter 正文稳如磐石。节点画布场景下，用户生成的内容（图片、文本）成为画面焦点，UI 框架退到几乎看不见——用 11 级多层阴影定义边界，而非实线边框。

**核心签名**：
- **Cal Sans weight 600** 做标题——紧凑密集，几何感极强
- **11 级多层阴影**——ring shadow + 接触阴影 + 漫射阴影三层复合
- **阴影即边框**——不用 CSS border，全部用 `0px 0px 0px 1px` ring shadow
- **纯灰度调色板**——`#242424` 炭黑文字 + `#ffffff` 纯白表面 + `#898989` 中灰
- **端口颜色是唯一彩色**——画布端口按类型着色（功能性标识）

### 9.2 整体布局

```
┌──────────────────────────────────────────────────────────────┐
│ [Logo] [画布名 ●]             [Skills]  [🌙][CN/EN][头像]    │  ← 顶栏 56px，纯白
├──────┬───────────────────────────────────────┬───────────────┤
│      │                                       │               │
│ 左侧 │         主画布 (React Flow)            │  (Phase 2)    │
│ 工具 │         #f5f5f5 灰白背景              │  右侧 AI 面板  │
│ 栏   │         点阵网格                      │               │
│ 48px │  [节点]──●──────●──[节点]             │               │
│      │                                       │               │
├──────┴───────────────────────────────────────┴───────────────┤
│ [59%] [对齐] [适应]        执行状态     [Pro / 试用 12 天]    │  ← 底栏 40px
└──────────────────────────────────────────────────────────────┘
```

**顶栏**：`#ffffff` 白底，ring shadow 底线 `rgba(34,42,53,0.08) 0px 0px 0px 1px`
**画布**：`#f5f5f5` 极浅灰，`#d4d4d4` 点阵网格
**节点**：`#ffffff` 白底，三层复合阴影定义边界（不用实线边框）
**桌面窗口**：Tauri 自定义标题栏或原生标题栏（待定），画布区域不变

### 9.3 节点视觉规范

**模数系统**：基础单位 20px，节点宽高均为 20px 的倍数

**节点解剖**：
```
    三层复合阴影 = 边框（Cal.com 签名）
    ┌─────────────────────────────────┐
    │ [○] 节点名 (Cal Sans 600)  [Run]│  ← 标题栏 40px
    │     Inter 14px caption          │     Run: #242424 药丸
    ├─────────────────────────────────┤
    │ 配置区                           │  ← Inter 14px
    │ [label]: [____input/select____] │
    ├─────────────────────────────────┤  ← 仅生成类节点
    │ [img1][img2]                    │  ← 2×2 预览
    │ [img3][img4]                    │     图片 8px 圆角
    └─────────────────────────────────┘
●  端口(12px)                    ●  端口
   按类型着色                       Hover→16px
```

**节点阴影层级（Cal.com 签名）**：

| 状态 | 阴影 |
|------|------|
| 默认 | ring `rgba(34,42,53,0.08) 0 0 0 1px` + 接触 `rgba(19,19,22,0.7) 0 1px 5px -4px` + 漫射 `rgba(34,42,53,0.05) 0 4px 8px` |
| Hover | 漫射加深 + 上移 |
| 选中 | ring 变 `0 0 0 2px #6366F1` |
| 运行中 | ring 变 `0 0 0 2px #3B82F6` + 蓝色漫射 |
| 完成 | ring 变 `0 0 0 2px #22C55E`（2秒后恢复默认） |
| 错误 | ring 变 `0 0 0 2px #EF4444` + 红色漫射 |

**重要：不使用 CSS `border` 做节点边框。所有边界通过 ring shadow 定义。**

### 9.4 排版系统

**标题**（Cal Sans weight 600，紧凑密集）：
- 节点标题：16px / weight 600 / letterSpacing 0px
- 面板标题：24px / weight 600 / lineHeight 1.30
- 页面标题：48px / weight 600 / lineHeight 1.10
- Hero 标题：64px / weight 600 / lineHeight 1.10

**正文/UI**（Inter，稳靠可读）：
- 节点内文字：14px / weight 400
- 节点标签：12px / weight 500
- 按钮文字：16px / weight 600
- 辅助说明：14px / weight 500（`#898989` 中灰）

**特殊**：
- Cal Sans UI Light：18px / weight 300 / letterSpacing -0.2px（辅助性轻体正文）
- Cal Sans 20px 以下必须加 +0.2px letter-spacing

**代码**：Roboto Mono / 14px / weight 600

### 9.5 配色方案

**亮色模式（主模式）**：
```
画布背景:    #f5f5f5              极浅灰
网格点:      #d4d4d4              点阵
节点背景:    #ffffff              纯白
节点边框:    无（ring shadow）     核心：阴影即边框
顶栏背景:    #ffffff              纯白
文字主色:    #242424              炭黑（签名色）
文字次色:    #898989              中灰
按钮:        #242424 bg 白字       Cal.com 签名按钮
端口:        按类型着色            唯一彩色区域
品牌强调:    #6366F1              仅选中态
```

**暗色模式**：
```
画布背景:    #141414
网格点:      #2a2a2a
节点背景:    #1e1e1e
文字主色:    #f5f5f5
文字次色:    #a1a1a1
阴影:        rgba(255,255,255,0.04) ring + rgba(0,0,0,...) 漫射
```

### 9.6 端口视觉

- 12px 实心圆，Hover 放大 16px
- 填充色按类型（唯一彩色）：紫=prompt / 绿=image / 蓝=text / 橙=video / 红=search / 黄=structured / 灰=audio
- 可连接时：`box-shadow: 0 0 0 3px rgba(34,197,94,0.3)`
- 不可连接时：`opacity: 0.4` + `cursor: not-allowed`

### 9.7 按钮系统

| 类型 | 背景 | 圆角 | 说明 |
|------|------|------|------|
| 主按钮 | `#242424` | 6px | Cal.com 签名深色按钮，hover opacity 0.7 |
| 幽灵按钮 | `#ffffff` + ring shadow | 6px | 白底阴影边框 |
| 药丸按钮 | `#242424` | 9999px | badge、标签 |
| Run 按钮 | `#242424` | 9999px | 节点执行按钮 |

### 9.8 节点选择面板

**触发**：双击画布 / 左侧「+」工具 / 快捷键 `N`
**样式**：居中浮层，480px，max-height 600px，`#ffffff` 白底，16px 圆角，panel 级三层阴影

```
┌─────────────────────────────────────────┐
│ 🔍 搜索节点...  (Inter 16px)   [ESC]    │
├──────────────────────────────────────────┤
│ [全部] [输入] [文本] [图像] [输出]        │  ← Tab，药丸选中
├──────────────────────────────────────────┤
│ ┌──────────────┐  ┌──────────────┐       │  ← 8px 圆角卡片
│ │ [P] Prompt   │  │ [C] Chat     │       │     card 阴影
│ │ 提示词输入    │  │ AI文字生成   │       │
│ └──────────────┘  └──────────────┘       │     Hover → 加深阴影
│ ┌──────────────┐  ┌──────────────┐       │
│ │ [🎨] MJ V7  │  │ [G] Imagen3  │       │
│ │ 生图节点     │  │ 生图节点     │       │
│ └──────────────┘  └──────────────┘       │
└──────────────────────────────────────────┘
```

### 9.9 主题与语言

- 主题切换：顶栏右侧图标，一键切换
- 偏好：本地 Zustand + SQLite 持久化
- 语言切换：顶栏右侧「CN/EN」，i18next

### 9.10 视觉红线（AI 不得违反）

- ❌ 不用 CSS `border` 做节点边框——用 ring shadow
- ❌ 不用 Cal Sans 做正文——它是 display font，24px+ 专用
- ❌ Cal Sans 24px 以下不加 +0.2px letter-spacing——会挤在一起
- ❌ 不引入品牌色——灰度调色板，颜色仅用于端口和节点状态
- ❌ 不用 >5% 透明度的漫射阴影——Cal.com 阴影极致克制
- ❌ 不用渐变——完全扁平
- ❌ 不用装饰性插图——排版 + 生成内容即视觉

---

## 10. 数据字段约束

> 本地 SQLite 数据库，单用户。与 ARCH.md §5 对齐。

### 10.1 应用配置（app_config）

| 字段 | 类型 | 约束 |
|------|------|------|
| key | TEXT | PK |
| value | TEXT | NOT NULL |
| updated_at | TEXT | NOT NULL，ISO 8601 |

**存储项**：license_key, first_launch_date, workspace_path, theme, language, trial_started_at

### 10.2 API Keys（api_keys，legacy）

> 当前 BYOK 关闭；该表仅作为历史本地 Key 能力保留，默认产品路径不再读取。

| 字段 | 类型 | 约束 |
|------|------|------|
| provider | TEXT | PK，'anthropic' / 'tavily' / 'google_cloud' |
| encrypted_key | BLOB | NOT NULL，AES-256-GCM 加密 |
| is_valid | INTEGER | NOT NULL，DEFAULT 0 |
| last_tested_at | TEXT | NULLABLE，ISO 8601 |
| created_at | TEXT | NOT NULL，ISO 8601 |

### 10.3 工作流（workflows）

| 字段 | 类型 | 约束 |
|------|------|------|
| id | TEXT | PK，UUID |
| name | TEXT | NOT NULL，1-100 字符 |
| graph_json | TEXT | NOT NULL，完整 DAG 序列化（JSON 字符串） |
| thumbnail_path | TEXT | NULLABLE，本地文件路径 |
| created_at | TEXT | NOT NULL，ISO 8601 |
| updated_at | TEXT | NOT NULL，ISO 8601 |

### 10.4 生成资产（assets）

| 字段 | 类型 | 约束 |
|------|------|------|
| id | TEXT | PK，UUID |
| workflow_id | TEXT | FK → workflows.id, ON DELETE CASCADE |
| node_id | TEXT | NOT NULL |
| type | TEXT | NOT NULL，CHECK IN ('image','video','audio','html') |
| file_path | TEXT | NOT NULL，本地文件系统路径 |
| original_filename | TEXT | NULLABLE |
| size_bytes | INTEGER | NOT NULL |
| mime_type | TEXT | NOT NULL |
| created_at | TEXT | NOT NULL，ISO 8601 |

### 10.5 执行日志（execution_logs）

| 字段 | 类型 | 约束 |
|------|------|------|
| id | TEXT | PK，UUID |
| workflow_id | TEXT | NULLABLE |
| node_id | TEXT | NOT NULL |
| node_type | TEXT | NOT NULL |
| started_at | TEXT | NOT NULL，ISO 8601 |
| ended_at | TEXT | NULLABLE |
| duration_ms | INTEGER | NULLABLE |
| status | TEXT | NOT NULL，CHECK IN ('running','success','failed','cancelled') |
| error_message | TEXT | NULLABLE |

**注**：执行日志仅用于调试和用户查看历史，不用于计费。

---

## 11. 错误状态与空状态

### 11.1 网络与 API 错误

| 场景 | 显示方式 | 内容 |
|------|---------|------|
| AI API 调用失败 | 节点红色边框 + 节点内错误信息 | 「官方 AI 线路调用失败，请稍后重试或联系管理员」+ 重试按钮 |
| 未登录 | 节点红色边框 + 节点内错误信息 | 「请登录后使用官方 AI 线路」+ 「登录」按钮 |
| Provider 未配置 | 节点红色边框 | 「官方 Provider 未配置或不可用，请联系管理员」 |
| 请求超时（>60s）| 节点错误状态 | 「请求超时，请检查网络后重试」 |
| API 速率限制 | 节点错误状态 | 「API 调用频率超限，请稍后重试」 |

### 11.2 AI API 内容错误

| 场景 | 显示 |
|------|------|
| 内容违规（被 API 拒绝）| 「该内容不符合内容政策，请修改提示词后重试」 |
| Token 超限 | 「文本过长，请缩短输入后重试（当前 N 字，上限 M 字）」 |

### 11.3 文件导入错误

| 场景 | 显示 |
|------|------|
| 文件过大（>20MB）| 导入区域红色 + 「文件不能超过 20MB」 |
| 格式不支持 | 「仅支持 JPG、PNG、WebP 格式」 |

### 11.4 空状态

| 场景 | 空状态内容 |
|------|----------|
| Dashboard 无工作流 | 插画 + 「还没有工作流」+ 「创建第一个工作流」按钮 |
| 画布为空 | 淡色提示「双击画布添加节点，或选择一个 Skill 快速开始」 |
| 节点未执行 | 节点预览区显示「点击 Run 生成」占位文字（浅灰色） |
| Research 节点无结果 | 节点内「未找到相关结果，请尝试其他关键词」 |

### 11.5 加载状态

| 场景 | 显示 |
|------|------|
| 应用启动 | 全屏 Loading，TANGENT Logo 居中 + 旋转圆圈 |
| 画布加载工作流数据 | 骨架屏（节点位置处灰色占位块） |
| 节点执行中 | 节点边框蓝色脉冲 + 内容区旋转动画 |
| 图片生成中 | 2×2 网格内每格显示灰色占位 + 进度百分比 |

---

## 12. 本版本不做什么

> MVP 阶段明确不包含以下功能。

**功能边界**：
- ❌ 服务器端执行（所有 AI API 调用经客户端 Tauri Rust 侧直接发出）
- ❌ 用户数据云存储（所有数据存储在用户本地设备）
- ❌ MVP 多人功能（桌面版为单人使用）
- ❌ 右侧 AI 对话面板（Phase 2）
- ❌ 自然语言自动连线（Phase 2）
- ❌ 节点子画布 Draw/Comment/Inpaint（Phase 3）
- ❌ 视频生成节点（Phase 3）
- ❌ PPT 节点（Phase 3）
- ❌ 音频节点（Phase 3）
- ❌ 2D to 3D 节点（Phase 4）
- ❌ 团队实时协同（Phase 2 网页版）
- ❌ 工作流模板市场（Phase 3）
- ❌ 移动端适配（画布编辑器只做桌面版）

**技术边界**：
- ❌ 自部署 Stable Diffusion（只调用第三方 API）
- ❌ 实时语音输入
- ❌ 浏览器插件

---

## 13. API 集成清单

### 13.1 MVP 必须接入（P0）

| 服务 | 用途 | 接入方式 | Key 来源 |
|------|------|---------|---------|
| Official AI Proxy | 文本/图像 AI 节点 | FastAPI `/api/v1/proxy/*` 转发 | 后端环境变量 + Admin Provider Registry |
| GeekAI Relay | OpenAI-compatible 中转线路 | 后端 Provider `geekai` | `GEEKAI_API_KEY` |
| Email OTP + JWT | 登录与会话 | FastAPI `/auth/send-otp` + `/auth/verify-otp` | 用户邮箱 |

### 13.2 Phase 2 接入（P1）

| 服务 | 用途 |
|------|------|
| Niji 7 | 动漫风图像 |
| Seedream 5.0 | 中文图像生成 |
| 微信公众号 API | 图文预览/发布 |

### 13.3 Phase 3+ 接入（P2）

Kling、Seedance、Vidu、Wan2.x、MiniMax、Tencent Speech、小红书 API

---

## 14. 订阅与商业模式

### 14.1 套餐定价

| 套餐 | 价格 | 积分 | 功能 |
|------|------|------|------|
| Free | $0 | 50 注册赠送 | 官方 API 代理，按积分扣费 |
| Pro Monthly | $9.99/月 | 500 积分/月 | 8 折购积分 |
| Pro Yearly | $79.99/年 | 6000 积分/年 | 最佳价值 |

### 14.2 用户为什么付费

- 为 **AI API 使用量**付费（官方代理，无需自配 Key）
- 用户自带 API Key / BYOK 当前关闭，后续如需要再作为高级能力恢复
- Pro 会员享受积分折扣和专属功能

### 14.3 AI 路由策略

- **有官方 JWT** → FastAPI 代理（扣积分）
  - 积分足够 → 转发到 AI provider
  - 积分不足 → INSUFFICIENT_CREDITS 错误
- **无 JWT** → LOGIN_REQUIRED 错误

### 14.4 多模型差异定价

| 模型 | 积分/次 | 类型 |
|------|---------|------|
| Nemotron 3 Super 120B A12B（GeekAI） | 0–1 | 文本测试默认，当前原始 API 可同步返回 |
| MiniMax M2.7 Free（GeekAI） | 0–1 | 文本测试备用；当前返回 task id 但查询接口未取到结果 |
| Hunyuan 3.0 Preview（GeekAI） | 0–1 | 文本备选；当前原始 API 返回“模型不存在” |
| GPT-Image-2（GeekAI） | 8 | 图片生成默认 |
| Gemini 3.1 Flash Image Preview（GeekAI） | 5 | Chat Image / Nano Banana 2 路线，走 `/chat/completions`，支持图片生成/编辑、多图参考和搜索 |
| Nano Banana 2 / HD（GeekAI） | 5–8 | 历史/待核验标签，当前不作为默认模型 ID |
| Jimeng T2I v4.0（GeekAI） | 5–8 | 图片生成备用 |
| GPT-Image-1（GeekAI） | 6–8 | 图片编辑备用，走 `/images/edits` |
| Jimeng Image Enhance v2（GeekAI） | 3–6 | 图片增强 |
| （可后台配置） | — | — |

### 14.5 离线使用

- 画布编辑和本地操作完全离线
- AI 调用需联网（经 FastAPI 官方代理）
- 工作流和资产始终在本地

---

## 15. MVP 验收清单

> 以下每条均需人工验收通过，方可上线 MVP。验收范围围绕公众号长文创作 Skill 打通。

### 登录与 Setup
- [ ] 首次启动显示 Welcome 向导（OTP 登录）
- [ ] Email OTP 登录流程正确（发送验证码/验证/失败重试）
- [ ] 登录态持久化正确（重启后仍可识别）
- [ ] 未登录执行 AI 节点会提示登录，不再提示配置 API Key
- [ ] 登录后 AI 节点走官方后端代理并正确扣积分
- [ ] Free 计划限制 3 个工作流，Pro 无限制
- [ ] Free 模式：可查看编辑，按积分/权限控制 AI 能力

### 画布基础
- [ ] 双击空白处打开节点选择面板，ESC 可关闭
- [ ] 从节点列表拖拽节点到画布，自动对齐网格
- [ ] 节点间拖拽连线，端口类型不匹配时显示错误提示并拒绝连接
- [ ] 删除节点时，相关连线自动删除
- [ ] Cmd/Ctrl+Z 撤销，Cmd/Ctrl+Shift+Z 重做，最多 50 步
- [ ] Cmd/Ctrl+S 保存工作流，显示「已保存」toast
- [ ] 节点左侧显示分类颜色边框（input=蓝, ai=紫, image=绿, output=黄, text=棕）
- [ ] 鼠标悬停端口显示数据类型 tooltip
- [ ] Ctrl+C / Ctrl+V 复制粘贴选中节点（保留数据）
- [ ] Alt+Click 复制单个节点
- [ ] Delete / Backspace 删除选中节点
- [ ] 右键节点弹出上下文菜单（复制 / 粘贴 / 删除）
- [ ] 右键空白处弹出菜单（粘贴）
- [ ] 工作流 JSON 导出/导入（可分享）
- [ ] 返回 Dashboard 时自动保存工作流

### 节点执行引擎
- [ ] 节点状态机：idle → running → done/error，状态正确显示
- [ ] Outline Split：outline 完成后可自动生成章节节点和后续连线
- [ ] 按拓扑序执行，DAG 校验（环路检测）
- [ ] 节点执行中可点击「停止」取消
- [ ] 节点执行失败显示红色边框 + 错误信息

### 节点执行（公众号主流程）

**text_input**
- [ ] 输入文本，连线到 research 节点，数据正确传递

**research**
- [ ] 接收 text_input 的输出，调用 Tavily 多轮搜索
- [ ] 搜索结果正确显示在节点内（结构化展示）

**outline_generator**
- [ ] 接收 research 的输出，Claude 生成 3 个大纲选项
- [ ] 3 个选项正确显示在节点内

**outline_generator + split**
- [ ] 生成章节结构后可一键 Split，自动创建 N 个 text_input(section)
- [ ] Split 后自动补齐 html_formatter 的 text_N 连线
- [ ] 生成的 image_plans 可传递给 image_list

**image_planner（可选）**
- [ ] 接收文本输入，规划配图数量和位置
- [ ] 配图计划正确显示（配图 N 张，对应文章位置）

**image_list**
- [x] 接收 image_planner / outline_generator 的 `image_plans`，经官方图片代理生成图片
- [x] 图片正确显示在节点内
- [x] 支持生成多张（配置 N 张则生成 N 张）
- [x] 生成图片自动写入工作流 assets，并登记到全局个人图片素材库
- [ ] GeekAI 真 Key 联调异步结果轮询、图片编辑、图片增强与失败重试

**image_gallery**
- [ ] 收集所有 image_list 的图片
- [ ] 提供多个输出端口（cover_out + img_1_out...img_N_out）
- [ ] 各端口图片正确传递到 html_formatter

**html_formatter**
- [ ] 接收文章文本 + N 个 image_slot 输入
- [ ] 确定性模板引擎（非 LLM），将 Markdown 转为微信样式 HTML
- [ ] 图片正确嵌入到文章对应位置
- [ ] 输出 HTML 格式正确

**Html Editor**
- [ ] 双击 html_formatter done 状态进入编辑器
- [ ] 左侧富文本编辑，右侧微信样式实时预览
- [ ] 可切换标准紫/经典蓝/墨黑/暖灰/赭红主题，复制输出同步当前主题
- [ ] 编辑内容关闭后重开仍保留
- [ ] 「复制 HTML」按钮：点击后 2 秒内复制成功

### Skill：公众号长文创作
- [ ] 点击「公众号长文创作」，弹出配置弹窗
- [ ] 填写主题（必填），选择风格/配图数量/风格，点击「生成工作流」
- [ ] 节点动画逐个出现，连线逐条生成（总时长 1.0-2.0 秒）
- [ ] 生成主流程节点并可通过 Split 自动补齐后半段
- [ ] 执行完毕，html_formatter 可打开 Html Editor 并显示完整预览
- [ ] 「复制 HTML」和「下载配图」功能正常

### 存储与下载
- [ ] 生成的图片可在节点内点击放大查看
- [ ] 单图下载：文件保存到用户指定位置
- [ ] 图片在应用重启后仍可访问（本地 assets 目录）
- [ ] 多图下载打包为 ZIP

### Personal Library（Phase 2 MVP）
- [ ] 左侧素材库在所有 workflow 中共享同一批文章/图片素材
- [ ] Text 节点可保存文章素材，并支持新增标签、搜索、筛选
- [ ] Image Editor 可导出当前画布到图片素材库
- [ ] 文章素材拖入画布生成 `text_input`
- [ ] 图片素材拖入画布生成可缩放 `image_asset`，并可进入 Image Editor
- [ ] Workspace Library 支持 Gallery/List/Graph 三视图，Graph 能展示素材、标签、类型关系并点击标签筛选

### Writer 高级节点
- [ ] `writer` 可从 Node Picker 添加，但不进入公众号默认模板
- [ ] 执行完成后可打开 Writer Editor
- [ ] 左侧纯文本/Markdown 编辑，右侧 PDF/书籍式分页预览
- [ ] 关闭后重开不丢书稿内容

### 主题/语言
- [ ] 亮色/暗色切换即时生效，重启后保持
- [ ] 中文/英文切换即时生效，所有文案切换正确

---

## 16. 开发路线图

### Phase 1 — Desktop MVP ✅ 已完成

**目标**：桌面画布可用，公众号 Skill 跑通，Free/Pro 分层

**详细开发计划**：[dev-plans/phase1-mvp.md](dev-plans/phase1-mvp.md)

| Slice | 名称 | 状态 |
|-------|------|------|
| 0 | Tauri 脚手架 + SQLite | ✅ |
| 1 | Auth + API Key 管理 | ✅ / legacy |
| 2 | Dashboard + 工作流 CRUD（本地） | ✅ |
| 3 | 画布核心（复用现有） | ✅ |
| 4 | text_input · research · outline_generator | ✅ |
| 5 | Outline Split 编排（替代 gate/writer/reviewer 主链路） | ✅ |
| 6 | image_planner · image_list · image_gallery | ✅ |
| 7 | html_formatter · legacy preview_wechat | ✅ |
| 8 | 积分订阅系统（FastAPI 后端） | ✅ |
| 9 | 主题 + 语言 + 桌面安装包 | ✅ |
| 10 | 画布交互增强 | ✅ |
| 11 | Image List重构 + AI Agent面板 + 画布主题 + 图片编辑器 | ✅ |

### Phase 2 — 商业化 🔄 核心能力完成，当前 P0 为 Admin Provider/Model 管理闭环

**目标**：官方 API 代理，积分订阅，管理后台，完善体验

**详细开发计划**：[dev-plans/phase2-commercial.md](dev-plans/phase2-commercial.md)

| Slice | 名称 | 优先级 | 状态 |
|-------|------|--------|------|
| 13 | Skill 动态拓扑系统 | P0 | ✅ |
| 14 | 模型注册表 + 多模型路由 | P1 | ✅ |
| 15 | 官方 API 默认路由 + 登录门控 | P0 | ✅ |
| 16 | 多模型代理 + 差异积分 | P1 | ✅ |
| 17 | i18n 中英切换完成 | P1 | ✅ |
| 18 | 首次引导 + 订阅支付 | P1 | ✅ |
| 19 | Settings 简化 + Skill 推荐卡片 | P2 | ✅ |
| 22 | Image Editor 图层画板 | P1 | ✅ |
| 23 | Html Editor 富文本编辑 | P1 | ✅ 初版完成，待手测验收 |
| — | Html 多主题 + Writer 高级节点 | P2 | ✅ MVP 完成，待手测验收 |
| — | 个人素材库 + Image 容器 + Graph | P1 | ✅ MVP 完成，待手测验收 |
| — | 管理后台 Web 应用 | P1 | 🔄 API + 基础前端完成，当前补 Provider/Model 默认值、fallback、health/test |
| — | Provider 可插拔架构 | P1 | ✅ / 🔄 下一步补默认模型、fallback、健康检查 |
| 20 | 网页端架构预留 | P3 | ⬜ |

**Bug 修复记录**：[debug-plans/bugs-session-2026-04-23.md](debug-plans/bugs-session-2026-04-23.md)

### Phase 3 — V2

**目标**：子画布编辑，视频，发布集成，网页版

- 小红书图文笔记 Skill
- 节点子画布（Draw + Comment）
- Image Inpaint
- PPT 节点
- 视频节点（Kling、Seedance）
- 微信公众号直接发布
- Skill 市场
- 网页版（云端协同）

### Phase 4 — V3

- 音频节点、3D 节点
- 第三方开发者 API
- 小红书发布集成

---

## 17. 待确认事项

| # | 问题 | 影响范围 | 优先级 | 状态 |
|---|------|---------|--------|------|
| 1 | macOS 代码签名：Apple Developer 账号是否已准备？ | 应用分发 | P0 | ❓ 待确认 |
| 2 | Tauri webview：用系统 webview 还是打包 Chromium？ | 一致性 vs 体积 | P0 | ❓ 待确认 |
| 3 | Docker 部署：FastAPI 后端生产环境部署验证 | 后端运行 | P0 | ❓ 待确认 |
| 4 | Stripe Live 模式：从测试切正式密钥 | 支付上线 | P1 | ❓ 待确认 |
| 5 | 小红书 HTML 组件库品牌色：当前 `#5965AF`，以后是否可定制？ | Phase 3 Skill | P1 | ❓ 待确认 |
| 6 | Auto-update：Tauri updater 是否已配置和测试？ | 版本更新 | P1 | ❓ 待确认 |

---

*本文档是 AI 与开发团队之间的合同。每次重大决策变更必须更新版本号和对应章节。*
