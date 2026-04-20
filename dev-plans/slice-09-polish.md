# Slice 9: Theme, Language, Polish

**优先级**: P1 | **难度**: 低 | **预计**: 2 天 | **状态**: ⬜ 未开始
**依赖**: Slice 8 | **返回索引**: [phase1-mvp.md](phase1-mvp.md)

---

## 目标

实现暗色模式、中英文切换、落地页、404 页面、300 行代码审计和 PRD 验收清单最终检查。

---

## 前端步骤

### Step 1: Theme Store

**文件**: `frontend/src/store/themeStore.ts`

```
type Theme = "light" | "dark"

interface ThemeStore:
  theme: Theme
  setTheme(theme: Theme): void
  toggleTheme(): void

逻辑:
  初始化:
    - 从 localStorage 读 "tangent_theme"
    - 无值 → 检测系统偏好: window.matchMedia("(prefers-color-scheme: dark)")
    - 设置 document.documentElement.dataset.theme = theme

  setTheme(theme):
    - 更新 state.theme
    - localStorage.setItem("tangent_theme", theme)
    - document.documentElement.dataset.theme = theme
    - 切换 CSS 自定义属性 (通过 data-theme 属性选择器)

  toggleTheme():
    - theme === "light" ? setTheme("dark") : setTheme("light")
```

### Step 2: CSS 自定义属性切换

**文件**: `frontend/src/index.css` — 修改

```
/* 亮色模式 (默认) */
:root, [data-theme="light"] {
  --bg-canvas: #f5f5f5;
  --bg-surface: #ffffff;
  --bg-hover: #f5f5f5;
  --bg-input: #ffffff;
  --text-primary: #242424;
  --text-secondary: #898989;
  --text-placeholder: #a1a1a1;
  --border-ring: rgba(34, 42, 53, 0.08);
  --shadow-contact: rgba(19, 19, 22, 0.7);
  --shadow-diffuse: rgba(34, 42, 53, 0.05);
  --grid-dot: #d4d4d4;
  --node-selected: #6366F1;
}

/* 暗色模式 */
[data-theme="dark"] {
  --bg-canvas: #141414;
  --bg-surface: #1e1e1e;
  --bg-hover: #2a2a2a;
  --bg-input: #2a2a2a;
  --text-primary: #f5f5f5;
  --text-secondary: #a1a1a1;
  --text-placeholder: #6b6b6b;
  --border-ring: rgba(255, 255, 255, 0.04);
  --shadow-contact: rgba(0, 0, 0, 0.5);
  --shadow-diffuse: rgba(0, 0, 0, 0.3);
  --grid-dot: #2a2a2a;
  --node-selected: #818CF8;
}

使用方式:
  - 所有组件颜色改用 CSS 变量
  - background: var(--bg-surface)
  - color: var(--text-primary)
  - box-shadow 使用变量组合
```

### Step 3: 全局组件暗色适配

审查所有组件，将硬编码颜色替换为 CSS 变量：

```
需要适配的组件:

1. NodeBase.tsx:
   - 背景色: var(--bg-surface)
   - 阴影: ring var(--border-ring) + contact var(--shadow-contact) + diffuse var(--shadow-diffuse)

2. Canvas.tsx:
   - 背景: var(--bg-canvas)
   - 网格: var(--grid-dot)

3. TopBar.tsx:
   - 背景: var(--bg-surface)
   - 底线: var(--border-ring)

4. Toolbar.tsx:
   - 背景: var(--bg-surface)
   - 按钮 hover: var(--bg-hover)

5. NodePicker.tsx:
   - 背景: var(--bg-surface)
   - 卡片: 同 NodeBase

6. SkillPanel.tsx:
   - 背景: var(--bg-surface)

7. 所有页面 (Dashboard, Canvas, Upgrade 等):
   - body 背景: var(--bg-canvas)
   - 文字: var(--text-primary) / var(--text-secondary)

8. 按钮:
   - 主按钮: 保持 #242424 背景 (暗色模式也保持深色)
   - 幽灵按钮: var(--bg-surface) + ring shadow
```

### Step 4: i18n 配置

**文件**: `frontend/src/i18n/index.ts` — 修改

