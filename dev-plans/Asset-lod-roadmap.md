# Asset LOD Roadmap

**Date**: 2026-04-30  
**Branch**: `feature/asset-lod-roadmap`  
**Base checkpoint**: `a6f20c1 checkpoint: stabilize s1.5 canvas runtime`  
**Status**: Slices A-D implemented and accepted locally. Slice E remains the later production Asset Pipeline. Windows/browser validation is the next quality gate, not a separate implementation slice.

**Owner**: Codex / TANGENT

---

## 1. Why This Roadmap Exists

S1.5 has proven that the tldraw-first architecture can support the core AI canvas interactions:

- Prompt / Image Gen / Image Gen 4 / Analysis / Image nodes.
- Runtime data edges, fan-out, input replacement and disconnect.
- Canvas image to Image Node.
- Image Node to canvas image.
- Local Image Node import.
- Merge Capture to Image Node.
- Low zoom Image Node preview degradation.
- React overlay and editor subscription churn reduction.

After these fixes, user testing shows the canvas is better but still slows down when a board has many images and many nodes. The current bottleneck has moved from "our React overlays refresh too often" to "the browser is paying real image rendering cost."

For a future studio collaboration product, many images and many nodes are not edge cases. A real shared project can naturally contain:

- 100+ reference, generated, screenshot and merge images.
- 50+ AI nodes.
- Many canvas annotations.
- Multiple users panning, zooming, dragging and editing at the same time.

Therefore Asset Pipeline + Image / Node LOD is now a collaboration prerequisite, not a late polish item.

---

## 2. Current Diagnosis

Already improved:

- NodeCard no longer rerenders on camera-only changes.
- Image Node can switch to reduced preview at low zoom / high density.
- Image Node now has a local resolver-backed thumbnail mode for the 25%-50% zoom band.
- Complex AI nodes can switch to a low-zoom shell while preserving clickable ports.
- Image import max dimension is adaptive by viewport width.
- Image count metrics only rescan when image-like structure changes.
- Navigator samples fewer shapes in dense boards and can collapse.
- Selection Toolbar / Style Panel hide during dragging and camera movement.
- Inspector and overlays use narrower editor revision subscriptions.
- Prompt / Analysis nodes now use resized space better, reducing wasted internal whitespace.

Still unresolved:

- Ordinary tldraw canvas image shapes can still render full image resources.
- Cross-platform performance is not validated yet on Windows Chrome / Edge, 4K displays, browser zoom settings and lower-end GPUs.
- Local spike assets still rely on tldraw local asset URLs / data URLs / blob URLs.
- Collaboration cannot safely sync or persist heavy image data in the board document.
- Link preview cards still need a server-side URL unfurl + image proxy / asset path; direct remote preview images can fail due to CORS, hotlinking or bot protection.

Main conclusion:

> Keep tldraw as the interaction and layout base. Add a real Asset Layer and local Render LOD Layer above it.

---

## 3. Product Requirement

Target workload before multiplayer collaboration:

| Dimension | Minimum Target | Stretch Target |
| --- | ---: | ---: |
| Total canvas objects | 500 | 1,000 |
| Ordinary canvas images | 100 | 250 |
| AI node cards | 50 | 150 |
| Image Nodes with previews | 50 | 150 |
| Visible objects at low zoom | dense whole-board overview | dense project wall |
| Interaction | pan / zoom / drag must remain usable | near-Miro feel |

Performance expectation:

- Zoom and pan should not become unusable when many images are visible.
- Dragging selected images should remain responsive.
- Low zoom should prefer overview clarity over full fidelity.
- High fidelity image preview can recover after camera movement stops.
- Collaboration state must stay lightweight.

---

## 4. Core Architecture Decision

### 4.1 Canvas Document Layer

The board document stores only lightweight collaborative state:

```text
shapeId
shape type
position
size
rotation
nodeId
nodeType
edge ids
assetId
short params
runtime summary
```

The board document must not store:

```text
data:
blob:
Base64 image strings
provider raw responses
large image payloads
large logs
thumbnail binary data
```

