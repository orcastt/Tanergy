# TANGENT — 节点开发计划（聚焦公众号 Skill）

**版本**: v3.0
**日期**: 2026-04-24
**状态**: ✅ 已按代码现状校准（2026-04-25 更新：Html Editor 为默认终点）
**策略**: 公众号主流程以 Outline Split 架构为核心，移除 Gate/Writer 作为默认必需节点
**开发规范**: 代码质量与测试门槛见 `dev-plans/code-quality-standards.md`

---

## 一、公众号主节点清单（当前默认）

当前默认主链路共 **5 类节点**，按默认使用顺序排列：

| # | 节点 | 类型 | 状态 | 备注 |
|---|------|------|------|------|
| 1 | `text_input` | 输入 | ✅ | 支持手输 + 接收上游文本 |
| 2 | `research` | AI | ✅ | 主题调研 |
| 3 | `outline_generator` | AI | ✅ | 生成章节 + image_plans |
| 4 | `image_list` | 图像 AI | ✅ | 双输入（plans/text）+ 动态输出 |
| 5 | `html_formatter` / Html Editor | 输出编排 | ✅ | 多文本输入 + 图片输入 + 富文本编辑/微信预览 |

可选节点：`image_planner`、`image_gallery`。
遗留节点（非公众号默认）：
- `gate`（legacy）
- `writer`（legacy）
- `reviewer`（legacy）
- `image_gen`（兼容别名）
- `preview_wechat`（legacy 预览，不再作为默认出口）

---

## 二、核心执行模型：Outline Split

### 2.1 主流程

```
text_input -> research -> outline_generator

outline_generator done 后触发 Split：
- 依据 sections[] 自动创建 N 个 text_input
- 依据 image_plans 自动创建 image_list
- 自动连到 html_formatter.text_1...text_N / html_formatter.images
- 最终停在 html_formatter / Html Editor
```

### 2.2 为什么采用 Split

- 避免 Gate 暂停式交互打断整体执行。
- 章节文本与图片计划可并行编辑，结构更清晰。
- 便于 Agent 自动搭图和后续 Html Editor 二次编辑。

### 2.3 执行状态

| 状态 | 含义 | 备注 |
|------|------|------|
| `idle` | 未执行 | 默认 |
| `running` | 执行中 | 蓝色反馈 |
| `done` | 执行完成 | 绿色反馈 |
| `error` | 执行失败 | 错误信息可见 |
| `waiting` | 保留 | 仅 legacy gate 场景 |

---

## 三、端口类型（现网）

| 类型 | 颜色 | 数据格式 | 典型节点 |
|------|------|---------|---------|
| `text` | 蓝 | `string` 或 `{ text }` | text_input / html_formatter |
| `research_result` | 棕 | 调研文本对象 | research |
| `outline_options` | 紫 | 大纲选项（legacy 兼容字段） | legacy outline |
| `image_plans` | 紫 | 图片计划数组 | outline_generator / image_planner |
| `image_slot` | 绿 | 图片资产或数组 | image_list / image_gallery / html_formatter |
| `structured` | 黄 | HTML 结构化结果 | legacy preview_wechat |

---

## 四、节点职责（摘要）

### 4.1 `text_input`
- 输入主题或段落。
- 作为 Split 后章节承载节点。
- 支持 `in` 输入端口，允许上游覆盖内容。

### 4.2 `research`
- 接收主题文本。
- 返回结构化调研文本（供大纲生成参考）。

### 4.3 `outline_generator`
- 生成章节 `sections[]`。
- 同时生成 `image_plans[]`。
- 支持一键 Split 自动搭建后续图。

### 4.4 `image_list`
- 输入可来自 `image_plans` 或 `text`。
- 支持数量、模型、动态输入口和动态输出口。
- 双击可进入 Image Editor 图层画板。

### 4.5 `html_formatter`
- 多 `text_N` 输入汇总为文章。
- 接收 `images` 输入进行图文混排。
- 执行后产出 HTML，done 状态双击进入 Html Editor。
- Html Editor 支持富文本编辑、微信预览、AI 改写和复制 HTML。

### 4.6 `preview_wechat`（legacy）
- 历史微信阅读预览组件。
- 不再进入公众号默认模板；新流程由 Html Editor 右侧预览承担。

---

## 五、Agent 搭图约束（必须遵守）

1. 若使用 `outline_generator`，默认停在 Outline，不直接手动添加完整后半段，由 Split 生成。
2. 不默认生成 `gate`、`writer`、`reviewer`。
3. `fromPort/toPort` 必须使用节点注册表中的真实端口。
4. 文本默认模型使用 `MiniMax-M2.7`，图片默认 `minimax-image`。

---

## 六、验收清单（主流程）

- [x] `text_input -> research -> outline_generator` 可稳定执行。
- [x] Outline Split 自动生成章节节点与图片节点。
- [x] `image_list` 动态输入/输出口可用。
- [x] `html_formatter` 能消费多段文本 + 图片。
- [x] Html Editor 可显示微信预览并复制 HTML。
- [x] 公众号模板不依赖 `gate`、`writer`。

---

## 七、后续演进

- Html Editor（Slice 23）已成为 `html_formatter` 的默认终点面板。
- `writer/reviewer/gate` 若保留，仅作为“高级/实验节点”管理，不进入默认模板。
- 后续若引入小红书模板，建议沿用 Split 思路，不回退到 Gate 暂停架构。