```
import i18n from "i18next"
import { initReactI18next } from "react-i18next"
import zh from "./locales/zh.json"
import en from "./locales/en.json"

i18n.use(initReactI18next).init({
  resources: {
    zh: { translation: zh },
    en: { translation: en },
  },
  lng: localStorage.getItem("tangent_lang") || "zh",
  fallbackLng: "zh",
  interpolation: { escapeValue: false },
})

export default i18n
```

### Step 5: 中文语言包

**文件**: `frontend/src/i18n/locales/zh.json`

```
{
  "common": {
    "save": "保存",
    "cancel": "取消",
    "delete": "删除",
    "confirm": "确认",
    "loading": "加载中...",
    "retry": "重试",
    "copied": "已复制 ✓",
    "download": "下载",
    "run": "Run",
    "runAll": "Run All",
    "stop": "停止",
    "saved": "已保存",
    "saveFailed": "保存失败，请重试",
    "typeMismatch": "类型不匹配"
  },
  "nav": {
    "dashboard": "我的工作流",
    "settings": "设置",
    "logout": "退出登录",
    "upgrade": "升级"
  },
  "dashboard": {
    "title": "我的工作流",
    "newWorkflow": "新建工作流",
    "emptyTitle": "还没有工作流",
    "emptyDesc": "创建你的第一个工作流，开始 AI 创意之旅",
    "emptyButton": "创建第一个工作流",
    "deleteConfirm": "确定要删除「{{name}}」吗？",
    "deleteWarning": "删除后无法恢复。",
    "confirmDelete": "确认删除"
  },
  "canvas": {
    "emptyHint": "双击画布添加节点，或选择一个 Skill 快速开始",
    "clickToRun": "点击 Run 生成",
    "unsaved": "有未保存的变更",
    "leaveConfirm": "有未保存的变更，确认离开？",
    "workflowGenerated": "工作流已生成，你可以调整任意节点参数",
    "executionComplete": "执行完毕 ✓ 耗时 {{seconds}} 秒",
    "executionPartial": "执行完毕（{{count}} 个节点失败）"
  },
  "nodes": {
    "prompt": {
      "title": "Prompt",
      "description": "提示词输入",
      "placeholder": "输入你的提示词..."
    },
    "chat": {
      "title": "Chat",
      "description": "AI 文字生成",
      "systemPrompt": "系统提示词",
      "thinking": "思考中...",
      "expand": "展开",
      "collapse": "收起"
    },
    "optimize": {
      "title": "Optimize",
      "description": "提示词优化",
      "types": {
        "general": "通用优化",
        "image_generation": "图片生成优化",
        "creative_writing": "创意写作优化"
      }
    },
    "analysis": {
      "title": "Analysis",
      "description": "图像分析",
      "reversePrompt": "反推 Prompt:",
      "descriptionLabel": "详细描述:",
      "connectImage": "请连接图片输入"
    },
    "search": {
      "title": "Search",
      "description": "热点搜索",
      "clickToSearch": "点击 Run 搜索",
      "searching": "搜索中...",
      "noResults": "未找到相关热点",
      "moreResults": "还有 {{count}} 条结果",
      "aiSummary": "AI 摘要"
    },
    "image_mj": {
      "title": "Midjourney V7",
      "description": "MJ V7 生图",
      "clickToGenerate": "点击 Run 生成",
      "generating": "生成中...",
      "refImage": "参考图片(选)"
    },
    "image_imagen": {
      "title": "Imagen 3",
      "description": "Google Imagen 3 生图"
    },
    "image_upload": {
      "title": "Image Upload",
      "description": "上传图片",
      "dragHere": "拖拽图片到此处",
      "orClick": "或点击选择文件",
      "supportedFormats": "支持 JPG/PNG/WebP",
      "maxSize": "最大 20MB",
      "fileTooLarge": "文件不能超过 20MB",
      "unsupportedFormat": "仅支持 JPG、PNG、WebP 格式",
      "uploadFailed": "上传失败，请重试"
    },
    "preview_wechat": {
      "title": "Preview: WeChat",
      "description": "公众号图文预览",
      "copyHtml": "复制 HTML",
      "downloadImages": "下载配图"
    },
    "preview_red": {
      "title": "Preview: RED",
      "description": "小红书卡片预览",
      "copyText": "复制文案",
      "downloadImages": "下载图片"
    }
  },
  "skills": {
    "title": "Skills",
    "wechatArticle": {
      "name": "公众号长文创作",
      "description": "从选题到成稿，自动生成公众号格式长文",
      "topic": "主题关键词",
      "topicRequired": "请输入主题",
      "style": "文章风格",
      "imageCount": "配图数量",
      "imageStyle": "配图风格",
      "imageModel": "图片生成模型",
      "generate": "生成工作流"
    },
    "redPost": {
      "name": "小红书图文笔记",
      "description": "一键生成小红书风格图文笔记",
      "topic": "主题",
      "topicRequired": "请输入主题",
      "postType": "类型",
      "imageCount": "图片数量",
      "imageRatio": "图片比例",
      "copyStyle": "文案风格",
      "imageModel": "图片生成模型",
      "generate": "生成工作流"
    },
    "moreComing": "更多 Skills 即将推出..."
  },
  "subscription": {
    "choosePlan": "选择适合你的方案",
    "subtitle": "按周执行时长计费，随时可升级或取消",
    "free": "Free",
    "starter": "Starter",
    "pro": "Pro",
    "perMonth": "€{{price}}/月",
    "currentPlan": "当前方案",
    "subscribe": "订阅",
    "comingSoon": "敬请期待",
    "recommended": "推荐",
    "manageSubscription": "管理订阅",
    "limitReached": "本周时长已用完",
    "limitReachedDesc": "本周 {{limit}} 已用完。升级 Starter 享受 {{newLimit}}。",
    "viewPlans": "查看套餐",
    "nextWeek": "下周再说",
    "subscribeSuccess": "订阅成功！时长已更新",
    "lowUsageWarning": "本周剩余不足 30 分钟，确定继续？",
    "weeklyMinutes": "{{minutes}} 分钟/周",
    "weeklyHours": "{{hours}} 小时/周"
  },
  "upgrade": {
    "title": "选择适合你的方案",
    "features": {
      "basicNodes": "基础节点",
      "allNodes": "全部节点",
      "priorityExecution": "优先执行",
      "storage": "{{size}} 存储"
    }
  },
  "landing": {
    "heroTitle": "AI 创意工作流画布",
    "heroSubtitle": "拖拽节点构建 AI 生产流水线，一站完成内容创作",
    "getStarted": "开始使用",
    "learnMore": "了解更多",
    "feature1Title": "可视化工作流",
    "feature1Desc": "拖拽节点、连线、配置参数，所见即所得",
    "feature2Title": "AI 驱动",
    "feature2Desc": "集成 Midjourney、Claude、Imagen 等顶级 AI 模型",
    "feature3Title": "一键输出",
    "feature3Desc": "直接生成公众号、小红书可发布格式"
  },
  "notFound": {
    "title": "页面未找到",
    "description": "你访问的页面不存在",
    "backHome": "返回首页"
  },
  "auth": {
    "login": "登录",
    "signup": "注册",
    "email": "邮箱地址",
    "emailPlaceholder": "请输入邮箱",
    "sendCode": "发送验证码",
    "codeSent": "已发送 ({{seconds}}s)",
    "enterCode": "请输入验证码",
    "googleLogin": "用 Google 登录",
    "or": "或",
    "noAccount": "没有账户？注册",
    "hasAccount": "已有账户？登录",
    "createAccount": "创建 TANGENT 账户",
    "welcomeTitle": "欢迎使用 TANGENT",
    "welcomeDesc": "开始你的 AI 创意之旅"
  },
  "errors": {
    "networkError": "网络连接断开，正在重连...",
    "serverError": "服务暂时不可用，请稍后重试",
    "timeout": "请求超时，请检查网络后重试",
    "authExpired": "登录已过期，请重新登录",
    "mjQueueFull": "MJ 队列繁忙，预计等待 {{minutes}} 分钟",
    "apiKeyInvalid": "图像生成服务暂时不可用",
    "contentViolation": "该内容不符合内容政策，请修改提示词后重试",
    "tokenExceeded": "文本过长，请缩短输入后重试（当前 {{current}} 字，上限 {{limit}} 字）"
  }
}
```

