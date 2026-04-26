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

2026-04-26 已验证通过。

## 开发规范

完整规范见 `../dev-plans/code-quality-standards.md`。

本项目当前策略：

- 前端改动必须跑 `npm -C frontend run build`。
- 触碰文件必须从 `frontend/` 目录跑定向 lint：`npx eslint src/path/file.tsx`。
- 全量 `npm -C frontend run lint` 仍有历史债，不作为每次提交阻断；但不允许新增触碰文件 lint 问题。
- React 组件不要在 Hook 之前 early return，不要在 `useEffect` 里同步做 prop → state 镜像。
- React Flow 相关代码优先使用 `Node`、`Edge`、`Connection`、`NodeMouseHandler`、`OnNodeDrag`、`NodeTypes` 等官方类型，禁止新增 `any`。

## Html Editor 文件索引

| 文件 | 说明 |
|------|------|
| `src/nodes/HtmlFormatterNode.tsx` | Html Formatter 终点节点，done 状态双击进入编辑器 |
| `src/nodes/image/HtmlEditorModal.tsx` | 全屏双栏编辑器壳，负责保存闭环 |
| `src/nodes/image/TiptapEditor.tsx` | Tiptap 富文本编辑器 |
| `src/nodes/image/WeChatPreview.tsx` | 微信样式实时预览 |
| `src/nodes/image/HtmlRewritePopup.tsx` | AI 改写弹窗 |
| `src/store/overlayStore.ts` | `htmlEditorNodeId` overlay 状态 |

## Personal Library 文件索引

| 文件 | 说明 |
|------|------|
| `src/library/LibraryDrawer.tsx` | 工作流左侧全局素材库侧拉面板 |
| `src/library/LibrarySaveDialog.tsx` | 保存文章/图片素材与标签弹窗 |
| `src/library/LibraryCard.tsx` | 素材卡片展示、拖拽、删除 |
| `src/store/libraryStore.ts` | 素材库列表、标签与创建/删除状态 |
| `src/nodes/ImageAssetNode.tsx` | 图片素材容器节点，可缩放并进入 Image Editor |
