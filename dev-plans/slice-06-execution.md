# Slice 6: Execution Engine

**优先级**: P0 | **难度**: 高 | **预计**: 3 天 | **状态**: ⬜ 未开始
**依赖**: Slice 4, Slice 5 | **返回索引**: [phase1-mvp.md](phase1-mvp.md)

---

## 目标

实现完整的执行引擎：DAG 拓扑排序、ARQ 任务队列、节点逐个/全部执行、WebSocket 实时状态推送、执行取消。

---

## 后端步骤

### Step 1: 数据库模型 — ExecutionLog

**文件**: `backend/app/models/execution_log.py`

```
execution_logs 表:
  id            UUID PK
  user_id       UUID FK → users.id, NOT NULL
  workflow_id   UUID FK → workflows.id, NULLABLE
  execution_id  VARCHAR(50) NOT NULL  (一次执行请求的唯一标识)
  node_id       VARCHAR(50) NOT NULL
  node_type     VARCHAR(50) NOT NULL
  started_at    TIMESTAMPTZ NOT NULL DEFAULT now()
  ended_at      TIMESTAMPTZ NULLABLE
  duration_ms   INTEGER NULLABLE
  week_start    DATE NOT NULL  (当周周一日期，用于按周汇总)
  status        ENUM('running', 'success', 'failed', 'cancelled') NOT NULL
  error_message TEXT NULLABLE

索引:
  idx_execution_logs_user_week ON execution_logs(user_id, week_start)
  idx_execution_logs_execution ON execution_logs(execution_id)
```

**文件**: `backend/app/models/__init__.py` — 添加 `from .execution_log import ExecutionLog`

### Step 2: Alembic 迁移

```bash
cd backend && alembic revision --autogenerate -m "add execution_logs table"
alembic upgrade head
```

### Step 3: DAG 解析库

**文件**: `backend/app/lib/dag.py`

```
def topological_sort(nodes: list[dict], edges: list[dict]) -> list[str]:
  """
  Kahn 算法拓扑排序。
  - nodes: [{"id": str, ...}]
  - edges: [{"source": str, "target": str, "sourcePort": str, "targetPort": str}]
  - 返回 node_id 有序列表
  - 检测环 → raise ValueError("工作流存在循环依赖")
  """

def get_execution_layers(nodes: list[dict], edges: list[dict]) -> list[list[str]]:
  """
  返回执行层级。
  - [[layer0_nodes], [layer1_nodes], ...]
  - layer 0: 无入边节点
  - layer n: 所有入边来源在 layer 0..n-1 中
  - 同层节点可并发执行
  """

def get_node_inputs(node_id: str, nodes: list[dict], edges: list[dict], results: dict) -> dict:
  """
  收集节点上游输入数据。
  - 遍历所有 target = node_id 的 edges
  - 从 results 中取 source node 的输出
  - 按 targetPort 分组: { port_name: upstream_value }
  """

def get_week_start(dt: datetime) -> date:
  """返回给定日期所在周的周一日期 (UTC)"""
```

### Step 4: Execution Service

**文件**: `backend/app/services/execution_service.py`

```
class ExecutionService:

  async def submit_execution(
    db: AsyncSession,
    user_id: str,
    workflow_id: str,
    node_ids: list[str] | None,
    config_overrides: dict | None,
  ) -> str:
    """
    提交执行请求。
    1. 加载 workflow.graph_json
    2. 如果 node_ids 为 None → 执行全部节点
    3. 如果指定 node_ids → 只执行这些节点 + 必要的上游依赖
    4. 拓扑排序获取执行顺序
    5. 生成唯一 execution_id (uuid)
    6. 为每个节点创建 ExecutionLog (status="running")
    7. 将执行任务推入 ARQ 队列
    8. 返回 execution_id
    """

  async def run_single_node(
    db: AsyncSession,
    user_id: str,
    workflow_id: str,
    node_id: str,
    config_overrides: dict | None,
  ) -> str:
    """
    执行单个节点。
    1. 加载 workflow.graph_json
    2. 获取 node_id 的上游数据 (从已执行的结果或当前 graph state)
    3. 创建 ExecutionLog
    4. 推入 ARQ 队列
    5. 返回 execution_id
    """

  async def cancel_execution(
    db: AsyncSession,
    user_id: str,
    execution_id: str,
  ) -> None:
    """
    取消执行。
    1. 标记所有 status="running" 的 ExecutionLog 为 "cancelled"
    2. 设置 Redis flag: cancel:{execution_id} = 1
    3. Worker 检查此 flag，发现则停止
    """

  def check_weekly_limit(
    db: AsyncSession,
    user_id: str,
  ) -> tuple[int, int]:
    """
    检查本周剩余执行时长。
    - 返回 (used_seconds, limit_seconds)
    - 查询 user_weekly_usage 视图
    - 如果无记录 → (0, plan.weekly_seconds_limit)
    """
```

