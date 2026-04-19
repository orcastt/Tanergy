# Phase 1 — MVP 开发计划（索引）

**阶段**: MVP | **目标**: 画布 + 公众号/小红书 Skill + 支付
**状态**: 未开始 | **开始日期**: 待定

---

## Slice 列表

| # | 文件 | 名称 | 难度 | 预计 | 状态 |
|---|------|------|------|------|------|
| 0 | [slice-00-scaffold.md](slice-00-scaffold.md) | 项目脚手架 | 低 | 2天 | ✅ |
| 1 | [slice-01-auth.md](slice-01-auth.md) | 用户系统 | 中 | 3天 | ✅ |
| 2 | [slice-02-dashboard.md](slice-02-dashboard.md) | Dashboard + 工作流 | 中 | 2天 | ⬜ |
| 3 | [slice-03-canvas.md](slice-03-canvas.md) | 画布核心 | 高 | 4天 | ⬜ |
| 4 | [slice-04-text-nodes.md](slice-04-text-nodes.md) | 文本类节点 | 中 | 3天 | ⬜ |
| 5 | [slice-05-image-nodes.md](slice-05-image-nodes.md) | 图像生成节点 | 高 | 3天 | ⬜ |
| 6 | [slice-06-execution.md](slice-06-execution.md) | 执行引擎 | 高 | 3天 | ⬜ |
| 7 | [slice-07-skills.md](slice-07-skills.md) | Skills 系统 | 中 | 3天 | ⬜ |
| 8 | [slice-08-subscription.md](slice-08-subscription.md) | 订阅计费 | 中 | 2天 | ⬜ |
| 9 | [slice-09-polish.md](slice-09-polish.md) | 主题 + 语言 + 收尾 | 低 | 2天 | ⬜ |

## 依赖关系

```
Slice 0 (脚手架)
  ├──→ Slice 1 (用户系统)
  │       └──→ Slice 2 (Dashboard)
  │               └──→ Slice 3 (画布核心)
  │                       ├──→ Slice 4 (文本节点)
  │                       │       └──→ Slice 5 (图像节点)
  │                       │               └──→ Slice 6 (执行引擎) ←── 依赖 4+5
  │                       │                       └──→ Slice 7 (Skills)
  │                       │                               └──→ Slice 8 (订阅)
  │                       │                                       └──→ Slice 9 (收尾)
  └──→ Slice 6 (执行引擎) ← 同时需要 Slice 3 的画布
```

## 开发流程（每个 Slice）

```
1. 读这个 slice 的 .md 文件
2. 按步骤实现（先做后端，再做前端）
3. 完成后更新本文件状态 → ✅
4. 更新 project_state.md
5. 运行 300 行审查
6. git commit
```
