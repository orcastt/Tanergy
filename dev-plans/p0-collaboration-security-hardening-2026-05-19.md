# P0 协同与安全加固计划（2026-05-19）

## 目标
- 修复高频协同下的掉线、丢更新、拖动草稿和远端状态不同步。
- 统一名称类输入的前后端校验策略。
- 把 Miro-like 权限边界、公开分享、WebSocket 协同、上传与导出链路做一次完整安全审计。

## 已完成的即时修复
- 协同更新超限时，不再直接丢弃单条更新，改为请求紧凑态重发。
- 协同传输和后端消息上限提升，减轻高频拖动/复制/绘制下的断流。
- 远端拖动草稿恢复显示操作者姓名。
- Chat 节点双击进入编辑时自动关闭模型菜单，避免输入层级遮挡。
- 名称类输入增加前后端统一过滤。

## 2026-05-19 追加：15 人高频协同稳定性策略
- 画布拖拽中的实时感知继续走 awareness：只广播鼠标、选中、transform preview、操作者标签，不写数据库，不进入 Yjs 文档链。
- 真实文档提交改成低频快照：拖拽 / 绘制 / 复制等连续操作不再按 30fps 级别持续写入 Yjs，改为约 120ms 合并一次，最长 900ms 必须落一帧。
- 鼠标释放、页面隐藏、pagehide 时强制 flush 最后一帧，避免用户拖完对象后远端停在旧位置。
- 服务端 compaction 请求改成“合并广播给可编辑连接”：当 update chain 达到阈值时，只在进入 compaction 状态或冷却结束后通知一次，避免 15 人高频操作时 compaction 请求风暴。
- compaction 只发给有编辑权限的连接；viewer / guest 可以接收同步，但不负责发布紧凑态。
- 客户端收到 compaction request 后增加最小间隔，避免同一 tab 在高频请求下连续发布完整紧凑态。
- 服务端广播改成“跨连接并行、单连接串行”：避免 15 人高频写入时多个协程同时向同一个 WebSocket send，减少乱序、阻塞和后续不同步风险。
- 新增 `services/api/scripts/s4_realtime_multiplayer_load.py`，可模拟 15 个浏览器 tab 形态的 WebSocket 协作者，同时发送拖拽 awareness 与文档更新，验证每个客户端是否持续收到远端更新。

## 2026-05-19 追加：P0 安全边界第一轮
- HTTP 入口新增统一安全边界：先做 rate limit，再做 body size guard，最后为 API 响应加安全响应头。
- 生产 CORS 统一走 `TANGENT_ALLOWED_ORIGINS` 解析，生产环境忽略通配 `*`，避免误把所有来源放进可信域。
- API 响应新增 `X-Content-Type-Options: nosniff`、`Referrer-Policy: strict-origin-when-cross-origin`、`X-Frame-Options: DENY`、`Permissions-Policy`；私有 API 默认 `Cache-Control: no-store`。
- 高成本和高风险路径增加基础防刷桶：AI / image ops / upload / billing / invite / export 走更低阈值；auth、admin write、public path 可独立配置。
- WebSocket realtime 增加 Origin allowlist 检查、单房间连接上限、单连接消息速率限制；超限会以 `4408` 关闭连接。
- 新增安全边界测试：HTTP 安全头、HTTP 429、WebSocket bad Origin、WebSocket message rate limit。

## 2026-05-20 追加：P0-B 防刷与幂等第一轮
- 新增结构化 security event 入口：记录 HTTP rate limit、WebSocket Origin 拒绝、WebSocket room connection limit、WebSocket message rate limit、业务日配额拒绝、幂等键冲突。
- 新增业务日配额基础设施：按 UTC day + user + workspace + action 计数；AI run、remove background、asset create/upload、workspace invite、billing checkout 接入第一轮保护。
- 新增 `Idempotency-Key` 基础设施：同 user/workspace/action/key + 相同 payload 直接重放响应；同 key 不同 payload 返回 `409` 并记录安全事件。
- AI run、remove BG、billing checkout、workspace invite create 支持幂等，避免用户双击或脚本重放创建多笔高成本任务/支付/邀请。
- 上传文件流暂不做响应缓存，只做业务日配额，避免读取 multipart 后复用带来的风险。
- 新增测试：AI run 幂等重放不会消耗额外日配额；幂等 key 不同 payload 会被拒绝。

## 2026-05-20 追加：P0-C 安全持久化、上传与公开分享
- 新增 migration `20260520_0031_security_rate_limit_idempotency.py`：持久化 `tangent_security_events`、`tangent_security_daily_usage`，并扩展 `tangent_idempotency_keys` 保存 request fingerprint 与 response JSON。
- security event、每日业务额度、幂等响应缓存优先落 Postgres；数据库未配置、未迁移或短暂不可用时回退内存，避免阻断主业务请求。
- 资产入口补齐 magic bytes 校验：upload、data URL、remote import、AI/provider output、Remove BG 输入和输出都不能只信 MIME / Content-Type。
- 资产文件响应增加 `X-Robots-Tag: noindex, nofollow` 与 `Cross-Origin-Resource-Policy: same-site`，降低私有图片被搜索收录和跨站热链的风险。
- 公开 share resolve/load 接入 public rate limit：扫描不同 share token 也会落入同一个 public 桶，不再因为 URL 不同绕过短窗防刷。
- 公开 share resolve/load 增加脱敏 security event，只记录 share token hash，不写真实 token。
- 新建 board share token 改为 32 bytes URL-safe 强随机值；旧的短 share id 仍可读取和撤销，保证兼容。
- 新增测试：asset MIME magic mismatch、asset 防爬响应头、public share token 扫描限流、share token 脱敏日志、强随机 share token 长度。

