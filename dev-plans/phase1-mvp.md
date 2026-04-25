# Phase 1 — MVP 开发计划（索引）

**阶段**: MVP | **目标**: 桌面客户端 + 公众号 Skill
**状态**: ✅ 已完成（按代码现状校准） | **校准日期**: 2026-04-24

> 2026-04-25 对齐：当前默认出口已升级为 `html_formatter` / Html Editor；`preview_wechat` 仅作历史/legacy 说明。

---

## 说明

本文件已从“待开发计划”切换为“已落地索引”。
后续开发请以 Phase 2/3 文件为主，本文件用于回溯 MVP 交付内容与真实实现差异。

---

## Slice 列表（校准后）

| # | 文件 | 名称 | 难度 | 预计 | 状态 |
|---|------|------|------|------|------|
| 0 | [slice-00-scaffold.md](slice-00-scaffold.md) | Tauri 脚手架 + SQLite | 中 | 2天 | ✅ |
| 1 | [slice-01-auth.md](slice-01-auth.md) | Auth/API Key 基础能力 | 中 | 2天 | ✅ |
| 2 | [slice-02-dashboard.md](slice-02-dashboard.md) | Dashboard + 工作流 CRUD（本地） | 低 | 2天 | ✅ |
| 3 | [slice-03-canvas.md](slice-03-canvas.md) | 画布核心（复用现有） | 高 | 4天 | ✅ |
| 4 | [slice-04-text-nodes.md](slice-04-text-nodes.md) | text_input · research · outline_generator | 中 | 3天 | ✅ |
| 5 | [slice-05-image-nodes.md](slice-05-image-nodes.md) | Outline Split 编排（替代原 gate/writer/reviewer 主路径） | 高 | 3天 | ✅ |
| 6 | [slice-06-execution.md](slice-06-execution.md) | image_planner · image_list · image_gallery | 高 | 3天 | ✅ |
| 7 | [slice-07-skills.md](slice-07-skills.md) | html_formatter · preview_wechat | 中 | 2天 | ✅ |
| 8 | [slice-08-subscription.md](slice-08-subscription.md) | 积分订阅系统（已迁移 FastAPI + Stripe） | 高 | 5天 | ✅ |
| 9 | [slice-09-polish.md](slice-09-polish.md) | 主题 + 语言 + 安装包 | 低 | 2天 | ✅ |
| 10 | [slice-10-canvas-interaction.md](slice-10-canvas-interaction.md) | 画布交互增强 | 高 | 3天 | ✅ |
| 11 | [slice-11-image-list-agent.md](slice-11-image-list-agent.md) | Image List 重构 + AI Agent 面板 + 画布主题 | 高 | 5天 | ✅ |

---

## 当前公众号主流程（代码真值）

```
text_input
  -> research
  -> outline_generator
  -> Split（自动拆分）
      -> N x text_input(section)
      -> image_list（接 image_plans）
      -> html_formatter / Html Editor（接 text_1...text_N + images）
```

说明：
- `gate`、`writer` 属于遗留能力，不在公众号主模板和主节点列表中。
- Agent 侧已按主流程约束，优先生成 Outline + Split 路径。

---

## 与原计划的关键差异

1. 原 Slice 5（gate/writer/reviewer）不再是公众号默认链路。
2. 原 Slice 6 中 `image_gen` 已由 `image_list` 替代并扩展为双输入+动态端口。
3. 原 Slice 8 技术选型从 Supabase 迁移为 FastAPI + PostgreSQL + Stripe。
4. 输出链路已在 Phase 2 收口为 `html_formatter` / Html Editor 终点；`preview_wechat` 不再是默认出口。

---

## 维护约定

- 本文件仅维护“已完成索引”和“偏差说明”，不再写待办任务。
- 新功能增量请写入 `phase2-commercial.md`、`slice-21`、`slice-23` 或新增切片。
- 每次调整公众号主流程，必须同步更新：
  - `node-plan.md`
  - `wechat-skill-nodes.md`
  - `skillDefs.ts` 注释与描述文案
