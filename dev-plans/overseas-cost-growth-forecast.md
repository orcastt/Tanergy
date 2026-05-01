# Overseas Deployment Cost, User Growth, and Social Forecast

**Date**: 2026-04-29  
**Status**: Planning baseline for overseas Web launch; synced 2026-05-01 after Slice E local Asset / Board bridge progress and deployment-cost review
**Scope**: TANGENT Web AI Image Canvas P0 / P0.5  
**Related docs**: `PRD.md`, `ARCH.md`, `project_state.md`, `dev-plans/README.md`, `dev-plans/Asset-lod-roadmap.md`, `dev-plans/Archive/cross-platform-canvas-performance-test-2026-04-30.md`

---

## 1. Executive Summary

结论先说：**海外部署的固定基础设施成本可以比你截图里的国内方案低很多，但 AI 生图成本会成为真正的主要变量。**

截图里的国内费用大致是：

| 项 | 国内参考 | 备注 |
|----|----------|------|
| 云服务器 | ¥4,000 / 年 | 4 vCPU / 8 GiB / 10 Mbps |
| 云数据库 | ¥2,300 / 年 | PostgreSQL，2 核 / 4 GiB |
| OSS 存储 | 估计 ¥30,000 / 10,000 并发使用量 | 可能包含出流量压力 |
| AI 算力 | 估计 ¥120,000 / 10,000 用户首充 | 这是最大变量 |

TANGENT 海外 P0 推荐从一个更真实的低成本生产基线开始：

```text
Frontend: Vercel Pro or Cloudflare Pages
Backend / WebSocket: Hetzner Cloud US West / Hillsboro single VPS
Database: Neon Launch or Supabase Pro, not Postgres on the same VPS
Object storage: Cloudflare R2 with cache / thumbnail discipline
DNS / WAF: Cloudflare
```

| 阶段 | MAU 估计 | 海外基础设施 / 月 | AI 成本 / 月 | 总成本 / 月 | 总成本 / 年 |
|------|----------|---------------------|-------------|-------------|-------------|
| Alpha / private beta | 100-300 | $35-$80 | $5-$30 | $40-$110 | $480-$1,320 |
| Public MVP | 1,000-3,000 | $45-$120 | $80-$300 | $125-$420 | $1,500-$5,040 |
| Public launch | 10,000 | $180-$600 | $600-$1,500 | $780-$2,100 | $9,360-$25,200 |
| Growth | 100,000 | $1,000-$5,000 | $5,000-$15,000+ | $6,000-$20,000+ | $72,000-$240,000+ |

按规划汇率 **1 USD ≈ ¥6.9 CNY** 粗算：

- 10k MAU 海外年成本约 **¥65k-¥174k**。
- 100k MAU 海外年成本约 **¥497k-¥1.66M+**。
- 如果默认开放高分辨率、Gemini 4K、GPT high quality，AI 成本可轻易放大 5-20 倍。

我的建议：

1. **P0 不买重服务器，也不追求全球多区域后端**：先用 Vercel + Hetzner Hillsboro + Neon/Supabase + R2。
2. **Slice E Real Asset Pipeline 先于真实 AI 放量**：对象存储、Asset metadata、多尺寸缩略图、权限 URL 和保存前拒绝 `data:` / `blob:` 是成本控制前置项。
3. **P0 生图默认最低成本参数**：GPT Image 2 用 `low`；Gemini Image Preview 测试默认 `0.5K`。
4. **免费用户必须有硬额度**，例如每人每月 3-10 次 4 图生成，不然社媒一波小爆就会烧钱。
5. **增长先靠短视频和作品分享，不先重投广告**；广告在产品留存和付费验证后再开。
6. **第一个上线目标不是 10k 并发，而是 1k-3k MAU 能稳定跑完核心链路。**

### 0.1 Deployment Baseline Update — 2026-05-01

刚刚重新核对海外部署方案后，当前推荐口径改成：

