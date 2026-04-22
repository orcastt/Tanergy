# Plan: Canvas UI 层统一重构 — "画布归画布，UI 归 UI"

## Context

React Flow v12 会劫持 DOM：所有节点在 CSS transform 容器内，`position: fixed` 失效，事件被拦截。当前代码用 `createPortal` + `stopImmediatePropagation` 散落在各处"打补丁"，导致每次加功能都冲突。需要建立"二元化"架构：画布层只管节点渲染，覆盖层统一管理所有浮层 UI。

## 扫描报告

### Portal 使用 (3处)
| 文件 | 目标 | 用途 |
|---|---|---|
| `canvas/Toolbar.tsx:20` | document.body | 左侧工具栏 |
| `agent/AgentPanel.tsx:9` | document.body | 右侧AI面板 |
| `nodes/image/ImageEditorModal.tsx:31` | document.body | 全屏图片编辑器 |

### position: fixed 但**没有** portal (2处 — BUG)
| 文件 | 问题 |
|---|---|
| `nodes/ImageGalleryNode.tsx:91` | lightbox 用 `position: fixed, zIndex: 9999` 但在节点内，受 transform 影响 |
| `canvas/ContextMenu.tsx:27,34` | overlay + menu 用 `position: fixed` 但在 Canvas div 内 |

### stopPropagation 滥用 (11处 in canvas-related)
| 文件 | 行 | 原因 |
|---|---|---|
| `NodeRunButton.tsx` | 17,41,66 | 防止按钮点击触发节点选中 |
| `TextInputNode.tsx` | 35,37 | resize handle 防止触发节点拖拽 |
| `GroupNode.tsx` | 50,79,88 | 颜色选择器、标签编辑防止冒泡 |
| `ImageGalleryNode.tsx` | 96 | lightbox 内部点击防止关闭 |
| `AiEditPopup.tsx` | 19 | popup 内部防止冒泡 |
| `ContextMenu.tsx` | 50 | 菜单项点击防止冒泡 |

---

## 架构设计

### 组件树变化

**Before:**
```
document.body
  Canvas > div[relative]
    ReactFlow + Background
    Toolbar (自己 createPortal → body)
    CanvasControls (absolute, z:20)
    AgentPanel (自己 createPortal → body)
    NodePicker (absolute, z:100)
    ContextMenu (fixed, z:9999, 没portal — BUG)
```

**After:**
```
document.body
  CanvasPage
    Canvas > div[relative]
      ReactFlow + Background           ← 干净，只有画布
    OverlayLayer (一个 createPortal → body)
      Toolbar                          ← 不再自己 portal
      CanvasControls                   ← fixed
      AgentPanel                       ← 不再自己 portal
      NodePicker                       ← fixed, 屏幕坐标
      ContextMenu                      ← fixed, 正确工作
```

节点内的浮层 (ImageEditorModal, ImageGallery lightbox) 也统一走 OverlayLayer。

---

## 新文件

### 1. `frontend/src/canvas/OverlayLayer.tsx` (~30行)
- 一个 `createPortal(children, document.body)` 包裹器
- 外层 div: `pointerEvents: "none"`（不挡画布点击）
- 导出 `Z` 常量统一管理 z-index

### 2. `frontend/src/store/overlayStore.ts` (~40行)
Zustand store，管理覆盖层状态（代替 DOM 事件冒泡通信）：
```ts
{
  // NodePicker
  pickerOpen: boolean
  pickerScreenPos: { x: number; y: number } | null

  // ContextMenu
  ctxMenu: { x: number; y: number; nodeId?: string } | null

  // ImageEditor
  editorNodeId: string | null

  // Lightbox
  lightboxImage: { filePath: string; description: string } | null

  // Actions
  openPicker, closePicker
  openCtxMenu, closeCtxMenu
  openEditor, closeEditor
  openLightbox, closeLightbox
}
```

### 3. `frontend/src/lib/nodeEvents.ts` (~25行)
统一节点内事件处理：
```ts
export function nodeAction(e: React.MouseEvent) { e.stopPropagation() }
export function nodeResize(e: React.PointerEvent) { e.preventDefault(); e.stopPropagation(); e.nativeEvent.stopImmediatePropagation() }
```

---

## 现有文件修改

