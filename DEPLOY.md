# 生产部署指南

## 架构

```
一台云服务器 (推荐 2C4G 起步)
├── Nginx (443) — SSL 终止 + 反向代理
│   ├── api.tangent.ai    → FastAPI
│   └── admin.tangent.ai  → Admin Dashboard
├── FastAPI Backend (Docker)
├── PostgreSQL 16 (Docker)
└── Redis 7 (Docker)
```

## 前置条件

- 云服务器（阿里云/腾讯云/AWS EC2）
- 域名 `tangent.ai`（DNS 指向服务器 IP）
- SSL 证书（Let's Encrypt 免费申请）

## 部署步骤

### 1. 服务器初始化

```bash
# SSH 到服务器
ssh root@your-server-ip

# 安装 Docker + Docker Compose
curl -fsSL https://get.docker.com | sh

# 克隆代码
git clone https://github.com/your-org/tangent.git /opt/tangent
cd /opt/tangent
```

### 2. 配置环境变量

```bash
# 复制并编辑生产配置
cp backend/.env.prod backend/.env.prod
nano backend/.env.prod

# 生成密钥
openssl rand -hex 32  # 用于 APP_SECRET_KEY
openssl rand -hex 32  # 用于 JWT_SECRET_KEY

# 设置 PostgreSQL 密码
export POSTGRES_PASSWORD=$(openssl rand -hex 16)
```

### 3. SSL 证书

```bash
# 安装 certbot
apt install certbot

# 申请证书
certbot certonly --standalone -d api.tangent.ai -d admin.tangent.ai

# 复制到 nginx 目录
mkdir -p nginx/ssl
cp /etc/letsencrypt/live/api.tangent.ai/fullchain.pem nginx/ssl/
cp /etc/letsencrypt/live/api.tangent.ai/privkey.pem nginx/ssl/

# 自动续期
echo "0 3 * * * certbot renew --quiet && cp /etc/letsencrypt/live/api.tangent.ai/*.pem /opt/tangent/nginx/ssl/ && docker compose -f docker-compose.prod.yml restart nginx" | crontab -
```

### 4. DNS 配置

在你的域名管理面板添加 A 记录：
- `api.tangent.ai` → 服务器 IP
- `admin.tangent.ai` → 服务器 IP

### 5. 启动服务

```bash
cd /opt/tangent
docker compose -f backend/docker-compose.prod.yml up -d
```

### 6. 初始化数据库

```bash
# 跑迁移
docker compose -f backend/docker-compose.prod.yml exec backend alembic upgrade head
```

### 7. 创建首个 Admin

```bash
# 先用 API 注册普通用户（通过桌面 App 或 curl）
curl -X POST https://api.tangent.ai/api/v1/auth/send-otp \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@tangent.ai"}'

# 输入验证码完成注册
curl -X POST https://api.tangent.ai/api/v1/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@tangent.ai","code":"123456"}'

# 提升为 admin
docker compose -f backend/docker-compose.prod.yml exec postgres \
  psql -U tangent -d tangent_db -c \
  "UPDATE users SET role = 'admin' WHERE email = 'admin@tangent.ai';"
```

### 8. 桌面 App 指向生产后端

在 Tauri App 的 Settings → Advanced 中，将 backend_url 改为：
```
https://api.tangent.ai
```

或者在 App 首次启动时默认使用生产地址。

## 日常运维

### 查看日志
```bash
docker compose -f backend/docker-compose.prod.yml logs -f backend
```

### 更新部署
```bash
cd /opt/tangent
git pull
docker compose -f backend/docker-compose.prod.yml build
docker compose -f backend/docker-compose.prod.yml up -d
docker compose -f backend/docker-compose.prod.yml exec backend alembic upgrade head
```

### 数据库备份
```bash
# 手动备份
docker compose -f backend/docker-compose.prod.yml exec postgres \
  pg_dump -U tangent tangent_db > backup_$(date +%Y%m%d).sql

# 自动每日备份 (crontab)
echo "0 2 * * * docker compose -f /opt/tangent/backend/docker-compose.prod.yml exec -T postgres pg_dump -U tangent tangent_db | gzip > /opt/tangent/backups/db_\$(date +\%Y\%m\%d).sql.gz" | crontab -
```

### 监控
- Admin Dashboard → /dashboard 查看调用量、用户数
- `docker stats` 查看容器资源使用

## 费用估算（起步阶段）

| 资源 | 配置 | 月费 |
|------|------|------|
| 云服务器 | 2C4G | ¥100-200 |
| 域名 | tangent.ai | ¥50/年 |
| SSL | Let's Encrypt | 免费 |
| **总计** | | **¥100-200/月** |

AI API 费用按量计费，从用户积分扣除。