- **P0 / MVP**：Vercel 或 Cloudflare Pages 交付前端；FastAPI / WebSocket 先放在 Hetzner US West / Hillsboro 单点；PostgreSQL 用 Neon Launch 或 Supabase Pro；图片进入 Cloudflare R2。
- **不要把生产数据库和 VPS 绑死**：同机 Postgres 最便宜，但 Board / user / credit 是账本，早期直接上托管 Postgres 更稳，也方便以后把 API 从 VPS 迁到 Fly.io。
- **不要把 Fly.io 当免费起点**：Fly.io 适合增长期的多区域 WebSocket，但当前没有真正的 free tier；P0 用固定月费 VPS 更可控。
- **美西单点是 XHS + Instagram “全球盲盒流量”的合理折中**：亚洲、北美、欧洲都不是最低延迟，但都不至于差到不可用；真正多人协作放量后再做 room region assignment。
- **R2 免 egress 不是免所有费用**：R2 仍按存储和 Class A/B operations 计费。图片必须用缩略图、Cache-Control / Cloudflare cache、访问限流和防盗链来控制 reads。

### 1.0 Current Engineering Sync — 2026-04-30

当前产品状态影响成本模型：

- S1 / S1.5 / Asset LOD Slice A-D 已完成。
- Slice D 跨平台 Canvas 性能门为 `pass with notes`。
- Windows 密集画布残余卡顿是 non-blocking performance follow-up，不阻塞 Slice E。
- 当前不要继续在 Cloudflare Tunnel + `next dev` 临时测试环境里追求性能完美。
- 当前是 Slice E Real Asset Pipeline：本地 Next Asset API bridge、Board save guard、local save/restore、request context 和 storage adapter seam 已开始落地；下一步迁到 Cloudflare R2 / S3-compatible storage、多尺寸缩略图、Asset metadata 和权限 URL。
- 本地 spike 图片入口已调到单图 30MB，但正式上线必须用服务端上传限制、缩略图和原图分层控制存储 / 带宽成本。
- Canvas 最大缩放已从 800% 限到 500%，减少无产品意义的超高倍渲染成本。

成本含义：

- R2 / S3-compatible object storage 不再是 P1 才考虑的优化，而是进入真实 AI 生成前的 P0 基础设施。
- 缩略图生成会增加少量计算和存储，但会显著降低浏览器渲染、对象存储出流量和未来协作同步风险。
- Board document / CRDT 不能携带图片二进制，否则未来协作成本会被图片 payload 放大。

### 1.1 Gemini 对话成本建议复盘

值得采纳：

- **R2 / zero-egress 思路**：图片产品最怕对象存储出流量刺客，P0/P1 优先 Cloudflare R2 或同等低出流量方案。
- **WebP / thumbnail**：生成图、上传图、合并图都要生成节点缩略图；原图只保存一次，节点预览用小图。
- **预算熔断**：服务端需要全局月度/每日 AI spend cap、用户级限额、模型开关和 Admin 禁用能力。
- **默认低成本模型**：免费/Alpha 默认 GPT Image 2 low 或当前 provider 最低成本配置，高分辨率需要付费或二次确认。
- **不要 unlimited**：免费额度和订阅包都必须用 credits / usage ledger 管控。

需要修正：

- **AI 成本口径不能按“每天 20,000 张图仍在 $100/月”理解**。如果单张图成本是 `$0.005`，`$100/月` 只能覆盖约 `20,000 张/月`，折合 `5,000 次 4 图 run/月`，不是 `20,000 张/天`。
- **基础设施估算要和阶段匹配**。P0 暂不接实时协作，所以 Redis / WebSocket / Liveblocks 不应进入 P0 必选固定成本；P0.5 再评估。
- **图片 URL 不等于公开 URL**。为了隐私，节点最好存 `asset_id`，展示时由后端解析为授权 URL 或不可猜测路径。
- **压缩不保证“肉眼无损 10 倍”**。WebP/AVIF/thumbnail 很有价值，但压缩比取决于图片类型、尺寸和质量参数，必须用真实生成图采样。

---

## 2. Pricing Baseline Checked

以下价格是 2026-05-01 用官方页面重新核对的规划基线。正式采购前必须再查一次，尤其是 VPS 区域价格、数据库套餐和 usage-based 项目。

