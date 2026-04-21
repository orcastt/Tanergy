# Slice 3: Canvas Core（复用现有）

**优先级**: P0 | **难度**: 高 | **预计**: 4 天 | **状态**: ⬜ 未开始
**依赖**: Slice 2 | **返回索引**: [phase1-mvp.md](phase1-mvp.md)

---

## 目标

实现核心画布编辑器：React Flow 初始化、节点渲染、连线交互、节点选择面板、撤销/重做、保存流程。大部分代码从已有实现复用，仅保存路径从 HTTP API 改为 Tauri IPC。

> **注意**：现有 `frontend/src/` 中的 canvas 代码（Slice 2.5 和 Slice 3 已完成）可以直接迁入 Tauri 项目。核心改动仅在保存/加载逻辑。

---

## 前端步骤

### Step 1: DAG 工具函数（复用）

**文件**: `frontend/src/lib/dagUtils.ts`

直接复用现有实现，无需修改：
- `topologicalSort()` — Kahn 算法
- `getExecutionLayers()` — 返回可并发的二维数组
- `getNodeDependencies()` / `getNodeDependents()`
- `hasCycle()`

### Step 2: Canvas Store（复用 + 扩展 waiting）

**文件**: `frontend/src/store/canvasStore.ts`

复用现有实现，新增 Gate 相关字段：

```typescript
interface CanvasStore {
  // --- 现有（不变） ---
  nodes: Node[];
  edges: Edge[];
  selectedNodeIds: string[];
  nodeStatuses: Record<string, NodeStatus>;
  history: CanvasSnapshot[];
  historyIndex: number;

  // --- 新增：Gate 支持 ---
  waitingGates: string[];
  tempNodes: EphemeralNode[];

  // --- 现有操作（不变） ---
  addNode(node: Node): void;
  removeNode(id: string): void;
  updateNodeData(id: string, data: Partial<NodeData>): void;
  updateNodePosition(id: string, position: { x: number; y: number }): void;
  addEdge(edge: Edge): void;
  removeEdge(id: string): void;
  pushHistory(): void;
  undo(): void;
  redo(): void;
  setNodeStatus(nodeId: string, status: NodeStatus): void;
  setNodeResult(nodeId: string, result: unknown): void;
  setGraphFromJson(graphJson: { nodes: Node[]; edges: Edge[] }): void;
  getGraphJson(): { nodes: Node[]; edges: Edge[] };

  // --- 新增：Gate 操作 ---
  setWaitingGate(nodeId: string): void;
  // 设置节点 waiting 状态，加入 waitingGates

  resolveGate(nodeId: string, value: unknown): void;
  // 从 waitingGates 移除，记录选择值，移除 tempNodes

  addTempNode(node: EphemeralNode): void;
  removeTempNode(id: string): void;
}
```

### Step 3: 执行引擎（复用）

**文件**: `frontend/src/lib/executionEngine.ts`

复用现有 DAG 解析和调度逻辑。节点实际执行改为 Tauri IPC（Slice 6 完整实现，本 Slice 先占位）。

```typescript
// 现有逻辑（不变）：
// - getExecutionLayers() 拓扑分层
// - runAll() 逐层调度
// - stopAll() 停止

// 改动点（占位，Slice 6 实现）：
// - executeNode() 内部改为调用 invoke('execute_node', ...)
//   而非 HTTP POST /executions
// - 节点状态更新仍用 canvasStore.setNodeStatus()
```

### Step 4: NodeBase / PortDot / NodeTitle（复用）

**文件**: `frontend/src/nodes/base/NodeBase.tsx`
**文件**: `frontend/src/nodes/base/PortDot.tsx`
**文件**: `frontend/src/nodes/base/NodeTitle.tsx`

直接复用现有实现，样式规范不变（Cal.com 三层复合阴影）。

### Step 5: 节点定义（复用 + 确认）

**文件**: `frontend/src/nodes/nodeDefs.ts`

确认已有 11 个 MVP 节点定义正确：
- text_input, research, outline_generator, gate, writer, reviewer
- image_planner, image_gen, image_gallery
- html_formatter, preview_wechat

**文件**: `frontend/src/types/node.ts`

确认端口类型定义正确：
- text, research_result, outline_options, image, image_slot, structured

### Step 6: Canvas 主组件（复用）

**文件**: `frontend/src/canvas/Canvas.tsx`

直接复用，关键配置不变：
- React Flow + Background(dots) + Controls
- snapToGrid, 20px 网格
- onConnect 端口类型校验
- onPaneDoubleClick 打开 NodePicker