## 2026-05-20 追加：P0-D CSRF 与响应索引边界
- 新增 cookie session 写请求 Origin / Referer 校验：带 `__session` cookie 的非安全方法必须来自 `TANGENT_ALLOWED_ORIGINS`，否则返回 `403` 并记录 security event。
- Bearer token API 调用不走 cookie CSRF Origin 拦截，避免服务端/脚本 API 调用被误伤。
- billing webhook 路径保持 CSRF exempt，后续继续依赖 provider signature 校验。
- public share 和 asset file 响应统一补 `X-Robots-Tag: noindex, nofollow`，减少公开 token 和私有资产被搜索引擎收录。
- 新增测试：恶意 Origin + cookie session 写请求被拒绝；Bearer 写请求不会触发 cookie CSRF 事件。

## 2026-05-20 追加：P0-E Realtime 权限重验与成员角色防提升
- WebSocket realtime 文档写入不再只信握手时的 `canEdit` 快照；每次 `yjs-update` / `sync-state-publish` 前都会重新读取 board collaboration 权限。
- 如果成员被移除、board role 降级、room key 不匹配或不再有 edit 权限，服务端会关闭连接 `4403` 并记录 `realtime.write_access` security event。
- realtime room 会同步更新连接的 `can_edit` 状态，避免被撤权连接继续收到 compaction 请求。
- Board member API 禁止通过成员接口授予 `owner` 或 `temporary_viewer`；可分配角色限定为 `admin`、`editor`、`viewer`，owner 只来自 board owner 字段。
- 新增测试：editor WebSocket 连接期间被移除后不能继续写入；board member 接口拒绝 owner/temporary role escalation。

## 2026-05-20 追加：P1-A Redis 分布式防刷第一轮
- 新增可选 Redis 安全计数器：`TANGENT_SECURITY_REDIS_ENABLED=1` 且配置 `TANGENT_REDIS_URL` / `REDIS_URL` / `UPSTASH_REDIS_URL` 后启用；未配置、连接失败或本地开发时自动回退现有 Postgres / 内存路径。
- HTTP rate limit 从单进程内存桶升级为 Redis 共享短窗桶优先：多台 API 实例、多个进程会使用同一组 hash key，避免用户换实例绕过每分钟限制。
- AI run / remove BG / upload / invite / billing checkout 等已接入的每日业务配额优先使用 Redis UTC day 计数，降低脚本刷高成本接口时对 Postgres 的写压力。
- Redis key 只保存命名空间、scope 和 hash，不把 user id、workspace id、Authorization、share token 等原文写入 Redis key。
- 部署样例增加 `TANGENT_REDIS_URL`、`TANGENT_SECURITY_REDIS_ENABLED`、`TANGENT_REDIS_KEY_PREFIX`；staging / production 可用不同 prefix 隔离。
- 新增测试：HTTP rate limit 使用 Redis counter 时返回共享桶 429；每日业务 quota 使用 Redis counter 时第二次 AI run 被拒绝。

## 2026-05-20 追加：P1-B WebSocket Redis 分布式防刷
- Realtime room connect 短窗优先使用 Redis `realtime_room_connection_rate` counter；Redis 未开启或不可用时仍回退现有进程内 room connection limit。
- Realtime message rate limit 优先使用 Redis `realtime_message_rate` counter，key 只进入 `security_redis` hash；Redis 不可用时继续走单连接内存滑窗。
- 新增 monkeypatch 测试覆盖 Redis connect / message counter、Redis 不可用消息内存回退、Redis 不可用 room 内存回退，不依赖真实 Redis。

## 2026-05-20 追加：P1-A 全接口越权测试第一轮
- 新增 Board BOLA focused tests：覆盖跨 workspace 的 load / patch / delete / copy / snapshot create-list-load-clear / restore / collaboration / members / share revoke。
- Board viewer 负测扩展到 rename、snapshot create、restore、member candidates、member create/update/delete、share create、delete board，避免只检查前端按钮隐藏。
- Workspace 管理路由完成第一轮 route-level 越权测试：delete workspace、invite list/create/revoke、member role update/delete、seat list/upsert/revoke 覆盖 spoofed header 与跨 workspace 场景。
- Workspace invitations / members / seats 的服务端鉴权改为读取数据库中的真实 workspace kind/status 与 actor membership role，不再只信 `x-tangent-workspace-role` header。
- Billing 完成第一轮 route-level 越权测试：personal topup complete、workspace topup/seat complete、payments list、workspace checkout 覆盖 wrong user / wrong workspace / member/editor 场景。
- Admin bootstrap 完成第一轮真实 role gate 测试：summary、users、teams、groups、operatorUsers 按区块分别 gate，不再 `bool(roles)` 后一次性加载全部数据。
- 真实 bearer / session context 完成第一轮 header-spoof 测试：`x-tangent-workspace-kind/name/role/plan-key` 不会覆盖 DB membership 解析出的真实 workspace context。
- Admin 子路由完成第一轮真实 role matrix：core、roles、directory、operator、finance/manual finance、AI control/runtime/versions/analytics 覆盖 plain/support/finance/admin/owner，不再 monkeypatch `require_admin_role`。
- Admin core/roles/AI 读接口补上显式 allowed role；`support` 角色不会因为拥有任意 admin role 而进入敏感读接口。
- 剩余 P1-A 延伸项：公开分享前端 E2E、真实 Clerk/OIDC staging smoke、更完整的 admin 支持角色产品定义。

## 2026-05-20 追加：P1-C XSS / URL 渲染安全第一轮
- 前端新增集中 URL sanitizer：图片显示、lightbox 打开、PNG capture、SVG export、node runtime image payload 都只接受 `http(s)` 或同源相对资源路径，拒绝 `data:`、`blob:`、`file:`、`javascript:`、`vbscript:` 以及大小写/控制字符混淆。
- SVG export 不再把持久化的 `data:` 或未知 scheme 原样写入 `<image href>`；无法确认安全时降级为占位图。
- 前后端 board guard 对 `originalUrl`、`thumbnail*Url`、`thumbnailUrl`、`sourceUrl`、`imageUrl` 等 URL 字段加 allowlist；非法 URL 保存前直接阻断。
- Board list thumbnail 和 history thumbnail 也接入同一 URL sanitizer，避免历史/列表缩略图成为绕过点。
- 公开 share 页面接入密码输入闭环：受密码保护的分享链接会通过 `x-tangent-share-password` 头 resolve/load，不再只能在 API 层可用。
- 新增测试覆盖 unsafe image URL 拦截、混淆 `javascript:` 拦截、上传 asset URL 放行。

