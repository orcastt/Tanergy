# S1B Supabase + R2 + Redis 协同基础设施方案

**日期**：2026-05-18
**状态**：Supabase Pro staging 已切换 / R2 已清理 / 协同持久化已改为 final snapshot；Redis backplane 待后续多实例化
**目标**：把 staging/后续生产的主数据库收口到 Supabase Pro，当前 staging 数据和 R2 旧对象都清干净重来，并把协同实时链路从数据库高频读写中拆出来。

## 2026-05-18 执行状态

- [x] Supabase Pro staging project 已创建，区域在 US West/Oregon 附近。
- [x] Hetzner staging API env 已同步 `DATABASE_URL` / `DATABASE_POOL_URL` 到 Supabase 连接。
- [x] Supabase 空库已跑 Alembic `upgrade head`。
- [x] Hetzner staging API 已重新启动，内网和公网 `/health` 都返回 `{"status":"ok"}`。
- [x] 旧 Hetzner `staging-postgres` 容器和 `staging_postgres_data` volume 已删除，不再作为 staging fallback。
- [x] Cloudflare R2 `tanergy-assets` 已清空到 0 objects。
- [x] 后端协同持久化默认切到 `TANGENT_BOARD_REALTIME_PERSIST_MODE=final_snapshot`：绘制过程的 `yjs-update` 只在 WebSocket room 内存广播，不再 debounce 写 Postgres。
- [x] `sync-state-publish` / compacted state 和 room empty finalize 仍会写入 `tangent_board_realtime_documents`，保证刷新后能恢复最终快照。
- [x] 后端测试覆盖 final snapshot 行为和旧 `update_chain` 兼容开关。
- [x] WebSocket/Yjs 大更新 payload 增加 base64 编码分支，避免大数组 JSON 过度膨胀，同时继续保留小更新的数组兼容格式。
- [x] 前端已加入低帧率 draft drawing preview：本地绘制过程约 72ms 节流发布到 presence，远端用 overlay layer 显示过程态；presence/draft 只走内存广播，不作为 Postgres 事实。
- [ ] 重新创建 staging 测试用户、admin role、workspace、board 和一张新图片。
- [ ] R2 清桶后的新 asset upload/read/thumbnail smoke。
- [ ] WebSocket/Redis 多实例 backplane；当前 staging 单 API 实例先使用 memory hub。
- [ ] selection lock / element lock 的 TTL runtime 状态。
- [ ] 两浏览器协同过程可视化 smoke：stroke 过程广播、拖动过程广播、page delete 立即处理。

## 结论先行

已决策方案：

```text
Web: Vercel / staging.tanergy.cc
API + WebSocket: Hetzner US West / api-staging.tanergy.cc
主数据库: Supabase Pro Postgres, 全新 staging project, 不迁旧数据
图片对象存储: 继续 Cloudflare R2, 先清空当前 staging 旧对象再重来
协同临时层: 当前单 API 实例 memory hub；多实例/生产前升级 Redis pub/sub
Auth: 继续 Clerk, 暂时不迁 Supabase Auth
不采用: Hetzner Object Storage, Supabase Auth, Supabase Storage, Hetzner server-local Postgres
```

关键判断：

- 数据库只保留一个主事实源，不要 Neon + Supabase + Hetzner local 三套长期并存；这轮直接新建 Supabase staging 库，不从旧库 dump/restore。
- 协同过程不要一笔一笔写数据库；WebSocket / Redis 广播实时过程，Postgres 只落最终快照、历史 checkpoint 和业务事实。
- R2 不迁服务商，但当前旧对象可以删除；因为旧 board 已删除，staging 资产允许清桶或清 prefix 后重新生成。
- Supabase Free 对当前协同 + board + admin + billing 测试不够用；staging/生产前直接按 Supabase Pro 规划，不再继续围绕 Neon Free 或本机临时 Postgres 调整。

## 2026-05-18 决策更新

本轮决策已经从“比较 Neon / Supabase / Hetzner 自建”收口为：

1. 开 Supabase Pro，创建全新 staging 数据库，作为唯一 staging 主数据库。
2. 不迁当前 Hetzner 本机 Docker Postgres 数据；旧库只作为历史事故记录，后续不再在服务器本机创建 staging 数据库。
3. Cloudflare R2 继续保存图片、缩略图和生成资产，但当前 staging 旧对象可以清掉重来。
4. Hetzner Object Storage 不开、不迁、不写入这轮 runbook。
5. Clerk 继续负责登录；不切 Supabase Auth。
6. 前端不接 Supabase SDK；所有数据库访问继续只通过 FastAPI。
7. 协同性能问题后续通过 WebSocket / Redis / final snapshot 策略解决，不靠继续加数据库实时读写硬抗。

## 现在的事实

当前 staging 基础设施事实：

- Hetzner API 主机在美国西部，所以数据库也应该放美国西部附近，避免 API 每次查库跨洋。
- 原 Neon staging 项目曾因为 data transfer quota 暂停。
- 当前 staging 曾临时切到 Hetzner 本机 Docker Postgres `staging-postgres`，这是一次事故 fallback 记录，不再作为后续 staging 路线。
- 对象存储当前文档和部署配置指向 Cloudflare R2。
- 代码层对象存储不是写死 R2，而是通用 S3-compatible adapter，读取 `S3_ENDPOINT`、`S3_BUCKET`、`S3_ACCESS_KEY_ID`、`S3_SECRET_ACCESS_KEY`。

