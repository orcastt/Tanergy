# Slice 12: UI Polish & Bug Fixes

## 概述

8 项 UI 问题修复，4 项已完成，4 项待实现。同步清理无效文件。

## 已完成

1. ✅ **节点清除按钮** — `NodeRunButton.tsx` 增加 reset 按钮 (done/error → idle)
2. ✅ **选中蓝色高亮** — `NodeBase.tsx` selected ringStyle 改为 `#3B82F6`
3. ✅ **左键取消右键菜单** — `Canvas.tsx` handlePaneClick 已有 `if (ctxMenu) setCtxMenu(null)`
4. ✅ **端口 Hover 提示** — `NodeBase.tsx` input handle title 改为 `${label}: ${type}`

## 待实现

### Fix 1: Image Editor 全屏化

**文件**: `frontend/src/nodes/image/ImageEditorModal.tsx`

- 移除固定 900x600 尺寸 → 100vw × 100vh
- 关闭按钮改为左上角 `arrow_back` 图标
- 左面板宽度 160px → 200px

### Fix 2: Text 节点缩放修复

**文件**: `frontend/src/nodes/TextInputNode.tsx`

- `onUp` 闭包捕获了过时的 `size` state
- 修复: 用 `sizeRef` 同步最新尺寸，`onUp` 读 `sizeRef.current`

### Fix 3: 框选多选

**文件**: `frontend/src/canvas/Canvas.tsx`

- `SelectionMode` 已导入但未应用到 `<ReactFlow>`
- 添加 `selectionMode={SelectionMode.Partial}` + `selectionOnDrag`

### Fix 4: Alt/Option+拖动复制

**文件**: `frontend/src/canvas/Canvas.tsx`

- 当前只有 alt+click，用户期望 alt+drag
- 用 `onNodeDragStart` 记录原始位置 + `onNodeDragStop` 执行复制并恢复原位

## 清理文件

- 删除 `frontend/src/nodes/PlaceholderNode.tsx` (无引用)
- 删除 `frontend/src/nodes/base/PortDot.tsx` (无引用)

## 验证

- [ ] 图片编辑器全屏显示，左上角返回按钮
- [ ] Text 节点拖拽四角可实际缩放且持久化
- [ ] 空白处拖拽出现框选框，部分重叠节点被选中
- [ ] Alt+拖动节点产生副本，原节点回到起始位置
- [ ] 所有文件 < 300 行
- [ ] 无孤立/无效文件
