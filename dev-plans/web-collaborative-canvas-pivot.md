# Web AI Image Canvas Pivot Plan

**日期**: 2026-04-29
**状态**: 新方向启动计划，旧代码已隔离
**对应 PRD**: `PRD.md`
**对应架构**: `ARCH.md`

---

## 1. 背景

收到反馈：当前产品功能太多、嵌套太深，用户理解成本高。旧路线同时包含桌面客户端、公众号工作流、Html Editor、Image Editor、Writer、素材库、Admin、复杂模型线路，已经不适合继续堆功能。

新方向：**Web-first 极简 AI 图像画布**。P0 不先做完整协作平台，而是先跑通最小图像链路：文本节点 → 一次四图 → Image 节点 → Image Editor 绘图导出 → 发送到画布涂改 → 截图合并成新 Image 节点。

补充决策：前端视觉方向不推翻。当前白色大画布、轻量节点卡片、简洁 Node Picker 的方向可以保留；真正要重构的是产品层级和画布交互复杂度。

---

## 2. 当前备份状态

已在仓库外创建当前工作区快照：

`../TanvasAgent-backups/pivot-2026-04-29_065640`

备份包含：

- `git-status.txt`
- `tracked-unstaged.patch`
- `tracked-staged.patch`
- `untracked-files.tar.gz`
- `untracked-files.txt`
- `README.md`

说明：

- `.env` 等 ignored/secret 文件没有被打包。
- 当前仓库旧实现随后已移动到 `legacy/old-tangent-desktop-2026-04-29/`。
- 当前 git 没有被 commit 或 push。

---

## 3. 决策建议

### 推荐做法

不要继续在旧项目里叠功能。旧路线已移动到 legacy archive；新实现从根目录干净骨架开始。

原因：

- 旧后端的 Provider、Model、Credits、ApiCallLog 只在明确需要时参考，不直接进入主动上下文。
- 旧代码保留在 legacy，可回收思路，不污染新实现。
- 新方向还需要 1-2 天产品验证，不能现在就做破坏性重构。

### 冻结范围

| 模块 | 状态 |
|------|------|
| Tauri 桌面端 | 冻结，不继续新增功能 |
| 公众号 Html Editor | 冻结 |
| Writer | 冻结 |
| 个人素材库 / Graph | 冻结 |
| Library / Personal Assets | 冻结，P0 不做 |
| 复杂 Admin Analytics | 冻结 |
| Provider / Model 后端 | legacy 参考，必要时提取最小实现 |

---

## 4. 新 MVP 范围

P0 只做以下闭环：

1. Web 登录。
2. 创建 Board。
3. 基础画布操作：选择、拖拽、缩放、pan、连线、画笔、图片对象。
4. Text Node。
5. Multi Generate Node：一次生成 4 张图。
6. Image Node：承载单张图，可下载、发送到画布、连接编辑器。
7. Image Editor Node：参考当前 Image Editor 的绘图/导出思路，轻量实现。
8. Canvas Markup：图片放到画布后可直接涂改。
9. Merge Capture：合并图片和笔迹，生成新的 Image Node。
10. AI Chat 自动创建节点、自动布局、自动连线。
11. API 调用记录 user / model / cost / status / latency。

P0.5 再做多人协作 presence / realtime sync。

---

## 5. Step-by-step Guidance

### Step 0 — 方向确认

**你要做什么**

- 确认新定位是否接受：`Collaborative AI visual canvas for teams`。
- 确认是否彻底放弃桌面端作为 MVP。
- 确认海外优先，默认 English-first。
- 确认视觉方向保留现有干净白板 + 小卡片，不做大换皮。
- 确认 P0 先做单人最小图像链路，协作后移到 P0.5。

**我要做什么**

- 根据确认结果修订根目录 `PRD.md`。
- 把旧路线在 `project_state.md` 中标为 legacy/frozen。

**为什么**

如果这个方向不先锁定，继续写代码会再次变成多路线并行，复杂度会回来。

---

### Step 1 — Canvas 坐标技术 Spike

**你要做什么**

- 不需要操作代码，只需要看 demo 后判断交互是否像你想要的 Miro/FigJam。

**我要做什么**

