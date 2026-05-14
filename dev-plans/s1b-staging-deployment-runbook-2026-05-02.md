# S1B Staging Deployment Runbook

**Updated**: 2026-05-14
**Language**: Chinese beginner guide.
**Status**: Active S1B tactical runbook.

这份文档是 TANGENT 从本地开发走到线上 staging 的采购和配置手册。目标不是一次性公开商业发布，而是先跑通一个安全、可回滚、可手测的 staging 环境。

## 2026-05-14 当前检查点

- `api-staging.tanergy.cc` 已在重建后的 Hetzner 主机恢复，Neon/R2/board smoke 为绿。
- `staging.tanergy.cc` 已重新指向 Konva-only Web 部署，不再暴露旧 tldraw/license 路径。
- Hetzner 源站 UFW 已收口到：公网只开 80/443，22 只允许当前维护机器公网 IP；不要指望 Cloudflare 代替 SSH 防护。
- Cloudflare DNS 当前已经把 `staging.tanergy.cc` 的 Vercel CNAME 和 `api-staging.tanergy.cc` 的 Hetzner A 记录都切到橙云代理，但 `staging` 仍然必须保持 Vercel 源站，不能改成指向 Hetzner。
- 真实 Clerk session/admin smoke 已转绿；剩余 staging 闸门是 signed-in board/browser、Google/email 和一条 live AI smoke。
- `deploy/production/README.md` 与 `deploy/production/api.env.example` 已建立 production 边界，但 production 仍保持关闭，直到 staging 验收完整转绿。

## 先说结论

Gemini 给的方向总体合适：域名先接 Cloudflare，前端用 Vercel，后端用 Hetzner VPS，数据库用 Neon，图片用 Cloudflare R2，登录用 Clerk + Google OAuth。这个组合对 P0 很现实，成本低，资料多，后续也能扩展。

我建议做三处调整：

1. 先做 staging，不直接上 production。
   用 `staging.<domain>` 和 `api-staging.<domain>` 先测试。等 Auth、支付、隐私政策、AI provider 都准备好，再切生产域名。

2. DNS 先用 DNS-only，跑通后再考虑 Cloudflare proxy。
   Vercel 自己有 CDN/TLS；FastAPI 先让 Caddy/Nginx 直接签 HTTPS 证书最省心。Cloudflare 橙云代理后面可以加，但别一开始就增加排查变量。

现在这条建议已经进入下一阶段：

- bring-up 时继续用 DNS-only 更省心；
- 但在 smoke 已转绿后，可以把 `staging` 和 `api-staging` 都切到橙云代理；
- 只是 `staging` 仍然应该保持 proxied Vercel CNAME，`api-staging` 才是 proxied Hetzner A；
- SSH 永远不要走 Cloudflare。

3. R2 bucket 先不要整桶公开。
   P0 可以给 `S3_PUBLIC_BASE_URL` 配一个 assets 子域名来读图片，但写入密钥只放 FastAPI。后续如果要做私有 Board/团队权限，最好改成签名 URL 或 API 授权读取。

## 推荐账号和服务

```text
域名注册: Porkbun / Namecheap / Cloudflare Registrar
DNS: Cloudflare
前端: Vercel
后端: Hetzner Cloud VPS
数据库: Neon Postgres
对象存储: Cloudflare R2
Auth: Clerk
邮箱发送: Resend
OAuth: Google Cloud Console production OAuth client
代码仓库: GitHub private repository
密钥管理: 1Password / Bitwarden / Apple Passwords
```

## 域名规划

假设你的主域名是：

```text
your-domain.com
```

建议这样分：

```text
staging.your-domain.com      -> Vercel staging Web
api-staging.your-domain.com  -> Hetzner FastAPI staging API
assets-staging.your-domain.com -> Cloudflare R2 staging assets, optional

app.your-domain.com          -> future production Web
api.your-domain.com          -> future production API
assets.your-domain.com       -> future production assets
```

不要一开始就把根域名 `your-domain.com` 用掉。根域名以后可以做官网 landing page，app 用 `app.` 或 `staging.` 更清楚。

## 密钥记录模板

新建一个私密文档，名字可以叫：

```text
TANGENT Deployment Secrets - DO NOT COMMIT
```

本仓库已经准备了一个本地填写表，路径是：

```text
deploy/staging/deployment-secrets.local.md
```

这个文件已经被 `.gitignore` 忽略。你可以直接在里面填真实配置和密钥，不要把里面的值复制到聊天窗口，也不要改名成会被 Git 追踪的文件。

里面只记录占位，不要放进 Git：

```text
Domain:
Cloudflare account email:
Vercel account email:
GitHub repo:
Hetzner account email:
Hetzner server IP:
Neon project:
Neon DATABASE_URL:
R2 account id:
R2 bucket:
R2 S3 endpoint:
R2 access key id:
R2 secret access key:
Clerk publishable key:
Clerk secret key:
Clerk issuer:
Clerk JWKS URL:
Clerk audience:
Resend API key:
Google OAuth client id:
Google OAuth client secret:
```