### Step 6: 英文语言包

**文件**: `frontend/src/i18n/locales/en.json`

```
{
  "common": {
    "save": "Save",
    "cancel": "Cancel",
    "delete": "Delete",
    "confirm": "Confirm",
    "loading": "Loading...",
    "retry": "Retry",
    "copied": "Copied ✓",
    "download": "Download",
    "run": "Run",
    "runAll": "Run All",
    "stop": "Stop",
    "saved": "Saved",
    "saveFailed": "Save failed, please retry",
    "typeMismatch": "Type mismatch"
  },
  "nav": {
    "dashboard": "My Workflows",
    "settings": "Settings",
    "logout": "Log out",
    "upgrade": "Upgrade"
  },
  "dashboard": {
    "title": "My Workflows",
    "newWorkflow": "New Workflow",
    "emptyTitle": "No workflows yet",
    "emptyDesc": "Create your first workflow to start your AI creative journey",
    "emptyButton": "Create First Workflow",
    "deleteConfirm": "Are you sure you want to delete \"{{name}}\"?",
    "deleteWarning": "This action cannot be undone.",
    "confirmDelete": "Confirm Delete"
  },
  "canvas": {
    "emptyHint": "Double-click canvas to add nodes, or select a Skill to get started",
    "clickToRun": "Click Run to generate",
    "unsaved": "Unsaved changes",
    "leaveConfirm": "You have unsaved changes. Are you sure you want to leave?",
    "workflowGenerated": "Workflow generated. You can adjust any node parameters.",
    "executionComplete": "Execution complete ✓ {{seconds}}s elapsed",
    "executionPartial": "Execution complete ({{count}} nodes failed)"
  },
  "nodes": { ... },  // 对应英文翻译
  "skills": { ... },
  "subscription": { ... },
  "upgrade": { ... },
  "landing": {
    "heroTitle": "AI Creative Workflow Canvas",
    "heroSubtitle": "Build AI production pipelines with drag-and-drop nodes, complete content creation in one place",
    "getStarted": "Get Started",
    "learnMore": "Learn More",
    "feature1Title": "Visual Workflow",
    "feature1Desc": "Drag nodes, connect, configure — what you see is what you get",
    "feature2Title": "AI Powered",
    "feature2Desc": "Integrated with Midjourney, Claude, Imagen and more",
    "feature3Title": "One-Click Output",
    "feature3Desc": "Generate publish-ready content for WeChat and RED"
  },
  "notFound": {
    "title": "Page Not Found",
    "description": "The page you are looking for does not exist",
    "backHome": "Back to Home"
  },
  "auth": { ... },
  "errors": { ... }
}
```

