# Slice 2: Dashboard + Workflow CRUD

**优先级**: P0 | **难度**: 中 | **预计**: 2 天 | **状态**: ⬜ 未开始
**依赖**: Slice 0, Slice 1 | **返回索引**: [phase1-mvp.md](phase1-mvp.md)

---

## 目标

用户登录后看到 Dashboard 页面，可以创建、查看、重命名、删除工作流，点击工作流卡片进入画布编辑器。

---

## 后端步骤

### Step 1: 数据库模型

**文件**: `backend/app/models/workflow.py`

```
workflows 表:
  id            UUID PK (server default gen)
  owner_id      UUID FK → users.id, NOT NULL
  team_id       UUID FK → teams.id, NULLABLE (MVP 不用)
  name          VARCHAR(100) NOT NULL
  graph_json    JSONB NOT NULL DEFAULT '{}'::jsonb
  thumbnail_url VARCHAR(500) NULLABLE
  is_public     BOOLEAN DEFAULT false
  is_template   BOOLEAN DEFAULT false
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()

索引:
  idx_workflows_owner ON workflows(owner_id)
  idx_workflows_team  ON workflows(team_id)
```

**文件**: `backend/app/models/__init__.py` — 添加 `from .workflow import Workflow`

### Step 2: Alembic 迁移

```bash
cd backend && alembic revision --autogenerate -m "add workflows table"
alembic upgrade head
```

迁移内容：
- 创建 workflows 表及所有字段
- 创建 owner_id 外键约束（ON DELETE CASCADE）
- 创建 owner_id 和 team_id 索引

### Step 3: Pydantic Schema

**文件**: `backend/app/schemas/workflow.py`

```
WorkflowOut:
  id: str
  name: str
  thumbnail_url: str | None
  is_public: bool
  created_at: datetime
  updated_at: datetime

WorkflowDetail(WorkflowOut):
  graph_json: dict

WorkflowCreate:
  name: str | None  (可选，默认自动生成)

WorkflowUpdate:
  name: str | None
  graph_json: dict | None

WorkflowListResponse:
  workflows: list[WorkflowOut]
  total: int
```

**文件**: `backend/app/schemas/__init__.py` — 添加 `from .workflow import *`

### Step 4: Workflow Service

**文件**: `backend/app/services/workflow_service.py`

```
generate_workflow_name() -> str:
  - 格式: "未命名工作流 {n}"，n 取该用户已有同名前缀最大值+1
  - 示例: "未命名工作流 1", "未命名工作流 2"

list_workflows(db: AsyncSession, user_id: str, page: int, size: int) -> WorkflowListResponse:
  - 查询 workflows WHERE owner_id = user_id
  - ORDER BY updated_at DESC
  - 分页: offset = (page - 1) * size
  - 返回 WorkflowListResponse

get_workflow(db: AsyncSession, workflow_id: str, user_id: str) -> WorkflowDetail:
  - 查询 workflows WHERE id = workflow_id AND owner_id = user_id
  - 不存在 → raise HTTPException 404 "工作流不存在"
  - 返回 WorkflowDetail

create_workflow(db: AsyncSession, user_id: str, data: WorkflowCreate) -> WorkflowDetail:
  - name = data.name or generate_workflow_name()
  - graph_json = {"nodes": [], "edges": []} 空画布
  - 插入 workflows 表
  - 返回 WorkflowDetail

update_workflow(db: AsyncSession, workflow_id: str, user_id: str, data: WorkflowUpdate) -> WorkflowDetail:
  - 查询确认 owner_id = user_id
  - 仅更新 data 中非 None 字段
  - graph_json 全量覆盖（前端发送完整 DAG）
  - 更新 updated_at = now()
  - 返回 WorkflowDetail

delete_workflow(db: AsyncSession, workflow_id: str, user_id: str) -> None:
  - 查询确认 owner_id = user_id
  - 不存在 → 404
  - 删除（CASCADE 自动删关联 assets 和 execution_logs）
  - 返回 None
```

### Step 5: Workflow API 路由

**文件**: `backend/app/api/v1/workflows.py`

