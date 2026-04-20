# TANGENT — 节点开发计划（聚焦公众号 Skill）

**版本**: v2.0  
**日期**: 2026-04-20  
**策略**: 所有开发围绕「公众号长文创作」Skill 打通，其余节点进 Backlog

---

## 一、MVP 节点清单（公众号 Skill 必须）

共 **11 个节点**，按开发顺序排列：

| # | 节点 | 类型 | 是否新建 | 依赖 |
|---|------|------|---------|------|
| 1 | `text_input` | 输入 | 改造现有 | — |
| 2 | `research` | AI | 全新 | Tavily + Claude |
| 3 | `outline_generator` | AI | 全新 | Claude |
| 4 | `gate` | 交互 | 全新（架构创新） | 画布执行引擎 |
| 5 | `writer` | AI | 全新 | Claude |
| 6 | `reviewer` | AI | 全新 | Claude |
| 7 | `image_planner` | AI | 全新 | Claude |
| 8 | `image_gen` | AI | 简化现有 | Imagen 3 |
| 9 | `image_gallery` | 展示 | 全新 | — |
| 10 | `html_formatter` | 模板引擎 | 全新 | — |
| 11 | `preview_wechat` | 输出 | 改造现有 | — |

---

## 二、画布核心（Slice 3，所有节点的前置）

**在写任何节点之前，必须先建好以下基础设施：**

### 2.1 节点状态机

每个节点有 5 种状态：

| 状态 | 边框颜色 | 触发条件 |
|------|---------|---------|
| `idle` | 默认（灰） | 初始 / 上游未完成 |
| `running` | 蓝色脉冲 | 正在执行 |
| `waiting` | 琥珀色脉冲 🆕 | Gate 节点专用，等待用户操作 |
| `done` | 绿色（2s后恢复） | 执行成功 |
| `error` | 红色 | 执行失败 |

### 2.2 端口类型系统

| 类型 | 颜色 | 数据格式 |
|------|------|---------|
| `text` | 🔵 蓝 | `string` |
| `research_result` | 🟤 棕 | `ResearchResult` |
| `outline_options` | 🟣 紫 | `OutlineOption[]` |
| `image` | 🟢 绿 | `ImageAsset[]` |
| `image_slot` | 🟢 绿（虚线边） | `ImageAsset \| null` |
| `structured` | 🟡 黄 | `Record<string, unknown>` |

```typescript
// 核心数据类型
interface ImageAsset {
  url: string
  storage_path: string
  width?: number
  height?: number
  mime_type: string
}

interface ResearchResult {
  topic: string
  collected_at: string
  sources: { title: string; url: string; snippet: string }[]
  summary: string        // Markdown 汇总
}

interface OutlineOption {
  id: string
  title: string          // 文章标题
  angle: string          // 切入角度
  pros: string[]
  cons: string[]
  sections: { heading: string; word_count: number }[]
}
```

### 2.3 执行引擎

- DAG 拓扑排序
- 同层节点并发执行
- **Gate 节点遇到 `waiting` 状态时，暂停整条下游链**，上游其他分支继续
- WebSocket 推送节点状态变更
- 执行时长计量（写入 execution_logs）

### 2.4 画布交互

- 双击空白 → NodePicker 弹窗（从节点列表添加）
- 端口拖拽连线 → 类型校验（不匹配显示红色 tooltip）
- Cmd+S 保存 → graph_json 写入后端
- Cmd+Z / Cmd+Shift+Z 撤销重做（50步）
- Fit View / Zoom 控制

---

## 三、11 个节点详细规范

---

### 节点 1：`text_input` — 文本输入

**改造现有** · 计费: 免费

**端口**

| ID | 方向 | 类型 | 必填 |
|----|------|------|------|
| `out` | 输出 | `text` | — |

**配置项**
- 多行文本框（自动高度）
- Label 可自定义（默认「Text Input」）

**执行行为**: 透传文本，不调 API，瞬时完成。

---

### 节点 2：`research` — 深度调研

**全新** · 计费: 按调用次数（每轮搜索计 1 次）

**端口**

| ID | 方向 | 类型 | 必填 |
|----|------|------|------|
| `query` | 输入 | `text` | 是 |
| `out` | 输出 | `research_result` | — |

**配置项**
- `搜索轮次`: 3 / 5 / 8（默认 5）
- `时间范围`: 不限 / 最近一月 / 最近三月

