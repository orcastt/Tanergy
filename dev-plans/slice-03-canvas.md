# Slice 3: Canvas Core

**优先级**: P0 | **难度**: 高 | **预计**: 4 天 | **状态**: ⬜ 未开始
**依赖**: Slice 2 | **返回索引**: [phase1-mvp.md](phase1-mvp.md)

---

## 目标

实现核心画布编辑器：React Flow 初始化、节点渲染、连线交互、节点选择面板、撤销/重做、保存流程、离开确认。这是整个产品最复杂的 slice。

---

## 前端步骤

### Step 1: DAG 工具函数

**文件**: `frontend/src/lib/dagUtils.ts`

```
topologicalSort(nodes: Node[], edges: Edge[]): string[]:
  - Kahn 算法实现 DAG 拓扑排序
  - 返回 node_id 有序数组
  - 检测环 → 抛出错误

getExecutionLayers(nodes: Node[], edges: Edge[]): string[][]:
  - 返回二维数组，每层是可并发的 node_id 列表
  - 层 0: 无入边的节点
  - 层 n: 依赖层 0..n-1 全部完成的节点

getNodeDependencies(nodeId: string, edges: Edge[]): string[]:
  - 返回给定节点的所有上游 node_id

getNodeDependents(nodeId: string, edges: Edge[]): string[]:
  - 返回给定节点的所有下游 node_id

hasCycle(nodes: Node[], edges: Edge[]): boolean:
  - DFS 检测环
```

### Step 2: Canvas Store（核心状态管理）

**文件**: `frontend/src/store/canvasStore.ts`

```
接口 CanvasSnapshot:
  nodes: Node[]
  edges: Edge[]

接口 NodeStatus:
  [nodeId: string]: 'idle' | 'running' | 'success' | 'failed'

接口 CanvasStore:
  // --- 数据 ---
  nodes: Node[]
  edges: Edge[]
  selectedNodeIds: string[]
  nodeStatuses: NodeStatus
  nodeResults: Record<string, any>

  // --- 历史 ---
  history: CanvasSnapshot[]
  historyIndex: number
  maxHistory: 50

  // --- 节点操作 ---
  addNode(node: Node): void
    - 添加节点到 nodes
    - pushHistory()
    - 标记 workflowStore.markDirty()

  removeNode(id: string): void
    - 移除节点 + 关联 edges
    - pushHistory()
    - markDirty()

  updateNodeData(id: string, data: Partial<NodeData>): void
    - 合并更新 node.data
    - pushHistory()
    - markDirty()

  updateNodePosition(id: string, position: { x: number, y: number }): void
    - 更新 node.position
    - 不 pushHistory (拖拽中频繁调用)
    - markDirty()

  // --- 边操作 ---
  addEdge(edge: Edge): void
    - 校验：源端口和目标端口类型是否一致
    - 校验：目标端口是否已有连线（一个输入只接一条）
    - pushHistory()
    - markDirty()

  removeEdge(id: string): void
    - 移除边
    - pushHistory()
    - markDirty()

  // --- 历史 ---
  pushHistory(): void
    - 截断 historyIndex 之后的记录
    - push 当前 snapshot
    - 超过 maxHistory 删除最早的

  undo(): void
    - historyIndex > 0 时回退
    - 恢复 nodes 和 edges
    - markDirty()

  redo(): void
    - historyIndex < length - 1 时前进
    - 恢复 nodes 和 edges
    - markDirty()

  canUndo: boolean (getter)
  canRedo: boolean (getter)

  // --- 状态 ---
  setNodeStatus(nodeId: string, status: 'idle' | 'running' | 'success' | 'failed'): void
  setNodeResult(nodeId: string, result: any): void

  // --- 批量 ---
  setGraphFromJson(graphJson: { nodes: Node[], edges: Edge[] }): void
    - 从 workflowStore.currentWorkflow.graphJson 加载
    - 清空 history
    - historyIndex = -1

  getGraphJson(): { nodes: Node[], edges: Edge[] }
    - 序列化当前画布状态，用于保存
```