## 2026-05-20 追加：P1-D 公开分享过期/密码/撤销 worker
- 分享链接服务端支持过期、软撤销、显式重建 token 和可选密码保护；密码只保存 PBKDF2 hash，公开 resolve/load 通过 `x-tangent-share-password` 头校验。
- 旧分享链接保持兼容：缺少 `passwordHash` / `passwordProtected` / `revokedAt` 的 local JSON 和历史 Postgres 行仍按无密码活动分享读取。
- 新建/更新分享会返回 `passwordProtected`，并在 local 存储写入新安全字段；重建会撤销旧活动链接并生成新的强随机 share token。
- 新增 focused 测试覆盖 Postgres 密码/撤销/重建、公开路由密码头、local 旧分享兼容读取。
- Next local fallback 分享链路同步支持 `password` / `clearPassword` / `regenerate` / `expiresAt`；local resolve/load 也读取 `x-tangent-share-password`，并用 PBKDF2 hash 存储密码。
- Next local fallback share token 已从旧 16 位短 token 调整为 32 bytes URL-safe 强随机 token，与 FastAPI 口径对齐。
- 前端新增零依赖 local share password smoke，覆盖密码 hash 不存明文、正确/错误/缺失密码校验、清除密码和 legacy entry normalization。
- 行数债务：`board_schemas.py` 与 `board_storage_adapter.py` 已在本 slice 前超过 300 行；本次只做必要签名/schema 增量，后续触碰 Board API 边界时拆分。

## 2026-05-20 追加：P1-F 公开防爬与资产下载防刷
- 后端 `GET /api/v1/assets/files/*` 增加 `asset_file` 专用短窗限流，默认 `TANGENT_ASSET_FILE_RATE_LIMIT_PER_MINUTE=300`，同用户/workspace/IP 跨文件名共享 bucket，避免换文件名绕过。
- asset file 与 public share API 响应统一补 `X-Robots-Tag: noindex, nofollow`、`Cross-Origin-Resource-Policy` 和明确 cache 口径。
- Next asset proxy、local share resolve/load、`/share/[shareId]` 页面 metadata 与 `robots.txt` 同步补 noindex/noapi/share 禁爬口径。
- 新增 focused 测试覆盖 asset file headers、asset file rate limit security event、public share anti-crawl headers。

## 2026-05-20 追加：P1-E 上传/SSRF/SVG/PDF 安全加固
- Asset 图片管线明确收口为 raster-only：只接受 `image/png`、`image/jpeg`、`image/webp`，`image/svg+xml` 和 `application/pdf` 在 data URL、上传、远程导入和 AI/provider output 落库前统一拒绝。
- 伪装文件不只靠 MIME：PDF/SVG 形态的 payload 即使伪装成 PNG/JPEG/WebP 也会被 common guard 拦截，之后仍做 magic bytes 与声明 MIME 一致性检查。
- 远程图片导入改为手动处理最多 5 次 redirect；每一跳和最终 URL 都重新验证 `http/https` scheme、禁止 userinfo/control chars，并解析 DNS 后只允许公网 global IP。
- SSRF 拦截覆盖 localhost、内网、link-local、保留/共享地址、cloud metadata IP/host；继续保留 8 秒 timeout、Content-Length 预检和流式 100MB 上限。
- 新增测试：SVG/PDF data URL 与 upload 拒绝、redirect 到 metadata/link-local 前停止、公开 redirect 可导入、AI output SVG 落库拒绝。

## 2026-05-20 追加：P1-G Next 本地 API CSRF 与 Admin Proxy 收口
- Next App Router 新增同源写请求 guard：非安全方法会拒绝 `Sec-Fetch-Site: cross-site`、恶意 `Origin` / `Referer`，带 cookie 但缺少来源头的浏览器写请求也会被拒绝；Bearer-only 脚本请求保持可用。
- Admin proxy 不再把浏览器传入的 `Authorization` / 全量 `Cookie` 覆盖到上游，只使用 server-side Clerk token 或精确 `__session`，降低 confused deputy 与 cookie 外泄面。
- Admin proxy 增加 method + path allowlist，只允许当前 FastAPI admin 路由矩阵，拒绝 `..`、空段、slash/backslash 等危险 path segment，并用 `new URL` + `encodeURIComponent` 构造上游 URL。
- Admin proxy 写请求限制为 JSON，代理层 body 上限 256KB，避免大 body 在 Next 进程先被完整读入。
- Next 本地高风险写入口接入同源 guard：auth profile/account/dev bypass、AI run/chat、asset upload/from-url/from-data-url、board save/update/delete/copy/rename/snapshot/share/member/collaboration。
- 新增 `next-security-guard-smoke.mjs`，覆盖恶意 Origin、缺失来源 cookie 写请求、Bearer-only 请求、admin proxy 合法/非法路径矩阵。

## 2026-05-20 追加：P1-H Next 代理认证头混淆收口
- Auth profile/account 代理不再透传浏览器传入的 `Authorization`、全量 `Cookie` 或 `x-tangent-*` 上下文头；只使用 server-side Clerk 派生的认证头，并只保留 JSON content-type。
- Asset file remote proxy 不再透传浏览器 `Authorization`、全量 `Cookie`、workspace kind/name/role/plan 等可伪造头；只使用 server-side Clerk 认证头、`Accept`，以及经过 ID allowlist 校验的 `workspaceId` selector。
- AI chat 内联读取同源/API 资产时，不再把浏览器传入的 `Authorization` 原样转发；改为使用 server-side Clerk 认证头，减少 XSS 或同源脚本造成的 token confusion 面。
- 保留必要的 workspace selector：authenticated backend 只把 `x-tangent-workspace-id` 用于选择用户已有 membership，不信任客户端 role/kind/name/plan。

