# Slice 18: 首次引导 + 订阅支付

**优先级**: P1 | **难度**: 高 | **预计**: 3 天 | **状态**: ✅ 已完成
**依赖**: Slice 15 ✅ | **返回索引**: [phase2-commercial.md](phase2-commercial.md)

---

## 目标

新用户首次打开 App → 注册/登录引导 → Free 计划（送积分）→ 进入 Dashboard。升级 Pro 走 Stripe Checkout。

---

## 用户流程

```
首次启动 App
  ↓
欢迎页（WelcomePage）
  ├── 已登录？→ Dashboard
  └── 未登录
        ├── 输入邮箱 → 发送验证码 (FastAPI /api/v1/auth/send-otp)
        ├── 输入验证码 → 登录成功 (FastAPI /api/v1/auth/verify-otp)
        ├── Free 计划自动激活（送 50 积分）
        └── 进入 Dashboard

Dashboard 内
  ├── 积分不足时 → 弹出升级弹窗
  └── 点击 Pro 徽章 → Stripe Checkout
        ├── 月付 $9.99/月（500 积分/月）
        └── 年付 $79.99/年（6000 积分/年）
```

---

## 改动清单

### 1. 欢迎页改造

**文件**: `frontend/src/pages/welcome/WelcomeSections.tsx` + 新文件

当前欢迎页是展示型的。改为登录引导：
- Step 1: 输入邮箱 → 发送验证码
- Step 2: 输入验证码 → 验证 → 自动登录
- Step 3: 进入 Dashboard

后端已有完整 OTP 机制 (`backend/app/services/otp_service.py`)，客户端通过 `tauri.loginOfficial(email)` + `tauri.verifyOtp(email, code)` 调用。

### 2. 登录状态检查

**文件**: `frontend/src/App.tsx` 或路由层

```tsx
// 路由守卫：未登录只能访问 /welcome
if (!isLoggedIn && !isWelcomePage) {
  return <Navigate to="/welcome" />
}
```

需要：
- `useCreditsStore` 加 `isLoggedIn` 状态（已有）
- 登录后存 JWT 到本地（已有，`backend_jwt` in app_config）
- App 启动时检查 JWT 有效性

### 3. Stripe 支付集成

**新文件**: `src-tauri/src/commands/billing.rs`

```rust
#[tauri::command]
async fn create_checkout_session(plan: String) -> Result<String, String> {
    // 调用 FastAPI /api/v1/billing/checkout 创建 Stripe Checkout Session
    // 返回 checkout URL → 前端用 shell.open 打开
}

#[tauri::command]
async fn get_subscription_status() -> Result<SubscriptionInfo, String> {
    // 调用 FastAPI /api/v1/billing/subscription 查询订阅状态
}
```

**后端新增**: `backend/app/api/v1/billing.py`

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/v1/billing/checkout` | POST | 创建 Stripe Checkout Session |
| `/api/v1/billing/webhook` | POST | Stripe Webhook 回调 |
| `/api/v1/billing/subscription` | GET | 查询当前订阅状态 |

Stripe Webhook 处理：
- `checkout.session.completed` → 充值积分 + 更新 plan
- `customer.subscription.updated` → 更新 plan
- `customer.subscription.deleted` → 降级为 free

**前端**: 升级弹窗组件

```tsx
// ProUpgradeModal.tsx
function ProUpgradeModal() {
  return (
    <Modal>
      <h2>Upgrade to Pro</h2>
      <PlanCard plan="monthly" price="$9.99/mo" credits="500/month" />
      <PlanCard plan="yearly" price="$79.99/yr" credits="6000/year" />
      <button onClick={() => createCheckout(plan)}>Continue</button>
    </Modal>
  )
}
```

### 4. 新用户注册送积分

在 FastAPI `verify_otp` 中已有新用户创建逻辑。新增：创建 `CreditBalance` 记录 + 赠送 50 积分。

**文件**: `backend/app/api/v1/auth.py` 的 `verify_otp_route`

```python
if is_new:
    # ... existing user creation ...
    # Grant signup bonus
    balance = CreditBalance(user_id=user.id, balance=50, plan="free")
    db.add(balance)
    txn = CreditTransaction(user_id=user.id, amount=50, type="credit", reason="signup_bonus")
    db.add(txn)
    await db.commit()
```

### 5. 积分余额 UI 增强

**文件**: `frontend/src/components/CreditBalance.tsx`

- 显示当前积分余额
- 余额不足时变红
- 点击 → 打开积分中心（CreditsPage）

---

## 文件变动

| 文件 | 改动 |
|------|------|
| `frontend/src/pages/welcome/` | 改为登录引导流程 |
| `frontend/src/App.tsx` | 路由守卫 |
| `src-tauri/src/commands/billing.rs` | **新建** Stripe 交互 |
| `src-tauri/src/commands/mod.rs` | 注册 billing 命令 |
| `backend/app/api/v1/billing.py` | **新建** Stripe Checkout + Webhook |
| `backend/app/api/v1/auth.py` | 新用户注册送 50 积分 |
| `frontend/src/components/ProUpgradeModal.tsx` | **新建** 升级弹窗 |
| `frontend/src/components/CreditBalance.tsx` | 余额 UI 增强 |

---

## 验证清单

- [x] 首次启动 → 进入欢迎页 → 输入邮箱 → 验证码 → 登录成功 → Dashboard
- [x] 已登录用户启动 → 直接进入 Dashboard
- [x] Free 计划：50 积分，AI 节点每次扣积分
- [x] 积分不足 → 节点报错 + 弹出升级弹窗
- [x] 点击升级 → Stripe Checkout 页面
- [x] 支付成功 → 积分自动充值
- [x] 退出登录 → 回到欢迎页