### Step 7: NodePicker / Toolbar / CanvasControls（复用）

**文件**: `frontend/src/canvas/NodePicker.tsx`
**文件**: `frontend/src/canvas/Toolbar.tsx`
**文件**: `frontend/src/canvas/CanvasControls.tsx`

直接复用。NodePicker 分类改为 MVP 11 节点：
- 输入: text_input
- AI: research, outline_generator, writer, reviewer, image_planner
- 交互: gate
- 图像: image_gen, image_gallery
- 输出: html_formatter, preview_wechat

### Step 8: useCanvas Hook（改动：保存路径）

**文件**: `frontend/src/hooks/useCanvas.ts`

改动点：
- Cmd/Ctrl+S → `workflowStore.saveWorkflow()` 调用 Tauri IPC（非 HTTP）
- 初始化：从路由取 workflow id → `invoke('get_workflow')` → `setGraphFromJson()`
- 关闭确认：窗口 beforeunload 保留（Tauri 也支持）

```typescript
// 改动前：await fetch('/api/v1/workflows/' + id)
// 改动后：await tauri.getWorkflow(id)
```

### Step 9: CanvasPage 页面

**文件**: `frontend/src/pages/CanvasPage.tsx`

```
布局（不变）:
  ┌──────────────────────────────────────────────┐
  │ TopBar (56px)                                │
  ├──────┬───────────────────────────────────────┤
  │ Tool │         Canvas (React Flow)            │
  │ bar  │         #f5f5f5 背景 + 点阵网格       │
  │ 48px │                                        │
  ├──────┴───────────────────────────────────────┤
  │ CanvasControls (左下)  执行状态  [Run All]    │
  └──────────────────────────────────────────────┘

TopBar:
  - [←] 返回 Dashboard
  - 工作流名称 (可编辑) + ● 未保存标记
  - [Skills] [保存] 按钮

新增：Run All 按钮
  - 调用 executionEngine.runAll()（Slice 6 完整实现执行逻辑）
  - running 时变为 "Stop All" 红色按钮
```

### Step 10: 保存逻辑（改动：Tauri IPC）

**文件**: `frontend/src/store/workflowStore.ts` — 修改 saveWorkflow

```typescript
// 改动前：
// const res = await axios.put(`/api/v1/workflows/${id}`, { graph_json: graphJson })

// 改动后：
async saveWorkflow() {
  const graphJson = canvasStore.getState().getGraphJson();
  const id = this.currentWorkflow?.id;
  if (!id) return;

  this.isSaving = true;
  try {
    await tauri.updateWorkflow(id, { graphJson: JSON.stringify(graphJson) });
    this.isDirty = false;
    toast.success("已保存");
  } catch (e) {
    toast.error("保存失败，请重试");
  } finally {
    this.isSaving = false;
  }
}
```

---

## 验收清单

- [ ] 画布打开显示 #f5f5f5 背景 + #d4d4d4 点阵网格
- [ ] 工作流数据正确加载（从 SQLite 经 Tauri IPC）
- [ ] 双击画布空白处打开 NodePicker，显示 MVP 11 节点
- [ ] NodePicker 搜索过滤和分类切换正常
- [ ] 点击节点在双击位置创建（snap to 20px grid）
- [ ] 节点渲染正确（白底 + 三层阴影 + Cal Sans 标题 + 彩色端口）
- [ ] 端口颜色按类型正确（蓝=text, 棕=research_result, 紫=outline_options, 绿=image, 黄=structured）
- [ ] 端口类型匹配校验正常，不匹配时红色高亮 + tooltip
- [ ] 拖拽节点 snap to 20px 网格
- [ ] Delete 键删除选中节点/边
- [ ] Cmd/Ctrl+Z 撤销，Cmd/Ctrl+Shift+Z 重做，最多 50 步
- [ ] Cmd/Ctrl+S 保存到本地 SQLite（<50ms），toast "已保存"
- [ ] 有未保存变更时顶栏显示 ● 标记
- [ ] 关闭有未保存变更时弹出确认
- [ ] NodePicker ESC 关闭
- [ ] 左侧工具栏按钮正常
- [ ] 所有文件 < 300 行

---

## 完成后更新

- [ ] 本文件状态 → ✅
- [ ] project_state.md → Slice 4
- [ ] phase1-mvp.md → Slice 3 ✅
- [ ] git commit: "Slice 3: canvas core (React Flow + Tauri IPC save)"
