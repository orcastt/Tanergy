# Slice 7: Skills System

**优先级**: P0 | **难度**: 中 | **预计**: 3 天 | **状态**: ⬜ 未开始
**依赖**: Slice 6 | **返回索引**: [phase1-mvp.md](phase1-mvp.md)

---

## 目标

实现 Skills 系统：用户选择预置 Skill（公众号长文创作、小红书图文笔记），填写配置后自动生成工作流节点链路，执行完成后在 Preview 节点中预览和导出结果。

---

## 前端步骤

### Step 1: Skill 定义 — 公众号长文创作

**文件**: `frontend/src/skills/definitions/wechatArticle.ts`

```
SkillDefinition 接口:
  {
    id: string
    name: string
    description: string
    icon: string
    configFields: ConfigField[]      // 配置表单字段
    generateGraph: (config: dict) => GraphDefinition  // 生成工作流图
  }

ConfigField:
  {
    key: string
    label: string
    type: "text" | "select" | "number"
    required: boolean
    defaultValue: any
    options?: { label: string, value: string }[]  // select 类型
  }

wechatArticle 定义:
  id: "wechat_article"
  name: "公众号长文创作"
  description: "从选题到成稿，自动生成公众号格式长文"
  icon: "📝"

  configFields:
    - key: "topic", label: "主题关键词", type: "text", required: true
    - key: "style", label: "文章风格", type: "select",
      options: [
        { label: "深度解析", value: "deep_analysis" },
        { label: "轻松科普", value: "light_science" },
        { label: "情感共鸣", value: "emotional" },
        { label: "干货清单", value: "checklist" },
      ],
      defaultValue: "checklist"
    - key: "imageCount", label: "配图数量", type: "select",
      options: [{label:"1",value:"1"},{label:"3",value:"3"},{label:"5",value:"5"}],
      defaultValue: "3"
    - key: "imageStyle", label: "配图风格", type: "select",
      options: [{label:"写实",value:"realistic"},{label:"插画",value:"illustration"},{label:"简约",value:"minimal"}],
      defaultValue: "realistic"
    - key: "imageModel", label: "图片生成模型", type: "select",
      options: [{label:"Midjourney V7",value:"image_mj"},{label:"Imagen 3",value:"image_imagen"}],
      defaultValue: "image_mj"

  generateGraph(config):
    返回节点和边的定义:

    节点:
      1. Search (id: "search_1")
         - position: (0, 0) 相对坐标
         - data: { resultCount: 10 }
         - 输出: search_result

      2. Chat:大纲 (id: "chat_outline")
         - position: (300, 0)
         - data: {
             systemPrompt: "你是一个专业的公众号内容策划师。根据搜索结果，生成一篇关于{topic}的{style}风格文章大纲。大纲应包含3-5个H2小标题，每个小标题下有2-3个要点。只输出大纲，不要正文。",
             temperature: 0.7
           }
         - 输入: text (从 search_1 的 search_result)
         - 输出: text

      3. Chat:正文 (id: "chat_article")
         - position: (600, 0)
         - data: {
             systemPrompt: "你是一个专业的公众号写手。根据大纲，撰写一篇{style}风格的完整文章。要求：2000-5000字，至少3个H2小标题，语言生动，段落清晰。输出纯 Markdown 格式。",
             temperature: 0.8
           }
         - 输入: text (从 chat_outline 的 text)
         - 输出: text

      4. Optimize (id: "optimize_1")
         - position: (900, -150)
         - data: {
             optimizationType: "image_generation",
             language: "zh"
           }
         - 输入: text (从 chat_article 的 text, 提取图片描述)
         - 输出: prompt

      5. Image×N (id: "image_1" ... "image_N")
         - position: (1200, -150) 起，纵向排列
         - data: { aspectRatio: "16:9", speedMode: config.imageModel === "image_mj" ? "fast" : undefined }
         - 输入: prompt (从 optimize_1)
         - 输出: image
         - 数量 = config.imageCount

      6. Preview:WeChat (id: "preview_wechat")
         - position: (1500, 0)
         - 输入: text (从 chat_article) + image (从所有 image 节点)
         - 输出: 无

    边:
      search_1[search_result] → chat_outline[text]
      chat_outline[text] → chat_article[text]
      chat_article[text] → optimize_1[text]
      chat_article[text] → preview_wechat[text]
      optimize_1[prompt] → image_1[prompt]
      ... (每个 image 节点)
      image_N[image] → preview_wechat[image]

    dagre 自动布局:
      - direction: "LR" (从左到右)
      - nodeSpacing: 80
      - rankSpacing: 300
      - 使用 dagre 算法计算最终坐标
      - 替换相对坐标为 dagre 计算结果
  ```