原则：

- `NEXT_PUBLIC_` 开头的变量才可以给前端。
- `SECRET`、`DATABASE_URL`、`S3_SECRET_ACCESS_KEY`、Google Client Secret 只能放后端或服务商后台。
- 不要截图发密钥，不要贴进聊天窗口，不要 commit。

## Phase 1: 买域名并接入 Cloudflare

### 1. 买域名

推荐选择：

- Porkbun：便宜、WHOIS privacy 通常友好。
- Namecheap：老牌，操作也简单。
- Cloudflare Registrar：如果支持你想买的后缀，后续 DNS 最顺。

操作：

1. 打开域名商网站。
2. 搜索域名，例如 `your-domain.com`。
3. 确认首年价格和续费价格。续费价格更重要。
4. 购买时打开 WHOIS privacy / domain privacy。
5. 支付后进入域名管理后台。

避坑：

- 不建议 GoDaddy 作为首选，续费和附加销售容易让新手困惑。
- 不要买太冷门的后缀，`.com`、`.ai`、`.art`、`.app`、`.studio` 都比奇怪后缀稳。
- 域名还没确定品牌时，先买一个 staging 用域名也可以。

### 2. 接入 Cloudflare DNS

操作：

1. 注册 Cloudflare。
2. 点击 Add a site。
3. 输入你的域名。
4. 选择 Free plan。
5. Cloudflare 会给你两个 nameserver。
6. 回到域名商后台，找到 Nameservers。
7. 把原 nameserver 替换成 Cloudflare 给你的两个。
8. 回 Cloudflare 等待 Active。

等待时间：

- 快的话几分钟。
- 慢的话可能几个小时。

成功标志：

```text
Cloudflare site status = Active
```

### 2.1 先做源站防火墙，不要先指望 Cloudflare 保护 SSH

在 Hetzner/UFW 上先收口：

```bash
ufw default deny incoming
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow from <你的公网IP> to any port 22 proto tcp
ufw enable
ufw status verbose
```

要求：

- 对外只开 `80/tcp` 和 `443/tcp`
- `22/tcp` 只允许你的固定公网 IP
- 即使后面启用 Cloudflare 橙云，SSH 也不走它
- 如果 root SSH 只用于救援，恢复后应改回 key-only

### 2.2 Cloudflare 代理、SSL、WAF 和限流

当 source host 已经收口后，再做：

1. `staging.<domain>` 保持 Vercel CNAME，只把它切到橙云代理
2. `api-staging.<domain>` 指向 Hetzner A 记录，并切到橙云代理
3. `SSL/TLS` 设为 `Full (strict)`，不要用 `Flexible`
4. `Security -> WAF` 打开 Managed Rules
5. 如果套餐支持，打开基础 Bot 防护
6. 至少给这些路径加 Rate Limit：
   - `/sign-in*`
   - `/api/auth/*`
   - `/api/v1/ai/*`
   - `/api/v1/admin/*`
   - `/api/v1/boards/*`
7. 监控 `/health`、5xx、源站不可达和异常流量峰值

## Phase 2: 建数据库 Neon

### 3. 创建 Neon 项目

操作：

1. 打开 Neon。
2. 用 GitHub 或 Google 登录。
3. New Project。
4. Region 选靠近后端服务器的位置。
   - 如果 Hetzner 选 Hillsboro，美西优先选 Oregon / US West 一类区域。
5. 创建数据库。
6. 复制 connection string。

保存：

```text
DATABASE_URL=postgresql://...
```

建议：

- 现在直接采用双 URL：`DATABASE_URL` 只给 Alembic / 管理命令，`DATABASE_POOL_URL` 给 API runtime。
- Neon 这类 serverless Postgres 运行时优先使用 pooled URL，避免把迁移连接方式直接带进线上运行。

TANGENT 当前后端需要：

```text
DATABASE_URL
TANGENT_POSTGRES_AUTO_CREATE_TABLES=0
```

`TANGENT_POSTGRES_AUTO_CREATE_TABLES=0` 表示 staging/prod 依赖 Alembic migration，不让 API 在运行时偷偷建表。

## Phase 3: 建 Cloudflare R2 图片存储

### 4. 创建 R2 bucket

操作：

1. 打开 Cloudflare Dashboard。
2. 找到 R2。
3. 第一次使用可能需要绑定信用卡。
4. Create bucket。
5. staging bucket 建议命名：

```text
tangent-staging-assets
```

生产 bucket 以后再建：

```text
tangent-production-assets
```

### 5. 创建 R2 S3 API token

操作：

1. R2 页面进入 Manage R2 API Tokens。
2. Create API token。
3. 权限选 Object Read & Write。
4. 范围尽量限制到 staging bucket。
5. 创建后立刻复制：

```text
S3_ACCESS_KEY_ID
S3_SECRET_ACCESS_KEY
```

同时记录：

```text
S3_ENDPOINT=https://<cloudflare-account-id>.r2.cloudflarestorage.com
S3_BUCKET=tangent-staging-assets
S3_REGION=auto
S3_ADDRESSING_STYLE=path
```