| 服务 | 当前公开价格信号 | 当前建议 |
|------|------------------|----------|
| Vercel Pro | $20/mo per developer seat；Pro 有 included credit，超出后 pay-as-you-go | 生产前端首选；Hobby 可做 demo，不作为商业生产预算 |
| Cloudflare Pages | Free / Pro $25/mo；页面说明含 unlimited sites, seats, requests, bandwidth | Vercel 备选；如果前端静态化和 Cloudflare 生态更重要可选 |
| Hetzner Cloud | 官方确认 Cloud servers 有 Hillsboro, Oregon / Ashburn / Singapore 等位置；CPX11/入门规格近期价格调整后大致落在个位数美元/月级别 | P0 FastAPI + WebSocket 单点首选；按 $6-$12/mo 做规划 |
| Neon | Free 适合 hobby / prototype；Launch 为 usage-based，官方 typical spend 约 $15/mo | P0 托管 Postgres 候选，优先和后端同区域或低延迟区域 |
| Supabase | Free 可做 demo；Pro plan 为 $25/mo | P0 托管 Postgres / Auth 候选；比 VPS 同机 DB 更稳 |
| Cloudflare R2 | Standard storage $0.015/GB-month；Class A $4.50/million，Class B $0.36/million；10GB storage、1M Class A、10M Class B free tier；egress free | 图片 / thumbnail / export 存储首选，但必须缓存和限流 reads |
| Cloudflare Workers | Paid plan minimum $5/mo；可做轻量 edge helper / cache / image proxy | 后续做 signed URL helper / image proxy / R2 cache layer |
| Fly.io | Pay-as-you-go；无新用户永久免费大套餐；shared CPU 小机器约几美元到几十美元/月，跨区流量另计 | 增长期 multi-region WebSocket 候选，不作为 P0 默认 |

Sources:

- Vercel pricing: https://vercel.com/pricing
- Cloudflare Pages pricing: https://www.cloudflare.com/developer-platform/products/pages/
- Hetzner Cloud locations/pricing: https://www.hetzner.com/cloud/
- Hetzner price adjustment note: https://docs.hetzner.com/general/infrastructure-and-availability/price-adjustment/
- Neon pricing: https://neon.com/pricing
- Supabase pricing: https://supabase.com/pricing
- Cloudflare R2 pricing: https://developers.cloudflare.com/r2/pricing/
- Cloudflare Workers pricing: https://developers.cloudflare.com/workers/platform/pricing/
- Fly.io pricing: https://fly.io/docs/about/pricing/
- USD/CNY reference search: https://www.exchange-rates.org/converter/usd-cny

---

## 3. Recommended Overseas Architecture by Stage

### 3.1 Stage A — Alpha / Private Beta

目标：100-300 MAU，10-30 DAU，1-5 同时在线。

| Component | 推荐 | 月成本 | 为什么 |
|-----------|------|--------|--------|
| Web | Vercel Pro；或 Cloudflare Pages | $0-$20 | 内测可临时免费层；商业生产按 Vercel Pro 预算 |
| Backend / WebSocket | Hetzner Cloud US West / Hillsboro VPS | $6-$12 | 固定月费、Docker 直接跑 FastAPI；美西兼顾 XHS + Instagram 全球盲盒流量 |
| DB | Neon Launch 或 Supabase Pro | $0-$25 | demo 可 free；生产账本不要和 VPS 绑死 |
| Storage | Cloudflare R2 | $0-$5 | 图片存储便宜，egress free，但 reads 仍要算 operations |
| Queue / rate limit | DB-backed queue / simple in-process gate；必要时 Upstash | $0-$10 | P0 先限流和排队，不急着买复杂队列 |
| Analytics | PostHog free / Vercel Analytics / Plausible later | $0-$20 | 先看 funnel，不急着买大屏 |
| Monitoring | Sentry free / provider logs | $0-$20 | P0 足够 |
| Realtime collab | 不接 | $0 | P0 先单人 |

**Estimated fixed cost**: $35-$80 / month.

备注：

- Vercel Hobby / Neon Free / Supabase Free 可以用于 demo、内部测试和 waitlist，但不作为真实生产基线。
- 如果预算极紧，可以临时用 Cloudflare Pages Free + Neon Free，把固定成本压到接近 VPS + 域名；但一旦对外开放真实用户，优先升级前端和数据库。

