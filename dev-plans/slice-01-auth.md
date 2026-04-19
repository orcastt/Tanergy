# Slice 1: 用户系统

**优先级**: P0 | **难度**: 中 | **预计**: 3 天 | **状态**: ⬜ 未开始
**依赖**: Slice 0 | **返回索引**: [phase1-mvp.md](phase1-mvp.md)

---

## 目标

用户可以通过邮箱验证码或 Google OAuth 注册/登录，获得 JWT token，后续所有 API 需携带 token。

---

## 后端步骤

### Step 1: 数据库模型

**文件**: `backend/app/models/user.py`

```
users 表:
  id          UUID PK
  email       VARCHAR(255) UNIQUE NOT NULL
  google_id   VARCHAR(100) UNIQUE NULLABLE
  display_name VARCHAR(50) NOT NULL
  avatar_url  VARCHAR(500) NULLABLE
  is_active   BOOLEAN DEFAULT true
  created_at  TIMESTAMPTZ NOT NULL
  last_login_at TIMESTAMPTZ NULLABLE
```

**文件**: `backend/app/models/otp.py`

```
email_otps 表:
  id          UUID PK
  email       VARCHAR(255) NOT NULL INDEXED
  code        VARCHAR(6) NOT NULL
  created_at  TIMESTAMPTZ NOT NULL
  expires_at  TIMESTAMPTZ NOT NULL (created_at + 10min)
  attempts    INTEGER DEFAULT 0
  used_at     TIMESTAMPTZ NULLABLE
```

**文件**: `backend/app/models/__init__.py` — 导入所有模型

### Step 2: Alembic 迁移

```bash
cd backend && alembic revision --autogenerate -m "add users and email_otps"
alembic upgrade head
```

### Step 3: Pydantic Schema

**文件**: `backend/app/schemas/auth.py`

```
SendOtpRequest:  email: str (EmailStr)
SendOtpResponse: message: str, expires_in: int (600秒)

VerifyOtpRequest:  email: str, code: str (6位)
VerifyOtpResponse: token: str, user: UserOut, is_new_user: bool

GoogleAuthRequest:  code: str (OAuth authorization code)
GoogleAuthResponse: token: str, user: UserOut, is_new_user: bool

UserOut: id, email, display_name, avatar_url, created_at
```

### Step 4: 邮件服务

**文件**: `backend/app/services/email_service.py`

```
send_otp_email(email: str, code: str):
  - 使用 Resend API 发送邮件
  - 邮件标题: "TANVAS 验证码"
  - 邮件内容: 6位数字验证码 + 10分钟有效期提示
  - 错误处理: Resend API 失败 → 抛出 HTTPException 500
```

### Step 5: 验证码服务

**文件**: `backend/app/services/otp_service.py`

```
create_otp(email: str):
  - 生成随机 6 位数字
  - 写入 email_otps 表
  - 调用 send_otp_email()
  - 返回 SendOtpResponse

verify_otp(email: str, code: str):
  - 查询最新未使用的 OTP（按 created_at DESC）
  - 校验：未过期 + attempts < 5 + code 匹配
  - 失败：attempts +1，返回具体错误（过期/错误/锁定）
  - 成功：标记 used_at，返回 True

rate_limit_check(email: str):
  - 同一邮箱 1 分钟内只能发 1 次
  - 同一邮箱 1 小时内最多 5 次
  - 用 Redis 计数，key: `otp:{email}`
```

### Step 6: JWT 服务

**文件**: `backend/app/core/security.py`

```
create_jwt(user_id: str) -> str:
  - payload: {sub: user_id, exp: now + 7 days}
  - 算法: HS256
  - 密钥: JWT_SECRET_KEY from config

verify_jwt(token: str) -> dict:
  - 解码验证
  - 过期 → raise HTTPException 401
  - 无效 → raise HTTPException 401
```

### Step 7: 认证中间件

**文件**: `backend/app/core/auth.py`

```
get_current_user(token: str = Depends(oauth2_scheme)) -> User:
  - 从 Authorization header 提取 Bearer token
  - verify_jwt() 解码
  - 查数据库 user_id 对应的用户
  - 用户不存在 → 401
  - 用户 inactive → 403
```

### Step 8: 认证 API 路由

**文件**: `backend/app/api/v1/auth.py`

```
POST /api/v1/auth/send-otp
  - 校验邮箱格式
  - rate_limit_check()
  - create_otp()
  - 返回 SendOtpResponse

POST /api/v1/auth/verify-otp
  - verify_otp()
  - 成功：
    - 查用户，不存在则自动创建（display_name 取邮箱@前缀）
    - 更新 last_login_at
    - 生成 JWT
    - 返回 VerifyOtpResponse (is_new_user=True/False)

POST /api/v1/auth/google
  - 用 code 换 Google access_token
  - 获取用户信息（email, name, avatar）
  - 查用户：google_id 或 email 匹配
  - 不存在则创建
  - 生成 JWT
  - 返回 GoogleAuthResponse

GET /api/v1/auth/me
  - 依赖 get_current_user
  - 返回 UserOut

POST /api/v1/auth/logout
  - MVP 简化：前端清 token 即可，后端无操作
  - 返回 {"message": "logged out"}
```