### Step 3: NodeBase 组件

**文件**: `frontend/src/nodes/base/NodeBase.tsx`

```
Props:
  title: string
  icon?: ReactNode
  inputs: PortDef[]    // [{ id, type, label? }]
  outputs: PortDef[]   // [{ id, type, label? }]
  status?: 'idle' | 'running' | 'success' | 'failed'
  children: ReactNode  // 节点内容区

布局 (宽度固定 280px, 20px 倍数):
  ┌─────────────────────────────────┐
  │ [icon] 标题 (Cal Sans 16px 600) │  ← 标题栏 40px
  │                         [Run ▶] │     Run: #242424 药丸 9999px
  ├─────────────────────────────────┤
  │ 配置/内容区 (children)          │  ← Inter 14px
  ├─────────────────────────────────┤  ← 仅图像类节点
  │ 预览/结果区                     │
  └─────────────────────────────────┘

Handle 定位:
  - 左侧 inputs: Handle type="target", position=Left
  - 右侧 outputs: Handle type="source", position=Right
  - 垂直均分排列

样式:
  - 白底 #ffffff
  - 默认: ring shadow rgba(34,42,53,0.08) 0 0 0 1px
         + 接触阴影 rgba(19,19,22,0.7) 0 1px 5px -4px
         + 漫射 rgba(34,42,53,0.05) 0 4px 8px
  - Hover: 漫射加深
  - 选中: ring 0 0 0 2px #6366F1
  - 运行: ring 0 0 0 2px #3B82F6 + 蓝色漫射 (pulse 动画)
  - 成功: ring 0 0 0 2px #22C55E (2 秒后恢复)
  - 失败: ring 0 0 0 2px #EF4444 + 红色漫射
```

### Step 4: PortDot 组件

**文件**: `frontend/src/nodes/base/PortDot.tsx`

```
Props:
  type: PortType  // 'prompt' | 'image' | 'text' | 'video' | 'search_result' | 'structured' | 'audio'
  isConnecting: boolean
  isValidConnection: boolean | null

颜色映射:
  prompt       → #8B5CF6 (紫色)
  image        → #22C55E (绿色)
  text         → #3B82F6 (蓝色)
  video        → #F97316 (橙色)
  search_result→ #EF4444 (红色)
  structured   → #EAB308 (黄色)
  audio        → #9CA3AF (灰色)

样式:
  - 12px 实心圆
  - Hover: 16px, transition 150ms
  - 可连接: box-shadow 0 0 0 3px rgba(34,197,94,0.3)
  - 不可连接: opacity 0.4 + cursor not-allowed
```

### Step 5: NodeTitle 组件

**文件**: `frontend/src/nodes/base/NodeTitle.tsx`

```
Props:
  icon?: ReactNode
  title: string
  status?: NodeStatus

渲染:
  - icon (如有) + 标题文字
  - Cal Sans 16px weight 600, letterSpacing 0px
  - 状态指示器:
    - running: 标题右侧旋转圈图标
    - success: 标题右侧 ✓ 图标 (2 秒后隐藏)
    - failed: 标题右侧 ⚠ 图标
```

### Step 6: 节点类型注册表

**文件**: `frontend/src/nodes/index.ts`

```
nodeTypes 注册表 (供 React Flow 使用):
  - prompt: PromptNode (Slice 4 实现，此处占位)
  - chat: ChatNode
  - optimize: OptimizeNode
  - analysis: AnalysisNode
  - search: SearchNode
  - image_mj: ImageMJNode (Slice 5 实现，此处占位)
  - image_imagen: ImageImagenNode
  - image_upload: ImageUploadNode
  - preview_wechat: PreviewWechatNode (Slice 7 实现，此处占位)
  - preview_red: PreviewRedNode

每个占位节点使用 NodeBase 渲染标题 + "即将实现" 占位文字

导出:
  nodeTypes: Record<string, ComponentType>  // React Flow nodeTypes
  portColorMap: Record<PortType, string>
  nodeCategoryMap: Record<string, Category>  // 用于 NodePicker 分类
```

