# Slice 9: 主题 + 语言 + 桌面安装包

**优先级**: P1 | **难度**: 低 | **预计**: 2 天 | **状态**: ⬜ 未开始
**依赖**: Slice 8 | **返回索引**: [phase1-mvp.md](phase1-mvp.md)

---

## 目标

实现暗色模式、中英文切换、桌面端打包配置（macOS .dmg / Windows .msi），以及 300 行代码审计和 PRD 验收清单最终检查。完成后 MVP 可分发。

---

## 前端步骤

### Step 1: Theme Store

**文件**: `frontend/src/store/themeStore.ts`

```typescript
type Theme = "light" | "dark";

interface ThemeStore {
  theme: Theme;
  setTheme(theme: Theme): void;
  toggleTheme(): void;
}

// 初始化:
//   - 从 localStorage 读 "tangent_theme"
//   - 无值 → 检测系统偏好 prefers-color-scheme
//   - 设置 document.documentElement.dataset.theme = theme

// setTheme:
//   - 更新 state
//   - localStorage 持久化
//   - document.documentElement.dataset.theme = theme

// toggleTheme: light ↔ dark
```

### Step 2: CSS 自定义属性切换

**文件**: `frontend/src/index.css` — 修改

```css
/* 亮色模式 */
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
```

### Step 3: 全局组件暗色适配

审查所有组件，将硬编码颜色替换为 CSS 变量：

```
需要适配的文件:
  NodeBase.tsx     → var(--bg-surface), 阴影变量
  Canvas.tsx       → var(--bg-canvas), var(--grid-dot)
  TopBar.tsx       → var(--bg-surface), var(--border-ring)
  Toolbar.tsx      → var(--bg-surface), var(--bg-hover)
  NodePicker.tsx   → var(--bg-surface)
  SkillPanel.tsx   → var(--bg-surface)
  所有页面         → var(--bg-canvas), var(--text-primary)
```

### Step 4: i18n 配置

**文件**: `frontend/src/i18n/index.ts`

```typescript
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import zh from "./locales/zh.json";
import en from "./locales/en.json";

i18n.use(initReactI18next).init({
  resources: { zh: { translation: zh }, en: { translation: en } },
  lng: localStorage.getItem("tangent_lang") || "zh",
  fallbackLng: "zh",
  interpolation: { escapeValue: false },
});
```

### Step 5: 中文语言包

**文件**: `frontend/src/i18n/locales/zh.json`

```json
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
    "saveFailed": "保存失败，请重试"
  },
  "nav": {
    "dashboard": "我的工作流",
    "settings": "设置"
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
  "welcome": {
    "title": "TANGENT",
    "subtitle": "AI 创意工作流画布",
    "getStarted": "开始使用",
    "licenseTitle": "输入 License Key",
    "activate": "激活",
    "freeTrial": "免费试用 14 天",
    "apiKeysTitle": "配置你的 AI API Key",
    "apiKeysDesc": "TANGENT 使用你自己的 API Key，不经过任何中间服务器",
    "skip": "跳过，稍后配置",
    "done": "完成"
  },
  "canvas": {
    "emptyHint": "双击画布添加节点，或选择一个 Skill 快速开始",
    "unsaved": "有未保存的变更",
    "leaveConfirm": "有未保存的变更，确认离开？",
    "workflowGenerated": "工作流已生成，你可以调整任意节点参数",
    "executionComplete": "执行完毕 ✓ 耗时 {{seconds}} 秒",
    "executionPartial": "执行完毕（{{count}} 个节点失败）"
  },
  "settings": {
    "title": "设置",
    "apiKeys": "API Keys",
    "license": "License",
    "general": "通用",
    "workspace": "工作空间路径",
    "theme": "主题",
    "language": "语言"
  },
  "errors": {
    "apiKeyMissing": "API Key 未配置，请前往 Settings",
    "apiKeyInvalid": "API Key 无效，请检查",
    "networkError": "网络连接失败",
    "timeout": "请求超时，请重试"
  }
}
```

### Step 6: 英文语言包

**文件**: `frontend/src/i18n/locales/en.json`