**执行行为**
1. Claude 将输入关键词拆解为 N 个不同角度的 query
2. 并发调用 Tavily，N 轮搜索
3. Claude 汇总去重，标注信源，生成 `ResearchResult`

**节点显示（完成后）**
```
🔍 Research                    ✓
搜索 5 轮 · 引用 12 个信源
─────────────────────────────
[摘要前2行...]         [全文 ↗]
```

---

### 节点 3：`outline_generator` — 选题生成器

**全新** · 计费: 按 Token

**端口**

| ID | 方向 | 类型 | 必填 |
|----|------|------|------|
| `brief` | 输入 | `text` | 是 |
| `research` | 输入 | `research_result` | 是 |
| `out` | 输出 | `outline_options` | — |

**配置项**
- `选题数量`: 3 / 4（默认 3）

**执行行为**
调用 Claude，输出 N 个 `OutlineOption`（含标题、角度、优劣势、章节大纲）。

**节点显示（完成后）**
```
📑 Outline Generator           ✓
生成 3 个选题方向
─────────────────────────────
A. [标题A]
B. [标题B]
C. [标题C]
```

---

### 节点 4：`gate` — 人工决策门 ⭐ 架构核心

**全新** · 计费: 免费  
**唯一会暂停画布执行的节点**

**端口**

| ID | 方向 | 类型 | 说明 |
|----|------|------|------|
| `options_in` | 输入 | `outline_options` | select 模式专用 |
| `text_in` | 输入 | `text` | input 模式专用（素材清单） |
| `out` | 输出 | `text` | 用户选择/输入的内容 |

**配置项**
- `Mode`: `select`（选择门）/ `input`（输入门）
- `Title`: 临时节点的标题文字

**完整生命周期**

```
① 上游完成 → 数据到 Gate
② Gate 进入 waiting 状态（琥珀色边框脉冲）
③ 画布动态生成「临时交互节点」（靠近 Gate，动画出现）
④ 用户操作（选择 / 粘贴输入）
⑤ 临时节点淡出消失（200ms）
⑥ Gate 折叠显示：「✓ 已选：方向B」或「✓ 已输入（1,234字）」
⑦ Gate 进入 done 状态，数据往下流，恢复执行
```

**select 模式 临时节点 UI**
```
┌─────────────────────────────────────┐
│ 📋 请选择选题方向                    │
│ ─────────────────────────────────  │
│  A  [标题A]                         │
│     [角度一句话]              [选择] │
│  ──────────────────────────────── │
│  B  [标题B]                         │
│     [角度一句话]              [选择] │
│  ──────────────────────────────── │
│  C  [标题C]                         │
│     [角度一句话]              [选择] │
└─────────────────────────────────────┘
```

**input 模式 临时节点 UI**
```
┌─────────────────────────────────────┐
│ ✍️ 提供你的真实素材                  │
│ ─────────────────────────────────  │
│ 系统建议你提供：                     │
│ · 个人使用体验（具体细节）            │
│ · 真实数据或截图描述                  │
│ · 你的核心观点                       │
│ ─────────────────────────────────  │
│ [在这里粘贴你的素材...             ] │
│ [                                 ] │
│                      [确认提交 →]   │
└─────────────────────────────────────┘
```

**状态显示**

| 状态 | 边框 | 节点内容 |
|------|------|---------|
| `idle` | 默认 | 「等待上游数据」 |
| `waiting` | 琥珀色脉冲 | 「⏸ 等待你的选择」 |
| `done` | 绿色 | `✓ 已选：[内容]` 或 `✓ 已输入（N字）` |

---

### 节点 5：`writer` — 长文写作引擎

**全新** · 计费: 按 Token

**端口**

| ID | 方向 | 类型 | 必填 |
|----|------|------|------|
| `outline` | 输入 | `text` | 是（来自 Gate 选题输出） |
| `research` | 输入 | `research_result` | 是 |
| `materials` | 输入 | `text` | 是（来自 Gate 素材输入） |
| `out` | 输出 | `text` | — |

**配置项**
- `目标字数`: 1000 / 2000 / 3000 / 5000（默认 3000）
- `文章风格`: 深度解析 / 轻松科普 / 情感共鸣 / 干货清单

**执行行为**  
调用 Claude，综合三路输入撰写 Markdown 初稿。

