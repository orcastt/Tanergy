# TANGENT Frontend

React + TypeScript + Vite 前端，运行在 Tauri v2 桌面壳内。

## 当前状态

- React 19 + TypeScript 6 + Vite 8。
- React Flow v12 画布、Zustand v5 状态管理、i18next 中英切换。
- 公众号默认主流程终点是 `html_formatter` / Html Editor。
- `preview_wechat` 是历史/legacy 预览能力，不进入默认模板。

## 本地开发

```bash
cd frontend
npm install
npm run dev
```

桌面开发通常从仓库根目录启动：

```bash
cargo tauri dev
```

## 构建验证

```bash
npm -C frontend run build
```

2026-04-25 已验证通过。

## Html Editor 文件索引

| 文件 | 说明 |
|------|------|
| `src/nodes/HtmlFormatterNode.tsx` | Html Formatter 终点节点，done 状态双击进入编辑器 |
| `src/nodes/image/HtmlEditorModal.tsx` | 全屏双栏编辑器壳，负责保存闭环 |
| `src/nodes/image/TiptapEditor.tsx` | Tiptap 富文本编辑器 |
| `src/nodes/image/WeChatPreview.tsx` | 微信样式实时预览 |
| `src/nodes/image/HtmlRewritePopup.tsx` | AI 改写弹窗 |
| `src/store/overlayStore.ts` | `htmlEditorNodeId` overlay 状态 |
