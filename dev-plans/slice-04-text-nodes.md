# Slice 4: Text/Prompt Node Implementations

**优先级**: P0 | **难度**: 中 | **预计**: 3 天 | **状态**: ⬜ 未开始
**依赖**: Slice 3 | **返回索引**: [phase1-mvp.md](phase1-mvp.md)

---

## 目标

实现 5 个文本/提示类节点的完整功能：Prompt、Chat、Optimize、Analysis、Search。前端渲染节点 UI，后端通过节点执行器调用对应 AI API。

---

## 后端步骤

### Step 1: 节点执行器基类

**文件**: `backend/app/nodes/base.py`

```
class NodeExecutor(ABC):
  """所有节点执行器的抽象基类"""

  def __init__(self, node_id: str, node_type: str, config: dict, inputs: dict):
    self.node_id = node_id
    self.node_type = node_type
    self.config = config       # 节点配置参数
    self.inputs = inputs       # 上游输入数据 {port_name: value}

  @abstractmethod
  async def execute(self, context: ExecutionContext) -> NodeResult:
    """
    执行节点逻辑。
    context: 包含 db session, user_id, progress callback
    返回: NodeResult(outputs={}, assets=[])
    """
    pass

  def validate_inputs(self, required: list[str]) -> None:
    """校验必要输入是否存在，缺失则 raise ValueError"""

class NodeResult(BaseModel):
  outputs: dict          # {port_name: value}
  assets: list[dict] = []  # 生成的资产信息

class ExecutionContext(BaseModel):
  db: AsyncSession
  user_id: str
  workflow_id: str | None

  async def report_progress(self, progress: int):
    """通过 WebSocket 推送进度（0-100）"""
    pass

# 节点类型注册表
NODE_EXECUTORS: dict[str, Type[NodeExecutor]] = {}

def register_node(node_type: str):
  """装饰器：注册节点执行器"""
  def decorator(cls):
    NODE_EXECUTORS[node_type] = cls
    return cls
  return decorator
```

### Step 2: Claude API 工具

**文件**: `backend/app/services/claude_service.py`

```
async def call_claude(
  messages: list[dict],
  system_prompt: str | None = None,
  max_tokens: int = 4096,
  model: str = "claude-sonnet-4-20250514",
) -> str:
  """
  调用 Claude API，返回文本响应。
  - messages: [{role: "user"|"assistant", content: str}]
  - 使用 anthropic SDK
  - 错误处理: API 错误 → raise HTTPException 502
  - 超时: 120 秒
  """

async def call_claude_vision(
  messages: list[dict],
  images: list[str],  # image URLs or base64
  system_prompt: str | None = None,
  max_tokens: int = 4096,
) -> str:
  """
  调用 Claude Vision API，分析图像。
  - 将图片编码为 multimodal content blocks
  - 返回文本描述
  """

async def call_claude_stream(
  messages: list[dict],
  system_prompt: str | None = None,
  max_tokens: int = 4096,
  on_chunk: Callable[[str], None] | None = None,
) -> str:
  """
  流式调用 Claude API。
  - 每个chunk 调用 on_chunk callback（用于 WebSocket 推送）
  - 返回完整响应文本
  """
```

### Step 3: Chat 节点执行器

**文件**: `backend/app/nodes/chat.py`

```
@register_node("chat")
class ChatNodeExecutor(NodeExecutor):

  config 字段:
    system_prompt: str (默认 "你是一个有帮助的 AI 助手。")
    model: str (默认 claude-sonnet-4-20250514)
    temperature: float (默认 0.7, 范围 0-1)
    max_tokens: int (默认 4096)

  inputs:
    text: str (来自上游 text/search_result 端口)

  outputs:
    text: str (Claude 响应文本)

  execute():
    1. validate_inputs(["text"])
    2. 构造 messages:
       - 如果 config 有 system_prompt → 作为 system 参数
       - user message = inputs["text"]
    3. 调用 claude_service.call_claude()
    4. 返回 NodeResult(outputs={"text": response_text})
```

### Step 4: Optimize 节点执行器

