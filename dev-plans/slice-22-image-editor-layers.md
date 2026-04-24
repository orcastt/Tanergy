# Slice 22: Image Editor 图层画板 (Procreate 风格)

> 状态: ✅ 已完成
> 优先级: P1
> 前置: Image List 节点完成
> 实际耗时: 1 天

---

## 目标

将 Image Editor 从简单涂鸦工具改造为 Procreate 风格的图层画板：
- 图片 contain 渲染（不拉伸不同比例的图）
- 图层系统（半透明、隐藏、锁定、删除、复制、新建、导出）
- 从左侧图片列表拖入图片到画板图层
- 在图层上画画
- 栅格化（合并所有图层）
- 导出结果回 Image List output slots

## 详细设计

见 [plan 文件](../.claude/plans/mvp-proud-toucan.md)

## 交付文件

| 文件 | 说明 |
|------|------|
| `nodes/image/layerStore.ts` | Zustand 图层状态（Layer CRUD、绘画、拖拽/缩放、栅格化、网格吸附） |
| `nodes/image/LayerCanvas.tsx` | 主画板 canvas（多层合成渲染 + 绘画 + 选择工具 + 拖放接收） |
| `nodes/image/SourcePanel.tsx` | 左侧源图片列表（click-to-add + drag cache key） |
| `nodes/image/LayerPanel.tsx` | 右侧图层面板（列表 + 操作按钮 + opacity 滑条 + 导出） |
| `nodes/image/Toolbar.tsx` | 工具栏（选择/画笔 + 颜色 + 笔宽 + 橡皮 + 网格 + AI Edit） |
| `nodes/image/AiEditPopup.tsx` | AI 编辑弹窗（状态机 + 进度条 + 截图 → 生成） |
| `nodes/image/ImageEditorModal.tsx` | 全屏 Modal 壳（三栏布局 + 导出 + AI popup） |

## Rust 侧新增

| 命令 | 文件 | 说明 |
|------|------|------|
| `save_canvas_export` | `commands/asset.rs` | Canvas base64 → 写文件 → 入 DB |
| `ai_edit_image` | `commands/asset.rs` | 截图 + 指令 → AI 图片生成 |
| `ai_edit_image()` | `services/ai_client.rs` | 文本模型增强 prompt → 图片生成 |

## 已知问题 / 后续

- 旧文件保留但已弃用: DrawingCanvas.tsx, DrawingPanel.tsx, ImageEditorPanel.tsx, drawingStore.ts
- 未来可考虑: 图层拖拽排序、图层混合模式、文字图层、形状工具