### 4.2 Asset Layer

All images should resolve through one asset model:

```text
assetId
originalUrl
thumbnail256Url
thumbnail512Url
thumbnail1024Url
width
height
mime
byteSize
createdBy
workspaceId
origin: upload | paste | ai_run | merge_capture | screenshot
createdAt
```

Local spike version may use generated blob URLs or local data URLs, but the data model must be shaped like the future server model.

### 4.3 Render LOD Layer

LOD is local UI state. It must not enter CRDT / board document.

Inputs:

- zoom level
- camera state
- dragging / panning state
- viewport size
- shape screen size
- image count density
- node count density
- asset availability

Outputs:

- original image URL
- thumbnail URL
- placeholder
- simple node shell
- full node UI

Rules:

- Low zoom: prefer thumbnails or placeholders.
- Camera moving: prefer thumbnails or placeholders.
- Camera idle: restore higher fidelity when useful.
- Small screen footprint: prefer smaller thumbnail.
- Large screen footprint: use larger thumbnail or original.
- Complex nodes at low zoom: unmount heavy controls and image previews.

---

## 5. Implementation Slices

### Slice A — Image Node Moving Degrade ✅

Goal:

Image Node should avoid mounting full image previews while camera is moving, zooming, panning or while the user is dragging.

Status:

2026-04-30 Codex implemented the local interaction-aware preview degrade. `canvasPerformanceStore` now treats camera movement, panning and dragging as a local reduced-preview signal with a short idle recovery delay; `CanvasSpike` uses `useCanvasPerformanceTracking()` so Image Nodes unmount full previews during motion and restore after idle. LOD state remains local UI state and is not written into shape props.

2026-04-30 user test confirmed the hard degrade removed the stutter but felt too abrupt because readable Image Nodes only recovered after movement stopped. Codex tuned the rule to keep full image previews during interaction when the canvas is at readable zoom (50% and above) or when an individual Image Node has a large enough on-screen footprint. Reduced preview is now reserved for low-zoom overview and high-density movement where internal image detail is not useful.

2026-04-30 Status: done locally. Quality gates passed.

Scope:

- Extend `canvasPerformanceStore` with interaction-aware preview mode.
- Use `useEditorInteractionState` / camera state to detect moving state.
- Add a short idle recovery delay, probably 120-200ms.
- Image Node shows reduced preview during movement and restores full preview after idle.

Files likely involved:

- `apps/web/src/features/canvas-performance/canvasPerformanceStore.ts`
- `apps/web/src/features/canvas-performance/editorPerformanceMetrics.ts`
- `apps/web/src/components/nodes/ImageNodePreview.tsx`
- `apps/web/src/components/canvas/CanvasSpike.tsx`

Acceptance:

- With many Image Nodes visible, zoom / pan feels smoother.
- Full Image Node previews recover after camera movement stops.
- Image Node import, merge capture and To Canvas still work.
- LOD state is not written into shape props.

Risk:

- Low. This only changes Image Node rendering behavior.

---

### Slice B — Node LOD ✅

Goal:

At low zoom or high density, complex AI nodes should not mount full React forms, buttons and previews.

Status:

2026-04-30 user testing at roughly 30 image/node objects showed remaining stutter during zooming and node connection even after Image Node preview LOD improved. Codex started Slice B by adding local `nodeCardCount` / `nodeRenderMode` to `canvasPerformanceStore`. Dense boards now switch non-readable nodes to a shell render mode at low zoom or while moving: the shell keeps node title, status and clickable ports, but skips full React controls, input summaries, payload audit footer and image/body rendering. Readable Image Nodes can still stay full so visible images are not hidden unnecessarily.

2026-04-30 user feedback: switching around 45% zoom made nodes feel unreadable too early. Codex retuned the LOD thresholds so the common 24-48 image/node board only starts reduced image preview / node shell at roughly 25% zoom. Higher thresholds are now reserved only for extreme density boards.

2026-04-30 Status: done locally. User accepted the later 25% threshold as a better interaction balance. Quality gates passed.