**文件**: `backend/app/nodes/optimize.py`

```
@register_node("optimize")
class OptimizeNodeExecutor(NodeExecutor):

  config 字段:
    optimization_type: str (默认 "general")
      可选: "general" | "image_generation" | "creative_writing"
    language: str (默认 "zh") 优化后输出的语言

  inputs:
    prompt: str | text: str (接受 prompt 或 text 类型)

  outputs:
    prompt: str (优化后的 prompt)

  execute():
    1. input_text = inputs.get("prompt") or inputs.get("text")
    2. validate_inputs 存在
    3. 构造优化 system prompt:
       """
       你是一个专业的提示词优化专家。请优化以下提示词，使其更加具体、详细、有效。
       优化类型: {optimization_type}
       输出语言: {language}
       只输出优化后的提示词，不要解释。
       """
    4. 调用 claude_service.call_claude()
    5. 返回 NodeResult(outputs={"prompt": optimized_text})
```

### Step 5: Analysis 节点执行器

**文件**: `backend/app/nodes/analysis.py`

```
@register_node("analysis")
class AnalysisNodeExecutor(NodeExecutor):

  config 字段:
    analysis_type: str (默认 "describe_and_reverse")
      可选: "describe" | "reverse_prompt" | "describe_and_reverse"
    detail_level: str (默认 "detailed")
      可选: "brief" | "detailed" | "exhaustive"

  inputs:
    image: str (图片 URL)

  outputs:
    prompt: str (反推的 prompt 描述)
    text: str (详细文字描述)

  execute():
    1. validate_inputs(["image"])
    2. 根据 analysis_type 构造 system prompt:
       - describe: "详细描述这张图片的内容..."
       - reverse_prompt: "分析这张图片，生成能够重现类似效果的提示词..."
       - describe_and_reverse: 同时完成上述两项
    3. 调用 claude_service.call_claude_vision(inputs["image"])
    4. 解析响应:
       - 分离描述文字和反推 prompt
       - 若无法分离，prompt = 完整响应，text = 完整响应
    5. 返回 NodeResult(outputs={"prompt": prompt, "text": description})
```

### Step 6: Search 节点执行器

**文件**: `backend/app/nodes/search.py`

```
@register_node("search")
class SearchNodeExecutor(NodeExecutor):

  config 字段:
    platform: str (默认 "general")
      可选: "general" (MVP 只有 Tavily 通用搜索)
    result_count: int (默认 10, 范围 5-20)

  inputs:
    prompt: str (搜索关键词/主题)

  outputs:
    search_result: list[dict] (搜索结果列表)

  execute():
    1. validate_inputs(["prompt"])
    2. 调用 Tavily API:
       - endpoint: https://api.tavily.com/search
       - headers: {"Content-Type": "application/json"}
       - body: {
           api_key: TAVILY_API_KEY,
           query: inputs["prompt"],
           max_results: config["result_count"],
           include_answer: true,
         }
    3. 解析响应:
       results = [
         {
           "title": str,
           "url": str,
           "content": str,  # 摘要
           "score": float,
         },
         ...
       ]
    4. 如果 Tavily 返回 include_answer → 添加到 results 开头作为 "AI 摘要"
    5. 返回 NodeResult(outputs={"search_result": results})
```

### Step 7: 执行相关 Schema

**文件**: `backend/app/schemas/execution.py`

```
ExecutionRequest:
  workflow_id: str
  node_ids: list[str] | None  # None = 执行全部节点
  config_overrides: dict | None  # 运行时覆盖节点配置

ExecutionResponse:
  execution_id: str
  status: str  # "queued"
  node_ids: list[str]

NodeStatusMessage:
  type: str  # "node_status"
  node_id: str
  status: str  # "running" | "success" | "failed"
  progress: int  # 0-100
  result: dict | None
  error: str | None
```

---

## 前端步骤

### Step 8: PromptNode 组件

**文件**: `frontend/src/nodes/prompt/PromptNode.tsx`

