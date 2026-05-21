# Project State Slice S1E: Tanergy Board Packages

**Updated**: 2026-05-08
**Status**: Planned. `.tgy` package export/import is documented but not implemented.

## Current Truth

- Konva v2 Boards already serialize to a guarded JSON envelope with pages, canvas document, settings, assets and runtime edges.
- Canvas shapes include drawings, images, frames, text, sticky notes and node cards.
- Node data already stores prompts, model selections, parameters and runtime summaries.
- Runtime graph edges already live in `CanvasDocument.runtimeEdges`.
- Asset upload/read APIs exist for local and remote persistence.
- Existing Board guard blocks unsafe persisted image payloads such as `data:` and `blob:` references.

## Product Decision

Use:

```text
.tgy
```

as the user-facing Tanergy Board Package file extension.

The file is zip-compatible internally, but the product should present it as one Tanergy package file.

## Planned Scope

First implementation should prioritize the full package path, not a JSON-only export:

- Export `.tgy` from a Konva Board.
- Include `manifest.json`, `board.json`, packaged images and thumbnail.
- Import `.tgy` to create a new Board.
- Re-upload assets into the destination workspace.
- Rewrite asset ids/URLs in image shapes and image-bearing nodes.
- Preserve drawings, pages, nodes, prompts, model parameters and runtime edges.

## Not Started

- Frontend package writer/reader.
- Asset binary collection.
- Asset rewrite map.
- Import UI and export UI.
- Package validation tests.
- End-to-end export/import smoke.

## Risks

- Large image-heavy Boards can produce large packages.
- Some current node output refs may need a broader rewrite helper than image shapes alone.
- Repeated imports may duplicate assets until SHA-256 dedupe is added.
- Cross-workspace asset permissions must be eliminated by re-uploading imported files.

## Next Steps

1. Add `features/board-packages` package manifest and validation helpers.
2. Add `.tgy` export from the Konva Board menu.
3. Add `.tgy` import that creates a new Board and rewrites assets.
4. Add tests for manifest validation, asset rewrite and unsafe payload rejection.
5. Run local smoke on a Board containing drawings, uploaded images, generated images, Image Gen 4, Analysis and runtime edges.
