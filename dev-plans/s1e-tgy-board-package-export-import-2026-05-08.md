# S1E Tactical Plan: `.tgy` Board Package Export And Import

**Date**: 2026-05-08
**Status**: Planned
**Owner slice**: S1E Portable Board Packages

## Goal

Ship a reusable Tanergy Board Package file format:

```text
*.tgy
```

The first useful version should export and import a complete Konva Board with drawings, images, AI nodes, prompts, model parameters and runtime edges.

## Phase 1: Format And Validation

- Define package manifest type.
- Define accepted MIME types and package limits.
- Add `.tgy` reader/writer wrapper around a lightweight browser zip library.
- Validate manifest format/version before reading Board JSON.
- Reject path traversal, unsupported file types, `data:` and `blob:` URLs.

Acceptance:

- Invalid/tampered package fails before Board creation.
- Valid minimal package parses into `manifest`, `boardDocument` and asset entries.

## Phase 2: Export

- Add export action to the Konva Board menu.
- Reuse `serializeKonvaBoardDocument`.
- Collect all assets from top-level Board assets, image shapes and node runtime image refs.
- Fetch asset binaries from existing asset URLs/API.
- Write `manifest.json`, `board.json`, `assets/*` and optional `thumbnails/board-preview.png`.
- Download as `<board-title>.tgy`.

Acceptance:

- Export a Board with at least one uploaded image, one generated image, one drawing, one prompt node, one Image Gen node and one runtime edge.
- Resulting file can be inspected as a zip-compatible package with no Base64 images in `board.json`.

## Phase 3: Import

- Add import action from Workspace and/or Board menu.
- Upload packaged images into the current workspace.
- Create source-to-destination asset mapping.
- Rewrite image shape refs and node image refs.
- Strip source ownership/share/member metadata.
- Save imported document as a new Board through existing Board API.
- Route user to the imported Board.

Acceptance:

- Import the same `.tgy` twice and get two independent Boards.
- Imported Board uses destination-workspace asset ids and URLs.
- Original package remains reusable.

## Phase 4: Tests And Smoke

- Unit test manifest validation.
- Unit test asset rewrite for image shapes and node output refs.
- Unit test unsafe URL/path rejection.
- Run local browser smoke:
  - export mixed Board
  - import package
  - open imported Board
  - confirm drawings, images, nodes and runtime edges render
- Run `npm -C apps/web run lint`, `npm -C apps/web run typecheck` and `git diff --check`.

## Deferred

- SHA-256 asset dedupe.
- Import preview modal.
- Overwrite-current-Board option.
- Package signing or trust metadata.
- Server-side package import endpoint.