**内置写作规则（System Prompt，不暴露）**
- 用真实经历/数据引入，禁止套话开头
- 所有数据来自 research 或 materials，不得编造
- 禁用词：在当今时代、综上所述、值得注意的是、不缺…缺的是…
- 超 30 字长句必须拆短，每段≤5行

---

### 节点 6：`reviewer` — 三遍审校链

**全新** · 计费: 按 Token（内部 3 次 Claude 调用）

**端口**

| ID | 方向 | 类型 | 必填 |
|----|------|------|------|
| `draft` | 输入 | `text` | 是 |
| `research` | 输入 | `research_result` | 是（事实核查用） |
| `out` | 输出 | `text` | — |

**配置项**: 无（三遍规则内置固定）

**执行行为（内部，用户不可见中间过程）**

```
Pass 1 — 事实核查
  核对数据、时间、产品名，与 research 信源交叉验证
  → 修正版文本

Pass 2 — 反AI洗稿
  删套话、拆排比、口语化、加个人态度
  参考风格：Keso/和菜头句式节奏（只借风格，不引原话）
  → 去AI化文本

Pass 3 — 节奏格式
  拆长句（>30字）、段落≤5行、标点优化
  → 最终成稿
```

**节点显示**
```
执行中：
✏️ Reviewer                  运行中
██████████░░░░░░  Pass 2/3
正在：反AI洗稿...

完成后：
✏️ Reviewer                     ✓
三遍审校完成 · 修改 47 处
─────────────────────────────
[成稿前3行...]            [全文 ↗]
```

---

### 节点 7：`image_planner` — 配图规划

**全新** · 计费: 按 Token

**端口**

| ID | 方向 | 类型 | 必填 |
|----|------|------|------|
| `article` | 输入 | `text` | 是（成稿 Markdown） |
| `out` | 输出 | `structured` | — |

**输出格式**
```typescript
interface ImagePlan {
  cover: {
    description: string   // 封面描述
    prompt: string        // Imagen 3 中文 Prompt（含16:9，含统一风格词）
  }
  images: {
    index: number         // 1-8
    position: string      // 在文章中的位置描述（第几段后）
    description: string
    prompt: string        // Imagen 3 中文 Prompt（含统一风格词）
  }[]
}
```

**配置项**
- `配图数量`: 3 / 5 / 8（默认 5）
- `图片风格`: 扁平插画+简笔画小人（默认）/ 写实 / 极简线条
- `图片比例`: 16:9 / 1:1 / 3:4

**执行行为**  
调用 Claude，分析文章结构，在合适段落标出插图位置，为每张图生成中文 Prompt，统一风格控制词前置。

**节点显示（完成后）**
```
🎨 Image Planner               ✓
规划 6 张配图 + 1 张封面
─────────────────────────────
封面: [描述...]
图1（第2段后）: [描述...]
图2（第4段后）: [描述...]
```

---

### 节点 8：`image_gen` — 图像生成（Imagen 3）

**简化现有** · 计费: 按次

**端口**

| ID | 方向 | 类型 | 必填 |
|----|------|------|------|
| `prompt` | 输入 | `text` | 是 |
| `out` | 输出 | `image` | — |

**配置项**
- `生成数量`: 1（Skill 中每个节点生成1张，多张用多个节点并行）
- `比例`: 16:9 / 1:1 / 3:4

**说明**  
Skill 中，image_planner 输出的每个 prompt 对应一个 image_gen 节点（由 Skill 模板自动创建，N 个并发执行）。

---

### 节点 9：`image_gallery` — 图片素材库

**全新** · 计费: 免费

**端口**

| ID | 方向 | 类型 | 说明 |
|----|------|------|------|
| `images_in` | 输入 | `image` | 所有生成图片汇入 |
| `cover_out` | 输出 | `image_slot` | 封面图 |
| `img_1_out` | 输出 | `image_slot` | 配图1 |
| `img_2_out` | 输出 | `image_slot` | 配图2 |
| `img_3_out` | 输出 | `image_slot` | 配图3 |
| `img_4_out` | 输出 | `image_slot` | 配图4 |
| `img_5_out` | 输出 | `image_slot` | 配图5 |
| `img_6_out` | 输出 | `image_slot` | 配图6 |
| `img_7_out` | 输出 | `image_slot` | 配图7 |
| `img_8_out` | 输出 | `image_slot` | 配图8 |

图片按收到顺序自动分配到各输出端口（cover → img_1 → img_2 ...）。