```json
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
    "saveFailed": "Save failed, please retry"
  },
  "nav": {
    "dashboard": "My Workflows",
    "settings": "Settings"
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
  "welcome": {
    "title": "TANGENT",
    "subtitle": "AI Creative Workflow Canvas",
    "getStarted": "Get Started",
    "licenseTitle": "Enter License Key",
    "activate": "Activate",
    "freeTrial": "Free 14-day Trial",
    "apiKeysTitle": "Configure Your AI API Keys",
    "apiKeysDesc": "TANGENT uses your own API Keys. Nothing passes through our servers.",
    "skip": "Skip, configure later",
    "done": "Done"
  },
  "canvas": {
    "emptyHint": "Double-click canvas to add nodes, or select a Skill to get started",
    "unsaved": "Unsaved changes",
    "leaveConfirm": "You have unsaved changes. Leave anyway?",
    "workflowGenerated": "Workflow generated. Adjust any node parameters.",
    "executionComplete": "Execution complete ✓ {{seconds}}s elapsed",
    "executionPartial": "Execution complete ({{count}} nodes failed)"
  },
  "settings": {
    "title": "Settings",
    "apiKeys": "API Keys",
    "license": "License",
    "general": "General",
    "workspace": "Workspace Path",
    "theme": "Theme",
    "language": "Language"
  },
  "errors": {
    "apiKeyMissing": "API Key not configured. Go to Settings.",
    "apiKeyInvalid": "API Key invalid. Please check.",
    "networkError": "Network connection failed",
    "timeout": "Request timed out. Please retry."
  }
}
```

### Step 7: 语言切换组件

```
位置: TopBar 右侧
显示: "CN" / "EN"
逻辑: i18n.changeLanguage() + localStorage 持久化
```

### Step 8: 主题切换组件

```
位置: TopBar 右侧
显示: ☀️ / 🌙
逻辑: themeStore.toggleTheme()
```

---

## 桌面端打包

### Step 9: Tauri 打包配置

**文件**: `src-tauri/tauri.conf.json` — 确认

```json
{
  "build": {
    "beforeBuildCommand": "npm run build",
    "beforeDevCommand": "npm run dev",
    "devPath": "http://localhost:5173",
    "distDir": "../dist"
  },
  "package": {
    "productName": "TANGENT",
    "version": "0.1.0"
  },
  "tauri": {
    "bundle": {
      "active": true,
      "targets": ["dmg", "msi", "appimage"],
      "icon": [
        "icons/32x32.png",
        "icons/128x128.png",
        "icons/128x128@2x.png",
        "icons/icon.icns",
        "icons/icon.ico"
      ],
      "identifier": "com.tangent.canvas",
      "resources": [],
      "externalBin": [],
      "copyright": "",
      "category": "Productivity",
      "shortDescription": "AI Creative Workflow Canvas",
      "longDescription": "Drag-and-drop nodes to build AI-powered content creation pipelines.",
      "windows": {
        "certificateThumbprint": null,
        "digestAlgorithm": "sha256",
        "timestampUrl": ""
      },
      "macOS": {
        "frameworks": [],
        "minimumSystemVersion": "13.0",
        "exceptionDomain": "",
        "signingIdentity": null,
        "entitlements": null
      }
    },
    "allowlist": {
      "all": false,
      "fs": { "scope": ["$APPDATA/**"] },
      "dialog": { "all": true },
      "shell": { "open": true }
    },
    "security": {
      "csp": "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'"
    },
    "updater": {
      "active": false,
      "endpoints": [],
      "pubkey": ""
    }
  }
}
```

### Step 10: 应用图标

```
准备图标文件:
  src-tauri/icons/
    32x32.png
    128x128.png
    128x128@2x.png
    icon.icns   (macOS)
    icon.ico    (Windows)

使用 Tauri 图标生成工具:
  npm run tauri icon path/to/source-icon.png

源图标要求: 1024x1024 或更大的 PNG，透明背景
```

### Step 11: GitHub Actions CI

**文件**: `.github/workflows/build.yml`