### Step 2: Skill 定义 — 小红书图文笔记

**文件**: `frontend/src/skills/definitions/redPost.ts`

```
redPost 定义:
  id: "red_post"
  name: "小红书图文笔记"
  description: "一键生成小红书风格图文笔记"
  icon: "📕"

  configFields:
    - key: "topic", label: "主题", type: "text", required: true
    - key: "postType", label: "类型", type: "select",
      options: [
        { label: "种草推荐", value: "recommendation" },
        { label: "教程攻略", value: "tutorial" },
        { label: "好物分享", value: "sharing" },
        { label: "生活记录", value: "lifestyle" },
      ],
      defaultValue: "recommendation"
    - key: "imageCount", label: "图片数量", type: "select",
      options: [{label:"1",value:"1"},{label:"3",value:"3"},{label:"6",value:"6"},{label:"9",value:"9"}],
      defaultValue: "6"
    - key: "imageRatio", label: "图片比例", type: "select",
      options: [{label:"1:1",value:"1:1"},{label:"3:4",value:"3:4"}],
      defaultValue: "3:4"
    - key: "copyStyle", label: "文案风格", type: "select",
      options: [
        { label: "活泼可爱", value: "lively" },
        { label: "简约高级", value: "minimal" },
        { label: "专业测评", value: "professional" },
      ],
      defaultValue: "lively"
    - key: "imageModel", label: "图片生成模型", type: "select",
      options: [{label:"Midjourney V7",value:"image_mj"},{label:"Imagen 3",value:"image_imagen"}],
      defaultValue: "image_mj"

  generateGraph(config):
    节点:
      1. Search (id: "search_1")
         - data: { resultCount: 10 }
      2. Chat:文案 (id: "chat_copy")
         - data: {
             systemPrompt: "你是小红书文案专家。根据搜索结果和主题「{topic}」，写一篇{copyStyle}风格的小红书笔记。要求：标题≤20字，正文100-500字，包含3-8个emoji，3-8个话题标签（#xxx）。输出格式：\n标题：...\n正文：...\n标签：...",
             temperature: 0.8
           }
      3. Optimize (id: "optimize_1")
         - data: { optimizationType: "image_generation", language: "zh" }
      4. Image×N (id: "image_1" ... "image_N")
         - data: { aspectRatio: config.imageRatio }
      5. Preview:RED (id: "preview_red")

    边:
      search_1 → chat_copy → optimize_1 → image_N → preview_red
      chat_copy → preview_red (text 直连)
      image_N → preview_red (image 连接)

    dagre 自动布局同上
```

### Step 3: SkillPanel 组件

**文件**: `frontend/src/skills/SkillPanel.tsx`

