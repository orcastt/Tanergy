# Slice 10: Canvas Interaction Enhancements

**优先级**: P0 | **难度**: 高 | **预计**: 3 天 | **状态**: 🔨 部分完成（Step 1-4 已完成，Step 5 打组待开发）
**依赖**: Slice 3 | **返回索引**: [phase1-mvp.md](phase1-mvp.md)

---

## 目标

增强画布交互体验：节点分类颜色、端口提示、复制粘贴、删除、右键菜单、打组功能。

---

## Step 1: 节点分类颜色边框

**文件**: `frontend/src/nodes/base/NodeBase.tsx`

- 每个节点的左侧加 3px 彩色边框，按 category 区分颜色
- 颜色映射:
  - `input` → `#3B82F6` (蓝)
  - `text` → `#92400E` (棕)
  - `ai` → `#6349EA` (紫)
  - `image` → `#22C55E` (绿)
  - `output` → `#EAB308` (黄)
- NodeBase 增加 `category` 可选 prop
- 各节点组件从 `NODE_MAP` 取 category 传入

---

## Step 2: 端口 Hover 提示

**文件**: `frontend/src/nodes/base/NodeBase.tsx`

- 每个 Handle 外包裹一个带 `title` 属性的 div
- 鼠标悬停显示端口数据类型（英文），如 "text", "image_plans", "image_slot"
- 用原生 `title` tooltip 即可，无需额外库

---

## Step 3: 复制粘贴删除

**文件**: `frontend/src/store/canvasStore.ts`, `frontend/src/canvas/Canvas.tsx`

### canvasStore 新增:

```typescript
clipboard: { nodes: any[], edges: any[] } | null

copySelected()      // 复制选中节点 + 它们之间的连线
pasteNodes()        // 粘贴，偏移 +40,+40，保留所有 node data/results
deleteSelected()    // 删除选中节点 + 连接的边
duplicateNode(id)   // Alt+Click 复制单个节点
```

### Canvas.tsx 键盘事件:

| 快捷键 | 动作 |
|--------|------|
| Ctrl+C | 复制选中 |
| Ctrl+V | 粘贴 |
| Delete / Backspace | 删除选中 |
| Alt+Click 节点 | 复制该节点 |

---

## Step 4: 右键上下文菜单

**新文件**: `frontend/src/canvas/ContextMenu.tsx`

- 右键节点: 显示 Copy / Paste / Delete / Group 选项
- 右键画布空白: 显示 Paste / Select All 选项
- 点击外部或 ESC 关闭
- 用 `onNodeContextMenu` 和 `onPaneContextMenu` 事件

**文件**: `frontend/src/canvas/Canvas.tsx` — 添加右键事件处理

---

## Step 5: 打组功能

**文件**: `frontend/src/store/canvasStore.ts`, **新文件**: `frontend/src/nodes/GroupNode.tsx`

### 使用 React Flow 的 parent/child 节点系统:

- `groupSelected()` — 选中多个节点 → 创建 Group 父节点，选中节点变为子节点
- `ungroupSelected()` — 拆组，子节点恢复为独立节点

### GroupNode 组件:

- 渲染为带圆角的半透明彩色背景框
- 顶部: 可编辑的组名（双击编辑）
- 颜色圆点: 点击弹出 8 色选择器
- 快捷键 `G` 打组

### 预设颜色:

```
#6349EA, #3B82F6, #22C55E, #EAB308, #EF4444, #EC4899, #14B8A6, #8B5CF6
```

---

## 验收清单

- [x] 节点左侧显示分类颜色边框
- [x] 鼠标悬停端口显示数据类型 tooltip
- [x] Ctrl+C / Ctrl+V 复制粘贴节点（保留数据和状态）
- [x] Alt+Click 复制单个节点
- [x] Delete 键删除选中节点
- [x] 右键节点弹出上下文菜单（Copy / Paste / Delete）
- [x] 右键空白处弹出菜单（Paste）
- [ ] 选中多个节点按 G 打组
- [ ] 组可以修改名字
- [ ] 组可以更改颜色
- [x] 点击空白处关闭 NodePicker（已有）

---

## 完成后更新

- [ ] 本文件状态 → ✅
- [ ] project_state.md
- [ ] git commit