```yaml
name: Build & Release

on:
  push:
    tags: ["v*"]

jobs:
  build:
    strategy:
      matrix:
        platform: [macos-latest, windows-latest, ubuntu-latest]
    runs-on: ${{ matrix.platform }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - uses: dtolnay/rust-toolchain@stable
      - run: npm install
      - run: npm run tauri build
      - uses: actions/upload-artifact@v4
        with:
          name: tangent-${{ matrix.platform }}
          path: |
            src-tauri/target/release/bundle/dmg/*
            src-tauri/target/release/bundle/msi/*
            src-tauri/target/release/bundle/appimage/*
```

### Step 12: macOS 签名（可选）

```
未签名状态下:
  - macOS Gatekeeper 会警告 "无法验证开发者"
  - 用户需右键 → 打开 → 确认

签名（需要 Apple Developer 账号）:
  - Apple Developer Program ($99/年)
  - 生成 Developer ID Application 证书
  - tauri.conf.json → macOS.signingIdentity
  - GitHub Actions → APPLE_SIGNING_IDENTITY secret

公证 (Notarization):
  - 提交 Apple 公证 → 自动审核 → 通过后无 Gatekeeper 警告
  - 需要 Apple ID + App-specific password
```

---

## 代码审计

### Step 13: 300 行代码审计

```
审查命令:
  find frontend/src src-tauri/src -name '*.ts' -o -name '*.tsx' -o -name '*.rs' | \
    xargs wc -l | sort -rn | head -30

审查规则:
  - 超过 300 行的文件必须拆分
  - 拆分优先级:
    1. 职责混杂 → 拆出 hooks
    2. 多组件堆叠 → 每组件独立文件
    3. 配置过长 → 拆到 types/ 或 lib/

常见需拆分的文件:
  - Canvas.tsx → 拆出 CanvasEventHandler.ts
  - canvasStore.ts → 拆出 canvasHistory.ts
  - SkillConfigModal.tsx → 拆出 SkillFormFields.tsx
```

### Step 14: PRD 验收清单最终检查

```
License / Setup:
  □ 首次启动 Welcome 向导（3 步）
  □ License 激活成功
  □ 14 天试用机制
  □ API Key 加密存储

画布基础:
  □ 双击打开 NodePicker
  □ 拖拽节点 snap to grid
  □ 连线 + 类型校验
  □ Undo/Redo 50 步
  □ Cmd+S 保存 (SQLite <50ms)
  □ 离开确认

节点执行 (11 节点):
  □ text_input → research → outline_generator
  □ Gate waiting → 用户选择 → writer → reviewer
  □ image_planner → image_gen → image_gallery
  □ html_formatter → preview_wechat
  □ 失败红色边框 + 错误信息
  □ 可取消执行

Skills:
  □ 公众号 Skill 一键生成 11 节点工作流
  □ 节点逐个出现动画
  □ 复制 HTML 到剪贴板
  □ 下载配图 ZIP

主题/语言:
  □ 亮色/暗色切换 + 持久化
  □ 中英文切换 + 所有文案国际化

桌面端:
  □ macOS .dmg 打包成功
  □ Windows .msi 打包成功（可选）
  □ 应用图标正确显示
```

---

## 验收清单

- [ ] 亮色/暗色切换即时生效
- [ ] 刷新后主题保持 (localStorage)
- [ ] 暗色模式: 画布 #141414, 节点 #1e1e1e, 文字 #f5f5f5
- [ ] 暗色模式: 所有组件适配（无遗漏）
- [ ] 中英文切换即时生效
- [ ] 刷新后语言保持 (localStorage)
- [ ] 所有文案使用 t() 国际化（无硬编码文字）
- [ ] 顶栏包含: Logo + 工作流名 + Skills + 主题 + 语言 + License 状态
- [ ] `npm run tauri build` 打包成功（macOS）
- [ ] .dmg 文件可安装运行
- [ ] 应用图标正确显示
- [ ] GitHub Actions CI 打包流水线配置完成
- [ ] 所有文件 < 300 行
- [ ] PRD 验收清单全部通过

---

## 完成后更新

- [ ] 本文件状态 → ✅
- [ ] project_state.md → MVP 完成
- [ ] phase1-mvp.md → Slice 9 ✅, 全部标记完成
- [ ] git commit: "Slice 9: theme + i18n + desktop packaging + code audit"