### 6. 是否配置 assets 子域名

第一版可以先不配 `S3_PUBLIC_BASE_URL`，让 API 返回内部读路径或后面再补。

如果要让图片 URL 直接从 R2 公开读取：

```text
assets-staging.your-domain.com
```

注意：

- 公开 assets 子域名意味着知道 URL 的人可能读取图片。
- 对私有 Board，后续最好改成 signed URL。
- 写权限永远只能在 FastAPI，前端不能拿 R2 secret。

## Phase 4: 建 Clerk Auth 和 Google 登录

### 7. 创建 Clerk application

操作：

1. 打开 Clerk。
2. Create application。
3. 登录方式勾选：
   - Email address
   - Google
4. 进入 API Keys。
5. 保存：

```text
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
```

当前 S1C 的技术边界：

```text
Next.js 使用 Clerk UI 登录
Clerk 负责 Google OAuth
前端拿 provider JWT
FastAPI 验证 JWT
FastAPI 映射到 tangent_users / tangent_oauth_accounts
Board 权限仍看 tangent workspace/board membership
```

### 7.1 当前本地 `.env` 安全盘点

2026-05-05 已做一次只看变量名和是否已填写的安全检查，没有读取或记录任何 secret 原值。

当前状态：

```text
基础设施:
- DATABASE_URL / DATABASE_POOL_URL / DATABASE_DIRECT_URL: 已填写
- Cloudflare / R2 / Hetzner 相关变量: 已填写
- S3_PUBLIC_BASE_URL: 为空
- Vercel 相关变量: 为空

Auth:
- AUTH_PROVIDER: 已填写
- NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: 为空
- CLERK_SECRET_KEY: 为空
- CLERK_JWKS_URL: 为空
- CLERK_JWT_ISSUER: 为空
- CLERK_JWT_AUDIENCE: 为空
- Clerk sign-in/sign-up redirect 变量: 为空

Google OAuth:
- GOOGLE_CLIENT_ID: 为空
- GOOGLE_CLIENT_SECRET: 为空
- GOOGLE_AUTHORIZED_DOMAIN: 为空
- GOOGLE_PRIVACY_POLICY_URL: 为空
- GOOGLE_TERMS_URL: 为空

Email:
- RESEND_API_KEY: 为空
- RESEND_DOMAIN: 为空
- RESEND_FROM_EMAIL: 为空
```

结论：

- 你已经有 Clerk 账号/应用的话，下一步主要是把 Clerk key 和 Google OAuth production credentials 补进安全密钥文档和部署环境。
- 不要把 `CLERK_SECRET_KEY`、`GOOGLE_CLIENT_SECRET`、`DATABASE_URL`、R2 secret 或任何 API key 发到聊天窗口。
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` 可以放前端，因为它本来就是 public key。
- `CLERK_SECRET_KEY` 只能放后端 API/Vercel server env，不能暴露给浏览器。

### 8. 配置 Clerk redirect URLs

开发环境：

```text
http://localhost:3000
```

staging：

```text
https://staging.your-domain.com
```

后续生产：

```text
https://app.your-domain.com
```

Clerk 里需要检查的地方：

```text
Clerk Dashboard
-> 选择 TANGENT application
-> Configure
-> Paths / Redirects
```

建议先填：

```text
Sign-in URL: /sign-in
Sign-up URL: /sign-up
After sign-in URL: /workspaces
After sign-up URL: /workspaces
```

如果 Clerk UI 走 Clerk Account Portal，也可以先用 Clerk 默认页面测试。等 S1C 前端实现完成后，再切到 TANGENT 自己的 `/sign-in` 和 `/sign-up` 页面。

### 8.1 Tanergy staging 入口流程

项目公开入口现在按 Tanergy 流程走：

```text
https://staging.tanergy.cc
  -> Tanergy homepage
  -> /sign-in or /sign-up
  -> Clerk email / Google / GitHub verification
  -> /workspaces
