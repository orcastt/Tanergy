# TANGENT — 公众号 Skill 节点设计规范（现网）

**版本**: v2.0
**日期**: 2026-04-24
**状态**: ✅ 已按现网实现校准（2026-04-25：Html Editor 为默认终点）

> 本文档描述公众号工作流的当前可维护规范。
> 以“Outline Split 图文编排”为主，`gate/writer` 不再作为默认链路节点。

---

## 一、核心设计原则

### 1. 从“暂停交互流”改为“拆分编排流”

旧方案：Outline -> Gate -> Writer -> Reviewer -> ...
现方案：Outline -> Split -> N 段 text_input + image_list -> html_formatter / Html Editor

优势：
- 不阻塞执行引擎。
- 文章段落和配图可以分治处理。
- 更适配 Agent 自动搭图和后续 Html 编辑器。

### 2. 节点注册表即真相源

前端 `nodeDefs.ts` 决定：
- 节点是否在列表中出现
- 端口类型是否合法
- Agent 能否自动连线

### 3. 输出稳定优先

`html_formatter` / Html Editor 作为稳定出口，负责可视确认、二次编辑和复制输出。
流程核心目标是“可发布内容的一次成形”，不是追求中间节点复杂度。

---

## 二、默认节点集合（公众号模板）

| 节点 | 用途 | 是否默认 |
|------|------|---------|
| `text_input` | 输入主题/章节文本 | ✅ |
| `research` | 调研主题背景 | ✅ |
| `outline_generator` | 输出章节结构 + image plans | ✅ |
| `image_list` | 生成图片并输出多 image slot | ✅ |
| `html_formatter` / Html Editor | 汇总多段文本与图片生成 HTML，并提供富文本编辑/微信预览 | ✅ |
| `image_planner` | 替代性配图规划（可选） | 可选 |
| `image_gallery` | 结果聚合展示（可选） | 可选 |

不再作为公众号默认节点：
- `gate`
- `writer`
- `reviewer`
- `preview_wechat`

---

## 三、端口规范

| 类型 | 说明 | 典型端口 |
|------|------|---------|
| `text` | 文本通道 | `text_input.out`, `html_formatter.text_1` |
| `research_result` | 调研结果 | `research.out` |
| `outline_options` | legacy 大纲选项兼容字段 | 历史 outline 输出 |
| `image_plans` | 配图计划 | `outline_generator.image_plans` |
| `image_slot` | 图片资产槽位 | `image_list.out`, `html_formatter.images` |
| `structured` | 结构化 HTML | legacy `preview_wechat` |

连接原则：
- 必须严格匹配端口类型。
- `html_formatter` 的 `text_N` 输入允许多个。
- `image_list` 允许从 `image_plans` 和 `text` 两路输入。

---

## 四、执行流程

### 4.1 基础流

```
text_input -> research -> outline_generator
```

### 4.2 Outline 完成后的 Split 行为

- 自动创建 N 个章节 text_input。
- 自动创建/复用 image_list。
- 自动创建/复用 html_formatter。
- 自动连线：
  - section_i.out -> html_formatter.text_i
  - image_list.out -> html_formatter.images

### 4.3 输出流

```
html_formatter / Html Editor
```

---

## 五、节点行为细则（简版）

### `outline_generator`
- 输入：topic + research
- 输出：`sections[]`, `image_plans[]`, `options[]`, `raw`
- UI：显示章节，支持 Split

### `image_list`
- 输入：`image_plans` 或 `text`
- 输出：`image1..imageN`（动态）和 `out`
- UI：数量、模型、编辑入口

### `html_formatter`
- 输入：多文本段落 + 图片
- 输出：终点编辑 UI
- UI：风格、排版参数、Html Editor 入口、微信预览、复制 HTML

### `preview_wechat`（legacy）
- 历史预览节点，不再进入默认模板。
- 新流程由 Html Editor 右侧预览替代。

---

## 六、与旧文档差异（必须知晓）

1. 不再要求 Gate 暂停交互。
2. 不再要求 Writer/Reviewer 作为公众号主链路必经步骤。
3. 图片节点统一以 `image_list` 为主，不再以 `image_gen` 为主命名。
4. 输出终点统一为 Html Editor，不再要求额外 `preview_wechat`。
5. 以“可维护 + 可扩展 + Agent 友好”优先，减少手工决策节点。

---

## 七、验收清单

- [x] 技能模板创建后可直接执行主流程。
- [x] Outline Split 能自动补齐后半段图结构。
- [x] 结果可在 Html Editor 中完整查看和复制。
- [x] 节点列表中公众号默认路径不依赖 `gate/writer`。
- [x] 文档规范与 `nodeDefs.ts` / `skillDefs.ts` 一致。
