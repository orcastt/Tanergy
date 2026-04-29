# TANGENT Admin Dashboard

Next.js 管理后台，用于运营查看用户、积分、API 调用、Provider 和模型配置。

## 当前状态

- 基础 Next.js 前端已实现，不再是 create-next-app 模板状态。
- Admin API、Provider Registry 和基础页面已对接到 `backend` 的 `/api/v1/admin/*`。
- 下一步是本地联调、管理员鉴权验收、生产环境部署。

## 技术栈

| 层级 | 选型 |
|------|------|
| 框架 | Next.js 16 + App Router |
| 前端 | React 19 + TypeScript |
| UI | Tailwind CSS + shadcn/base-ui 风格组件 |
| 图表 | Recharts |
| API | FastAPI Admin API |

## 本地开发

```bash
cd admin
npm install
npm run dev
```

默认 API 地址来自 `NEXT_PUBLIC_API_URL`，未配置时使用 `http://localhost:8000`。

## 页面索引

| 页面 | 状态 |
|------|------|
| `/login` | ✅ 管理员登录入口 |
| `/dashboard` | ✅ 统计卡片、趋势图、Provider 分布、Top Models |
| `/users` / `/users/[id]` | ✅ 用户列表与详情 |
| `/credits` | ✅ 积分流水/充值入口 |
| `/api-logs` | ✅ API 调用日志 |
| `/providers` | ✅ Provider 管理 |
| `/models` | ✅ 模型配置管理 |

## 验收待办

- [ ] 使用真实后端验证管理员登录和 JWT 持久化。
- [ ] 验证列表分页、筛选、编辑、删除、充值等操作。
- [ ] 配置生产域名、环境变量和部署方式。
