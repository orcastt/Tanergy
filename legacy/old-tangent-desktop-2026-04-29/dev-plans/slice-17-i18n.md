# Slice 17: i18n 中英切换完成

**优先级**: P1 | **难度**: 中 | **预计**: 2 天 | **状态**: ✅ 已完成
**依赖**: 无 | **返回索引**: [phase2-commercial.md](phase2-commercial.md)

> 2026-04-25 对齐：核心 UI 已覆盖 i18n；Html Editor 新增文案仍以中文为主，后续可补齐翻译 key。

---

## 目标

所有 UI 文本支持中英切换，默认英文，TopNav 加语言切换按钮。

---

## 已完成

- ✅ `i18n/index.ts` — i18next 配置（默认 en）
- ✅ `i18n/locales/zh.json` + `en.json` — 完整翻译 key（100+ 条）
- ✅ `store/langStore.ts` — 语言切换 Zustand store（localStorage 持久化）

## 待完成

## 待完成

### 1. TopNav 语言切换按钮

**文件**: `frontend/src/components/TopNav.tsx`

在暗黑模式 toggle 旁加语言按钮：
- 图标: `translate`
- 点击: `toggleLang()`
- 当前语言高亮

### 2. nodeDefs.ts 翻译

**文件**: `frontend/src/nodes/nodeDefs.ts`

- `description` 改为 i18n key
- 端口 label 改为 i18n key
- 各消费组件用 `t()` 渲染

### 3. 节点组件替换（~12 文件）

每个文件：
1. `import { useTranslation } from "react-i18next"`
2. `const { t } = useTranslation()`
3. 硬编码中文 → `t("key")`

需改文件：
- `nodes/TextInputNode.tsx`
- `nodes/OutlineGeneratorNode.tsx`
- `nodes/WriterNode.tsx`
- `nodes/ReviewerNode.tsx`
- `nodes/GateNode.tsx`
- `nodes/ImagePlannerNode.tsx`
- `nodes/ImageGenNode.tsx` (ImageListNode.tsx)
- `nodes/HtmlFormatterNode.tsx`
- `nodes/PreviewWechatNode.tsx`
- `nodes/ImageGalleryNode.tsx`
- `nodes/image/ImageEditorModal.tsx`

### 4. 页面和画布组件（~6 文件）

- `pages/DashboardPage.tsx`
- `pages/CreditsPage.tsx`
- `pages/settings/SettingsTabs.tsx`
- `pages/settings/KeysTabContent.tsx`
- `pages/welcome/WelcomeSections.tsx`
- `canvas/Canvas.tsx`（右键菜单文本）

### 5. 侧边栏

- `components/SideNav.tsx` — nav labels + New Workflow 按钮

---

## 验证清单

- [x] 默认英文，所有 UI 文本英文
- [x] 点击语言切换 → 中文，所有文本切换
- [x] 刷新页面语言保持（localStorage）
- [x] 暗黑模式 + 语言切换互不干扰
- [x] `npx tsc --noEmit` 零错误