### 3.2 Stage B — Public Beta

目标：1k-3k MAU，100-500 DAU，10-50 同时在线。

| Component | 推荐 | 月成本 |
|-----------|------|--------|
| Web | Vercel Pro 或 Cloudflare Pages Pro | $20-$60 |
| Backend / WebSocket | Hetzner Hillsboro VPS；必要时升一档或加 worker VPS | $10-$50 |
| DB | Neon Launch / Supabase Pro | $15-$50 |
| Storage | R2 100-300GB retained + cache rules | $2-$30 |
| Queue / Redis | DB queue / Upstash / Redis only if needed | $0-$50 |
| Analytics / monitoring | PostHog + Sentry | $0-$80 |
| Email / auth / domains | Resend/Auth provider/domain | $10-$50 |

**Estimated fixed cost**: $45-$120 / month, before heavier observability and paid auth add-ons.

重点：

- 这个阶段仍不默认上 Fly.io multi-region。先确认真实多人协作是否已经成为付费用户核心需求。
- R2 必须加 `Cache-Control`、thumbnail-first 渲染、反盗链/签名 URL 和读操作监控，防止“免流量但 reads 爆炸”。

### 3.3 Stage C — Public Launch

目标：10k MAU，2k-3k DAU，100-300 同时在线。

| Component | 推荐 | 月成本 |
|-----------|------|--------|
| Web | Vercel Pro + spend cap 或 Cloudflare stack | $50-$250 |
| Backend API / WebSocket | Larger Hetzner VPS 或 2 台 VPS；若协作延迟成为瓶颈再评估 Fly.io | $40-$200 |
| Worker queue | 独立 worker / queue / scheduler | $20-$150 |
| DB | Neon / Supabase paid tier，必要时更高规格和备份策略 | $50-$200 |
| Storage | R2 300GB-1TB retained + CDN/cache/operations budget | $10-$80 |
| Analytics / logs | PostHog / Sentry / log drains | $50-$200 |
| Email / auth / security | Auth, email, WAF/basic bot protection | $20-$150 |
| Realtime collab | 如果 P0.5 已上线，开始 room region / sticky routing 设计 | $0-$150 |

**Estimated fixed cost**: $180-$600 / month.

何时切 Fly.io：

- 跨国多人同一 Board 协作已经是高频场景。
- WebSocket 房间延迟影响留存或付费。
- 已经有 room region assignment / sticky routing / DB single-writer 策略，而不是单纯复制后端实例。

### 3.4 Stage D — Growth

目标：100k MAU，20k-30k DAU，1k-3k 同时在线。

| Component | 推荐 | 月成本 |
|-----------|------|--------|
| Web | Vercel / Cloudflare scale plan | $300-$1,500 |
| Backend | Fly.io multi-region or regional VPS fleet + load balancing | $500-$2,500 |
| DB | Managed Postgres larger instance + replica + backups | $400-$2,000 |
| Storage/CDN | R2 several TB + image transform/cache | $100-$800 |
| Queue/realtime | Redis/queue + Liveblocks/PartyKit/Yjs infra | $100-$1,000 |
| Analytics/logging | Product analytics, error tracking, logs | $200-$1,500 |
| Security/compliance | WAF, abuse control, GDPR tooling | $100-$700 |

**Estimated fixed cost**: $1,000-$5,000 / month, before AI.

---

## 4. AI Unit Economics

### 4.1 Image Generation Cost Assumptions

来自当前 GeekAI 线路资料：

#### GPT Image 2

| quality | size | CNY / image | 4 images / run |
|---------|------|-------------|----------------|
| low | 1024x1024 | ¥0.048 | ¥0.192 |
| low | 1024x1536 / 1536x1024 | ¥0.040 | ¥0.160 |
| medium | 1024x1024 | ¥0.398 | ¥1.592 |
| high | 1024x1024 | ¥1.586 | ¥6.344 |

如果默认高可用代理折扣为 0.5：

