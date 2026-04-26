# Personal Library Plan

## Summary
- 新增全局个人素材库，独立于单个 workflow，所有工作流共享。
- 素材分为文章组和图片组，支持标签、搜索、保存、删除和拖拽到画布。
- Text 素材拖入画布生成 `text_input`；Image 素材拖入画布生成 `image_asset`。
- Image Editor 增加导出到素材库入口，并补齐基础 copy / paste / save / download。

## Scope
- 数据层：SQLite `library_items`、`library_tags`、`library_item_tags`。
- 后端：Tauri commands 管理素材、标签和图片文件保存。
- 前端：左侧素材库 Drawer、保存弹窗、拖拽创建节点。
- 节点：新增 `image_asset` 图片容器节点，可缩放，可打开 Image Editor。

## Workflow
1. 用户在任意 workflow 中打开左侧素材库。
2. Text 节点可保存当前文字到文章组，并添加/创建标签。
3. Image Editor 可将当前画布导出到图片组，并添加/创建标签。
4. 文章素材拖到画布生成 `text_input`。
5. 图片素材拖到画布生成 `image_asset`，双击/点击可进入 Image Editor。

## Implementation Checklist
- [x] 新增素材库计划文档。
- [x] 新增 SQLite migration。
- [x] 新增 Tauri library commands。
- [x] 新增前端 library service/store。
- [x] 新增左侧 Library Drawer。
- [x] Text 节点保存到素材库。
- [x] Image Editor 保存到素材库。
- [x] 拖拽素材到画布生成节点。
- [x] 新增 `image_asset` 容器节点。
- [x] 基础验收和主文档更新。

## Code Acceptance

> 以下为代码路径与构建验收；真实桌面 UI 手测仍需在 Tauri 应用中完成。

- [x] 新 workflow 能看到同一批素材。
- [x] 文章/图片素材支持标签保存和搜索。
- [x] Text 素材拖到画布生成 `text_input`。
- [x] Image 素材拖到画布生成 `image_asset`。
- [x] `image_asset` 可缩放并打开 Image Editor。
- [x] Image Editor 可导出到素材库。
- [x] 定向 lint、frontend build、cargo check 通过。
- [x] 新增代码文件尽量控制在 300 行以内。

## Manual QA Checklist

- [ ] 打开任意 workflow，展开左侧素材库，切换文章组/图片组。
- [ ] 从 Text 节点保存文字素材，新增标签后可搜索/筛选。
- [ ] 从 Image Editor 导出图片到素材库，重开 workflow 后仍可见。
- [ ] 拖拽文章素材到画布生成 `text_input`，内容正确带入。
- [ ] 拖拽图片素材到画布生成 `image_asset`，缩放后双击可打开 Image Editor。
- [ ] Image Editor 的 copy / paste / save / download 在真实桌面环境可用。

## Validation Log

- `cd frontend && npx eslint <touched-files>` ✅
- `npm -C frontend run build` ✅
- `cargo check`（`src-tauri`）✅
- `git diff --check` ✅
- `frontend/src` + `src-tauri/src` 源码文件行数检查 ✅，最大文件 300 行。

## Implementation Index
- `src-tauri/migrations/005_library.sql`：全局素材库表结构。
- `src-tauri/src/commands/library.rs`：素材列表、标签、创建、删除命令。
- `frontend/src/library/LibraryDrawer.tsx`：工作流左侧素材库侧拉面板。
- `frontend/src/library/LibrarySaveDialog.tsx`：保存素材和标签弹窗。
- `frontend/src/nodes/ImageAssetNode.tsx`：可缩放图片容器节点。
- `frontend/src/store/libraryStore.ts`：素材库前端状态。
- `frontend/src/library/libraryDrag.ts`：素材拖拽协议。
- `frontend/src/nodes/image/layerCanvasHelpers.ts`：LayerCanvas 命中测试与图片加载辅助。
