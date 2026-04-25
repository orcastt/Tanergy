# Slice 6: image_planner · image_list · image_gallery

**优先级**: P0 | **难度**: 高 | **预计**: 3 天 | **状态**: ✅ 已完成（按现网实现校准）
**依赖**: Slice 5 | **返回索引**: [phase1-mvp.md](phase1-mvp.md)

> 2026-04-25 对齐：图片链路默认服务于 `html_formatter` / Html Editor 终点；`image_gallery` 为可选展示节点。

---

## 目标

完成公众号流程中的图片执行链路：
- 规划图片
- 生成图片
- 聚合展示
- 持久化与导出

当前主节点为 `image_list`（替代早期 `image_gen` 命名）。

---

## 实际交付（Rust 侧）

### 1. 执行入口接入

**文件**: `src-tauri/src/commands/execute/mod.rs`

- `image_planner` 路由到 `media::exec_image_planner`
- `image_gen | image_list` 统一路由到 `media::exec_image_gen`
- 保留 `image_gen` 兼容，主流程使用 `image_list`

### 2. 图片执行逻辑

**文件**: `src-tauri/src/commands/execute/media.rs`

关键能力：
- 支持从 `image_plans` 输入生成图片。
- 支持从 `text` 输入补全图片计划（兜底）。
- 多模型路由与统一输出格式。
- 结果包含可供前端动态端口消费的数据结构。

### 3. 资产写入与读取

- 生成结果写入本地文件与资产记录。
- 支持前端读取与后续编辑操作。
- 为 Image Editor 与下载能力提供基础数据。

---

## 实际交付（前端侧）

### 1. `image_list` 节点重构

**文件**: `frontend/src/nodes/ImageListNode.tsx`

能力落地：
- 双输入：`in(image_plans)` + `text`。
- 生成数量配置（`count`）与模型选择（`model`）。
- 动态输入口增减（受限上限）。
- 动态输出口（`image1...imageN` + 汇总口）。
- 运行进度展示和错误提示。
- 双击进入 Image Editor。

### 2. `image_gallery` 聚合

**文件**: `frontend/src/lib/executionEngine.ts`

- 聚合多个上游图片结果。
- 在节点内展示图片列表与基础交互。

### 3. 画布端口类型适配

**文件**: `frontend/src/canvas/Canvas.tsx`

- 对 `image_list` 的动态 handle 进行类型识别：
  - `img_in_*` 作为 `image_slot` 输入
  - `image*` 作为 `image_slot` 输出

---

## 与原计划差异

1. 原文档的 `image_gen` 已演进为 `image_list`（更符合节点职责）。
2. 原计划中的单路径图片生成改为双输入+动态端口模型。
3. 图片编辑能力在 Slice 11/22 中进一步扩展，已不是本 Slice 的附加需求。

---

## 验收清单

- [x] 图片计划输入可触发生成。
- [x] 文本输入兜底可触发生成。
- [x] `image_list` 动态端口可被后续节点消费。
- [x] `image_gallery` 可聚合并展示上游图片。
- [x] 资产可在应用重启后继续访问。

---

## 后续维护建议

- 新模型接入优先扩展 `modelDefs` + 后端 proxy，不改节点协议。
- 若增加“按段落位点精准挂图”，优先增强 `html_formatter` 的 slot 映射，不新增中间节点。