```

旧入口兼容：

```text
/login    -> /sign-in
/signup   -> /sign-up
/register -> /sign-up
```

staging 想强制登录后才能进入 workspace 时，部署环境需要打开：

```text
TANGENT_REQUIRE_WEB_AUTH=1
```

本地如果还要继续快速调画布，可以先保持：

```text
TANGENT_REQUIRE_WEB_AUTH=0
```

本地 Next dev server 是从 `apps/web` 启动的，所以 Clerk 前端变量需要放进 `apps/web/.env.local`，或在启动命令前导出到 shell。只填仓库根目录 `.env` 时，Next 可能会进入 Clerk keyless mode。

本地 `apps/web/.env.local` 至少需要：

```text
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=<Clerk publishable key>
TANGENT_REQUIRE_WEB_AUTH=1
```

说明一下你前面遇到的图片问题：本地浏览器上传图片、粘贴外部图片、粘贴截图，这条链路不要求数据库先接好。当前本地 fallback 会直接写到仓库下的 `.tangent-assets`，对应 Web 侧 `/api/assets/from-data-url` / `/api/assets/from-url`。所以如果以后本地上传突然失效，优先排查 dev server、浏览器权限、asset route、storage dir，不要先怀疑是 Postgres。

如果要让前端代理层也使用这些 route 默认值，可以一起放：

```text
CLERK_SIGN_IN_URL=/sign-in
CLERK_SIGN_UP_URL=/sign-up
CLERK_AFTER_SIGN_IN_URL=/workspaces
CLERK_AFTER_SIGN_UP_URL=/workspaces
```

如果你要让 FastAPI 也严格校验 Clerk token 里的 `azp`，服务器 env 里再加：

```text
CLERK_AUTHORIZED_PARTIES=https://staging.tanergy.cc,http://localhost:3000,http://127.0.0.1:3000
```

不填时，后端会回退使用 `TANGENT_ALLOWED_ORIGINS` 作为允许来源列表。

Google 已经在 Clerk 里配置后，`/sign-in` 和 `/sign-up` 会显示 Google 登录。GitHub 也按同一个逻辑：去 Clerk Dashboard 的 Social connections 里启用 GitHub，创建/填写 GitHub OAuth credentials 后，Clerk 的登录组件会显示 GitHub 入口。

### 9. 生产 Google OAuth 准备，小白详细版

Clerk dev 模式可以先跑通 Google 登录；公开 staging/production 前，需要在 Google Cloud Console 建正式 OAuth client，然后把拿到的 Client ID / Client Secret 填回 Clerk。

最重要的概念：

```text
Google Cloud Console:
- 负责创建 Google OAuth client id / secret。
- 负责配置授权域名、同意屏幕、测试用户或正式发布状态。

Clerk:
- 负责登录 UI 和 OAuth 流程。
- 负责给我们一个 Authorized Redirect URI。
- 你要把 Google 的 Client ID / Secret 粘回 Clerk。

TANGENT:
- 前端只用 Clerk publishable key。
- 后端只验证 Clerk JWT。
- TANGENT 自己不直接拿 Google secret 做浏览器登录。
```

#### 9.1 准备材料

先准备这些文字/链接，后面会用到：

```text
App name
App logo
Authorized domain: your-domain.com
Privacy Policy URL
Terms URL
Authorized redirect URIs from Clerk
```

建议 staging 阶段：

```text
App name: TANGENT Staging
Authorized domain: your-domain.com
Homepage: https://staging.your-domain.com
Privacy Policy URL: https://staging.your-domain.com/privacy
Terms URL: https://staging.your-domain.com/terms
```

如果现在还没有 privacy/terms 页面，可以先建两个极简页面，公开上线前再补正式文本。Google OAuth 生产发布通常会要求这些信息像一个真实产品。

#### 9.2 在 Clerk 里拿 Authorized Redirect URI

操作：

1. 打开 Clerk Dashboard。
2. 进入你的 TANGENT application。
3. 左侧找到 `SSO connections` 或 `Social connections`。
4. 点击 `Add connection`。
5. 选择 `For all users`。
6. 选择 `Google`。
7. 打开：

```text
Enable for sign-up and sign-in
Use custom credentials
```

8. Clerk 会显示一个 `Authorized Redirect URI`。
9. 把这个 URI 复制到你的私密部署文档：

```text
deploy/staging/deployment-secrets.local.md
```

注意：

- 这个 redirect URI 要原样复制，不能自己猜。
- 后面 Google OAuth client 的 `Authorized redirect URIs` 必须和 Clerk 给的一模一样。
- 如果不一致，登录时会出现 `redirect_uri_mismatch`。

#### 9.3 打开 Google Cloud Console

操作：

1. 打开 `https://console.cloud.google.com/`。
2. 右上角确认登录的是你要用于 TANGENT 的 Google 账号。
3. 顶部项目选择器点击 `Select a project`。
4. 如果还没有项目，点击 `New Project`。
5. 推荐项目名：

```text
TANGENT Staging
```

6. Organization 可以不选，个人账号一般没有组织。
7. Location 保持默认。
8. 点击 `Create`。
9. 创建后确认顶部当前项目已经切到 `TANGENT Staging`。

#### 9.4 配置 OAuth consent screen / Google Auth Platform

Google 控制台 UI 可能会显示为 `OAuth consent screen`，新版也可能叫 `Google Auth Platform`。目标是同一个：告诉 Google 这个登录应用叫什么、给谁用、请求什么权限。

操作：

1. 左侧菜单打开：

```text
APIs & Services
-> OAuth consent screen
```

或者：

```text
APIs & Services
-> Google Auth Platform
-> Branding / Audience / Data Access
```

2. User Type 选择：

```text
External
```

说明：

- `Internal` 只给 Google Workspace 组织内部用户用。
- 个人项目和公开产品通常选 `External`。

3. App information 填：

```text
App name: TANGENT Staging
User support email: 你的邮箱
App logo: 可以先不传；公开 production 前建议补
```

4. App domain 填：