- 新建独立 Web 原型目录。
- 用 tldraw 做无限画布、自由画笔、文本、图片、箭头。
- 验证 custom shape 能否承载 AI 节点卡片。
- 专门验证 50% / 100% / 200% 缩放、窗口 resize、Retina、高 DPI、拖拽、框选、连线端口是否偏移。
- 优先使用单画布引擎；如果尝试“绘图层 + 节点层”，必须证明两层共享同一个 world coordinate system。

**为什么**

这一步决定底层画布选型。选错以后重构成本非常高。旧项目已经踩过自适应、缩放、拖动偏移坑，所以这次先验证坐标系统，不先堆功能。

**验收**

- 可以自由涂鸦。
- 可以放图片。
- 可以放 Prompt / Generate / Edit 三种卡片。
- 可以用箭头连接它们。
- 缩放、拖拽、框选、连线无明显偏移。
- 窗口尺寸变化后对象位置和选择框不漂移。

---

### Step 2 — 最小节点链路 Spike

**你要做什么**

- 看 Text / Multi Generate / Image / Image Editor 四个节点是否足够直观。
- 确认节点名称和按钮文案是否小白。

**我要做什么**

- 实现 Text Node。
- 实现 Multi Generate Node 空状态、运行中、4 图结果状态。
- 实现 Image Node。
- 实现 Image Editor Node 占位和连接规则。
- 实现 Text → Multi Generate → Image → Image Editor 的连线。

**为什么**

先把节点链路做简单，避免一开始就陷入完整白板/协作/素材库。

**验收**

- 手动创建四个节点并连线。
- 节点数量少，入口清楚。
- 新用户能理解“文本 → 四图 → 图片 → 编辑器”。

---

### Step 3 — 四图生成闭环

**你要做什么**

- 提供 3-5 个海外用户会真实使用的英文 prompt。
- 确认测试可以使用低成本参数。

**我要做什么**

- 接入后端 GeekAI provider。
- 默认使用 `gpt-image-2`，测试参数走最低成本。
- Multi Generate Node 一次生成 4 张图并显示 2×2 缩略图。
- 点击某张缩略图创建 Image Node。
- 写入 AI 调用日志。

**为什么**

这是产品最小价值闭环的前半段：一句 prompt 变成四张可选图片。

**验收**

- Text → Multi Generate 成功生成 4 张图。
- 4 张图在节点内稳定显示。
- 点击缩略图能创建 Image Node。
- API log 能看到 user、board、model、cost、latency、status。

---

### Step 4 — Image Editor 导出闭环

**你要做什么**

- 选择一张图，手动画几笔，确认导出效果。

**我要做什么**

- 参考当前 `ImageEditorModal` / `LayerCanvas` / `rasterizeLayers()` 思路。
- 做轻量 Image Editor：打开图片、画笔、橡皮、导出。
- Export 后创建新的 Image Node。
- 保证导出不包含 UI、网格、选框。

**为什么**

这是产品最小价值闭环的后半段：用户能把图改完并得到一个新图。

**验收**

- Image → Image Editor 打开成功。
- 绘图流畅。
- Export 创建新 Image Node。
- 关闭重开不丢当前编辑状态。

---

### Step 5 — 画布涂改与截图合并

**你要做什么**

- 把图片发送到画布，在图上涂几笔，然后确认合并出来的新图。

**我要做什么**

- 实现 Image Node → Send to Canvas。
- 画布上图片可被涂改/标注。
- 实现 Merge to Image：选中图片和笔迹，离屏渲染合并为 PNG。
- 创建新的 Image Node。

**为什么**

这是参考 Tanva 的关键操作逻辑：图片不只在节点里，也能变成画布对象，被涂改后合并成新图。

**验收**

- Send to Canvas 后图片在当前视野附近出现。
- 涂鸦位置和图片对齐，不偏移。
- Merge Capture 不截到 UI、网格、选框。
- 合并结果生成新的 Image Node。

---

### Step 6 — AI Chat 自动搭线 Spike

**你要做什么**

- 用自然语言描述 3 个小白场景，例如“生成 4 张猫咪海报，再把最好的一张拿去编辑”。
- 看自动生成的节点是否足够直观。