```
GET /api/v1/workflows
  - 依赖 get_current_user
  - 查询参数: page (default 1), size (default 20, max 100)
  - 调用 workflow_service.list_workflows()
  - 返回 WorkflowListResponse

POST /api/v1/workflows
  - 依赖 get_current_user
  - body: WorkflowCreate (name 可选)
  - 调用 workflow_service.create_workflow()
  - 返回 201 + WorkflowDetail

GET /api/v1/workflows/:id
  - 依赖 get_current_user
  - 调用 workflow_service.get_workflow(id, user.id)
  - 返回 WorkflowDetail (含完整 graph_json)

PUT /api/v1/workflows/:id
  - 依赖 get_current_user
  - body: WorkflowUpdate
  - 调用 workflow_service.update_workflow(id, user.id, data)
  - 返回 WorkflowDetail

DELETE /api/v1/workflows/:id
  - 依赖 get_current_user
  - 调用 workflow_service.delete_workflow(id, user.id)
  - 返回 200 {"success": true}
```

### Step 6: 注册路由

**文件**: `backend/app/main.py` — 添加

```python
from app.api.v1 import workflows
app.include_router(workflows.router, prefix="/api/v1/workflows", tags=["workflows"])
```

---

## 前端步骤

### Step 7: 类型定义

**文件**: `frontend/src/types/workflow.ts`

```
Workflow:
  id: string
  name: string
  thumbnailUrl: string | null
  isPublic: boolean
  createdAt: string
  updatedAt: string

WorkflowDetail extends Workflow:
  graphJson: { nodes: NodeData[], edges: EdgeData[] }

WorkflowListResponse:
  workflows: Workflow[]
  total: number
```

### Step 8: API 服务

**文件**: `frontend/src/services/workflow.ts`

```
listWorkflows(page?: number, size?: number)
  → GET /workflows?page=1&size=20
  → 返回 WorkflowListResponse

getWorkflow(id: string)
  → GET /workflows/:id
  → 返回 WorkflowDetail

createWorkflow(name?: string)
  → POST /workflows { name }
  → 返回 WorkflowDetail

updateWorkflow(id: string, data: { name?: string, graphJson?: object })
  → PUT /workflows/:id { name, graph_json: graphJson }
  → 返回 WorkflowDetail

deleteWorkflow(id: string)
  → DELETE /workflows/:id
  → 返回 { success: boolean }
```

### Step 9: Zustand Store

**文件**: `frontend/src/store/workflowStore.ts`

```
state:
  workflows: Workflow[]
  total: number
  currentWorkflow: WorkflowDetail | null
  isLoading: boolean
  isSaving: boolean
  isDirty: boolean   // 未保存变更标记

actions:
  fetchWorkflows():
    - set isLoading = true
    - 调用 listWorkflows()
    - set workflows, total, isLoading = false

  createAndNavigate():
    - 调用 createWorkflow() (无 name，让后端自动生成)
    - navigate('/canvas/' + response.id)

  deleteWorkflow(id: string):
    - 调用 deleteWorkflow(id)
    - 从 workflows 列表中移除该项
    - 更新 total

  loadWorkflow(id: string):
    - 调用 getWorkflow(id)
    - set currentWorkflow
    - set isDirty = false

  saveWorkflow():
    - set isSaving = true
    - 调用 updateWorkflow(id, { graphJson })
    - set isSaving = false, isDirty = false

  markDirty():
    - set isDirty = true
```

### Step 10: DashboardPage

**文件**: `frontend/src/pages/DashboardPage.tsx`

```
布局:
  - 顶栏: 左侧 TANVAS Logo (Cal Sans 24px weight 600)
  - 顶栏右侧: 头像 + 下拉菜单（设置、退出）
  - 主体: max-width 1200px 居中

内容区:
  - 标题行: "我的工作流" (Cal Sans 24px weight 600) + "新建工作流" 按钮 (#242424 主按钮)
  - 工作流卡片网格: grid, gap 24px, min-width 280px
  - 无工作流时显示 EmptyState 组件

逻辑:
  - useEffect(() => fetchWorkflows(), [])
  - 新建: workflowStore.createAndNavigate()
  - 删除: 弹出 DeleteConfirmModal
  - 点击卡片: navigate('/canvas/' + workflow.id)
```

### Step 11: WorkflowCard 组件

**文件**: `frontend/src/components/WorkflowCard.tsx`