```text
Application home page: https://staging.your-domain.com
Application privacy policy link: https://staging.your-domain.com/privacy
Application terms of service link: https://staging.your-domain.com/terms
```

5. Authorized domains 添加：

```text
your-domain.com
```

不要填 `https://`，只填域名本体。

6. Developer contact information 填你的邮箱。
7. 保存。

#### 9.5 Scopes 权限选择

P0 登录只需要基础身份，不要申请 Google Drive、Calendar、Gmail 这些敏感权限。

建议只保留：

```text
openid
email
profile
```

如果 Google UI 没有显式让你选，默认 Sign in with Google 通常也是基础身份信息。

原则：

- 权限越少越容易过审核。
- 不要为了未来功能提前申请敏感 scope。
- 后续如果要接 Google Drive，再单独做新 slice 和审核准备。

#### 9.6 添加测试用户

如果 OAuth app 还在 Testing 状态，Google 通常只允许测试用户登录。

操作：

1. 找到 `Audience` 或 `Test users`。
2. 添加你自己的 Google 邮箱。
3. 如果要让别人一起测，也把他们的 Google 邮箱加进去。
4. 保存。

注意：

- Testing 模式适合 staging。
- 要公开给所有用户，后面要把 publishing status 切成 `In production`。
- 公开 production 可能触发 Google 审核，尤其是 app logo、隐私政策、服务条款和 scopes。

#### 9.7 创建 OAuth Client ID

操作：

1. 左侧打开：

```text
APIs & Services
-> Credentials
```

2. 点击顶部：

```text
Create Credentials
-> OAuth client ID
```

3. Application type 选择：

```text
Web application
```

4. Name 推荐：

```text
TANGENT Staging Clerk
```

5. `Authorized JavaScript origins` 添加：

```text
http://localhost:3000
https://staging.your-domain.com
```

后续 production 再加：

```text
https://app.your-domain.com
```

6. `Authorized redirect URIs` 添加 Clerk 刚才给你的 URI。

不要填 TANGENT 自己的 `/api/auth/callback/google`，因为 Google 回调是 Clerk 接收，不是我们接收。

7. 点击 `Create`。
8. Google 会弹出：

```text
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
```

9. 把它们记录到私密部署文档，不要发到聊天窗口：

```text
deploy/staging/deployment-secrets.local.md
```

#### 9.8 把 Google Client ID / Secret 填回 Clerk

操作：

1. 回到 Clerk Dashboard 的 Google connection 页面。
2. 确认 `Use custom credentials` 是打开的。
3. 粘贴：

```text
Client ID
Client Secret
```

4. 保存。
5. 用 Clerk Account Portal 或 TANGENT `/sign-in` 页面测试 Google 登录。

成功标志：

```text
点击 Continue with Google
-> 跳到 Google 登录/授权页
-> 同意后回到 Clerk/TANGENT
-> 用户能进入 /workspaces
```

常见错误：

```text
redirect_uri_mismatch:
  Google 里的 Authorized redirect URI 和 Clerk 给的不一致。重新复制 Clerk URI。

access_denied:
  当前 Google 账号不在 test users，或者 consent screen 没保存。

invalid_client:
  Client ID / Client Secret 填错，或者填到了错误的 Clerk environment。

This app is blocked:
  OAuth app 状态、域名、隐私政策、scope 或 Google 审核问题。
```

#### 9.9 本项目环境变量怎么填

本地 `.env` 或部署平台变量：

```text
AUTH_PROVIDER=clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=<Clerk publishable key>
CLERK_SECRET_KEY=<Clerk secret>
CLERK_JWKS_URL=<Clerk JWKS URL>
CLERK_JWT_ISSUER=<Clerk issuer>
CLERK_JWT_AUDIENCE=<Clerk audience>
CLERK_SIGN_IN_URL=/sign-in
CLERK_SIGN_UP_URL=/sign-up
CLERK_AFTER_SIGN_IN_URL=/workspaces
CLERK_AFTER_SIGN_UP_URL=/workspaces
```

Google 这两个优先填在 Clerk Dashboard，不需要前端读取：

```text
GOOGLE_CLIENT_ID=<Google OAuth client id>
GOOGLE_CLIENT_SECRET=<Google OAuth client secret>
```

如果 `.env` 里保留这两个变量，也只作为本地安全记录或后端辅助，不允许发到前端，不允许 commit。

部署平台建议：

```text
Vercel:
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
  NEXT_PUBLIC_API_BASE_URL

FastAPI server:
  CLERK_SECRET_KEY
  CLERK_JWKS_URL
  CLERK_JWT_ISSUER
  CLERK_JWT_AUDIENCE
  TANGENT_REQUIRE_API_AUTH=1
```

#### 9.10 邮箱验证需要收费吗？

P0 建议先用 Clerk 自带邮箱登录/验证能力，不要自己先接 Resend 做 Auth 邮件。

当前理解，按 2026-05-05 官方价格页核对：

