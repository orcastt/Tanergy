# TANGENT — 节点开发完整计划

**版本**: v1.0  
**日期**: 2026-04-20  
**状态**: 规划中

---

## 目录

1. [端口数据格式规范](#1-端口数据格式规范)
2. [节点全景图](#2-节点全景图)
3. [每个节点详细说明](#3-每个节点详细说明)
4. [编辑器型节点（特殊）](#4-编辑器型节点特殊)
5. [Skills 详细规划](#5-skills-详细规划)
6. [开发优先级与分期](#6-开发优先级与分期)
7. [后端执行架构](#7-后端执行架构)

---

## 1. 端口数据格式规范

每个端口传递的是一个 **强类型 JSON 对象**，节点之间传递的是值的引用（URL），不传递二进制。

| 端口类型 | 颜色 | TypeScript 格式 | 说明 |
|---------|------|----------------|------|
| `prompt` | 🟣 紫 `#9333EA` | `string` | 提示词文本，可含 `{{variable}}` |
| `text` | 🔵 蓝 `#3B82F6` | `string` (Markdown) | 普通文本/长文/摘要 |
| `image` | 🟢 绿 `#22C55E` | `ImageAsset[]` | 图片数组，见下 |
| `video` | 🟠 橙 `#F97316` | `VideoAsset` | 单个视频 |
| `audio` | ⚪ 灰 `#A1A1AA` | `AudioAsset` | 单个音频 |
| `search_result` | 🔴 红 `#EF4444` | `SearchResult[]` | 搜索结果列表 |
| `structured` | 🟡 黄 `#EAB308` | `Record<string, unknown>` | 结构化 JSON，如大纲、配置 |

```typescript
// 图片资产
interface ImageAsset {
  url: string           // MinIO 永久访问 URL
  storage_path: string  // MinIO 内部路径（用于权限校验）
  width?: number
  height?: number
  mime_type: string     // "image/png" | "image/jpeg" | "image/webp"
  source?: string       // "midjourney" | "imagen" | "upload" | "generated"
}

// 视频资产
interface VideoAsset {
  url: string
  storage_path: string
  duration?: number     // 秒
  width?: number
  height?: number
  fps?: number
  mime_type: string     // "video/mp4"
  source?: string       // "kling" | "seedance" | "upload"
}

// 音频资产
interface AudioAsset {
  url: string
  storage_path: string
  duration?: number     // 秒
  mime_type: string     // "audio/mpeg" | "audio/wav"
  source?: string       // "minimax" | "tencent" | "upload"
}

// 搜索结果
interface SearchResult {
  title: string
  url: string
  snippet: string
  published_at?: string
  source?: string       // "tavily" | "wechat_trending" | "xiaohongshu"
}
```

**端口规则**：
- 相同类型才可连接（`image` → `image`，`prompt` → `prompt`）
- 一个输出端口可 fan-out 到多个输入（一对多）
- 一个输入端口只接受一条连线（防数据覆盖）
- 类型不匹配：端口高亮红色 + tooltip 「类型不匹配：xxx → yyy」

---

## 2. 节点全景图

### 分期总览

| 阶段 | 节点 | 说明 |
|------|------|------|
| **MVP (Slice 3-7)** | Prompt, Text Input, Chat, Optimize, Search, Analysis, Image Upload, MJ V7, Imagen 3, Preview:WeChat, Preview:RED | 两个 Skill 跑通 |
| **Phase 2** | Trending, Storyboard, Translate, Article, Seedream 5.0, Niji 7, Image Grid, Image Split, Image Compress, Background Remove, Export ZIP, Merge | 扩展生产力 |
| **Phase 3** | Image Edit (Fabric.js), PPT (Reveal.js), HTML (Monaco), Video×8, Audio×3, 2D→3D, Publish:WeChat, Publish:RED | 编辑器型节点 + 发布 |
| **Phase 4** | View Angle, Loop, Switch, Image Reference, Sora2, Wan2.x | 高级节点 |

### 节点分类全图

```
📥 输入类 (Input)
├── Text Input          [MVP]   — 纯文本输入框
├── Prompt              [MVP]   — 提示词编辑器，支持 {{变量}}
├── Image Upload        [MVP]   — 上传/粘贴图片
├── Video Upload        [P3]    — 上传视频素材
└── Audio Upload        [P3]    — 上传音频素材

✍️ 文本/AI 类 (Text)
├── Chat                [MVP]   — Claude LLM 对话生成
├── Optimize            [MVP]   — Prompt 优化器
├── Analysis            [MVP]   — 图像反推 Prompt + 描述
├── Search              [MVP]   — Tavily 搜索
├── Storyboard          [P2]    — 文本 → 分镜脚本列表
├── Translate           [P2]    — 多语言翻译
├── Article             [P2]    — 长文写作（含富文本编辑器）
└── Trending            [P2]    — 热点爬取（微信/小红书/通用）

🎨 图像生成类 (Image Gen)
├── MJ V7               [MVP]   — Midjourney V7
├── Imagen 3            [MVP]   — Google Imagen 3
├── Seedream 5.0        [P2]    — 字节跳动图像模型
└── Niji 7              [P2]    — Midjourney 动漫风格

🖼️ 图像处理类 (Image Process)
├── Image Edit          [P3]    — 内嵌 Fabric.js 画板（Inpaint/Outpaint）
├── Background Remove   [P2]    — AI 抠图
├── Image Grid          [P2]    — N 张图拼接成网格
├── Image Split         [P2]    — 网格图拆分成 N 张
├── Image Compress      [P2]    — 压缩/格式转换
├── View Angle          [P4]    — 视角变换（透视旋转）
└── Image Reference     [P4]    — 参考图透传（组织用）

🎬 视频类 (Video) — Phase 3
├── Kling 3.0           [P3]    — I2V / T2V
├── Kling 3.0-Omni      [P3]    — 全能版（角色一致性）
├── Seedance            [P3]    — 字节 I2V
├── Vidu                [P3]    — I2V / T2V
├── Wan2.6              [P3]    — 文生视频
├── Wan2.7 I2V          [P3]    — 图生视频
├── Sora2 Pro           [P4]    — OpenAI 视频
├── Video Analysis      [P3]    — 视频内容理解
├── Frame Extract       [P3]    — 视频抽帧 → 图片数组
└── Video to GIF        [P3]    — 视频转 GIF

🔊 音频类 (Audio) — Phase 3
├── MiniMax Speech      [P3]    — 文字转语音
├── Tencent Speech      [P3]    — 腾讯 TTS
└── MiniMax Music       [P3]    — 音乐生成

📊 输出/发布类 (Output)
├── Preview: WeChat     [MVP]   — 公众号图文预览
├── Preview: RED        [MVP]   — 小红书卡片预览
├── PPT                 [P3]    — Reveal.js PPT 编辑器（开子窗口）
├── HTML                [P3]    — Monaco 代码编辑器（开子窗口）
├── Export ZIP          [P2]    — 打包下载
├── Publish: WeChat     [P3]    — 推送到公众号草稿箱
└── Publish: RED        [P3]    — 小红书发布辅助

🔧 工具类 (Utility) — Phase 2+
├── Note                [P2]    — 便利贴（画布注释，无 I/O）
├── Merge               [P2]    — 合并多个同类输入
├── Switch              [P4]    — 条件分支
└── Loop                [P4]    — 数组遍历（并发或串行）
```

---

## 3. 每个节点详细说明

---

### 📥 输入类节点

---

#### `text_input` — Text Input
**分期**: MVP · **计费**: 免费

| 端口 | 方向 | 类型 | 数据格式 | 必填 |
|------|------|------|---------|------|
| `out` | 输出 | `text` | `string` | — |

**节点配置项（UI 内）**:
- 多行文本框（自动高度，最大 300px）
- 支持换行

**说明**: 最简单的输入节点，给下游提供静态文本。与 Prompt 的区别：Text Input 输出 `text` 类型（给 Chat/Optimize 用），Prompt 输出 `prompt` 类型（专门给图像生成节点用）。

**执行行为**: 直接透传文本值，不调用 API，瞬时完成。

---

#### `prompt` — Prompt
**分期**: MVP · **计费**: 免费

| 端口 | 方向 | 类型 | 数据格式 | 必填 |
|------|------|------|---------|------|
| `text_in` | 输入（可选） | `text` | `string` | 否 |
| `out` | 输出 | `prompt` | `string` | — |

**节点配置项**:
- 多行 Prompt 编辑器（支持 `{{variable}}` 占位符）
- 若有上游 `text` 输入，可在编辑器中用 `{{input}}` 引用

**执行行为**: 将编辑器内容与上游 `text` 合并，输出最终 prompt 字符串。

---

#### `image_upload` — Image Upload
**分期**: MVP · **计费**: 免费

| 端口 | 方向 | 类型 | 数据格式 | 必填 |
|------|------|------|---------|------|
| `out` | 输出 | `image` | `ImageAsset[]` | — |

**节点配置项**:
- 拖拽/点击上传区，支持多文件
- 支持格式：JPG / PNG / WebP
- 单文件上限：20MB
- 粘贴图片（Cmd/Ctrl+V）

**执行行为**: 
1. 用户拖入文件 → 立即上传到 MinIO → 获取永久 URL
2. 输出 `ImageAsset[]`（含所有上传图片）

---

#### `video_upload` — Video Upload
**分期**: Phase 3 · **计费**: 免费

| 端口 | 方向 | 类型 | 数据格式 | 必填 |
|------|------|------|---------|------|
| `out` | 输出 | `video` | `VideoAsset` | — |

**节点配置项**: 上传区（MP4 / MOV，≤500MB）

---

#### `audio_upload` — Audio Upload
**分期**: Phase 3 · **计费**: 免费

| 端口 | 方向 | 类型 | 数据格式 | 必填 |
|------|------|------|---------|------|
| `out` | 输出 | `audio` | `AudioAsset` | — |

**节点配置项**: 上传区（MP3 / WAV / M4A，≤100MB）

---

### ✍️ 文本/AI 类节点

---

#### `chat` — Chat
**分期**: MVP · **计费**: 按 Token（执行时长计量）

| 端口 | 方向 | 类型 | 数据格式 | 必填 |
|------|------|------|---------|------|
| `prompt` | 输入 | `prompt` | `string` | 否 |
| `text` | 输入 | `text` | `string` | 否 |
| `context` | 输入 | `search_result` | `SearchResult[]` | 否 |
| `out` | 输出 | `text` | `string` (Markdown) | — |

**节点配置项**:
- `System Prompt`：多行文本框（可折叠），预置模板按钮
- `Model`：下拉选择（claude-sonnet-4-6 / claude-haiku-4-5）
- `Temperature`：滑块 0.0 ~ 1.0（默认 0.7）
- `Max tokens`：数字输入（默认 4096）
- `Streaming`：开关（默认开，开启时节点内实时显示生成文本）

**执行行为**:
1. 将 `prompt` + `text` + `context` 拼合为完整消息
2. 调用 Claude API（流式 SSE）
3. 节点内实时显示生成文本（Streaming 模式）
4. 完成后输出完整 `text`

**节点内显示**:
- 执行中：滚动显示流式输出（最多显示最后 10 行）
- 完成：折叠显示前 200 字 + 「展开全文」

---

#### `optimize` — Optimize
**分期**: MVP · **计费**: 按 Token

| 端口 | 方向 | 类型 | 数据格式 | 必填 |
|------|------|------|---------|------|
| `prompt` | 输入 | `prompt` | `string` | 否 |
| `text` | 输入 | `text` | `string` | 否 |
| `out` | 输出 | `prompt` | `string` | — |

**节点配置项**:
- `Mode`：下拉选择
  - `Image Prompt`：优化为 AI 生图专用 Prompt（英文、精确、细节丰富）
  - `Article Title`：优化为吸引人的文章标题
  - `Social Copy`：优化为社交媒体文案
  - `Custom`：自定义优化规则（显示文本框）
- `Language`：保持原语言 / 强制英文 / 强制中文

**执行行为**: 调用 Claude API，按模式对输入文本进行改写/扩写，输出优化后 `prompt`。

---

#### `analysis` — Analysis
**分期**: MVP · **计费**: 按 Token（Claude Vision）

| 端口 | 方向 | 类型 | 数据格式 | 必填 |
|------|------|------|---------|------|
| `image` | 输入 | `image` | `ImageAsset[]` | 是 |
| `prompt_out` | 输出 | `prompt` | `string` | — |
| `text_out` | 输出 | `text` | `string` | — |

**节点配置项**:
- `Task`：下拉
  - `Reverse Prompt`：反推 Prompt（适合图生图参考）
  - `Describe`：详细描述图片内容
  - `Extract Text`：提取图中文字（OCR 增强）
  - `Custom`：自定义分析问题
- `Language`：中文 / English

**执行行为**: 将图片 URL 发给 Claude Vision，按 Task 输出结构化分析结果。`prompt_out` 给图像生成节点用，`text_out` 给 Chat/Article 用。

---

#### `search` — Search
**分期**: MVP · **计费**: 按调用次数

| 端口 | 方向 | 类型 | 数据格式 | 必填 |
|------|------|------|---------|------|
| `query` | 输入（可选） | `prompt` 或 `text` | `string` | 否 |
| `out` | 输出 | `search_result` | `SearchResult[]` | — |

**节点配置项**:
- `关键词`：文本框（若上游有连线则禁用，用上游值）
- `平台`：下拉
  - `通用搜索`（Tavily）[MVP]
  - `微信热榜` [P2]
  - `小红书热词` [P2]
- `返回数量`：5 / 10 / 20（默认 10）
- `时间范围`：不限 / 最近一周 / 最近一月

**执行行为**: 调用 Tavily API，返回 `SearchResult[]`。

---

#### `storyboard` — Storyboard
**分期**: Phase 2 · **计费**: 按 Token

| 端口 | 方向 | 类型 | 数据格式 | 必填 |
|------|------|------|---------|------|
| `text` | 输入 | `text` | `string` | 是 |
| `out` | 输出 | `structured` | `{ scenes: Scene[] }` | — |

```typescript
interface Scene {
  index: number
  title: string
  description: string    // 场景描述（中文）
  image_prompt: string   // 配图 Prompt（英文）
  duration?: number      // 建议时长（秒，视频分镜用）
}
```

**节点配置项**:
- `场景数量`：3 / 5 / 8 / 10
- `类型`：图文分镜 / 视频分镜 / PPT 大纲

**执行行为**: 调用 Claude，将输入文本拆解为结构化分镜，输出 JSON。

---

#### `translate` — Translate
**分期**: Phase 2 · **计费**: 按 Token

| 端口 | 方向 | 类型 | 数据格式 | 必填 |
|------|------|------|---------|------|
| `text` | 输入 | `text` 或 `prompt` | `string` | 是 |
| `out` | 输出 | `text` 或 `prompt` | `string` | — |

**节点配置项**: `目标语言`（中文 / 英文 / 日文 / 其他）

---

#### `article` — Article Writer
**分期**: Phase 2 · **计费**: 按 Token  
**特殊**: 输出可在节点内用 TipTap 富文本编辑器二次编辑

| 端口 | 方向 | 类型 | 数据格式 | 必填 |
|------|------|------|---------|------|
| `text` | 输入 | `text` | `string`（大纲或主题） | 是 |
| `context` | 输入（可选） | `search_result` | `SearchResult[]` | 否 |
| `images` | 输入（可选） | `image` | `ImageAsset[]` | 否 |
| `html_out` | 输出 | `structured` | `{ html: string, markdown: string }` | — |

**节点配置项**:
- `文章风格`：深度解析 / 轻松科普 / 情感共鸣 / 干货清单
- `字数目标`：1000 / 2000 / 3000 / 5000
- `语言`：中文 / English

**节点内编辑器**（Phase 2）:
- AI 生成后在节点内嵌入一个小型 TipTap 编辑器（折叠/展开）
- 可手动修改标题、段落
- 修改后的内容作为最终输出

---

#### `trending` — Trending
**分期**: Phase 2 · **计费**: 按调用次数

| 端口 | 方向 | 类型 | 数据格式 | 必填 |
|------|------|------|---------|------|
| `out` | 输出 | `search_result` | `SearchResult[]` | — |

**节点配置项**:
- `平台`：微信热榜 / 小红书热词 / 微博热搜 / 抖音热点
- `分类`：不限 / 科技 / 娱乐 / 财经 / 生活
- `数量`：10 / 20 / 50

**执行行为**: 爬取目标平台实时热榜，无输入依赖，直接输出热点列表。

---

### 🎨 图像生成类节点

---

#### `image_mj` — Midjourney V7
**分期**: MVP · **计费**: 按次（~0.04 USD/张）

| 端口 | 方向 | 类型 | 数据格式 | 必填 |
|------|------|------|---------|------|
| `prompt` | 输入 | `prompt` | `string` | 是 |
| `ref_image` | 输入（可选） | `image` | `ImageAsset[]` | 否 |
| `out` | 输出 | `image` | `ImageAsset[]`（4张） | — |

**节点配置项**:
- `Prompt 补充`：文本框（追加到上游 Prompt 后）
- `负向 Prompt`：`--no xxx`（折叠显示）
- `比例`：1:1 / 16:9 / 9:16 / 4:3 / 3:4
- `版本`：V7 / V6（默认 V7）
- `风格化`：0 ~ 1000（默认 100）
- `速度`：快速（Turbo）/ 标准 / 慢速（质量）
- `种子`：数字输入（可选，折叠）

**执行行为**:
1. 将 prompt + 配置参数组合成 MJ 指令
2. 调用 MJ API（webhook 轮询或 SSE）
3. 生成过程节点显示进度百分比（0→25→50→75→100%）
4. 完成后返回 4 张图 → 上传 MinIO → 输出 `ImageAsset[]`

**节点内显示**:
- 完成后：2×2 缩略图网格（每格可点击查看大图）
- 点击单张图：大图浮层（含下载、设为封面、发送给图像编辑节点）
- 「单独放大」按钮（调用 MJ Upscale）

---

#### `image_imagen` — Imagen 3
**分期**: MVP · **计费**: 按次

| 端口 | 方向 | 类型 | 数据格式 | 必填 |
|------|------|------|---------|------|
| `prompt` | 输入 | `prompt` | `string` | 是 |
| `out` | 输出 | `image` | `ImageAsset[]` | — |

**节点配置项**:
- `Prompt 补充`：文本框
- `生成数量`：1 / 2 / 4（默认 4）
- `比例`：1:1 / 16:9 / 9:16 / 4:3
- `负向 Prompt`：文本框（折叠）

**执行行为**: 调用 Google Vertex AI Imagen 3 API，直接同步返回图片，上传 MinIO，输出 `ImageAsset[]`。

---

#### `image_seedream` — Seedream 5.0
**分期**: Phase 2 · **计费**: 按次

| 端口 | 方向 | 类型 | 数据格式 | 必填 |
|------|------|------|---------|------|
| `prompt` | 输入 | `prompt` | `string` | 是 |
| `ref_image` | 输入（可选） | `image` | `ImageAsset[]` | 否 |
| `out` | 输出 | `image` | `ImageAsset[]` | — |

**节点配置项**: 比例 / 数量 / 风格 / 中文 Prompt 支持

**说明**: 字节跳动图像模型，对中文 Prompt 友好，特别适合小红书/公众号配图风格。

---

#### `image_niji` — Niji 7
**分期**: Phase 2 · **计费**: 按次

| 端口 | 方向 | 类型 | 数据格式 | 必填 |
|------|------|------|---------|------|
| `prompt` | 输入 | `prompt` | `string` | 是 |
| `out` | 输出 | `image` | `ImageAsset[]`（4张） | — |

**节点配置项**: 同 MJ V7，但风格固定为动漫/插画风。

---

### 🖼️ 图像处理类节点

---

#### `image_edit` — Image Edit（编辑器型）
**分期**: Phase 3 · **计费**: 按 API 调用  
**特殊**: 双击节点打开 **Fabric.js 画板子窗口**

| 端口 | 方向 | 类型 | 数据格式 | 必填 |
|------|------|------|---------|------|
| `image` | 输入 | `image` | `ImageAsset[]` | 是 |
| `prompt` | 输入（可选） | `prompt` | `string` | 否 |
| `out` | 输出 | `image` | `ImageAsset[]`（编辑后） | — |

**节点配置项（节点上）**:
- `模式`：Inpaint（局部重绘）/ Outpaint（扩展画布）/ Erase（擦除）
- `「打开编辑器」按钮`

**子窗口（Fabric.js 画板）**:
- 工具栏：画笔（遮罩）/ 橡皮 / 套索 / 撤销重做
- 画布：显示输入图片，用户用画笔涂抹想要修改的区域（遮罩）
- `Prompt`：描述想要生成的内容
- `Run`：将原图 + 遮罩 + Prompt 发给后端调用 Inpaint API
- 结果显示在子窗口内，可接受或重试
- 「确认」：关闭子窗口，结果写入节点输出

---

#### `image_bg_remove` — Background Remove
**分期**: Phase 2 · **计费**: 按次

| 端口 | 方向 | 类型 | 数据格式 | 必填 |
|------|------|------|---------|------|
| `image` | 输入 | `image` | `ImageAsset[]` | 是 |
| `out` | 输出 | `image` | `ImageAsset[]`（PNG 含透明通道） | — |

**执行行为**: 调用 Remove.bg API 或本地模型（REMBG）。

---

#### `image_grid` — Image Grid
**分期**: Phase 2 · **计费**: 免费（本地处理）

| 端口 | 方向 | 类型 | 数据格式 | 必填 |
|------|------|------|---------|------|
| `images` | 输入 | `image` | `ImageAsset[]`（2~9张） | 是 |
| `out` | 输出 | `image` | `ImageAsset[]`（1张合并图） | — |

**节点配置项**:
- `布局`：2×1 / 1×2 / 2×2 / 3×3 / 自动
- `间距`：0 / 4 / 8 / 16 px
- `背景色`：颜色选择器

**执行行为**: 后端用 Pillow 将多张图拼接成网格。

---

#### `image_split` — Image Split
**分期**: Phase 2 · **计费**: 免费

| 端口 | 方向 | 类型 | 数据格式 | 必填 |
|------|------|------|---------|------|
| `image` | 输入 | `image` | `ImageAsset[]`（1张） | 是 |
| `out` | 输出 | `image` | `ImageAsset[]`（N张） | — |

**节点配置项**: `切割方式`：2×2 / 3×3 / 4×4 / 自定义行列

---

#### `image_compress` — Image Compress
**分期**: Phase 2 · **计费**: 免费

| 端口 | 方向 | 类型 | 数据格式 | 必填 |
|------|------|------|---------|------|
| `image` | 输入 | `image` | `ImageAsset[]` | 是 |
| `out` | 输出 | `image` | `ImageAsset[]`（压缩后） | — |

**节点配置项**: `质量`（10~100，默认 80）/ `格式`（保持原格式 / 强制 WebP / 强制JPG）/ `最大边长`（不限 / 1024 / 2048 / 4096）

---

#### `image_view_angle` — View Angle
**分期**: Phase 4 · **计费**: 按次

| 端口 | 方向 | 类型 | 数据格式 | 必填 |
|------|------|------|---------|------|
| `image` | 输入 | `image` | `ImageAsset[]` | 是 |
| `prompt` | 输入（可选） | `prompt` | `string` | 否 |
| `out` | 输出 | `image` | `ImageAsset[]` | — |

**节点配置项**: `视角变换`：俯视 / 仰视 / 左侧 / 右侧 / 正面 / 自定义

---

#### `image_reference` — Image Reference
**分期**: Phase 4 · **计费**: 免费

透传节点，用于画布上组织多个参考图来源，集中输出给生成节点。

| 端口 | 方向 | 类型 | 数据格式 | 必填 |
|------|------|------|---------|------|
| `in_1` | 输入 | `image` | `ImageAsset[]` | 否 |
| `in_2` | 输入 | `image` | `ImageAsset[]` | 否 |
| `in_3` | 输入 | `image` | `ImageAsset[]` | 否 |
| `out` | 输出 | `image` | `ImageAsset[]`（合并） | — |

---

### 🎬 视频类节点（Phase 3）

---

#### `video_kling` — Kling 3.0
**分期**: Phase 3 · **计费**: 按次（按时长）

| 端口 | 方向 | 类型 | 数据格式 | 必填 |
|------|------|------|---------|------|
| `prompt` | 输入 | `prompt` | `string` | 是 |
| `image` | 输入（可选） | `image` | `ImageAsset[]`（首帧参考） | 否 |
| `out` | 输出 | `video` | `VideoAsset` | — |

**节点配置项**:
- `模式`：文生视频(T2V) / 图生视频(I2V)
- `时长`：5s / 10s
- `比例`：16:9 / 9:16 / 1:1
- `运动幅度`：低 / 中 / 高
- `摄像机运动`：静止 / 推进 / 拉远 / 左移 / 右移 / 旋转

**执行行为**: 调用 Kling API，异步等待（5-10分钟），进度轮询。

---

#### `video_kling_omni` — Kling 3.0-Omni
**分期**: Phase 3 · **计费**: 按次

与 Kling 3.0 类似，额外输入端口：
- `character_image`：角色参考图（保持角色一致性）
- `voice_audio`：配音文件

---

#### `video_seedance` — Seedance
**分期**: Phase 3 · **计费**: 按次

| 端口 | 方向 | 类型 | 数据格式 | 必填 |
|------|------|------|---------|------|
| `prompt` | 输入 | `prompt` | `string` | 是 |
| `image` | 输入（可选） | `image` | `ImageAsset[]` | 否 |
| `out` | 输出 | `video` | `VideoAsset` | — |

---

#### `video_wan26` — Wan2.6（文生视频）
**分期**: Phase 3 · **计费**: 按次

| 端口 | 方向 | 类型 | 数据格式 | 必填 |
|------|------|------|---------|------|
| `prompt` | 输入 | `prompt` | `string` | 是 |
| `out` | 输出 | `video` | `VideoAsset` | — |

---

#### `video_wan27_i2v` — Wan2.7 I2V（图生视频）
**分期**: Phase 3 · **计费**: 按次

| 端口 | 方向 | 类型 | 数据格式 | 必填 |
|------|------|------|---------|------|
| `image` | 输入 | `image` | `ImageAsset[]`（首帧） | 是 |
| `prompt` | 输入（可选） | `prompt` | `string` | 否 |
| `out` | 输出 | `video` | `VideoAsset` | — |

---

#### `video_analysis` — Video Analysis
**分期**: Phase 3 · **计费**: 按 Token

| 端口 | 方向 | 类型 | 数据格式 | 必填 |
|------|------|------|---------|------|
| `video` | 输入 | `video` | `VideoAsset` | 是 |
| `out` | 输出 | `text` | `string`（分析报告） | — |

**节点配置项**: `分析维度`：内容描述 / 情感分析 / 关键帧摘要 / 字幕提取

---

#### `video_frame_extract` — Frame Extract
**分期**: Phase 3 · **计费**: 免费（后端处理）

| 端口 | 方向 | 类型 | 数据格式 | 必填 |
|------|------|------|---------|------|
| `video` | 输入 | `video` | `VideoAsset` | 是 |
| `out` | 输出 | `image` | `ImageAsset[]`（N帧） | — |

**节点配置项**: `抽帧方式`：等间距（N帧）/ 关键帧 / 固定时间点

---

#### `video_to_gif` — Video to GIF
**分期**: Phase 3 · **计费**: 免费

| 端口 | 方向 | 类型 | 数据格式 | 必填 |
|------|------|------|---------|------|
| `video` | 输入 | `video` | `VideoAsset` | 是 |
| `out` | 输出 | `image` | `ImageAsset[]`（GIF 作为 image 处理） | — |

**节点配置项**: `帧率`：10 / 15 / 24 FPS / `分辨率`：原始 / 720p / 480p / `裁剪`：起止时间（秒）

---

### 🔊 音频类节点（Phase 3）

---

#### `audio_minimax_speech` — MiniMax Speech
**分期**: Phase 3 · **计费**: 按字数

| 端口 | 方向 | 类型 | 数据格式 | 必填 |
|------|------|------|---------|------|
| `text` | 输入 | `text` | `string` | 是 |
| `out` | 输出 | `audio` | `AudioAsset` | — |

**节点配置项**:
- `声音`：下拉选择（预置多个中文/英文声线，可预听）
- `语速`：0.5x ~ 2.0x
- `格式`：MP3 / WAV

---

#### `audio_tencent_speech` — Tencent Speech
**分期**: Phase 3 · **计费**: 按字数

同 MiniMax Speech，调用腾讯云 TTS API。

---

#### `audio_minimax_music` — MiniMax Music
**分期**: Phase 3 · **计费**: 按次

| 端口 | 方向 | 类型 | 数据格式 | 必填 |
|------|------|------|---------|------|
| `prompt` | 输入（可选） | `prompt` | `string`（音乐描述） | 否 |
| `out` | 输出 | `audio` | `AudioAsset` | — |

**节点配置项**: `风格`：流行 / 古典 / 电子 / 爵士 / 纯器乐 / `时长`：15s / 30s / 60s

---

### 📊 输出/发布类节点

---

#### `preview_wechat` — Preview: WeChat
**分期**: MVP · **计费**: 免费

| 端口 | 方向 | 类型 | 数据格式 | 必填 |
|------|------|------|---------|------|
| `text` | 输入 | `text` | `string` (Markdown/HTML) | 是 |
| `images` | 输入（可选） | `image` | `ImageAsset[]` | 否 |

**节点内显示**:
- 模拟公众号图文渲染（白底、黑字、居中图片、H2 小标题）
- 「复制 HTML」按钮 → 复制可粘贴进微信编辑器的 HTML
- 「下载配图」按钮 → 触发 ZIP 下载
- 「全屏预览」按钮 → 浮层大图预览

---

#### `preview_red` — Preview: RED
**分期**: MVP · **计费**: 免费

| 端口 | 方向 | 类型 | 数据格式 | 必填 |
|------|------|------|---------|------|
| `text` | 输入 | `text` | `string` | 是 |
| `images` | 输入（可选） | `image` | `ImageAsset[]` | 否 |

**节点内显示**:
- 模拟小红书卡片（白底红边、图片轮播、标题+正文+话题标签）
- 「复制文案」按钮（复制标题+正文+话题标签）
- 「下载图片」按钮（ZIP）
- 「全屏预览」

---

#### `ppt` — PPT（编辑器型）
**分期**: Phase 3 · **计费**: 按 Token（生成阶段）  
**特殊**: 双击节点打开 **Reveal.js 幻灯片编辑器子窗口**

| 端口 | 方向 | 类型 | 数据格式 | 必填 |
|------|------|------|---------|------|
| `structured` | 输入（可选） | `structured` | `{ outline: string[], images?: ImageAsset[] }` | 否 |
| `text` | 输入（可选） | `text` | `string`（大纲文字） | 否 |
| `images` | 输入（可选） | `image` | `ImageAsset[]` | 否 |
| `html_out` | 输出 | `structured` | `{ html: string, slides: Slide[] }` | — |

```typescript
interface Slide {
  index: number
  title: string
  content: string     // Markdown
  image_url?: string
  layout: "title" | "content" | "image-left" | "image-right" | "blank"
}
```

**执行行为（首次 Run）**:
1. 调用 Claude，将大纲/文本自动生成 Reveal.js HTML
2. 节点显示幻灯片数量和「打开编辑器」按钮

**子窗口（Reveal.js 编辑器）**:
- 左侧：幻灯片列表（缩略图，可拖拽排序）
- 中间：Reveal.js 实时预览
- 右侧：当前幻灯片编辑（标题、内容、图片、布局）
- 工具栏：添加幻灯片、删除、主题切换（Black/White/Night/Solarized）
- 「导出 HTML」：生成自包含 HTML 文件下载
- 「导出 PDF」：调用 print 打印为 PDF（Phase 4）

---

#### `html_node` — HTML
**分期**: Phase 3 · **计费**: 按 Token（生成阶段）  
**特殊**: 双击节点打开 **Monaco 代码编辑器子窗口**

| 端口 | 方向 | 类型 | 数据格式 | 必填 |
|------|------|------|---------|------|
| `text` | 输入（可选） | `text` | `string` | 否 |
| `prompt` | 输入（可选） | `prompt` | `string` | 否 |
| `images` | 输入（可选） | `image` | `ImageAsset[]` | 否 |
| `html_out` | 输出 | `structured` | `{ html: string }` | — |

**执行行为（首次 Run）**:
1. 调用 Claude，将 prompt/text 转换为 HTML 代码
2. 节点显示 HTML 代码片段预览和「打开编辑器」按钮

**子窗口（Monaco 编辑器）**:
- 左侧：Monaco Editor（语法高亮、代码补全）
- 右侧：实时 iframe 预览（debounce 500ms）
- 工具栏：格式化、AI 修改（输入需求 → Claude 改代码）、复制、下载 .html

---

#### `export_zip` — Export ZIP
**分期**: Phase 2 · **计费**: 免费

| 端口 | 方向 | 类型 | 数据格式 | 必填 |
|------|------|------|---------|------|
| `images` | 输入（可选） | `image` | `ImageAsset[]` | 否 |
| `videos` | 输入（可选） | `video` | `VideoAsset` | 否 |
| `text` | 输入（可选） | `text` | `string` | 否 |

**执行行为**: 后端将所有输入文件打包为 ZIP，生成临时下载链接，节点内显示「立即下载」按钮。

---

#### `publish_wechat` — Publish: WeChat
**分期**: Phase 3 · **计费**: 免费

| 端口 | 方向 | 类型 | 数据格式 | 必填 |
|------|------|------|---------|------|
| `text` | 输入 | `text` | `string`（HTML） | 是 |
| `images` | 输入（可选） | `image` | `ImageAsset[]` | 否 |

**节点配置项**:
- 微信公众号绑定（引导用户在设置中完成 OAuth 授权）
- `发布为`：草稿 / 直接发布

**执行行为**: 调用微信公众号 API，将文章保存为草稿或直接发布。

---

#### `publish_red` — Publish: RED（小红书）
**分期**: Phase 3 · **计费**: 免费

| 端口 | 方向 | 类型 | 数据格式 | 必填 |
|------|------|------|---------|------|
| `text` | 输入 | `text` | `string` | 是 |
| `images` | 输入（可选） | `image` | `ImageAsset[]` | 否 |

**注意**: 小红书无官方 API，Phase 3 方案为：
1. 格式化文案 + 图片供用户手动发布
2. 可能通过浏览器扩展自动填写（研究中）

---

### 🔧 工具类节点

---

#### `note` — Note（便利贴）
**分期**: Phase 2 · **计费**: 免费  
**特殊**: 无端口，仅用于画布注释

**节点配置项**: 多行文本编辑器 / 背景色选择（黄/蓝/绿/粉/白）/ 字体大小

---

#### `merge` — Merge
**分期**: Phase 2 · **计费**: 免费

| 端口 | 方向 | 类型 | 数据格式 | 必填 |
|------|------|------|---------|------|
| `in_1` | 输入 | `image` 或 `text` | 任意 | 否 |
| `in_2` | 输入 | 同 in_1 类型 | 任意 | 否 |
| `in_3` | 输入 | 同 in_1 类型 | 任意 | 否 |
| `out` | 输出 | 同输入类型 | 合并后数组 | — |

**说明**: 将多条同类型连线合并为一个数组输出，常用于把多个图像生成节点的结果汇聚给 Grid/Export。

---

#### `switch` — Switch（条件分支）
**分期**: Phase 4 · **计费**: 免费

| 端口 | 方向 | 类型 | 数据格式 | 必填 |
|------|------|------|---------|------|
| `in` | 输入 | 任意 | 任意 | 是 |
| `out_true` | 输出 | 任意 | 同输入 | — |
| `out_false` | 输出 | 任意 | 同输入 | — |

**节点配置项**: `条件表达式`（简单 JS-like 语法：如 `input.length > 3`）

---

#### `loop` — Loop
**分期**: Phase 4 · **计费**: 免费（执行内部节点计费）

输入一个数组，对每个元素执行内嵌子工作流，输出结果数组。（实现较复杂，Phase 4）

---

## 4. 编辑器型节点（特殊）

以下节点双击后打开子窗口编辑器，编辑完成后结果写回节点输出。

| 节点 | 触发方式 | 编辑器 | 输出 |
|------|---------|--------|------|
| `image_edit` | 双击 or「打开编辑器」按钮 | Fabric.js 画板（全屏/侧拉） | 编辑后图片 |
| `ppt` | 双击 or「打开编辑器」按钮 | Reveal.js 幻灯片编辑器 | HTML/Slide JSON |
| `html_node` | 双击 or「打开编辑器」按钮 | Monaco 代码编辑器 + iframe 预览 | HTML string |
| `article` | 「展开编辑」按钮（节点内） | TipTap 富文本（内嵌，可展开） | Markdown/HTML |

### 子窗口实现方案

```
CanvasPage
  └── NodeEditModal（全屏遮罩，z-index 1000）
       ├── FabricEditor.tsx        — image_edit
       ├── RevealEditor.tsx        — ppt
       ├── MonacoHTMLEditor.tsx    — html_node
       └── TipTapArticleEditor.tsx — article（内嵌在节点内）
```

- 子窗口通过 `useEditorStore` 全局状态控制开关
- 关闭子窗口时，将编辑结果写入对应节点的 `outputData`
- 写入后触发节点「已完成」状态，下游节点可取用

---

## 5. Skills 详细规划

Skills = 一键生成完整节点链路的模板系统。

### Skill 数据结构

```typescript
interface SkillDef {
  id: string
  name: string            // "小红书图文笔记"
  name_en: string         // "Xiaohongshu Post"
  description: string
  icon: string            // material icon name
  category: "social" | "content" | "design" | "video" | "custom"
  phase: "mvp" | "p2" | "p3"
  config_schema: ConfigField[]     // 配置弹窗字段定义
  node_template: NodeTemplate[]    // 生成的节点定义
  edge_template: EdgeTemplate[]    // 生成的连线定义
}
```

---

### Skill 1：小红书图文笔记 🔴（MVP 优先级 P0）

**链路**:
```
[Search: 热点]──●──→[Chat: 文案]──●──→[Preview: RED]
                                  │
                           [Optimize]──●──→[Image: MJ V7 ×N]──●──┘
```

**配置弹窗**:
| 字段 | 类型 | 必填 | 默认 |
|------|------|------|------|
| 主题 | 文本框 | ✅ | — |
| 类型 | 单选：种草 / 教程 / 好物 / 生活 | ❌ | 种草推荐 |
| 图片数量 | 单选：1 / 3 / 6 / 9 | ❌ | 6 |
| 图片比例 | 单选：1:1 / 3:4 | ❌ | 3:4 |
| 文案风格 | 单选：活泼可爱 / 简约高级 / 专业测评 | ❌ | 活泼可爱 |
| 生图模型 | 单选：MJ V7 / Imagen 3 | ❌ | MJ V7 |

**Chat 节点 System Prompt（预填）**:
```
你是专业的小红书内容创作者。根据输入主题和搜索热点，生成一篇小红书笔记。
格式要求：
- 标题：≤20字，含emoji，吸引人
- 正文：100-500字，口语化，含2-3个分段
- emoji：每段至少1个
- 话题标签：3-8个，格式 #话题
风格：{{文案风格}}
```

**Optimize 节点配置（预填）**: Mode = `Image Prompt`，Language = 英文

**生成图片数量**: 根据用户选择的图片数量，生成对应数量的 Image 节点（并联执行）

**验收标准**:
- Preview:RED 内显示小红书样式卡片
- 文案含标题 + 正文 + ≥3 emoji + 3-8 话题标签
- 「复制文案」一键复制
- 「下载图片」ZIP 下载

---

### Skill 2：公众号长文创作 📱（MVP 优先级 P0）

**链路**:
```
[Search]──●──→[Chat: 大纲]──●──→[Chat: 正文]──●──→[Preview: WeChat]
                                             │
                                      [Optimize]──●──→[Image ×N]──●──┘
```

**配置弹窗**:
| 字段 | 类型 | 必填 | 默认 |
|------|------|------|------|
| 主题关键词 | 文本框 | ✅ | — |
| 文章风格 | 单选：深度解析 / 轻松科普 / 情感共鸣 / 干货清单 | ❌ | 干货清单 |
| 配图数量 | 单选：1 / 3 / 5 | ❌ | 3 |
| 配图风格 | 单选：写实 / 插画 / 简约 | ❌ | 写实 |
| 生图模型 | 单选：MJ V7 / Imagen 3 | ❌ | MJ V7 |

**Chat:大纲 System Prompt（预填）**:
```
你是资深公众号编辑。根据搜索热点，生成一篇{{文章风格}}公众号文章的大纲。
格式：
- 标题（20-30字）
- 引言思路（2句）
- H2 小标题 × 4-6 个（每个含要点说明）
- 结语思路
```

**Chat:正文 System Prompt（预填）**:
```
根据以下大纲，撰写完整公众号文章正文。
要求：2000-5000字，{{文章风格}}，含配图说明（写[图片N]表示配图位置），结尾有互动引导。
```

**验收标准**:
- Preview:WeChat 内显示公众号样式
- 文章 2000-5000 字，≥3 H2 标题
- 「复制 HTML」可粘贴进微信编辑器
- 配图数量与配置一致

---

### Skill 3：PPT 一键生成 📊（Phase 3）

**链路**:
```
[Text Input: 主题]──●──→[Chat: PPT大纲]──●──→[PPT 节点（子编辑器）]
                                         │
                                  [Image ×N]──●──┘
```

**配置弹窗**:
| 字段 | 类型 | 必填 | 默认 |
|------|------|------|------|
| 演讲主题 | 文本框 | ✅ | — |
| 幻灯片数量 | 单选：8 / 12 / 16 / 20 | ❌ | 12 |
| 风格 | 单选：商务 / 学术 / 创意 / 极简 | ❌ | 商务 |
| 语言 | 单选：中文 / English | ❌ | 中文 |
| 是否含图 | 开关 | ❌ | 开 |

---

### Skill 4：视频脚本 + 分镜图 🎬（Phase 3）

**链路**:
```
[Text Input: 主题]──●──→[Chat: 脚本]──●──→[Storyboard]──●──→[Image ×N（每个分镜）]
                                                        │
                                                [Preview: 脚本预览]
```

---

### Skill 5：品牌全案设计 🎨（Phase 3）

**链路**:
```
[Text Input: 品牌名/定位]──●──→[Chat: 品牌策略]──●──→[Optimize ×3 风格]──●──→[Image ×9 素材]
                                                                              │
                                                                   [Image Grid]──●──→[Export ZIP]
```

---

### Skill 6：小红书热点追踪 🔥（Phase 2）

**链路**:
```
[Trending: 小红书]──●──→[Chat: 选题分析]──●──→[Chat: 笔记文案]──●──→[Preview: RED]
                    │                                           │
                    └──→[Optimize]──●──→[Image ×N]──●──────────┘
```

---

### Skills 面板 UI

```
┌─────────────────────────────────────────┐
│ ✨ Skills                           [X] │
├─────────────────────────────────────────┤
│ [社交媒体] [内容创作] [设计] [视频]       │
├─────────────────────────────────────────┤
│  ┌──────────────────────────────────┐  │
│  │ 🔴 小红书图文笔记          [MVP] │  │
│  │ 一键生成完整小红书笔记链路        │  │
│  │                          [使用→] │  │
│  └──────────────────────────────────┘  │
│  ┌──────────────────────────────────┐  │
│  │ 📱 公众号长文创作          [MVP] │  │
│  │ 搜索热点→撰文→配图→预览          │  │
│  │                          [使用→] │  │
│  └──────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

---

## 6. 开发优先级与分期

### Slice 3 — 画布核心（优先级 🔥🔥🔥）

**目标**: 让节点能在画布上拖拽、连线、执行，建立节点状态机。

**前端任务**:
- [ ] NodeBase 完善：端口点击拖线、hover 放大、类型标识颜色
- [ ] 连线 (Edge)：类型校验、颜色按端口类型、点击选中删除
- [ ] 节点状态机：`idle → running → done / error`，边框颜色动画
- [ ] 双击画布打开 NodePicker
- [ ] NodePicker：搜索、分类 Tab、点击添加节点到画布
- [ ] 节点内 Run 按钮：触发执行、可取消
- [ ] Toolbar：Run All、Fit View、Zoom In/Out、Undo/Redo
- [ ] canvasStore：完善 undo/redo（50步），节点数据更新
- [ ] 工作流 Cmd+S 保存

**后端任务**:
- [ ] `POST /workflows/{id}/execute` 接口（接受 node_id 或 "all"）
- [ ] DAG 解析，拓扑排序执行
- [ ] WebSocket (`/ws/execution/{job_id}`)：推送节点状态变更事件
- [ ] 执行时长计量（写入 execution_logs）

---

### Slice 4 — 文本类节点（优先级 🔥🔥）

**节点**: `text_input` / `prompt` / `chat` / `optimize` / `search` / `analysis`

**前端任务**:
- [ ] 每个节点的 React 组件（配置 UI + 结果显示）
- [ ] Chat 节点流式文本显示（SSE → 逐字渲染）
- [ ] Search 节点：结果列表（标题+摘要+链接，可折叠）
- [ ] Analysis 节点：图片预览 + 分析结果显示

**后端任务**:
- [ ] Claude API 集成（chat / optimize / analysis / streaming）
- [ ] Tavily API 集成（search）
- [ ] 每个节点类型的 executor 函数

---

### Slice 5 — 图像节点（优先级 🔥🔥）

**节点**: `image_upload` / `image_mj` / `image_imagen`

**前端任务**:
- [ ] image_upload：拖拽上传、多文件、粘贴、进度条
- [ ] image_mj / image_imagen：配置 UI、2×2 图片网格显示
- [ ] 图片大图浮层（点击缩略图 → 全屏查看 → 下载按钮）
- [ ] 图片发送到其他节点（右键菜单 → 「发送到...」）

**后端任务**:
- [ ] MinIO 上传接口（`POST /assets/upload`）
- [ ] MJ API 集成（webhook 回调 → 轮询状态）
- [ ] Imagen 3 API 集成（Vertex AI）
- [ ] 生成图片自动存入 assets 表

---

### Slice 6 — 执行引擎完善（优先级 🔥🔥）

- [ ] 并发控制（同层节点并发，不超过 10 个并发）
- [ ] 全局 Run All 按钮（顶栏）
- [ ] 部分失败处理：下游暂停，其他分支继续
- [ ] 执行时长实时显示（顶栏倒计时）
- [ ] 时长耗尽：按钮置灰 + 升级弹窗

---

### Slice 7 — Skills 系统（优先级 🔥🔥🔥）

- [ ] Skills 面板（左侧，滑入）
- [ ] SkillDef 数据结构 + 2个内置 Skill
- [ ] 配置弹窗（按 config_schema 动态渲染）
- [ ] 节点生成动画（1.5s，节点逐个出现）
- [ ] Preview:WeChat 节点完整实现
- [ ] Preview:RED 节点完整实现
- [ ] 下载 ZIP（后端打包接口）

---

### Phase 2 节点（Slice 10-12，Phase 2）

| 节点 | 优先级 | 依赖 |
|------|--------|------|
| Trending | P0 | Tavily + 热榜爬虫 |
| Storyboard | P1 | Chat 节点 |
| Seedream 5.0 | P0 | Seedream API |
| Niji 7 | P1 | MJ API |
| Image Grid | P1 | Pillow 后端 |
| Image Split | P1 | Pillow 后端 |
| Background Remove | P1 | Remove.bg API |
| Image Compress | P2 | Pillow 后端 |
| Export ZIP | P0 | MinIO ZIP |
| Merge | P1 | — |
| Article | P0 | Chat 节点 + TipTap |

---

### Phase 3 节点（优先级排序）

1. `image_edit`（Fabric.js）— 最复杂，最有差异化
2. `ppt`（Reveal.js）— 高频需求
3. `html_node`（Monaco）— 灵活输出
4. `video_kling` — 视频生成入口
5. `video_seedance`、`video_wan27_i2v`
6. 音频节点
7. `publish_wechat`（需微信认证号）

---

## 7. 后端执行架构

```
前端
  │  POST /workflows/{id}/execute { node_ids: [...] | "all" }
  │  WS  /ws/execution/{job_id}
  ▼
FastAPI
  ├── 解析 graph_json → DAG
  ├── 拓扑排序 → 分层执行计划
  ├── 创建 ExecutionJob（Redis 存储状态）
  ├── 逐层调用 execute_node(node, inputs)
  │     每个 node 执行完 → 推送 WS 事件
  │     { job_id, node_id, status, output, progress, error }
  └── 记录 execution_logs（时长计量）

节点 Executor 注册表:
  node_executors = {
    "chat": ChatExecutor,
    "optimize": OptimizeExecutor,
    "search": SearchExecutor,
    "analysis": AnalysisExecutor,
    "image_mj": MidjourneyExecutor,
    "image_imagen": ImagenExecutor,
    ...
  }

每个 Executor 接口:
  class BaseExecutor:
    async def execute(inputs: dict, config: dict) -> dict:
      ...  # 返回 { port_id: value, ... }
```

**WebSocket 事件格式**:
```json
{
  "type": "node_update",
  "job_id": "uuid",
  "node_id": "node-1",
  "status": "running | done | error",
  "progress": 75,
  "output": { "out": [...] },
  "error": null,
  "duration_ms": 3400,
  "timestamp": "2026-04-20T12:00:00Z"
}
```

---

*本文档是节点开发的权威参考。新增/修改节点时需同步更新此文件。*