### Step 7: 语言切换组件

在 TopBar 中添加语言切换：

```
位置: 顶栏右侧, 主题切换按钮旁

显示:
  - 当前语言缩写: "CN" 或 "EN"
  - 点击切换: zh ↔ en

逻辑:
  - i18n.changeLanguage(newLang)
  - localStorage.setItem("tangent_lang", newLang)
  - 所有使用 t() 的文案自动更新

样式:
  - 幽灵按钮
  - 12px Inter, weight 600
  - Hover: #f5f5f5 背景
```

### Step 8: 主题切换组件

在 TopBar 中添加主题切换：

```
位置: 顶栏右侧, 语言切换旁

显示:
  - 亮色: ☀️ 图标
  - 暗色: 🌙 图标

逻辑:
  - themeStore.toggleTheme()

样式:
  - 幽灵按钮, 32px × 32px
  - Hover: #f5f5f5 背景
```

### Step 9: TopBar 组件

**文件**: `frontend/src/components/TopBar.tsx`

```
布局 (56px 高, 白底 / var(--bg-surface)):
  ┌──────────────────────────────────────────────────────────┐
  │ [Logo] [画布名 ●]            [Skills] [🌙][CN/EN][头像] │
  └──────────────────────────────────────────────────────────┘

左侧:
  - TANGENT Logo (Cal Sans 24px weight 600) → 链接到 /dashboard
  - 在 /canvas/:id 页面:
    - [←] 返回按钮
    - 工作流名称 (可双击编辑)
    - ● 未保存标记 (workflowStore.isDirty 时显示)
    - [保存] 按钮 (Cmd+S 提示)

右侧:
  - [Skills] 按钮 (在 /canvas 页面显示)
  - [🌙/☀️] 主题切换
  - [CN/EN] 语言切换
  - 头像 (click → 下拉菜单: 设置 / 升级 / 退出)

样式:
  - 底部 ring shadow: var(--border-ring) 0 0 0 1px
  - 固定在顶部, z-index: 50
```