这意味着：

- 数据库需要在 Supabase Pro 上重新建一个干净 staging 库，跑 Alembic 到 head，再重新创建测试账号/workspace/board。
- 当前 R2 旧对象不需要保留，可以清空 staging bucket 或清空 staging prefix 后重新上传/生成资产。
- Redis 可以先不用注册新 SaaS；当前 staging 单 API 实例先用 memory hub，多进程/多实例前再接 Hetzner 同机 Redis 或 managed Redis。

## 需要新注册或开通什么

必须：

1. [x] Supabase 账号 / Organization。
2. [x] Supabase Pro plan。
3. [x] Supabase staging project，区域选美国西部或最接近 Hetzner US West 的美国区域。
4. [x] Supabase database password、direct/session pooler 连接串，写入私密 secret store，不写入文档。
5. [x] R2 bucket 清理权限，用来删除当前 staging 旧对象；若以后有 production，则 staging/production 必须分 bucket 或分 prefix。

现在不必须：

1. Supabase Auth：暂时不需要，Clerk 继续用。
2. Supabase Storage：暂时不需要，R2 继续用。
3. Managed Redis：staging 单实例先不必须；后面多实例或生产稳定性需要时再换 Hetzner 同机 Redis / Upstash / Redis Cloud / Supabase 生态外的托管 Redis。

明确不做：

1. Hetzner Object Storage：这轮不注册、不迁移、不改 S3 env 到 Hetzner。
2. Neon paid：这轮不继续升级 Neon；Neon Free 已经被 data transfer quota 证明不适合当前协同测试。
3. Hetzner server-local Postgres：以后不再作为 staging 在线数据库，也不再为 staging 新建本机 DB。
4. Windows 本地数据库：可以作为备份目标，不作为 staging 在线数据库。

后续生产前应该准备：

1. 独立 production Supabase project，不能和 staging 共用数据库。
2. 独立 production R2 bucket 或至少独立 prefix + 独立写凭据。
3. 独立 production API env、Clerk production keys、payment live-mode keys。

## 目标架构

### 请求链路

```text
Browser
  -> Vercel Web
  -> FastAPI HTTPS on Hetzner US West
      -> Supabase Postgres US West: users, workspaces, boards, billing, snapshots
      -> Cloudflare R2: images, thumbnails, generated assets
      -> Redis local/managed: collaboration rooms, presence, temporary locks

Browser
  -> FastAPI WebSocket on Hetzner US West
      -> Redis pub/sub or in-memory room hub
      -> other browsers in same board
```

### 数据责任边界

| 数据 | 存哪里 | 是否持久 | 说明 |
| --- | --- | --- | --- |
| 用户 / workspace / team / group / billing / admin roles | Supabase Postgres | 是 | 结构化业务事实源 |
| Board document 最终快照 | Supabase Postgres | 是 | debounce / operation-end 保存 |
| Board history checkpoint | Supabase Postgres | 是 | 用户明确保存、重要 checkpoint、自动周期保存 |
| 图片原图 / 缩略图 / 生成结果 | Cloudflare R2 | 是 | Postgres 只保存 metadata 和文件路径 |
| cursor / presence / selection / draft stroke / temporary lock | Redis 或 API memory | 否 | 只用于在线协同，不进数据库 |
| 正在生成的 AI run 状态 | Supabase Postgres + API runtime | 是 | 不能因为 Ctrl+Z 或前端刷新丢失 run 事实 |

## 现有架构需要改的地方

当前代码已经有一些基础，不是从零开始：

- 前端已经通过 `NEXT_PUBLIC_API_BASE_URL` 调 FastAPI，并能用 `persistenceWebSocketUrl()` 生成 `ws/wss` URL。
- 后端已经有 `/api/v1/boards/{board_id}/realtime` WebSocket route。
- 后端已经有 `tangent_board_realtime_documents` 表和 `BoardRealtimePersistenceCoordinator`，会把 Yjs/update chain debounce 写进 Postgres。
- 对象存储已经是 S3-compatible adapter，R2 和 Hetzner Object Storage / Supabase Storage 理论上都能接。
- Postgres connection 已经支持 `DATABASE_POOL_URL` 优先于 `DATABASE_URL`，Alembic/admin 仍可用 direct URL。

但目标架构要求下面这些变化：

| 区域 | 当前状态 | 目标状态 | 要改什么 |
| --- | --- | --- | --- |
| Database | Supabase Pro Postgres 已切换 | 全新 Supabase Pro Postgres, US West 附近 | 已不迁旧数据；Alembic 已到 head；还需重新 bootstrap admin/workspace/test board，保留 `DATABASE_URL` direct/session + `DATABASE_POOL_URL` pooler |
| Realtime document persistence | 已从默认 update-chain debounce 写库改为 final snapshot | WebSocket/Redis 广播过程，Postgres 只保存最终快照 / compacted state | 已拆出 `final_snapshot` 默认模式；Redis backplane 后续做 |
| Presence / cursor / draft | 部分 presence 已进 realtime payload | 只进 Redis/API memory，不进 Postgres | 后端限制 awareness/draft 不写 DB；前端继续节流发送 |
| Element lock / selection lock | 前端协同锁仍在完善 | Redis/API memory 保存 TTL lock，其他用户立即不可操作 | 增加 lock acquire/refresh/release 消息，断线 TTL 自动释放 |
| Board structural changes | page delete/board structure 可能依赖最终同步 | page delete/rename/reorder 立即广播并尽快保存快照 | 把结构性操作列为高优先级 sync-state publish |
| Asset delivery | 图片通过 API 代理读 R2 | 短期继续 API 代理；中期 signed URL/CDN 直读 | 先不改；后续真正使用 `S3_PUBLIC_BASE_URL` 或 signed URL |
| Frontend env | 只需要 API base | 不引入 Supabase browser SDK | 前端不能出现 Supabase service key；不需要 Supabase anon key，除非以后改 Auth |
| Auth | Clerk | 继续 Clerk | 不迁 Supabase Auth，避免扩大迁移面 |