### Z-Index 统一常量
```ts
export const Z = {
  CONTROLS: 20,       // CanvasControls
  TOOLBAR: 100,       // 左侧工具栏
  PICKER: 110,        // NodePicker
  AGENT_PANEL: 150,   // Agent 面板
  AGENT_TOGGLE: 200,  // Agent 开关按钮
  CTX_OVERLAY: 300,   // 右键菜单背景
  CTX_MENU: 310,      // 右键菜单
  FULLSCREEN: 400,    // 全屏编辑器、Lightbox
} as const
```

### `Canvas.tsx` (273→~260行)
- 移除所有 overlay UI（Toolbar, CanvasControls, AgentPanel, NodePicker, ContextMenu）
- pickerPos/ctxMenu state 移到 overlayStore
- JSX 只剩 `<ReactFlow>` + `<OverlayLayer>` 包裹的 overlay 组件
- handlePaneClick 里的双击检测改为写 overlayStore
- handleNodeSelect 里做 screenToFlow 坐标转换

### `Toolbar.tsx` (70→~68行)
- 删除 `createPortal` 包裹，直接 return div
- 加 `pointerEvents: "auto"`
- z-index 用 `Z.TOOLBAR`

### `AgentPanel.tsx` (74→~72行)
- 删除 `createPortal` 包裹，直接 return fragment
- 加 `pointerEvents: "auto"`
- z-index 用 `Z.AGENT_TOGGLE` / `Z.AGENT_PANEL`

### `CanvasControls.tsx` (43→~45行)
- `position: absolute` → `position: fixed`
- 加 `pointerEvents: "auto"`
- z-index 用 `Z.CONTROLS`

### `ContextMenu.tsx` (80行不变)
- 加 `pointerEvents: "auto"`
- z-index 用 `Z.CTX_OVERLAY` / `Z.CTX_MENU`

### `NodePicker.tsx` (150→~148行)
- `position: absolute` → `position: fixed`
- 坐标改为屏幕坐标（不再需要 flow 坐标）
- 加 `pointerEvents: "auto"`
- z-index 用 `Z.PICKER`
- onSelect 回调不再传 position，由 Canvas 在 addNode 时转换坐标

### `ImageEditorModal.tsx` (73→~70行)
- 删除自己的 `createPortal`，改用 OverlayLayer
- z-index 用 `Z.FULLSCREEN`

### `ImageGalleryNode.tsx` (202→~180行)
- Lightbox 拆出：点击图片 → `overlayStore.openLightbox(img)`
- Lightbox 渲染移到 OverlayLayer
- 节点本身只显示缩略图网格

### `NodeRunButton.tsx` (83→~78行)
- `e.stopPropagation()` → `nodeAction(e)`

### `TextInputNode.tsx` (131→~125行)
- resize handle 事件处理 → `nodeResize(e)`

### `GroupNode.tsx` (~96→~90行)
- 3处 `e.stopPropagation()` → `nodeAction(e)`

### `AiEditPopup.tsx` (~51→~48行)
- `e.stopPropagation()` → `nodeAction(e)`

### `DrawingCanvas.tsx` (~113→~110行)
- `e.preventDefault()` → 保留（这是 drawing 需要，不是补丁）

---

## 实施顺序（每步可独立验证）

1. **创建 overlayStore.ts** — 新文件，零风险
2. **创建 nodeEvents.ts** — 新文件，零风险
3. **创建 OverlayLayer.tsx + Z 常量** — 新文件，零风险
4. **改造 Canvas.tsx** — 移 overlay state 到 store，JSX 重组
5. **改造 Toolbar/AgentPanel** — 删各自 createPortal
6. **改造 CanvasControls/ContextMenu/NodePicker** — 改 fixed + pointerEvents
7. **修复 ImageGalleryNode lightbox** — 从节点内移到 overlayStore
8. **修复 ImageEditorModal** — 删自己 createPortal，走 OverlayLayer
9. **应用 nodeEvents helpers** — NodeRunButton, TextInputNode, GroupNode, AiEditPopup
10. **统一 z-index** — 所有文件换用 Z 常量

## 验证
- 编译：`npx tsc --noEmit` + `npx vite build` 零错误
- 功能：工具栏、Agent面板、右键菜单、双击添加节点、框选、Alt+拖拽复制、图片编辑器、Lightbox 全部正常
- 视觉：无变化
