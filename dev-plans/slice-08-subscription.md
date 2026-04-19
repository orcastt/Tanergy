# Slice 8: Subscription & Billing

**优先级**: P0 | **难度**: 中 | **预计**: 2 天 | **状态**: ⬜ 未开始
**依赖**: Slice 6 | **返回索引**: [phase1-mvp.md](phase1-mvp.md)

---

## 目标

实现 Stripe 订阅计费系统：数据库模型、Checkout 流程、Webhook 处理、执行时长计量与限额、前端升级页面和时长显示。

---

## 后端步骤

### Step 1: 数据库模型 — Subscription

**文件**: `backend/app/models/subscription.py`

```
subscriptions 表:
  id                      UUID PK
  user_id                 UUID FK → users.id, UNIQUE, NOT NULL
  plan                    ENUM('free', 'starter', 'pro', 'team') NOT NULL DEFAULT 'free'
  status                  ENUM('active', 'cancelled', 'expired', 'past_due') NOT NULL DEFAULT 'active'
  stripe_customer_id      VARCHAR(100) NULLABLE
  stripe_subscription_id  VARCHAR(100) NULLABLE, UNIQUE
  current_period_start    TIMESTAMPTZ NULLABLE
  current_period_end      TIMESTAMPTZ NULLABLE
  weekly_seconds_limit    INTEGER NOT NULL DEFAULT 1800  (Free: 30min = 1800s)
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()

约束:
  user_id UNIQUE (一用户一订阅)

计划对应的 weekly_seconds_limit:
  free:    1800  (30 分钟)
  starter: 18000 (5 小时)
  pro:     72000 (20 小时)
  team:    288000 (80 小时)
```

**文件**: `backend/app/models/__init__.py` — 添加 `from .subscription import Subscription`

### Step 2: Alembic 迁移

```bash
cd backend && alembic revision --autogenerate -m "add subscriptions table and update execution_logs"
alembic upgrade head
```

同时更新 execution_logs 表，确保 week_start 和 status 字段正确。

### Step 3: 订阅 Schema

**文件**: `backend/app/schemas/subscription.py`

```
SubscriptionOut:
  plan: str
  status: str
  weekly_limit_seconds: int
  current_period_end: datetime | None

UsageResponse:
  plan: str
  weekly_limit_seconds: int
  used_seconds: int
  remaining_seconds: int
  week_start: date

CheckoutRequest:
  price_id: str  (Stripe Price ID)
  success_url: str
  cancel_url: str

CheckoutResponse:
  checkout_url: str  (Stripe Checkout Session URL)

PortalResponse:
  portal_url: str  (Stripe Customer Portal URL)
```

### Step 4: Subscription Service

**文件**: `backend/app/services/subscription_service.py`

```
PLAN_LIMITS = {
  "free": 1800,       # 30 分钟
  "starter": 18000,   # 5 小时
  "pro": 72000,       # 20 小时
  "team": 288000,     # 80 小时
}

class SubscriptionService:

  async def get_or_create_subscription(db: AsyncSession, user_id: str) -> Subscription:
    """
    获取用户订阅，不存在则创建 Free 订阅。
    """

  async def get_usage(db: AsyncSession, user_id: str) -> UsageResponse:
    """
    获取本周使用情况。
    1. 获取用户订阅 → plan, weekly_limit_seconds
    2. week_start = get_week_start(now())
    3. 查询 execution_logs:
       SELECT COALESCE(SUM(duration_ms), 0) / 1000
       FROM execution_logs
       WHERE user_id = user_id
         AND week_start = current_week_start
         AND status = 'success'
    4. used_seconds = 查询结果
    5. remaining_seconds = max(0, weekly_limit_seconds - used_seconds)
    6. 返回 UsageResponse
    """

  async def create_checkout_session(
    db: AsyncSession,
    user_id: str,
    price_id: str,
    success_url: str,
    cancel_url: str,
  ) -> str:
    """
    创建 Stripe Checkout Session。
    1. 获取或创建 Stripe Customer:
       - 如果用户已有 stripe_customer_id → 使用现有
       - 否则 → stripe.Customer.create(email=user.email)
    2. 创建 Checkout Session:
       stripe.checkout.Session.create(
         customer=stripe_customer_id,
         payment_method_types=["card"],
         line_items=[{"price": price_id, "quantity": 1}],
         mode="subscription",
         success_url=success_url,
         cancel_url=cancel_url,
       )
    3. 返回 session.url
    """

  async def create_portal_session(
    db: AsyncSession,
    user_id: str,
    return_url: str,
  ) -> str:
    """
    创建 Stripe Customer Portal Session。
    - 需要 stripe_customer_id
    - 返回 portal session URL
    """

  async def handle_webhook_event(event: dict, db: AsyncSession) -> None:
    """
    处理 Stripe Webhook 事件。
    支持:
    - customer.subscription.created: 新订阅
      → 更新 subscription: plan, status=active, stripe_subscription_id
      → 更新 weekly_seconds_limit
    - customer.subscription.updated: 订阅变更
      → 更新 plan, status, current_period_start/end
      → 更新 weekly_seconds_limit
    - customer.subscription.deleted: 订阅取消
      → plan=free, status=cancelled, weekly_seconds_limit=1800
    - invoice.payment_failed: 付款失败
      → status=past_due
    """

  async def check_and_deduct_usage(
    db: AsyncSession,
    user_id: str,
    duration_ms: int,
  ) -> bool:
    """
    检查并记录执行时长。
    1. 获取 usage
    2. remaining = weekly_limit - used - (duration_ms / 1000)
    3. remaining < 0 → return False (超限)
    4. return True (允许执行)
    注意: 实际时长在执行完成后写入 execution_log (Slice 6 已实现)
    """

  get_week_start(dt: datetime) -> date:
    """返回给定日期所在周的周一 00:00 UTC"""
    monday = dt - timedelta(days=dt.weekday())
    return monday.date()
```