## 前端切换与改造清单

前端这次数据库重建本身应尽量无感：

1. `NEXT_PUBLIC_API_BASE_URL` 不变时，Web 不需要因为数据库重建而重新改代码。
2. 不在前端接 Supabase SDK，不暴露 Supabase service role，不引入 Supabase Auth。
3. 图片资产 URL 继续走现有 API proxy path；R2 仍是对象存储，但旧对象清掉后旧 board/image 引用不保证可用。
4. WebSocket URL 继续由 `persistenceWebSocketUrl()` 生成，确保 `https://api-staging...` 自动变成 `wss://api-staging...`。
5. UI copy 需要从 “local realtime” 逐步改成真实 “realtime / collaboration sync” 语义，避免用户误解。

协同体验相关前端改造：

1. Draft stroke / drawing preview：绘制过程中按固定低帧率广播，例如 10-15fps，不等 mouseup。
2. Final commit：mouseup / pointerup / shape transform end 时发送最终 compacted state。
3. Element lock：选中、拖动、resize、编辑时先占用 lock；拿不到 lock 就不允许移动、缩放、删除、双击编辑。
4. Selection box：框选过程只本地可见；选中结束后再发布 locked selected ids。
5. Page delete：收到远端 page delete 后，当前浏览器若在被删 page，必须立即跳到有效 page 或显示清晰提示。
6. Sync 状态：显示 connecting / live / saving / saved / failed；保存失败不能显示已同步。
7. Undo / redo：本地正在等待 sync 或 AI run 正在进行时，要遵守现有的不可撤销生成中节点规则。

前端不应该做：

- 不直接访问 Supabase Postgres。
- 不把 R2 secret、Supabase DB password、Redis URL 放进浏览器。
- 不把协同实时过程写入 localStorage 当作事实源。

## 后端 / API 改造清单

### Database runtime

1. Supabase direct URL 放 `DATABASE_URL`，用于 Alembic / admin / 低频维护命令。
2. Supabase pooler URL 放 `DATABASE_POOL_URL`，API runtime 优先使用它。
3. Supabase 连接串必须带 SSL 要求，使用 Supabase dashboard 给出的推荐格式。
4. 运行时 DB role 不使用 owner/service admin 权限，只给 API 需要的表权限。
5. `TANGENT_POSTGRES_AUTO_CREATE_TABLES` 在 staging/production 应逐步关掉，避免 runtime 自动建表掩盖迁移问题。

### Realtime / Redis

新增或明确这些 runtime config：

```text
TANGENT_REALTIME_BACKPLANE=memory|redis
REDIS_URL=redis://redis:6379/0
TANGENT_BOARD_REALTIME_PERSIST_MODE=update_chain|final_snapshot
TANGENT_BOARD_REALTIME_PERSIST_DEBOUNCE_SECONDS=<seconds>
TANGENT_BOARD_REALTIME_LOCK_TTL_SECONDS=<seconds>
```

目标行为：

1. 单 API 实例可以先用 memory hub。
2. 一旦有多个 API worker/container，就必须用 Redis pub/sub。
3. awareness / cursor / draft preview 只广播，不写 Postgres。
4. Yjs/update chain 默认不再以 0.25s debounce 写 Postgres；只有显式设置 `TANGENT_BOARD_REALTIME_PERSIST_MODE=update_chain` 才退回旧兼容策略。
5. Postgres 写入现在以 compacted/final snapshot 为主：
   - `sync-state-publish` / compacted state；
   - room empty finalize；
   - 后续再补 operation-end、room idle、fixed low-frequency autosave、important structural event。
6. Redis 里的 lock / presence / draft 都必须有 TTL，断线后自动释放。

需要新增或调整的后端测试：

1. [x] 高频 yjs-update 默认不按每条写库，只更新 room memory state 并广播。
2. [x] compact publish / `sync-state-publish` 会写 final snapshot。
3. [x] room empty 时 finalize flush。
4. [x] `update_chain` 旧模式保留为显式兼容开关。
5. [x] guest/viewer 仍不能 document write。
6. [ ] awareness-state 不触发 Postgres write 的独立断言。
7. [ ] draft preview 不触发 Postgres write 的独立断言。
8. [ ] Redis unavailable 时，单实例 memory fallback 可用，并打日志。

### Asset / R2

短期不改对象存储：

```text
TANGENT_ASSET_STORAGE_DRIVER=s3-compatible
S3_ENDPOINT=<existing R2 endpoint>
S3_BUCKET=<existing R2 bucket>
S3_ACCESS_KEY_ID=<existing R2 access key id>
S3_SECRET_ACCESS_KEY=<existing R2 secret>
S3_REGION=auto
S3_ADDRESSING_STYLE=path
S3_PUBLIC_BASE_URL=
```

后续性能优化才考虑：