## 2026-05-20 追加：P1-I Next 全局安全响应头与 Session Proxy 收口
- Next 全站响应补齐浏览器安全头：`X-Content-Type-Options`、`Referrer-Policy`、`X-Frame-Options`、`Permissions-Policy`、基础 CSP；生产构建额外加 HSTS。
- CSP 采用兼容 Next/Clerk/画布图片的保守口径：默认 `self`，禁止 object/embed 与外部 frame 嵌套，图片允许 `https:` / `blob:` / `data:`，connect 允许 API origin 与 `https/wss/ws`，后续可再收窄到精确域名。
- `/api/auth/session` remote proxy 不再转发浏览器原始 `Authorization`、全量 `Cookie` 或可伪造的 workspace role/kind/name/plan；只使用 server-side Clerk 认证头与经过 ID allowlist 的 `x-tangent-workspace-id` selector。
- `.env.example` 增加 `NEXT_PUBLIC_APP_URL` / `NEXT_PUBLIC_ASSET_BASE_URL`，用于同源 guard / CSP 在 staging 和 production 明确声明站点与资产域。

## 2026-05-20 追加：P1-J Next Local Board Bridge 生产收口
- Board local fallback 增加与 AI / Asset 一致的 bridge policy：一旦配置 `NEXT_PUBLIC_API_BASE_URL`，`/api/boards/local-*` 私有本地读写入口不再进入本地文件存储，必须走 FastAPI `/api/v1/boards`。
- 本地 board bridge 只在无 remote API 的非 production 环境默认可用；生产无 remote API 时需要显式 `NEXT_PUBLIC_TANGENT_ENABLE_LOCAL_BOARD_BRIDGE=1`，避免部署配置缺失时自动暴露本地存储接口。
- 这样即使攻击者直接调用 Next local board API 并伪造 `x-tangent-*` header，staging / production 也会先被 local bridge policy 挡住。
- `next-security-guard-smoke.mjs` 增加 board bridge policy 断言，防止以后误删这条生产收口。

## 2026-05-20 追加：P1-K 前端 Workspace Context Header 最小化
- 浏览器直连 FastAPI 时，workspace 选择头收口为只发送 `x-tangent-workspace-id`；不再发送可伪造的 `workspaceKind`、`workspaceName`、`workspaceRole`、`planKey`。
- 完整 `x-tangent-*` mock context 只在真正 local-dev fallback 下使用：无 remote API，或本机 Next -> 本机 API 且未启用 Clerk API auth。
- `/api/auth/session` 前端请求同样只发送 workspace id selector，配合 Next session proxy 的 server-side Clerk headers，避免 role/plan header 在浏览器请求里传播。
- `next-security-guard-smoke.mjs` 增加 header 最小化断言：远程 API 模式只允许 workspace id，本地 fallback 才允许 mock role/plan/user context。
- 本改动不替代后端鉴权；后端仍以 bearer/session 解析出的 DB membership 为最终安全边界。

## 2026-05-20 追加：P1-L Next Local Bridge 兜底收口
- 本地 AI run lookup 路由补上 `assertLocalAiBridgeAvailable()`，避免 staging / production 配置远程 API 后仍能访问 Next 本地 AI run store。
- `runtimeBridgePolicy` 的 smoke 覆盖扩展到 AI、Asset、Board 三类：配置 `NEXT_PUBLIC_API_BASE_URL` 时全部禁用本地 bridge；production 无远程 API 时默认禁用，只有显式 opt-in 才开启。
- `.env.example` 补齐 `NEXT_PUBLIC_TANGENT_ENABLE_LOCAL_AI_BRIDGE`、`NEXT_PUBLIC_TANGENT_ENABLE_LOCAL_ASSET_BRIDGE`、`NEXT_PUBLIC_TANGENT_ENABLE_LOCAL_BOARD_BRIDGE`，让部署开关可审计。
- Local dev auth bypass 的 GET 跳转改为相对 `Location`，不再信任 `x-forwarded-host` / `host` 拼绝对 URL，降低误开后的 open redirect 面。
- `/api/boards/validate-document` 写入口补上 Next 同源 CSRF guard，和其他本地 board 写入口保持一致。
- `next-security-guard-smoke.mjs` 增加 Next API 写入口扫描：新增 `POST/PUT/PATCH/DELETE` route 若没有 `rejectCrossSiteMutation` 或明确 501，会在 smoke 阶段失败。

## 2026-05-20 追加：P1-M Staging 安全 Smoke 补齐
- 新增 `services/api/scripts/security_redis_smoke.py`：可在 staging/production deploy 后用真实 Redis URL 验证 security counter 的计数、TTL、禁用回退；本地未配置 Redis 时默认 skip，`--required` 可作为部署强校验。
- 新增 `apps/web/scripts/public-share-client-smoke.mjs`：覆盖前端公开分享 resolve/load/create/revoke 在 local/remote 两种模式下的 URL、密码头、JSON body 与认证头行为。
- 新增 `services/api/scripts/security_staging_auth_smoke.py`：用真实 Clerk bearer token 验证 session 最小 header、spoofed role/plan header 不改变后端 membership 角色、cookie 写请求恶意 Origin 被拒。
- 真实 Clerk/OIDC staging smoke 仍需要人工提供 bearer token 和 workspace id；脚本已准备好，但不能在本地无凭据环境自动完成。
- Admin 角色产品定义当前明确为 `owner` / `admin` / `finance`：`finance` 可读核心/目录/运营/AI/财务，并可做财务 manual write；管理员 role 授权、AI 控制面写入、operator 写入仍限定 `owner` / `admin`。`support` 角色未作为产品能力开放，后续若要支持需新增独立 PRD/测试矩阵。

