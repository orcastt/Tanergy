# Slice 7: html_formatter · preview_wechat

**优先级**: P0 | **难度**: 中 | **预计**: 2 天 | **状态**: ⬜ 未开始
**依赖**: Slice 6 | **返回索引**: [phase1-mvp.md](phase1-mvp.md)

---

## 目标

实现 MVP 公众号 Skill 的最后 2 个输出节点：html_formatter（将 Markdown 文章 + 配图转为微信兼容 HTML）和 preview_wechat（公众号文章预览 + 一键复制到剪贴板）。

---

## Rust 侧步骤

### Step 1: 扩展 execute_node

**文件**: `src-tauri/src/commands/execute.rs` — 新增分支

```rust
// "html_formatter"   → execute_html_formatter(input_data, db)
// "preview_wechat"   → 透传，纯前端节点（无 API 调用）
```

### Step 2: html_formatter 执行逻辑

**文件**: `src-tauri/src/commands/execute.rs` — 内部函数

```rust
// execute_html_formatter(input_data: Value, db: &Mutex<Connection>) -> Result<Value, String>
//   1. 从 input_data 取 "text"（reviewer 输出的 Markdown 文章）
//   2. 从 input_data 取 "images"（image_gen 输出的图片列表，可选）
//   3. 解密 Anthropic key
//   4. call_anthropic(
//        system: "你是微信公众号排版专家。将 Markdown 文章转换为微信编辑器兼容的 HTML。
//          要求：
//          - 使用内联样式（微信不支持 class 和外部 CSS）
//          - 字体：-apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif
//          - 正文字号 16px，行高 1.75，颜色 #333
//          - H2 字号 20px，加粗，上下边距 1.5em
//          - H3 字号 18px，加粗
//          - 段落间距 1em
//          - 图片居中，max-width 100%，圆角 8px
//          - 引用块：左边框 3px #ddd，背景 #f8f8f8，内边距 1em
//          - 代码块：背景 #f5f5f5，等宽字体，内边距
//          直接输出 HTML，不要包裹 <html><body>，从正文内容开始。",
//        messages: [{
//          role: "user",
//          content: format!("文章 Markdown:\n{}\n\n图片资源:\n{}",
//            text,
//            images.iter().map(|img| format!("- 位置: {}, 文件: {}", img.position, img.file_path))
//              .collect::<Vec<_>>().join("\n")
//          )
//        }],
//        max_tokens: 8192,
//      )
//   5. 将图片引用替换为本地文件路径标记（前端加载时读取）
//   6. 保存 HTML 到 assets:
//      INSERT INTO assets (workflow_id, node_id, type, file_path)
//      file_path = {workspace}/assets/{workflow_id}/{node_id}_formatted.html
//   7. 返回 { "html": html_string, "html_path": file_path }
```

---

## 前端步骤

### Step 3: HtmlFormatterNode 组件

**文件**: `frontend/src/nodes/html_formatter/HtmlFormatterNode.tsx`

```
使用 NodeBase 包裹

inputs:
  - { id: "text", type: "text", label: "文章内容" }
  - { id: "image_slot", type: "image_slot", label: "配图" }（可选）
outputs:
  - { id: "structured", type: "structured", label: "HTML" }

内容区 - 配置:
  - 排版风格: select
    选项: 经典 / 简约 / 活泼 / 专业
  - 字号: select (14px / 16px / 18px, 默认 16px)
  - 行高: select (1.5 / 1.75 / 2.0, 默认 1.75)

内容区 - 结果:
  - 未执行: "点击 Run 排版"
  - 执行中: 旋转 + "排版中..."
  - 成功: HTML 预览
    ┌───────────────────────────┐
    │ ┌───────────────────────┐ │
    │ │ 渲染的 HTML 预览      │ │  ← iframe sandbox 渲染
    │ │ （缩放至节点宽度）     │ │
    │ └───────────────────────┘ │
    │                           │
    │ 字数: 3,542               │  ← 统计信息
    │ 预计阅读: 8 分钟          │
    ├───────────────────────────┤
    │ [复制 HTML]  [编辑 HTML]  │
    └───────────────────────────┘

  - "编辑 HTML" → 展开代码编辑器（monaco-editor 或 textarea）
  - 失败: 红色错误

节点数据:
  {
    style: string
    fontSize: number
    lineHeight: number
    html: string | null
    htmlPath: string | null
    wordCount: number | null
    error: string | null
  }
```

### Step 4: PreviewWechatNode 组件

**文件**: `frontend/src/nodes/preview_wechat/PreviewWechatNode.tsx`