- Clerk Hobby 显示 Free，并包含 sign-up / sign-in / user profile 的 API 和预构建 UI。
- Hobby 当前显示每个 app 有 50,000 monthly recurring users limit。
- 也就是说，小规模 staging / P0 测试的邮箱登录和验证一般不需要单独付邮件验证费用。

但要注意：

- Clerk 价格和免费额度可能变，公开上线前再复核一次 pricing。
- 如果要去掉 Clerk branding、改更高级 session/MFA、企业能力或更大规模，可能需要 Pro/Business。
- 如果你用 Resend 发自己的 welcome、invite、billing、marketing 邮件，Resend 是另一套计费。
- 如果不用 Clerk 邮件、自己实现 OTP/magic link，才需要额外邮件服务和安全实现，P0 不建议。

## Phase 5: 邮箱发送 Resend

Clerk 自带 Auth 邮件能力，P0 可以先用 Clerk 处理登录邮件。Resend 主要用于后续你自己的邮件：

```text
OTP
welcome email
billing receipt
team invite
passwordless link if not fully using Clerk
```

操作：

1. 打开 Resend。
2. Add domain。
3. 输入你的域名。
4. Resend 会给 DNS records。
5. 回 Cloudflare DNS 添加 SPF / DKIM / DMARC 或 Resend 要求的记录。
6. 等 Resend 显示 verified。
7. 保存：

```text
RESEND_API_KEY=re_...
```

注意：

- DNS 记录严格照 Resend 给的填。
- 邮箱发送域名建议用 `mail.your-domain.com` 或直接验证根域。
- 生产前一定要发一封测试邮件到 Gmail / Outlook，确认不进垃圾箱。

## Phase 6: 买 Hetzner VPS 并部署 FastAPI

### 10. 创建 Hetzner 账号

新手注意：

- 不要挂 VPN 注册。
- 使用真实姓名、真实地址、真实支付方式。
- Hetzner 可能要求身份验证，按流程走。

### 11. 创建服务器

推荐 staging 起步：

```text
Location: Hillsboro / US West, if available
Image: Ubuntu or Docker CE app image
Type: small shared vCPU instance
```

不要先买很大。P0 staging 只需要能跑 FastAPI container。

记录：

```text
Server IP
root password or SSH key
```

### 12. 配 SSH key

在自己电脑上检查有没有 SSH key：

```bash
ls ~/.ssh
```

如果没有：

```bash
ssh-keygen -t ed25519 -C "your-email@example.com"
```

把 public key 复制到 Hetzner Cloud Console。

### 13. 配 Cloudflare DNS for API

在 Cloudflare DNS 添加：

```text
Type: A
Name: api-staging
IPv4 address: <Hetzner server IP>
Proxy status: DNS only first
```

为什么先 DNS only：

- Caddy/Nginx 直接签证书更简单。
- 排查 HTTPS、CORS、upload 问题更直观。
- 跑通后再决定要不要打开 Cloudflare proxy。

### 14. 连接服务器

```bash
ssh root@<server-ip>
```

首次进入后建议：

```bash
apt update
apt upgrade -y
```

如果不是 Docker CE image，需要安装 Docker：

```bash
curl -fsSL https://get.docker.com | sh
```

### 15. 克隆代码

```bash
git clone <your-private-github-repo-url> TanvasAgent
cd TanvasAgent
```

如果是私有仓库，需要配置 GitHub deploy key 或用 GitHub CLI/token。

### 16. 创建 FastAPI env 文件

```bash
cp deploy/staging/api.env.example deploy/staging/api.env
nano deploy/staging/api.env
```

填写这些：

```text
TANGENT_ASSET_STORAGE_DRIVER=s3-compatible
TANGENT_ASSET_METADATA_DRIVER=postgres
TANGENT_BOARD_STORAGE_DRIVER=postgres
TANGENT_POSTGRES_AUTO_CREATE_TABLES=0
TANGENT_FREE_BOARD_SNAPSHOT_LIMIT=100

DATABASE_URL=<Neon direct connection string>

TANGENT_REQUIRE_API_AUTH=0
TANGENT_ALLOWED_ORIGINS=https://staging.your-domain.com,http://localhost:3000

S3_ENDPOINT=https://<cloudflare-account-id>.r2.cloudflarestorage.com
S3_BUCKET=tangent-staging-assets
S3_ACCESS_KEY_ID=<R2 access key>
S3_SECRET_ACCESS_KEY=<R2 secret>
S3_REGION=auto
S3_ADDRESSING_STYLE=path
S3_PUBLIC_BASE_URL=
```

S1C Auth 接上后再加：

```text
AUTH_PROVIDER=clerk
CLERK_SECRET_KEY=<Clerk secret>
CLERK_JWKS_URL=<Clerk JWKS URL>
CLERK_JWT_ISSUER=<Clerk issuer>
CLERK_JWT_AUDIENCE=<Clerk audience>
TANGENT_REQUIRE_API_AUTH=1
```

### 17. 跑数据库 migration

```bash
docker compose -f deploy/staging/docker-compose.api.yml build
docker compose -f deploy/staging/docker-compose.api.yml run --rm api alembic upgrade head
```