### Step 5: ARQ Worker

**文件**: `backend/app/workers/execution_worker.py`

```
ARQ Worker 配置:
  - redis_settings: from config.REDIS_URL
  - functions: [execute_node_task, execute_workflow_task]

async def execute_workflow_task(ctx: dict, execution_id: str, user_id: str, workflow_id: str, ordered_node_ids: list[str], edges: list[dict]):
  """
  执行整个工作流。
  1. 获取执行层级: layers = get_execution_layers(nodes, edges)
  2. 逐层执行:
     for layer in layers:
       # 检查取消 flag
       if redis.get(f"cancel:{execution_id}"): break

       # 并发执行同层节点
       tasks = [execute_node_task(...) for node_id in layer]
       results = await asyncio.gather(*tasks, return_exceptions=True)

       # 记录结果
       for result in results:
         if isinstance(result, Exception):
           # 标记失败，但继续执行无依赖的节点
           pass
  3. 全部完成: 推送 "workflow_completed" WebSocket 消息
  """

async def execute_node_task(ctx: dict, execution_id: str, user_id: str, node: dict, edges: list[dict], results_so_far: dict):
  """
  执行单个节点。
  1. 检查取消 flag
  2. 收集上游输入: get_node_inputs(node.id, nodes, edges, results_so_far)
  3. 获取节点执行器: executor_cls = NODE_EXECUTORS[node.type]
  4. 实例化执行器: executor = executor_cls(node_id, node.type, node.data, inputs)
  5. 推送 WebSocket: node_status = "running"
  6. 执行: result = await executor.execute(context)
  7. 成功:
     - 推送 WebSocket: node_status = "success", result = result.outputs
     - 更新 ExecutionLog: status="success", ended_at=now(), duration_ms
     - results_so_far[node.id] = result.outputs
  8. 失败:
     - 推送 WebSocket: node_status = "failed", error = str(e)
     - 更新 ExecutionLog: status="failed", error_message
  """

async def startup(ctx: dict):
  """Worker 启动时初始化 DB 连接"""

async def shutdown(ctx: dict):
  """Worker 关闭时清理"""
```

### Step 6: Execution API 路由

**文件**: `backend/app/api/v1/executions.py`

```
POST /api/v1/executions
  - 依赖 get_current_user
  - body: ExecutionRequest
    {
      workflow_id: str,
      node_ids: str[] | null,   // null = 全部
      config_overrides: {} | null
    }
  - 检查 weekly limit (调用 execution_service.check_weekly_limit)
    - 超限 → 403 "本周执行时长已用完"
  - 如果 node_ids 长度为 1:
    - execution_service.run_single_node()
  - 如果 node_ids 为 null 或多个:
    - execution_service.submit_execution()
  - 返回 201 ExecutionResponse { execution_id, status: "queued", node_ids }

POST /api/v1/executions/:id/cancel
  - 依赖 get_current_user
  - execution_service.cancel_execution(execution_id, user.id)
  - 返回 200 { success: true }

GET /api/v1/executions/:id
  - 依赖 get_current_user
  - 查询 execution_logs WHERE execution_id = id AND user_id = user.id
  - 返回各节点执行状态列表
```

**文件**: `backend/app/main.py` — 添加 executions router

### Step 7: WebSocket 端点

**文件**: `backend/app/api/ws/execution_ws.py`

