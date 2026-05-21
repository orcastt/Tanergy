# ARCH Slice S1E: Portable Board Packages

**Updated**: 2026-05-08
**Mode**: Architecture slice.
**Status**: Planned. Existing Konva Board serialization and Asset storage are the base; `.tgy` package export/import is not implemented yet.

## Goal

Add a portable file boundary for complete Board reuse:

```text
Tanergy Board Package = *.tgy
```

The package carries a Board document plus referenced asset binaries. It should round-trip through export/import without persisting Base64 image payloads inside Board JSON.

## Package Structure

`.tgy` is zip-compatible:

```text
manifest.json
board.json
assets/
  asset-001.png
  asset-002.webp
thumbnails/
  board-preview.png
```

`manifest.json`:

```json
{
  "format": "tanergy-board-package",
  "version": 1,
  "createdAt": "2026-05-08T00:00:00.000Z",
  "app": "tanergy",
  "board": {
    "title": "Board title",
    "renderer": "konva",
    "documentVersion": 2
  },
  "assets": [
    {
      "id": "source-asset-id",
      "path": "assets/source-asset-id.png",
      "mimeType": "image/png",
      "sha256": "..."
    }
  ]
}
```

`board.json` is a guarded Konva v2 Board document:

```text
{ version: 2, renderer: "konva", activePageId, pages, canvasDocument, canvasSettings, assets }
```

## Export Flow

```text
Board route
  -> serializeKonvaBoardDocument()
  -> auditBoardDocument()
  -> collect package asset refs from images and node outputs
  -> fetch/read asset binaries through Asset client/API
  -> write manifest.json + board.json + assets/* into zip-compatible blob
  -> download <safe-board-title>.tgy
```

Do not inline image binary data into `board.json`.

## Import Flow

```text
User selects .tgy
  -> open zip-compatible package in browser
  -> parse manifest.json and board.json
  -> validate manifest format/version and Board guard
  -> upload each packaged asset into current workspace
  -> build sourceAssetId -> destinationAsset mapping
  -> rewrite CanvasImageShape and node runtime image refs
  -> strip source board/workspace/member/share ownership metadata
  -> save as a new Board through existing Board API
  -> load the new Board
```

The first implementation should always create a new Board. Overwrite-current-Board can come later.

## Asset Rewrite Contract

Rewrite all references that may point at source workspace assets:

- `CanvasImageShape.props.assetId`
- `CanvasImageShape.props.originalUrl`
- `CanvasImageShape.props.thumbnail*Url`
- Image node own asset refs.
- Image Gen / Image Gen 4 generated output refs.
- Chat/Analysis reference-image refs when represented as Board assets.
- Top-level `document.assets`.

The destination Board must only reference destination-workspace asset ids/URLs after import.

## Security Rules

- Reject `data:` and `blob:` URLs in `board.json`.
- Reject path traversal inside `.tgy` entries.
- Reject executable file types and unexpected MIME types.
- Enforce package byte limits and per-asset byte limits.
- Do not import source `workspaceId`, `ownerId`, board members, share ids or admin/billing facts.
- Imported node data must pass Node Registry normalization before save.

## Integration Points

Frontend:

```text
apps/web/src/features/board-packages/
  packageManifest.ts
  exportTgyPackage.ts
  importTgyPackage.ts
  assetRewrite.ts
```

Canvas/Board UI:

```text
Konva Board menu
  Export .tgy
  Import .tgy
```

Existing foundations:

- `serializeKonvaBoardDocument`
- `restoreKonvaBoardDocument`
- `auditBoardDocument`
- Board save/load API
- Asset upload/read API

Likely dependency:

- Browser zip library such as `fflate` or equivalent lightweight zip tooling.

## Testing

- Unit test package manifest validation.
- Unit test asset-reference rewrite.
- Unit test unsafe path and unsafe URL rejection.
- Browser-level smoke: export Board with drawings/images/nodes/edges, import package, compare counts and visual essentials.
- API smoke: imported assets belong to destination workspace and Board guard passes.

## Open Decisions

- Package size limit for P0 alpha.
- Whether import should appear in Workspace page, Board menu or both.
- Whether exported package should preserve AI run summaries or only node-level output refs.
- Whether package import should dedupe assets by SHA-256 in the first version or defer.
