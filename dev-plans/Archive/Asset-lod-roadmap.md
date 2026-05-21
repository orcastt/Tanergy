# Asset LOD Roadmap

**Status**: Archived superseded pointer.

The previous long Asset LOD roadmap has been removed from active context to avoid duplicating current architecture and state.

Historical source remains in Git history. Active references:

- `../../ARCH/ARCH_slice_S1_persistence_auth_deploy.md` for persistence, Postgres and R2/S3 architecture.
- `../../ARCH/ARCH_slice_S0_local_polish.md` for captured thumbnails and current Board local polish.
- `../../PRD/PRD_slice_S1_staging_auth_board.md` for staging/Auth/Board product requirements.
- `../../project_state/project_state.md` for current phase and next fork.

## Current Asset/Persistence State

- Next local Asset/Board bridge exists.
- FastAPI local-dev exists.
- S3-compatible Asset adapter exists.
- Postgres Board/Asset/History adapters exist.
- Captured Board thumbnails and History thumbnails passed browser smoke.
- Real staging Postgres/R2/domain smoke is still pending.

## Next Persistence Work When Resources Exist

1. Staging Postgres migration smoke.
2. R2/S3-compatible upload/read smoke.
3. FastAPI CORS/domain smoke.
4. Web `NEXT_PUBLIC_API_BASE_URL` staging wiring.

This archived file is not active truth.