```
布局:
  ┌─────────────────────────────┐
  │ [缩略图 / 空白占位 #f5f5f5] │  ← 高度 160px
  ├─────────────────────────────┤
  │ 工作流名称 (Inter 16px)     │
  │ 更新于 2026-04-19 (12px #898989)│
  │                      [⋮]    │  ← 更多操作下拉
  └─────────────────────────────┘

样式:
  - 白底 #ffffff, 8px 圆角
  - Cal.com 三层复合阴影 (card shadow)
  - Hover: 阴影加深 + 上移 2px (transition 150ms)
  - cursor: pointer

更多操作 (⋮ 菜单):
  - "重命名": 内联编辑名称（点击后变 input，回车保存）
  - "复制" (MVP 占位，暂不实现)
  - "删除": 打开 DeleteConfirmModal

缩略图:
  - 有 thumbnail_url: 显示图片
  - 无: 显示 #f5f5f5 灰色占位 + 中心淡色节点图标
```

### Step 12: EmptyState 组件

**文件**: `frontend/src/components/EmptyState.tsx`

```
布局: 垂直居中
  - 插画/SVG (简洁画布 + 节点图标, 120x120px)
  - 标题: "还没有工作流" (Cal Sans 24px weight 600)
  - 说明文字: "创建你的第一个工作流，开始 AI 创意之旅" (Inter 14px, #898989)
  - "创建第一个工作流" 按钮 (#242424 主按钮, 6px 圆角)
```

### Step 13: DeleteConfirmModal 组件

**文件**: `frontend/src/components/DeleteConfirmModal.tsx`

```
使用 Radix UI Dialog:

布局:
  ┌─────────────────────────────┐
  │ 确认删除                     │  ← Cal Sans 24px weight 600
  │                             │
  │ 确定要删除「{name}」吗？      │  ← Inter 14px
  │ 删除后无法恢复。              │  ← Inter 14px, #898989
  │                             │
  │           [取消]  [确认删除]   │  ← 取消=幽灵按钮, 确认=#EF4444 红色
  └─────────────────────────────┘

样式:
  - 白底, 16px 圆角, panel 级阴影
  - 遮罩: rgba(0,0,0,0.4)
  - 确认按钮: #EF4444 背景, 白字, 6px 圆角

逻辑:
  - 打开时 focus "取消" 按钮（防误删）
  - 确认: 调用 onDelete(id), 关闭弹窗
  - 取消/点击遮罩: 关闭弹窗
```

### Step 14: 路由更新

**文件**: `frontend/src/App.tsx` — 修改

```tsx
// /dashboard 路由使用 DashboardPage
<Route path="/dashboard" element={<DashboardPage />} />

// /canvas/:id 路由使用 CanvasPage (Slice 3 填充)
<Route path="/canvas/:id" element={<CanvasPage />} />
```

---

## 验收清单

- [ ] `POST /api/v1/workflows` 创建空白工作流，自动命名为 "未命名工作流 1"
- [ ] 连续创建时名称自增: "未命名工作流 2", "未命名工作流 3"
- [ ] `GET /api/v1/workflows` 返回当前用户的工作流列表，按 updated_at 降序
- [ ] `GET /api/v1/workflows/:id` 返回完整 graph_json
- [ ] `PUT /api/v1/workflows/:id` 可更新 name 和 graph_json
- [ ] `DELETE /api/v1/workflows/:id` 删除工作流，关联数据级联删除
- [ ] 不能查看/修改/删除其他用户的工作流（404）
- [ ] Dashboard 页面正确展示工作流卡片网格
- [ ] 点击 "新建工作流" 创建并跳转到 /canvas/:id
- [ ] 空列表显示 EmptyState 插画 + 引导按钮
- [ ] 删除工作流弹出确认弹窗，确认后删除并刷新列表
- [ ] 工作流卡片显示缩略图占位、名称、更新时间
- [ ] 重命名功能正常（内联编辑，回车保存）
- [ ] 分页参数有效：page, size 正常工作
- [ ] 所有文件 < 300 行

---

## 完成后更新

- [ ] 本文件状态 → ✅
- [ ] project_state.md → Slice 3
- [ ] phase1-mvp.md → Slice 2 ✅
- [ ] git commit: "Slice 2: dashboard + workflow CRUD (list/create/update/delete)"
