# Phase 1 — MVP 开发计划（索引）

**阶段**: MVP | **目标**: 桌面客户端 + 公众号 Skill
**状态**: 未开始 | **开始日期**: 待定

---

## Slice 列表

| # | 文件 | 名称 | 难度 | 预计 | 状态 |
|---|------|------|------|------|------|
| 0 | [slice-00-scaffold.md](slice-00-scaffold.md) | Tauri 脚手架 + SQLite | 中 | 2天 | ✅ |
| 1 | [slice-01-auth.md](slice-01-auth.md) | License + API Key 管理 | 中 | 2天 | ✅ |
| 2 | [slice-02-dashboard.md](slice-02-dashboard.md) | Dashboard + 工作流 CRUD（本地） | 低 | 2天 | ✅ |
| 3 | [slice-03-canvas.md](slice-03-canvas.md) | 画布核心（复用现有） | 高 | 4天 | ✅ |
| 4 | [slice-04-text-nodes.md](slice-04-text-nodes.md) | text_input · research · outline_generator | 中 | 3天 | ✅ |
| 5 | [slice-05-image-nodes.md](slice-05-image-nodes.md) | gate · writer · reviewer | 高 | 3天 | ✅ |
| 6 | [slice-06-execution.md](slice-06-execution.md) | image_planner · image_gen · image_gallery | 高 | 3天 | ✅ |
| 7 | [slice-07-skills.md](slice-07-skills.md) | html_formatter · preview_wechat | 中 | 2天 | ⬜ |
| 8 | [slice-08-subscription.md](slice-08-subscription.md) | Skill 模板 + 端到端测试 | 中 | 3天 | ⬜ |
| 9 | [slice-09-polish.md](slice-09-polish.md) | 主题 + 语言 + 桌面安装包 | 低 | 2天 | ⬜ |
| 10 | [slice-10-canvas-interaction.md](slice-10-canvas-interaction.md) | 画布交互增强 | 高 | 3天 | 🔨 部分 |

## 依赖关系

```
Slice 0 (Tauri 脚手架)
  └──→ Slice 1 (License + API Key)
          └──→ Slice 2 (Dashboard)
                  └──→ Slice 3 (画布核心)
                          └──→ Slice 4 (text_input · research · outline)
                                  └──→ Slice 5 (gate · writer · reviewer)
                                          └──→ Slice 6 (image_planner · image_gen · gallery)
                                                  └──→ Slice 7 (html_formatter · preview)
                                                          └──→ Slice 8 (Skill 模板 + e2e)
                                                                  └──→ Slice 9 (主题 + 语言 + 安装包)
```

## 开发流程（每个 Slice）

```
1. 读这个 slice 的 .md 文件
2. 按步骤实现（先 Rust 侧，再前端）
3. 完成后更新本文件状态 → ✅
4. 更新 project_state.md
5. 运行 300 行审查
6. git commit
```

## 技术栈

| 层 | 选型 |
|---|---|
| 桌面壳 | Tauri v2 (Rust) |
| 前端 | React + TypeScript + Vite |
| 画布 | React Flow v12 |
| 状态管理 | Zustand v4 |
| UI | Tailwind CSS + Radix UI |
| 本地数据库 | SQLite + Drizzle ORM |
| AI API | Tauri Rust 侧 reqwest 转发，用户自带 Key |
| 文件存储 | 本地文件系统（Tauri fs API） |
| 授权 | 本地 Ed25519 加密签名验证 |
| API Key 加密 | AES-256-GCM |

## MVP 11 节点清单

```
输入:  text_input
AI:    research, outline_generator, writer, reviewer, image_planner
交互:  gate
图像:  image_gen, image_gallery
输出:  html_formatter, preview_wechat
```
