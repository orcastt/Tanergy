# Image Node Import And Canvas Convert Slice — 2026-04-30

## Goal

补齐 S1.5 中 `canvas image -> Image Node`、`Image Node -> canvas image` 和 `Image Node 本地导图` 的最小闭环，并修复 Merge Capture / Screenshot 生成后节点内看不见图片的问题。

## Scope

- 选中画布上的 `image` shape 时，顶部 Selection Toolbar 显示 `Convert to Image Node`。
- `Convert to Image Node` 读取当前 canvas image 的 `assetId` 和尺寸信息，创建预览正常的 Image Node。
- Image Node 标题栏增加 `To Canvas` 按钮，把节点当前图片重新放回画布成为普通 `image` shape。
- Image Node 预览区渲染真实图片，而不是只显示标题占位。
- Image Node 预览区对横图和竖图都应完整可见，不再裁掉长边内容。
- Image Node 支持本地图片拖拽到预览区内导入。
- 双击 Image Node 预览区可打开本地文件选择器，把图片导入该节点。
- Image Node 内部图片不允许原生浏览器拖拽，避免在预览容器内拖图时报错。
- Screenshot / Convert to Image Node / To Canvas 这些按钮不应误触发浏览器文字全选或蓝色高亮选区。
- Screenshot / Merge Capture 产生的图片对象或 Image Node 必须能在节点内容区看到图。
- 即使有漏掉的 pointer/mouse 边缘手势，canvas shell 也应自动清理异常 document text selection，不影响正常输入框编辑。

## Non-goals

- 不接真实后端 `/assets/upload`。
- 不做持久化 Asset 服务端落盘。
- 不做 Image Editor 正式工具链。
- 不做完整 Screenshot / Merge 产品重构，只补最小可用闭环。

## Files / Modules

- `apps/web/src/components/canvas/CanvasSelectionToolbar.tsx`
- `apps/web/src/components/nodes/NodeCardPreviews.tsx`
- `apps/web/src/features/node-runtime/createNodeCard.ts`
- `apps/web/src/features/node-runtime/registry.ts`
- `apps/web/src/features/node-runtime/nodeDataFlow.ts`
- `apps/web/src/features/node-runtime/imageNodeAssets.ts`（new）
- `apps/web/src/app/styles/node-card-content.css`
- `project_state.md`

## Data Model Impact

- Image Node `data` 新增轻量图片引用字段，优先保存 `assetId`、标题、尺寸摘要。
- 不把 Base64 / `blob:` / `data:` 写进 node props；图片二进制或临时 URL 只留在 tldraw asset store。

## Security / Cost Impact

- 仍为本地 spike，不接服务端上传。
- 不引入新依赖，不触碰 `.env`。

## Acceptance

1. 选中单张或多张 canvas image 时，顶部 toolbar 出现 `Convert to Image Node`。
2. 点击后生成 Image Node，节点预览区能看到该图。
3. 双击 Image Node 预览区可选择本地图片并更新节点。
4. 把本地 PNG/JPEG/WebP 拖到 Image Node 预览区，节点能显示该图。
5. 点击 Image Node 标题栏 `To Canvas`，会在节点右侧生成普通 canvas image，并可直接继续拖动/标注。
6. Merge Capture / Screenshot 生成的节点不再是空白预览。

## Implemented

- Selection Toolbar 现在对单张 canvas image 也会出现，并新增 `Convert to Image Node` 按钮。
- `Convert to Image Node` 会复用当前 tldraw image asset，创建带真实预览的 Image Node。
- Image Node 标题栏新增 `To Canvas` 按钮，会复用当前节点的 tldraw image asset，在节点右侧重新创建普通 canvas image，并默认选中新图片。
- Screenshot / Merge Capture 仍走本地 spike 逻辑，但现在会先创建 tldraw image asset，再创建 Image Node，所以节点里能看到截图。
- Image Node 预览区已改为真实图片渲染；没有图片时仍保留轻量占位；有图时改为 `contain` 方式自适应显示，竖图不会再被横幅式裁切。
- Image Node 支持双击打开文件选择器，或把本地 PNG/JPEG/WebP 直接拖进预览区导入。
- Image Node 里的图片已禁用原生浏览器拖拽；在容器内部拖动图片不再报错，也不会打断节点交互。
- Selection Toolbar 和 Image Node 标题栏按钮现在会阻止浏览器默认文字选区，并在动作前后清理已有 text selection；页头与浮动 toolbar 也禁用文字选择，避免 Screenshot / Convert 后整页文案被蓝色高亮。
- `CanvasSpike` 额外监听 `selectionchange`：只要选区落在 canvas shell 且不在 `input / textarea / contenteditable` 内，就立即清掉异常 document selection，兜住零散误触路径。
- node props 仍只保存 `assetId`、标题和尺寸摘要；图片数据只留在 tldraw asset store，不写进 node props。

## Manual Test

1. 从浏览器复制一张图片到画布，点击图片，顶部 toolbar 应出现转换按钮。
2. 点击转换按钮，应创建带图片预览的 Image Node。
3. 双击 Image Node，选择本地图片，节点预览应更新。
4. 把本地图片拖进 Image Node 预览区，节点预览应更新。
5. 点击 Image Node 标题栏 `To Canvas`，应在节点右侧出现普通 canvas image，且图片已被选中。
6. 导入一张竖版图片到 Image Node，预览区应完整显示图片，不再被横向裁切。
7. 在 Image Node 预览容器内部拖动已显示的图片，不应触发浏览器原生拖图，也不应报错。
8. 点击 Screenshot / Convert to Image Node / To Canvas 后，页面标题和工具栏文案不应出现整段蓝色文字高亮。
9. 用 Screenshot / Merge Capture 产出图片后，再转成 Image Node，节点里应能看到图。

## Rollback Notes

- 如果本地 asset 导入影响现有端口/连线交互，先回退 `CanvasSelectionToolbar` 和 `NodeCardPreviews` 的导图入口，保留 runtime edge 修复不动。
