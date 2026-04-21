# Slice 2: Dashboard + 工作流 CRUD（本地）

**优先级**: P0 | **难度**: 低 | **预计**: 2 天 | **状态**: ⬜ 未开始
**依赖**: Slice 0, Slice 1 | **返回索引**: [phase1-mvp.md](phase1-mvp.md)

---

## 目标

用户在 Dashboard 查看/创建/删除工作流，点击卡片进入画布。所有操作通过 Tauri IPC 访问本地 SQLite，无网络请求。

---

## Rust 侧步骤

### Step 1: Workflow Commands

**文件**: `src-tauri/src/commands/workflow.rs`

```rust
#[tauri::command]
// list_workflows() -> Result<Vec<WorkflowOut>, String>
//   SELECT id, name, thumbnail_path, created_at, updated_at FROM workflows
//   ORDER BY updated_at DESC

#[tauri::command]
// get_workflow(id: String) -> Result<WorkflowDetail, String>
//   SELECT * FROM workflows WHERE id = ?
//   不存在 → Err("工作流不存在")

#[tauri::command]
// create_workflow(name: Option<String>) -> Result<WorkflowDetail, String>
//   name = 参数 或 自动生成 "未命名工作流 {n}"
//   graph_json = '{"nodes":[],"edges":[]}'
//   INSERT INTO workflows (id, name, graph_json)
//   id = uuid::Uuid::new_v4()

#[tauri::command]
// update_workflow(id: String, name: Option<String>, graph_json: Option<String>) -> Result<WorkflowDetail, String>
//   仅更新非 None 字段
//   graph_json 全量覆盖
//   updated_at = now()

#[tauri::command]
// delete_workflow(id: String) -> Result<(), String>
//   DELETE FROM workflows WHERE id = ?
//   CASCADE 自动删关联 assets 和 execution_logs
```

### Step 2: 注册 Commands

**文件**: `src-tauri/src/lib.rs` — 更新 invoke_handler

```rust
.invoke_handler(tauri::generate_handler![
    // ... 之前的 commands
    commands::workflow::list_workflows,
    commands::workflow::get_workflow,
    commands::workflow::create_workflow,
    commands::workflow::update_workflow,
    commands::workflow::delete_workflow,
])
```

---

## 前端步骤

### Step 3: 类型定义

**文件**: `frontend/src/types/workflow.ts`

```typescript
export interface Workflow {
  id: string;
  name: string;
  thumbnailPath: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowDetail extends Workflow {
  graphJson: { nodes: NodeData[]; edges: EdgeData[] };
}
```

### Step 4: Tauri 服务封装

**文件**: `frontend/src/services/tauri.ts` — 扩展

```typescript
// Workflows
listWorkflows: () => invoke<Workflow[]>("list_workflows"),
getWorkflow: (id: string) => invoke<WorkflowDetail>("get_workflow", { id }),
createWorkflow: (name?: string) => invoke<WorkflowDetail>("create_workflow", { name }),
updateWorkflow: (id: string, data: { name?: string; graphJson?: string }) =>
  invoke<WorkflowDetail>("update_workflow", { id, ...data }),
deleteWorkflow: (id: string) => invoke<void>("delete_workflow", { id }),
```

### Step 5: Zustand Store

**文件**: `frontend/src/store/workflowStore.ts`

```typescript
interface WorkflowStore {
  workflows: Workflow[];
  currentWorkflow: WorkflowDetail | null;
  isLoading: boolean;
  isSaving: boolean;
  isDirty: boolean;

  fetchWorkflows: () => Promise<void>;
  // 调用 tauri.listWorkflows()，设置 workflows

  createAndNavigate: () => Promise<void>;
  // 调用 tauri.createWorkflow()，navigate('/canvas/' + id)

  deleteWorkflow: (id: string) => Promise<void>;
  // 调用 tauri.deleteWorkflow(id)，从列表移除

  loadWorkflow: (id: string) => Promise<void>;
  // 调用 tauri.getWorkflow(id)，设置 currentWorkflow

  saveWorkflow: () => Promise<void>;
  // graphJson = canvasStore.getGraphJson()
  // 调用 tauri.updateWorkflow(id, { graphJson })
  // 成功: isDirty = false, toast "已保存"
  // 失败: toast "保存失败，请重试"

  markDirty: () => void;
  // isDirty = true
}
```

### Step 6: DashboardPage

**文件**: `frontend/src/pages/DashboardPage.tsx`

```
布局:
  - 顶栏: 左侧 TANGENT Logo (Cal Sans 24px weight 600)
  - 顶栏右侧: License 状态指示 + Settings 齿轮图标
  - 主体: max-width 1200px 居中

内容区:
  - 标题行: "我的工作流" (Cal Sans 24px 600) + "新建工作流" 按钮 (#242424)
  - 工作流卡片网格: grid, gap 24px, min-width 280px
  - Free 计划且已达上限 3 个时，"新建" 按钮置灰 + tooltip "升级 Pro 解锁无限工作流"
  - 无工作流时显示 EmptyState

逻辑:
  - useEffect(() => fetchWorkflows(), [])
  - 新建: workflowStore.createAndNavigate()
  - 删除: 弹出 DeleteConfirmModal
  - 点击卡片: navigate('/canvas/' + workflow.id)
```

### Step 7: WorkflowCard 组件

**文件**: `frontend/src/components/WorkflowCard.tsx`

```
布局:
  ┌─────────────────────────────┐
  │ [缩略图 / 空白占位 #f5f5f5] │  ← 高度 160px
  ├─────────────────────────────┤
  │ 工作流名称 (Inter 16px)     │
  │ 更新于 2026-04-19 (12px 灰) │
  │                      [⋮]    │  ← 更多操作下拉
  └─────────────────────────────┘

样式: Cal.com 三层复合阴影, Hover 加深上移
更多操作: "重命名"（内联编辑） | "删除" → DeleteConfirmModal
```

### Step 8: EmptyState 组件

**文件**: `frontend/src/components/EmptyState.tsx`

```
居中: SVG 画布图标 120x120 + "还没有工作流" (Cal Sans 24px 600)
+ 说明文字 + "创建第一个工作流" 按钮
```

### Step 9: DeleteConfirmModal

**文件**: `frontend/src/components/DeleteConfirmModal.tsx`

```
Radix Dialog: "确定要删除「{name}」吗？" + [取消] [确认删除(#EF4444)]
确认后调用 workflowStore.deleteWorkflow(id)
```

---

## 验收清单

- [ ] Dashboard 页面正确展示工作流卡片网格
- [ ] "新建工作流" 创建空白工作流并跳转到画布
- [ ] 自动命名 "未命名工作流 1/2/3..." 自增
- [ ] 空列表显示 EmptyState + 引导按钮
- [ ] 删除工作流弹出确认弹窗，确认后删除
- [ ] 工作流卡片显示名称、更新时间
- [ ] 重命名功能正常（内联编辑，回车保存）
- [ ] Free 计划限制 3 个工作流，Pro 无限制
- [ ] 数据持久化：应用重启后工作流列表保持
- [ ] 所有操作无网络请求（纯本地 SQLite）
- [ ] 所有文件 < 300 行

---

## 完成后更新

- [ ] 本文件状态 → ✅
- [ ] project_state.md → Slice 3
- [ ] phase1-mvp.md → Slice 2 ✅
- [ ] git commit: "Slice 2: dashboard + workflow CRUD (local SQLite)"