```
位置: 从左侧滑入，覆盖左侧工具栏区域
宽度: 320px
触发: 工具栏 Skills 按钮 / 顶栏 Skills 按钮

布局:
  ┌─────────────────────────────────┐
  │ Skills (Cal Sans 24px 600)  [×] │  ← 顶栏, 白底, ring shadow 底线
  ├─────────────────────────────────┤
  │                                 │
  │  ┌─────────────────────────┐    │
  │  │ 📝 公众号长文创作       │    │  ← 卡片样式
  │  │ 从选题到成稿...         │    │     card shadow
  │  │                    [→]  │    │     Hover → 阴影加深
  │  └─────────────────────────┘    │
  │                                 │
  │  ┌─────────────────────────┐    │
  │  │ 📕 小红书图文笔记       │    │
  │  │ 一键生成小红书...       │    │
  │  │                    [→]  │    │
  │  └─────────────────────────┘    │
  │                                 │
  │  更多 Skills 即将推出...         │  ← 灰色提示
  │                                 │
  └─────────────────────────────────┘

动画:
  - 滑入: transform translateX(-320px) → translateX(0), duration 200ms
  - 滑出: 反向

逻辑:
  - 点击 Skill 卡片 → 打开 SkillConfigModal
  - 点击 [×] 或 ESC → 关闭面板
```

### Step 4: SkillConfigModal 组件

**文件**: `frontend/src/skills/SkillConfigModal.tsx`

```
使用 Radix UI Dialog

Props:
  skill: SkillDefinition
  isOpen: boolean
  onClose: () => void

布局:
  ┌──────────────────────────────────────┐
  │ {skill.icon} {skill.name}            │  ← Cal Sans 24px 600
  │ {skill.description}                  │  ← Inter 14px, #898989
  ├──────────────────────────────────────┤
  │                                      │
  │ 主题关键词 *                         │  ← Inter 14px 500
  │ [________________________]           │  ← Input
  │                                      │
  │ 文章风格                             │
  │ [深度解析 ▼]                         │  ← Select
  │                                      │
  │ 配图数量                             │
  │ [1] [3] [5]                          │  ← 药丸按钮组
  │                                      │
  │ 配图风格                             │
  │ [写实] [插画] [简约]                  │  ← 药丸按钮组
  │                                      │
  │ 图片生成模型                         │
  │ [MJ V7] [Imagen 3]                   │  ← 药丸按钮组
  │                                      │
  ├──────────────────────────────────────┤
  │                  [取消] [生成工作流 ▶]│  ← 主按钮
  └──────────────────────────────────────┘

样式:
  - 白底, 16px 圆角, panel 阴影
  - 最大高度 80vh, 内容区可滚动
  - 宽度 520px

表单逻辑:
  - 根据 skill.configFields 动态生成表单
  - required 字段为空时 "生成工作流" 按钮置灰
  - 药丸按钮组: 选中 #242424, 未选中白底 + ring shadow

提交逻辑:
  - 校验所有 required 字段
  - 调用 skill.generateGraph(configValues)
  - 调用 useSkillApply().applySkill(graphDefinition)
  - 关闭 Modal
```

### Step 5: useSkillApply Hook

**文件**: `frontend/src/skills/hooks/useSkillApply.ts`

```
function useSkillApply():

  async applySkill(graph: GraphDefinition):
    """
    将 Skill 生成的图应用到画布。

    1. 清空当前画布 (如果已有节点):
       - 提示用户 "当前画布有内容，是否替换？"
       - 确认 → canvasStore.setGraphFromJson({ nodes: [], edges: [] })

    2. 节点逐个出现动画 (1.5 秒总时长):
       a. 计算每个节点的动画延迟:
          - 按拓扑顺序排列
          - 总时长 1500ms
          - 每个节点延迟 = index * (1500 / total_nodes)
       b. 依次添加节点:
          - 节点初始 opacity: 0, scale: 0.5
          - transition: opacity 300ms, transform 300ms
          - 到达延迟时间 → opacity: 1, scale: 1
       c. 节点全部出现后，连线逐条绘制:
          - 边初始 opacity: 0
          - CSS animation: drawLine 500ms forwards
          - 每条边延迟 100ms

    3. 动画完成后居中显示:
       - react-flow fitView({ padding: 0.2, duration: 500 })

    4. 显示 toast: "工作流已生成，你可以调整任意节点参数"

    5. 标记 dirty
    """

  返回: { applySkill }
```

### Step 6: Preview:WeChat 节点

**文件**: `frontend/src/nodes/preview/PreviewWechatNode.tsx`