成功标志：

```text
Running upgrade ... 20260502_0006
```

如果这是一个可以清空的 staging smoke 数据库，也可以跑 S1A 完整迁移 smoke：

```bash
docker compose -f deploy/staging/docker-compose.api.yml run --rm \
  -e S1A_SMOKE_DATABASE_URL="$DATABASE_URL" \
  -e S1A_SMOKE_ALLOW_RESET=1 \
  api python scripts/s1a_migration_smoke.py
```

注意：这个 smoke 会删除 `tangent_%` tables 和 `alembic_version`。不要在生产库或有重要数据的库上跑。

### 18. 启动 API

```bash
docker compose -f deploy/staging/docker-compose.api.yml up -d
docker compose -f deploy/staging/docker-compose.api.yml ps
curl http://127.0.0.1:8000/health
```

成功返回：

```json
{"status":"ok"}
```

### 19. 配 HTTPS 反向代理

现在 compose 只把 API 绑定在服务器本地：

```text
127.0.0.1:8000
```

公网 HTTPS 需要 Caddy 或 Nginx。新手建议 Caddy，因为自动 HTTPS 简单。

Caddyfile 目标大概是：

```text
api-staging.your-domain.com {
  reverse_proxy 127.0.0.1:8000
}
```

这一步后可以测试：

```bash
curl https://api-staging.your-domain.com/health
```

成功返回：

```json
{"status":"ok"}
```

## Phase 7: Vercel 部署 Next.js 前端

### 20. 确认 GitHub 仓库

确保代码已经 push 到 GitHub 私有仓库。

### 21. 创建 Vercel project

操作：

1. 打开 Vercel。
2. Add New Project。
3. Import Git Repository。
4. 选择 TanvasAgent 仓库。
5. 因为这是 monorepo，Root Directory 选：

```text
apps/web
```

环境变量：

```text
NEXT_PUBLIC_API_BASE_URL=https://api-staging.your-domain.com
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=<Clerk publishable key>
```

不要放：

```text
CLERK_SECRET_KEY
DATABASE_URL
S3_SECRET_ACCESS_KEY
GOOGLE_CLIENT_SECRET
```

### 22. 绑定 staging 域名

在 Vercel Project Settings -> Domains 添加：

```text
staging.your-domain.com
```

Vercel 会告诉你需要加 DNS 记录。回到 Cloudflare DNS 添加它。

建议：

```text
Proxy status: DNS only first
```

成功后访问：

```text
https://staging.your-domain.com
```

## Phase 8: S1B smoke test

### 23. API health

```bash
curl -sS https://api-staging.your-domain.com/health
```

期望：

```json
{"status":"ok"}
```

### 24. CORS

```bash
curl -i -X OPTIONS https://api-staging.your-domain.com/api/v1/assets/from-data-url \
  -H 'Origin: https://staging.your-domain.com' \
  -H 'Access-Control-Request-Method: POST'
```

期望：

```text
HTTP 200
access-control-allow-origin: https://staging.your-domain.com
```

### 25. Alembic

服务器上：

```bash
docker compose -f deploy/staging/docker-compose.api.yml run --rm api alembic current
```

期望看到最新 revision：

```text
20260502_0006
```

### 26. Board save/load

```bash
curl -sS -X POST https://api-staging.your-domain.com/api/v1/boards \
  -H 'Content-Type: application/json' \
  --data '{"boardId":"staging-smoke-board","document":{"shapes":[],"assets":[]},"title":"Staging Smoke Board"}'

curl -sS https://api-staging.your-domain.com/api/v1/boards/staging-smoke-board
```

### 27. R2 asset upload/read

用 `deploy/staging/README.md` 里的 asset smoke。先用小图，不要一开始测大文件。

### 28. Web smoke

浏览器打开：

```text
https://staging.your-domain.com/workspaces
```

检查：

- 页面能打开。
- Workspace cards 显示。
- 打开 Board。
- 画一个形状。
- 保存。
- 刷新。
- Board 仍能 load。

### 29. Google login smoke

S1C 代码接完后再测：

- 点击 Continue with Google。
- Google 授权后回到 `staging.your-domain.com`。
- 页面显示用户头像或账户入口。
- FastAPI `/api/v1/auth/session` 接受 provider JWT。
- 无效 JWT 返回 401。

### 30. Admin owner bootstrap，小白安全流程

Admin 后台不是 workspace 里的 `owner/admin`。Workspace admin 只能管自己的 workspace；全站后台必须走数据库里的 `tangent_admin_roles`。

当前 staging 目标：

```text
已验证 Clerk 用户
  -> FastAPI S1C 映射到 tangent_users
  -> 只允许服务器侧 bootstrap 授予第一个 admin owner
  -> 后续 admin 页面必须服务端检查 tangent_admin_roles
  -> 所有 admin 写操作写 tangent_admin_audit_logs
```

第一个 admin 不要通过前端按钮创建，也不要信任浏览器传来的 `isAdmin=true`。推荐用一次性的服务器命令或 seed 脚本。

