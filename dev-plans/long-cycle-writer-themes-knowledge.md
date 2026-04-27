# Long Cycle Plan — Writer · WeChat Themes · Library Knowledge Graph

**创建时间**: 2026-04-27  
**状态**: ✅ MVP 已实现，待人工手测验收  
**背景**: 用户希望在休息期间由 Codex 自主推进 1–2 小时开发，方向包括长文/小说 Writer 节点、公众号多配色模板、素材库标签系统与 Obsidian 式知识图谱。

---

## 目标

本轮做稳定 MVP，不改变公众号默认主流程：

1. **Writer 节点升级**：保留 `writer` 为高级/实验节点，用于长文/小说/书稿写作；执行后双击进入纯文本编辑器，右侧显示 PDF/书籍式排版预览。
2. **Html Editor 多主题**：在现有标准紫基础上增加蓝色、黑色、灰色、赭红等公众号样式，编辑器内可切换并同步复制输出。
3. **素材库 Graph**：基于已有素材标签系统，新增 Knowledge Graph 视图，展示素材、标签、类型之间的关系，支持点击标签筛选素材。

---

## 非目标

- 不把 `writer` 放回公众号默认链路；公众号主流程仍是 `outline_generator → Split → html_formatter`。
- 不做真实 PDF 导出；本轮只做书籍/PDF 风格预览。
- 不做复杂 Obsidian 双链编辑；本轮先用素材 tags 和 kind 建立图谱。
- 不新增后端服务依赖；素材 graph 优先前端从本地 library 数据推导。

---

## 实现步骤

- [x] 新增 `dev-plans/long-cycle-writer-themes-knowledge.md`
- [x] 增加公众号主题 registry 与 `toWechatStyledHtml`
- [x] Html Formatter 节点与 Html Editor Modal 接入主题选择
- [x] 新增 Writer Editor Modal + Book Preview
- [x] `writer` 注册进 Node Picker，并支持双击编辑
- [x] Workspace Library 增加 Graph 视图
- [x] Graph 支持 tag 点击筛选
- [x] 更新 `project_state.md` / `dev-plans/node-plan.md`
- [x] 运行 `npm -C frontend run build`、定向 ESLint、`git diff --check`

---

## 涉及文件索引

### 已新增

- `frontend/src/nodes/writer/WriterEditorModal.tsx`
- `frontend/src/nodes/writer/BookPreview.tsx`
- `frontend/src/pages/dashboard/LibraryKnowledgeGraph.tsx`
- `dev-plans/long-cycle-writer-themes-knowledge.md`

### 已修改

- `frontend/src/nodes/image/standardPurpleHtml.ts`
- `frontend/src/nodes/image/HtmlEditorModal.tsx`
- `frontend/src/nodes/image/WeChatPreview.tsx`
- `frontend/src/nodes/HtmlFormatterNode.tsx`
- `frontend/src/nodes/WriterNode.tsx`
- `frontend/src/nodes/nodeDefs.ts`
- `frontend/src/canvas/Canvas.tsx`
- `frontend/src/canvas/useCanvasKeyboardShortcuts.ts`
- `frontend/src/store/overlayStore.ts`
- `frontend/src/pages/dashboard/WorkspaceLibraryPanel.tsx`
- `frontend/src/i18n/locales/zh.json`
- `frontend/src/i18n/locales/en.json`
- `PRD.md`
- `ARCH.md`
- `project_state.md`
- `dev-plans/node-plan.md`

---

## 验收清单

- [x] `html_formatter` 节点可选择标准紫/蓝色/黑色/灰色/赭红。
- [x] Html Editor 内切换主题后右侧预览和复制 HTML 同步变化。
- [x] `writer` 可从 Node Picker 添加，接收 outline/research/materials 输入。
- [x] `writer` 执行完成后双击打开 Writer Editor。
- [x] Writer Editor 左侧可编辑纯文本，右侧显示书籍/PDF 风格分页预览。
- [x] Workspace Library 支持 Gallery/List/Graph 三种视图。
- [x] Graph 展示素材、标签和类型连接，点击标签能筛选素材。
- [x] 前端构建通过。

---

## 验证记录

- `npm -C frontend run build`：✅ 通过（Vite chunk size warning 为历史/体积提示，不阻断）
- 定向 ESLint：✅ 通过
- `git diff --check`：✅ 通过
- Rust/Tauri 未改动：本轮不需要 `cargo check`

---

## 后续建议

- Writer Editor 下一轮可补真实 PDF 导出、章节目录、章节重排和保存到素材库。
- Html 主题下一轮可做独立模板结构，而不仅是颜色映射。
- Knowledge Graph 下一轮可做力导向布局、节点详情面板、标签重命名/删除和双链关系编辑。

---

## 风险

- Writer 与 Html Editor 在定位上接近，必须保持差异：Writer 产出纯文本书稿，Html Editor 产出公众号 HTML。
- Knowledge Graph 如果素材数量很大，本轮静态 SVG 布局可能需要后续虚拟化/力导向布局优化。
- Html 多主题通过同一组件映射换色，复杂模板细节后续可再做独立模板。