## 2026-05-20 追加：P1-N 静态安全 Guard
- 新增 `apps/web/scripts/security-static-guard.mjs`，扫描前端/后端源码中的危险 DOM sink、硬编码 secret 特征、浏览器 token storage、以及非白名单的可伪造 workspace role/plan header。
- AI chat 内联读取 asset 时只转发 server-side auth、`x-tangent-user-id` 与 `x-tangent-workspace-id`，不再转发 workspace kind/plan 这类可伪造上下文。
- 静态 guard 的白名单仅保留本地 mock/context 解析、旧 smoke/压测兼容脚本和 Redis Lua counter；业务源码新增危险 sink 或权限 header 会失败。

## 2026-05-20 追加：P1-O 部署配置红线 Smoke
- 新增 `services/api/scripts/security_deploy_config_smoke.py`，可用 `--env-file` 检查 staging/production 必需安全配置：API auth、Redis security counter、Origin allowlist、WebSocket Origin、Clerk issuer/JWKS/authorized parties、S3/R2、非本地存储 driver。
- `--check-redis-connectivity` 可在 staging/production 主机上真实递增临时 Redis security counter，把“Redis URL 写了但服务不可达”变成部署失败。
- `APP_ENV=staging` 现在和 production 一样被 `security_origin` 视为 production-like；未显式关闭时，WebSocket 默认要求 Origin。
- `.env` 已补非密钥安全开关：`TANGENT_REQUIRE_API_AUTH=1`、`TANGENT_SECURITY_REDIS_ENABLED=1`、`TANGENT_REQUIRE_WEBSOCKET_ORIGIN=1`，并用现有 `TANGENT_ALLOWED_ORIGINS` 补 `CLERK_AUTHORIZED_PARTIES`。
- 当前本机 `.env` 通过 deploy config smoke；Redis connectivity smoke 在本机失败，因为当前 Redis host 是容器/部署网络地址，需在 staging 主机或替换为本机可达 Redis URL 后运行。

## 2026-05-20 追加：P1-P 部署、监控与事故响应验收
- 新增 `services/api/scripts/ops_readiness_smoke.py`：验证公开 Web/API 域名的 HTTPS 证书、Web 安全头、Next 静态资源缓存、API `/health` 安全头和 CORS preflight；域名不可达时输出结构化失败报告。
- `security_deploy_config_smoke.py` 增加 recommended ops observability 检查：alert channel、status page、Sentry/error tracking DSN、API 慢响应阈值、RSS 内存阈值。
- FastAPI HTTP middleware 接入 `tangent_api.ops_observability`：按 `TANGENT_API_SLOW_RESPONSE_MS` 记录慢响应，按 `TANGENT_MEMORY_RSS_WARN_MB` 记录高 RSS，日志不包含 query string。
- 新增 `deploy/staging/web.env.example` 与 `deploy/production/web.env.example`，把 Web/Vercel 环境变量从 API env 模板中拆开；生产 Web/API/DB/R2/Clerk/支付 secrets 必须与 staging 分离。
- 新增 `docs/ops-readiness-acceptance.md` 与 `docs/incident-response-runbook.md`，覆盖自定义域/SSL、环境分离、数据库备份/PITR、CDN/cache、uptime/status、error tracking、性能监控和事故处理流程。
- 生产仍未完成的外部平台项：Cloudflare WAF/限速 dashboard、Supabase/managed Postgres backup + PITR restore drill、外部 uptime monitor、status page、Sentry/APM/source maps 与告警 owner。
- 2026-05-20 追加：新增 `security_object_storage_smoke.py`，在真实 staging/prod R2/S3 env 上临时写入、读取、删除对象，并在配置 public base URL 时探测是否可公开读取。
- 2026-05-20 追加：新增 `ops_external_proof_smoke.py`，把 WAF、rate limit、PITR、restore drill、RPO/RTO、status page、alert channel、Sentry/APM 从人工 TODO 收口成 production-like 可失败检查。
- `security_release_gate.py` 现在支持 `--check-object-storage`、`--require-external-ops-proof` 和 `--check-external-ops-urls`，用于 staging/prod 硬闸门；本地默认 gate 仍不要求真实外部平台。
- Realtime WebSocket replay 测试补了确定性同步点，避免 TestClient 在高频消息后立刻建立第二连接时偶发抢在前一条 `yjs-update` 入房间前读取旧版本。
- 2026-05-20 全栈本地验收通过：`security_release_gate.py --env-file deploy/staging/api.env.example` 跑完 Web build、28 条 Playwright security E2E、API compileall、API performance smoke、367 条 backend tests 和 `git diff --check`。
- 2026-05-20 staging redeploy 后，公开 ops smoke 已转绿：Web/API TLS、Web home 安全头、Next static cache、API `/health` 安全头和 CORS preflight 全部通过。上一轮失败点是已部署 release 未吃到安全头改动，当前 `b35adc0` release 已解决。

## 冲突解决口径
- 不把拖拽过程中的每个像素位移当成最终文档事实；过程态是 awareness，最终态才进入 Yjs 文档。
- 不同对象并发编辑：通过 page/entity merge 合并，互不覆盖。
- 同一对象并发编辑：优先依靠 10 秒 selection/transform 锁避免同时写；如果两个用户在锁同步前同时改同一对象，则按到达顺序最后写入者胜出，并通过下一轮紧凑态收敛。
- 删除与连线：删除对象时会清理依赖该对象的 runtime edge；连线作为独立 edge 参与实体合并，避免只有移动后才显示的滞后问题继续扩大。

## 安全边界当前状态
1. 画布访问权限
   - 已覆盖统一 `user_id + workspace_id + board_id + role` 检查，并补充 board / snapshot / share / member / collaboration / realtime BOLA / IDOR 回归。

