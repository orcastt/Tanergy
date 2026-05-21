# TANGENT — Project State

> 每次开始开发前先读：`project_state.md` → `PRD.md` → `ARCH.md` → 当前 `dev-plans/`。
> 每次 commit 前更新此文件。

---

## 当前阶段

**阶段**: Web AI 图像画布重启 — P0 最小图像链路规格已收敛，准备技术 spike

**核心目标**: 用全新、干净的 Web 项目重做 TANGENT。P0 只跑通：

```text
Text Node → Multi Generate 4图 → Image Node → Image Editor / Canvas Markup → Merge Capture → New Image Node
```

**下一步**: 做 tldraw 画布坐标精度 spike，验证缩放、resize、拖拽、框选、连线、图片涂改、Merge Capture 不偏移。

---

## 当前入口

| 你想看什么 | 文件 | 结论 |
|------------|------|------|
| 当前状态 | `project_state.md` | 新 Web AI 图像画布，P0 最小链路 |
| 产品需求 | `PRD.md` | 正式 PRD：功能、流程、页面、数据、错误、验收 |
| 技术架构 | `ARCH.md` | 正式 ARCH：技术栈、目录、模块、API、安全、部署 |
| 开发计划 | `dev-plans/web-collaborative-canvas-pivot.md` | 当前 P0 分阶段执行计划 |
| 旧代码归档 | `legacy/old-tangent-desktop-2026-04-29/` | 旧桌面/Admin/backend/frontend 已隔离，默认不要读 |

`PRD.web-collab.md` 和 `ARCH.web-collab.md` 已归档到 `docs/archive/pivot-docs-2026-04-29/`；根目录 `PRD.md` 和 `ARCH.md` 是当前唯一 canonical 文档。

---

## 当前决策

- ✅ 不继续在旧 Tauri / React Flow / Admin / 公众号项目上叠功能。
- ✅ 旧代码已移动到 `legacy/old-tangent-desktop-2026-04-29/`。
- ✅ 新实现从 `apps/web/` 开始。
- ✅ P0 不做多人协作，协作后移到 P0.5。
- ✅ P0 不做素材库、Html Editor、Writer、Knowledge Graph、复杂 Admin Analytics。
- ✅ AI Chat 自动创建节点和连线保留为降低门槛入口。
- ✅ 前端视觉保持干净白板、小卡片、轻边框，不大换皮。
- ✅ Tanva 只参考操作逻辑，不复制代码。

---

## 已完成

- ✅ 创建外部安全快照：`../TanvasAgent-backups/pivot-2026-04-29_065640`。
- ✅ 编写完整新 PRD：`PRD.md`。
- ✅ 编写完整新 ARCH：`ARCH.md`。
- ✅ 编写 P0 pivot 开发计划：`dev-plans/web-collaborative-canvas-pivot.md`。
- ✅ 隔离旧项目：`legacy/old-tangent-desktop-2026-04-29/`。
- ✅ 创建新项目骨架：`apps/web/`、`services/api/`、`packages/shared/`。
- ✅ 更新根目录 `AGENTS.md`，禁止默认读取 legacy archive。
- ✅ 新增 `projectstate.md` alias，指向 canonical `project_state.md`。
- ✅ 已归档重复 pivot 文档：`docs/archive/pivot-docs-2026-04-29/PRD.web-collab.md` 和 `docs/archive/pivot-docs-2026-04-29/ARCH.web-collab.md`。

---

## 当前 P0 切片顺序

1. **Canvas 坐标 Spike** — tracks #5
   - tldraw 或候选画布技术验证。
   - 验证 50% / 100% / 200% 缩放、resize、Retina、拖拽、框选、连线端口不偏移。

2. **四节点 UI 链路**
   - Text Node。
   - Multi Generate Node。
   - Image Node。
   - Image Editor Node。

3. **真实四图生成** — tracks #2
   - Text → Multi Generate。
   - 调后端 AI proxy。
   - 默认低成本 `gpt-image-2` 参数。
   - 一次返回 4 张图。

4. **Image Node 结果闭环**
   - 点击缩略图创建 Image Node。
   - 双击预览、下载、发送到画布。

5. **Image Editor 导出闭环**
   - Image → Image Editor。
   - 画笔、橡皮、导出。
   - Export → New Image Node。

6. **Canvas Markup + Merge Capture**
   - Image Send to Canvas。
   - 画布直接涂改。
   - 选中图片和笔迹。
   - Merge → New Image Node。

7. **AI Chat 自动搭线**
   - 一句话创建 Text / Multi Generate / Image Editor 节点。
   - 自动布局、自动连线。

8. **P0.5 协作** — tracks #1
   - Presence。
   - 多人光标。
   - Realtime sync。

> 未在 P0 切片中的跟踪 issue：#3 信用系统、#4 team/group 支付决策（post-MVP）。

---

## 已知风险

| 风险 | 处理 |
|------|------|
| 旧代码污染新实现 | legacy archive 默认不读；只在用户明确要求时打开 |
| 缩放/拖拽/选择偏移复发 | 第一切片先做坐标精度 spike |
| Image Editor 重新变复杂 | P0 只做画笔、橡皮、导出 |
| Merge Capture 截到 UI | 使用离屏渲染对象，不做 DOM 截屏主方案 |
| AI 成本失控 | 默认低成本参数，服务端限流 |
| 前端暴露 API Key | Key 只在服务端 `.env`，前端只调自己的 API |

---

## 下一步

开始执行 `dev-plans/web-collaborative-canvas-pivot.md` 的 Step 1：Canvas 坐标技术 Spike。
