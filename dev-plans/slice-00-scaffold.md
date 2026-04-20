# Slice 0: 项目脚手架

**优先级**: P0 | **难度**: 低 | **预计**: 2 天 | **状态**: ⬜ 未开始
**依赖**: 无 | **返回索引**: [phase1-mvp.md](phase1-mvp.md)

---

## 目标

搭建前后端项目骨架，`docker compose up` 一键启动全部服务。

---

## 后端步骤

### Step 1: 创建后端目录结构

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py              ← FastAPI 入口，注册路由、CORS、中间件
│   ├── api/
│   │   ├── __init__.py
│   │   └── v1/
│   │       ├── __init__.py
│   │       └── health.py    ← GET /api/v1/health 健康检查
│   ├── core/
│   │   ├── __init__.py
│   │   ├── config.py        ← pydantic-settings 读取 .env
│   │   ├── database.py      ← async SQLAlchemy engine + session
│   │   └── redis.py         ← Redis 连接
│   ├── models/
│   │   └── __init__.py
│   ├── schemas/
│   │   └── __init__.py
│   └── services/
│       └── __init__.py
├── migrations/               ← Alembic 迁移目录
│   ├── env.py
│   └── versions/
├── tests/
│   └── __init__.py
├── alembic.ini
├── requirements.txt
└── Dockerfile
```

### Step 2: `backend/requirements.txt`

```
fastapi==0.115.*
uvicorn[standard]==0.34.*
sqlalchemy[asyncio]==2.0.*
asyncpg==0.30.*
alembic==1.14.*
pydantic-settings==2.7.*
redis==5.2.*
python-jose[cryptography]==3.3.*
python-multipart==0.0.*
httpx==0.28.*
minio==7.2.*
stripe==11.*
anthropic==0.43.*
arq==0.26.*
resend==2.*
google-auth==2.*
google-cloud-aiplatform==1.71.*
```

### Step 3: `backend/app/core/config.py`

用 pydantic-settings 从 .env 读取所有配置：
- DATABASE_URL, REDIS_URL
- MINIO_* 相关
- ANTHROPIC_API_KEY, STRIPE_SECRET_KEY 等
- JWT_SECRET_KEY, JWT_EXPIRE_DAYS
- FRONTEND_URL（CORS 用）

### Step 4: `backend/app/core/database.py`

- 异步 SQLAlchemy engine（asyncpg）
- AsyncSessionLocal 工厂
- get_db() 依赖注入函数

### Step 5: `backend/app/core/redis.py`

- aioredis 连接池
- get_redis() 依赖注入

### Step 6: `backend/app/main.py`

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.v1 import health

app = FastAPI(title="TANGENT API", version="0.1.0")

# CORS：允许 FRONTEND_URL
app.add_middleware(CORSMiddleware, allow_origins=[settings.FRONTEND_URL], ...)

app.include_router(health.router, prefix="/api/v1")

@app.on_event("startup")
async def startup():
    # 测试 DB、Redis 连接
```

### Step 7: `backend/app/api/v1/health.py`

```python
@router.get("/health")
async def health_check():
    return {"status": "ok", "version": "0.1.0"}
```

### Step 8: Alembic 初始化

```bash
cd backend && alembic init migrations
```

配置 `migrations/env.py` 引用 `app.core.database` 和 `app.models`。

### Step 9: `backend/Dockerfile`

```dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
```

---

## 前端步骤

### Step 10: 创建前端项目

```bash
npm create vite@latest frontend -- --template react-ts
cd frontend
npm install
```

### Step 11: 安装依赖

```bash
npm install @xyflow/react zustand tailwindcss @tailwindcss/vite \
  react-router-dom axios i18next react-i18next \
  @radix-ui/react-dialog @radix-ui/react-dropdown-menu \
  @radix-ui/react-tooltip @radix-ui/react-tabs
```

### Step 12: `frontend/vite.config.ts`

- 配置 Tailwind v4 plugin
- 配置路径别名 `@/ → src/`
- 开发代理 `/api → localhost:8000`、`/ws → ws://localhost:8000`

### Step 13: 创建前端目录结构