2. WebSocket 协同鉴权
   - 已覆盖握手 Origin/room key/role、每条写消息权限重验、成员移除后长连接失效、消息速率/连接防刷。
   - stale compaction 的回归改为 room 级稳定测试，避免 TestClient 多 WebSocket 调度竞态，同时保留端到端 stale sync-state resync 测试。

3. 公开分享链路
   - 已覆盖强随机 token、过期、密码、撤销、重建、noindex、公开 API 限流和前端 share client smoke。

4. 输入与渲染安全
   - 已覆盖名称类输入、board URL guard、safe URL sanitizer、危险 DOM sink 静态 guard、文件名/AI 输出/board text 走文本渲染口径。

5. 上传与导出
   - 已覆盖 raster-only、MIME + magic bytes、SVG/PDF 拒绝、SSRF redirect/DNS 拦截、asset noindex/CORP 与下载防刷。

6. 管理员与计费
   - 已覆盖 admin role matrix、finance/admin route 越权测试、seat 上限邀请限制、billing/AI/upload/invite 幂等与每日配额防刷。

7. 部署与运营安全
   - 已覆盖 repo 内部署配置 smoke、公开 TLS/header/CORS smoke、API 慢响应/RSS 日志、Web/API env 模板分离和事故响应手册。
   - 未完成项是外部平台配置证明：WAF/rate limit、状态页、告警、Sentry/APM、数据库 PITR/恢复演练。

8. 仍需 staging 人工凭据验证
   - 真实 Clerk/OIDC token：运行 `security_staging_auth_smoke.py`。
   - 真实 Redis：在 Redis 可达的 staging/prod 主机运行 `security_redis_smoke.py --required`，或 `security_deploy_config_smoke.py --check-redis-connectivity`。
   - 真实部署配置：确认 `TANGENT_ALLOWED_ORIGINS`、`TANGENT_ALLOWED_WEBSOCKET_ORIGINS`、Redis URL、Clerk issuer/audience、对象存储 bucket 私有化均为 staging/production 专属值。

## 建议验证顺序
1. 先补协同高频更新稳定性。
2. 再做权限与分享链路审计。
3. 最后补输入、上传、导出和管理员审计。

## 高频协同压测命令
```bash
PYTHONPATH=services/api python3 services/api/scripts/s4_realtime_multiplayer_load.py --clients 15
```

说明：这一步压的是实时协同传输层，模拟多浏览器 tab 的 WebSocket 行为；真正的 UI 浏览器压测后续可以再接 Playwright，多开 browser context 验证 Konva 渲染与交互层。

## 2026-05-19 追加：网络安全攻击面与防御总计划

参考资料基线：OWASP Top 10 / API Security Top 10、OWASP WebSocket / Bot Management / XSS / SQL Injection / CSRF / File Upload / SSRF / HTTP Headers / Logging Cheat Sheet、NIST SP 800-63B、CISA Secure by Design。

### 当前状态判断
- 已有：board / workspace / realtime 的基础 RBAC，WebSocket room key，消息大小限制，realtime 写权限检查，管理员 audit log，名称类输入过滤，board guard 禁止保存 `data:` / `blob:` / base64 图片。
- 已有风险：CORS 当前较宽；WebSocket 还需要 Origin allowlist 与长连接权限撤销；公开分享链接缺少完整过期/密码/撤销策略审计；上传与外链资源需要更强 MIME / magic bytes / signed URL；防刷、防爬、登录异常、AI 成本保护还没有形成统一中间件。
- 口径：前端校验只改善体验，不是安全边界。所有鉴权、配额、输入、计费、AI 成本、文件类型与分享权限必须由服务端最终裁决。

### 常见攻击手段清单
- 越权访问 / IDOR / BOLA：篡改 `board_id`、`workspace_id`、`share_id`、`subscription_id`、`user_id` 读取或写入别人的资源。
- 功能级越权：普通成员调用管理员、Owner、Finance、delete plan、delete board、invite member、assign plan 接口。
- 属性级越权 / Mass assignment：用户在 payload 里偷偷传 `role=owner`、`planKey=plus`、`creditBalance=999999`、`workspaceId=other`。
- SQL / NoSQL / command / template 注入：输入被拼接进查询、命令、模板或 provider payload。不要靠“禁特殊字符”防 SQLi，核心是参数化查询、结构化 API 和最小数据库权限。
- 存储型 / DOM 型 XSS：board text、chat node、sticky note、文件名、workspace 名、AI 输出、provider 错误、audit log、share 页面渲染时执行恶意脚本。
- CSRF / CSWSH：浏览器自动带 cookie，恶意站点触发敏感 HTTP 请求或打开 authenticated WebSocket。
- WebSocket 消息滥用：握手后权限撤销仍可写、viewer 发 `yjs-update`、恶意 awareness 超大 payload、compaction spam、连接数耗尽、消息乱序。
- 上传攻击：伪装图片的脚本、SVG 内嵌脚本、polyglot 文件、超大压缩包、恶意 EXIF、PDF 脚本、对象存储公开读写配置错误。
- SSRF：导入 URL、远程图片、AI 分析外链、fetch preview、webhook 回调被用于访问内网或 cloud metadata。
- 防盗链 / 资产盗用：公开 asset URL 被批量下载、热链、share link 被搜索引擎收录、导出接口被刷。
- 防刷 / 成本攻击：AI run、remove background、image gen、upload、export、invite、share resolve、login 被脚本高频调用，导致账单或数据库/Redis/WebSocket 流量暴涨。
- 爬虫 / 数据抓取：公开 pricing、share board、workspace gallery、asset thumbnails、API list/search 被持续抓取；User-Agent 或 IP 单维度限制容易被代理池绕过。
- 认证攻击：credential stuffing、password spraying、账号枚举、验证码/邮件轰炸、session fixation、token 泄漏。
- 安全配置错误：CORS `*`、缺少 CSP / HSTS / nosniff / frame-ancestors、敏感接口缓存、verbose error、debug endpoint 暴露。
- 供应链与密钥：前端包、Python 依赖、CI secret、`.env`、provider key、staging secret 外泄。