### Step 5: Subscription API 路由

**文件**: `backend/app/api/v1/subscriptions.py`

```
GET /api/v1/subscription
  - 依赖 get_current_user
  - 调用 subscription_service.get_usage(user.id)
  - 返回 UsageResponse:
    {
      "plan": "free",
      "weekly_limit_seconds": 1800,
      "used_seconds": 450,
      "remaining_seconds": 1350,
      "week_start": "2026-04-13"
    }

POST /api/v1/subscription/checkout
  - 依赖 get_current_user
  - body: CheckoutRequest { price_id, success_url, cancel_url }
  - 调用 subscription_service.create_checkout_session()
  - 返回 CheckoutResponse { checkout_url }

POST /api/v1/subscription/portal
  - 依赖 get_current_user
  - body: { return_url }
  - 调用 subscription_service.create_portal_session()
  - 返回 PortalResponse { portal_url }
```

### Step 6: Stripe Webhook 路由

**文件**: `backend/app/api/v1/webhooks.py`

```
POST /api/v1/webhooks/stripe
  - 无需 JWT 认证 (Stripe 直接调用)
  - 读取 request body
  - 验证 Stripe 签名:
    stripe.webhooks.construct_event(
      body, sig_header, STRIPE_WEBHOOK_SECRET
    )
  - 签名无效 → 400
  - 调用 subscription_service.handle_webhook_event(event)
  - 返回 200 { "received": true }

Stripe Webhook 注册:
  - endpoint: https://domain/api/v1/webhooks/stripe
  - events: customer.subscription.created/updated/deleted, invoice.payment_failed
```

**文件**: `backend/app/main.py` — 添加 subscriptions 和 webhooks router

```python
from app.api.v1 import subscriptions, webhooks
app.include_router(subscriptions.router, prefix="/api/v1/subscription", tags=["subscription"])
app.include_router(webhooks.router, prefix="/api/v1/webhooks", tags=["webhooks"])
```

### Step 7: 执行限额中间件

**文件**: `backend/app/services/execution_service.py` — 修改 (Slice 6 文件)

```
在 submit_execution() 和 run_single_node() 开头添加:
  1. usage = await subscription_service.get_usage(db, user_id)
  2. if usage.remaining_seconds <= 0:
       raise HTTPException(403, "本周执行时长已用完")
  3. 如果 remaining_seconds < 300 (5 分钟):
       在响应中添加警告头: X-Usage-Warning: "low"

在 execute_node_task() 完成后添加:
  1. 计算 duration_ms = (ended_at - started_at).total_seconds() * 1000
  2. 更新 execution_log: duration_ms, ended_at, week_start, status
  3. 注意: week_start 由 started_at 计算
```

### Step 8: Stripe 产品配置

