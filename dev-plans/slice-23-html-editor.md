# Slice 23 — Html Editor: Notion 风格富文本编辑器

**版本**: v1.0
**日期**: 2026-04-25
**状态**: ✅ 初版已开发，构建通过；待手测验收

## 概述

将 Html Formatter 节点升级为全功能的 Html Editor，支持 Notion 风格的双栏编辑体验：
- 左侧：富文本编辑器（@tiptap）+ 工具栏 + 浮动格式化工具栏
- 右侧：WeChat HTML 实时预览（手机模拟框）
- AI 改写：选中文字 → @AI 弹出框 → 改写选定段落，插入下方

---

## 当前代码真相

- `html_formatter` 是公众号主流程终点。
- 节点执行完成后，done 状态双击打开 Html Editor。
- Html Editor 左侧为 Tiptap 富文本编辑，右侧为微信手机样式实时预览。
- 编辑内容实时写回 `nodeResults`，关闭时写入节点 `data.editedHtml`。
- `preview_wechat` 已降为 legacy，不再作为默认链路的一环。

---

## 依赖

- npm: `@tiptap/core @tiptap/react @tiptap/starter-kit @tiptap/extension-underline @tiptap/extension-link @tiptap/extension-placeholder @tiptap/pm`

---

## 实现步骤

### Step 1 — 安装 Tiptap 依赖 ✅

### Step 2 — overlayStore 加 `htmlEditorNodeId` + `openHtmlEditor` / `closeHtmlEditor` ✅

### Step 3 — 新建 `HtmlEditorModal` ✅

全屏 Modal，读取 `nodeResults[nodeId].html`，双栏布局：编辑器 + 预览

### Step 4 — 新建 `TiptapEditor` ✅

@tiptap/react 编辑器，固定工具栏 + 浮动格式化工具栏（跟随选区）

### Step 5 — 新建 `WeChatPreview` ✅

复用 PreviewWechatNode 手机模拟框风格

### Step 6 — 新建 `HtmlRewritePopup` ✅

复用 AiEditPopup 模式，调用 Rust `ai_rewrite_html` 命令

### Step 7 — Rust `ai_rewrite_html` 命令 ✅

### Step 8 — HtmlFormatterNode 双击打开 Modal + nodeDefs label 更新 ✅

### Step 9 — OverlayLayer 加 HtmlEditorModal 渲染 ✅

### Step 10 — 构建与保存闭环 ✅

- 修复 TypeScript 构建阻断。
- `npm -C frontend run build` 已通过。
- 编辑内容关闭后重开不丢（同一工作流会话内）。

---

## 涉及文件

| 文件 |
|------|
| `frontend/package.json` |
| `frontend/src/store/overlayStore.ts` |
| `frontend/src/nodes/image/HtmlEditorModal.tsx` |
| `frontend/src/nodes/image/TiptapEditor.tsx` |
| `frontend/src/nodes/image/HtmlRewritePopup.tsx` |
| `frontend/src/nodes/image/WeChatPreview.tsx` |
| `frontend/src/canvas/OverlayLayer.tsx` |
| `frontend/src/nodes/HtmlFormatterNode.tsx` |
| `frontend/src/nodes/nodeDefs.ts` |
| `src-tauri/src/commands/asset.rs` |

---

## 待验收

- [ ] 手测双击 `html_formatter` done 状态打开 Html Editor。
- [ ] 手测编辑后右侧微信预览实时更新。
- [ ] 手测关闭后重新打开，编辑内容仍保留。
- [ ] 手测 AI 改写结果插入文章。
