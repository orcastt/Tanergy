# Slice 8: Credits & Subscription System (Supabase + Stripe)

**优先级**: P0 | **难度**: 高 | **预计**: 5 天 | **状态**: 🔨 进行中
**依赖**: Slice 7 | **返回索引**: [phase1-mvp.md](phase1-mvp.md)

---

## 目标

三层商业模式：Free / 积分包 / Pro 订阅。

### 用户场景

1. **Free 用户**: 自带 Key 免费用，或单次购买 Skill 模板（一次性解锁），或购买积分包走官方 API
2. **没有 Key 的用户**: 购买积分包，所有节点生成扣积分，走官方 API 线路
3. **Pro 订阅用户**: 月付/年付解锁所有 Skill + 自动化流程，赠送积分，额外购积分 8 折，仍可用自带 Key

### 关键规则

- 有 Key → 用自己的 Key，不扣积分
- 没 Key → 用官方线路，扣积分
- Pro 用户：全 Skill 解锁 + 赠送积分 + 购积分 8 折
- 每个节点根据 api_mode 自动选择线路，用户无需手动切换
- **逐节点智能路由**: 如果用户配了某个 provider 的 Key，该节点走自有 Key；否则走官方线路扣积分

---

## Architecture

```
用户 → Tauri IPC → ai_client.rs → 该 provider 有自有 Key?
                                    ├── YES → 直接调 Provider (免费，不扣积分)
                                    └── NO  → Supabase Edge Function → 官方 Key (扣积分)
```

---

## Phase A: Supabase Backend

### Step 1: Supabase 项目 + 数据库

```sql
-- 用户 profile
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  display_name TEXT,
  plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free','pro')),
  stripe_customer_id TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 积分余额
CREATE TABLE credit_balances (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  balance INTEGER NOT NULL DEFAULT 0 CHECK (balance >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 积分流水
CREATE TABLE credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  tx_type TEXT NOT NULL CHECK (tx_type IN ('purchase','ai_call','refund','bonus','adjustment')),
  description TEXT,
  reference_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_tx_user ON credit_transactions(user_id, created_at DESC);

-- 积分套餐
CREATE TABLE credit_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  credits INTEGER NOT NULL,
  price_cents INTEGER NOT NULL,
  stripe_price_id TEXT UNIQUE,
  pro_price_cents INTEGER NOT NULL,      -- Pro 8 折价
  pro_stripe_price_id TEXT UNIQUE,       -- Pro Stripe Price ID
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0
);

-- Skill 模板（一次性购买）
CREATE TABLE skill_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id),
  skill_id TEXT NOT NULL,
  stripe_session_id TEXT,
  amount_cents INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','refunded')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_skill_purchases ON skill_purchases(user_id, skill_id);

-- 订单（积分包购买）
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id),
  package_id UUID NOT NULL REFERENCES credit_packages(id),
  credits INTEGER NOT NULL,
  amount_cents INTEGER NOT NULL,
  stripe_session_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','failed','refunded')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_at TIMESTAMPTZ
);

-- 订阅
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id),
  stripe_sub_id TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','past_due','canceled','ended')),
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS policies (same as before)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE skill_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_profile" ON profiles FOR ALL USING (auth.uid() = id);
CREATE POLICY "own_balance" ON credit_balances FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own_tx" ON credit_transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "public_packages" ON credit_packages FOR SELECT USING (is_active = true);
CREATE POLICY "own_orders" ON orders FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own_skill_purchases" ON skill_purchases FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own_subs" ON subscriptions FOR SELECT USING (auth.uid() = user_id);

-- 原子扣减 RPC
CREATE OR REPLACE FUNCTION deduct_credits(
  p_user_id UUID, p_amount INTEGER, p_tx_type TEXT, p_description TEXT, p_reference_id TEXT
) RETURNS BOOLEAN AS $$
DECLARE v_balance INTEGER;
BEGIN
  SELECT balance INTO v_balance FROM credit_balances WHERE user_id = p_user_id FOR UPDATE;
  IF v_balance IS NULL OR v_balance < p_amount THEN RETURN FALSE; END IF;
  UPDATE credit_balances SET balance = balance - p_amount, updated_at = now() WHERE user_id = p_user_id;
  INSERT INTO credit_transactions(user_id, amount, tx_type, description, reference_id)
    VALUES (p_user_id, -p_amount, p_tx_type, p_description, p_reference_id);
  RETURN TRUE;
END; $$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Step 2: 积分套餐定价

| Package | Credits | 价格 | Pro 价 (8折) |
|---------|---------|------|-------------|
| Starter | 100 | $4.99 | $3.99 |
| Standard | 500 | $19.99 | $15.99 |
| Pro Pack | 2000 | $69.99 | $55.99 |

Pro 会员: $9.99/月 或 $79.99/年，开通赠送 200 积分

Skill 单次购买: 每个 Skill $2.99（Free 用户解锁单个 Skill 模板）

### Step 3: 节点积分消耗

| 操作 | 积分 |
|------|------|
| research | 5 |
| outline_generator | 3 |
| writer | 10 |
| reviewer (3 pass) | 12 |
| image_planner | 3 |
| image_gen (per image) | 15 |
| html_formatter | 4 |

完整 WeChat Skill ≈ 82 积分 (不含图) / ~127 积分 (含 3 张图)

### Step 4: Supabase Edge Functions

| Function | 功能 |
|----------|------|
| `proxy-chat` | 验证 JWT → 扣积分 → 转发 AI chat → 失败 refund |
| `proxy-image` | 验证 JWT → 扣积分 → 转发 image gen → 失败 refund |
| `stripe-checkout` | 创建 Stripe Checkout (积分包 or Skill 购买 or Pro 订阅) |
| `stripe-webhook` | 处理 checkout.completed / subscription.updated |

---

## Phase B: Rust Integration (Tauri)

### Step 5: 积分服务模块

**新文件**: `src-tauri/src/services/credits.rs`

```rust
// 检查用户是否有某个 provider 的自有 Key
pub fn has_own_key(provider_id: &str) -> bool