### Step 7: Canvas 主组件

**文件**: `frontend/src/canvas/Canvas.tsx`

```
核心: React Flow 初始化 + 配置

import { ReactFlow, Background, Controls, MiniMap } from '@xyflow/react'

配置:
  - nodeTypes={nodeTypes}  // 从 nodes/index.ts
  - fitView on initial load
  - 背景: <Background variant="dots" gap={20} size={1} color="#d4d4d4" />
  - 画布背景色: #f5f5f5
  - snapToGrid={true} snapGrid={[20, 20]}
  - minZoom={0.2} maxZoom={2}
  - deleteKeyCode="Delete" (删除选中节点/边)
  - selectionKeyCode="Shift" (多选)

事件处理:
  onNodesChange: 同步到 canvasStore
  onEdgesChange: 同步到 canvasStore
  onConnect: 连接验证 + canvasStore.addEdge()
  onNodeDragStop: snap to 20px grid + canvasStore.updateNodePosition()
  onPaneDoubleClick: 打开 NodePicker
  onNodesDelete: canvasStore.removeNode (自动)
  onEdgesDelete: canvasStore.removeEdge (自动)

连接验证 (isValidConnection):
  - 读取源端口类型和目标端口类型
  - 类型不匹配 → 返回 false + tooltip "类型不匹配"
  - 目标端口已有连线 → 返回 false
  - 自连接 → 返回 false
  - 其他 → 返回 true

渲染:
  <div style={{ width: '100%', height: '100%', background: '#f5f5f5' }}>
    <ReactFlow ...>
      <Background ... />
      <Controls showInteractive={false} />
    </ReactFlow>
    <NodePicker />  {/* 条件渲染 */}
  </div>
```

### Step 8: CanvasControls 组件

**文件**: `frontend/src/canvas/CanvasControls.tsx`

```
位置: 画布左下角浮动

内容:
  - 缩放百分比显示
  - 适配按钮 (fitView)
  - 对齐网格开关 (snap toggle)
  - Undo/Redo 按钮

样式:
  - 白底, 8px 圆角
  - card shadow
  - 按钮: 幽灵按钮样式, 32px × 32px
  - Undo/Redo 无历史时置灰 opacity 0.4

逻辑:
  - undo: canvasStore.undo()
  - redo: canvasStore.redo()
  - fitView: react-flow useReactFlow().fitView()
```

### Step 9: NodePicker 节点选择面板

**文件**: `frontend/src/canvas/NodePicker.tsx`

```
触发: 双击画布 / 快捷键 N
关闭: ESC / 点击外部 / 选择节点后

状态:
  isOpen: boolean (canvasStore 或独立 store)
  searchQuery: string
  activeCategory: 'all' | 'input' | 'text' | 'image' | 'output'

布局 (480px 宽, max-height 600px):
  ┌──────────────────────────────────────┐
  │ 🔍 搜索节点... (Inter 16px)    [ESC] │
  ├──────────────────────────────────────┤
  │ [全部] [输入] [文本] [图像] [输出]    │  ← 药丸 Tab
  ├──────────────────────────────────────┤
  │ ┌────────────┐  ┌────────────┐       │
  │ │ [P] Prompt │  │ [C] Chat   │       │  ← 8px 圆角卡片
  │ │ 提示词输入  │  │ AI文字生成  │       │     card shadow
  │ └────────────┘  └────────────┘       │     Hover → 阴影加深
  │ ┌────────────┐  ┌────────────┐       │
  │ │ [🎨] MJ V7│  │ [G] Imagen3│       │
  │ │ 生图节点   │  │ 生图节点    │       │
  │ └────────────┘  └────────────┘       │
  │ ...更多节点                          │
  └──────────────────────────────────────┘

分类定义:
  input:  ImageUpload
  text:   Prompt, Chat, Optimize, Analysis, Search
  image:  ImageMJ, ImageImagen
  output: PreviewWechat, PreviewRed

节点卡片字段:
  {
    type: string        // 节点类型标识
    label: string       // 显示名称
    description: string // 简短描述
    icon: string        // emoji 或图标名
    category: string    // 分类
    defaultData: object // 默认节点数据
  }

搜索逻辑:
  - 模糊匹配 label + description
  - 实时过滤 (debounce 150ms)

选择节点后:
  - 在双击位置创建该类型节点 (snap to grid)
  - canvasStore.addNode()
  - 关闭 NodePicker
  - 无搜索结果时显示 "未找到匹配的节点"
```