1. signed URL。
2. public CDN domain。
3. `S3_PUBLIC_BASE_URL` 真正参与 asset URL 生成。
4. 缩略图优先、原图按需。
5. API proxy cache headers 和 image response cache。

## 部署切换清单

### API host

1. [x] 在 Hetzner API host 上备份/维护当前 server-local `api.env` 到 shared env。
2. [x] 停止把 staging API 指向 Hetzner 本机 Postgres；不再创建新的 server-local staging DB。
3. [x] 更新 `DATABASE_URL` / `DATABASE_POOL_URL` 到全新 Supabase staging project。
4. [x] R2 env 保持服务商不变，并清空当前 staging 旧对象。
5. [ ] Docker Compose 加 Redis service（多 API worker/container 前再执行；当前单 API 实例 memory hub 已可运行）：

```text
redis:
  image: redis:7-alpine
  command: redis-server --appendonly no --save ""
  expose:
    - "6379"
```

6. [ ] Redis 不开公网端口，只允许 API container 内网访问。
7. [x] Caddy / reverse proxy 需要继续支持 WebSocket upgrade 到 FastAPI。
8. [~] API redeploy 后跑 health、migration、board、asset、realtime smoke；health/migration 已过，board/asset/realtime 浏览器 smoke 待补。

### Web deploy

Web 只有这些情况下需要重新部署：

1. `NEXT_PUBLIC_API_BASE_URL` 改了。
2. 前端协同 UI/transport 代码改了。
3. asset URL 策略从 API proxy 改成 signed/public URL。
4. 清空 Supabase/R2 后需要刷新 staging 页面状态，让旧 board/asset 不再出现在 UI。

单纯 Supabase DB 重新建库不需要 Web env 改动。

### 文档和 secret store

需要同步更新：

1. [x] `deploy/staging/deployment-secrets.local.md` 只记录需要的 key 名称和状态，不写值。
2. [x] `deploy/staging/README.md` 从 Neon/current local Postgres 改成 Supabase Postgres truth。
3. [x] `project_state/project_state_slice_S1B_staging_infra.md` 记录 Hetzner 本机 Postgres 为历史 fallback，不再作为可选 staging 路线。
4. [x] `ARCH/ARCH_slice_S1B_staging_infra.md` 在执行完成后更新架构 truth：managed Supabase Postgres + R2 clean bucket。

## 为什么不要把协同过程写数据库

如果画一笔 stroke 时每个点都写数据库，会产生：

- 数据库写入频率过高；
- 数据库读取 / data transfer 暴涨；
- 协同延迟受数据库 round trip 影响；
- Neon / Supabase 免费或低配额度很快撞限；
- 多人同时操作时保存冲突更复杂。

正确模式：

```text
用户操作过程:
  WebSocket 广播给同房间用户

操作结束或短暂停顿:
  合并成一次 document update
  写入 Postgres snapshot

重要事件:
  创建 history checkpoint
```

数据库应该记录“最后真实状态”，不是承担“每一帧实时广播”。

## WebSocket / Redis 的内存成本

WebSocket / Redis 会占用服务器内存和网络，这是正常的。

内存主要来自：

- 在线连接对象；
- board room membership；
- 每个用户的 presence / cursor / selection；
- 短暂消息队列；
- Redis pub/sub 连接和 TTL key。

staging 估算：

| 场景 | 估算 |
| --- | --- |
| 10 个在线用户，2-3 个 board room | 几十 MB 内存内 |
| 100 个在线用户，几十个 room | 通常仍比数据库压力更可控 |
| 多 API 进程 / 多机器 | 需要 Redis pub/sub，不能只靠进程内 memory |

协同广播消耗的是 API 服务器带宽和内存，但它避免了数据库 transfer 被实时过程打爆。

## 数据库选择

### 已选：Supabase Pro Postgres

理由：

- $25/月固定起步，开发阶段心理成本清楚。
- Pro 给 8GB DB/project、250GB bandwidth、100GB file storage 等更宽松配额。
- SQL editor、table editor、backup、dashboard 对现在调试友好。
- 和 Hetzner US West API 放同区域后，API 查库延迟可控。
- 可以只用 Supabase Postgres，不用 Supabase Auth 和 Supabase Storage，避免一次迁太多东西。
- 当前 staging 数据价值不高，可以直接干净建库，减少从旧 Neon/Hetzner local fallback 带脏数据和脏状态过来的风险。

注意：

- Supabase bandwidth / storage / compute 超额仍会计费，要开 usage/budget 监控。
- 不建议把 canvas 协同接 Supabase Realtime，它有 message quota，且不如我们自己 WebSocket/Redis 可控。
- API runtime 使用 pooler URL，Alembic/admin 使用 direct URL 或 Supabase 推荐的可用连接串。

### 放弃本轮升级：Neon paid

适合：

- 想继续沿用 Neon；
- 接受 usage-based 模式；
- 能把协同过程移出数据库，降低 data transfer。

风险：

- 之前已经撞过 data transfer quota，心理预期会变差；
- 如果协同策略没改干净，paid Neon 也可能继续被实时流量拖累。
- 本轮已经决定不继续围绕 Neon 扩容，避免 staging 数据库事实源再次摇摆。

### 不再作为路线：Hetzner local Postgres

它已经发生过一次临时 staging fallback，但后续不再把它作为可选路线：

- 备份、恢复、升级、磁盘扩容、监控都要自己管；
- API 和 DB 同机，单点故障更大；
- 后续生产事故恢复成本高。
- 重新建 Supabase 后，旧 local Postgres 可以删除或保留短期只读事故备份，但不能继续写入。