```
使用 NodeBase 包裹

inputs: [] (无输入，或可选接受 text 输入)
outputs: [{ id: "prompt", type: "prompt", label: "提示词" }]

内容区:
  - 多行 textarea
  - Inter 14px, 行高 1.5
  - 最小高度 80px, 可拖拽调整
  - placeholder: "输入你的提示词..."
  - 支持变量占位符 {{variable}} 高亮显示 (Phase 2)

节点数据 (node.data):
  {
    prompt: string  // textarea 内容
  }

onChange:
  - debounce 300ms
  - canvasStore.updateNodeData(id, { prompt: value })
```

### Step 9: ChatNode 组件

**文件**: `frontend/src/nodes/chat/ChatNode.tsx`

```
使用 NodeBase 包裹

inputs: [{ id: "text", type: "text", label: "输入" }]
outputs: [{ id: "text", type: "text", label: "输出" }]

内容区 - 配置区:
  - system_prompt: 可折叠文本框 (默认折叠)
    - 折叠时显示 "系统提示词: {前30字}..."
    - 展开时显示 textarea
    - 默认值: "你是一个有帮助的 AI 助手。"
  - temperature: 滑块 0-1, step 0.1, 默认 0.7

内容区 - 结果区:
  - 未执行: 灰色占位文字 "点击 Run 生成"
  - 执行中: 旋转动画 + "思考中..."
  - 成功: 文本显示
    - 前 200 字符直接显示
    - 超过 200 字符 → 显示 "展开" 按钮
    - 展开后显示完整文本 + "收起" 按钮
  - 失败: 红色错误信息

节点数据:
  {
    systemPrompt: string
    temperature: number
    maxTokens: number
    result: string | null
    error: string | null
  }
```

### Step 10: OptimizeNode 组件

**文件**: `frontend/src/nodes/optimize/OptimizeNode.tsx`

```
使用 NodeBase 包裹

inputs:
  - { id: "prompt", type: "prompt", label: "原始提示词" }
  - { id: "text", type: "text", label: "文本" }  (可选)
outputs:
  - { id: "prompt", type: "prompt", label: "优化后提示词" }

内容区 - 配置:
  - optimization_type: select 下拉
    选项: 通用优化 / 图片生成优化 / 创意写作优化
  - language: select 下拉
    选项: 中文 / English / 日本語

内容区 - 结果:
  - 优化后文本显示 (同 ChatNode 200 字截断+展开)

节点数据:
  {
    optimizationType: "general" | "image_generation" | "creative_writing"
    language: "zh" | "en" | "ja"
    result: string | null
    error: string | null
  }
```

### Step 11: AnalysisNode 组件

**文件**: `frontend/src/nodes/analysis/AnalysisNode.tsx`

```
使用 NodeBase 包裹

inputs:
  - { id: "image", type: "image", label: "图片" }
outputs:
  - { id: "prompt", type: "prompt", label: "反推提示词" }
  - { id: "text", type: "text", label: "描述" }

内容区 - 配置:
  - analysis_type: select 下拉
    选项: 描述+反推 / 仅描述 / 仅反推
  - detail_level: select 下拉
    选项: 简略 / 详细 / 详尽

内容区 - 结果:
  - 未连接图片输入: "请连接图片输入"
  - 成功:
    - "反推 Prompt:" + prompt 文本
    - "详细描述:" + description 文本
    - 各自 200 字截断+展开

节点数据:
  {
    analysisType: string
    detailLevel: string
    resultPrompt: string | null
    resultText: string | null
    error: string | null
  }
```

### Step 12: SearchNode 组件

**文件**: `frontend/src/nodes/search/SearchNode.tsx`