### P0：先做的安全边界
1. 统一 API 鉴权 guard
   - 建立 `assert_resource_access(resource_type, resource_id, action, context)` 口径，所有 board / snapshot / share / member / invite / billing / admin / realtime 入口必须走同一套检查。
   - 每个数据写入口只接受允许字段，忽略或拒绝 `owner_id`、`workspace_id`、`role`、`plan`、`credit` 等客户端不该控制的字段。
   - 测试：每类资源增加“换 userId / workspaceId / boardId 不能读取/修改”的 BOLA 回归。

2. WebSocket 安全加固
   - 握手时校验 Origin allowlist、room key、session、workspace、board role。
   - 每条 `yjs-update` / `sync-state-publish` / future mutation 消息前重新确认写权限；viewer 只允许读与有限 awareness。
   - 增加长连接权限撤销策略：角色变更、成员移除、share 撤销、logout 后，服务端关闭对应 room connection。
   - 增加 per-room、per-user、per-ip 连接数限制和消息速率限制；超过阈值先降级 awareness，再拒绝 document update。
   - 日志记录：connect / disconnect / denied / rate_limited / compaction_request / oversized_message。

3. HTTP 安全头和 CORS
   - 生产环境 CORS 改成明确 allowlist，不使用通配。
   - 前端页面加 CSP：限制 `script-src`、`img-src`、`connect-src`，把 API、WebSocket、对象存储、Clerk、AI 相关域名列入 allowlist。
   - 加 `X-Content-Type-Options: nosniff`、`Referrer-Policy: strict-origin-when-cross-origin`、`frame-ancestors 'none'` 或允许内嵌页面的精确策略。
   - 私有 API 响应加 `Cache-Control: no-store`；公开静态资源单独缓存。

4. 输入、输出、渲染安全
   - 服务端分类校验：名称类、邮箱、URL、颜色、ID、搜索词、富文本、AI prompt、文件名分别用不同 schema。
   - SQL 查询必须全部使用参数化；禁止 f-string 拼 SQL where/order；动态 order/column 必须 enum allowlist。
   - React 渲染只用文本节点/安全属性；禁止新增 `dangerouslySetInnerHTML`，确需富文本则 DOMPurify sanitize 后再渲染。
   - AI 输出、provider error、audit log、文件名、board text 在所有页面都按文本渲染，不能当 HTML。

5. 上传与资产防盗
   - 上传时同时校验扩展名、Content-Type、magic bytes、文件大小、像素尺寸、页数、压缩比。
   - 禁止 SVG 作为可执行图片直接展示；如支持 SVG，必须 sanitize 或转换成安全 raster。
   - 上传文件重命名为随机 asset id，剥离原文件名路径信息，原名只作为已清洗 metadata。
   - 对象存储 bucket 私有化；下载和缩略图走短期 signed URL 或后端代理鉴权。
   - 对 share/public asset 增加 `X-Robots-Tag: noindex`、防热链策略、按 share token / user / ip 限速。

6. 防刷与成本保护
   - 建立统一 rate limit 中间件：key 至少包含 IP、userId、workspaceId、route、method；登录再加 username/email 独立桶。
   - 高成本接口必须双限：每分钟短窗 + 每日配额。范围包括 AI run、image gen、remove BG、upload、export、share resolve、invite、billing checkout。
   - AI run 在服务端先做 credit / plan / admin approve / workspace role 判断，再调用 provider；失败时记录成本保护事件，不把 provider secret 或 raw response 回传前端。
   - 对重复请求加幂等 key：checkout、top up、assign plan、deduct credit、invite accept、AI run 创建。

### P1：防爬、防盗链、公开分享
1. 公开分享链接
   - token 至少 128-bit 随机；支持过期时间、撤销、重建、可选密码或 workspace-only。
   - share resolve 只返回最小字段；不返回 owner email、内部 user id、workspace inventory、未使用 asset。
   - share 页面默认 `noindex`，除非用户显式公开发布。
   - 分享链接访问日志：token hash、ip、ua、country、status、rate decision。

2. 防爬虫策略
   - `robots.txt` 只约束正规搜索引擎；业务安全不能依赖它。
   - 对公开页面/API 做 per-IP、per-session、per-token、per-user、per-ASN 多维限速。
   - 识别异常模式：连续翻页、短时间下载大量 thumbnails/assets、无资源加载的 API-only 浏览、User-Agent 高频变化。
   - 对中风险访问返回降级数据或要求登录/验证；对高风险访问 tarpit 或软封禁，不在响应里暴露具体规则。
   - 对公开作品/模板后续可加可追踪水印或 canary 元素，用于发现外部盗爬复用。

3. 业务流防刷
   - Invite：达到 seat 上限直接拒绝；创建 invite 也计入 seat pending；限制每 workspace 每小时 invite 数。
   - Finance/admin：所有创建 plan、删 plan、top up、deduct、assign seat 都需要 admin role + audit log + 幂等。
   - Board/Workspace：创建 board/group/team 的免费/付费限制服务端强制；前端只展示弹窗。
   - Export/download：按 workspace plan 限速；大图导出异步队列，避免同步阻塞。

### P2：认证、监控、供应链
1. 认证与账号保护
   - 依赖 Clerk/OIDC 的同时，本地 API 仍要校验 token、audience、issuer、过期时间。
   - 登录异常、管理员操作、支付操作触发 step-up / MFA 策略；管理员强制 MFA。
   - 登录错误提示统一，避免用户枚举；forgot password / resend email 做限流。

2. 安全日志与告警
   - 统一结构化 security event：`request_id`、`actor_user_id`、`workspace_id`、`resource_id`、`action`、`decision`、`reason`、`ip_hash`、`ua`、`created_at`。
   - 不记录密码、token、cookie、provider key、完整 prompt、完整 AI response、base64 图片。
   - 告警：403/404 异常尖峰、同 IP 多 user、同 user 多 IP、share resolve 激增、AI cost 激增、WebSocket deny/oversized 激增。