## 对象存储选择

### 当前建议：继续 R2

理由：

- 代码已经能接 S3-compatible，不需要迁移对象存储才能解决当前 DB/协同问题。
- R2 对图片产品更友好，尤其是 egress 免费。
- 现有 staging / production runbook 已围绕 R2 写好。
- 2026-05-18 截图中的 `tanergy-assets` 只有约 185.37 MB、150 Class A operations、220 Class B operations，远低于 R2 free tier，当前应为 $0 级别。
- 因为旧 board 已删除，当前 staging 旧对象可以直接删除，清干净后重新上传/生成资产。

当前缺口：

- API 仍通过 `/api/v1/assets/files/...` 代理文件读取。
- `S3_PUBLIC_BASE_URL` 已存在配置字段，但当前代码还没有真正用它生成公开/签名文件 URL。

后续优化：

1. 给资产响应加更清晰的 cache policy。
2. 增加 signed URL 或 CDN/public asset path。
3. 缩略图优先加载，原图按需加载。
4. 监控 R2 Class A / Class B operations。

清理规则：

1. 如果当前 bucket 只服务 staging，可以清空整个 bucket。
2. 如果当前 bucket 未来可能混有 production，必须只清 staging prefix，不能整桶删除。
3. 清理前不需要迁移旧对象，因为对应旧 board 已删除。
4. 清理后做一次 upload/read/thumbnail smoke，确认新对象路径能正常生成和读取。

### 不建议现在迁 Hetzner Object Storage

Hetzner Object Storage 是 S3-compatible，可以迁，但现在不是最高优先级。

适合以后：

- R2 成本或地区延迟变成明确问题；
- 对象数据进入 TB 级；
- 希望把 API 和对象存储都收敛到 Hetzner 账单。

如果未来迁：

1. 创建 private bucket。
2. object lock 先保持 disabled。
3. 复制现有 R2 对象，保持 key 路径不变。
4. 更新 `S3_ENDPOINT`、`S3_BUCKET`、`S3_ACCESS_KEY_ID`、`S3_SECRET_ACCESS_KEY`。
5. 跑 asset upload/read/thumbnail smoke。

## Supabase Pro 干净重建 Runbook

这一节是实际执行文档。当前结论是：**不迁旧数据库数据，Supabase staging 从空库重新建；R2 继续用但旧对象清掉重来；Hetzner Object Storage 不参与。**

### 重建边界

| 项目 | 决策 |
| --- | --- |
| 旧数据库 | 当前 Hetzner API 机器上的临时 Docker Postgres `staging-postgres` 只作为历史事故 fallback 记录，不恢复到 Supabase |
| 新数据库 | Supabase Pro staging project 空库 |
| 建库内容 | 跑 Alembic 到 head，再重新 bootstrap admin、plan catalog、测试 workspace/board |
| R2 | 不迁服务商；删除当前 staging 旧对象或 staging prefix，重新上传/生成 |
| 不保留内容 | 旧 board 数据、旧 board history、旧 asset metadata、旧 R2 对象、旧 Neon quota 状态 |
| 保留内容 | Clerk 项目与登录配置、R2 bucket 配置、AI/provider secret 名称、部署域名 |
| 切换方式 | 一次性切 API env 到 Supabase；不做旧库 -> 新库数据迁移，不做长期双写 |
| 回滚方式 | 优先修 Supabase env/schema；不把 Hetzner local Postgres 作为常规回滚目标 |

### Supabase project 创建

1. 开 Supabase Pro。
2. 创建 `tanergy-staging` 或等价命名的 staging project。
3. Region 选择美国西部或离 Hetzner Hillsboro / US West 最近的美国区域。
4. 进入 Supabase Database connection 页面，保存这些连接串到私密 secret store：
   - `SUPABASE_DIRECT_URL`：direct connection，能用时给 Alembic / admin / 低频维护命令；
   - `SUPABASE_SESSION_POOLER_URL`：session pooler，适合 IPv4-only 客户端、Alembic/admin 命令和多数长连接 runtime；
   - `SUPABASE_TRANSACTION_POOLER_URL`：transaction pooler，只在确认 ORM/prepared statement 兼容后再用。
5. 这轮默认把 `DATABASE_URL` 指向 direct 或 session pooler 的 Alembic/admin URL，把 `DATABASE_POOL_URL` 指向 session pooler runtime URL。
6. 如果 Hetzner 到 Supabase direct IPv6 不稳定，`DATABASE_URL` 也可以先用 session pooler；重点是 Alembic 能稳定连上。
7. Supabase project 必须从空库开始；不要把 Neon 或 Hetzner local Postgres dump 恢复进去。

说明：

- Supabase pooler 文档区分 direct、session pooler 和 transaction pooler；本项目先避开 transaction mode，减少 prepared statement / long transaction 兼容风险。
- 前端不需要 Supabase anon key，因为浏览器不直接访问 Supabase。

### 重建前冻结

重建窗口内不要让 API 继续写旧数据库：

```bash
docker compose -p staging -f deploy/staging/docker-compose.api.yml stop api
```

重建前记录，不写 secret：

1. 当前 git commit / release 目录。
2. 当前 API env 备份文件名。
3. 当前 Alembic head。
4. R2 bucket 名称和 endpoint 名称。
5. 当前 Clerk 测试账号和 admin email 状态。
6. 当前 Hetzner local Postgres 只是历史 fallback；不需要导出、对账或恢复。