```
使用 NodeBase 包裹

inputs:
  - { id: "text", type: "text", label: "文章内容" }
  - { id: "image", type: "image", label: "配图" }

outputs: []

内容区 — 文章预览:
  ┌───────────────────────────────────┐
  │ ┌───────────────────────────────┐ │
  │ │ 公众号文章预览                │ │  ← 预览容器, 浅灰背景
  │ │                               │ │
  │ │ 标题 (Cal Sans 20px 600)     │ │
  │ │ ─────────────────            │ │
  │ │ [配图 1]                      │ │  ← 8px 圆角
  │ │                               │ │
  │ │ 正文段落...                   │ │  ← Inter 14px
  │ │                               │ │
  │ │ ## 小标题                     │ │  ← Cal Sans 16px 600
  │ │ 正文...                       │ │
  │ │ [配图 2]                      │ │
  │ │ ...                           │ │
  │ └───────────────────────────────┘ │
  │                                   │
  │ [复制 HTML]  [下载配图]           │  ← 按钮行
  └───────────────────────────────────┘

逻辑:
  - 解析输入 text (Markdown):
    - 提取标题 (第一行或 # 开头)
    - 提取正文 (去除标题后的内容)
    - Markdown → HTML 渲染 (使用 marked 或简单正则)
  - 渲染配图 (从 image 输入)
  - 图片嵌入文章对应位置

  "复制 HTML" 按钮:
    - 将预览内容序列化为 HTML
    - 添加内联样式 (微信编辑器兼容):
      - font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue"
      - 字号、颜色、行高
    - navigator.clipboard.writeText(html)
    - 按钮文字变 "已复制 ✓" (2 秒后恢复)

  "下载配图" 按钮:
    - 打包所有配图为 ZIP (JSZip)
    - 文件名: tanvas_wechat_{date}.zip
    - 触发浏览器下载

节点数据:
  {
    articleHtml: string | null
    images: string[]
  }
```

### Step 7: Preview:RED 节点

**文件**: `frontend/src/nodes/preview/PreviewRedNode.tsx`

```
使用 NodeBase 包裹

inputs:
  - { id: "text", type: "text", label: "文案" }
  - { id: "image", type: "image", label: "图片" }

outputs: []

内容区 — 小红书卡片预览:
  ┌───────────────────────────────────┐
  │ ┌───────────────────────────────┐ │
  │ │ 小红书卡片预览                │ │
  │ │                               │ │
  │ │ [图片网格]                    │ │  ← 3:4 或 1:1 比例
  │ │  ┌─────┬─────┬─────┐         │ │
  │ │  │ img1│ img2│ img3│         │ │
  │ │  └─────┴─────┴─────┘         │ │
  │ │                               │ │
  │ │ 标题 (≤20字, 16px 600)       │ │
  │ │                               │ │
  │ │ 正文 (100-500字, 14px)        │ │
  │ │ emoji ✨🔥💡                  │ │
  │ │                               │ │
  │ │ #话题1 #话题2 #话题3 ...      │ │  ← #6366F1 蓝色
  │ │                               │ │
  │ └───────────────────────────────┘ │
  │                                   │
  │ [复制文案]  [下载图片]            │
  └───────────────────────────────────┘

逻辑:
  - 解析输入 text:
    - 提取标题行 (标题：xxx)
    - 提取正文 (正文：xxx)
    - 提取标签 (标签：xxx 或 #xxx)

  "复制文案" 按钮:
    - 格式化输出:
      标题行 + \n\n + 正文 + \n\n + 标签
    - navigator.clipboard.writeText(formattedText)
    - 按钮文字变 "已复制 ✓"

  "下载图片" 按钮:
    - JSZip 打包所有图片
    - 文件名: tanvas_red_{date}.zip

节点数据:
  {
    title: string | null
    body: string | null
    tags: string[]
    images: string[]
  }
```

### Step 8: ZipDownload 组件

**文件**: `frontend/src/components/ZipDownload.tsx`