// 走官方线路调用 AI（通过 Supabase Edge Function）
pub async fn official_chat_completion(provider, model, messages, max_tokens, temperature) -> Result<AiCompletion>
pub async fn official_image_generation(provider, prompt, aspect_ratio) -> Result<ImageResult>

// 读取 Supabase JWT（从 app_config）
pub fn get_supabase_jwt() -> Option<String>

// 刷新积分余额缓存
pub async fn refresh_credit_balance() -> Result<i32>
```

### Step 6: ai_client.rs 智能路由

**修改文件**: `src-tauri/src/services/ai_client.rs`

在 `chat_completion()` 和 `image_generation()` 函数开头加智能路由：

```rust
// 检查用户是否有该 provider 的自有 Key
if !has_own_key(provider_id) {
    // 没有自有 Key → 走官方线路（扣积分）
    return crate::services::credits::official_chat_completion(...).await;
}
// 有自有 Key → 走现有逻辑（不扣积分）
```

这样逐节点自动路由，无需用户手动切换模式。

### Step 7: 积分 IPC Commands

**新文件**: `src-tauri/src/commands/credits.rs`

| Command | 说明 |
|---------|------|
| `get_credit_balance` | 读缓存积分余额 |
| `refresh_credits` | 调 Supabase 刷新 |
| `login_official(email)` | Supabase email OTP |
| `verify_otp(email, token)` | 验证 OTP 获取 JWT |
| `create_checkout_session(package_id)` | 返回 Stripe URL |
| `logout_official` | 清除 JWT |
| `get_profile` | 读取 plan (free/pro) |

**修改文件**: `src-tauri/src/lib.rs` — 注册新 commands
**修改文件**: `src-tauri/src/commands/mod.rs` — 加 `pub mod credits;`
**修改文件**: `src-tauri/src/services/mod.rs` — 加 `pub mod credits;`

### Step 8: 数据库迁移

**新文件**: `src-tauri/migrations/003_credits.sql`

```sql
INSERT OR IGNORE INTO app_config (key, value) VALUES ('supabase_jwt', '');
INSERT OR IGNORE INTO app_config (key, value) VALUES ('credit_balance_cache', '0');
```

---

## Phase C: Frontend

### Step 9: 类型 + IPC + Store

**新文件**: `frontend/src/types/credits.ts`
**修改文件**: `frontend/src/services/tauri.ts` — 加 IPC methods
**新文件**: `frontend/src/store/creditsStore.ts` — balance, isLoggedIn, plan

### Step 10: 积分购买页

**新文件**: `frontend/src/pages/CreditsPage.tsx`

- 积分余额显示
- 套餐卡片（3 档）+ 购买按钮
- 官方账号登录 (email OTP)
- Pro 订阅入口 + 解锁 Skills
- 交易历史
- **修改**: `frontend/src/App.tsx` — 加 `/credits` route

### Step 11: 节点积分显示

**修改文件**: `frontend/src/nodes/base/NodeBase.tsx`

在 NodeTitle 右侧加积分图标：
- 如果用户**没有**该节点对应 provider 的自有 Key → 显示 `⚡ N`（预计消耗积分）
- 如果有自有 Key → 不显示积分图标
- 从 creditsStore 读 balance 和 key 配置
- 积分 cost 映射:

```typescript
const NODE_CREDIT_COSTS: Record<string, number> = {
  research: 5, outline_generator: 3, writer: 10, reviewer: 12,
  image_planner: 3, image_gen: 15, html_formatter: 4,
}
```

### Step 12: TopNav + Settings

**新文件**: `frontend/src/components/CreditBalance.tsx` — 积分徽章
**修改文件**: `frontend/src/components/TopNav.tsx` — 加 CreditBalance
**修改文件**: `frontend/src/pages/SettingsPage.tsx` — 加 "积分" tab

### Step 13: 执行引擎错误处理

**修改文件**: `frontend/src/lib/executionEngine.ts`
- catch `INSUFFICIENT_CREDITS` → 专用 toast + 跳转 /credits

---

## 验收清单

- [ ] 有自带 Key → 节点不显示积分图标，走自有 Key（免费）
- [ ] 没有自带 Key → 节点显示预计积分消耗 `⚡ N`
- [ ] 购买积分包 → Stripe Checkout → 积分到账
- [ ] 没有自有 Key 且有积分 → AI 调用成功，积分扣除
- [ ] 没有自有 Key 且无积分 → INSUFFICIENT_CREDITS 错误提示
- [ ] Pro 用户看到 8 折价
- [ ] Pro 订阅 → 解锁所有 Skill + 赠送 200 积分
- [ ] Free 用户可单次购买 Skill 模板
- [ ] TopNav 显示积分余额
- [ ] 所有文件 < 300 行

---

## Supabase 架构决策与解耦备忘

### 已采纳的设计原则

1. **Repository Pattern 已就位**: `frontend/src/services/tauri.ts` 就是 Data Service 层。所有 IPC 调用都经过它封装。未来换 Supabase 直连时，只需修改此文件 + `credits.rs`，UI 层无需改动。

2. **只用 anon_key + RLS**: 前端只持有 anon_key，所有写操作和扣费逻辑都在 Edge Function（SECURITY_DEFINER）中执行。用户数据隔离靠 RLS 策略。

3. **Edge Function 做代理，而非直连**: AI 调用走 Rust → Supabase Edge Function → Provider，前端不直接调 Supabase 数据库。这样 Rust 侧控制扣费逻辑，前端无法绕过。

### 不采纳的建议

- **pgvector**: MVP 不需要向量搜索。TANGENT 是工作流画布应用，不是 RAG/搜索应用。后续如果做"模板推荐"功能再考虑。
- **自建 Node.js/Go 后端**: Tauri IPC 就是后端。桌面 app 不需要额外的 Web API 层。Supabase 只做积分代理和用户认证。
- **Cloudflare Workers**: Edge Function 已经覆盖了代理需求，多一层反而增加维护成本和延迟。

### 未来迁移路径（如果需要离开 Supabase）

| 组件 | 当前方案 | 迁移目标 | 改动范围 |
|------|---------|---------|---------|
| Auth | Supabase Email OTP | Clerk / Auth0 | `credits.rs` + `creditsStore.ts` |
| 扣费 | Edge Function + RPC | 自建 API (FastAPI/Go) | `credits.rs` 中 3 个函数 |
| 支付 | Stripe Checkout | 不变 | 无需改 |
| 数据库 | Supabase Postgres | AWS RDS / 自建 | pg_dump 导出导入，RLS 逻辑移到后端 |

**结论: MVP 阶段坚持用 Supabase 上线速度优先。迁移成本可控，只需改 `credits.rs` + `tauri.ts` 两个文件。**

---

## 完成后更新

- [ ] 本文件状态 → ✅
- [ ] project_state.md
- [ ] phase1-mvp.md → Slice 8 ✅
- [ ] git commit: "feat(slice8): credits & subscription system with Supabase + Stripe"
