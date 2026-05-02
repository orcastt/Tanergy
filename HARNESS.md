# TANGENT Development Harness

**Updated**: 2026-05-02
**Purpose**: concise execution rules. Product, architecture and state details live in the folderized docs.

## Read Order

Fast UI polish:

1. `AGENTS.md`
2. `project_state/project_state_slice_S0_local_polish.md`
3. Relevant `PRD/PRD_slice_*.md`
4. Relevant `ARCH/ARCH_slice_*.md`
5. `dev-plans/README.md`

Architecture/API/Auth/AI/Admin/Billing/Deploy/Collaboration:

1. `AGENTS.md`
2. `project_state/project_state.md`
3. `PRD/PRD.md`
4. `ARCH/ARCH.md`
5. Relevant PRD/ARCH/project_state slice files
6. `dev-plans/README.md`

## Definition Of Ready

- The slice is classified as `Fast UI polish` or `Architecture slice`.
- Scope, non-goals and acceptance are written in the relevant slice docs.
- External dependencies are identified before coding.
- Data/API/Auth/AI/Admin changes include schema, permission and test impact.

## Definition Of Done

- Code implements only the current slice.
- Required quality gates pass.
- The relevant slice docs are updated.
- Folder total docs are updated only if a stable checkpoint or progress percentage changes.
- Root pointer docs remain thin.

## Current Priority

If external resources are not ready:

1. Smart Drawing threshold tuning.
2. i18n/status polish.
3. More realistic empty/error states for mocked production surfaces.

If external resources are ready:

1. Staging Postgres migration smoke.
2. R2/S3-compatible Asset upload/read smoke.
3. FastAPI CORS/domain smoke.
4. Web `NEXT_PUBLIC_API_BASE_URL` staging wiring.

## Required Gates

Frontend:

```bash
npm -C apps/web run lint
npm -C apps/web run typecheck
npm -C apps/web run build
git diff --check
```

Backend/API:

```bash
PYTHONPATH=services/api python3 -m pytest services/api/tests
python3 -m compileall services/api/tangent_api services/api/migrations
git diff --check
```

Docs-only:

```bash
git diff --check
```

## Hard Boundaries

- Do not touch legacy unless explicitly requested.
- Do not read `.env`.
- Do not put secrets in frontend code, docs or logs.
- Do not store image binaries, Base64, provider payloads or full logs in Board/History documents.
- Do not enable production `/admin` before real Auth and server-side admin roles.
- Do not start collaboration until Auth, Board, Asset and AiRun authority boundaries are stable.