| mode | discounted CNY / 4-image run | USD / run at 6.9 |
|------|------------------------------|------------------|
| GPT Image 2 low square | ¥0.096 | ~$0.014 |
| GPT Image 2 low portrait/landscape | ¥0.080 | ~$0.012 |
| GPT Image 2 medium square | ¥0.796 | ~$0.115 |
| GPT Image 2 high square | ¥3.172 | ~$0.460 |

#### Gemini 3.1 Flash Image Preview

| image_size | CNY / image | 4 images / run | discounted 0.5 / run | USD / discounted run |
|------------|-------------|----------------|------------------------|----------------------|
| 0.5K | ¥0.35 | ¥1.40 | ¥0.70 | ~$0.10 |
| 1K | ¥0.50 | ¥2.00 | ¥1.00 | ~$0.145 |
| 2K | ¥0.75 | ¥3.00 | ¥1.50 | ~$0.217 |
| 4K | ¥1.15 | ¥4.60 | ¥2.30 | ~$0.333 |

### 4.2 Recommended P0 Default

| Entry | Default | Reason |
|-------|---------|--------|
| Automated tests | GPT Image 2 `low`, cheapest size | 最便宜，适合回归测试 |
| Gemini tests | `0.5K` | Gemini 最低分辨率，控制成本 |
| Free users | GPT Image 2 low only by default | 避免免费额度被 Gemini 放大成本 |
| Paid users | 可开放 Gemini 0.5K/1K；2K/4K 需高价或二次确认 | 高分辨率需要成本保护 |
| Admin controls | per-model enable / disable / daily cap | 防止上游异常或滥用 |

### 4.3 Blended Cost per 4-Image Run

建议做一个 P0 默认混合成本：

```text
80% GPT Image 2 low square + 20% Gemini 0.5K + 15% text/planner/log overhead
```

折扣后估算：

```text
GPT: ¥0.096/run * 80% = ¥0.0768
Gemini: ¥0.70/run * 20% = ¥0.1400
Subtotal = ¥0.2168/run
+15% overhead = ¥0.2493/run
≈ $0.036/run
```

所以 P0 可以用 **$0.03-$0.04 / 4-image generation run** 作为保守默认单次成本。

如果不享受 0.5 折扣，默认混合成本约 **$0.07-$0.08 / run**。

---

## 5. User Volume Forecast

### 5.1 User Funnel Definitions

| Metric | Definition |
|--------|------------|
| Visitor | 访问官网或 app landing 的匿名用户 |
| Signup | 完成注册或进入 waitlist 的用户 |
| Activated user | 创建第一个 Board，或完成第一条 Prompt → Image Gen / Image Gen 4 |
| Generator user | 当月至少触发一次 4 图生成 |
| Retained MAU | 当月至少回来一次并打开 Board / 生成 / 编辑 |
| Paying user | 购买 credits 或订阅 |

### 5.2 Forecast Scenarios

| Scenario | Month | Visitors | Signups | Activated | MAU | Generator users | Runs / generator / month | Total runs |
|----------|-------|----------|---------|-----------|-----|------------------|--------------------------|------------|
| Alpha | M1 | 500 | 100 | 50 | 100 | 30 | 5 | 150 |
| Early beta | M2-M3 | 5,000 | 800 | 320 | 1,000 | 250 | 8 | 2,000 |
| Public beta | M4-M6 | 50,000 | 8,000 | 3,200 | 10,000 | 2,000 | 10 | 20,000 |
| Viral / scale | M7-M12 | 500,000 | 80,000 | 24,000 | 100,000 | 15,000 | 12 | 180,000 |

Assumptions:

- Signup conversion: 10%-16% from visitor to signup.
- Activation: 35%-50% from signup to activated.
- Generator users: 20%-30% of MAU in early phases.
- These are optimistic if product is not polished; they require strong short video demos and low-friction onboarding.

### 5.3 Monthly Cost by User Scenario

Using blended AI cost: **$0.036 / run**.

| Scenario | Fixed infra | Total runs | AI variable cost | Total monthly cost |
|----------|-------------|------------|------------------|--------------------|
| Alpha | $35-$80 | 150 | ~$5 | $40-$85 |
| Early beta | $45-$120 | 2,000 | ~$72 | $117-$192 |
| Public beta | $180-$600 | 20,000 | ~$720 | $900-$1,320 |
| Viral / scale | $1,000-$5,000 | 180,000 | ~$6,480 | $7,480-$11,480 |