```
使用 NodeBase 包裹

inputs:
  - { id: "structured", type: "structured", label: "排版 HTML" }
outputs: []

内容区 — 文章预览:
  ┌───────────────────────────────────┐
  │ ┌───────────────────────────────┐ │
  │ │ 公众号文章预览                │ │  ← 模拟手机屏幕
  │ │                               │ │  宽度 375px，居中
  │ │ 标题 (20px 600)              │ │  白底，带内边距
  │ │ ─────────────────            │ │
  │ │ 作者信息区                    │ │  灰色小字
  │ │                               │ │
  │ │ [配图 1]                      │ │  8px 圆角
  │ │                               │ │
  │ │ 正文段落...                   │ │
  │ │                               │ │
  │ │ ## 小标题                     │ │
  │ │ 正文...                       │ │
  │ │ [配图 2]                      │ │
  │ │ ...                           │ │
  │ └───────────────────────────────┘ │
  │                                   │
  │ [复制到剪贴板]  [下载配图 ZIP]    │
  └───────────────────────────────────┘

逻辑:
  - 接收 structured 输入（html_formatter 的 HTML）
  - 用 iframe sandbox 渲染 HTML
  - iframe 高度自适应内容

  "复制到剪贴板":
    - 将 HTML 加上内联样式（确保微信编辑器兼容）
    - navigator.clipboard.write([
        new ClipboardItem({
          'text/html': new Blob([html], { type: 'text/html' }),
          'text/plain': new Blob([plainText], { type: 'text/plain' }),
        })
      ])
    - 按钮变 "已复制 ✓" (2 秒后恢复)
    - toast "已复制，可直接粘贴到微信公众号编辑器"

  "下载配图 ZIP":
    - invoke('export_assets', { workflowId })
    - Tauri 文件保存对话框
    - 或调用 @tauri-apps/api/dialog.save() 选择保存位置

节点数据:
  {
    html: string | null
    copied: boolean
  }
```

### Step 5: 微信预览样式

**文件**: `frontend/src/nodes/preview_wechat/wechatPreview.css`

```css
/* 模拟微信公众号文章预览的样式 */
.wechat-preview-container {
  width: 375px;
  margin: 0 auto;
  background: #ffffff;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  max-height: 500px;
  overflow-y: auto;
}

.wechat-preview-header {
  padding: 20px 16px 12px;
  border-bottom: 1px solid #eee;
}

.wechat-preview-body {
  padding: 16px;
}

.wechat-preview-body img {
  max-width: 100%;
  border-radius: 8px;
  margin: 12px 0;
}
```

### Step 6: 更新节点注册表

**文件**: `frontend/src/nodes/nodeDefs.ts` — 确认 2 个节点定义

```
html_formatter:
  inputs: [{ id: "text", type: "text" }, { id: "image_slot", type: "image_slot" }]
  outputs: [{ id: "structured", type: "structured" }]
  category: "output"

preview_wechat:
  inputs: [{ id: "structured", type: "structured" }]
  outputs: []
  category: "output"
```

确认新增端口类型:
- `structured` — 结构化数据（黄色 #EAB308）

### Step 7: 完整链路验证 — 11 节点

至此 MVP 全部 11 个节点定义和实现完成:

```
text_input → research → outline_generator → gate → writer → reviewer
                                                         ↓
                                              image_planner → image_gen → image_gallery
                                                         ↓
                                              html_formatter → preview_wechat
```

---

## 验收清单

- [ ] HtmlFormatterNode 接收 Markdown + 图片，Claude 生成微信兼容 HTML
- [ ] HTML 使用内联样式（无 class、无外部 CSS）
- [ ] HTML 预览在节点内正确渲染（iframe sandbox）
- [ ] 字数统计和阅读时间正确显示
- [ ] "编辑 HTML" 展开代码编辑器
- [ ] PreviewWechatNode 接收 HTML，模拟手机屏幕预览
- [ ] 预览宽度 375px，样式接近微信公众号
- [ ] "复制到剪贴板" 同时复制 text/html 和 text/plain
- [ ] 粘贴到微信编辑器后格式保持（内联样式）
- [ ] "下载配图 ZIP" 正常工作（Tauri 文件保存对话框）
- [ ] 上游输出正确传递: reviewer → html_formatter → preview_wechat
- [ ] 完整 11 节点链路可跑通
- [ ] 所有文件 < 300 行

---

## 完成后更新

- [ ] 本文件状态 → ✅
- [ ] project_state.md → Slice 8
- [ ] phase1-mvp.md → Slice 7 ✅
- [ ] git commit: "Slice 7: html_formatter + preview_wechat nodes"
