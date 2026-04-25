# Slice 7: html_formatter · preview_wechat

**优先级**: P0 | **难度**: 中 | **预计**: 2 天 | **状态**: ✅ 已完成（按现网实现校准）
**依赖**: Slice 6 | **返回索引**: [phase1-mvp.md](phase1-mvp.md)

> 2026-04-25 对齐：Slice 7 是历史输出链路记录；当前默认出口已升级为 `html_formatter` / Html Editor，`preview_wechat` 仅作为 legacy 能力说明。

---

## 目标

完成公众号流程最终输出链路：
- 将多章节文本和图片汇总为可发布 HTML
- 在 Html Editor 中检查、编辑与复制

---

## 实际交付

### 1. `html_formatter` 节点

**文件**: `frontend/src/nodes/HtmlFormatterNode.tsx`

能力：
- 输入：`text_1` 起的动态文本口 + `images`。
- 输出：终点编辑 UI（HTML 结果保存在节点结果中）。
- 支持样式参数（字体大小、行高、风格等）。
- 节点内展示执行状态与结果摘要。

### 2. `preview_wechat` 节点（legacy）

**文件**: `frontend/src/nodes/PreviewWechatNode.tsx`

能力：
- 消费 `structured` 输入。
- 提供微信样式阅读预览。
- 提供复制 HTML 入口。

### 3. 执行引擎与后端接入

**文件**:
- `src-tauri/src/commands/execute/mod.rs`
- `src-tauri/src/commands/execute/media.rs`

能力：
- `html_formatter` 进入 execute 路由。
- 支持文本+图片汇总输出。
- 错误场景回传前端并进入节点 error 态。

---

## 与原计划差异

1. 原计划中“纯静态 formatter”已升级为可配参数的输出节点。
2. 输出链路与 Outline Split 紧耦合，支持多 `text_N` 输入。
3. Slice 23 已把 Html Viewer 升级为可编辑 Html Editor（Notion 风格），并成为默认出口。

---

## 验收清单

- [x] 多章节文本可汇总为 HTML。
- [x] 图片可通过 `images` 输入参与编排。
- [x] Html Editor 可正确显示 HTML 内容。
- [x] 复制 HTML 功能可用。
- [x] 在公众号模板中形成稳定末端输出。

---

## 后续衔接

- Slice 23 已增强为 Html Editor + AI Rewrite。
- 公众号主模板当前以 `html_formatter` / Html Editor 作为标准出口。