### 在 Supabase 建干净 schema

目标 Supabase project 应该是空的 staging 数据库。先把 API container 的 `DATABASE_URL` 指向 Supabase Alembic/admin URL，然后运行项目自己的迁移：

```bash
docker compose -p staging -f deploy/staging/docker-compose.api.yml run --rm api alembic upgrade head
```

注意：

- 运行 Alembic 时，容器里的 `DATABASE_URL` 必须已经指向 Supabase Alembic/admin URL。
- 不要运行 `services/api/scripts/s1a_migration_smoke.py` 到这个 Supabase staging 库；它是 disposable DB smoke，会删除 `tangent_%` tables 和 `alembic_version`。
- 不要 restore 旧 Neon 或 Hetzner local Postgres dump。
- 运行后用 `alembic current` 确认到 head。

### Bootstrap 新 staging 数据

空库建好后，只重建最小可测数据：

1. 重新用 Clerk 登录创建当前测试用户。
2. 重新创建默认 workspace / solo workspace。
3. 重新授予当前测试账号 admin role。
4. 重新创建一个最小 board。
5. 重新上传一张小图，确认 R2 新对象链路可用。
6. 重新跑 Team / Group / invite / billing 的最小 smoke，必要时再 seed demo 数据。

### 清理 R2 staging 旧对象

R2 不换服务商，但旧对象可以清掉：

```text
Cloudflare R2 bucket:
  staging-only bucket -> 清空整个 bucket
  shared bucket       -> 只删除 staging prefix
```

执行规则：

1. 清理前确认 bucket/prefix 没有 production 对象。
2. 清理后保留 bucket、endpoint、access key 配置不变。
3. 清理后上传一张新图片，确认 asset metadata 写入 Supabase，二进制写入 R2。
4. 旧 board/image 引用允许失效，因为这轮就是干净重建。

### 切换 API env

更新 Hetzner server-local API env，只改数据库连接；R2 服务商和 Clerk 不动：

```text
DATABASE_URL=<Supabase direct or session-pooler Alembic/admin URL>
DATABASE_POOL_URL=<Supabase session-pooler runtime URL>

TANGENT_ASSET_STORAGE_DRIVER=s3-compatible
S3_ENDPOINT=<existing Cloudflare R2 endpoint>
S3_BUCKET=<existing Cloudflare R2 bucket>
S3_ACCESS_KEY_ID=<existing Cloudflare R2 key id>
S3_SECRET_ACCESS_KEY=<existing Cloudflare R2 secret>
S3_REGION=auto
S3_ADDRESSING_STYLE=path
S3_PUBLIC_BASE_URL=
```

不改：

1. `NEXT_PUBLIC_API_BASE_URL`，除非 API 域名变了。
2. Clerk keys，当前继续 Clerk。
3. R2 bucket / endpoint / keys，除非你选择新建 staging bucket。
4. AI provider keys。
5. Vercel 前端 Supabase env；这轮前端不需要 Supabase env。

重启 API：

```bash
docker compose -p staging -f deploy/staging/docker-compose.api.yml up -d api
```

### 切换后校验

数据库校验：

```bash
docker compose -p staging -f deploy/staging/docker-compose.api.yml run --rm api alembic current
```

API smoke：

1. `GET /health`。
2. Clerk 登录后 `/api/auth/session`。
3. `/api/v1/admin/me` 能返回 admin 状态。
4. workspace list 能看到重新创建的 workspace。
5. board create/list/load/save 正常。
6. board history create/list/load 正常。
7. R2 新 asset upload/read/thumbnail 正常。
8. Team / Group / invite / member 基础接口正常。

UI smoke：

1. 无痕窗口登录当前 staging admin 测试账号。
2. 进入 workspace。
3. 新建 board。
4. 打开新 board。
5. 保存 board。
6. 上传图片，确认写入清理后的 R2。
7. 重新打开页面，确认 board 和图片都存在。

### 重建完成后的清理

重建完成并稳定 24-48 小时后：

1. [x] Hetzner local Postgres 不再作为事实源，也不再作为后续 fallback 路线。
2. [x] 删除 `staging-postgres` 容器和 volume；事故追溯只保留文档记录。
3. [x] 文档里把 staging database truth 改为 Supabase Pro。
4. [x] `project_state` 记录 Neon quota -> Hetzner fallback -> Supabase clean rebuild 的最终状态。
5. [x] 后续所有 staging migration 只跑到 Supabase staging project。

## 干净重建执行顺序

### Phase 0：冻结当前临时状态

目标：重建前不要再把临时状态弄脏。

1. [x] 记录当前 API env 版本，不把 secret 写进文档。
2. [x] 停 API，避免继续写 Hetzner local Postgres。
3. [x] 记录当前 Alembic head。
4. [x] 记录 R2 bucket 和 S3 endpoint 名称，只记录名称，不记录 key。
5. [x] 确认当前 staging 数据允许丢弃。

### Phase 1：创建 Supabase staging project

1. [x] 创建 Supabase Organization / Pro。
2. [x] 创建 staging project。
3. [x] 区域选择美国西部或最接近 Hetzner US West 的美国区域。
4. [x] 保存两类连接串到私密 secret store：
   - direct connection URL：Alembic / admin 用；
   - pooler URL：API runtime 用。
5. [ ] 创建 API 专用 DB role；不要让 runtime 用 owner 权限。
6. [x] 不导入旧 Neon / Hetzner local Postgres 数据。

