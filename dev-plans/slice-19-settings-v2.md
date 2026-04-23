# Slice 19: Settings 简化 + Skill 推荐卡片

**优先级**: P2 | **难度**: 中 | **预计**: 3 天 | **状态**: ✅ 已完成
**依赖**: Slice 18 ✅ | **返回索引**: [phase2-commercial.md](phase2-commercial.md)

---

## 目标

1. Settings 页面简化：主界面只显示积分/订阅，API Key 移到"高级设置"
2. 新建工作流时展示 Skill 推荐卡片，一键启动场景模板

---

## Part A: Settings 简化

### 当前 Settings 结构

```
Settings
├── License Tab — 输入 License Key（Phase 1 遗留）
└── General Tab — "主题/语言设置将在后续版本中提供"
```

### 改为

```
Settings
├── Account Tab（主 Tab）
│   ├── 邮箱 + 订阅状态
│   ├── 积分余额 + 刷新
│   ├── Upgrade to Pro 按钮
│   └── 退出登录
├── Advanced Tab（高级）
│   ├── API Keys（用户自带 Key，可选）
│   ├── 模型偏好（默认模型选择）
│   └── 主题/语言切换
└── About
    ├── 版本号
    └── 反馈链接
```

### 文件变动

| 文件 | 改动 |
|------|------|
| `frontend/src/pages/settings/SettingsTabs.tsx` | 重写 Tab 结构 |
| `frontend/src/pages/settings/AccountTab.tsx` | **新建** 账户信息（积分/订阅/退出） |
| `frontend/src/pages/settings/AdvancedTab.tsx` | **新建** 高级设置（API Key + 偏好） |
| `frontend/src/pages/settings/KeysTabContent.tsx` | 移到 Advanced 内 |

AccountTab 通过 `useCreditsStore` 读取积分/登录状态，通过 `tauri.refreshCredits()` 刷新余额。

---

## Part B: Skill 推荐卡片

### Dashboard 新建工作流流程

```
点击 "New Workflow"
  ↓
弹窗展示 Skill 卡片
  ┌──────────┐ ┌──────────┐ ┌──────────┐
  │ 📝 公众号  │ │ 🛒 电商   │ │ 📕 小红书  │
  │ 长文写作   │ │ 海报文案   │ │ 种草笔记   │
  │ 10 节点   │ │ 6 节点    │ │ 7 节点    │
  └──────────┘ └──────────┘ └──────────┘
  ┌──────────┐
  │ ✏️ Blank  │
  │ 空白画布   │
  └──────────┘
  ↓ 点击卡片
自动创建节点 + 连线 + 填入主题
  ↓
Agent 自动匹配 Skill → buildActions → runAll
```

### Skill 卡片定义

**文件**: `frontend/src/nodes/skillDefs.ts`

```ts
export interface SkillDef {
  id: string
  name: string
  description: string
  icon: string
  keywords: string[]       // Agent 匹配关键词
  nodeCount: number
  prompt: string           // Agent prompt 前缀
}

export const SKILL_DEFS: SkillDef[] = [
  {
    id: "wechat_article",
    name: "WeChat Article",
    description: "Full pipeline: research → outline → write → review → images → format → preview",
    icon: "article",
    keywords: ["公众号", "wechat", "长文", "article"],
    nodeCount: 10,
    prompt: "Create a WeChat article workflow",
  },
  {
    id: "ecommerce",
    name: "E-commerce Poster",
    description: "Research → copy → image generation for product posters",
    icon: "shopping_cart",
    keywords: ["电商", "ecommerce", "海报", "poster", "商品"],
    nodeCount: 6,
    prompt: "Create an e-commerce product poster workflow",
  },
  {
    id: "xiaohongshu",
    name: "Xiaohongshu Post",
    description: "Research → write lifestyle content → generate images",
    icon: "book",
    keywords: ["小红书", "xiaohongshu", "种草", "lifestyle"],
    nodeCount: 7,
    prompt: "Create a Xiaohongshu lifestyle post workflow",
  },
  {
    id: "blank",
    name: "Blank Canvas",
    description: "Start from scratch",
    icon: "edit_note",
    keywords: [],
    nodeCount: 0,
    prompt: "",
  },
]
```

### Skill 卡片 UI

**新文件**: `frontend/src/components/SkillPicker.tsx`

- 弹窗组件，4 列卡片网格
- 每张卡片：icon + name + description + node count
- 点击 → 调用 Agent（自动发 prompt）或直接创建空工作流

**修改**: `frontend/src/pages/DashboardPage.tsx`

- "New Workflow" 按钮点击 → 弹出 SkillPicker
- 选择 Skill → 创建工作流 → 导航到画布 → 触发 Agent

---

## 实际实施记录

### Part A: Settings 简化 ✅

- `frontend/src/pages/SettingsPage.tsx` — 重写为 Account / Advanced / About 三 Tab，带图标的侧边栏
- `frontend/src/pages/settings/AccountTab.tsx` — 登录状态、积分余额、CreditBalance、ProUpgradeModal、退出登录
- `frontend/src/pages/settings/AdvancedTab.tsx` — 主题/语言切换 + 复用 KeysTab 组件
- `frontend/src/pages/settings/AboutTab.tsx` — 版本号 + 产品描述 + Website/GitHub/Feedback 链接
- 移除了 License Tab 和 Debug Tab（功能合并到 Account/Advanced）

### Part B: Skill 推荐卡片 ✅

- `frontend/src/nodes/skillDefs.ts` — 4 个 Skill 定义（wechat_article/ecommerce/xiaohongshu/blank），含节点位置和边连接
- `frontend/src/components/SkillPicker.tsx` — 2×2 网格模态框，彩色图标 + 描述 + hover 边框
- `frontend/src/pages/DashboardPage.tsx` — "Create New Workflow" 打开 SkillPicker，选择后自动创建工作流 + 预填充节点图

### i18n ✅
- 新增 `settings.account/advanced/about/theme/language/loggedIn/notLoggedIn/creditsBalance/aboutDesc/feedback`
- 新增 `skills.title/subtitle/wechatArticle/ecommerce/xiaohongshu/blank` 及描述 key
- en.json + zh.json 同步更新

## 验证清单

- [x] Settings 主界面显示账户信息 + 积分 + 订阅
- [x] API Key 在"高级设置"中，主题/语言切换也在高级设置
- [x] 点击 "New Workflow" → 弹出 Skill 卡片
- [x] 选择 "WeChat Article" → 自动创建完整节点链 + 连线
- [x] 选择 "Blank Canvas" → 空白画布
- [x] `npx tsc --noEmit` 零错误