### Step 9: 注册路由

**文件**: `backend/app/main.py` — 添加

```python
from app.api.v1 import auth
app.include_router(auth.router, prefix="/api/v1/auth", tags=["auth"])
```

---

## 前端步骤

### Step 10: 类型定义

**文件**: `frontend/src/types/auth.ts`

```
User: { id, email, displayName, avatarUrl, createdAt }
AuthResponse: { token, user, isNewUser }
SendOtpResponse: { message, expiresIn }
```

### Step 11: API 服务

**文件**: `frontend/src/services/auth.ts`

```
sendOtp(email: string) → POST /auth/send-otp
verifyOtp(email: string, code: string) → POST /auth/verify-otp
googleAuth(code: string) → POST /auth/google
getMe() → GET /auth/me
logout() → POST /auth/logout
```

### Step 12: Zustand Store

**文件**: `frontend/src/store/authStore.ts`

```
state:
  user: User | null
  token: string | null
  isLoading: boolean

actions:
  login(token, user):
    - 设置 state.user, state.token
    - localStorage.setItem('tanvas_token', token)

  logout():
    - 清空 state
    - localStorage.removeItem('tanvas_token')
    - 跳转 /login

  restore():
    - 从 localStorage 读 token
    - 调用 getMe() 验证
    - 失败 → logout()

初始化时调用 restore()
```

### Step 13: 路由守卫

**文件**: `frontend/src/components/ProtectedRoute.tsx`

```
ProtectedRoute:
  - 读 authStore.user
  - 未登录 → navigate('/login', { state: { from: location } })
  - 已登录 → <Outlet />

App.tsx 修改：
  /dashboard, /canvas/:id, /settings, /upgrade
  外层包裹 <ProtectedRoute />
```

### Step 14: 登录页

**文件**: `frontend/src/pages/LoginPage.tsx`

```
布局: 居中白色卡片 (card 阴影, 16px 圆角), #f5f5f5 背景

内容:
  - TANVAS Logo / 标题 (Cal Sans 48px weight 600)
  - 邮箱输入框 (Inter 16px)
  - 验证码输入区:
    - 6位数字输入框
    - "发送验证码" 按钮 (#242424 药丸)
    - 发送后按钮变倒计时 "57s"
  - "登录" 按钮 (#242424, 6px 圆角, card 阴影)
  - 分隔线 "或"
  - "用 Google 登录" 按钮 (白底 + Google icon + ring shadow)
  - 底部链接 "没有账户？注册" → /signup

逻辑:
  - 邮箱失焦校验格式
  - 验证码 6 位纯数字
  - 登录成功 → navigate(redirect || '/dashboard')
  - 错误: 红色提示文字
```

### Step 15: 注册页

**文件**: `frontend/src/pages/SignupPage.tsx`

与 LoginPage 共用组件，区别：
- 标题改为 "创建 TANVAS 账户"
- 底部链接改为 "已有账户？登录" → /login
- 验证码成功后 is_new_user=True 显示欢迎弹窗

### Step 16: Google OAuth 流程

**文件**: `frontend/src/services/googleAuth.ts`

```
initGoogleAuth():
  - 构建 Google OAuth URL
  - client_id, redirect_uri, scope=openid email profile
  - 打开弹窗 or 跳转

handleGoogleCallback():
  - 从 URL 读 code
  - 调用 googleAuth(code)
  - 成功 → login(token, user)
  - 失败 → 回到登录页
```

### Step 17: API 拦截器更新

**文件**: `frontend/src/services/api.ts`

```
请求拦截:
  - 从 authStore 读 token
  - 加到 Authorization: Bearer {token}

响应拦截:
  - 401 → authStore.logout()
  - 其他错误 → 抛出，让页面处理
```

---

## 验收清单

- [ ] `POST /api/v1/auth/send-otp` 发送验证码邮件成功
- [ ] 验证码 10 分钟有效，过期返回提示
- [ ] 验证码连续错误 5 次后锁定 30 分钟
- [ ] 新邮箱自动注册 + 创建用户
- [ ] Google OAuth 登录成功进入 Dashboard
- [ ] 重复邮箱合并账户（Google 登录匹配已有邮箱）
- [ ] JWT 7 天有效，过期后跳转登录页
- [ ] 未登录访问 /dashboard 被拦截跳转 /login
- [ ] 登录后跳回原来想访问的页面
- [ ] 登录页邮箱格式校验正常
- [ ] 发送验证码按钮倒计时正常
- [ ] 所有文件 < 300 行

---

## 完成后更新

- [ ] 本文件状态 → ✅
- [ ] project_state.md → Slice 2
- [ ] phase1-mvp.md → Slice 1 ✅
- [ ] git commit: "Slice 1: user auth (email OTP + Google OAuth + JWT)"