**节点 UI**
```
┌──────────────────────────────────┐
│ 🖼 Image Gallery  [打开素材库 ↗] │
│ [封面][图1][图2][图3][图4][图5]  │
└──────────────────────────────────┘
●cover_out
●img_1_out ... ●img_8_out
```

**素材库弹窗（全屏）**
- 网格展示所有图片
- 点击单图 → 右侧 AI 对话修改（描述需求 → 重新生成该图 → 替换或保留）
- 修改后自动更新对应输出端口的数据

---

### 节点 10：`html_formatter` — 微信 HTML 排版引擎

**全新** · 计费: 免费（纯模板引擎，不调 LLM）

**端口**

| ID | 方向 | 类型 | 说明 |
|----|------|------|------|
| `markdown_in` | 输入 | `text` | 成稿 Markdown |
| `cover_slot` | 输入 | `image_slot` | 封面图（可空） |
| `img_slot_1` | 输入 | `image_slot` | 配图1（可空） |
| `img_slot_2` | 输入 | `image_slot` | 配图2（可空） |
| `img_slot_3` | 输入 | `image_slot` | 配图3（可空） |
| `img_slot_4` | 输入 | `image_slot` | 配图4（可空） |
| `img_slot_5` | 输入 | `image_slot` | 配图5（可空） |
| `img_slot_6` | 输入 | `image_slot` | 配图6（可空） |
| `img_slot_7` | 输入 | `image_slot` | 配图7（可空） |
| `img_slot_8` | 输入 | `image_slot` | 配图8（可空） |
| `html_out` | 输出 | `structured` | `{ html: string }` |

**图片插槽逻辑**  
- 文章中 `[配图3]` 位置 → `img_slot_3` 有连线 → 替换为 `<img src="..." />`  
- `img_slot_3` 未连线 → 保留 `<!-- [配图3] 待手动插入 -->` 占位

**Markdown → HTML 映射规则（确定性，不走 LLM）**

| Markdown | 组件 |
|---------|------|
| `## 标题` | Heading 2（SVG 背景数字 01/02/03...） |
| `### 标题` | Heading 3（黑底白字） |
| `#### 标题` | Heading 4（主题色左竖线） |
| `> 引用` | Quote 卡片（左边框+阴影） |
| `` `==高亮==` `` | Highlight（紫底色） |
| `**加粗**` | Bold（主题色加粗） |
| 普通段落 | Paragraph（基础容器） |
| 代码块 | Code Block（macOS 风格黑底） |

**节点 UI**
```
┌────────────────────────────────┐
│ 📄 WeChat HTML             [✏️]│  ← 打开右侧品牌编辑器
│ 主题色: ████ #5965AF           │
│ ──────────────────────────── │
│ 图片插槽: 5/9 已连接            │
│ [HTML 片段预览...]             │
└────────────────────────────────┘
```

**右侧品牌编辑器（侧滑 Panel）**
- 主题色选择器（影响所有组件的 `#5965AF`）
- 正文字号 / 行高滑块
- 组件实时预览（改色即看效果）
- 「保存为默认」/ 「恢复默认」

**内置组件库**（与用户 HTML.md 完全一致，7个）：
Heading 2/3/4 · Quote · Highlight · Bold · Paragraph · Code Block

---

### 节点 11：`preview_wechat` — 公众号预览

**改造现有** · 计费: 免费

**端口**

| ID | 方向 | 类型 | 必填 |
|----|------|------|------|
| `html` | 输入 | `structured` | 是（`{ html: string }`） |

**节点 UI**
```
┌────────────────────────────────────┐
│ 📱 Preview: WeChat                 │
│ ──────────────────────────────── │
│  [公众号图文渲染区域]               │
│  白底 · 黑字 · 居中图片            │
│  H2带数字背景 · Quote带阴影         │
│ ──────────────────────────────── │
│ [复制 HTML] [全屏预览] [下载配图]   │
└────────────────────────────────────┘
```

- 「复制 HTML」→ 粘贴进微信编辑器即可发布
- 「下载配图」→ 触发 ZIP 下载所有嵌入图片
- 「全屏预览」→ 模拟手机屏幕宽度（375px）的渲染效果

---

## 四、完整画布连线