```
使用 NodeBase 包裹

inputs:
  - { id: "prompt", type: "prompt", label: "搜索关键词" }
outputs:
  - { id: "search_result", type: "search_result", label: "搜索结果" }

内容区 - 配置:
  - platform: select (MVP 只有 "通用搜索")
  - result_count: select (5 / 10 / 20)

内容区 - 结果:
  - 未执行: "点击 Run 搜索"
  - 执行中: 旋转 + "搜索中..."
  - 成功: 搜索结果列表
    ┌───────────────────────────┐
    │ 1. AI 摘要               │  ← 特殊样式，浅蓝背景
    │    简要概括...            │
    ├───────────────────────────┤
    │ 2. 标题                  │
    │    摘要内容...            │
    │    🔗 source.com          │  ← 灰色链接
    ├───────────────────────────┤
    │ 3. 标题                  │
    │    ...                    │
    └───────────────────────────┘
    - 每条结果: 标题 (14px 600) + 摘要 (12px) + 来源 (12px #898989)
    - 最多显示 5 条，超过显示 "还有 N 条结果"
    - 点击展开显示全部

节点数据:
  {
    platform: string
    resultCount: number
    results: SearchResult[] | null
    error: string | null
  }

SearchResult 类型:
  { title: string, url: string, content: string, score: number }
```

### Step 13: 节点类型注册表更新

**文件**: `frontend/src/nodes/index.ts` — 修改

```
替换占位组件为真实组件:
  prompt: PromptNode       // from ./prompt/PromptNode
  chat: ChatNode           // from ./chat/ChatNode
  optimize: OptimizeNode   // from ./optimize/OptimizeNode
  analysis: AnalysisNode   // from ./analysis/AnalysisNode
  search: SearchNode       // from ./search/SearchNode

新增导出:
  NODE_DEFINITIONS: Record<string, NodeDefinition>

  NodeDefinition:
    type: string
    label: string
    description: string
    icon: string
    category: "input" | "text" | "image" | "output"
    defaultData: Record<string, any>
    inputs: PortDef[]
    outputs: PortDef[]
```

### Step 14: Run 按钮交互（节点级）

在 NodeBase 中集成 Run 按钮：

```
Run 按钮逻辑:
  - idle 状态: 显示 "Run ▶" (#242424 药丸)
  - 点击 → 调用 execution service POST /executions
    body: { workflow_id, node_ids: [this.node.id] }
  - running 状态: 显示 "停止 ■" (#EF4444 红色药丸)
    - 节点边框蓝色脉冲动画
  - success 状态: "Run ▶" 恢复 (边框绿 2 秒后恢复)
  - failed 状态: "Run ▶" 恢复 (边框红)

  MVP 注意: Run 按钮点击逻辑在 Slice 6 完整实现，
  本 Slice 先预留按钮 UI 和 onClick handler 接口
```

---

## 验收清单

- [ ] PromptNode: textarea 输入正常，通过 prompt 端口输出
- [ ] ChatNode: 输入 text，配置 system_prompt 和 temperature
- [ ] ChatNode 结果文本 200 字截断 + 展开收起正常
- [ ] OptimizeNode: 接受 prompt 或 text 输入，输出优化后 prompt
- [ ] OptimizeNode 优化类型选择正常 (通用/图片生成/创意写作)
- [ ] AnalysisNode: 接受 image 输入，输出 prompt + text 双端口
- [ ] SearchNode: 输入关键词，显示搜索结果列表
- [ ] SearchNode AI 摘要特殊样式显示
- [ ] 搜索结果超过 5 条时可展开查看全部
- [ ] 后端 Chat 执行器调用 Claude API 成功返回
- [ ] 后端 Optimize 执行器优化提示词成功
- [ ] 后端 Analysis 执行器调用 Claude Vision 成功
- [ ] 后端 Search 执行器调用 Tavily API 成功
- [ ] 后端各执行器输入校验正确（缺失必要输入报错）
- [ ] 后端执行器注册表 NODE_EXECUTORS 包含所有 5 种类型
- [ ] NodePicker 显示所有文本类节点（Prompt/Chat/Optimize/Analysis/Search）
- [ ] 节点配置项（select/textarea/slider）交互正常
- [ ] 所有文件 < 300 行

---

## 完成后更新

- [ ] 本文件状态 → ✅
- [ ] project_state.md → Slice 5
- [ ] phase1-mvp.md → Slice 4 ✅
- [ ] git commit: "Slice 4: text/prompt nodes (Prompt, Chat, Optimize, Analysis, Search)"