### Phase 2：创建 schema 和最小测试数据

执行原则：

1. [x] 对 Supabase staging 跑 Alembic `upgrade head`。
2. [ ] 重新登录/创建测试用户。
3. [ ] 重新 bootstrap admin role。
4. [ ] 重新创建 workspace / board / history smoke 数据。
5. [x] 不迁旧 asset metadata。

### Phase 3：切 API env

更新 Hetzner API runtime env：

```text
DATABASE_URL=<Supabase direct URL, only Alembic/admin>
DATABASE_POOL_URL=<Supabase pooled runtime URL>
TANGENT_ASSET_STORAGE_DRIVER=s3-compatible
S3_ENDPOINT=<existing R2 endpoint>
S3_BUCKET=<existing R2 bucket>
S3_ACCESS_KEY_ID=<existing R2 key id>
S3_SECRET_ACCESS_KEY=<existing R2 secret>
```

规则：

- [x] 不把任何 secret 写进 git。
- [x] `DATABASE_POOL_URL` 给 API runtime。
- [x] `DATABASE_URL` 保留给 Alembic/admin。
- [x] R2 env 不改，除非你选择新建 staging bucket；当前默认只清旧对象。

### Phase 3.5：清理 R2

1. [x] 如果 R2 bucket 只用于 staging，清空 bucket。
2. [~] 如果 R2 bucket 可能混有 production，只清 staging prefix；本轮按 staging-only bucket 清空处理。
3. [ ] 清理完成后上传一张新图片，确认 R2 新对象和 Supabase asset metadata 对齐。

### Phase 4：接 Redis / WebSocket 协同临时层

staging 先 Docker Compose 加 Redis：

```text
FastAPI container
  -> redis://redis:6379
Redis container
  -> no public port
```

实现边界：

- presence / cursor / draft / selection lock 只进 Redis 或 API memory。
- Yjs/update 广播走 WebSocket。
- Postgres 保存 debounced final snapshot。
- 操作结束、page delete、board structural change 要尽快广播。
- 最终保存失败时 UI 要显示 sync error，不能假装成功。

最低实现切片：

1. 单 API 实例：WebSocket room hub 先能广播 presence 和 draft。
2. 加 Redis pub/sub：为多进程、多实例做准备。
3. 文档快照保存：改成 debounce + operation-end，不要每个 stroke point 写库。
4. 冲突控制：文档版本号 / revision；远端更新和本地未保存状态要有明确合并策略。

### Phase 5：验收

基础 smoke：

1. `GET /health`。
2. Alembic current/head。
3. Clerk 登录后 `/api/v1/admin/me`。
4. workspace list。
5. board create/list/load/save。
6. board history create/list/load。
7. R2 asset upload/read/thumbnail。
8. invite / team / group membership smoke。

协同 smoke：

1. 两个无痕浏览器同 board。
2. cursor / nickname 正常显示。
3. A 画 stroke，B 能看到过程广播，不等最终保存才出现。
4. A 拖动元素，B 看到过程边界和最终位置。
5. A 选中/操作元素时，B 不能同时拖动/删除/缩放被锁元素。
6. A 删除 page，B 当前 page 立即切到有效 page 或看到明确提示。
7. 刷新后最终 snapshot 存在。
8. 数据库写入频率不是每帧/每点，而是合并后的快照写入。

## 回滚方案

数据库回滚：

1. 保留重建前 API env 备份。
2. 如果 Supabase 这版 schema 或权限有问题，优先修 Supabase staging project，不回切到 Hetzner local Postgres。
3. 如果重建失败，直接删除 Supabase staging project 重新开一个空库，比回到脏的本机库更干净。
4. 旧 Hetzner local Postgres 只保留事故备查，不作为日常回滚目标。

对象存储回滚：

- 当前不换对象存储服务商，所以没有对象存储回滚动作。
- 如果清空后的 R2 staging 资源不满意，直接重新上传/重新生成即可；不要把旧 board 资产恢复回来。

协同回滚：

1. WebSocket/Redis 广播失败时，可以先退回只保存最终 snapshot。
2. 保持 read-only / single-user board save 仍可用。
3. Redis 数据是临时态，不需要恢复。

## 风险清单

| 风险 | 应对 |
| --- | --- |
| Supabase region 离 Hetzner US West 太远 | 建 project 时选美国西部附近；切换前跑 API -> DB latency smoke |
| Supabase Free 不够用 | 直接按 Pro 规划，不把 Free 当长期 staging/production |
| 协同继续写数据库过多 | 明确禁止 presence/draft/cursor 每帧写 DB；用 WebSocket/Redis |
| 图片全部 API 代理导致 API 出口压力 | 当前可接受；后续做 signed URL/CDN/public asset path |
| 清错 R2 对象 | 清理前确认 bucket/prefix 是否只属于 staging；若不确定，只清 staging prefix，不整桶删除 |
| Redis 和 API 同机单点 | staging 可接受；生产后按在线人数和事故成本升级 managed Redis |
| 使用 Supabase Auth 诱惑导致登录迁移扩大 | 当前不迁 Auth，Clerk 继续作为唯一登录事实源 |
| 两套数据库双写变复杂 | 不做长期双写；Supabase 空库重建后就是唯一事实源 |

## 不做事项

当前阶段明确不做：