```
[Text Input: Brief]
        │ text
        ▼
[Research]─────────────────────────────────────────────────┐
        │ research_result                                   │ research_result
        ▼                                                   │
[Outline Generator]◄────────────────────────────────── research
        │ outline_options
        ▼
[GATE: 选题确认] ⏸ waiting
        │ text（选定标题+大纲）
        ▼
[Writer]◄────────────── outline（来自上方 Gate out）
        ◄────────────── research（来自 Research out）
        ◄────────────── materials（来自下方 Gate out）
        │
[GATE: 素材输入] ⏸ waiting ─────────────────────────────────┘
        │ text（用户素材）                  （materials 接到 Writer）
        
[Writer]
        │ text（初稿 Markdown）
        ▼
[Reviewer]◄──── research（事实核查）
        │ text（成稿 Markdown）
        ├──────────────────────────────────────┐
        ▼                                      ▼
[Image Planner]                       [HTML Formatter]
        │ structured（配图计划）        ●markdown_in
        │                              ●img_slot_1..8
        ▼                              ●cover_slot
[image_gen ×1] ← cover prompt               │
[image_gen ×1] ← img_1 prompt               │ structured {html}
[image_gen ×1] ← img_2 prompt               ▼
...（N个并行）                       [Preview: WeChat]
        │ image（各自1张）
        ▼
[Image Gallery]
  ●cover_out ──────────────────────→ html_formatter●cover_slot
  ●img_1_out ──────────────────────→ html_formatter●img_slot_1
  ●img_2_out ──────────────────────→ html_formatter●img_slot_2
  ...
```

---

## 五、开发顺序（线性，无跳跃）

```
Week 1-2：Slice 3 — 画布核心
  ├── NodeBase 组件（端口、状态机、Run按钮）
  ├── Edge 连线（类型校验、颜色标识）
  ├── NodePicker 弹窗
  ├── canvasStore（undo/redo 50步）
  ├── 后端：DAG 解析 + WebSocket 执行推送
  └── 新增 waiting 状态支持（Gate 专用）

Week 3：Slice 4 — 基础 AI 节点
  ├── text_input（简单，1天）
  ├── research（Tavily + Claude，2天）
  └── outline_generator（Claude，1天）

Week 4：Slice 4 续 — Gate + Writer + Reviewer
  ├── gate（select + input 两种模式，3天）
  ├── writer（Claude，1天）
  └── reviewer（三遍链，2天）

Week 5：Slice 5 — 图像链路
  ├── image_planner（Claude，1天）
  ├── image_gen / Imagen 3（2天）
  └── image_gallery（多端口 + 素材库弹窗，2天）

Week 6：Slice 6 — HTML 输出链路
  ├── html_formatter（模板引擎 + 图片插槽 + 品牌编辑器，3天）
  └── preview_wechat（HTML 渲染 + 复制 + 下载，2天）

Week 7：Slice 7 — Skill 模板
  ├── Skills 面板 UI
  ├── 公众号 Skill 模板定义（生成完整节点+连线+动画）
  └── 端到端测试：Brief → 预览 HTML 全流程跑通
```

---

## 六、Backlog（暂不开发）

以下节点已设计完成，等公众号 Skill 跑通后再开发：

**通用 AI 节点**
- `chat`（通用对话）
- `optimize`（Prompt 优化）
- `analysis`（图像分析）
- `search`（基础搜索，被 research 替代）
- `storyboard`（分镜）
- `translate`（翻译）
- `article`（TipTap 富文本）
- `trending`（热榜爬取）

**图像处理**
- `image_upload`（上传）
- `image_edit`（Fabric.js 画板）
- `image_bg_remove`（抠图）
- `image_grid`（拼图）
- `image_split`（拆图）
- `image_compress`（压缩）
- `image_view_angle`（视角变换）
- `image_mj`（Midjourney V7）
- `image_seedream`（Seedream 5.0）
- `image_niji`（Niji 7）

**视频 / 音频**
- 全部视频节点（Kling、Seedance、Vidu、Wan2.x 等）
- 全部音频节点（MiniMax Speech、Tencent Speech、MiniMax Music）

**输出 / 发布**
- `ppt`（Reveal.js 编辑器）
- `html_node`（Monaco 编辑器）
- `export_zip`
- `publish_wechat`（API 推送）
- `publish_red`（小红书）
- `preview_red`（小红书预览）

**工具**
- `note`（便利贴）
- `merge`（合并）
- `switch`（条件分支）
- `loop`（循环）

---

*目标：7 周内让「公众号长文创作」Skill 端到端跑通，从 Brief 输入到预览 HTML 一键完成。*
