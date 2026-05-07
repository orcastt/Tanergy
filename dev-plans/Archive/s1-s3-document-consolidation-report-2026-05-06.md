# S1-S3 Document Consolidation Report

**Updated**: 2026-05-06
**Status**: Active consolidation report after the May 6 checkpoint.

## Goal

Collect the current truth across docs and code so the next implementation slices do not continue from stale S0/S1 assumptions.

## Files Moved

Finished baseline:

- `PRD/Finished/PRD_slice_S0_local_product_shell.md`
- `ARCH/Finished/ARCH_slice_S0_local_polish.md`
- `project_state/Finished/project_state_slice_S0_local_polish.md`

Archived reference:

- `dev-plans/Archive/overseas-cost-growth-forecast.md`

## Current Truth

- S0 is accepted and archived as a regression baseline.
- S1B has staging Web/API/Neon/R2 first smoke, but email/Auth/OAuth/Konva redeploy smoke remains.
- S1C has Clerk frontend/session bridge plus FastAPI bearer verification first pass; logout/session revocation, OTP and full JWT hardening remain.
- S1D has first-pass Board CRUD, cursor listing, owner-only copy/delete, restore, members, email invite, expiring share links, cross-workspace Asset reference blocking and public share viewing.
- S1D target rules are still stricter than some current code paths: active membership/invited-member edit/manage and explicit Asset-sharing allowlists still need hardening. The first backend effective-permission resolver and known-foreign Asset reference guard now exist.
- S1X Konva v2 is the formal Board runtime for new/saved Boards; tldraw is a gated reference route.
- S2 remains mock runtime/dataflow only; real provider calls must wait for server-side AiRun persistence, payer preflight and credit ledger settlement.
- S3 has first-pass `/admin`, audit/role management, read-only `/billing` and `/team` entitlement surfaces, but real billing, paid seats, ledger mutations and finance views are pending.
- Current migration head is `20260506_0007`; S1A core ends at `20260502_0006`, while `0007` belongs to S3 entitlement/AI-charge prep.

## Known Drift To Fix In Code

1. Active membership and invited-member state should gate edit/manage before real collaboration.
2. Explicit Asset-sharing allowlists should replace the current known-foreign Asset reference guard before richer collaboration.
3. Board list search/sort, explicit open route, snapshot cursor/reason and page-scoped history need route decisions.
4. Board guard now validates known referenced Asset ownership; explicit sharing grants remain pending.
5. Plan catalog coverage for documented `collaborate_plus` and `team_growth` tiers now exists in read-only backend/local frontend contracts; DB-backed subscription/seat read authority now exists, while mutation and ledger settlement remain pending.
6. Credit ledger read/preflight now exists before provider charging; mutation/settlement service should exist before any real provider charge is captured.
7. App/component/feature README maps are now corrected, but large modules still need later refactors.

## Large Files To Split Later

Frontend:

- `apps/web/src/components/konva-canvas/KonvaCanvasSpike.tsx`
- `apps/web/src/components/konva-canvas/KonvaNodeCardShape.tsx`
- `apps/web/src/components/konva-canvas/KonvaNodeChatBody.tsx`
- `apps/web/src/components/konva-canvas/KonvaSelectionOverlay.tsx`
- `apps/web/src/components/konva-canvas/useKonvaCanvasInteractions.ts`
- `apps/web/src/components/workspaces/BoardManagementMembers.tsx`
- `apps/web/src/components/workspaces/WorkspaceBoardGallery.tsx`

Backend/tests:

- `services/api/tangent_api/storage/postgres_board_store.py`
- `services/api/tangent_api/storage/local_board_store.py`
- `services/api/tangent_api/storage/board_storage_adapter.py`
- `services/api/tangent_api/admin_access.py`
- `services/api/tests/test_board_persistence_contracts.py`
- `services/api/tests/persistence_fakes.py`
- `services/api/tests/test_admin_contracts.py`

## Recommended Next Slices

1. S1D permission hardening and Board guard hardening.
2. S3 plan catalog, entitlement resolver and credit-ledger preflight.
3. S2 DB-backed AiRun create/poll/cancel without provider calls.
4. S2 provider adapter and generated Asset writes.
5. S3 admin/developer finance views.
6. S4 Yjs proof after Auth/Board/Asset/AiRun authority is stable.

## 中文完整翻译

# S1-S3 文档收拢报告

**更新日期**：2026-05-06
**状态**：2026-05-06 checkpoint 后的活跃收拢报告。

## 目标