- 不迁 Supabase Auth。
- 不迁 R2 到 Hetzner Object Storage。
- 不保留当前 R2 staging 旧对象。
- 不从 Hetzner local Postgres 或 Neon 恢复旧 staging 数据。
- 不把图片文件塞进 Postgres。
- 不使用 Supabase Realtime 承担 canvas 协同主链路。
- 不长期保留 Neon / Supabase / Hetzner local 三套数据库互相调用。
- 不再在 Hetzner 服务器本机上新建 staging Postgres 作为数据库方案。
- 不在 git 或文档中记录真实 secret。

## 预计成本

价格基准按 2026-05-18 调研和当前控制台截图记录；购买前仍以官方页面最终结算为准。

### Supabase

| 项目 | Free | Pro |
| --- | ---: | ---: |
| 固定月费 | $0 | $25/月 |
| 月活用户 | 50K MAU | 100K MAU，之后约 $0.00325/MAU |
| Database | 500 MB，共享 CPU / storage | 每 project 8 GB disk，之后约 $0.125/GB |
| Bandwidth / egress | 5 GB | 250 GB bandwidth；250 GB egress 后约 $0.09/GB |
| Cached egress | 5 GB | 250 GB cached egress 后约 $0.03/GB |
| File storage | 1 GB | 100 GB，之后约 $0.021/GB |
| Backup / logs | Free 基础能力 | daily backup 7 天，logs 7 天 |
| 结论 | 不够现在 staging + 协同开发 | 推荐作为 staging/production Postgres 起点 |

这里的关键是：Supabase Free 的 500 MB DB 和 5 GB 出站很快会被 board/document/history/admin/billing 测试撞到，不适合作为长期 staging。

### Cloudflare R2

| 项目 | Free tier / 价格 |
| --- | ---: |
| Storage free tier | 10 GB-month / month |
| Class A free tier | 1,000,000 requests / month |
| Class B free tier | 10,000,000 requests / month |
| Standard storage 超额 | $0.015 / GB-month |
| Class A 超额 | $4.50 / million requests |
| Class B 超额 | $0.36 / million requests |
| Egress | $0 |
| 当前 bucket 截图 | 185.37 MB、150 Class A、220 Class B，应仍在 $0 级别 |

R2 继续适合图片资产。现在不建议迁移到 Supabase Storage，因为 Supabase Storage 的 file storage/egress 对图片产品不如 R2 友好。

### Hetzner Object Storage

| 项目 | 价格 |
| --- | ---: |
| 起步月费 | $7.99/月 |
| 起步包含 | 1 TB storage + 1 TB outgoing traffic |
| 超额 storage | 约 $12.30 / TB-month |
| 超额 outgoing traffic | 约 $1.20 / TB |
| S3 API operations | Hetzner 当前页面显示不按 request 单独收费 |
| 结论 | TB 级以后很香；当前 185 MB R2 bucket 完全不值得迁 |

Hetzner Object Storage 是后续 TB 级资产或账单收敛时的选项，不是当前优先级。

### Redis / WebSocket

| 项目 | 预计月成本 | 说明 |
| --- | ---: | --- |
| Redis 同机 Docker | $0 额外费用 | 占 Hetzner VPS 内存；staging 先这样 |
| Managed Redis | $5-$30 起 | 多 API 实例、生产稳定性或跨机器 backplane 需要时再上 |
| WebSocket API | 现有 Hetzner 成本内 | 增加 CPU/内存/带宽，但避免数据库 realtime transfer 被打爆 |

### 推荐月预算

| 阶段 | 组合 | 预计 |
| --- | --- | ---: |
| 当前修复期 | Supabase Pro + R2 free tier + Hetzner API + 同机 Redis | 约 $25 + 现有 Hetzner/Vercel 成本 |
| 小规模内测 | Supabase Pro + R2 小额超额 + Hetzner API 升级一档 | 约 $30-$80/月 |
| 对外早期 | Supabase Pro/更高 compute + R2 100GB 级 + managed Redis 可选 | 约 $80-$200/月 |

## 调研来源

- Supabase pricing: https://supabase.com/pricing
- Supabase billing docs: https://supabase.com/docs/guides/platform/billing-on-supabase
- Supabase database connection docs: https://supabase.com/docs/guides/database/connecting-to-postgres
- Cloudflare R2 pricing: https://developers.cloudflare.com/r2/pricing/
- Hetzner Object Storage overview/pricing: https://www.hetzner.com/storage/object-storage/
- Hetzner Object Storage docs: https://docs.hetzner.com/storage/object-storage/overview/

## 最终推荐执行路线

1. [x] 购买/启用 Supabase Pro。
2. [x] 创建 Supabase staging project，区域靠近 Hetzner US West。
3. [x] 不导入旧数据；在 Supabase 空库跑 Alembic 到 head。
4. [x] API env 切到 Supabase pooled runtime URL。
5. [x] R2 服务商不动，但清空当前 staging 旧对象或 staging prefix。
6. [ ] 重新创建测试用户、admin role、workspace、board 和一张测试图片。
7. [~] staging smoke 全部跑通；当前 health + Alembic 已通过，asset/board/browser/live AI 仍待补。
8. [~] WebSocket/Redis 协同广播改造，数据库只落最终 snapshot；当前已完成 final snapshot 持久化，Redis pub/sub 和 lock TTL 待补。
9. [ ] 稳定后再准备 production Supabase project 和 production env。

一句话判断：

> 现在最需要做的是干净重建 staging 数据库和清理旧 R2 对象，不是把临时库继续迁来迁去；协同写入策略后续仍要改成广播过程、数据库只落最终事实。