3. 依赖和密钥
   - CI 加依赖漏洞扫描、secret scan、license check。
   - `.env` / deploy secret 不进 git；staging 和 production key 分离；provider key 只在服务端。
   - 定期轮换：Clerk secret、Stripe secret、AI provider key、object storage key。

## 安全测试计划
1. API BOLA / IDOR
   - board、snapshot、member、share、collaboration、realtime、workspace、billing、admin 每个接口都测跨 user / workspace / role。
   - Staging 真实 token：运行 `PYTHONPATH=services/api python3 services/api/scripts/security_staging_auth_smoke.py --base-url <api> --bearer-token <token> --workspace-id <workspace>`，验证最小 workspace header、spoofed role/plan 不生效、恶意 Origin cookie 写请求拒绝。

2. WebSocket
   - 错 Origin、错 roomKey、viewer 写 update、成员被移除后继续写、超大 message、超速 awareness、超多连接。
   - 继续保留 15 人压测，并新增 30 人短压脚本作为非必跑 stress gate。

3. 输入/XSS
   - 名称、文字节点、chat node、AI prompt、AI response、文件名、audit log、搜索框注入 payload 后，页面只显示文本、不执行。
   - 静态 guard：运行 `node apps/web/scripts/security-static-guard.mjs`，防止新增危险 DOM sink、硬编码 secret、浏览器 token storage、非白名单 role/plan header。

4. 上传/资产
   - 伪装 MIME、错误 magic bytes、SVG 脚本、超大图片、zip bomb、路径穿越文件名、重复下载限流。

5. 防刷/防爬
   - 登录、invite、share resolve、asset download、AI run、export、remove BG 分别跑速率测试，验证 429/step-up/软封禁。
   - Redis 分布式防刷：staging 运行 `PYTHONPATH=services/api python3 services/api/scripts/security_redis_smoke.py --required`，验证真实 Redis security counter 可用。
   - 部署配置红线：staging 运行 `PYTHONPATH=services/api python3 services/api/scripts/security_deploy_config_smoke.py --env-file <api.env> --production-like --check-redis-connectivity`。
   - 公开分享前端：运行 `node apps/web/scripts/public-share-client-smoke.mjs`，验证 share 密码头、local/remote URL、create/revoke 请求体与认证头。

## 分阶段落地顺序
1. P0-A：CORS/Origin/WebSocket 权限撤销/消息限速。
2. P0-B：统一 rate limit 中间件与高成本接口配额。
3. P0-C：上传 magic bytes、asset signed URL、防热链。
4. P0-D：CSP/HTTP security headers/frontend dangerous sink audit。
5. P1-A：share token 过期/密码/noindex/访问日志。
6. P1-B：爬虫策略、bot metrics、tarpit/step-up。
7. P2：MFA/异常登录/依赖扫描/密钥轮换/安全 dashboard。

## 2026-05-20 验收补充

- Added a unified security release gate: `npm run security:gate`.
- Added browser-level E2E smoke coverage for public security headers, share
  `noindex`, public pages, and path-injection XSS probes.
- Added a browser/device smoke matrix for Chromium, Firefox, WebKit desktop and
  Chromium mobile.
- Added a low-cost API performance smoke to the release gate with p95/max
  thresholds.
- Upgraded the locked Next version to clear high-severity npm audit findings.
- Added `docs/security-release-acceptance.md` to separate local automated gates
  from staging-only blockers such as real Redis connectivity, real auth tokens,
  object storage isolation, payment test keys and 15-user WebSocket load.
- 2026-05-20 ops pass added optional Sentry SDK wiring for Next client/server/edge
  and FastAPI, with event scrubbing for cookies, query strings and sensitive
  headers.
- `npm audit --omit=dev` still reports a moderate Next/PostCSS advisory
  (`GHSA-qx2v-qp2m-jg93`) through Next's bundled PostCSS. Do not run
  `npm audit fix --force`; track this as a dependency upgrade confirmation.
- Public staging ops smoke is now green after the 2026-05-20 `b35adc0`
  redeploy: Web/API TLS, Web home security headers, Next static cache, API
  `/health` security headers and CORS preflight all passed. The previous
  security-header failure was a stale deployed-release issue.
- Post-stage browser regression fixes now keep CSRF strict while restoring
  product writes: admin proxy forwards browser Bearer auth before falling back
  to cookies and includes a trusted same-origin `Origin`; workspace settings,
  seats and invitations use a same-origin `/api/workspace-proxy/[...path]`
  allowlist; Board title validation now rejects symbol-heavy names at frontend,
  local bridge and FastAPI persistence.
- GeekAI/Nano Banana 2 output hardening now stores provider images using
  byte-detected MIME rather than provider wrapper MIME, fixing JPEG/WebP outputs
  mislabeled as PNG while preserving the SVG/PDF/non-image rejection path.

## 资料来源
- [OWASP Top 10](https://owasp.org/Top10/)
- [OWASP API Security Top 10 2023](https://owasp.org/API-Security/editions/2023/en/0x11-t10/)
- [OWASP WebSocket Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/WebSocket_Security_Cheat_Sheet.html)
- [OWASP Bot Management and Anti-Automation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Bot_Management_and_Anti-Automation_Cheat_Sheet.html)
- [OWASP Cross Site Scripting Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html)
- [OWASP SQL Injection Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html)
- [OWASP File Upload Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html)
- [OWASP CSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)
- [OWASP SSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html)
- [OWASP HTTP Headers Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Headers_Cheat_Sheet.html)
- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
- [NIST SP 800-63B](https://pages.nist.gov/800-63-4/sp800-63b.html)
- [CISA Secure by Design](https://www.cisa.gov/resources-tools/resources/secure-by-design)