准备信息：

```text
你的 Clerk 登录邮箱
你的 tangent_users.id
```

`tangent_users.id` 要等 S1C Auth mapping 完成后才会真实出现。可以通过服务器 DB 只读查询确认：

```sql
SELECT id, email, status, created_at
FROM tangent_users
WHERE lower(email) = lower('<your-admin-email>');
```

确认只有一行、邮箱是你自己之后，再授予 owner：

```sql
INSERT INTO tangent_admin_roles (
  user_id,
  role,
  permissions,
  note,
  granted_by
)
VALUES (
  '<tangent-user-id>',
  'owner',
  '{"bootstrap": true}'::jsonb,
  'Initial staging admin owner bootstrap',
  '<tangent-user-id>'
)
ON CONFLICT (user_id, role)
DO UPDATE SET
  revoked_at = NULL,
  permissions = EXCLUDED.permissions,
  note = EXCLUDED.note;
```

同时写一条 audit log：

```sql
INSERT INTO tangent_admin_audit_logs (
  id,
  actor_user_id,
  target_user_id,
  action,
  metadata
)
VALUES (
  'admin-audit-' || replace(gen_random_uuid()::text, '-', ''),
  '<tangent-user-id>',
  '<tangent-user-id>',
  'admin.bootstrap_owner',
  '{"source": "manual-staging-runbook"}'::jsonb
);
```

如果 Neon/Postgres 没有 `gen_random_uuid()`，先启用：

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;
```

验收查询：

```sql
SELECT user_id, role, permissions, note, created_at, revoked_at
FROM tangent_admin_roles
WHERE user_id = '<tangent-user-id>';

SELECT actor_user_id, target_user_id, action, metadata, created_at
FROM tangent_admin_audit_logs
WHERE action = 'admin.bootstrap_owner'
ORDER BY created_at DESC
LIMIT 5;
```

安全规则：

- 不要把 `admin_roles` 做成前端环境变量。
- 不要让前端请求直接传 `admin=true`。
- 不要给没有完成邮箱/Google 验证的用户加 admin。
- 第一个 admin 只在 staging/production 服务器侧执行一次。
- 后续“管理员给用户设置管理员”必须由后端 route 执行，并写 audit log。

角色建议：

```text
owner: 全站最高权限，人数极少。
admin: 用户/内容/系统管理，不能越过 owner 安全边界。
support: 客服查看用户和 workspace，默认少写操作。
analyst: 只读分析和 AI run/cost 视图。
finance: 账单、订阅、credit ledger。
moderator: 内容审核和封禁相关操作。
```

## Phase 9: 生产前不能漏的事情

公开生产前必须补：

- Privacy Policy 页面。
- Terms of Service 页面。
- Google Cloud OAuth production client。
- Clerk production instance / production keys。
- Konva-only board-route smoke passed，且 legacy Board 文档在 active app path 中被阻止。
- Postgres backup / restore strategy。
- R2 lifecycle / retention policy。
- API rate limit。
- Admin owner account bootstrap。
- Error logging and uptime monitoring。
- Stripe / billing webhook secret if billing starts。
- `TANGENT_REQUIRE_API_AUTH=1`。

## 我的最终建议顺序

```text
1. 买域名
2. 接 Cloudflare DNS
3. 建 Neon staging DB
4. 建 R2 staging bucket
5. 建 Clerk app and enable Google
6. 建 Resend domain, optional but recommended
7. 买 Hetzner VPS
8. 配 api-staging DNS
9. 部署 FastAPI and run Alembic
10. 配 Caddy HTTPS
11. Vercel deploy apps/web
12. 配 staging Web domain
13. 跑 S1B smoke
14. 再进入 S1C Auth implementation
```

## 官方参考

- Cloudflare add site / nameservers: https://developers.cloudflare.com/fundamentals/setup/manage-domains/add-site/
- Cloudflare DNS records: https://developers.cloudflare.com/dns/manage-dns-records/how-to/create-dns-records/
- Cloudflare R2: https://developers.cloudflare.com/r2/
- Vercel domains: https://vercel.com/docs/domains
- Vercel environment variables: https://vercel.com/docs/environment-variables
- Neon docs: https://neon.com/docs
- Hetzner Cloud docs: https://docs.hetzner.com/cloud/
- Clerk Next.js quickstart: https://clerk.com/docs/quickstarts/nextjs
- Clerk social connections: https://clerk.com/docs/authentication/social-connections/overview
- Clerk Google social connection setup: https://clerk.com/docs/authentication/social-connections/google
- Clerk token verification: https://clerk.com/docs/backend-requests/handling/manual-jwt
- Clerk pricing: https://clerk.com/pricing
- Google OAuth 2.0: https://developers.google.com/identity/protocols/oauth2
- Google OAuth web server apps: https://developers.google.com/identity/protocols/oauth2/web-server
- Google OAuth consent / verification: https://support.google.com/cloud/answer/13463073
- Resend domains: https://resend.com/docs/dashboard/domains/introduction