```
frontend/src/
├── components/
│   └── ui/               ← Radix 基础组件封装
├── nodes/
│   └── base/
│       └── NodeBase.tsx  ← 占位，Slice 3 填充
├── canvas/
│   └── Canvas.tsx        ← 占位，Slice 3 填充
├── skills/
├── pages/
│   ├── LandingPage.tsx   ← 占位
│   ├── LoginPage.tsx     ← 占位
│   ├── SignupPage.tsx    ← 占位
│   ├── DashboardPage.tsx ← 占位
│   ├── CanvasPage.tsx    ← 占位，含 React Flow 容器
│   ├── SettingsPage.tsx  ← 占位
│   ├── UpgradePage.tsx   ← 占位
│   └── NotFoundPage.tsx  ← 404
├── store/
│   └── index.ts          ← 空 Zustand store
├── services/
│   └── api.ts            ← axios 实例 + token 拦截器
├── hooks/
├── types/
│   └── node.ts           ← 端口类型、节点类型枚举
├── lib/
│   └── cn.ts             ← clsx + tailwind-merge 工具
├── i18n/
│   ├── index.ts          ← i18next 配置
│   └── locales/
│       ├── zh.json       ← 中文（默认）
│       └── en.json       ← 英文
├── App.tsx               ← 路由配置（BrowserRouter）
└── main.tsx              ← 入口，挂载 App
```

### Step 14: `frontend/src/lib/cn.ts`

```typescript
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)) }
```

### Step 15: `frontend/src/services/api.ts`

```typescript
// axios 实例
// baseURL: '/api/v1'
// 请求拦截：从 localStorage 读 token 加到 Authorization header
// 响应拦截：401 → 清 token + 跳转 /login
```

### Step 16: `frontend/src/App.tsx`

路由配置：
- `/` → LandingPage
- `/signup` → SignupPage
- `/login` → LoginPage
- `/dashboard` → DashboardPage（需认证）
- `/canvas/:id` → CanvasPage（需认证）
- `/settings` → SettingsPage（需认证）
- `/upgrade` → UpgradePage（需认证）
- `*` → NotFoundPage

### Step 17: Tailwind + theme.ts 集成

- `frontend/src/index.css`：引入 Cal Sans、Inter、Roboto Mono 字体（Google Fonts CDN）
- 配置 Tailwind 使用 `reference/theme.ts` 中的颜色、阴影、圆角
- 基础样式：body `#f5f5f5` 背景，`#242424` 文字，Inter 字体

### Step 18: 字体引入

在 `index.html` 或 `index.css` 中引入：
- Cal Sans（自托管或 Google Fonts）
- Inter（Google Fonts）
- Roboto Mono（Google Fonts）

---

## Docker 步骤

### Step 19: `frontend/Dockerfile`

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json .
RUN npm ci
COPY . .
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
```

### Step 20: `docker-compose.yml`（项目根目录）

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: tangent_db
      POSTGRES_USER: tangent
      POSTGRES_PASSWORD: tangent_dev
    ports: ["5432:5432"]
    volumes: [pgdata:/var/lib/postgresql/data]

  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]

  minio:
    image: minio/minio
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: tangent_minio
      MINIO_ROOT_PASSWORD: tangent_minio_dev
    ports: ["9000:9000", "9001:9001"]
    volumes: [minio-data:/data]

  backend:
    build: ./backend
    ports: ["8000:8000"]
    env_file: .env
    depends_on: [postgres, redis, minio]
    volumes: ["./backend:/app"]

  frontend:
    build: ./frontend
    ports: ["5173:5173"]
    depends_on: [backend]
    volumes: ["./frontend:/app", "/app/node_modules"]

volumes:
  pgdata:
  minio-data:
```

### Step 21: `.env` 文件

从 `.env.example` 复制，填入本地开发值：
- DATABASE_URL 改为 `postgresql+asyncpg://tangent:tangent_dev@postgres:5432/tangent_db`
- REDIS_URL 改为 `redis://redis:6379/0`
- MINIO_ENDPOINT 改为 `minio:9000`
- ANTHROPIC_API_KEY 等留空（后续 slice 填）

### Step 22: `.gitignore` 确认

确认 `.env`、`node_modules/`、`__pycache__/`、`minio-data/`、`dump.rdb` 在忽略列表。

---

## Git 步骤

### Step 23: Git 初始化

```bash
cd TangentAgent
git init
git add .
git commit -m "Slice 0: project scaffold (React+FastAPI+Docker)"
```

---

## 验收清单

- [ ] `docker compose up` 全部服务启动无报错
- [ ] 访问 `localhost:5173` 看到页面（哪怕是空白页）
- [ ] 访问 `localhost:8000/docs` 看到 FastAPI Swagger 文档
- [ ] `localhost:8000/api/v1/health` 返回 `{"status":"ok"}`
- [ ] `localhost:9001` MinIO 控制台可访问
- [ ] 前端路由 `/` `/login` `/dashboard` 不报 404
- [ ] Cal Sans + Inter 字体在前端加载成功
- [ ] `find . -name '*.ts' -o -name '*.tsx' -o -name '*.py' | xargs wc -l | sort -rn | head -10` 所有文件 < 300 行
- [ ] `git log` 有初始 commit

---

## 完成后更新

- [ ] 本文件状态改为 ✅ 已完成
- [ ] project_state.md 当前阶段改为 Slice 1
- [ ] phase1-mvp.md Slice 0 状态改为 ✅