If average model mix shifts to Gemini 1K/2K or GPT Image 2 medium, multiply AI cost by **3x-8x**.

If free users get unlimited generation, costs become unpredictable. Do not do this.

Important interpretation:

- These numbers are product-planning ranges, not procurement quotes.
- The earliest production baseline should assume at least one paid frontend or database tier. Free tiers are excellent for demos but should not be the commercial reliability plan.
- AI model mix dominates the bill much faster than web hosting. A single viral video with unrestricted free generations is a bigger risk than the first VPS choice.

---

## 6. Storage Forecast

### 6.1 Storage Assumptions

| Item | Assumption |
|------|------------|
| Generated image average compressed size | 0.8-1.5 MB |
| A 4-image run creates | 4 generated images |
| Editor / Merge extra output | +0.5 to +1 image per run average |
| Planning average | 5 MB stored per run |
| Retention | 90 days for free users; longer for paid users |

### 6.2 R2 Storage Cost Estimate

Using 5 MB / run and 90-day retention:

| Scenario | Runs / month | New storage / month | 90-day retained | R2 storage cost / month |
|----------|--------------|--------------------|-----------------|--------------------------|
| Alpha | 150 | <1 GB | <3 GB | ~$0 |
| Early beta | 2,000 | 10 GB | 30 GB | <$1 |
| Public beta | 20,000 | 100 GB | 300 GB | ~$4-$5 |
| Viral / scale | 180,000 | 900 GB | 2.7 TB | ~$40-$50 |

Storage itself is not the scary part if using R2. The bigger storage risks are:

1. **Read operations** if public images are viewed millions of times.
2. **Image transform / thumbnail processing** if done through expensive serverless functions.
3. **No retention policy** causing old generated assets to accumulate forever.
4. **Hotlinked images** if asset URLs are easy to share or scrape outside the app.

Recommended controls:

- Free user assets expire or are archived after 90 days.
- Paid user assets have longer retention.
- Generate WebP thumbnails for node previews.
- Store original only once; thumbnails separately.
- Track `asset_bytes_stored` by user and workspace.
- Set cache headers for immutable thumbnails.
- Prefer signed or unguessable asset paths for private boards.
- Add per-IP and per-workspace read limits before public sharing.

---

## 7. Social Media Growth Forecast

### 7.1 Channels

For this product, the strongest channels should be visual-first and creator-heavy:

| Channel | Content type | Why it fits |
|---------|--------------|-------------|
| TikTok | 15-45s workflow videos | 快速展示 prompt → 4 images → draw edit |
| Instagram Reels | before/after, carousel, creator workflow | 适合视觉结果 |
| YouTube Shorts | slightly longer demos | 可积累搜索和教程价值 |
| X / Twitter | build-in-public, product demos, GIFs | 适合 AI/design early adopters |
| Reddit | design, AI art, indie hacker communities | 需要真实案例，不要硬广 |
| Product Hunt | launch spike | 适合 beta launch 获取第一批用户 |
| Discord communities | targeted feedback | 适合设计师和 AI creator 圈层 |
| Pinterest | output gallery later | 长尾视觉流量，P0 可后置 |

### 7.2 90-Day Organic Forecast

Assume:

- 2-3 short videos / day across TikTok, Reels, Shorts.
- 1-2 X posts / day.
- 2 Reddit/community posts / week.
- 1 Product Hunt / launch event after MVP is usable.

| Scenario | Impressions | CTR to site | Visitors | Signup rate | Signups | Activation rate | Activated users |
|----------|-------------|-------------|----------|-------------|---------|-----------------|-----------------|
| Conservative | 30k-100k | 0.8%-1.5% | 240-1,500 | 8%-12% | 20-180 | 30%-40% | 6-72 |
| Base | 300k-800k | 1.5%-3% | 4,500-24,000 | 10%-18% | 450-4,320 | 35%-50% | 160-2,160 |
| Strong | 1M-3M | 2%-4% | 20,000-120,000 | 12%-22% | 2,400-26,400 | 40%-55% | 960-14,520 |
| Viral | 5M-10M+ | 2%-5% | 100,000-500,000 | 12%-25% | 12,000-125,000 | 35%-55% | 4,200-68,750 |

