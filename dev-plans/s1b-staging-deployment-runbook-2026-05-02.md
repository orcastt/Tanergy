# S1B Staging Deployment Runbook

**Updated**: 2026-05-02
**Language**: Chinese beginner guide.
**Status**: Active S1B tactical runbook.

这份文档是 TANGENT 从本地开发走到线上 staging 的采购和配置手册。目标不是一次性公开商业发布，而是先跑通一个安全、可回滚、可手测的 staging 环境。

## 先说结论

Gemini 给的方向总体合适：域名先接 Cloudflare，前端用 Vercel，后端用 Hetzner VPS，数据库用 Neon，图片用 Cloudflare R2，登录用 Clerk + Google OAuth。这个组合对 P0 很现实，成本低，资料多，后续也能扩展。

我建议做三处调整：

1. 先做 staging，不直接上 production。
   用 `staging.<domain>` 和 `api-staging.<domain>` 先测试。等 Auth、支付、隐私政策、tldraw license、AI provider 都准备好，再切生产域名。

2. DNS 先用 DNS-only，跑通后再考虑 Cloudflare proxy。
   Vercel 自己有 CDN/TLS；FastAPI 先让 Caddy/Nginx 直接签 HTTPS 证书最省心。Cloudflare 橙云代理后面可以加，但别一开始就增加排查变量。

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

- S1B 初期用 direct connection string 跑 Alembic，少一点连接池变量。
- 后面流量起来后，再拆成 migration direct URL 和 app pooled URL。

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

### 9. 生产 Google OAuth 准备

Clerk dev 模式可以先跑通 Google 登录，但公开生产前要去 Google Cloud Console 创建正式 OAuth client。

需要准备：

```text
App name
App logo
Authorized domain: your-domain.com
Privacy Policy URL
Terms URL
Authorized redirect URIs from Clerk
```

拿到：

```text
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
```

把它们填进 Clerk 的 production Google social connection 设置里，不要放进前端代码。

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

## Phase 9: 生产前不能漏的事情

公开生产前必须补：

- Privacy Policy 页面。
- Terms of Service 页面。
- Google Cloud OAuth production client。
- Clerk production instance / production keys。
- tldraw production license。
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
- Clerk token verification: https://clerk.com/docs/backend-requests/handling/manual-jwt
- Google OAuth 2.0: https://developers.google.com/identity/protocols/oauth2
- Google OAuth consent / verification: https://support.google.com/cloud/answer/13463073
- Resend domains: https://resend.com/docs/dashboard/domains/introduction
