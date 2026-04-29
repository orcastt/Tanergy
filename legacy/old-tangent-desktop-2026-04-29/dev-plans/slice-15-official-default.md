# Slice 15: 官方 API 默认路由 + 登录门控

**优先级**: P0 | **难度**: 低 | **预计**: 1 天 | **状态**: ✅ 已完成
**依赖**: Slice 14 | **返回索引**: [phase2-commercial.md](phase2-commercial.md)

> 2026-04-25 对齐：官方 API 默认路由已完成；本地测试仍临时 bypass AuthGuard，生产前必须恢复或重做门控。

---

## 目标

翻转 AI 调用路由：官方 API 成为默认路径，用户自带 Key 降为高级选项。未登录用户不能使用 AI 节点。

---

## 已完成的实现

### 1. 路由翻转 ✅

**文件**: `src-tauri/src/services/ai_client.rs`

`chat_completion()` 和 `image_generation()` 已实现三级路由：

```rust
// Route 1: Official API (default for logged-in users)
if crate::services::credits::has_official_access() {
    return crate::services::credits::official_chat_completion(...).await;
}
// Route 2: User's own API key (fallback)
if crate::services::credits::has_own_key(provider_id) {
    return chat_completion_direct(...).await;
}
// No access → LOGIN_REQUIRED
Err("LOGIN_REQUIRED".into())
```

### 2. credits.rs 重写 ✅

**文件**: `src-tauri/src/services/credits.rs`

从 Supabase 切换到 FastAPI 后端：
- `login_official()` → `POST /api/v1/auth/send-otp`
- `verify_otp()` → `POST /api/v1/auth/verify-otp`
- `official_chat_completion()` → `POST /api/v1/proxy/chat`
- `official_image_generation()` → `POST /api/v1/proxy/image`
- `refresh_credit_balance()` → `GET /api/v1/credits/balance`
- JWT 存储在 `app_config` 表 (`backend_jwt`)
- 后端 URL 可配置 (`backend_url`)，默认 `http://localhost:8000`

### 3. AI 节点执行前置检查 ✅

`has_official_access()` 检查本地 JWT 是否存在。`has_own_key()` 检查 `api_keys` 表。两者都无 → 返回 `LOGIN_REQUIRED`。

---

## 仍需完成

| 项目 | 说明 | 状态 |
|------|------|------|
| `execute/mod.rs` 入口前置检查 | 在 `execute_node` 入口加 AI_NODES 检查 | ⬜ 待做 |
| 前端 `executionEngine.ts` 处理 LOGIN_REQUIRED | catch 中弹登录面板 | ⬜ 待做 |
| `ModelSelector.tsx` 显示积分/登录状态 | 未登录灰显 + 积分消耗标注 | ⬜ 待做 |

---

## 验证清单

- [x] 已登录用户 → AI 调用走官方 API（扣积分）
- [x] 已登录 + 填了自己的 Key → 可选择直连
- [x] 未登录用户 → AI 节点报错 `LOGIN_REQUIRED`
- [ ] 未登录用户 → 仍可使用 text_input、画布等非 AI 功能
- [x] `cargo check` + `npx tsc --noEmit` 零错误