### Step 10: BottomBar 组件

**文件**: `frontend/src/components/BottomBar.tsx`

```
布局 (40px 高, 白底):
  ┌──────────────────────────────────────────────────────────┐
  │ [59%] [对齐] [适应]      执行状态文字      [4:32:10]     │
  └──────────────────────────────────────────────────────────┘

左侧:
  - 缩放百分比 (59%)
  - 对齐网格开关
  - 适应按钮 (fitView)

中间:
  - 执行状态文字 (运行中/完成/失败)

右侧:
  - TimeRemaining 组件

样式:
  - 顶部 ring shadow
  - 固定在底部, z-index: 50
  - 仅在 /canvas/:id 页面显示
```

### Step 11: LandingPage

**文件**: `frontend/src/pages/LandingPage.tsx`

```
布局: 全屏, 纵向排列

Hero 区域 (居中, 垂直居中):
  ┌──────────────────────────────────────────────┐
  │                                              │
  │          TANGENT (Cal Sans 64px 600)          │
  │    AI 创意工作流画布 (Cal Sans 32px 300)     │
  │                                              │
  │  拖拽节点构建 AI 生产流水线                  │  ← Inter 16px
  │  一站完成内容创作                            │
  │                                              │
  │        [开始使用]  [了解更多]                 │  ← 按钮行
  │                                              │
  └──────────────────────────────────────────────┘

  "开始使用": #242424 主按钮 → /signup
  "了解更多": 幽灵按钮 → 页面内锚点 #features

特性区域 (三列):
  ┌────────────────┬────────────────┬────────────────┐
  │ 🎨             │ 🤖             │ 📤             │
  │ 可视化工作流    │ AI 驱动        │ 一键输出        │
  │ 拖拽节点...     │ 集成顶级...    │ 直接生成...    │
  └────────────────┴────────────────┴────────────────┘
  - 标题: Cal Sans 24px 600
  - 描述: Inter 14px
  - 使用 t() 国际化

CTA 区域:
  ┌──────────────────────────────────────────────┐
  │        准备好开始了吗？                        │  ← Cal Sans 32px 600
  │        [免费注册 →]                            │  ← #242424 主按钮
  └──────────────────────────────────────────────┘

样式:
  - 整体 var(--bg-canvas) 背景
  - 各区域白底卡片 + card shadow
  - 最大宽度 1200px, 居中
  - section 间距 120px
```

### Step 12: NotFoundPage

**文件**: `frontend/src/pages/NotFoundPage.tsx`

```
布局: 全屏居中

内容:
  ┌──────────────────────────┐
  │                          │
  │      404                 │  ← Cal Sans 96px 600, #898989
  │                          │
  │    页面未找到             │  ← Cal Sans 24px 600
  │    你访问的页面不存在      │  ← Inter 14px, #898989
  │                          │
  │    [返回首页]             │  ← #242424 主按钮 → /
  │                          │
  └──────────────────────────┘

使用 t() 国际化
```

### Step 13: App.tsx 路由更新

**文件**: `frontend/src/App.tsx` — 修改

```tsx
// 确保所有路由正确
<Route path="/" element={<LandingPage />} />
<Route path="/login" element={<LoginPage />} />
<Route path="/signup" element={<SignupPage />} />
<Route element={<ProtectedRoute />}>
  <Route path="/dashboard" element={<DashboardPage />} />
  <Route path="/canvas/:id" element={<CanvasPage />} />
  <Route path="/settings" element={<SettingsPage />} />
  <Route path="/upgrade" element={<UpgradePage />} />
</Route>
<Route path="*" element={<NotFoundPage />} />
```

### Step 14: 300 行代码审计