Important: viral traffic is not automatically good. It can create:

- AI cost spikes.
- Queue backlog.
- Low-quality signups.
- Abuse attempts.
- Support burden.

So public launch should use:

- Waitlist or invite code.
- Free generation cap.
- Per-IP and per-user rate limits.
- Queue display instead of immediate unlimited generation.

### 7.3 Paid Ads Forecast

Do not start paid ads until activation and retention are proven.

A rough paid acquisition model:

| Metric | Conservative | Base | Strong |
|--------|--------------|------|--------|
| CPC | $1.50 | $0.80 | $0.35 |
| Signup conversion | 8% | 12% | 18% |
| Cost per signup | $18.75 | $6.67 | $1.94 |
| Activation from signup | 30% | 40% | 50% |
| Cost per activated user | $62.50 | $16.67 | $3.89 |

If the paid plan is $12-$20/month and early conversion to paid is only 1%-3%, paid ads will likely lose money until onboarding and pricing are tuned.

Recommendation:

- First 90 days: mostly organic + community + Product Hunt.
- Use paid ads only for retargeting visitors who already watched a demo or joined waitlist.
- Daily paid ad cap: $20-$50 until CAC is measured.

---

## 8. Revenue and Break-Even Sketch

### 8.1 Credit System

Current internal credit mapping historically used:

```text
1 credit = ¥0.01
```

For overseas users, do not expose RMB logic. Use:

```text
User sees USD package / subscription
Backend stores internal credits or usage ledger
Provider cost stored in original currency + normalized USD estimate
```

### 8.2 Suggested Early Packages

Not final pricing, only unit-economics sketch:

| Package | User pays | Included usage | Cost control |
|---------|-----------|----------------|--------------|
| Free | $0 | 3-10 GPT-low runs/month | Gemini disabled or very limited |
| Starter | $9/mo | 150-250 GPT-low equivalent runs | Gemini consumes more credits |
| Pro | $19/mo | 400-600 GPT-low equivalent runs | 2K/4K cost multiplier |
| Team | $49/mo | shared credits + collaboration | P0.5 later |

Example at blended $0.036/run:

| Plan | Included runs | AI cost | Gross margin before infra/payment |
|------|---------------|---------|-----------------------------------|
| $9 Starter | 150 | $5.40 | 40% before infra/payment |
| $19 Pro | 400 | $14.40 | 24% before infra/payment |
| $19 Pro with better mix | 250 | $9.00 | 53% before infra/payment |

This means **do not price by “unlimited generations”**. Use credit multipliers:

| Model / quality | Credit multiplier idea |
|-----------------|------------------------|
| GPT Image 2 low | 1x |
| GPT Image 2 medium | 8x-10x |
| GPT Image 2 high | 30x-40x |
| Gemini 0.5K | 7x-9x |
| Gemini 1K | 10x-12x |
| Gemini 2K | 15x-20x |
| Gemini 4K | 25x-35x |

### 8.3 Payment Fees

Stripe/card fees will reduce margin. For small transactions, fixed card fees matter a lot.

Planning rule:

- Assume **3%-8% payment + tax + FX overhead** depending on merchant country and international cards.
- Prefer monthly subscription or larger credit packs over $1-$2 micro-purchases.
- For overseas, Stripe Tax or a tax solution may be needed later; not P0.

---

## 9. Risk Controls

| Risk | Trigger | Control |
|------|---------|---------|
| Viral free users burn AI budget | Traffic spike from social video | Daily global free-run cap + waitlist |
| Gemini/high-res drains credits | Users select expensive model | Model multipliers + confirmation + paid-only |
| Storage grows forever | Users generate but never delete | Retention policy by plan |
| Abuse / bot signups | Public free credits | CAPTCHA, email verification, IP/device rate limit |
| Provider outage | GeekAI or upstream model fails | Disable model in registry, show retry/fallback |
| Slow generation hurts retention | queue > 60s | Queue position + async job + email/notification later |
| Social traffic has low intent | Viral demo not product-fit | Track activation, not just signups |
| Overseas compliance | EU users upload personal images | Privacy policy, delete account/data path, private asset URLs |

