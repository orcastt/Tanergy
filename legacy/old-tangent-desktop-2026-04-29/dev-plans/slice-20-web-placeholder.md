# Slice 20: 网页端架构预留

**优先级**: P3 | **难度**: - | **预计**: - | **状态**: ⬜ 远期规划
**依赖**: Phase 2 核心完成 | **返回索引**: [phase2-commercial.md](phase2-commercial.md)

> 2026-04-27 对齐：Phase 2 核心能力已完成，当前 P0 是 Admin Provider/Model 管理闭环；网页端仍暂不开发。

---

## 目标

当前架构已兼容网页端。此 Slice 记录未来网页端需要的适配工作，暂不实施。

---

## 为什么现在就能支持网页端

| 层 | 桌面端 (Tauri) | 网页端适配 |
|---|---|---|
| 本地存储 | SQLite | → IndexedDB / OPFS |
| 文件系统 | Tauri fs API | → Browser File API |
| AI 调用 | Tauri invoke → Rust → FastAPI 代理 | → 直接 fetch FastAPI 代理 |
| 用户认证 | FastAPI JWT（已有） | → 不变，直接用 |
| 状态管理 | Zustand | → 不变 |
| 画布 | React Flow | → 不变 |

---

## 网页端需要做的适配

### 1. 存储层抽象

创建存储接口，桌面端用 SQLite，网页端用 IndexedDB：

```ts
// interface/storage.ts
interface StorageProvider {
  getWorkflow(id: string): Promise<WorkflowDetail>
  saveWorkflow(id: string, data: GraphJson): Promise<void>
  listWorkflows(): Promise<Workflow[]>
  // ...
}
```

### 2. Tauri invoke 替换

当前前端通过 `tauri.invoke()` 调用 Rust 后端。网页端需要：
- AI 调用：直接 fetch FastAPI API（不走 Rust）
- 工作流 CRUD：直接操作 IndexedDB
- 文件操作：Browser File API

### 3. 部署

- Vite build → SPA
- 部署到 Vercel / Cloudflare Pages
- 域名：tangent.ai 或 app.tangent.ai

### 4. 认证

- 桌面端已用 FastAPI JWT → 网页端直接复用
- OAuth 登录（Google、GitHub）→ 网页端更容易实现

---

## 实施前提

- Phase 2 核心能力完成（官方 API 为默认）
- 订阅支付稳定运行
- 桌面端用户反馈收敛

---

## 不做的事

- 不同步开发网页端和桌面端
- 不做实时协作（远期考虑）
- 不做 PWA（桌面端优先）