收集 docs 和 code 的当前事实，让下一批 implementation slices 不再沿着过期的 S0/S1 假设继续开发。

## 已移动文件

已完成 baseline：

- `PRD/Finished/PRD_slice_S0_local_product_shell.md`
- `ARCH/Finished/ARCH_slice_S0_local_polish.md`
- `project_state/Finished/project_state_slice_S0_local_polish.md`

已归档参考：

- `dev-plans/Archive/overseas-cost-growth-forecast.md`

## 当前事实

- S0 已被接受，并作为 regression baseline 归档。
- S1B 已经有 staging Web/API/Neon/R2 第一轮 smoke，但 email/Auth/OAuth/Konva redeploy smoke 仍未完成。
- S1C 已经有 Clerk frontend/session bridge 和 FastAPI bearer verification 第一阶段；logout/session revocation、OTP 和完整 JWT hardening 仍未完成。
- S1D 已经有第一阶段 Board CRUD、cursor listing、owner-only copy/delete、restore、members、email invite、可过期 share links、cross-workspace Asset reference blocking 和 public share viewing。
- S1D 目标规则仍然比部分当前代码路径更严格：active membership / invited-member edit/manage 和明确的 Asset-sharing allowlists 仍需硬化。第一版 backend effective-permission resolver 和 known-foreign Asset reference guard 现在已经存在。
- S1X Konva v2 是 new/saved Boards 的正式 Board runtime；tldraw 是 gated reference route。
- S2 仍然只有 mock runtime/dataflow；真实 provider calls 必须等待 server-side AiRun persistence、payer preflight 和 credit ledger settlement。
- S3 已经有第一阶段 `/admin`、audit/role management、只读 `/billing` 和 `/team` entitlement surfaces，但真实 billing、paid seats、ledger mutations 和 finance views 仍待完成。
- 当前 migration head 是 `20260506_0007`；S1A core 结束于 `20260502_0006`，而 `0007` 属于 S3 entitlement / AI-charge prep。

## 需要在代码中修正的已知漂移

1. Active membership 和 invited-member state 应该在真实 collaboration 前 gate edit/manage。
2. 在进入更丰富的 collaboration 之前，明确的 Asset-sharing allowlists 应该替换当前的 known-foreign Asset reference guard。
3. Board list search/sort、显式 open route、snapshot cursor/reason 和 page-scoped history 需要做路由决策。
4. Board guard 现在会验证已知 referenced Asset 的 ownership；明确的 sharing grants 仍待完成。
5. 已文档化的 `collaborate_plus` 和 `team_growth` 档位现在已有 read-only backend / local frontend 合同覆盖；DB-backed subscription / seat read authority 已存在，而 mutation 和 ledger settlement 仍待完成。
6. 在 provider charging 前已经有 credit ledger read/preflight；在捕获任何真实 provider charge 前，还必须先有 mutation / settlement service。
7. App/component/feature README map 现在已修正，但大型模块仍需要后续拆分。

## 后续需要拆分的大文件

前端：

- `apps/web/src/components/konva-canvas/KonvaCanvasSpike.tsx`
- `apps/web/src/components/konva-canvas/KonvaNodeCardShape.tsx`
- `apps/web/src/components/konva-canvas/KonvaNodeChatBody.tsx`
- `apps/web/src/components/konva-canvas/KonvaSelectionOverlay.tsx`
- `apps/web/src/components/konva-canvas/useKonvaCanvasInteractions.ts`
- `apps/web/src/components/workspaces/BoardManagementMembers.tsx`
- `apps/web/src/components/workspaces/WorkspaceBoardGallery.tsx`

后端 / 测试：

- `services/api/tangent_api/storage/postgres_board_store.py`
- `services/api/tangent_api/storage/local_board_store.py`
- `services/api/tangent_api/storage/board_storage_adapter.py`
- `services/api/tangent_api/admin_access.py`
- `services/api/tests/test_board_persistence_contracts.py`
- `services/api/tests/persistence_fakes.py`
- `services/api/tests/test_admin_contracts.py`

## 推荐下一批切片

1. S1D permission hardening 和 Board guard hardening。
2. S3 plan catalog、entitlement resolver 和 credit-ledger preflight。
3. S2 DB-backed AiRun create/poll/cancel，但先不接 provider calls。
4. S2 provider adapter 和 generated Asset writes。
5. S3 admin/developer finance views。
6. 在 Auth/Board/Asset/AiRun authority 稳定后，再做 S4 Yjs proof。