Scope:

- Add node render mode: `full | compact | shell`.
- Low zoom shell shows node type, title, status, run readiness and maybe one tiny preview.
- Full node UI restores at readable zoom.
- Ports must remain usable enough or clearly hidden depending on zoom threshold.
- Runtime edge geometry must still follow node bounds.

Files likely involved:

- `apps/web/src/components/nodes/NodeCardContent.tsx`
- `apps/web/src/components/nodes/NodeCardPreviews.tsx`
- `apps/web/src/components/nodes/ImageNodePreview.tsx`
- `apps/web/src/app/styles/node-card-content.css`
- `apps/web/src/features/canvas-performance/canvasPerformanceStore.ts`

Acceptance:

- 50+ AI nodes at low zoom do not mount all full controls.
- Prompt / Image Gen / Analysis node content restores when zoomed in.
- Runtime summaries and missing-input hints remain visible in some form.
- No node data model changes.

Risk:

- Medium-low. It touches node UI, but not node runtime data.

---

### Slice C — Local Asset Preview Resolver ✅

Goal:

Introduce a single client-side resolver that Image Node and future canvas image LOD can share.

Status:

2026-04-30 Codex implemented the first local resolver pass. `assetPreviewResolver` now resolves Image Node assets into `full`, `thumbnail`, or `placeholder` preview modes, keeps an in-memory thumbnail cache, and generates local 256/512 thumbnails for uploaded / merge-captured / converted tldraw image assets. `canvasPerformanceStore` now has three image modes: `full`, `thumbnail`, and `reduced`; common dense boards use thumbnail mode around the 25%-50% zoom band instead of jumping straight from original image to placeholder. This is intentionally local UI state and does not enter shape props or the board document.

2026-04-30 user test confirmed the 25%-50% band is basically usable on the current Mac browser setup after thumbnail mode. Remaining uncertainty is cross-platform behavior after real AI images, production build, Windows Chrome / Edge, browser zoom and different monitor resolutions.

2026-04-30 Status: done locally. Quality gates passed. Needs cross-platform performance validation before being considered production-ready.

Proposed API:

```ts
type AssetPreviewIntent = {
  assetId: string | null
  imageWidth?: number
  imageHeight?: number
  mode: 'full' | 'thumbnail' | 'placeholder'
  screenWidth?: number
  screenHeight?: number
}

type AssetPreviewResult = {
  src: string | null
  quality: 'original' | 'thumb-1024' | 'thumb-512' | 'thumb-256' | 'placeholder'
  width?: number
  height?: number
}
```

Scope:

- Resolve tldraw asset URL by `assetId`.
- Read optional local thumbnail metadata if available.
- Fall back safely to original URL.
- Never write chosen LOD quality into document state.

Files likely involved:

- `apps/web/src/features/node-runtime/imageNodeAssets.ts`
- new `apps/web/src/features/assets/assetPreviewResolver.ts`
- `apps/web/src/components/nodes/ImageNodePreview.tsx`

Acceptance:

- Image Node uses resolver instead of directly reaching into tldraw asset URL.
- Resolver can return original now and thumbnails later without changing node components again.
- Missing assets degrade to placeholder, not broken UI.

Risk:

- Medium. It defines the seam between current local assets and future server assets.

---

### Slice D — Ordinary Canvas Image LOD Spike ✅ Accepted Locally

Goal:

Prove how to apply LOD to ordinary tldraw image shapes.

Candidate approaches:

1. Custom `ImageShapeUtil` overriding default image rendering.
2. Asset URL resolver hook if tldraw exposes a suitable path.
3. Shape / asset metadata storing multi-size URLs, with custom render path selecting one.
4. Temporary local downsample on paste/import while preserving original asset metadata.

Important caution:

Do not permanently replace original images with downsampled versions. Users need original fidelity for export, merge and inspection.

Boundary:

Slice D is a frontend spike. It proves ordinary canvas images can use the same local resolver / thumbnail strategy as Image Node without breaking tldraw behavior. It does not build backend upload, object storage, asset tables, signed URLs, persistence migration or multiplayer-safe asset sync.