```
WebSocket: /ws/executions/{execution_id}

连接建立:
  1. 从 query param 获取 token: ?token=xxx
  2. verify_jwt(token) → 获取 user_id
  3. 验证 execution_id 存在且属于该用户
  4. 将连接加入连接池: active_connections[execution_id] = websocket

消息推送:
  async def broadcast_node_status(execution_id: str, message: NodeStatusMessage):
    - 查找 active_connections[execution_id]
    - 发送 JSON: {
        "type": "node_status",
        "node_id": str,
        "status": "running" | "success" | "failed",
        "progress": int,
        "result": dict | null,
        "error": str | null
      }

  async def broadcast_workflow_completed(execution_id: str):
    - 发送 JSON: {
        "type": "workflow_completed",
        "execution_id": str,
        "success_count": int,
        "failed_count": int,
        "total_duration_ms": int
      }

心跳:
  - 每 30 秒发送 ping
  - 60 秒无 pong → 断开

断开处理:
  - 从 active_connections 移除
  - 不影响执行（执行在 Worker 中继续）
```

**文件**: `backend/app/main.py` — 添加 WebSocket 路由

```python
from app.api.ws import execution_ws
app.websocket("/ws/executions/{execution_id}")(execution_ws.websocket_endpoint)
```

---

## 前端步骤

### Step 8: WebSocket Hook

**文件**: `frontend/src/hooks/useWebSocket.ts`

```
function useWebSocket(executionId: string | null):

  state:
    isConnected: boolean
    lastMessage: NodeStatusMessage | null

  逻辑:
    - executionId 存在时建立 WebSocket 连接
    - URL: ws://host/ws/executions/{executionId}?token={jwt}
    - 开发环境: ws://localhost:8000/ws/executions/{id}?token=xxx
    - 生产环境: wss://domain/ws/executions/{id}?token=xxx

    - onopen: isConnected = true
    - onmessage: 解析 JSON → 更新 canvasStore
      - node_status:
        - canvasStore.setNodeStatus(nodeId, status)
        - canvasStore.setNodeResult(nodeId, result)
        - 如果 status === "success" → 2 秒后恢复 idle
      - workflow_completed:
        - 显示 toast "执行完毕 ✓ 耗时 {s} 秒"
        - 如果有失败 → "执行完毕（{n} 个节点失败）"
    - onclose:
      - isConnected = false
      - 非手动关闭 → 3 秒后自动重连 (最多 5 次)
    - onerror: isConnected = false

  清理:
    - executionId 变化或组件卸载时关闭连接

  返回: { isConnected, lastMessage }
```

### Step 9: Execution Hook

**文件**: `frontend/src/hooks/useExecution.ts`

```
function useExecution():

  state:
    currentExecutionId: string | null
    isRunning: boolean

  actions:

  async runNode(nodeId: string):
    - 从 workflowStore 获取 workflowId
    - 从 canvasStore 获取节点数据
    - POST /api/v1/executions {
        workflow_id: workflowId,
        node_ids: [nodeId]
      }
    - 设置 currentExecutionId = response.execution_id
    - isRunning = true
    - 建立 WebSocket 连接 (useWebSocket)
    - 错误处理: 超限 → 弹出升级提示

  async runAll():
    - POST /api/v1/executions {
        workflow_id: workflowId,
        node_ids: null  // 全部节点
      }
    - 同上流程

  async cancelExecution():
    - POST /api/v1/executions/{currentExecutionId}/cancel
    - isRunning = false
    - canvasStore 重置所有 running 状态节点为 idle

  返回: { runNode, runAll, cancelExecution, currentExecutionId, isRunning }
```

### Step 10: Execution API 服务

**文件**: `frontend/src/services/execution.ts`

```
submitExecution(data: ExecutionRequest)
  → POST /executions
  → 返回 ExecutionResponse

cancelExecution(executionId: string)
  → POST /executions/:id/cancel

getExecutionStatus(executionId: string)
  → GET /executions/:id
```

### Step 11: 节点状态动画

在 `NodeBase.tsx` 中集成状态动画：