### Step 10: Toolbar 左侧工具栏

**文件**: `frontend/src/canvas/Toolbar.tsx`

```
位置: 画布左侧, 宽 48px, 全高
样式: 白底, 右侧 ring shadow 分割线

按钮列表 (垂直排列, 40px × 40px):
  - [+] 添加节点 → 打开 NodePicker
  - [🔧] Skills → 打开 SkillPanel (Slice 7)
  - [---] 分隔线
  - [↩] Undo (快捷键提示 Cmd+Z)
  - [↪] Redo (快捷键提示 Cmd+Shift+Z)

按钮样式:
  - 幽灵按钮, 无背景
  - Hover: #f5f5f5 背景
  - Active: #e5e5e5 背景
  - 置灰时 opacity 0.4 + cursor not-allowed

Tooltip:
  - 使用 Radix Tooltip
  - 显示功能名称 + 快捷键
```

### Step 11: useCanvas Hook

**文件**: `frontend/src/hooks/useCanvas.ts`

```
功能: 画布级别的键盘快捷键和生命周期管理

快捷键绑定:
  Cmd/Ctrl + Z → canvasStore.undo()
  Cmd/Ctrl + Shift + Z → canvasStore.redo()
  Cmd/Ctrl + S → e.preventDefault() + workflowStore.saveWorkflow()
  N → 打开 NodePicker
  Delete / Backspace → 删除选中节点/边 (React Flow 内置)

beforeunload:
  - workflowStore.isDirty 时设置 event.returnValue = ''
  - 弹出浏览器原生 "有未保存的变更" 确认框

初始化:
  - 从 URL 取 workflow id
  - workflowStore.loadWorkflow(id)
  - canvasStore.setGraphFromJson(workflow.graphJson)
  - React Flow fitView()

清理:
  - 返回清理函数，移除所有事件监听
```

### Step 12: useNodeDrop Hook

**文件**: `frontend/src/hooks/useNodeDrop.ts`

```
功能: 从 NodePicker 拖拽节点到画布

逻辑:
  onNodePick(nodeType: string, position?: { x, y }):
    - 如果有 position (双击位置): 使用该位置
    - snap position to 20px grid
    - 生成唯一 node_id (uuid v4)
    - 创建 Node 对象:
      {
        id: nodeId,
        type: nodeType,
        position: snappedPosition,
        data: defaultData from nodeCategoryMap
      }
    - canvasStore.addNode(node)

拖拽反馈:
  - 从 NodePicker 拖出时显示半透明节点预览
  - 进入画布范围时高亮
  - 松手时 snap to grid + 创建
```

### Step 13: CanvasPage 页面

**文件**: `frontend/src/pages/CanvasPage.tsx`

```
布局:
  ┌──────────────────────────────────────────────┐
  │ TopBar (56px)                                │  ← Slice 0 占位，此处实现
  ├──────┬───────────────────────────────────────┤
  │      │                                       │
  │ Tool │         Canvas (React Flow)           │
  │ bar  │         #f5f5f5 背景                  │
  │ 48px │         点阵网格                      │
  │      │                                       │
  ├──────┴───────────────────────────────────────┤
  │ CanvasControls (左下)    执行状态 (中)        │  ← BottomBar 40px
  └──────────────────────────────────────────────┘

TopBar 内容:
  - 左: [←] 返回 Dashboard (link to /dashboard)
  - 中: 工作流名称 (可双击编辑) + 未保存标记 ● (workflowStore.isDirty 时显示)
  - 右: [Skills] [保存] 按钮

逻辑:
  - useCanvas() 初始化
  - 加载中: 显示全屏 Loading
  - 加载失败: 显示错误提示 + 重试按钮
```