```
Stripe Dashboard 配置:

产品 1: TANVAS Free
  - 价格: €0/月
  - Price ID: price_free_xxx

产品 2: TANVAS Starter
  - 价格: €9/月
  - Price ID: price_starter_xx

环境变量 (.env):
  STRIPE_SECRET_KEY=sk_test_...
  STRIPE_WEBHOOK_SECRET=whsec_...
  STRIPE_STARTER_PRICE_ID=price_starter_xx
  STRIPE_PRO_PRICE_ID=price_pro_xx  (Phase 2)
  STRIPE_TEAM_PRICE_ID=price_team_xx (Phase 2)
```

---

## 前端步骤

### Step 9: 类型定义

**文件**: `frontend/src/types/subscription.ts`

```
Plan: "free" | "starter" | "pro" | "team"

UsageInfo:
  plan: Plan
  weeklyLimitSeconds: number
  usedSeconds: number
  remainingSeconds: number
  weekStart: string

PlanInfo:
  id: Plan
  name: string
  price: string
  weeklyLimit: string
  features: string[]
  priceId: string | null  // Stripe Price ID
```

### Step 10: API 服务

**文件**: `frontend/src/services/subscription.ts`

```
getUsage()
  → GET /subscription
  → 返回 UsageInfo

createCheckout(priceId: string)
  → POST /subscription/checkout
    { price_id, success_url: window.location.origin + "/upgrade?success=true",
      cancel_url: window.location.origin + "/upgrade?canceled=true" }
  → 返回 { checkout_url }

createPortal(returnUrl: string)
  → POST /subscription/portal { return_url }
  → 返回 { portal_url }
```

### Step 11: Zustand Store

**文件**: `frontend/src/store/subscriptionStore.ts`

```
state:
  plan: Plan
  weeklyLimitSeconds: number
  usedSeconds: number
  remainingSeconds: number
  weekStart: string | null
  isLoading: boolean

actions:
  fetchUsage():
    - set isLoading = true
    - 调用 getUsage()
    - 更新 state
    - isLoading = false

  subscribe(priceId: string):
    - 调用 createCheckout(priceId)
    - window.location.href = checkout_url
    - (跳转到 Stripe 付款页)

  manageSubscription():
    - 调用 createPortal(window.location.origin + "/upgrade")
    - window.location.href = portal_url

computed:
  isLimitReached: remainingSeconds <= 0
  isLowUsage: remainingSeconds > 0 && remainingSeconds <= 1800  (≤30 分钟)
  formattedRemaining: "4:32:10" 格式化

初始化:
  - 在 ProtectedRoute 中调用 fetchUsage()
  - 定时刷新: 每 60 秒
```

### Step 12: UpgradePage 页面

**文件**: `frontend/src/pages/UpgradePage.tsx`

```
布局: 居中, max-width 1000px

标题: "选择适合你的方案" (Cal Sans 48px weight 600)
副标题: "按周执行时长计费，随时可升级或取消" (Inter 14px, #898989)

套餐卡片 (3 列网格):
  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
  │ Free             │  │ Starter ★        │  │ Pro (灰色,即将)  │
  │ €0/月            │  │ €9/月            │  │ €29/月          │
  │                  │  │                  │  │                  │
  │ ✓ 30 分钟/周    │  │ ✓ 5 小时/周     │  │ 即将推出         │
  │ ✓ 500MB 存储    │  │ ✓ 5GB 存储      │  │                  │
  │ ✓ 基础节点      │  │ ✓ 全部节点      │  │                  │
  │                  │  │ ✓ 优先执行      │  │                  │
  │ [当前方案]       │  │ [订阅]           │  │ [敬请期待]       │
  └─────────────────┘  └─────────────────┘  └─────────────────┘

卡片样式:
  - 白底, 8px 圆角, card shadow
  - Starter 卡片: ring shadow 0 0 0 2px #6366F1 (推荐标记)
  - 推荐标签: "推荐" 药丸, #6366F1 背景
  - 价格: Cal Sans 48px weight 600
  - 功能列表: Inter 14px, ✓ 绿色对勾
  - 按钮:
    - "当前方案": 幽灵按钮, 置灰
    - "订阅": #242424 主按钮
    - "敬请期待": 幽灵按钮, 置灰

逻辑:
  - 获取当前 plan from subscriptionStore
  - 当前方案按钮显示 "当前方案" 并置灰
  - 点击 "订阅" → subscriptionStore.subscribe(priceId)
  - URL 参数处理:
    - ?success=true → 显示成功 toast "订阅成功！时长已更新"
    - ?canceled=true → 无特殊处理
  - 管理订阅: 如果已有付费方案，显示 "管理订阅" 链接 → createPortal
```