```
安装依赖: npm install jszip file-saver
类型: npm install -D @types/file-saver

Props:
  images: { url: string, filename: string }[]
  zipFilename: string
  buttonLabel?: string
  onProgress?: (percent: number) => void

逻辑:
  async downloadAsZip():
    1. const zip = new JSZip()
    2. for each image:
       - fetch(image.url) → blob
       - zip.file(image.filename, blob)
       - onProgress?.(percent)
    3. const content = await zip.generateAsync({ type: "blob" })
    4. saveAs(content, zipFilename)

样式:
  - #242424 主按钮
  - 下载中显示进度条
  - 完成后显示 "下载完成 ✓" (2 秒后恢复)
```

### Step 9: dagre 自动布局

**文件**: `frontend/src/lib/layoutUtils.ts`

```
安装依赖: npm install dagre @types/dagre

function applyDagreLayout(
  nodes: Node[],
  edges: Edge[],
  direction: "LR" | "TB" = "LR"
): { nodes: Node[], edges: Edge[] }:
  """
  使用 dagre 计算节点布局。
  - direction: LR = 从左到右 (Skills 默认), TB = 从上到下
  - nodeWidth: 280 (NodeBase 固定宽度)
  - nodeHeight: 估计高度 (根据节点类型)
  - rankSpacing: 300 (层级间距)
  - nodeSpacing: 80 (同层节点间距)
  - 返回带新 position 的 nodes 和 edges
  """
```

### Step 10: 节点注册表更新

**文件**: `frontend/src/nodes/index.ts` — 修改

```
添加:
  preview_wechat: PreviewWechatNode
  preview_red: PreviewRedNode

NODE_DEFINITIONS 添加:
  preview_wechat: {
    type: "preview_wechat", label: "Preview: WeChat", icon: "📱",
    description: "公众号图文预览 + 复制 HTML",
    category: "output",
    inputs: [{ id: "text", type: "text" }, { id: "image", type: "image" }],
    outputs: [],
  }
  preview_red: { ... }
```

---

## 验收清单

- [ ] 点击工具栏 Skills 按钮，SkillPanel 从左侧滑入
- [ ] SkillPanel 显示两个内置 Skill 卡片
- [ ] 点击 Skill 卡片打开配置弹窗
- [ ] 配置弹窗动态渲染表单字段
- [ ] 必填字段为空时 "生成工作流" 按钮置灰
- [ ] 药丸按钮组选择正常 (风格/数量等)
- [ ] 公众号 Skill 生成工作流: Search → Chat(大纲) → Chat(正文) → Optimize → Image×N → Preview:WeChat
- [ ] 小红书 Skill 生成工作流: Search → Chat(文案) → Optimize → Image×N → Preview:RED
- [ ] 节点逐个出现动画 (1.5 秒总时长)
- [ ] 连线逐条绘制动画
- [ ] 生成完成后 fitView 居中显示
- [ ] 生成后显示 toast "工作流已生成"
- [ ] 公众号 Skill 执行完毕，Preview:WeChat 显示文章 HTML 预览
- [ ] "复制 HTML" 按钮复制内联样式的 HTML
- [ ] 复制后按钮变 "已复制 ✓"
- [ ] "下载配图" 按钮触发 ZIP 下载
- [ ] 小红书 Skill 执行完毕，Preview:RED 显示卡片样式预览
- [ ] 卡片预览包含: 图片网格 + 标题 + 正文 + emoji + 标签
- [ ] "复制文案" 复制标题+正文+标签
- [ ] "下载图片" ZIP 下载正常
- [ ] ZIP 文件名包含工作流名和日期
- [ ] dagre 自动布局正确 (无节点重叠)
- [ ] 所有文件 < 300 行

---

## 完成后更新

- [ ] 本文件状态 → ✅
- [ ] project_state.md → Slice 8
- [ ] phase1-mvp.md → Slice 7 ✅
- [ ] git commit: "Slice 7: skills system (WeChat article + RED post + preview nodes + ZIP)"