```
运行中 (running):
  - ring shadow: 0 0 0 2px #3B82F6
  - 蓝色漫射: rgba(59,130,246,0.3) 0 4px 12px
  - 脉冲动画: CSS @keyframes pulse-ring
    0%, 100%: box-shadow 如上
    50%: box-shadow 加大漫射范围
  - Run 按钮变 "停止 ■" (#EF4444)

成功 (success):
  - ring shadow: 0 0 0 2px #22C55E
  - 绿色闪光: rgba(34,197,94,0.2) 0 4px 8px
  - 2 秒后自动恢复 idle (setTimeout)

失败 (failed):
  - ring shadow: 0 0 0 2px #EF4444
  - 红色漫射: rgba(239,68,68,0.2) 0 4px 8px
  - 持续显示直到用户重新操作
  - 错误信息在节点内容区显示，可展开查看详情
```

### Step 12: Run 按钮完整实现

在 `NodeBase.tsx` 中完善 Run 按钮：

```
Run 按钮完整逻辑:

  idle / success / failed:
    - 显示 "Run ▶"
    - #242424 药丸按钮
    - onClick → useExecution().runNode(nodeId)
    - 检查 weekly limit:
      - subscriptionStore.remainingSeconds <= 0 → 按钮置灰 + 弹出升级提示
      - 否则正常执行

  running:
    - 显示 "停止 ■"
    - #EF4444 药丸按钮
    - onClick → useExecution().cancelExecution()
    - disabled: 防重复点击 (loading state)

  免费节点 (image_upload, prompt, preview):
    - Run 按钮不显示 (这些节点不需要执行)
```

### Step 13: Run All 按钮

在 `CanvasPage.tsx` / `Toolbar.tsx` 中添加：

```
Run All 按钮:
  - 位置: 工具栏底部 / 底栏中间
  - 样式: #242424 主按钮, "Run All ▶▶"
  - onClick → useExecution().runAll()
  - isRunning 时变 "停止全部 ■", #EF4444

执行状态底栏:
  - 位置: 底栏中间
  - 运行中: "执行中... {completed}/{total} 节点完成" (蓝色文字)
  - 完成: "执行完毕 ✓ 耗时 {s} 秒" (绿色, 5 秒后隐藏)
  - 部分失败: "执行完毕（{n} 个节点失败）" (红色)
```

### Step 14: ARQ Worker Docker 配置

**文件**: `docker-compose.yml` — 修改

```yaml
services:
  # ... 现有服务 ...

  worker:
    build: ./backend
    command: ["python", "-m", "arq", "app.workers.execution_worker.WorkerSettings"]
    env_file: .env
    depends_on: [postgres, redis, minio]
    volumes: ["./backend:/app"]
```

---

## 验收清单

- [ ] `POST /api/v1/executions` 提交执行请求，返回 execution_id
- [ ] `POST /api/v1/executions` node_ids=null 执行全部节点
- [ ] `POST /api/v1/executions` node_ids=["id"] 执行单个节点
- [ ] DAG 拓扑排序正确：节点按依赖顺序执行
- [ ] 同层节点并发执行
- [ ] 某节点失败不影响无依赖的其他节点继续执行
- [ ] 全部节点依赖链上某节点失败 → 依赖节点跳过并标记失败
- [ ] WebSocket 连接建立成功，接收实时状态消息
- [ ] 节点运行中显示蓝色脉冲动画
- [ ] 节点成功显示绿色闪光（2 秒后恢复）
- [ ] 节点失败显示红色边框 + 错误信息
- [ ] 单节点 Run 按钮点击后变 "停止"，可取消
- [ ] Run All 按钮执行全部节点
- [ ] 取消执行正常：后续节点标记 cancelled
- [ ] 执行日志写入 execution_logs 表
- [ ] duration_ms 精确记录每个节点执行时长
- [ ] week_start 正确按周一日期记录
- [ ] ARQ Worker 在 Docker 中正常运行
- [ ] 周时长超限时返回 403 错误
- [ ] WebSocket 断开后自动重连（最多 5 次）
- [ ] 执行完毕底栏显示总耗时
- [ ] 所有文件 < 300 行

---

## 完成后更新

- [ ] 本文件状态 → ✅
- [ ] project_state.md → Slice 7
- [ ] phase1-mvp.md → Slice 6 ✅
- [ ] git commit: "Slice 6: execution engine (DAG + ARQ queue + WebSocket + cancel)"
