# Slice 16: 多模型代理 + 差异积分

**优先级**: P1 | **难度**: 高 | **预计**: 5 天 | **状态**: ✅ 已完成
**依赖**: Slice 15 | **返回索引**: [phase2-commercial.md](phase2-commercial.md)

---

## 目标

FastAPI 后端支持多模型路由（Claude、GPT、Gemini、GLM、MiniMax），积分按模型差异化扣费。

---

## 已完成的实现

### 1. AI 代理服务 ✅

**文件**: `backend/app/services/proxy_service.py`

核心功能：
- `proxy_chat_completion()` — 转发聊天请求到对应 provider，扣积分，记日志
- `proxy_image_generation()` — 转发图片生成请求，扣积分（默认 5 积分/次）
- `deduct_credits()` — 预扣积分，余额不足抛 `INSUFFICIENT_CREDITS`
- `grant_credits()` — 充值积分
- `log_api_call()` — 记录 API 调用日志

Provider 支持：
| Provider | base_url | 认证方式 |
|----------|----------|---------|
| minimax | `api.minimax.chat/v1` | Bearer token |
| claude | `api.anthropic.com/v1` | x-api-key header |
| gpt | `api.openai.com/v1` | Bearer token |
| gemini | `generativelanguage.googleapis.com/v1beta/openai` | Bearer token |
| glm | `open.bigmodel.cn/api/paas/v4` | Bearer token |

错误处理：
- API 调用失败 → 自动退款
- 返回 `INSUFFICIENT_CREDITS` 错误
- 完整的 latency_ms / token 记录

### 2. API 路由 ✅

**文件**: `backend/app/api/v1/proxy.py`

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/v1/proxy/chat` | POST | 聊天代理 + 扣积分 |
| `/api/v1/proxy/image` | POST | 图片代理 + 扣积分 |

### 3. 数据库表 ✅

| 表 | 说明 |
|---|---|
| `credit_balances` | 用户积分余额 + 订阅计划 |
| `credit_transactions` | 积分流水（充值/消耗/退款） |
| `api_call_logs` | API 调用日志（provider/model/tokens/latency/status） |
| `model_configs` | 模型配置（provider/model/定价/启用状态） |

---

## 差异积分定价（待配置）

当前所有 chat 调用统一扣 1 积分，image 统一扣 5 积分。

### 目标定价

| 模型 | 积分/次 | 说明 |
|------|---------|------|
| MiniMax M2.7 | 1 | 基础模型 |
| GLM-4 Plus | 2 | 中等 |
| Gemini 2.5 Pro | 3 | 中等 |
| GPT-4o | 5 | 高成本 |
| Claude Sonnet 4.6 | 5 | 高成本 |
| MiniMax Image | 5 | 图片生成 |
| DALL-E 3 | 10 | 高成本图片 |

### 实现方式

通过 `model_configs` 表配置：
```sql
INSERT INTO model_configs (provider, model, display_name, call_type, credits_per_call, is_active) VALUES
  ('minimax', 'MiniMax-M2.7', 'MiniMax M2.7', 'chat', 1, true),
  ('claude', 'claude-sonnet-4-6', 'Claude Sonnet 4.6', 'chat', 5, true),
  ('gpt', 'gpt-4o', 'GPT-4o', 'chat', 5, true),
  ('minimax', 'image-01', 'MiniMax Image', 'image', 5, true),
  ('gpt', 'dall-e-3', 'DALL-E 3', 'image', 10, true);
```

---

## 验证清单

- [x] 选择 MiniMax 模型 → 走 minimax 路由，扣积分
- [x] 选择 Claude 模型 → 走 anthropic 路由，扣积分
- [x] 积分不足 → INSUFFICIENT_CREDITS 错误
- [x] API 调用失败 → 积分回滚
- [x] API 调用日志记录完整
- [ ] ModelSelector 显示每个模型的积分消耗
- [x] provider API Key 存在后端环境变量（不暴露给客户端）
- [ ] 差异化定价生效（当前统一扣费，需改 proxy_service 读 model_configs）