Status:

2026-04-30 Codex started the spike with the least invasive path: `CanvasImageShapeUtil` extends tldraw's default `ImageShapeUtil` and only overrides the runtime `component()` render path. Resize, geometry, cropping capability and SVG export stay on the default tldraw implementation. Ordinary canvas images now use `assetPreviewResolver` for screen rendering: full mode uses original asset URLs, and thumbnail / reduced modes use local thumbnails when available. The resolver now falls back to original image rendering if browser-side thumbnail generation fails, which protects cross-origin or tainted-canvas cases during the spike.

2026-04-30 user test: after Slice D local rendering changes, multi-image zoom / move feels much smoother and obvious stutter was not reproduced in the tested Mac browser session. The remaining bug found in the same pass was Image Node -> Image Node inheritance: downstream Image Nodes received the upstream asset id but still rendered their own empty/default placeholder. Codex fixed this by adding one effective Image Node asset rule: connected image input wins over the node's own imported asset, and empty Image Nodes no longer default to `asset_mock_image_001`.

2026-04-30 user accepted Slice D locally. The current state is good enough to checkpoint before cross-platform performance validation.

Acceptance:

- A pasted/imported canvas image can display a thumbnail at low zoom or camera movement.
- Full image restores at high zoom / idle.
- Export and Merge Capture still use correct fidelity or an explicitly chosen export source.
- Copy/paste and Convert to Image Node still work.
- Image Node -> Image Node pass-through displays the inherited upstream image and `To Canvas` uses the same effective asset.

Current acceptance state:

- Accepted in local Mac browser testing.
- Multi-image zoom / move feels smooth enough to stop tuning thresholds for now.
- Next validation is cross-platform performance, especially Windows Chrome / Edge and browser zoom settings.

Risk:

- Medium-high. This touches tldraw default image shape behavior and export consistency.

Next entry criteria:

- Keep Slice D as a spike, not a broad refactor.
- Reuse `assetPreviewResolver` instead of inventing a second image-resolution path.
- Verify Convert to Image Node, To Canvas, Screenshot and Merge Capture still use the expected fidelity.
- Add a rollback note because custom image rendering can affect tldraw export and copy/paste behavior.

---

### Slice E — Real Asset Pipeline ⏭️ Later

Goal:

Move from local spike assets to production-ready image assets before multiplayer collaboration.

Boundary:

Slice E productionizes the asset layer after the frontend LOD path is proven. It should turn local `data:` / `blob:` spike assets into durable server-backed asset records with original and thumbnail URLs. It should not be started as part of the Slice D frontend spike.

Scope:

- Backend upload endpoint.
- Object storage path strategy.
- Thumbnail generation pipeline.
- Asset table / metadata.
- Permissioned or unguessable URLs.
- Board save rejects or migrates `data:` / `blob:` image refs.
- AI-generated images and Merge Capture results become assets.

Potential storage model:

```text
assets
  id
  workspace_id
  owner_id
  origin
  original_key
  thumb_256_key
  thumb_512_key
  thumb_1024_key
  width
  height
  mime
  byte_size
  created_at
```

Acceptance:

- Board document references only asset ids.
- Refreshing the page can restore images from asset ids.
- Collaboration sync does not include image binary payloads.
- Large images are uploaded once, not broadcast through CRDT.

Risk:

- High. Requires backend, storage, auth and migration work.

---

## 6. Development Order

Recommended order:

1. ✅ Slice A — Image Node Moving Degrade
2. ✅ Slice B — Node LOD
3. ✅ Slice C — Local Asset Preview Resolver
4. ✅ Slice D — Ordinary Canvas Image LOD Spike
5. ⛳ Quality gate — Cross-platform performance pass: Windows Chrome / Edge, browser zoom, 1080p / 2K / 4K, lower-end GPU
6. ⏭️ Slice E — Real Asset Pipeline
7. Link preview backend unfurl + image proxy / asset path
8. Multiplayer collaboration

Reason:

- A and B are local UI changes with immediate performance payoff.
- C creates a stable abstraction before touching ordinary canvas image rendering.
- D is the risky tldraw integration spike.
- Cross-platform validation is a release gate after D, not a new implementation slice.
- E is required before collaboration.
- Collaboration should not be built on a board document that can still carry heavy image payloads.
- Windows/browser performance validation should happen before real AI integration changes the image sizes and density profile.

---

## 7. Non-Goals For This Roadmap

- Do not replace tldraw.
- Do not switch to React Flow or Konva as the main canvas.
- Do not build full multiplayer yet.
- Do not build full image editor.
- Do not solve backend billing or AI provider persistence here.
- Do not persist LOD mode in board document.
- Do not remove original image fidelity.

---

## 8. Risks And Mitigations

| Risk | Mitigation |
| --- | --- |
| Custom ImageShapeUtil breaks tldraw export | Keep Slice D as spike; test export / merge / copy-paste before adopting |
| LOD flickers during zoom | Add idle recovery debounce and threshold hysteresis |
| Nodes become unusable at low zoom | Show shell only when content is unreadable anyway; restore full UI at readable zoom |
| Asset resolver creates stale URLs | Keep resolver pure and local; later integrate server cache headers / signed URL refresh |
| CRDT accidentally syncs thumbnails or data URLs | Add payload audit and board save guard before collaboration |
| Too many DOM nodes remain visible | Pair image LOD with Node LOD; consider viewport unmounting only after LOD is proven insufficient |

---

## 9. Manual Test Matrix

Small board:

- 5 images, 5 nodes.
- Verify no quality regression.
- Verify imports, Convert to Image Node, To Canvas, Merge Capture.

Medium board:

- 30 images, 30 nodes.
- Zoom 10%, 50%, 100%, 200%.
- Zoom 25%-50% with Image Nodes and ordinary canvas images mixed.
- Drag selected images.
- Pan while nodes are selected.

Dense board:

- 100 images, 50 nodes.
- Zoom to overview.
- Rapid pan / zoom.
- Select and drag images.
- Run mock nodes.
- Disconnect runtime edges.

Future collaboration readiness:

- Inspect board document payload.
- Confirm no `data:` / `blob:` / Base64 image payloads in persistent state.
- Confirm asset ids are enough to restore visual state.

Cross-platform performance readiness:

- Mac Chrome / Safari at 1080p, 2K and high-DPI display settings.
- Windows Chrome / Edge at 1080p, 2K and 4K.
- Browser zoom 90%, 100%, 125%.
- Boards with 30 images / 30 nodes and 100 images / 50 nodes.
- Track whether 25%-50% zoom remains usable after real AI output images replace mock / local test assets.

---

## 10. Quality Gates

For frontend-only slices:

```bash
npm -C apps/web run lint
npm -C apps/web run typecheck
npm -C apps/web run build
git diff --check
```

For Asset Pipeline slices:

- Add backend/API tests for upload and metadata.
- Add payload audit for board document.
- Add refresh / restore test for asset-backed images.
- Add migration notes for current local spike assets.

Source size guard:

- Keep source files under 300 lines.
- Files near 250 lines should be split before adding new behavior.

---

## 11. Open Questions

1. Which tldraw extension point is safest for ordinary image LOD?
2. Should local thumbnails be generated immediately on paste/import or lazily after first render?
3. Should Merge Capture use original source images when available or current LOD display source?
4. How should asset URLs be permissioned for shared workspaces?
5. What is the minimum thumbnail set: 256/512/1024, or 320/640/1280?
6. How much of Asset Pipeline should be done before the first multiplayer spike?

---

## 12. Definition Of Done For Collaboration Prerequisite

Before multiplayer collaboration begins:

- Board document contains no image binary payloads.
- All images resolve through asset ids.
- Image Node and ordinary canvas image can both degrade during low zoom / camera movement.
- Complex AI nodes have a low-zoom shell mode.
- 100 images + 50 nodes remain usable in production build.
- Asset upload and thumbnail generation path is defined, even if initially local or mocked.