**我要做什么**

- 设计最小 graph spec：`nodes`、`edges`、`layout`。
- 复用旧 AI 自动建图思路，但不复用旧复杂执行引擎。
- 实现 AI Chat 返回简单节点图，并把节点创建在当前视野附近。

**为什么**

这是降低门槛的关键入口。用户不需要理解 Node Picker，也能通过一句话得到可运行流程。

**验收**

- 空白画布输入一句话，自动出现 Text / Multi Generate / Image Editor 节点。
- 节点自动连线。
- 布局清楚，不遮挡，不跑出当前视野。

---

### Step 7 — Dashboard 与分享

**你要做什么**

- 确认 Dashboard 最少需要哪些入口：New board、Recent boards、Invite。

**我要做什么**

- 做 Web Dashboard。
- 支持创建、重命名、打开 Board。
- 支持复制邀请链接。

**为什么**

用户必须不用安装客户端就能把队友拉进来，这是海外 Web SaaS 的基本体验。

**验收**

- 新用户登录后能创建 Board。
- 邀请链接可让第二个用户进入同一 Board。

---

### Step 8 — 多人协作 Spike（P0.5）

**你要做什么**

- 用两个浏览器窗口或两台设备进入同一测试 Board。
- 观察光标、选中、移动、画笔是否实时同步。

**我要做什么**

- 接入 Liveblocks 或 PartyKit/Yjs。
- 实现 room、presence、cursor、selection、document sync。

**为什么**

协作仍是长期方向，但不能挡住最小图像链路。等坐标和节点链路稳定后再接协作，风险更低。

**验收**

- 两个用户同时编辑 15 分钟不丢对象。
- 用户 A 新增图片，用户 B 能即时看到。
- 用户 B 移动节点，用户 A 能即时看到。

---

## 6. 文件索引

| 文件 | 作用 |
|------|------|
| `PRD.md` | 新产品需求文档 |
| `ARCH.md` | 新 Web 架构草案 |
| `project_state.md` | 当前状态入口，标记旧路线冻结 |
| `legacy/old-tangent-desktop-2026-04-29/PRD.desktop-legacy.md` | 旧桌面/公众号 PRD 归档 |
| `legacy/old-tangent-desktop-2026-04-29/ARCH.desktop-legacy.md` | 旧桌面/后端架构归档 |
| `README.md` | 项目入口，提示当前已 pivot |

---

## 7. 风险与阻断

| 风险 | 处理 |
|------|------|
| 新方向仍不够简单 | 只保留白板 + 三种 AI 节点 |
| 协作技术踩坑 | 先 spike，不直接全量重写 |
| 缩放/拖拽/选择再次偏移 | 单一 world 坐标系；先过 coordinate spike 再开发 AI |
| 双层画布复杂度过高 | 优先 tldraw 单引擎；双层只是备选 |
| 参考 Tanva 继承技术债 | 只参考操作逻辑和坐标思想，不复制复杂实现 |
| Editor 重新变成专业软件 | P0 只做画笔、橡皮、导出、新 Image Node |
| 截图合并截到 UI | 使用离屏渲染画布对象，不做 DOM 截屏 |
| 旧代码拖慢 | 新 Web App 独立目录，旧代码冻结 |
| AI 成本失控 | 默认低成本模型和低分辨率 |
| 海外定位模糊 | UI/文案默认英语，围绕团队协作和视觉迭代 |

---

## 8. 下一步执行建议

如果你确认这个 pivot：

1. 我先做 tldraw 技术 spike。
2. 同时验证画布坐标精度：缩放、resize、拖拽、框选、连线。
3. 通过后做 Text / Multi Generate / Image / Image Editor 四节点链路。
4. 接后端 AI 生图，一次生成 4 张。
5. 做 Image Editor 导出为新 Image Node。
6. 做 Send to Canvas + Merge Capture。
7. 做 AI Chat 自动搭线。
8. 最后做 Dashboard、邀请链接和 P0.5 协作。

如果你还不确定：

1. 先不要写代码。
2. 用根目录 `PRD.md` 做一轮产品删减。
3. 把“一句话定位”和“5 分钟首次价值”改到足够清楚后再开发。