---

## 10. Milestone Budget Recommendation

### Milestone 1 — Product Spike

Goal: canvas + 4-node UI + mock generation.

Budget:

- Infra: $0-$50/month.
- AI: $0-$30/month.
- Marketing: $0.

Decision gate:

- Canvas coordinates stable.
- User understands Prompt → 1/4 images → Image, and Image → Analysis → Prompt.

### Milestone 2 — Private Alpha

Goal: 50-100 invited users generate real images.

Budget:

- Infra: $35-$80/month.
- AI: $50-$150/month cap.
- Marketing: $0-$100/month, mostly content tools.

Decision gate:

- Activation > 35% of signups.
- At least 20% of activated users return within 7 days.
- Average AI cost per activated user < $1.00/month.

### Milestone 3 — Public Beta

Goal: 1k-3k MAU with public landing and waitlist.

Budget:

- Infra: $45-$120/month.
- AI: $80-$300/month hard cap for conservative model mix; raise only after retention is proven.
- Marketing: $300-$1,000/month max, mostly retargeting and creator tests.

Decision gate:

- D7 retention > 15%-20%.
- 3%-5% of activated users pay or join paid waitlist.
- Cost per activated user from paid channels < $10 before scaling ads.

### Milestone 4 — Launch

Goal: 10k MAU.

Budget:

- Infra: $180-$600/month.
- AI: $600-$1,500/month cap for default low-cost generation; higher quality tiers must be paid or credit-multiplied.
- Marketing: $1,000-$5,000/month only if CAC is measured.

Decision gate:

- Free-to-paid conversion > 2%-5%.
- Gross margin after AI > 50% on paid users.
- Queue and API logs stable.

---

## 11. Recommended Tracking Events

这些事件要在产品一开始就埋，方便验证社媒和成本预测：

| Event | Properties |
|-------|------------|
| `landing_viewed` | source, campaign, referrer |
| `signup_started` | source, campaign |
| `signup_completed` | source, campaign |
| `board_created` | source, template_id |
| `node_created` | node_type, board_id |
| `edge_created` | source_type, target_type |
| `ai_chat_sent` | mode, selected_model_id |
| `ai_graph_applied` | node_count, edge_count, selected_model_id |
| `generation_started` | model_id, quality, size, image_size, count |
| `generation_succeeded` | model_id, latency_ms, cost_credits, asset_count |
| `generation_failed` | model_id, error_code, retryable |
| `image_node_created` | source, asset_size |
| `editor_opened` | source |
| `editor_exported` | asset_size |
| `merge_capture_created` | object_count, output_size |
| `asset_downloaded` | source |
| `share_clicked` | channel, asset_id |
| `paywall_seen` | reason, model_id |
| `purchase_started` | package_id |
| `purchase_completed` | package_id, amount_usd |

---

## 12. What This Means for Current Development

Cost-wise, the next engineering priorities should be:

1. **Finish the R2/S3-compatible Asset adapter contract** before real AI image volume.
2. **Move Board persistence to authenticated FastAPI + Postgres** with the existing save guard.
3. **Asset storage accounting**: bytes, object count, read count and thumbnail count per user/workspace.
4. **Model Registry next, not hardcoded models**.
5. **Generation job logging from day one**: model, params, cost, status, latency, user.
6. **Global and per-user AI budget caps** before public launch.
7. **Social source tracking** in landing/signup events.
8. **Waitlist/invite gate** before any public viral push.
9. **Asset reference model before collaboration**: nodes store `asset_id` / `run_id`, not Base64 or public image blobs.
10. **Thumbnail pipeline before image-heavy boards**: node previews use compressed thumbnails; original assets load on demand.

This matches current P0 slice order:

```text
Canvas spike → Step 1.5 complex node/data spike → Asset LOD A-D → Slice E Asset/Board persistence → Model Registry → real generation → Dashboard/Auth → AI Chat productization → growth gate
```