```
审查命令:
  find src -name '*.ts' -o -name '*.tsx' -o -name '*.py' | \
    xargs wc -l | sort -rn | head -30

审查规则:
  - 超过 300 行的文件必须拆分
  - 拆分优先级:
    1. 职责混杂 → 拆出 hooks
    2. 多组件堆叠 → 每组件独立文件
    3. 配置过长 → 拆到 types/ 或 lib/
    4. 样式内联 → 拆到 CSS Module

常见需拆分的文件:
  - Canvas.tsx → 拆出 CanvasEventHandler.ts
  - canvasStore.ts → 拆出 canvasHistory.ts (undo/redo 逻辑)
  - SkillConfigModal.tsx → 拆出 SkillFormFields.tsx
  - UpgradePage.tsx → 拆出 PlanCard.tsx
  - wechatArticle.ts / redPost.ts → 如超过 300 行，拆出 graphGenerators.ts
```

### Step 15: PRD 验收清单最终检查

逐条检查 PRD §15 MVP 验收清单：

```
用户系统:
  □ 邮箱注册完整流程
  □ 验证码 10 分钟有效
  □ 连续错误 5 次锁定 30 分钟
  □ Google OAuth 登录
  □ 已有账户数据保留
  □ JWT 7 天有效
  □ 未登录跳转 + 回跳

画布基础:
  □ 双击打开 NodePicker
  □ 拖拽节点 snap to grid
  □ 连线 + 类型校验
  □ 删除节点连带删除边
  □ Undo/Redo 50 步
  □ Cmd+S 保存 + toast
  □ 离开确认

节点执行:
  □ Prompt 节点数据传递
  □ Chat 节点输出文本
  □ Optimize 节点优化 Prompt
  □ Search 节点返回结果
  □ Analysis 节点图像分析
  □ MJ V7 生成 4 张图片
  □ Imagen 3 生成图片
  □ 失败红色边框 + 错误
  □ 可取消执行

Skills:
  □ 公众号 Skill 节点动画
  □ Preview:WeChat 显示 + 复制 HTML
  □ 小红书 Skill 节点动画
  □ Preview:RED 卡片预览 + 复制文案
  □ ZIP 下载

存储与下载:
  □ 图片放大查看
  □ 单图下载
  □ 刷新后图片可访问
  □ 防越权访问

订阅计费:
  □ 剩余时长显示
  □ 执行扣除时长
  □ 时长耗尽 Run 置灰 + 弹窗
  □ 周一重置
  □ Stripe 付款流程

主题/语言:
  □ 亮色/暗色切换 + 持久化
  □ 中英文切换 + 所有文案切换
```

---

## 验收清单

- [ ] 亮色/暗色切换即时生效
- [ ] 刷新后主题保持 (localStorage)
- [ ] 暗色模式: 画布背景 #141414, 节点背景 #1e1e1e
- [ ] 暗色模式: 文字颜色正确 (主 #f5f5f5, 次 #a1a1a1)
- [ ] 暗色模式: 阴影正确 (无白色 ring shadow)
- [ ] 暗色模式: 网格点 #2a2a2a
- [ ] 暗色模式: 所有组件适配 (无遗漏)
- [ ] 中英文切换即时生效
- [ ] 刷新后语言保持 (localStorage)
- [ ] 所有页面文案使用 t() 国际化 (无硬编码文字)
- [ ] LandingPage 正确渲染: hero + features + CTA
- [ ] LandingPage "开始使用" 跳转 /signup
- [ ] 404 页面正确显示 + "返回首页" 跳转 /
- [ ] 顶栏包含: Logo + 工作流名 + Skills + 主题 + 语言 + 头像
- [ ] 底栏包含: 缩放 + 对齐 + 适应 + 执行状态 + 时长
- [ ] TopBar 主题切换按钮正常 (☀️/🌙)
- [ ] TopBar 语言切换按钮正常 (CN/EN)
- [ ] `find src -name '*.ts' -o -name '*.tsx' | xargs wc -l | sort -rn | head -30` 所有文件 < 300 行
- [ ] 超过 300 行的文件已拆分
- [ ] PRD §15 所有验收项通过
- [ ] 所有文件 < 300 行

---

## 完成后更新

- [ ] 本文件状态 → ✅
- [ ] project_state.md → MVP 完成
- [ ] phase1-mvp.md → Slice 9 ✅, 全部标记完成
- [ ] git commit: "Slice 9: theme + i18n + landing page + 404 + code audit"
