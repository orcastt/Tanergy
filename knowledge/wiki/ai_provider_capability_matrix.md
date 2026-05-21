# AI Provider Capability Matrix

**Updated**: 2026-05-21
**Mode**: Provider/model/key-slot memory page.

This page is a derived operator matrix. The source of truth for execution is still the server-side Model Registry, provider routes, runtime env and live smoke results.

## Source Of Truth Order

1. Staging/production runtime facts: admin route APIs, DB route rows, deployment env and smoke results.
2. Canonical docs: `ARCH/ARCH_slice_S2_ai_runtime.md`, `PRD/PRD_slice_S2_ai_productization.md`, `project_state/project_state_slice_S2_ai_runtime.md`.
3. Provider docs and dated manual tests.
4. This matrix as a quick lookup.

## Key Slots

| Key slot | Scope | Current role | Notes |
| --- | --- | --- | --- |
| `GEEKAI_TEXT_API_KEY` | Server only | Chat, Prompt Optimizer and OpenAI-compatible analysis/text calls. | Must stay out of frontend code. |
| `GEEKAI_BALANCE_IMAGE_API_KEY` | Server only | Primary image-generation key slot for GeekAI image routes. | Current image scope prefers this key. |
| `GEEKAI_OFFICIAL_IMAGE_API_KEY` | Server only | Secondary/fallback image key slot. | Keep spelling `OFFICIAL`; do not mix `oficial`/`offical`. |
| `GEEKAI_VIDEO_API_KEY` | Server only | Reserved video key slot. | Not part of current accepted image/text path. |
| `JIEKOU_*` | Server only | Historical/rollback fallback. | Not the active default catalog route after the 2026-05-20 GeekAI switch. |

## Capability Matrix

| Product surface | Product model/key | Active provider route | Provider endpoint shape | Current params | Current acceptance | Open proof |
| --- | --- | --- | --- | --- | --- | --- |
| Chat Node | `qwq-plus-latest` | GeekAI text | `/api/v1/chat/completions` with SSE | `messages`, `stream: true` | Direct staging Web SSE smoke returned `200 text/event-stream` and multiple `data:` chunks after Vercel env sync. | Browser-node visible streaming still needs recurring smoke, especially because QwQ can emit reasoning chunks before final content. |
| Prompt Optimizer | `qwq-plus-latest` | GeekAI text | `/api/v1/chat/completions` with SSE | Prompt messages, `stream: true` | Local proxy and backend adapter now request upstream streaming and fold terminal text into `text_output`. | Staging browser smoke for optimizer node streaming. |
| Analysis | Qwen VL route, currently `qwen/qwen2.5-vl-72b-instruct` in docs | GeekAI OpenAI-compatible analysis | Chat-completions style call with prompt plus image refs | Image refs must be bounded and server-side; no raw image payload persistence. | Route facts are enabled/healthy on staging DB; local analysis can stream through the shared chat proxy. | Credentialed live analysis smoke and broader provider coverage. |
| Image Gen | GPT Image 2 | GeekAI image | `/images/generations` | Common sizes include `1024x1024`, `1024x1536`, `1536x1024`, `2048x2048`, `2048x1152`, `3840x2160`, `2160x3840`; quality low/medium/high by provider route support. | Staging route facts are enabled/healthy and frontend/backend contracts align; timeout boundary is 240s. | One live server-backed image smoke with persisted Asset MIME/dimensions. |
| Image Gen 4 | GPT Image 2 | GeekAI image | Repeated image generation through the same product route | Same size/quality family; four output slots are product behavior, not a provider guarantee. | Local repeated-call UX exists. | Server-backed multi-output settlement and live smoke. |
| Image Gen / Image Gen 4 | Nano Banana 2 product key | GeekAI `gemini-3.1-flash-image-preview` | `/chat/completions` with image-generation payload | `image.aspect_ratio`, `image.image_size`; frontend/backend contract includes common and extended ratios such as `21:9`, `1:4`, `4:1`, `1:8`, `8:1`. | Route facts are enabled/healthy; MIME persistence now uses byte-detected raster MIME/dimensions to avoid wrapper mismatch display failures. | Live generation smoke proving no 404/MIME mismatch on staging. |
| Image Gen / Image Gen 4 | Doubao Seedream 5.0 Lite | GeekAI route | Provider-specific image route behind server adapter | Size/output params are route-owned and should stay out of Board docs. | Staging DB reports route enabled/healthy. | Live generation smoke and pricing/cost proof. |
| Fallback | Jiekou model routes | Jiekou | Historical adapter route | Provider-specific. | Code remains for rollback/historical support. | Only activate by explicit decision and update this matrix plus DB route facts. |

## Non-Negotiables

- Provider calls stay server-side.
- The frontend shows product models and server-provided capabilities; it must not select arbitrary provider route ids or raw provider prices.
- Board documents store Asset/AiRun refs and short summaries only.
- Provider image outputs must be persisted from byte-detected MIME/dimensions, not from wrapper MIME alone.
- Route failover must never double-charge the user.

## Update Triggers

- New provider key or env naming convention.
- New model, size, ratio, quality or output-count support.
- Provider price changes.
- Any staging smoke pass/fail for text SSE, analysis or image generation.
- Admin route priority/weight/health/default changes.
- Any decision to make Jiekou or another provider active again.

## Sources

- `project_state/project_state.md`
- `project_state/project_state_slice_S2_ai_runtime.md`
- `ARCH/ARCH_slice_S2_ai_runtime.md`
- `PRD/PRD_slice_S2_ai_productization.md`
- `services/api/migrations/versions/20260520_0032_geekai_provider_routes.py`
- `services/api/migrations/versions/20260520_0033_geekai_qwq_text_default.py`