### Step 13: UpgradeModal 组件

**文件**: `frontend/src/components/UpgradeModal.tsx`

```
使用 Radix UI Dialog

触发条件:
  - 用户点击 Run 按钮，但 remainingSeconds <= 0
  - 或者 remainingSeconds <= 300 且用户继续执行

布局:
  ┌──────────────────────────────────┐
  │ ⚠ 本周时长已用完                 │  ← Cal Sans 24px 600
  │                                  │
  │ 本周 5 小时已用完。               │  ← Inter 14px
  │ 升级 Starter 享受 5 小时/周。    │
  │                                  │
  │ ┌──────────────────────────┐     │
  │ │ Starter - €9/月          │     │  ← 简化卡片
  │ │ 5 小时/周 + 5GB 存储     │     │
  │ └──────────────────────────┘     │
  │                                  │
  │         [下周再说] [查看套餐 →]   │
  └──────────────────────────────────┘

逻辑:
  - "查看套餐" → navigate('/upgrade')
  - "下周再说" → 关闭弹窗
```

### Step 14: TimeRemaining 组件

**文件**: `frontend/src/components/TimeRemaining.tsx`

```
位置: 顶栏右侧

显示:
  格式: "{H}:{MM}:{SS}" (时:分:秒)
  示例: "4:32:10"

样式:
  - 默认: Inter 14px, #242424
  - ≤ 30 分钟: #F97316 (橙色)
  - = 0: #EF4444 (红色)
  - Hover: tooltip 显示 "本周剩余执行时长"

逻辑:
  - 从 subscriptionStore 读取 remainingSeconds
  - 格式化:
    hours = Math.floor(remaining / 3600)
    minutes = Math.floor((remaining % 3600) / 60)
    seconds = remaining % 60
    → `${hours}:${pad(minutes)}:${pad(seconds)}`
  - 每 60 秒从服务端刷新一次
```

### Step 15: 限额集成到执行流程

**文件**: `frontend/src/hooks/useExecution.ts` — 修改 (Slice 6 文件)

```
修改 runNode() 和 runAll():
  1. 检查 subscriptionStore.isLimitReached:
     - 是 → 打开 UpgradeModal
     - 返回，不执行
  2. 检查 subscriptionStore.isLowUsage:
     - 是 → 弹出确认 "本周剩余不足 30 分钟，确定继续？"
     - 用户取消 → 返回
  3. 正常执行

执行完成后:
  - 调用 subscriptionStore.fetchUsage() 刷新剩余时长
```

---

## 验收清单

- [ ] 新用户注册后自动创建 Free 订阅
- [ ] `GET /api/v1/subscription` 返回正确的用量信息
- [ ] Free 用户 weekly_limit = 1800 秒 (30 分钟)
- [ ] Starter 用户 weekly_limit = 18000 秒 (5 小时)
- [ ] 执行节点后 duration_ms 写入 execution_logs
- [ ] week_start 正确计算为当周周一日期
- [ ] 执行前检查限额: 超限返回 403
- [ ] Stripe Checkout 流程: 点击 "订阅" → 跳转 Stripe → 付款 → 回调
- [ ] Stripe Webhook 正确处理 subscription.created 事件
- [ ] 付款成功后 plan 立即更新为 starter
- [ ] Webhook 处理 subscription.deleted → 回退到 free
- [ ] Webhook 处理 payment_failed → status=past_due
- [ ] 顶栏显示剩余时长 (H:MM:SS 格式)
- [ ] 剩余 ≤ 30 分钟时显示橙色
- [ ] 剩余 = 0 时显示红色
- [ ] 时长耗尽时 Run 按钮置灰
- [ ] 时长耗尽时弹出 UpgradeModal
- [ ] UpgradeModal "查看套餐" 跳转到 /upgrade
- [ ] UpgradePage 套餐对比卡片正确显示
- [ ] 当前方案按钮置灰显示 "当前方案"
- [ ] /upgrade?success=true 显示成功提示
- [ ] "管理订阅" 链接跳转 Stripe Portal
- [ ] Webhook 签名验证正确 (无效签名拒绝)
- [ ] 所有文件 < 300 行

---

## 完成后更新

- [ ] 本文件状态 → ✅
- [ ] project_state.md → Slice 9
- [ ] phase1-mvp.md → Slice 8 ✅
- [ ] git commit: "Slice 8: subscription & billing (Stripe + usage tracking + upgrade UI)"