### Step 14: 保存逻辑集成

**文件**: `frontend/src/store/workflowStore.ts` — 修改（Slice 2 创建的文件）

```
新增逻辑:

saveWorkflow():
  - 检查 currentWorkflow 不为 null
  - graphJson = canvasStore.getGraphJson()
  - set isSaving = true
  - 调用 workflow API: PUT /workflows/:id { graph_json: graphJson }
  - 成功: isSaving = false, isDirty = false
    - 显示 toast "已保存" (底部, 3 秒消失)
  - 失败: isSaving = false
    - 显示 toast "保存失败，请重试" (带重试按钮)

markDirty():
  - isDirty = true
  - TopBar 名称旁显示 ● 标记

自动保存 (可选，MVP 不实现):
  - debounce 30 秒自动保存
  - 注释预留，Phase 2 开启
```

### Step 15: 节点连线交互细节

在 `Canvas.tsx` 中实现：

```
连线预览:
  - 从端口拖出时: 虚线跟随鼠标
  - 虚线颜色 = 源端口类型颜色

类型不匹配处理:
  - 拖到不兼容端口上:
    - 目标端口高亮红色 ring shadow
    - 显示 Radix Tooltip: "类型不匹配: {sourceType} → {targetType}"
    - 松手不连接

连线成功:
  - 边的颜色 = 端口类型颜色 (半透明)
  - 连线建立后短暂高亮

选中边:
  - 点击边高亮
  - Delete 键删除
```

---

## 验收清单

- [ ] 画布打开显示 #f5f5f5 背景 + #d4d4d4 点阵网格
- [ ] 工作流数据正确加载到画布（节点位置、连线）
- [ ] 双击画布空白处打开 NodePicker 面板
- [ ] NodePicker 搜索过滤正常
- [ ] NodePicker 分类 Tab 切换正常
- [ ] 点击 NodePicker 中的节点，在双击位置创建（snap to 20px grid）
- [ ] 节点渲染: 白底 + 三层复合阴影 + Cal Sans 标题 + 12px 彩色端口
- [ ] 端口颜色按类型正确显示 (紫=prompt, 绿=image, 蓝=text 等)
- [ ] 端口 Hover 放大 16px
- [ ] 从端口拖出连线，跟随鼠标移动
- [ ] 类型匹配的端口可以连线，边颜色 = 端口类型颜色
- [ ] 类型不匹配时端口高亮红色 + tooltip 提示
- [ ] 一个输入端口只接受一条连线
- [ ] 拖拽节点后 snap to 20px 网格
- [ ] 选中节点 ring shadow 变 #6366F1
- [ ] Delete 键删除选中节点，关联边自动删除
- [ ] Cmd/Ctrl+Z 撤销，Cmd/Ctrl+Shift+Z 重做
- [ ] 最多 50 步历史
- [ ] Undo/Redo 按钮在无历史时置灰
- [ ] Cmd/Ctrl+S 保存工作流，显示 "已保存" toast
- [ ] 有未保存变更时顶栏名称旁显示 ●
- [ ] 关闭有未保存变更的页面时浏览器弹出确认框
- [ ] NodePicker ESC 关闭
- [ ] 左侧工具栏 Undo/Redo/Add 按钮正常
- [ ] 工具栏按钮 Tooltip 显示功能名 + 快捷键
- [ ] 缩放控件和 fitView 正常
- [ ] 所有文件 < 300 行

---

## 完成后更新

- [ ] 本文件状态 → ✅
- [ ] project_state.md → Slice 4
- [ ] phase1-mvp.md → Slice 3 ✅
- [ ] git commit: "Slice 3: canvas core (React Flow + nodes + connections + undo/redo + save)"
